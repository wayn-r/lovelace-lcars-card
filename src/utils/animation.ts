import { HomeAssistant } from 'custom-card-helpers';
import gsap from 'gsap';
import { transformPropagator, AnimationSyncData, TransformPropagator } from './transform-propagator.js';
import { TransformOriginUtils } from './transform-origin-utils.js';
import { GSDevTools } from 'gsap/GSDevTools';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { AnimationSequence as AnimationSequenceDefinition } from '../types.js';

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

export interface ReversibleTimeline {
  timeline: gsap.core.Timeline;
  elementId: string;
  animationConfig: AnimationConfig;
  isReversed: boolean;
  transformOrigin?: string;
}

export class AnimationManager {
  private positioningEffectsCache = new WeakMap<AnimationConfig, boolean>();
  private elementAnimationStates = new Map<string, { lastKnownEntityStates: Map<string, any> }>();
  private activeTimelines = new Map<string, ReversibleTimeline[]>();
  private elementsMap?: Map<string, import('../layout/elements/element.js').LayoutElement>;

  private static isGsapInitialized = false;

  static initializeGsap(): void {
    if (!AnimationManager.isGsapInitialized) {
      gsap.registerPlugin(GSDevTools, MotionPathPlugin, CustomEase);
      AnimationManager.isGsapInitialized = true;
    }
  }

  initializeElementAnimationTracking(elementId: string): void {
    if (!this.elementAnimationStates.has(elementId)) {
      this.elementAnimationStates.set(elementId, {
        lastKnownEntityStates: new Map()
      });
    }
    
    if (!this.activeTimelines.has(elementId)) {
      this.activeTimelines.set(elementId, []);
    }
  }

  getElementAnimationState(elementId: string): { lastKnownEntityStates: Map<string, any> } | undefined {
    return this.elementAnimationStates.get(elementId);
  }

  cleanupElementAnimationTracking(elementId: string): void {
    this.elementAnimationStates.delete(elementId);
    
    const timelines = this.activeTimelines.get(elementId);
    if (timelines) {
      for (const reversibleTimeline of timelines) {
        reversibleTimeline.timeline.kill();
      }
    }
    this.activeTimelines.delete(elementId);
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
    
    const timeline = gsap.timeline();
    timeline.to(element, {
      [property]: value,
      duration: duration,
      ease: 'power2.out'
    });
    
    this.storeTimeline(elementId, timeline, {
      type: 'custom_gsap',
      duration,
      custom_gsap_params: { [property]: value }
    } as AnimationConfig);
  }

  createAnimationTimeline(
    elementId: string,
    animationConfig: AnimationConfig,
    targetElement: Element,
    gsapInstance: typeof gsap = gsap,
    initialValues?: { opacity?: number; x?: number; y?: number; }
  ): AnimationTimelineResult {
    const timeline = gsapInstance.timeline({
      onComplete: () => {
        this.removeTimeline(elementId, timeline);
      },
      onReverseComplete: () => {
        this.removeTimeline(elementId, timeline);
      }
    });
    
    const { type, duration = 0.5, ease = 'power2.out', delay, repeat, yoyo } = animationConfig;
    
    const syncData: AnimationSyncData = {
      duration,
      ease,
      delay,
      repeat,
      yoyo
    };

    const animationProps: gsap.TweenVars = {
      duration,
      ease,
    };
    
    if (repeat !== undefined) animationProps.repeat = repeat;
    if (yoyo !== undefined) animationProps.yoyo = yoyo;

    this.captureInitialState(targetElement, timeline, animationConfig);

    switch (type) {
      case 'scale':
        this.buildScaleAnimation(animationConfig, targetElement, timeline, animationProps, elementId);
        break;
      case 'slide':
        this.buildSlideAnimation(animationConfig, targetElement, timeline, animationProps, initialValues);
        break;
      case 'fade':
        this.buildFadeAnimation(animationConfig, targetElement, timeline, animationProps, initialValues);
        break;
      case 'custom_gsap':
        this.buildCustomGsapAnimation(animationConfig, targetElement, timeline, animationProps);
        break;
    }

    return {
      timeline,
      affectsPositioning: this.animationEffectsPositioning(animationConfig),
      syncData
    };
  }

