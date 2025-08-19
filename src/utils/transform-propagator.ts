import { LayoutElement } from '../layout/elements/element.js';
import { AnimationDefinition } from '../types.js';
import { ReactiveStore, StateChangeEvent, StoreProvider } from '../core/store.js';
import gsap from 'gsap';
import { DistanceParser } from './animation.js';
import { TransformOriginUtils, AnchorPointUtils } from './transform-origin-utils.js';

export interface TransformEffect {
  initialOffsetX?: number;
  initialOffsetY?: number;
  type: 'scale' | 'translate' | 'rotate' | 'fade';
  scaleStartX?: number;
  scaleStartY?: number;
  scaleTargetX?: number;
  scaleTargetY?: number;
  translateX?: number;
  translateY?: number;
  rotation?: number;
  transformOrigin: { x: number; y: number };
  opacity_start?: number;
  opacity_end?: number;
}

export interface ElementDependency {
  dependentElementId: string;
  targetElementId: string;
  anchorPoint: string;
  targetAnchorPoint: string;
  dependencyType: 'anchor' | 'stretch';
}

export interface AnimationSyncData {
  duration: number;
  ease: string;
  delay?: number;
  repeat?: number;
  yoyo?: boolean;
}

interface ElementTransformState {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

interface PropagationTimeline {
  timeline: gsap.core.Timeline;
  elementId: string;
  transformEffect: TransformEffect;
  isReversed: boolean;
}

export class TransformPropagator {
  private elementDependencies = new Map<string, ElementDependency[]>();
  private elementsMap?: Map<string, LayoutElement>;
  private getShadowElement?: (id: string) => Element | null;
  private elementTransformStates = new Map<string, ElementTransformState>();
  private storeUnsubscribe?: () => void;
  private activePropagationTimelines = new Map<string, PropagationTimeline[]>();
  private store?: ReactiveStore;

  setStore(store: ReactiveStore): void {
    this.store = store;
  }

  initialize(
    elementsMap: Map<string, LayoutElement>,
    getShadowElement?: (id: string) => Element | null
  ): void {
    this.elementsMap = elementsMap;
    this.getShadowElement = getShadowElement;
    this.buildDependencyGraph();
    this.initializeTransformStates();
    this.subscribeToStore();
  }

  private subscribeToStore(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
    }

    const store = this.store ?? StoreProvider.getStore();
    this.storeUnsubscribe = store.onStateChange((event: StateChangeEvent) => {
      this.handleStateChange(event);
    });
  }

  private handleStateChange(event: StateChangeEvent): void {
    if (this.elementsMap) {
      this.buildDependencyGraph();
    }
  }

  private initializeTransformStates(): void {
    if (!this.elementsMap) return;
    
    for (const elementId of this.elementsMap.keys()) {
      this.elementTransformStates.set(elementId, {
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0
      });
    }
  }

  private updateElementTransformState(elementId: string, transformEffect: TransformEffect): void {
    const currentState = this.elementTransformStates.get(elementId) || {
      scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotation: 0
    };

    const newState = { ...currentState };

    switch (transformEffect.type) {
      case 'scale':
        newState.scaleX = transformEffect.scaleTargetX || 1;
        newState.scaleY = transformEffect.scaleTargetY || 1;
        break;
      case 'translate':
        newState.translateX += transformEffect.translateX || 0;
        newState.translateY += transformEffect.translateY || 0;
        break;
      case 'rotate':
        newState.rotation = transformEffect.rotation || 0;
        break;
    }

    this.elementTransformStates.set(elementId, newState);
  }

  processAnimationWithPropagation(
    primaryElementId: string,
    animationConfig: AnimationDefinition,
    syncData: AnimationSyncData
  ): void {
    if (!this.elementsMap || !this.getShadowElement) {
      console.warn('[TransformPropagator] Not initialized, cannot process animation');
      return;
    }

    const transformEffects = this.analyzeTransformEffects(primaryElementId, animationConfig);
    
    if (transformEffects.length === 0) {
      return;
    }

    const selfCompensationEffect = this.applySelfCompensation(primaryElementId, transformEffects, syncData);

    for (const effect of transformEffects) {
      this.updateElementTransformState(primaryElementId, effect);
    }

    this.applyCompensatingTransforms(
      primaryElementId,
      transformEffects,
      selfCompensationEffect,
      syncData
    );
  }

