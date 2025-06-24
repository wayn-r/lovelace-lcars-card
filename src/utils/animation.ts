import { HomeAssistant } from 'custom-card-helpers';
import gsap from 'gsap';
import { transformPropagator, AnimationSyncData } from './transform-propagator.js';

export interface AnimationContext {
  elementId: string;
  getShadowElement?: (id: string) => Element | null;
  hass?: HomeAssistant;
  requestUpdateCallback?: () => void;
}

export interface AnimationConfig {
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

export interface AnimationTimelineResult {
  timeline: gsap.core.Timeline;
  affectsPositioning: boolean;
  syncData: AnimationSyncData;
}

export class AnimationManager {
  private positioningEffectsCache = new WeakMap<AnimationConfig, boolean>();
  private elementAnimationStates = new Map<string, { lastKnownEntityStates: Map<string, any> }>();

  initializeElementAnimationTracking(elementId: string): void {
    if (!this.elementAnimationStates.has(elementId)) {
      this.elementAnimationStates.set(elementId, {
        lastKnownEntityStates: new Map()
      });
    }
  }

  getElementAnimationState(elementId: string): { lastKnownEntityStates: Map<string, any> } | undefined {
    return this.elementAnimationStates.get(elementId);
  }

  cleanupElementAnimationTracking(elementId: string): void {
    this.elementAnimationStates.delete(elementId);
  }

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

  createAnimationTimeline(
    elementId: string,
    animationConfig: AnimationConfig,
    targetElement: Element,
    gsapInstance: typeof gsap = gsap
  ): AnimationTimelineResult {
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

    switch (type) {
      case 'scale':
        this.buildScaleAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'slide':
        this.buildSlideAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'fade':
        this.buildFadeAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
      case 'custom_gsap':
        this.buildCustomGsapAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
    }

    return {
      timeline,
      affectsPositioning: this.hasPositioningEffects(animationConfig),
      syncData
    };
  }

  executeAnimation(
    elementId: string,
    animationConfig: AnimationConfig,
    context: AnimationContext,
    gsapInstance: typeof gsap = gsap
  ): AnimationTimelineResult | null {
    const targetElement = context.getShadowElement?.(elementId);
    if (!targetElement) {
      console.warn(`[AnimationManager] Animation target element not found: ${elementId}`);
      return null;
    }

    const result = this.createAnimationTimeline(elementId, animationConfig, targetElement, gsapInstance);
    
    if (result.affectsPositioning) {
      transformPropagator.processAnimationWithPropagation(
        elementId,
        animationConfig as any,
        result.syncData
      );
    }

    return result;
  }

  executeAnimationSequence(
    elementId: string,
    sequenceDef: any,
    context: AnimationContext,
    gsapInstance: typeof gsap = gsap
  ): void {
    const sequence = AnimationSequence.createFromDefinition(elementId, sequenceDef, context, this);
    sequence.run();
  }

  stopAllAnimationsForElement(elementId: string): void {
    gsap.killTweensOf(`[id="${elementId}"]`);
  }

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

  hasPositioningEffects(config: AnimationConfig): boolean {
    if (this.positioningEffectsCache.has(config)) {
      return this.positioningEffectsCache.get(config)!;
    }

    let hasPositioningEffects = false;

    switch (config.type) {
      case 'scale':
      case 'slide':
        hasPositioningEffects = true;
        break;
      case 'fade':
        hasPositioningEffects = false;
        break;
      case 'custom_gsap':
        hasPositioningEffects = true;
        break;
      default:
        hasPositioningEffects = false;
    }

    this.positioningEffectsCache.set(config, hasPositioningEffects);
    return hasPositioningEffects;
  }

