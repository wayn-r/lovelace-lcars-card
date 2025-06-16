import { HomeAssistant } from 'custom-card-helpers';
import { gsap } from 'gsap';
import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';
import { Color } from './color.js';
import { transformPropagator, AnimationSyncData } from './transform-propagator.js';
import { colorResolver } from './color-resolver.js';

/**
 * Animation context containing element-specific data and callbacks
 */
export interface AnimationContext {
  elementId: string;
  getShadowElement?: (id: string) => Element | null;
  hass?: HomeAssistant;
  requestUpdateCallback?: () => void;
}

/**
 * Pure animation configuration for creating timelines
 */
export interface PureAnimationConfig {
  type: 'scale' | 'slide' | 'fade' | 'custom_gsap';
  duration?: number;
  ease?: string;
  delay?: number;
  repeat?: number;
  yoyo?: boolean;
  // Type-specific parameters
  scale_params?: {
    scale_start?: number;
    scale_end?: number;
    transform_origin?: string;
  };
  slide_params?: {
    direction?: string;
    distance?: string;
    opacity_start?: number;
    opacity_end?: number;
    movement?: 'in' | 'out';
  };
  fade_params?: {
    opacity_start?: number;
    opacity_end?: number;
  };
  custom_gsap_params?: {
    [key: string]: any;
  };
}

/**
 * Result of creating a pure animation timeline
 */
export interface AnimationTimelineResult {
  timeline: gsap.core.Timeline;
  affectsPositioning: boolean;
  syncData: AnimationSyncData;
}

/**
 * Animation state tracking for element animation management
 */
export interface ElementAnimationState {
  lastKnownEntityStates: Map<string, any>;
}

/**
 * Purified Animation manager responsible for creating pure, idempotent animation timelines
 * Color transitions are handled by ColorResolver, not here
 */
export class AnimationManager {
  // Minimal caching using WeakMaps for performance only
  private positioningEffectsCache = new WeakMap<PureAnimationConfig, boolean>();
  
  // Animation state tracking - minimal state for element animation management
  private elementAnimationStates = new Map<string, ElementAnimationState>();

  /**
   * Initialize animation tracking for an element
   * This sets up the minimal state needed for animation management
   */
  initializeElementAnimationTracking(elementId: string): void {
    if (!this.elementAnimationStates.has(elementId)) {
      this.elementAnimationStates.set(elementId, {
        lastKnownEntityStates: new Map()
      });
    }
  }

  /**
   * Get animation state for an element
   */
  getElementAnimationState(elementId: string): ElementAnimationState | undefined {
    return this.elementAnimationStates.get(elementId);
  }

  /**
   * Clean up all animation tracking for element
   */
  cleanupElementAnimationTracking(elementId: string): void {
    this.elementAnimationStates.delete(elementId);
  }

  /**
   * Animate element property using GSAP
   */
  animateElementProperty(
    elementId: string,
    property: string,
    value: any,
    duration: number = 0.5,
    getShadowElement?: (id: string) => Element | null
  ): void {
    if (!getShadowElement) return;
    
    const element = getShadowElement(elementId);
    if (!element) return;
    
    gsap.to(element, {
      [property]: value,
      duration: duration,
      ease: 'power2.out'
    });
  }

  /**
   * Normalize color for comparison (utility method)
   */
  private normalizeColorForComparison(color: string): string {
    if (!color) return '';
    
    // Trim and lowercase
    color = color.trim().toLowerCase();
    
    // Handle rgb() and rgba() formats
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    
    // Handle hex colors without #
    if (/^[0-9a-f]{6}$/i.test(color)) {
      return `#${color}`;
    }
    
    // Return as-is (already hex or named color)
    return color;
  }

  /**
   * Check if animation affects element positioning and requires propagation
   */
  private _animationAffectsPositioning(animation: PureAnimationConfig): boolean {
    // Check cache first
    if (this.positioningEffectsCache.has(animation)) {
      return this.positioningEffectsCache.get(animation)!;
    }

    let affects = false;
    switch (animation.type) {
      case 'scale':
      case 'slide':
        affects = true;
        break;
      case 'custom_gsap':
        const customVars = animation.custom_gsap_params || {};
        affects = customVars.scale !== undefined || 
                 customVars.x !== undefined || 
                 customVars.y !== undefined ||
                 customVars.rotation !== undefined;
        break;
      default:
        affects = false;
    }

    // Cache result
    this.positioningEffectsCache.set(animation, affects);
    return affects;
  }

