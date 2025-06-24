// Helpers to modify hass-taste-test behaviour for our e2e suite.
// 1) Create a *very* minimal Home Assistant configuration so startup is fast
//    and only the integrations/entities the LCARS examples need are loaded.
// 2) Force each generated Lovelace view into panel-mode so the LCARS card can
//    use the full width in our screenshots. We no longer override the theme or
//    background – the test pages will use Home Assistant's default styles.

import { promises as fs } from 'fs';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';
import { expect } from '@playwright/test';

// Prevent double-patching if this file is imported in multiple spec files.
if (!(HomeAssistant as any)._lcarsPatched) {
  //--------------------------------------------------------------------------
  // 1. Patch writeYAMLConfiguration → strip `default_config:` and add only the
  //    integrations we explicitly need.
  //--------------------------------------------------------------------------
  (HomeAssistant.prototype as any).writeYAMLConfiguration = async function (additionalCfg: string) {
    // Core services so Lovelace & HTTP work.
    const base = [
      'frontend:',
      'http:',
      `  server_host: ${this.options.host}`,
      `  server_port: ${this.chosenPort}`,
    ];

    // Lightweight "demo" entities the example dashboards rely on.
    const demoEntities = [
      'input_boolean:',
      '  kitchen_sink_light:',
      '    name: Kitchen Sink Light',
      '',
      'input_number:',
      '  kitchen_sink_brightness:',
      '    name: Kitchen Sink Brightness',
      '    min: 0',
      '    max: 255',
      '    initial: 122',
      '    step: 1',
      '',
      'light:',
      '  - platform: template',
      '    lights:',
      '      kitchen_sink_light:',
      '        friendly_name: "Kitchen Sink Light"',
      '        value_template: \'{{ states("input_boolean.kitchen_sink_light") == "on" }}\'',
      '        level_template: \'{{ states("input_number.kitchen_sink_brightness") | int }}\'',
      '        turn_on:',
      '          - service: input_boolean.turn_on',
      '            target:',
      '              entity_id: input_boolean.kitchen_sink_light',
      '          - service: input_number.set_value',
      '            target:',
      '              entity_id: input_number.kitchen_sink_brightness',
      '            data:',
      '              value: 122',
      '        turn_off:',
      '          - service: input_boolean.turn_off',
      '            target:',
      '              entity_id: input_boolean.kitchen_sink_light',
      '          - service: input_number.set_value',
      '            target:',
      '              entity_id: input_number.kitchen_sink_brightness',
      '            data:',
      '              value: 0',
      '        set_level:',
      '          service: input_number.set_value',
      '          target:',
      '            entity_id: input_number.kitchen_sink_brightness',
      '          data:',
      '            value: "{{ brightness }}"',
    ];

    const contents = [...base, '', additionalCfg.trim(), '', ...demoEntities, ''].join('\n');
    await fs.writeFile(this.path_confFile(), contents);
  };

  //--------------------------------------------------------------------------
  // 2. Patch setDashboardView → save dashboards in *panel* mode so the LCARS
  //    card always occupies the full browser width.
  //--------------------------------------------------------------------------
  (HomeAssistant.prototype as any).setDashboardView = async function (dashboardPath: string, cards: any[]) {
    await this.ws.sendMessagePromise({
      type: 'lovelace/config/save',
      url_path: dashboardPath,
      config: {
        title: 'LCARS Test',
        views: [
          {
            path: 'default_view',
            title: 'LCARS',
            panel: true,
            cards,
          },
        ],
      },
    });
  };

  // Monkey-patch the HomeAssistant class to provide a default config that includes
  // our dependencies and a simple `kitchen_sink_light` that can be used
  // across all test configurations.
  const originalCreate = HomeAssistant.create;

  HomeAssistant.create = async function (config: string, options: any): Promise<HomeAssistant<any>> {
    const fullConfig =
`input_boolean:
  kitchen_sink_light:
    name: Kitchen Sink Light

input_number:
  kitchen_sink_brightness:
    name: Kitchen Sink Brightness
    min: 0
    max: 255
    step: 1
    initial: 0

light:
  - platform: template
    lights:
      kitchen_sink_light:
        friendly_name: "Kitchen Sink Light"
        value_template: '{{ states("input_boolean.kitchen_sink_light") == "on" }}'
        level_template: '{{ states("input_number.kitchen_sink_brightness") | int }}'
        turn_on:
          - service: input_boolean.turn_on
            target:
              entity_id: input_boolean.kitchen_sink_light
          - service: input_number.set_value
            target:
              entity_id: input_number.kitchen_sink_brightness
            data:
              value: 122
        turn_off:
          - service: input_boolean.turn_off
            target:
              entity_id: input_boolean.kitchen_sink_light
          - service: input_number.set_value
            target:
              entity_id: input_number.kitchen_sink_brightness
            data:
              value: 0
        set_level:
          service: input_number.set_value
          target:
            entity_id: input_number.kitchen_sink_brightness
          data:
            value: "{{ brightness }}"
` + config;

    return originalCreate.call(this, fullConfig, options);
  };

  (HomeAssistant as any)._lcarsPatched = true;
}