  executeAnimation(
    elementId: string,
    animationConfig: AnimationConfig,
    context: AnimationContext,
    gsapInstance: typeof gsap = gsap,
    initialValues?: { opacity?: number; x?: number; y?: number; }
  ): AnimationTimelineResult | null {
    const targetElement = context.getShadowElement?.(elementId);
    if (!targetElement) {
      console.warn(`[AnimationManager] Animation target element not found: ${elementId}`);
      return null;
    }

    const result = this.createAnimationTimeline(elementId, animationConfig, targetElement, gsapInstance, initialValues);
    
    this.storeTimeline(
      elementId,
      result.timeline,
      animationConfig
    );
    
    if (result.affectsPositioning) {
      transformPropagator.processAnimationWithPropagation(
        elementId,
        animationConfig as any,
        result.syncData
      );
    }

    if (animationConfig.delay) {
      result.timeline.delay(animationConfig.delay);
    }
    
    result.timeline.play();

    return result;
  }

  executeAnimationSequence(
    elementId: string,
    sequenceDef: AnimationSequenceDefinition,
    context: AnimationContext,
    gsapInstance: typeof gsap = gsap
  ): void {
    const sequence = AnimationSequence.createFromDefinition(elementId, sequenceDef, context, this);
    sequence.run();
  }

  stopAllAnimationsForElement(elementId: string): void {
    const timelines = this.activeTimelines.get(elementId);
    if (timelines) {
      for (const reversibleTimeline of timelines) {
        reversibleTimeline.timeline.kill();
      }
      timelines.length = 0;
    }
    gsap.killTweensOf(`[id="${elementId}"]`);
    
    transformPropagator.stopAnimationPropagation(elementId);
  }

  reverseAnimation(elementId: string, animationIndex?: number): boolean {
    const timelines = this.activeTimelines.get(elementId);
    if (!timelines || timelines.length === 0) {
      console.warn(`[AnimationManager] No active animations found for element: ${elementId}`);
      return false;
    }

    let targetTimeline: ReversibleTimeline;
    
    if (animationIndex !== undefined && animationIndex < timelines.length) {
      targetTimeline = timelines[animationIndex];
    } else {
      targetTimeline = timelines[timelines.length - 1];
    }
    
    if (!targetTimeline) {
      console.warn(`[AnimationManager] No timeline found at index ${animationIndex} for element: ${elementId}`);
      return false;
    }

    if (!targetTimeline.isReversed) {
      targetTimeline.timeline.reverse();
      targetTimeline.isReversed = true;
      
      transformPropagator.reverseAnimationPropagation(elementId, targetTimeline.animationConfig as any);
    } else {
      targetTimeline.timeline.play();
      targetTimeline.isReversed = false;
    }
    
    return true;
  }

  reverseAllAnimations(elementId: string): void {
    const timelines = this.activeTimelines.get(elementId);
    if (!timelines || timelines.length === 0) {
      console.warn(`[AnimationManager] No active animations found for element: ${elementId}`);
      return;
    }

    for (const reversibleTimeline of timelines) {
      if (!reversibleTimeline.isReversed) {
        reversibleTimeline.timeline.reverse();
        reversibleTimeline.isReversed = true;
      }
    }
  }