  processAnimationSequenceWithPropagation(
    primaryElementId: string,
    animationSequence: any,
    baseSyncData: AnimationSyncData
  ): void {
    if (!this.elementsMap || !this.getShadowElement) {
      console.warn('[TransformPropagator] Not initialized, cannot process animation sequence');
      return;
    }

    if (!animationSequence.steps || !Array.isArray(animationSequence.steps) || animationSequence.steps.length === 0) {
      console.warn('[TransformPropagator] Invalid or empty animation sequence: missing or empty steps array');
      return;
    }

    const sortedStepGroups = [...animationSequence.steps].sort((a, b) => (a.index || 0) - (b.index || 0));
    const affectedElements = this.findDependentElements(primaryElementId);

    let sequenceOverallInitialX = 0;
    let sequenceOverallInitialY = 0;
    
    for (const stepGroup of sortedStepGroups) {
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        for (const animation of stepGroup.animations) {
          const tempStepEffects = this.analyzeTransformEffects(primaryElementId, animation);
          for (const effect of tempStepEffects) {
            if (effect.type === 'translate' && (effect.initialOffsetX !== undefined || effect.initialOffsetY !== undefined)) {
              sequenceOverallInitialX += effect.initialOffsetX || 0;
              sequenceOverallInitialY += effect.initialOffsetY || 0;
            }
          }
        }
      }
    }

    if (sequenceOverallInitialX !== 0 || sequenceOverallInitialY !== 0) {
      this.applyInitialSequencePositioning(
        primaryElementId, 
        sequenceOverallInitialX, 
        sequenceOverallInitialY, 
        affectedElements
      );
    }

    let cumulativeDelay = baseSyncData.delay || 0;
    let currentVisualX = sequenceOverallInitialX;
    let currentVisualY = sequenceOverallInitialY;