// ============================================================================
// Animation Timing Utilities for Proper Test Synchronization
// ============================================================================

export interface AnimationTimingInfo {
  totalDuration: number;
  hasAnimations: boolean;
  hasSequences: boolean;
  elementAnimations: Map<string, number>; // elementId -> max duration for that element
}

export class AnimationTimingCalculator {
  /**
   * Calculate duration for a single animation using the same formula as Animation.getRuntime()
   * Formula: delay + duration * (repeat + 1)
   */
  static calculateAnimationDuration(animationConfig: any): number {
    if (!animationConfig) return 0;
    
    // The Animation.getRuntime() method expects duration in milliseconds and uses default 500ms
    // In YAML configs, values like duration: 2 or duration: 0.5 represent seconds, so convert to ms
    // But values like duration: 500 or duration: 1500 are already in milliseconds
    const rawDuration = animationConfig.duration;
    let duration: number;
    
    if (typeof rawDuration === 'number') {
      // If value is less than 10, treat it as seconds and convert to milliseconds
      // If value is 10 or greater, treat it as milliseconds
      duration = rawDuration < 10 ? rawDuration * 1000 : rawDuration;
    } else {
      duration = 500; // Default 500ms as per Animation.getRuntime()
    }
    
    const repeat = typeof animationConfig.repeat === 'number' && animationConfig.repeat > 0 ? animationConfig.repeat : 0;
    
    // Same logic for delay
    const rawDelay = animationConfig.delay;
    let delay: number;
    
    if (typeof rawDelay === 'number') {
      delay = rawDelay < 10 ? rawDelay * 1000 : rawDelay;
    } else {
      delay = 0;
    }
    
    // Use same formula as Animation.getRuntime(): delay + duration * (repeat + 1)
    return delay + duration * (repeat + 1);
  }

  /**
   * Calculate total duration for an animation sequence
   * Sequences run steps sequentially, with parallel animations within each step
   */
  static calculateSequenceDuration(sequenceConfig: any): number {
    if (!sequenceConfig?.steps || !Array.isArray(sequenceConfig.steps)) {
      return 0;
    }

    // Group animations by step index and calculate sequential timing
    const stepMap = new Map<number, any[]>();
    
    for (const step of sequenceConfig.steps) {
      if (!step || typeof step.index !== 'number') continue;
      
      if (!stepMap.has(step.index)) {
        stepMap.set(step.index, []);
      }
      
      if (Array.isArray(step.animations)) {
        stepMap.get(step.index)!.push(...step.animations);
      }
    }

    // Calculate duration for each step (steps run sequentially)
    let totalDuration = 0;
    const sortedIndices = Array.from(stepMap.keys()).sort((a, b) => a - b);
    
    for (const index of sortedIndices) {
      const animations = stepMap.get(index)!;
      
      // Within a step, animations run in parallel, so we take the maximum duration
      let stepMaxDuration = 0;
      for (const anim of animations) {
        const animDuration = this.calculateAnimationDuration(anim);
        stepMaxDuration = Math.max(stepMaxDuration, animDuration);
      }
      
      // Steps run sequentially, so add to total
      totalDuration += stepMaxDuration;
    }

    return totalDuration;
  }

  /**
   * Analyze all animations for a single element and return the maximum duration
   */
  static analyzeElementAnimations(elementConfig: any, elementId: string): number {
    if (!elementConfig?.animations) return 0;

    let maxDuration = 0;

    // Check on_load animations
    if (elementConfig.animations.on_load) {
      const onLoadConfig = elementConfig.animations.on_load;
      
      if (onLoadConfig.steps) {
        // This is a sequence
        const sequenceDuration = this.calculateSequenceDuration(onLoadConfig);
        maxDuration = Math.max(maxDuration, sequenceDuration);
      } else {
        // This is a single animation
        const animDuration = this.calculateAnimationDuration(onLoadConfig);
        maxDuration = Math.max(maxDuration, animDuration);
      }
    }

    // Check state change animations
    if (Array.isArray(elementConfig.animations.on_state_change)) {
      for (const stateAnim of elementConfig.animations.on_state_change) {
        const animDuration = this.calculateAnimationDuration(stateAnim);
        maxDuration = Math.max(maxDuration, animDuration);
      }
    }

    // Check other animation types (on_show, on_hide, etc.)
    for (const [key, value] of Object.entries(elementConfig.animations)) {
      if (key !== 'on_load' && key !== 'on_state_change' && value) {
        if (typeof value === 'object' && (value as any).steps) {
          // Sequence animation
          const sequenceDuration = this.calculateSequenceDuration(value);
          maxDuration = Math.max(maxDuration, sequenceDuration);
        } else if (typeof value === 'object') {
          // Single animation
          const animDuration = this.calculateAnimationDuration(value);
          maxDuration = Math.max(maxDuration, animDuration);
        }
      }
    }

    return maxDuration;
  }

