import { HomeAssistant } from 'custom-card-helpers';
import { gsap } from 'gsap';
import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';
import { Color } from './color.js';
import { transformPropagator, AnimationSyncData } from './transform-propagator.js';

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
    direction: 'left' | 'right' | 'up' | 'down';
    distance: string;
    movement?: 'in' | 'out';
    opacity_start?: number;
    opacity_end?: number;
  };
  fade_params?: {
    opacity_start?: number;
    opacity_end?: number;
  };
  custom_gsap_vars?: Record<string, any>;
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
 * Purified Animation manager responsible for creating pure, idempotent animation timelines
 * Color transitions are handled by ColorResolver, not here
 */
export class AnimationManager {
  // Minimal caching using WeakMaps for performance only
  private positioningEffectsCache = new WeakMap<PureAnimationConfig, boolean>();

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
        const customVars = animation.custom_gsap_vars || {};
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
      const distance = this._parseDistanceValue(slide_params.distance, targetElement);
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
    const { custom_gsap_vars } = config;
    if (custom_gsap_vars) {
      Object.assign(animationProps, custom_gsap_vars);
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
}

// Global animation manager instance for convenient access across the application
export const animationManager = new AnimationManager();