  /**
   * Create a pure, idempotent animation timeline
   * This is the core purified method that replaces executeTransformableAnimation
   */
  createAnimationTimeline(
    elementId: string,
    animationConfig: PureAnimationConfig,
    targetElement: Element,
    gsapInstance: typeof gsap = gsap
  ): AnimationTimelineResult {
    // Create new timeline - pure and idempotent
    const timeline = gsapInstance.timeline();
    
    const { type, duration = 0.5, ease = 'power2.out', delay, repeat, yoyo } = animationConfig;
    
    const syncData: AnimationSyncData = {
      duration,
      ease,
      delay,
      repeat,
      yoyo
    };

    const animationProps: any = {
      duration,
      ease,
    };
    
    if (repeat !== undefined) animationProps.repeat = repeat;
    if (yoyo !== undefined) animationProps.yoyo = yoyo;

    // Build animation based on type - all pure operations
    switch (type) {
      case 'scale':
        this._buildScaleAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'slide':
        this._buildSlideAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'fade':
        this._buildFadeAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'custom_gsap':
        this._buildCustomGsapAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
    }

    return {
      timeline,
      affectsPositioning: this._animationAffectsPositioning(animationConfig),
      syncData
    };
  }

  /**
   * Execute an animation with propagation support
   * This replaces the old executeTransformableAnimation but uses the pure timeline creation
   */
  executeAnimation(
    elementId: string,
    animationConfig: PureAnimationConfig,
    context: AnimationContext,
    gsapInstance: typeof gsap = gsap
  ): AnimationTimelineResult | null {
    const targetElement = context.getShadowElement?.(elementId);
    if (!targetElement) {
      console.warn(`[AnimationManager] Animation target element not found: ${elementId}`);
      return null;
    }

    // Create pure timeline
    const result = this.createAnimationTimeline(elementId, animationConfig, targetElement, gsapInstance);
    
    // Handle propagation if needed
    if (result.affectsPositioning) {
      transformPropagator.processAnimationWithPropagation(
        elementId,
        animationConfig as any, // Cast for compatibility
        result.syncData
      );
    }

    return result;
  }



  private _buildScaleAnimation(
    config: PureAnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: any
  ): void {
    const { scale_params } = config;
    if (scale_params) {
      if (scale_params.scale_start !== undefined) {
        const initialScaleProps = {
          scale: scale_params.scale_start,
          transformOrigin: scale_params.transform_origin || 'center center'
        };
        timeline.set(targetElement, initialScaleProps);
      }
      animationProps.scale = scale_params.scale_end !== undefined ? scale_params.scale_end : 1;
      animationProps.transformOrigin = scale_params.transform_origin || 'center center';
    }
    timeline.to(targetElement, animationProps);
  }

  private _buildSlideAnimation(
    config: PureAnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: any
  ): void {
    const { slide_params } = config;
    if (slide_params) {
      const distance = this._parseDistanceValue(slide_params.distance || '0', targetElement);
      const movement = slide_params.movement;

      let calculatedX = 0;
      let calculatedY = 0;

      switch (slide_params.direction) {
        case 'left': calculatedX = -distance; break;
        case 'right': calculatedX = distance; break;
        case 'up': calculatedY = -distance; break;
        case 'down': calculatedY = distance; break;
      }

      const initialSetProps: any = {};
      let needsInitialSet = false;

      if (movement === 'in') {
        if (slide_params.direction === 'left' || slide_params.direction === 'right') {
          initialSetProps.x = (slide_params.direction === 'left') ? distance : -distance;
          animationProps.x = 0;
        }
        if (slide_params.direction === 'up' || slide_params.direction === 'down') {
          initialSetProps.y = (slide_params.direction === 'up') ? distance : -distance;
          animationProps.y = 0;
        }
        needsInitialSet = true;
      } else if (movement === 'out') {
        if (calculatedX !== 0) animationProps.x = calculatedX;
        if (calculatedY !== 0) animationProps.y = calculatedY;
      } else {
        // Infer behavior from opacity settings
        const isShowingAnimation = slide_params.opacity_start === 0 && slide_params.opacity_end === 1;
        const isHidingAnimation = slide_params.opacity_start === 1 && slide_params.opacity_end === 0;
        
        if (isShowingAnimation) {
          if (slide_params.direction === 'left' || slide_params.direction === 'right') {
            initialSetProps.x = (slide_params.direction === 'left') ? distance : -distance;
            animationProps.x = 0;
          }
          if (slide_params.direction === 'up' || slide_params.direction === 'down') {
            initialSetProps.y = (slide_params.direction === 'up') ? distance : -distance;
            animationProps.y = 0;
          }
          needsInitialSet = true;
        } else if (isHidingAnimation) {
          if (calculatedX !== 0) animationProps.x = calculatedX;
          if (calculatedY !== 0) animationProps.y = calculatedY;
        } else {
          if (calculatedX !== 0) animationProps.x = calculatedX;
          if (calculatedY !== 0) animationProps.y = calculatedY;
        }
      }

      // Handle opacity settings
      if (slide_params.opacity_start !== undefined) {
        initialSetProps.opacity = slide_params.opacity_start;
        needsInitialSet = true;
      }

      if (needsInitialSet && Object.keys(initialSetProps).length > 0) {
        timeline.set(targetElement, initialSetProps);
      }
      
      if (slide_params.opacity_end !== undefined) {
        animationProps.opacity = slide_params.opacity_end;
      } else if (slide_params.opacity_start !== undefined) {
        animationProps.opacity = 1;
      }
    }
    timeline.to(targetElement, animationProps);
  }