  static analyzeConfigurationTiming(yamlConfig: any): AnimationTimingInfo {
    const result: AnimationTimingInfo = {
      totalDuration: 0,
      hasAnimations: false,
      hasSequences: false,
      elementAnimations: new Map()
    };

    if (!yamlConfig?.groups) {
      return result;
    }

    for (const group of yamlConfig.groups) {
      if (!group.elements) continue;

      for (const element of group.elements) {
        const elementId = `${group.group_id}.${element.id}`;
        const elementDuration = this.analyzeElementAnimations(element, elementId);
        
        if (elementDuration > 0) {
          result.elementAnimations.set(elementId, elementDuration);
          result.totalDuration = Math.max(result.totalDuration, elementDuration);
          result.hasAnimations = true;
          
          if (element.animations?.on_load?.steps) {
            result.hasSequences = true;
          }
        }
      }
    }

    // Cap maximum duration to prevent excessively long waits
    const MAX_ANIMATION_WAIT = 10000; // 10 seconds max
    if (result.totalDuration > MAX_ANIMATION_WAIT) {
      console.warn(`Animation duration ${result.totalDuration}ms exceeds maximum, capping at ${MAX_ANIMATION_WAIT}ms`);
      result.totalDuration = MAX_ANIMATION_WAIT;
    }

    return result;
  }

  /**
   * Calculate timing info with debug logging for troubleshooting
   */
  static analyzeConfigurationTimingWithDebug(yamlConfig: any, enableLogging: boolean = false): AnimationTimingInfo {
    const result = this.analyzeConfigurationTiming(yamlConfig);
    
    if (enableLogging) {
      console.log('Animation Timing Analysis:');
      console.log(`  Total duration: ${result.totalDuration}ms`);
      console.log(`  Has animations: ${result.hasAnimations}`);
      console.log(`  Has sequences: ${result.hasSequences}`);
      console.log('  Element animations:');
      for (const [elementId, duration] of result.elementAnimations) {
        console.log(`    ${elementId}: ${duration}ms`);
      }
    }
    
    return result;
  }
}

export class TestWaitHelper {
  /**
   * Wait for animations to complete based on configuration analysis
   * Includes the required 0.5s buffer after animations complete
   */
  static async waitForAnimations(
    page: any, 
    timingInfo: AnimationTimingInfo, 
    bufferMs: number = 500  // Required 0.5s buffer after animations complete
  ): Promise<void> {
    if (!timingInfo.hasAnimations) {
      // No animations, just a brief wait for any rendering to settle
      await page.waitForTimeout(100);
      return;
    }

    // Calculate wait time: animation duration + required 0.5s buffer
    const waitTime = Math.ceil(timingInfo.totalDuration) + bufferMs;
    
    // Wait for the calculated duration plus buffer
    await page.waitForTimeout(waitTime);
  }

  /**
   * Wait for state change animations triggered by interactions
   * Includes the required 0.5s buffer after animations complete
   */
  static async waitForStateChangeAnimations(
    page: any,
    yamlConfig: any,
    targetElementId: string,
    bufferMs: number = 500  // Required 0.5s buffer after animations complete
  ): Promise<void> {
    if (!yamlConfig?.groups) {
      await page.waitForTimeout(100);
      return;
    }

    let maxStateChangeDuration = 0;

    // Find the target element and analyze its state change animations
    for (const group of yamlConfig.groups) {
      if (!group.elements) continue;

      for (const element of group.elements) {
        const elementId = `${group.group_id}.${element.id}`;
        if (elementId === targetElementId && element.animations?.on_state_change) {
          for (const stateAnim of element.animations.on_state_change) {
            const duration = AnimationTimingCalculator.calculateAnimationDuration(stateAnim);
            maxStateChangeDuration = Math.max(maxStateChangeDuration, duration);
          }
        }
      }
    }

    if (maxStateChangeDuration > 0) {
      // Cap maximum duration to prevent timeouts
      const MAX_STATE_CHANGE_WAIT = 5000; // 5 seconds max
      if (maxStateChangeDuration > MAX_STATE_CHANGE_WAIT) {
        maxStateChangeDuration = MAX_STATE_CHANGE_WAIT;
      }
      
      // Calculate wait time: animation duration + required 0.5s buffer
      const waitTime = Math.ceil(maxStateChangeDuration) + bufferMs;
      await page.waitForTimeout(waitTime);
    } else {
      // Default wait for any potential animations not detected
      await page.waitForTimeout(400);
    }
  }