  private buildScaleAnimation(
    config: AnimationConfig,
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

  private buildSlideAnimation(
    config: AnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: any
  ): void {
    const { slide_params } = config;
    if (slide_params) {
      const distance = DistanceParser.parse(slide_params.distance || '0', targetElement);
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

  private buildFadeAnimation(
    config: AnimationConfig,
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

  private buildCustomGsapAnimation(
    config: AnimationConfig,
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
}

export class DistanceParser {
  static parse(
    distance: string,
    context?: Element | { layout: { width: number; height: number } }
  ): number {
    if (!distance) return 0;
    
    const numericValue = parseFloat(distance);
    
    if (distance.endsWith('%')) {
      if (context && 'layout' in context) {
        const maxDimension = Math.max(context.layout.width, context.layout.height);
        return (numericValue / 100) * maxDimension;
      } else {
        return numericValue;
      }
    } else if (distance.endsWith('px')) {
      return numericValue;
    } else {
      return numericValue || 0;
    }
  }
}

export const animationManager = new AnimationManager();

export class Animation {
  readonly elementId: string;
  readonly config: AnimationConfig;
  private readonly manager: AnimationManager;

  constructor(elementId: string, config: AnimationConfig, manager: AnimationManager) {
    this.elementId = elementId;
    this.config = { ...config };
    this.manager = manager;
  }

  execute(
    context: AnimationContext,
    extraDelay: number = 0,
    gsapInstance: typeof gsap = gsap
  ): AnimationTimelineResult | null {
    const cfg: AnimationConfig = { ...this.config };
    if (extraDelay) {
      cfg.delay = (cfg.delay ?? 0) + extraDelay;
    }
    return this.manager.executeAnimation(this.elementId, cfg, context, gsapInstance);
  }

  getRuntime(): number {
    const duration = this.config.duration ?? 500;
    const repeat = typeof this.config.repeat === 'number' && this.config.repeat > 0 ? this.config.repeat : 0;
    const delay = this.config.delay ?? 0;
    return delay + duration * (repeat + 1);
  }
}

export class AnimationSequence {
  private readonly elementId: string;
  private readonly animations: Array<{ anim: Animation; groupIndex: number }> = [];
  private readonly context: AnimationContext;
  private readonly manager: AnimationManager;

  constructor(
    elementId: string,
    context: AnimationContext,
    manager: AnimationManager
  ) {
    this.elementId = elementId;
    this.context = context;
    this.manager = manager;
  }

  add(animation: Animation, groupIndex: number = 0): this {
    this.animations.push({ anim: animation, groupIndex });
    return this;
  }

  run(): void {
    const grouped = new Map<number, Animation[]>();
    for (const { anim, groupIndex } of this.animations) {
      if (!grouped.has(groupIndex)) grouped.set(groupIndex, []);
      grouped.get(groupIndex)!.push(anim);
    }

    const sortedIndices = Array.from(grouped.keys()).sort((a, b) => a - b);
    
    const hasPositioningEffects = this.animations.some(({ anim }) => 
      this.manager.hasPositioningEffects(anim.config)
    );

    if (hasPositioningEffects) {
      this.runWithTransformPropagation(grouped, sortedIndices);
    } else {
      this.runSimpleSequence(grouped, sortedIndices);
    }
  }

  private runWithTransformPropagation(
    grouped: Map<number, Animation[]>,
    sortedIndices: number[]
  ): void {
    const sequenceDefinition = {
      steps: sortedIndices.map(idx => ({
        index: idx,
        animations: grouped.get(idx)!.map(anim => anim.config)
      }))
    };

    const firstAnimation = grouped.get(sortedIndices[0])![0];
    const baseSyncData = {
      duration: firstAnimation.config.duration || 500,
      ease: firstAnimation.config.ease || 'power2.out',
      delay: firstAnimation.config.delay
    };

    import('./transform-propagator.js').then(({ transformPropagator }) => {
      transformPropagator.processAnimationSequenceWithPropagation(
        this.elementId,
        sequenceDefinition,
        baseSyncData
      );
    });

    let cumulativeDelay = 0;

    for (const idx of sortedIndices) {
      const group = grouped.get(idx)!;

      let maxRuntimeInGroup = 0;

      for (const anim of group) {
        if (!this.manager.hasPositioningEffects(anim.config)) {
          anim.execute(this.context, cumulativeDelay);
        }

        const runtime = anim.getRuntime();
        if (runtime > maxRuntimeInGroup) maxRuntimeInGroup = runtime;
      }

      cumulativeDelay += maxRuntimeInGroup;
    }
  }

  private runSimpleSequence(
    grouped: Map<number, Animation[]>,
    sortedIndices: number[]
  ): void {
    let cumulativeDelay = 0;

    for (const idx of sortedIndices) {
      const group = grouped.get(idx)!;
      let maxRuntimeInGroup = 0;

      for (const anim of group) {
        anim.execute(this.context, cumulativeDelay);
        const runtime = anim.getRuntime();
        if (runtime > maxRuntimeInGroup) maxRuntimeInGroup = runtime;
      }

      cumulativeDelay += maxRuntimeInGroup;
    }
  }

  static createFromDefinition(
    elementId: string,
    sequenceDef: any,
    context: AnimationContext,
    manager: AnimationManager
  ): AnimationSequence {
    const sequence = new AnimationSequence(elementId, context, manager);

    if (!sequenceDef || !Array.isArray(sequenceDef.steps)) return sequence;

    sequenceDef.steps.forEach((step: any) => {
      if (!step) return;
      const idx: number = Number(step.index) || 0;
      const animations = Array.isArray(step.animations) ? step.animations : [];
      animations.forEach((animCfg: any) => {
        const pure: AnimationConfig = { ...animCfg } as AnimationConfig;
        sequence.add(new Animation(elementId, pure, manager), idx);
      });
    });

    return sequence;
  }
}