  private _buildFadeAnimation(
    config: PureAnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: any
  ): void {
    const { fade_params } = config;
    if (fade_params) {
      if (fade_params.opacity_start !== undefined) {
        const initialFadeProps = { opacity: fade_params.opacity_start };
        timeline.set(targetElement, initialFadeProps);
      }
      animationProps.opacity = fade_params.opacity_end !== undefined ? fade_params.opacity_end : 1;
    }
    timeline.to(targetElement, animationProps);
  }

  private _buildCustomGsapAnimation(
    config: PureAnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: any
  ): void {
    const { custom_gsap_params } = config;
    if (custom_gsap_params) {
      Object.assign(animationProps, custom_gsap_params);
    }
    timeline.to(targetElement, animationProps);
  }

  private _parseDistanceValue(distanceStr: string, element?: Element): number {
    if (!distanceStr) return 0;
    
    if (distanceStr.endsWith('%')) {
      const percentage = parseFloat(distanceStr);
      return percentage; // Return raw percentage for now
    } else if (distanceStr.endsWith('px')) {
      return parseFloat(distanceStr);
    } else {
      return parseFloat(distanceStr) || 0;
    }
  }

  /**
   * Clear minimal caches
   */
  clearCaches(): void {
    // WeakMaps clear themselves when references are removed
    // No manual clearing needed for WeakMaps
  }

  /**
   * Clean up method for compatibility
   */
  cleanup(): void {
    this.clearCaches();
  }

  /**
   * Clear tracked entities for a specific element
   */
  clearTrackedEntitiesForElement(elementId: string): void {
    const state = this.elementAnimationStates.get(elementId);
    if (state && state.lastKnownEntityStates) {
      state.lastKnownEntityStates.clear();
    }
  }

  /**
   * Stop all animations for a specific element
   */
  stopAllAnimationsForElement(elementId: string): void {
    const state = this.elementAnimationStates.get(elementId);
    if (state) {
      // Stop any GSAP animations
      if (this.getShadowElement) {
        const element = this.getShadowElement(elementId);
        if (element) {
          gsap.killTweensOf(element);
        }
      }
      
      // Animation state flags removed - no longer needed
    }
  }

  private getShadowElement?: (id: string) => Element | null;

  /**
   * Extract dynamic color from entity state
   */
  private extractDynamicColorFromEntityState(
    elementId: string,
    dynamicConfig: any,
    hass: HomeAssistant
  ): string | undefined {
    const entity = hass.states[dynamicConfig.entity];
    if (!entity) {
      return dynamicConfig.default || undefined;
    }

    const value = dynamicConfig.attribute 
      ? entity.attributes[dynamicConfig.attribute]
      : entity.state;

    // Track entity for change detection
    const state = this.elementAnimationStates.get(elementId);
    if (state && state.lastKnownEntityStates) {
      state.lastKnownEntityStates.set(dynamicConfig.entity, {
        state: entity.state,
        attributes: { ...entity.attributes }
      });
    }

    if (dynamicConfig.interpolate && typeof value === 'number') {
      return this.interpolateColorFromNumericValue(value, dynamicConfig);
    }

    return dynamicConfig.mapping[value] || dynamicConfig.default;
  }