  /**
   * Enhanced wait for interactions that considers both hover/active state timing and subsequent animations
   */
  static async waitForInteractionEffects(
    page: any,
    interactionType: 'hover' | 'active' | 'click',
    baseWaitMs: number = 250  // Base wait for CSS transitions and immediate visual feedback
  ): Promise<void> {
    // Base wait for CSS transitions and immediate visual feedback
    await page.waitForTimeout(baseWaitMs);
    
    // Additional waits based on interaction type
    if (interactionType === 'hover') {
      // Extra time for shadow DOM re-render and color updates to stabilize
      await page.waitForTimeout(200);
    } else if (interactionType === 'active') {
      // Active states need time for mouse down visual feedback
      await page.waitForTimeout(100);
    } else if (interactionType === 'click') {
      // Extra time for action processing and state changes
      await page.waitForTimeout(350);
    }
    
    // Additional stabilization wait for all interactions
    await page.waitForTimeout(50);
  }

  /**
   * Wait specifically for GSAP timeline completion with extra buffer
   * Includes the required 0.5s buffer after animations complete
   */
  static async waitForGSAPTimelines(
    page: any,
    estimatedDuration: number,
    bufferMs: number = 500  // Required 0.5s buffer after animations complete
  ): Promise<void> {
    // Cap maximum duration to prevent timeouts
    const MAX_GSAP_WAIT = 5000; // 5 seconds max
    const cappedDuration = Math.min(estimatedDuration, MAX_GSAP_WAIT);
    
    // Calculate wait time: animation duration + required 0.5s buffer
    const waitTime = Math.ceil(cappedDuration) + bufferMs;
    await page.waitForTimeout(waitTime);
  }

  /**
   * Ensure shadow DOM stability after interactive state changes
   * This is particularly important for hover states where shadow DOM re-rendering can vary
   */
  static async ensureShadowDOMStability(
    page: any,
    cardLocator: any,
    retries: number = 3
  ): Promise<void> {
    // Wait for shadow DOM to be stable
    for (let i = 0; i < retries; i++) {
      try {
        // Check if the card's shadow DOM is accessible and stable
        await cardLocator.locator('svg').waitFor({ state: 'attached', timeout: 1000 });
        
        // Additional wait for any pending updates to settle
        await page.waitForTimeout(100);
        
        // Verify stability by checking if SVG is still attached
        await cardLocator.locator('svg').waitFor({ state: 'attached', timeout: 500 });
        
        break; // Success
      } catch (error) {
        if (i === retries - 1) {
          throw error; // Last retry failed
        }
        await page.waitForTimeout(100); // Brief wait before retry
      }
    }
  }

  /**
   * Enhanced click interaction with proper mouse down/up states for better visual testing
   * Returns the updated step index after taking all screenshots
   */
  static async performClickSequence(
    page: any,
    buttonLocator: any,
    cardLocator: any,
    baseName: string,
    buttonFullId: string,
    stepIndex: number
  ): Promise<number> {
    const box = await buttonLocator.boundingBox();
    if (!box) return stepIndex;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Step N: Mouse hover state
    let currentStep = stepIndex;
    await buttonLocator.hover();
    await this.waitForInteractionEffects(page, 'hover');
    await this.ensureShadowDOMStability(page, cardLocator);
    await page.waitForTimeout(50); // Brief stabilization
    
    const paddedCurrentStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedCurrentStep}-${buttonFullId}-mouse-hover.png`);
    currentStep++;

    // Step N+1: Mouse down (active) state
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await this.waitForInteractionEffects(page, 'active');
    await this.ensureShadowDOMStability(page, cardLocator);
    await page.waitForTimeout(50); // Brief stabilization for active state capture
    
    const paddedActiveStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedActiveStep}-${buttonFullId}-mouse-click.png`);
    currentStep++;

    // Step N+2: Mouse up (complete click)
    await page.mouse.up();
    await this.waitForInteractionEffects(page, 'click');
    await this.ensureShadowDOMStability(page, cardLocator);
    
    // Step N+3: Mouse away (return to normal state)
    await page.mouse.move(centerX + 100, centerY + 100); // Move mouse away from element
    await page.waitForTimeout(200); // Wait for hover state to clear
    await this.ensureShadowDOMStability(page, cardLocator);
    
    const paddedAwayStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedAwayStep}-${buttonFullId}-mouse-away.png`);
    currentStep++;

    return currentStep;
  }
}