    for (const stepGroup of sortedStepGroups) {
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        let maxGroupDuration = 0;

        for (const animation of stepGroup.animations) {
          const animationDuration = (animation.duration || 0) + (animation.delay || 0);
          maxGroupDuration = Math.max(maxGroupDuration, animationDuration);
        }

        for (const animation of stepGroup.animations) {
          const animationSyncData: AnimationSyncData = {
            duration: animation.duration || baseSyncData.duration,
            ease: animation.ease || baseSyncData.ease,
            delay: cumulativeDelay + (animation.delay || 0),
            repeat: animation.repeat,
            yoyo: animation.yoyo
          };

          const animationBaseEffects = this.analyzeTransformEffects(primaryElementId, animation);
          
          if (animationBaseEffects.length > 0) {
            const effectsForAnimationAndPropagation: TransformEffect[] = [];

            for (const baseEffect of animationBaseEffects) {
              const actualAnimationEffect = { ...baseEffect };

              if (actualAnimationEffect.type === 'translate') {
                actualAnimationEffect.initialOffsetX = currentVisualX;
                actualAnimationEffect.initialOffsetY = currentVisualY;
                
                currentVisualX += baseEffect.translateX || 0;
                currentVisualY += baseEffect.translateY || 0;
              }
              effectsForAnimationAndPropagation.push(actualAnimationEffect);
            }

            for (const effectToApply of effectsForAnimationAndPropagation) {
              this.applyTransform(primaryElementId, effectToApply, animationSyncData);
            }

            const animationSelfCompensation = this.applySelfCompensation(primaryElementId, effectsForAnimationAndPropagation, animationSyncData);

            if (affectedElements.length > 0) {
              this.applyCompensatingTransforms(
                primaryElementId,
                effectsForAnimationAndPropagation, 
                animationSelfCompensation,
                animationSyncData
              );
            }

            for (const baseEffect of animationBaseEffects) {
              this.updateElementTransformState(primaryElementId, baseEffect);
            }
          }
        }

        cumulativeDelay += maxGroupDuration;
      }
    }

    console.log(`[TransformPropagator] Processed animation sequence for ${primaryElementId} with ${sortedStepGroups.length} step groups. Initial offset: (${sequenceOverallInitialX}, ${sequenceOverallInitialY}). Final visual endpoint: (${currentVisualX}, ${currentVisualY}). Affected dependents: ${affectedElements.length}`);
  }

  private applyInitialSequencePositioning(
    primaryElementId: string,
    initialX: number,
    initialY: number,
    affectedElements: ElementDependency[]
  ): void {
    if (!this.getShadowElement) return;

    const primaryElement = this.getShadowElement(primaryElementId);
    if (primaryElement) {
      gsap.set(primaryElement, {
        x: initialX,
        y: initialY
      });
    }

    for (const dependency of affectedElements) {
      const dependentElement = this.getShadowElement(dependency.dependentElementId);
      if (dependentElement) {
        gsap.set(dependentElement, {
          x: initialX,
          y: initialY
        });
      }
    }
  }

  private buildDependencyGraph(): void {
    if (!this.elementsMap) return;

    this.elementDependencies.clear();

    for (const [elementId, element] of this.elementsMap) {
      const dependencies = this.extractElementDependencies(elementId, element);
      if (dependencies.length > 0) {
        this.elementDependencies.set(elementId, dependencies);
      }
    }
  }

  private extractElementDependencies(
    elementId: string,
    element: LayoutElement
  ): ElementDependency[] {
    const dependencies: ElementDependency[] = [];

    const anchorConfig = element.layoutConfig.anchor;
    if (anchorConfig?.anchorTo && anchorConfig.anchorTo !== 'container') {
      dependencies.push({
        dependentElementId: elementId,
        targetElementId: anchorConfig.anchorTo,
        anchorPoint: anchorConfig.anchorPoint || 'topLeft',
        targetAnchorPoint: anchorConfig.targetAnchorPoint || 'topLeft',
        dependencyType: 'anchor'
      });
    }

    const stretchConfig = element.layoutConfig.stretch;
    if (stretchConfig?.stretchTo1 && 
        stretchConfig.stretchTo1 !== 'container' && 
        stretchConfig.stretchTo1 !== 'canvas') {
      dependencies.push({
        dependentElementId: elementId,
        targetElementId: stretchConfig.stretchTo1,
        anchorPoint: 'unknown',
        targetAnchorPoint: stretchConfig.targetStretchAnchorPoint1 || 'topLeft',
        dependencyType: 'stretch'
      });
    }

    if (stretchConfig?.stretchTo2 && 
        stretchConfig.stretchTo2 !== 'container' && 
        stretchConfig.stretchTo2 !== 'canvas') {
      dependencies.push({
        dependentElementId: elementId,
        targetElementId: stretchConfig.stretchTo2,
        anchorPoint: 'unknown',
        targetAnchorPoint: stretchConfig.targetStretchAnchorPoint2 || 'topLeft',
        dependencyType: 'stretch'
      });
    }

    return dependencies;
  }

  private analyzeTransformEffects(
    elementId: string,
    animationConfig: AnimationDefinition
  ): TransformEffect[] {
    const effects: TransformEffect[] = [];
    const element = this.elementsMap?.get(elementId);
    
    if (!element) return effects;

    switch (animationConfig.type) {
      case 'scale':
        effects.push(this.analyzeScaleEffect(element, animationConfig));
        break;
      case 'slide':
        effects.push(this.analyzeSlideEffect(element, animationConfig));
        break;
      case 'custom_gsap':
        effects.push(...this.analyzeCustomGsapEffects(element, animationConfig));
        break;
      case 'fade':
        effects.push(this.analyzeFadeEffect(element, animationConfig));
        break;
      case 'color':
        // Color animations don't affect positioning or transforms
        break;
    }

    return effects.filter(effect => this.isEffectSignificant(effect, elementId));
  }

  private analyzeScaleEffect(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect {
    const scaleParams = animationConfig.scale_params;
    const scaleStart = scaleParams?.scale_start;
    const scaleEnd = scaleParams?.scale_end || 1;
    
    let transformOriginString = scaleParams?.transform_origin;
    
    if (!transformOriginString && element.layoutConfig.anchor?.anchorTo && element.layoutConfig.anchor.anchorTo !== 'container') {
      const anchorPoint = element.layoutConfig.anchor.anchorPoint || 'topLeft';
      transformOriginString = TransformOriginUtils.anchorPointToTransformOriginString(anchorPoint);
    }
    
    const transformOrigin = TransformOriginUtils.parseTransformOrigin(
      transformOriginString || 'center center',
      element
    );

    return {
      type: 'scale',
      scaleStartX: scaleStart,
      scaleStartY: scaleStart,
      scaleTargetX: scaleEnd,
      scaleTargetY: scaleEnd,
      transformOrigin
    };
  }

  private analyzeSlideEffect(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect {
    const slideParams = animationConfig.slide_params;
    const direction = slideParams?.direction;
    const distance = DistanceParser.parse(slideParams?.distance || '0px', element);
    const movement = slideParams?.movement;

    let translateX = 0;
    let translateY = 0;

    let baseTranslateX = 0;
    let baseTranslateY = 0;

    switch (direction) {
      case 'left':
        baseTranslateX = -distance;
        break;
      case 'right':
        baseTranslateX = distance;
        break;
      case 'up':
        baseTranslateY = -distance;
        break;
      case 'down':
        baseTranslateY = distance;
        break;
    }

    let initialOffsetX = 0;
    let initialOffsetY = 0;

    if (movement === 'in') {
      initialOffsetX = -baseTranslateX;
      initialOffsetY = -baseTranslateY;
      translateX = baseTranslateX;
      translateY = baseTranslateY;
    } else {
      translateX = baseTranslateX;
      translateY = baseTranslateY;
    }

    return {
      type: 'translate',
      translateX,
      translateY,
      initialOffsetX: initialOffsetX !== 0 ? initialOffsetX : undefined,
      initialOffsetY: initialOffsetY !== 0 ? initialOffsetY : undefined,
      transformOrigin: { x: 0, y: 0 }
    };
  }

  private analyzeCustomGsapEffects(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect[] {
    const effects: TransformEffect[] = [];
    const customVars = animationConfig.custom_gsap_vars || {};

    if (customVars.scale !== undefined) {
      effects.push({
        type: 'scale',
        scaleTargetX: customVars.scale,
        scaleTargetY: customVars.scale,
        transformOrigin: TransformOriginUtils.parseTransformOrigin(
          customVars.transformOrigin || 'center center',
          element
        )
      });
    }

    if (customVars.x !== undefined || customVars.y !== undefined) {
      effects.push({
        type: 'translate',
        translateX: customVars.x || 0,
        translateY: customVars.y || 0,
        transformOrigin: { x: 0, y: 0 }
      });
    }

    if (customVars.rotation !== undefined) {
      effects.push({
        type: 'rotate',
        rotation: customVars.rotation,
        transformOrigin: TransformOriginUtils.parseTransformOrigin(
          customVars.transformOrigin || 'center center',
          element
        )
      });
    }

    return effects;
  }

  private analyzeFadeEffect(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect {
    const fadeParams = animationConfig.fade_params;
    const opacityStart = fadeParams?.opacity_start;
    const opacityEnd = fadeParams?.opacity_end;

    return {
      type: 'fade',
      opacity_start: opacityStart,
      opacity_end: opacityEnd,
      transformOrigin: { x: 0, y: 0 }
    };
  }

  private applySelfCompensation(
    elementId: string,
    transformEffects: TransformEffect[],
    syncData: AnimationSyncData
  ): TransformEffect | null {
    const element = this.elementsMap?.get(elementId);
    if (!element) return null;

    const anchorConfig = element.layoutConfig.anchor;
    if (!anchorConfig?.anchorTo || anchorConfig.anchorTo === 'container') {
      return null;
    }

    const geometricEffects = transformEffects.filter(effect => effect.type !== 'translate');
    
    if (geometricEffects.length === 0) {
      return null;
    }

    const ownAnchorPoint = anchorConfig.anchorPoint || 'topLeft';
    const anchorDisplacement = this.calculateAnchorDisplacement(
      element,
      ownAnchorPoint,
      geometricEffects
    );

    if (anchorDisplacement.x === 0 && anchorDisplacement.y === 0) {
      return null;
    }

    const compensatingTransform: TransformEffect = {
      type: 'translate',
      translateX: Math.round(-anchorDisplacement.x * 1000) / 1000,
      translateY: Math.round(-anchorDisplacement.y * 1000) / 1000,
      transformOrigin: { x: 0, y: 0 }
    };

    this.applyTransform(elementId, compensatingTransform, syncData);
    return compensatingTransform;
  }

  private findDependentElements(targetElementId: string): ElementDependency[] {
    const dependents: ElementDependency[] = [];

    for (const [elementId, dependencies] of this.elementDependencies) {
      for (const dependency of dependencies) {
        if (dependency.targetElementId === targetElementId) {
          dependents.push(dependency);
        }
      }
    }

    return dependents;
  }

  private applyCompensatingTransforms(
    primaryElementId: string,
    primaryTransformEffects: TransformEffect[], 
    primarySelfCompensation: TransformEffect | null,
    syncData: AnimationSyncData
  ): void {
    const primaryElement = this.elementsMap?.get(primaryElementId);
    if (!primaryElement) return;

    const directDependentsOfPrimary = this.findDependentElements(primaryElementId);

    for (const dependency of directDependentsOfPrimary) {
      const dependentElement = this.elementsMap?.get(dependency.dependentElementId);
      if (!dependentElement) continue;

      const displacementFromPrimaryEffects = this.calculateAnchorDisplacement(
        primaryElement,
        dependency.targetAnchorPoint,
        primaryTransformEffects 
      );

      let totalCompensationX = displacementFromPrimaryEffects.x;
      let totalCompensationY = displacementFromPrimaryEffects.y;

      if (primarySelfCompensation && primarySelfCompensation.type === 'translate') {
        totalCompensationX += primarySelfCompensation.translateX || 0;
        totalCompensationY += primarySelfCompensation.translateY || 0;
      }
      
      const firstPrimaryEffect = primaryTransformEffects[0];
      
      if (totalCompensationX === 0 && totalCompensationY === 0) {
        if (firstPrimaryEffect?.initialOffsetX !== undefined || firstPrimaryEffect?.initialOffsetY !== undefined) {
          const zeroMoveEffectWithInitialOffset: TransformEffect = {
            type: 'translate',
            translateX: 0,
            translateY: 0,
            initialOffsetX: firstPrimaryEffect.initialOffsetX,
            initialOffsetY: firstPrimaryEffect.initialOffsetY,
            transformOrigin: { x: 0, y: 0 }
          };
          this.applyTransform(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData
          );
          this.propagateTransformsRecursively(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData,
            new Set([primaryElementId]) 
          );
        }
        continue; 
      }

      const compensatingTransformForDirectDependent: TransformEffect = {
        type: 'translate',
        translateX: Math.round(totalCompensationX * 1000) / 1000,
        translateY: Math.round(totalCompensationY * 1000) / 1000,
        initialOffsetX: firstPrimaryEffect?.initialOffsetX,
        initialOffsetY: firstPrimaryEffect?.initialOffsetY,
        transformOrigin: { x: 0, y: 0 } 
      };
      
      this.applyTransform(
        dependency.dependentElementId,
        compensatingTransformForDirectDependent,
        syncData
      );

      this.propagateTransformsRecursively(
        dependency.dependentElementId,
        compensatingTransformForDirectDependent, 
        syncData,
        new Set([primaryElementId])
      );
    }
  }

  private propagateTransformsRecursively(
    currentParentId: string, 
    parentTransformEffect: TransformEffect, 
    syncData: AnimationSyncData,
    processedElements: Set<string> 
  ): void {
    if (processedElements.has(currentParentId)) {
      return; 
    }
    
    const currentProcessedElements = new Set(processedElements);
    currentProcessedElements.add(currentParentId);

    const parentElement = this.elementsMap?.get(currentParentId);
    if (!parentElement) return;

    const dependentsOfCurrentParent = this.findDependentElements(currentParentId); 

    for (const dependency of dependentsOfCurrentParent) {
      const dependentElement = this.elementsMap?.get(dependency.dependentElementId);
      if (!dependentElement) continue;

      const displacementFromParentEffect = this.calculateAnchorDisplacement(
        parentElement, 
        dependency.targetAnchorPoint, 
        [parentTransformEffect] 
      );
      
      if (displacementFromParentEffect.x === 0 && displacementFromParentEffect.y === 0) {
        if (parentTransformEffect.initialOffsetX !== undefined || parentTransformEffect.initialOffsetY !== undefined) {
          const zeroMoveEffectWithInitialOffset: TransformEffect = {
            type: 'translate',
            translateX: 0,
            translateY: 0,
            initialOffsetX: parentTransformEffect.initialOffsetX,
            initialOffsetY: parentTransformEffect.initialOffsetY,
            transformOrigin: { x: 0, y: 0 }
          };
          this.applyTransform(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData
          );
          this.propagateTransformsRecursively(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData,
            currentProcessedElements 
          );
        }
        continue; 
      }
      
      const compensatingTransformForDependent: TransformEffect = {
        type: 'translate',
        translateX: Math.round(displacementFromParentEffect.x * 1000) / 1000,
        translateY: Math.round(displacementFromParentEffect.y * 1000) / 1000,
        initialOffsetX: parentTransformEffect.initialOffsetX, 
        initialOffsetY: parentTransformEffect.initialOffsetY,
        transformOrigin: { x: 0, y: 0 } 
      };

      this.applyTransform(
        dependency.dependentElementId,
        compensatingTransformForDependent,
        syncData
      );

      this.propagateTransformsRecursively(
        dependency.dependentElementId,
        compensatingTransformForDependent, 
        syncData,
        currentProcessedElements 
      );
    }
  }

  private calculateAnchorDisplacement(
    element: LayoutElement,
    anchorPointName: string,
    transformEffects: TransformEffect[]
  ): { x: number; y: number } {
    let currentAbsoluteAnchorPosition = AnchorPointUtils.getAnchorPointPosition(element, anchorPointName);

    let totalDisplacementX = 0;
    let totalDisplacementY = 0;

    for (const effect of transformEffects) {
      let stepDisplacement = { x: 0, y: 0 };
      if (effect.type === 'scale') {
        stepDisplacement = this.calculateScaleDisplacement(
          currentAbsoluteAnchorPosition,
          effect,
          element
        );
      } else if (effect.type === 'translate') {
        stepDisplacement = {
          x: effect.translateX || 0,
          y: effect.translateY || 0,
        };
      } else if (effect.type === 'rotate') {
        console.warn('[TransformPropagator] Rotation effect displacement not fully implemented for anchor propagation.');
      }

      totalDisplacementX += stepDisplacement.x;
      totalDisplacementY += stepDisplacement.y;
      
      currentAbsoluteAnchorPosition.x += stepDisplacement.x;
      currentAbsoluteAnchorPosition.y += stepDisplacement.y;
    }

    return {
      x: totalDisplacementX,
      y: totalDisplacementY,
    };
  }

  private calculateScaleDisplacement(
    anchorPosition: { x: number; y: number },
    scaleEffect: TransformEffect,
    element: LayoutElement
  ): { x: number; y: number } {
    const currentScaleX = scaleEffect.scaleStartX !== undefined 
      ? scaleEffect.scaleStartX 
      : (this.elementTransformStates.get(element.id)?.scaleX || 1);
    const currentScaleY = scaleEffect.scaleStartY !== undefined
      ? scaleEffect.scaleStartY
      : (this.elementTransformStates.get(element.id)?.scaleY || 1);
    
    const targetScaleX = scaleEffect.scaleTargetX || 1;
    const targetScaleY = scaleEffect.scaleTargetY || 1;
    
    const origin = scaleEffect.transformOrigin;
    
    const originAbsoluteX = element.layout.x + origin.x;
    const originAbsoluteY = element.layout.y + origin.y;

    const anchorRelativeToOriginX = anchorPosition.x - originAbsoluteX;
    const anchorRelativeToOriginY = anchorPosition.y - originAbsoluteY;

    const displacementX = anchorRelativeToOriginX * (targetScaleX - currentScaleX);
    const displacementY = anchorRelativeToOriginY * (targetScaleY - currentScaleY);
    
    return { x: displacementX, y: displacementY };
  }

  private applyTransform(
    elementId: string,
    transform: TransformEffect,
    syncData: AnimationSyncData
  ): void {
    if (!this.getShadowElement) return;

    const targetElement = this.getShadowElement(elementId);
    if (!targetElement) return;

    const timeline = gsap.timeline({
      onComplete: () => {
        this.removePropagationTimeline(elementId, timeline);
      },
      onReverseComplete: () => {
        this.removePropagationTimeline(elementId, timeline);
      }
    });

    const animationProps: any = {
      duration: syncData.duration || 0.5,
      ease: syncData.ease || 'power2.out',
    };

    if (syncData.repeat !== undefined) animationProps.repeat = syncData.repeat;
    if (syncData.yoyo !== undefined) animationProps.yoyo = syncData.yoyo;

    const finalTransform = this.applyAnchorAwareTransformOrigin(elementId, transform);

    if (finalTransform.type === 'translate') {
      const hasInitialOffset = finalTransform.initialOffsetX !== undefined || finalTransform.initialOffsetY !== undefined;
      if (hasInitialOffset) {
        const fromVars = {
          x: finalTransform.initialOffsetX || 0,
          y: finalTransform.initialOffsetY || 0,
        };
        animationProps.x = (finalTransform.initialOffsetX || 0) + (finalTransform.translateX || 0);
        animationProps.y = (finalTransform.initialOffsetY || 0) + (finalTransform.translateY || 0);
        timeline.fromTo(targetElement, fromVars, animationProps);
      } else {
        animationProps.x = `+=${finalTransform.translateX || 0}`;
        animationProps.y = `+=${finalTransform.translateY || 0}`;
        timeline.to(targetElement, animationProps);
      }
    } else if (finalTransform.type === 'scale') {
      if (finalTransform.scaleStartX !== undefined || finalTransform.scaleStartY !== undefined) {
        const initialScaleProps = {
          scaleX: finalTransform.scaleStartX || 1,
          scaleY: finalTransform.scaleStartY || 1,
          transformOrigin: finalTransform.transformOrigin ? 
            `${finalTransform.transformOrigin.x}px ${finalTransform.transformOrigin.y}px` : 'center center'
        };
        timeline.set(targetElement, initialScaleProps);
      }
      
      animationProps.scaleX = finalTransform.scaleTargetX || 1;
      animationProps.scaleY = finalTransform.scaleTargetY || 1;
      if (finalTransform.transformOrigin) {
        animationProps.transformOrigin = `${finalTransform.transformOrigin.x}px ${finalTransform.transformOrigin.y}px`;
      }
      timeline.to(targetElement, animationProps);
    } else if (finalTransform.type === 'rotate') {
      animationProps.rotation = finalTransform.rotation || 0;
      if (finalTransform.transformOrigin) {
        animationProps.transformOrigin = `${finalTransform.transformOrigin.x}px ${finalTransform.transformOrigin.y}px`;
      }
      timeline.to(targetElement, animationProps);
    } else if (finalTransform.type === 'fade') {
      if (finalTransform.opacity_start !== undefined) {
        const initialFadeProps = { opacity: finalTransform.opacity_start };
        timeline.fromTo(targetElement, initialFadeProps, { opacity: finalTransform.opacity_end || 1, ...animationProps });
      } else {
        animationProps.opacity = finalTransform.opacity_end || 1;
        timeline.to(targetElement, animationProps);
      }
    }

    if (syncData.delay) {
      timeline.delay(syncData.delay);
    }

    this.storePropagationTimeline(elementId, timeline, finalTransform);
    
    timeline.play();
  }

  private applyAnchorAwareTransformOrigin(
    elementId: string,
    transform: TransformEffect
  ): TransformEffect {
    if (transform.type !== 'scale') {
      return transform;
    }

    const element = this.elementsMap?.get(elementId);
    if (!element?.layoutConfig?.anchor) {
      return transform;
    }

    const anchorConfig = element.layoutConfig.anchor;
    
    if (anchorConfig.anchorTo && anchorConfig.anchorTo !== 'container') {
      const anchorPoint = anchorConfig.anchorPoint || 'topLeft';
      const transformOriginString = TransformOriginUtils.anchorPointToTransformOriginString(anchorPoint);
      const transformOrigin = TransformOriginUtils.parseTransformOrigin(transformOriginString, element);
      
      return {
        ...transform,
        transformOrigin
      };
    }

    return transform;
  }

  private storePropagationTimeline(
    elementId: string,
    timeline: gsap.core.Timeline,
    transformEffect: TransformEffect
  ): void {
    if (!this.activePropagationTimelines.has(elementId)) {
      this.activePropagationTimelines.set(elementId, []);
    }
    
    const timelines = this.activePropagationTimelines.get(elementId)!;
    timelines.push({
      timeline,
      elementId,
      transformEffect,
      isReversed: false
    });
  }

  private removePropagationTimeline(elementId: string, timeline: gsap.core.Timeline): void {
    const timelines = this.activePropagationTimelines.get(elementId);
    if (timelines) {
      const index = timelines.findIndex(pt => pt.timeline === timeline);
      if (index !== -1) {
        timelines.splice(index, 1);
      }
    }
  }

  private isEffectSignificant(effect: TransformEffect, elementId?: string): boolean {
    const threshold = 0.001;

    switch (effect.type) {
      case 'scale':
        const currentScaleX = effect.scaleStartX !== undefined
          ? effect.scaleStartX
          : (elementId ? this.elementTransformStates.get(elementId)?.scaleX : 1) || 1;
        const currentScaleY = effect.scaleStartY !== undefined
          ? effect.scaleStartY
          : (elementId ? this.elementTransformStates.get(elementId)?.scaleY : 1) || 1;

        const newScaleX = effect.scaleTargetX || 1;
        const newScaleY = effect.scaleTargetY || 1;
            
        return Math.abs(newScaleX - currentScaleX) > threshold ||
               Math.abs(newScaleY - currentScaleY) > threshold;
      case 'translate':
        return Math.abs(effect.translateX || 0) > threshold ||
               Math.abs(effect.translateY || 0) > threshold;
      case 'rotate':
        return Math.abs(effect.rotation || 0) > threshold;
      case 'fade':
        return Math.abs(effect.opacity_start || 0) > threshold ||
               Math.abs(effect.opacity_end || 0) > threshold;
      default:
        return false;
    }
  }

  clearDependencies(): void {
    this.elementDependencies.clear();
    this.elementTransformStates.clear();
    
    for (const [elementId, timelines] of this.activePropagationTimelines) {
      for (const propagationTimeline of timelines) {
        propagationTimeline.timeline.kill();
      }
    }
    this.activePropagationTimelines.clear();
  }

  cleanup(): void {
    this.clearDependencies();
    
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = undefined;
    }
  }

  reverseAnimationPropagation(
    elementId: string,
    animationConfig: AnimationDefinition
  ): void {
    if (!this.elementsMap || !this.getShadowElement) {
      console.warn('[TransformPropagator] Not initialized, cannot reverse animation propagation');
      return;
    }

    const affectedElements = this.findDependentElements(elementId);
    
    if (affectedElements.length === 0) {
      return;
    }

    const transformEffects = this.analyzeTransformEffects(elementId, animationConfig);
    
    if (transformEffects.length === 0) {
      return;
    }

    this.reverseElementTransformState(elementId, transformEffects);

    this.reverseCompensatingTransforms(elementId, transformEffects, affectedElements);
  }

  stopAnimationPropagation(elementId: string): void {
    const affectedElements = this.findDependentElements(elementId);
    
    for (const dependency of affectedElements) {
      this.stopPropagationTimelines(dependency.dependentElementId);
    }
  }

  private stopPropagationTimelines(elementId: string): void {
    const timelines = this.activePropagationTimelines.get(elementId);
    if (timelines) {
      for (const propagationTimeline of timelines) {
        propagationTimeline.timeline.kill();
      }
      timelines.length = 0;
    }
  }

  private reverseElementTransformState(elementId: string, transformEffects: TransformEffect[]): void {
    const currentState = this.elementTransformStates.get(elementId);
    if (!currentState) return;

    const reversedState = { ...currentState };

    for (const effect of transformEffects) {
      switch (effect.type) {
        case 'scale':
          reversedState.scaleX = effect.scaleStartX !== undefined ? effect.scaleStartX : 1;
          reversedState.scaleY = effect.scaleStartY !== undefined ? effect.scaleStartY : 1;
          break;
        case 'translate':
          reversedState.translateX -= effect.translateX || 0;
          reversedState.translateY -= effect.translateY || 0;
          break;
        case 'rotate':
          reversedState.rotation = 0;
          break;
      }
    }

    this.elementTransformStates.set(elementId, reversedState);
  }

  private reverseCompensatingTransforms(
    primaryElementId: string,
    transformEffects: TransformEffect[],
    affectedElements: ElementDependency[]
  ): void {
    if (!this.getShadowElement) return;

    for (const dependency of affectedElements) {
      this.reversePropagationTimelines(dependency.dependentElementId);
    }
  }

  private reversePropagationTimelines(elementId: string): boolean {
    const timelines = this.activePropagationTimelines.get(elementId);
    if (!timelines || timelines.length === 0) {
      console.debug(`[TransformPropagator] No active propagation timelines found for element: ${elementId}`);
      return false;
    }

    let reversed = false;
    for (const propagationTimeline of timelines) {
      if (!propagationTimeline.isReversed) {
        propagationTimeline.timeline.reverse();
        propagationTimeline.isReversed = true;
        reversed = true;
      } else {
        propagationTimeline.timeline.play();
        propagationTimeline.isReversed = false;
        reversed = true;
      }
    }
    
    return reversed;
  }
}

export const transformPropagator = new TransformPropagator(); 