  /**
   * Interpolate color from numeric value
   */
  private interpolateColorFromNumericValue(
    value: number,
    dynamicConfig: any
  ): string | undefined {
    const numericKeys = Object.keys(dynamicConfig.mapping)
      .map(k => parseFloat(k))
      .filter(k => !isNaN(k))
      .sort((a, b) => a - b);

    if (numericKeys.length === 0) {
      return dynamicConfig.default;
    }

    if (numericKeys.length === 1) {
      return dynamicConfig.mapping[numericKeys[0]];
    }

    // Handle values below/above range
    if (value <= numericKeys[0]) {
      return dynamicConfig.mapping[numericKeys[0]];
    }
    if (value >= numericKeys[numericKeys.length - 1]) {
      return dynamicConfig.mapping[numericKeys[numericKeys.length - 1]];
    }

    // Find interpolation range
    let lowerKey = numericKeys[0];
    let upperKey = numericKeys[numericKeys.length - 1];
    
    for (let i = 0; i < numericKeys.length - 1; i++) {
      if (value >= numericKeys[i] && value <= numericKeys[i + 1]) {
        lowerKey = numericKeys[i];
        upperKey = numericKeys[i + 1];
        break;
      }
    }

    // Interpolate colors
    const lowerColor = this.parseColor(dynamicConfig.mapping[lowerKey]);
    const upperColor = this.parseColor(dynamicConfig.mapping[upperKey]);
    
    if (!lowerColor || !upperColor) {
      return dynamicConfig.default;
    }

    const factor = (value - lowerKey) / (upperKey - lowerKey);
    return this.interpolateColors(lowerColor, upperColor, factor);
  }

  /**
   * Parse color string to RGB values
   */
  private parseColor(colorStr: string): [number, number, number] | null {
    if (!colorStr) return null;
    
    // Handle hex colors
    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      const expanded = hex.length === 3 
        ? hex.split('').map(c => c + c).join('')
        : hex;
      
      if (expanded.length === 6) {
        return [
          parseInt(expanded.slice(0, 2), 16),
          parseInt(expanded.slice(2, 4), 16),
          parseInt(expanded.slice(4, 6), 16)
        ];
      }
    }
    