  getActiveTimelines(elementId: string): ReversibleTimeline[] | undefined {
    return this.activeTimelines.get(elementId);
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

  animationEffectsPositioning(config: AnimationConfig): boolean {
    if (this.positioningEffectsCache.has(config)) {
      return this.positioningEffectsCache.get(config)!;
    }

    let affectsPositioning = false;

    switch (config.type) {
      case 'scale':
      case 'slide':
        affectsPositioning = true;
        break;
      case 'fade':
        affectsPositioning = false;
        break;
      case 'custom_gsap':
        affectsPositioning = true;
        break;
      default:
        affectsPositioning = false;
    }

    this.positioningEffectsCache.set(config, affectsPositioning);
    return affectsPositioning;
  }

  setElementsMap(elementsMap: Map<string, import('../layout/elements/element.js').LayoutElement>): void {
    this.elementsMap = elementsMap;
  }

  private storeTimeline(
    elementId: string,
    timeline: gsap.core.Timeline,
    animationConfig: AnimationConfig
  ): void {
    this.initializeElementAnimationTracking(elementId);
    
    const timelines = this.activeTimelines.get(elementId)!;
    
    let transformOrigin: string | undefined;
    if (animationConfig.type === 'scale' && animationConfig.scale_params) {
      transformOrigin = animationConfig.scale_params.transform_origin || this.getOptimalTransformOrigin(elementId);
    }
    
    const reversibleTimeline: ReversibleTimeline = {
      timeline,
      elementId,
      animationConfig,
      isReversed: false,
      transformOrigin
    };
    
    timelines.push(reversibleTimeline);
  }

  private removeTimeline(elementId: string, timeline: gsap.core.Timeline): void {
    const timelines = this.activeTimelines.get(elementId);
    if (timelines) {
      const index = timelines.findIndex(rt => rt.timeline === timeline);
      if (index !== -1) {
        timelines.splice(index, 1);
      }
    }
  }

  private captureInitialState(
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationConfig: AnimationConfig
  ): void {
    const initialProps: gsap.TweenVars = {};

    if (animationConfig.type === 'slide' && animationConfig.slide_params) {
      const slideParams = animationConfig.slide_params;
      const distance = DistanceParser.parse(slideParams.distance || '0', targetElement);

      if (slideParams.movement === 'in') {
        if (slideParams.direction === 'left') initialProps.x = distance;
        else if (slideParams.direction === 'right') initialProps.x = -distance;
        else if (slideParams.direction === 'up') initialProps.y = distance;
        else if (slideParams.direction === 'down') initialProps.y = -distance;
      }
    }

    timeline.set(targetElement, Object.keys(initialProps).length > 0 ? initialProps : {}, 0);
  }

  private buildScaleAnimation(
    config: AnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: gsap.TweenVars,
    elementId: string
  ): void {
    const { scale_params } = config;
    if (scale_params) {
      let transformOrigin = scale_params.transform_origin;
      
      if (!transformOrigin) {
        transformOrigin = this.getOptimalTransformOrigin(elementId);
      }
      
      if (scale_params.scale_start !== undefined) {
        const initialScaleProps: gsap.TweenVars = {
          scale: scale_params.scale_start,
          transformOrigin: transformOrigin
        };
        timeline.set(targetElement, initialScaleProps);
      }
      animationProps.scale = scale_params.scale_end !== undefined ? scale_params.scale_end : 1;
      animationProps.transformOrigin = transformOrigin;
    }
    timeline.to(targetElement, animationProps);
  }

  private getOptimalTransformOrigin(elementId: string): string {
    const element = this.elementsMap?.get(elementId);
    if (!element?.layoutConfig?.anchor) {
      return 'center center';
    }

    const anchorConfig = element.layoutConfig.anchor;
    
    if (anchorConfig.anchorTo && anchorConfig.anchorTo !== 'container') {
      const anchorPoint = anchorConfig.anchorPoint || 'topLeft';
      return TransformOriginUtils.anchorPointToTransformOriginString(anchorPoint);
    }

    return 'center center';
  }

  private buildSlideAnimation(
    config: AnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: gsap.TweenVars,
    initialValues?: { opacity?: number; x?: number; y?: number; }
  ): void {
    const { slide_params } = config;
    if (!slide_params) {
      timeline.add(gsap.to(targetElement, animationProps));
      return;
    }

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

    const initialTweenVars: gsap.TweenVars = {};
    const finalTweenVars: gsap.TweenVars = { ...animationProps };

    let useFromTo = false;

    const startX = initialValues?.x !== undefined ? initialValues.x : 
      ((movement === 'in' && (slide_params.direction === 'left' || slide_params.direction === 'right')) ? 
        ((slide_params.direction === 'left') ? distance : -distance) : undefined);
    const startY = initialValues?.y !== undefined ? initialValues.y : 
      ((movement === 'in' && (slide_params.direction === 'up' || slide_params.direction === 'down')) ? 
        ((slide_params.direction === 'up') ? distance : -distance) : undefined);

    if (startX !== undefined) {
      initialTweenVars.x = startX;
      finalTweenVars.x = 0;
      useFromTo = true;
    }
    if (startY !== undefined) {
      initialTweenVars.y = startY;
      finalTweenVars.y = 0;
      useFromTo = true;
    }

    if (!useFromTo && (movement === 'out' || movement === undefined)) {
      if (calculatedX !== 0) finalTweenVars.x = calculatedX;
      if (calculatedY !== 0) finalTweenVars.y = calculatedY;
    }

    const startOpacity = initialValues?.opacity !== undefined ? initialValues.opacity : slide_params.opacity_start;

    if (startOpacity !== undefined) {
      initialTweenVars.opacity = startOpacity;
      useFromTo = true;
    }
    if (slide_params.opacity_end !== undefined) {
      finalTweenVars.opacity = slide_params.opacity_end;
    } else if (slide_params.opacity_start !== undefined) {
      finalTweenVars.opacity = 1;
    }

    timeline.add(useFromTo ? 
      gsap.fromTo(targetElement, initialTweenVars, finalTweenVars) :
      gsap.to(targetElement, finalTweenVars)
    );
  }

  private buildFadeAnimation(
    config: AnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: gsap.TweenVars,
    initialValues?: { opacity?: number; x?: number; y?: number; }
  ): void {
    const { fade_params } = config;
    if (!fade_params || fade_params.opacity_start === undefined) {
      timeline.add(gsap.to(targetElement, animationProps));
      return;
    }

    const startOpacity = initialValues?.opacity !== undefined ? initialValues.opacity : fade_params.opacity_start;

    if (startOpacity !== undefined) {
      const initialFadeProps: gsap.TweenVars = { opacity: startOpacity };
      timeline.add(gsap.fromTo(targetElement, initialFadeProps, { 
        opacity: fade_params.opacity_end !== undefined ? fade_params.opacity_end : 1, 
        ...animationProps 
      }));
    } else {
      animationProps.opacity = fade_params.opacity_end !== undefined ? fade_params.opacity_end : 1;
      timeline.add(gsap.to(targetElement, animationProps));
    }
  }

  private buildCustomGsapAnimation(
    config: AnimationConfig,
    targetElement: Element,
    timeline: gsap.core.Timeline,
    animationProps: gsap.TweenVars
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
    
    const affectsPositioning = this.animations.some(({ anim }) => 
      this.manager.animationEffectsPositioning(anim.config)
    );

    if (affectsPositioning) {
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
        if (!this.manager.animationEffectsPositioning(anim.config)) {
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
    sequenceDef: AnimationSequenceDefinition,
    context: AnimationContext,
    manager: AnimationManager
  ): AnimationSequence {
    const sequence = new AnimationSequence(elementId, context, manager);

    if (!sequenceDef?.steps) return sequence;

    sequenceDef.steps.forEach((step) => {
      if (!step) return;
      const idx: number = step.index;
      step.animations.forEach((animCfg) => {
        const pure: AnimationConfig = { ...animCfg } as AnimationConfig;
        sequence.add(new Animation(elementId, pure, manager), idx);
      });
    });

    return sequence;
  }
}