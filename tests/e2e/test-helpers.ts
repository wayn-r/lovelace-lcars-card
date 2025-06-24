
import { promises as fs } from 'fs';
import { HomeAssistant, PlaywrightBrowser } from 'hass-taste-test';
import { expect } from '@playwright/test';

  if (!(HomeAssistant as any)._lcarsPatched) {
      (HomeAssistant.prototype as any).writeYAMLConfiguration = async function (additionalCfg: string) {
      const base = [
      'frontend:',
      'http:',
      `  server_host: ${this.options.host}`,
      `  server_port: ${this.chosenPort}`,
          ];

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

    (HomeAssistant.prototype as any).setDashboardView = async function (dashboardPath: string, cards: unknown[]) {
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

    const originalCreate = HomeAssistant.create;

  HomeAssistant.create = async function (config: string, options: unknown): Promise<HomeAssistant<any>> {
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

export interface AnimationTimingInfo {
  totalDuration: number;
  hasAnimations: boolean;
  hasSequences: boolean;
  elementAnimations: Map<string, number>;
}

type AnimationConfig = {
  duration?: number;
  delay?: number;
  repeat?: number;
};

type SequenceConfig = {
  steps?: Array<{
    index: number;
    animations: AnimationConfig[];
  }>;
};

type ElementConfig = {
  id?: string;
  animations?: {
    on_load?: AnimationConfig | SequenceConfig;
    on_state_change?: AnimationConfig[];
    [key: string]: unknown;
  };
};

type YamlConfig = {
  groups?: Array<{
    group_id: string;
    elements?: ElementConfig[];
  }>;
};

export class AnimationTimingCalculator {
  static calculateAnimationDuration(animationConfig: AnimationConfig): number {
    if (!animationConfig) return 0;
    
    const rawDuration = animationConfig.duration;
    let duration: number;
    
    if (typeof rawDuration === 'number') {
      duration = rawDuration < 10 ? rawDuration * 1000 : rawDuration;
    } else {
      duration = 500;
    }
    
    const repeat = typeof animationConfig.repeat === 'number' && animationConfig.repeat > 0 ? animationConfig.repeat : 0;
    
    const rawDelay = animationConfig.delay;
    let delay: number;
    
    if (typeof rawDelay === 'number') {
      delay = rawDelay < 10 ? rawDelay * 1000 : rawDelay;
    } else {
      delay = 0;
    }
    
    return delay + duration * (repeat + 1);
  }

  static calculateSequenceDuration(sequenceConfig: SequenceConfig): number {
    if (!sequenceConfig?.steps || !Array.isArray(sequenceConfig.steps)) {
      return 0;
    }

    const stepMap = new Map<number, AnimationConfig[]>();
    
    for (const step of sequenceConfig.steps) {
      if (!step || typeof step.index !== 'number') continue;
      
      if (!stepMap.has(step.index)) {
        stepMap.set(step.index, []);
      }
      
      if (Array.isArray(step.animations)) {
        stepMap.get(step.index)!.push(...step.animations);
      }
    }

    let totalDuration = 0;
    const sortedIndices = Array.from(stepMap.keys()).sort((a, b) => a - b);
    
    for (const index of sortedIndices) {
      const animations = stepMap.get(index)!;
      
      let stepMaxDuration = 0;
      for (const anim of animations) {
        const animDuration = this.calculateAnimationDuration(anim);
        stepMaxDuration = Math.max(stepMaxDuration, animDuration);
      }
      
      totalDuration += stepMaxDuration;
    }

    return totalDuration;
  }

  static analyzeElementAnimations(elementConfig: ElementConfig, elementId: string): number {
    if (!elementConfig?.animations) return 0;

    let maxDuration = 0;

    if (elementConfig.animations.on_load) {
      const onLoadConfig = elementConfig.animations.on_load;
      
      if ('steps' in onLoadConfig && onLoadConfig.steps) {
        const sequenceDuration = this.calculateSequenceDuration(onLoadConfig);
        maxDuration = Math.max(maxDuration, sequenceDuration);
      } else {
        const animDuration = this.calculateAnimationDuration(onLoadConfig as AnimationConfig);
        maxDuration = Math.max(maxDuration, animDuration);
      }
    }

    if (Array.isArray(elementConfig.animations.on_state_change)) {
      for (const stateAnim of elementConfig.animations.on_state_change) {
        const animDuration = this.calculateAnimationDuration(stateAnim);
        maxDuration = Math.max(maxDuration, animDuration);
      }
    }

    for (const [key, value] of Object.entries(elementConfig.animations)) {
      if (key !== 'on_load' && key !== 'on_state_change' && value) {
        if (typeof value === 'object' && 'steps' in value && Array.isArray((value as any).steps)) {
          const sequenceDuration = this.calculateSequenceDuration(value as SequenceConfig);
          maxDuration = Math.max(maxDuration, sequenceDuration);
        } else if (typeof value === 'object') {
          const animDuration = this.calculateAnimationDuration(value as AnimationConfig);
          maxDuration = Math.max(maxDuration, animDuration);
        }
      }
    }

    return maxDuration;
  }

  static analyzeConfigurationTiming(yamlConfig: YamlConfig): AnimationTimingInfo {
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
          
          if (element.animations?.on_load && 'steps' in element.animations.on_load) {
            result.hasSequences = true;
          }
        }
      }
    }

    const MAX_ANIMATION_WAIT = 10000;
    if (result.totalDuration > MAX_ANIMATION_WAIT) {
      console.warn(`Animation duration ${result.totalDuration}ms exceeds maximum, capping at ${MAX_ANIMATION_WAIT}ms`);
      result.totalDuration = MAX_ANIMATION_WAIT;
    }

    return result;
  }

  static analyzeConfigurationTimingWithDebug(yamlConfig: YamlConfig, enableLogging: boolean = false): AnimationTimingInfo {
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
  static async waitForAnimations(
    page: any, 
    timingInfo: AnimationTimingInfo, 
    bufferMs: number = 500
  ): Promise<void> {
    if (!timingInfo.hasAnimations) {
      await page.waitForTimeout(100);
      return;
    }

    const waitTime = Math.ceil(timingInfo.totalDuration) + bufferMs;
    await page.waitForTimeout(waitTime);
  }

  static async waitForStateChangeAnimations(
    page: any,
    yamlConfig: any,
    targetElementId: string,
    bufferMs: number = 500
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
      const MAX_STATE_CHANGE_WAIT = 5000;
      if (maxStateChangeDuration > MAX_STATE_CHANGE_WAIT) {
        maxStateChangeDuration = MAX_STATE_CHANGE_WAIT;
              }
        
        const waitTime = Math.ceil(maxStateChangeDuration) + bufferMs;
      await page.waitForTimeout(waitTime);
          } else {
        await page.waitForTimeout(400);
      }
  }

  static async waitForInteractionEffects(
    page: any,
    interactionType: 'hover' | 'active' | 'click',
    baseWaitMs: number = 250
  ): Promise<void> {
    await page.waitForTimeout(baseWaitMs);
    
    if (interactionType === 'hover') {
      await page.waitForTimeout(200);
    } else if (interactionType === 'active') {
      await page.waitForTimeout(100);
    } else if (interactionType === 'click') {
      await page.waitForTimeout(350);
    }
    
    await page.waitForTimeout(50);
  }

  static async waitForGSAPTimelines(
    page: any,
    estimatedDuration: number,
    bufferMs: number = 500
  ): Promise<void> {
    const MAX_GSAP_WAIT = 5000;
    const cappedDuration = Math.min(estimatedDuration, MAX_GSAP_WAIT);
    
    const waitTime = Math.ceil(cappedDuration) + bufferMs;
    await page.waitForTimeout(waitTime);
  }

  static async ensureShadowDOMStability(
    page: any,
    cardLocator: any,
    retries: number = 3
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await cardLocator.locator('svg').waitFor({ state: 'attached', timeout: 1000 });
        await page.waitForTimeout(100);
        await cardLocator.locator('svg').waitFor({ state: 'attached', timeout: 500 });
        break;
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await page.waitForTimeout(100);
      }
    }
  }

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

    let currentStep = stepIndex;
    await buttonLocator.hover();
    await this.waitForInteractionEffects(page, 'hover');
    await this.ensureShadowDOMStability(page, cardLocator);
    await page.waitForTimeout(50);
    
    const paddedCurrentStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedCurrentStep}-${buttonFullId}-mouse-hover.png`);
    currentStep++;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await this.waitForInteractionEffects(page, 'active');
    await this.ensureShadowDOMStability(page, cardLocator);
    await page.waitForTimeout(50);
    
    const paddedActiveStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedActiveStep}-${buttonFullId}-mouse-click.png`);
    currentStep++;

    await page.mouse.up();
    await this.waitForInteractionEffects(page, 'click');
    await this.ensureShadowDOMStability(page, cardLocator);
    
    await page.mouse.move(centerX + 100, centerY + 100);
    await page.waitForTimeout(200);
    await this.ensureShadowDOMStability(page, cardLocator);
    
    const paddedAwayStep = currentStep.toString().padStart(2, '0');
    await expect(cardLocator).toHaveScreenshot(`${baseName}-${paddedAwayStep}-${buttonFullId}-mouse-away.png`);
    currentStep++;

    return currentStep;
  }
}