    // Handle rgb() colors
    const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      ];
    }
    
    // Handle named colors (basic set)
    const namedColors: { [key: string]: [number, number, number] } = {
      'red': [255, 0, 0],
      'green': [0, 255, 0],
      'blue': [0, 0, 255],
      'white': [255, 255, 255],
      'black': [0, 0, 0]
    };
    
    return namedColors[colorStr.toLowerCase()] || null;
  }

  /**
   * Interpolate between two RGB colors
   */
  private interpolateColors(
    color1: [number, number, number],
    color2: [number, number, number],
    factor: number
  ): string {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * factor);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * factor);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * factor);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Collect animation states for restore
   */
  collectAnimationStates(
    elementIds: string[],
    getShadowElement: (id: string) => Element | null
  ): Map<string, any> {
    const states = new Map();
    
    for (const elementId of elementIds) {
      const state = this.elementAnimationStates.get(elementId);
      if (state) {
        const element = getShadowElement(elementId);
        if (element) {
          states.set(elementId, {
            state,
            element
          });
        }
      }
    }
    
    return states;
  }

  /**
   * Restore animation states
   */
  restoreAnimationStates(
    animationStates: Map<string, any>,
    context: AnimationContext,
    onComplete: () => void
  ): void {
    if (animationStates.size === 0) {
      onComplete();
      return;
    }

    let completedCount = 0;
    const totalCount = animationStates.size;

    for (const [elementId, data] of animationStates) {
      const element = context.getShadowElement?.(elementId);
      if (element && data.state.targetFillColor) {
        element.setAttribute('fill', data.state.targetFillColor);
      }
      
      completedCount++;
      if (completedCount === totalCount) {
        onComplete();
      }
    }
  }

  /**
   * Find element with retry logic
   */
  private findElementWithRetryLogic(
    elementId: string,
    getShadowElement: (id: string) => Element | null,
    maxRetries: number = 1
  ): Element | null {
    for (let i = 0; i <= maxRetries; i++) {
      const element = getShadowElement(elementId);
      if (element) {
        return element;
      }
      // In real implementation, would add small delay
    }
    return null;
  }

  // Private helper methods for timeline creation
  
  private _createScaleAnimation(
    timeline: gsap.core.Timeline,
    config: PureAnimationConfig,
    duration: number
  ): gsap.core.Timeline {
    const params = config.scale_params || {};
    const scaleStart = params.scale_start || 1;
    const scaleEnd = params.scale_end || 1;
    const transformOrigin = params.transform_origin || 'center center';

    timeline.to({}, {
      duration: duration / 1000,
      scaleX: scaleEnd,
      scaleY: scaleEnd,
      transformOrigin: transformOrigin
    });

    return timeline;
  }

  private _createSlideAnimation(
    timeline: gsap.core.Timeline,
    config: PureAnimationConfig,
    duration: number
  ): gsap.core.Timeline {
    const params = config.slide_params || {};
    const direction = params.direction || 'up';
    const distance = parseFloat(params.distance || '100');
    
    let x = 0, y = 0;
    switch (direction) {
      case 'up': y = -distance; break;
      case 'down': y = distance; break;
      case 'left': x = -distance; break;
      case 'right': x = distance; break;
    }

    timeline.to({}, {
      duration: duration / 1000,
      x: x,
      y: y,
      opacity: params.opacity_end || 1
    });

    return timeline;
  }

  private _createFadeAnimation(
    timeline: gsap.core.Timeline,
    config: PureAnimationConfig,
    duration: number
  ): gsap.core.Timeline {
    const params = config.fade_params || {};
    const opacityStart = params.opacity_start || 1;
    const opacityEnd = params.opacity_end || 0;

    timeline.to({}, {
      duration: duration / 1000,
      opacity: opacityEnd
    });

    return timeline;
  }

  private _createCustomGsapAnimation(
    timeline: gsap.core.Timeline,
    config: PureAnimationConfig,
    duration: number
  ): gsap.core.Timeline {
    const params = config.custom_gsap_params || {};

    timeline.to({}, {
      duration: duration / 1000,
      ...params
    });

    return timeline;
  }

  private _getAnimationProperties(config: PureAnimationConfig): any {
    switch (config.type) {
      case 'scale':
        const scaleParams = config.scale_params || {};
        return {
          scaleX: scaleParams.scale_end || 1,
          scaleY: scaleParams.scale_end || 1,
          transformOrigin: scaleParams.transform_origin || 'center center'
        };
      case 'slide':
        const slideParams = config.slide_params || {};
        const direction = slideParams.direction || 'up';
        const distance = parseFloat(slideParams.distance || '100');
        
        let x = 0, y = 0;
        switch (direction) {
          case 'up': y = -distance; break;
          case 'down': y = distance; break;
          case 'left': x = -distance; break;
          case 'right': x = distance; break;
        }
        
        return {
          x: x,
          y: y,
          opacity: slideParams.opacity_end || 1
        };
      case 'fade':
        const fadeParams = config.fade_params || {};
        return {
          opacity: fadeParams.opacity_end || 0
        };
      case 'custom_gsap':
        return config.custom_gsap_params || {};
      default:
        return {};
    }
  }

  /**
   * Check if an animation config has positioning effects that would require transform propagation
   */
  doesAnimationEffectPositioning(config: PureAnimationConfig): boolean {
    // Use WeakMap cache for performance
    if (this.positioningEffectsCache.has(config)) {
      return this.positioningEffectsCache.get(config)!;
    }

    let hasPositioningEffects = false;

    switch (config.type) {
      case 'scale':
        // Scale animations affect positioning of anchored elements
        hasPositioningEffects = true;
        break;
      case 'slide':
        // Slide animations change element position
        hasPositioningEffects = true;
        break;
      case 'fade':
        // Fade animations don't affect positioning
        hasPositioningEffects = false;
        break;
      case 'custom_gsap':
        // Custom GSAP could affect positioning - assume yes for safety
        hasPositioningEffects = true;
        break;
      default:
        hasPositioningEffects = false;
    }

    this.positioningEffectsCache.set(config, hasPositioningEffects);
    return hasPositioningEffects;
  }
}

/**
 * Parse distance value for animations
 */
export function parseDistanceValue(
  distance: string,
  element?: { layout: { width: number; height: number } }
): number {
  if (!distance) return 0;
  
  if (distance.endsWith('%')) {
    const percentage = parseFloat(distance);
    if (element) {
      // Use the larger dimension for percentage calculations
      const maxDimension = Math.max(element.layout.width, element.layout.height);
      return (percentage / 100) * maxDimension;
    } else {
      // Fallback: assume 100px as reference for percentage calculations
      return percentage;
    }
  } else if (distance.endsWith('px')) {
    return parseFloat(distance);
  } else {
    // Assume pixels if no unit specified
    return parseFloat(distance) || 0;
  }
}

// Export singleton instance
export const animationManager = new AnimationManager();