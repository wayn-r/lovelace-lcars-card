import { LayoutElement } from '../layout/elements/element.js';
import { AnimationDefinition } from '../types.js';
import { HomeAssistant } from 'custom-card-helpers';

/**
 * Represents a visual transformation that will occur during an animation
 */
export interface TransformEffect {
  // Starting offset from the element's final layout position for 'in' type movements
  initialOffsetX?: number;
  initialOffsetY?: number;

  type: 'scale' | 'translate' | 'rotate';
  scaleStartX?: number;
  scaleStartY?: number;
  scaleTargetX?: number;
  scaleTargetY?: number;
  translateX?: number;
  translateY?: number;
  rotation?: number;
  transformOrigin: { x: number; y: number };
}

/**
 * Represents a dependency between elements for positioning
 */
export interface ElementDependency {
  dependentElementId: string;
  targetElementId: string;
  anchorPoint: string;
  targetAnchorPoint: string;
  dependencyType: 'anchor' | 'stretch';
}

/**
 * Animation properties to synchronize dependent animations
 */
export interface AnimationSyncData {
  duration: number;
  ease: string;
  delay?: number;
  repeat?: number;
  yoyo?: boolean;
}

/**
 * Represents the current transformation state of an element
 */
export interface ElementTransformState {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

/**
 * Manages transform propagation to maintain anchor relationships during animations
 */
export class TransformPropagator {
  private elementDependencies = new Map<string, ElementDependency[]>();
  private elementsMap?: Map<string, LayoutElement>;
  private getShadowElement?: (id: string) => Element | null;
  // Track current transformation state of elements
  private elementTransformStates = new Map<string, ElementTransformState>();

  /**
   * Initialize the propagator with current layout state
   */
  initialize(
    elementsMap: Map<string, LayoutElement>,
    getShadowElement?: (id: string) => Element | null
  ): void {
    this.elementsMap = elementsMap;
    this.getShadowElement = getShadowElement;
    this._buildDependencyGraph();
    this._initializeTransformStates();
  }

  /**
   * Initialize transform states for all elements to their default values
   */
  private _initializeTransformStates(): void {
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

  /**
   * Update the transform state of an element after an animation
   */
  private _updateElementTransformState(elementId: string, transformEffect: TransformEffect): void {
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

  /**
   * Get the current effective dimensions of an element accounting for its current scale
   */
  private _getCurrentElementDimensions(elementId: string): { x: number; y: number; width: number; height: number } {
    const element = this.elementsMap?.get(elementId);
    if (!element) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const currentState = this.elementTransformStates.get(elementId);
    if (!currentState) {
      return element.layout;
    }

    // Apply current scale to the layout dimensions
    const scaledWidth = element.layout.width * currentState.scaleX;
    const scaledHeight = element.layout.height * currentState.scaleY;

    return {
      x: element.layout.x,
      y: element.layout.y,
      width: scaledWidth,
      height: scaledHeight
    };
  }

  /**
   * Process an animation and apply compensating transforms to maintain anchoring
   */
  processAnimationWithPropagation(
    primaryElementId: string,
    animationConfig: AnimationDefinition,
    syncData: AnimationSyncData
  ): void {
    if (!this.elementsMap || !this.getShadowElement) {
      console.warn('[TransformPropagator] Not initialized, cannot process animation');
      return;
    }

    // Calculate the transform effects of the primary animation
    const transformEffects = this._analyzeTransformEffects(primaryElementId, animationConfig);
    
    if (transformEffects.length === 0) {
      return; // No transforms that affect positioning
    }

    // Apply self-compensation to maintain the element's own anchor relationships
    // and get the self-compensation transform that was applied.
    const selfCompensationEffect = this._applySelfCompensation(primaryElementId, transformEffects, syncData);

    // Update the element's transform state to reflect the new animation
    for (const effect of transformEffects) {
      this._updateElementTransformState(primaryElementId, effect);
    }

    // Directly call _applyCompensatingTransforms which will find dependents and initiate recursion
    this._applyCompensatingTransforms(
      primaryElementId,
      transformEffects, // These are the effects from the primary's animation config
      selfCompensationEffect, // This is the translation applied for self-compensation
      syncData
    );
  }

  /**
   * Process an animation sequence and apply compensating transforms to maintain anchoring
   * This method handles sequences where multiple animation steps need to be coordinated
   */
  processAnimationSequenceWithPropagation(
    primaryElementId: string,
    animationSequence: any, // AnimationSequence type
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
    const affectedElements = this._findDependentElements(primaryElementId);

    // 1. Pre-calculate overall initial offset for the entire sequence from "in" movements
    let sequenceOverallInitialX = 0;
    let sequenceOverallInitialY = 0;
    for (const stepGroup of sortedStepGroups) {
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        for (const animation of stepGroup.animations) {
          const tempStepEffects = this._analyzeTransformEffects(primaryElementId, animation);
          for (const effect of tempStepEffects) {
            if (effect.type === 'translate' && (effect.initialOffsetX !== undefined || effect.initialOffsetY !== undefined)) {
              // This effect is an "in" movement, its initialOffset is the negative travel vector as per _analyzeSlideEffect
              sequenceOverallInitialX += effect.initialOffsetX || 0;
              sequenceOverallInitialY += effect.initialOffsetY || 0;
            }
          }
        }
      }
    }

    // 2. Initialize current visual starting point for the sequence
    let currentVisualX = sequenceOverallInitialX;
    let currentVisualY = sequenceOverallInitialY;

    let cumulativeDelay = baseSyncData.delay || 0; // Start with base delay if any

    for (const stepGroup of sortedStepGroups) {
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        // Process all animations in this step group
        // For positioning effects, we need to track the cumulative effect across all animations in the group
        let groupInitialX = currentVisualX;
        let groupInitialY = currentVisualY;
        let maxGroupDuration = 0;

        // Calculate the longest duration in this group to know when to start the next index
        for (const animation of stepGroup.animations) {
          const animationDuration = (animation.duration || 0) + (animation.delay || 0);
          maxGroupDuration = Math.max(maxGroupDuration, animationDuration);
        }

        for (const animation of stepGroup.animations) {
          // Create sync data for this animation, incorporating the current animation's own delay
          const animationSyncData: AnimationSyncData = {
            duration: animation.duration,
            ease: animation.ease || baseSyncData.ease,
            delay: cumulativeDelay + (animation.delay || 0),
            repeat: animation.repeat,
            yoyo: animation.yoyo
          };

          const animationBaseEffects = this._analyzeTransformEffects(primaryElementId, animation);
          
          if (animationBaseEffects.length > 0) {
            const effectsForAnimationAndPropagation: TransformEffect[] = [];

            for (const baseEffect of animationBaseEffects) {
              const actualAnimationEffect = { ...baseEffect }; // Copy base effect

              if (actualAnimationEffect.type === 'translate') {
                // Set the 'from' part of fromTo to the current visual position
                actualAnimationEffect.initialOffsetX = groupInitialX;
                actualAnimationEffect.initialOffsetY = groupInitialY;
                
                // translateX/Y from baseEffect are the travel for *this* animation.
                // _applyTransform will calculate 'to' as initialOffset + travel.

                // Update currentVisualX/Y for positioning effects (these affect the final position)
                currentVisualX += baseEffect.translateX || 0;
                currentVisualY += baseEffect.translateY || 0;
              } else {
                // For non-translate effects, or if they need different sequence handling:
                // If scale/rotate also need to start from a sequence-aware accumulated state,
                // similar logic for initialScaleX/Y etc. might be needed here.
                // For now, pass them through, assuming their initial state is handled by gsap.to or is absolute.
              }
              effectsForAnimationAndPropagation.push(actualAnimationEffect);
            }

            // Directly apply the calculated animation effects to the primary element for this animation
            for (const effectToApply of effectsForAnimationAndPropagation) {
              this._applyTransform(primaryElementId, effectToApply, animationSyncData);
            }

            // Apply self-compensation using the modified effects for fluid animation
            const animationSelfCompensation = this._applySelfCompensation(primaryElementId, effectsForAnimationAndPropagation, animationSyncData);

            // Apply compensating transforms to dependent elements using modified effects
            if (affectedElements.length > 0) {
              this._applyCompensatingTransforms(
                primaryElementId,
                effectsForAnimationAndPropagation, 
                animationSelfCompensation,
                animationSyncData
              );
            }

            // Update the element's logical transform state using the original base effects
            for (const baseEffect of animationBaseEffects) {
              this._updateElementTransformState(primaryElementId, baseEffect);
            }
          }
        }

        // Update cumulative delay for the next step group's base delay point
        // Use the maximum duration from this group to ensure next index waits for all animations
        cumulativeDelay += maxGroupDuration;
      }
    }

    console.log(`[TransformPropagator] Processed animation sequence for ${primaryElementId} with ${sortedStepGroups.length} step groups. Initial offset: (${sequenceOverallInitialX}, ${sequenceOverallInitialY}). Final visual endpoint: (${currentVisualX}, ${currentVisualY}). Affected dependents: ${affectedElements.length}`);
  }

  /**
   * Build the dependency graph from current layout configuration
   */
  private _buildDependencyGraph(): void {
    if (!this.elementsMap) return;

    this.elementDependencies.clear();

    for (const [elementId, element] of this.elementsMap) {
      const dependencies = this._extractElementDependencies(elementId, element);
      if (dependencies.length > 0) {
        this.elementDependencies.set(elementId, dependencies);
      }
    }
  }

  /**
   * Extract dependencies for a single element
   */
  private _extractElementDependencies(
    elementId: string,
    element: LayoutElement
  ): ElementDependency[] {
    const dependencies: ElementDependency[] = [];

    // Check anchor dependencies
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

    // Check stretch dependencies
    const stretchConfig = element.layoutConfig.stretch;
    if (stretchConfig?.stretchTo1 && 
        stretchConfig.stretchTo1 !== 'container' && 
        stretchConfig.stretchTo1 !== 'canvas') {
      dependencies.push({
        dependentElementId: elementId,
        targetElementId: stretchConfig.stretchTo1,
        anchorPoint: 'unknown', // Stretch doesn't use anchor points
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

  /**
   * Analyze the visual effects of an animation
   */
  private _analyzeTransformEffects(
    elementId: string,
    animationConfig: AnimationDefinition
  ): TransformEffect[] {
    const effects: TransformEffect[] = [];
    const element = this.elementsMap?.get(elementId);
    
    if (!element) return effects;

    switch (animationConfig.type) {
      case 'scale':
        effects.push(this._analyzeScaleEffect(element, animationConfig));
        break;
      case 'slide':
        effects.push(this._analyzeSlideEffect(element, animationConfig));
        break;
      case 'custom_gsap':
        effects.push(...this._analyzeCustomGsapEffects(element, animationConfig));
        break;
    }

    return effects.filter(effect => this._isEffectSignificant(effect, elementId));
  }

  /**
   * Analyze scale animation effects
   */
  private _analyzeScaleEffect(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect {
    const scaleParams = animationConfig.scale_params;
    const scaleStart = scaleParams?.scale_start;
    const scaleEnd = scaleParams?.scale_end || 1;
    
    // For anchored elements, prefer using the anchor point as transform origin to minimize displacement
    let transformOriginString = scaleParams?.transform_origin;
    
    if (!transformOriginString && element.layoutConfig.anchor?.anchorTo && element.layoutConfig.anchor.anchorTo !== 'container') {
      // Use the element's anchor point as transform origin to minimize displacement
      const anchorPoint = element.layoutConfig.anchor.anchorPoint || 'topLeft';
      transformOriginString = this._anchorPointToTransformOriginString(anchorPoint);
    }
    
    // Fall back to center center if no better origin is available
    const transformOrigin = this._parseTransformOrigin(
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

  /**
   * Analyze slide animation effects
   */
  private _analyzeSlideEffect(
    element: LayoutElement,
    animationConfig: AnimationDefinition
  ): TransformEffect {
    const slideParams = animationConfig.slide_params;
    const direction = slideParams?.direction;
    const distance = this._parseDistance(slideParams?.distance || '0px', element);
    const movement = slideParams?.movement;

    let translateX = 0;
    let translateY = 0;

    // The TransformEffect should represent the net displacement of this animation step
    // from the element's original layout position.
    // The 'movement' parameter ('in'/'out') is critical here:
    // - 'in': The element animates *to* its layout position. Net displacement from layout = 0.
    // - 'out': The element animates *away from* its layout position by 'distance'.
    // - undefined: Assumed to be a direct translation, similar to 'out'.

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
      // For 'in' movements, the element starts offset and moves TO its layout position.
      // The initialOffset is the negative of the travel vector.
      initialOffsetX = -baseTranslateX;
      initialOffsetY = -baseTranslateY;
      // translateX/Y still represent the travel vector towards the layout position.
      translateX = baseTranslateX;
      translateY = baseTranslateY;
    } else {
      // For 'out' or direct movements, it starts at its layout position and moves AWAY.
      // No initial offset from the layout position.
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

  /**
   * Analyze custom GSAP animation effects
   */
  private _analyzeCustomGsapEffects(
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
        transformOrigin: this._parseTransformOrigin(
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
        transformOrigin: this._parseTransformOrigin(
          customVars.transformOrigin || 'center center',
          element
        )
      });
    }

    return effects;
  }

  /**
   * Apply self-compensation transforms to maintain the element's own anchor relationships
   */
  private _applySelfCompensation(
    elementId: string,
    transformEffects: TransformEffect[],
    syncData: AnimationSyncData
  ): TransformEffect | null {
    const element = this.elementsMap?.get(elementId);
    if (!element) return null;

    // Check if this element is anchored to another element
    const anchorConfig = element.layoutConfig.anchor;
    if (!anchorConfig?.anchorTo || anchorConfig.anchorTo === 'container') {
      return null; // No anchor compensation needed
    }

    // Filter out translation effects - slides are intended to move the element
    // and should not be compensated. Only geometric changes (scale, rotation) need compensation.
    const geometricEffects = transformEffects.filter(effect => effect.type !== 'translate');
    
    if (geometricEffects.length === 0) {
      return null; // No geometric effects to compensate
    }

    // Calculate how much the element's anchor point will move due to its geometric transformations
    const ownAnchorPoint = anchorConfig.anchorPoint || 'topLeft';
    const anchorDisplacement = this._calculateAnchorDisplacement(
      element,
      ownAnchorPoint,
      geometricEffects // Only geometric effects, not translations
    );

    if (anchorDisplacement.x === 0 && anchorDisplacement.y === 0) {
      return null; // No displacement to compensate
    }

    // Create a compensating translation that moves the element in the opposite direction
    // to keep its anchor point in the same relative position
    const compensatingTransform: TransformEffect = {
      type: 'translate',
      translateX: Math.round(-anchorDisplacement.x * 1000) / 1000, // Round to avoid precision issues
      translateY: Math.round(-anchorDisplacement.y * 1000) / 1000,
      transformOrigin: { x: 0, y: 0 } // Transform origin is not relevant for pure translation
    };

    // Apply the compensating transform
    this._applyTransform(elementId, compensatingTransform, syncData);
    return compensatingTransform; // Return the applied self-compensation
  }

  /**
   * Find all elements that depend on the given element
   */
  private _findDependentElements(targetElementId: string): ElementDependency[] {
    const dependents: ElementDependency[] = [];

    // Search through all dependencies to find ones that target this element
    for (const [elementId, dependencies] of this.elementDependencies) {
      for (const dependency of dependencies) {
        if (dependency.targetElementId === targetElementId) {
          dependents.push(dependency);
        }
      }
    }

    return dependents;
  }

  /**
   * Apply compensating transforms to maintain anchor relationships.
   * This is the initiator for direct dependents of the primary animated element.
   */
  private _applyCompensatingTransforms(
    primaryElementId: string,
    primaryTransformEffects: TransformEffect[], 
    primarySelfCompensation: TransformEffect | null,
    syncData: AnimationSyncData
  ): void {
    const primaryElement = this.elementsMap?.get(primaryElementId);
    if (!primaryElement) return;

    // These are the elements directly depending on the primary animated element
    const directDependentsOfPrimary = this._findDependentElements(primaryElementId);

    for (const dependency of directDependentsOfPrimary) {
      const dependentElement = this.elementsMap?.get(dependency.dependentElementId);
      if (!dependentElement) continue;

      const displacementFromPrimaryEffects = this._calculateAnchorDisplacement(
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
      
      const firstPrimaryEffect = primaryTransformEffects[0]; // Used to get original initialOffset
      
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
          this._applyTransform(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData
          );
          this._propagateTransformsRecursively(
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
      
      this._applyTransform(
        dependency.dependentElementId,
        compensatingTransformForDirectDependent,
        syncData
      );

      this._propagateTransformsRecursively(
        dependency.dependentElementId,
        compensatingTransformForDirectDependent, 
        syncData,
        new Set([primaryElementId])
      );
    }
  }

  /**
   * Recursively propagate transforms to all dependent elements in the chain.
   */
  private _propagateTransformsRecursively(
    currentParentId: string, 
    parentTransformEffect: TransformEffect, 
    syncData: AnimationSyncData,
    processedElements: Set<string> 
  ): void {
    if (processedElements.has(currentParentId)) {
      return; 
    }
    // Add current parent to its own processed set copy for this branch of recursion
    const currentProcessedElements = new Set(processedElements);
    currentProcessedElements.add(currentParentId);

    const parentElement = this.elementsMap?.get(currentParentId);
    if (!parentElement) return;

    const dependentsOfCurrentParent = this._findDependentElements(currentParentId); 

    for (const dependency of dependentsOfCurrentParent) {
      const dependentElement = this.elementsMap?.get(dependency.dependentElementId);
      if (!dependentElement) continue;

      const displacementFromParentEffect = this._calculateAnchorDisplacement(
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
          this._applyTransform(
            dependency.dependentElementId,
            zeroMoveEffectWithInitialOffset,
            syncData
          );
          this._propagateTransformsRecursively(
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

      this._applyTransform(
        dependency.dependentElementId,
        compensatingTransformForDependent,
        syncData
      );

      this._propagateTransformsRecursively(
        dependency.dependentElementId,
        compensatingTransformForDependent, 
        syncData,
        currentProcessedElements 
      );
    }
  }

  /**
   * Calculate how much an anchor point moves due to transformations
   */
  private _calculateAnchorDisplacement(
    element: LayoutElement,
    anchorPointName: string,
    transformEffects: TransformEffect[]
  ): { x: number; y: number } {
    // Get the initial absolute position of the anchor point on 'element'
    // This accounts for all transforms applied to 'element' *before* the current 'transformEffects'
    let currentAbsoluteAnchorPosition = this._getAnchorPointPosition(element, anchorPointName);

    let totalDisplacementX = 0;
    let totalDisplacementY = 0;

    // transformEffects usually contains a single primary effect from the animation config for the current step
    for (const effect of transformEffects) {
      let stepDisplacement = { x: 0, y: 0 };
      if (effect.type === 'scale') {
        // Calculate how 'currentAbsoluteAnchorPosition' moves due to this 'effect'
        // _calculateScaleDisplacement needs the position of the point *before* this specific scale effect
        stepDisplacement = this._calculateScaleDisplacement(
          currentAbsoluteAnchorPosition, // Its current absolute position
          effect,                        // The scale effect to apply
          element                        // The element being scaled
        );
      } else if (effect.type === 'translate') {
        // For a pure translation, the displacement of any point on the element is the translation itself
        stepDisplacement = {
          x: effect.translateX || 0,
          y: effect.translateY || 0,
        };
      } else if (effect.type === 'rotate') {
        // Placeholder for rotation displacement calculation
        // This would be more complex, similar to scale, involving rotation around effect.transformOrigin
        // For now, assume rotation doesn't cause simple anchor displacement that we propagate as translation
        // Or, if it does, it needs a _calculateRotationDisplacement method
        console.warn('[TransformPropagator] Rotation effect displacement not fully implemented for anchor propagation.');
      }

      totalDisplacementX += stepDisplacement.x;
      totalDisplacementY += stepDisplacement.y;
      
      // Update the anchor position for the next potential effect in this step's sequence
      currentAbsoluteAnchorPosition.x += stepDisplacement.x;
      currentAbsoluteAnchorPosition.y += stepDisplacement.y;
    }

    return {
      x: totalDisplacementX,
      y: totalDisplacementY,
    };
  }

  /**
   * Calculate displacement caused by scaling
   */
  private _calculateScaleDisplacement(
    anchorPosition: { x: number; y: number },
    scaleEffect: TransformEffect,
    element: LayoutElement
  ): { x: number; y: number } {
    const s_current_X = scaleEffect.scaleStartX !== undefined 
      ? scaleEffect.scaleStartX 
      : (this.elementTransformStates.get(element.id)?.scaleX || 1);
    const s_current_Y = scaleEffect.scaleStartY !== undefined
      ? scaleEffect.scaleStartY
      : (this.elementTransformStates.get(element.id)?.scaleY || 1);
    
    const s_target_X = scaleEffect.scaleTargetX || 1;
    const s_target_Y = scaleEffect.scaleTargetY || 1;
    
    const origin = scaleEffect.transformOrigin;
    
    const originAbsoluteX = element.layout.x + origin.x;
    const originAbsoluteY = element.layout.y + origin.y;

    const p_orig_relative_to_origin_X = anchorPosition.x - originAbsoluteX;
    const p_orig_relative_to_origin_Y = anchorPosition.y - originAbsoluteY;

    const displacementX = p_orig_relative_to_origin_X * (s_target_X - s_current_X);
    const displacementY = p_orig_relative_to_origin_Y * (s_target_Y - s_current_Y);
    
    return { x: displacementX, y: displacementY };
  }

  /**
   * Apply a transform to an element
   */
  private _applyTransform(
    elementId: string,
    transform: TransformEffect,
    syncData: AnimationSyncData
  ): void {
    if (!this.getShadowElement) return;

    const targetElement = this.getShadowElement(elementId);
    if (!targetElement) return;

    // Import GSAP dynamically to avoid bundling issues
    import('gsap').then(({ gsap }) => {
      // Build animation properties for GSAP
      const animationProps: any = {
        duration: syncData.duration || 0.5,
        ease: syncData.ease || 'power2.out',
        overwrite: false, // Don't automatically overwrite existing animations
      };

      // Handle optional animation properties
      if (syncData.delay !== undefined) {
        animationProps.delay = syncData.delay;
      }
      if (syncData.repeat !== undefined) {
        animationProps.repeat = syncData.repeat;
      }
      if (syncData.yoyo !== undefined) {
        animationProps.yoyo = syncData.yoyo;
      }

      // Apply transform based on type
      if (transform.type === 'translate') {
        const hasInitialOffset = transform.initialOffsetX !== undefined || transform.initialOffsetY !== undefined;
        if (hasInitialOffset) {
          const fromVars = {
            x: transform.initialOffsetX || 0,
            y: transform.initialOffsetY || 0,
          };
          // toVars should be the final position after the translation
          // This is the initial offset plus the translation distance
          animationProps.x = (transform.initialOffsetX || 0) + (transform.translateX || 0);
          animationProps.y = (transform.initialOffsetY || 0) + (transform.translateY || 0);
          gsap.fromTo(targetElement, fromVars, animationProps);
        } else {
          // Standard translation from current position
          animationProps.x = `+=${transform.translateX || 0}`;
          animationProps.y = `+=${transform.translateY || 0}`;
          gsap.to(targetElement, animationProps);
        }
      } else if (transform.type === 'scale') {
        animationProps.scaleX = transform.scaleTargetX !== undefined ? transform.scaleTargetX : (transform.scaleTargetY !== undefined ? undefined : 1); // GSAP prefers scaleX/scaleY
        animationProps.scaleY = transform.scaleTargetY !== undefined ? transform.scaleTargetY : (transform.scaleTargetX !== undefined ? undefined : 1);
        if (transform.transformOrigin) {
          animationProps.transformOrigin = `${transform.transformOrigin.x}px ${transform.transformOrigin.y}px`;
        }
        gsap.to(targetElement, animationProps);
      } else if (transform.type === 'rotate') {
        animationProps.rotation = transform.rotation || 0;
        if (transform.transformOrigin) {
          animationProps.transformOrigin = `${transform.transformOrigin.x}px ${transform.transformOrigin.y}px`;
        }
        gsap.to(targetElement, animationProps);
      }
      // Note: The explicit `animationProps.delay = syncData.delay || 0;` was removed as it's part of animationProps build up.
    }).catch(error => {
      console.error(`[TransformPropagator] Error importing GSAP for element ${elementId}:`, error);
    });
  }

  /**
   * Get the absolute position of an anchor point on an element
   */
  private _getAnchorPointPosition(
    element: LayoutElement,
    anchorPoint: string
  ): { x: number; y: number } {
    const { x, y, width, height } = element.layout;

    switch (anchorPoint) {
      case 'topLeft': return { x, y };
      case 'topCenter': return { x: x + width / 2, y };
      case 'topRight': return { x: x + width, y };
      case 'centerLeft': return { x, y: y + height / 2 };
      case 'center': return { x: x + width / 2, y: y + height / 2 };
      case 'centerRight': return { x: x + width, y: y + height / 2 };
      case 'bottomLeft': return { x, y: y + height };
      case 'bottomCenter': return { x: x + width / 2, y: y + height };
      case 'bottomRight': return { x: x + width, y: y + height };
      default: return { x, y }; // Default to topLeft
    }
  }

  /**
   * Convert anchor point to transform origin string
   */
  private _anchorPointToTransformOriginString(anchorPoint: string): string {
    switch (anchorPoint) {
      case 'topLeft': return 'left top';
      case 'topCenter': return 'center top';
      case 'topRight': return 'right top';
      case 'centerLeft': return 'left center';
      case 'center': return 'center center';
      case 'centerRight': return 'right center';
      case 'bottomLeft': return 'left bottom';
      case 'bottomCenter': return 'center bottom';
      case 'bottomRight': return 'right bottom';
      default: return 'center center';
    }
  }

  /**
   * Parse transform origin string to absolute coordinates
   */
  private _parseTransformOrigin(
    transformOrigin: string,
    element: LayoutElement
  ): { x: number; y: number } {
    const parts = transformOrigin.split(' ');
    const xPart = parts[0] || 'center';
    const yPart = parts[1] || 'center';

    const x = this._parseOriginComponent(xPart, element.layout.width);
    const y = this._parseOriginComponent(yPart, element.layout.height);

    return { x, y };
  }

  /**
   * Parse a single component of transform origin
   */
  private _parseOriginComponent(component: string, dimension: number): number {
    switch (component) {
      case 'left':
      case 'top':
        return 0;
      case 'center':
        return dimension / 2;
      case 'right':
      case 'bottom':
        return dimension;
      default:
        // Parse percentage or pixel values
        if (component.endsWith('%')) {
          const percentage = parseFloat(component);
          return (percentage / 100) * dimension;
        } else if (component.endsWith('px')) {
          return parseFloat(component);
        }
        return dimension / 2; // Default to center
    }
  }

  /**
   * Parse distance string to handle both pixels and percentages
   */
  private _parseDistance(distance: string, element?: LayoutElement): number {
    if (!distance) return 0;
    
    if (distance.endsWith('%')) {
      const percentage = parseFloat(distance);
      if (element) {
        // For percentage, use the element's width for horizontal movements or height for vertical
        // Since we don't know the direction here, use the larger dimension as a reasonable default
        const referenceSize = Math.max(element.layout.width, element.layout.height);
        return (percentage / 100) * referenceSize;
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

  /**
   * Check if a transform effect is significant enough to propagate
   */
  private _isEffectSignificant(effect: TransformEffect, elementId?: string): boolean {
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
      default:
        return false;
    }
  }

  /**
   * Clear all cached dependencies and transform states
   */
  clearDependencies(): void {
    this.elementDependencies.clear();
    this.elementTransformStates.clear();
  }
}

// Export singleton instance
export const transformPropagator = new TransformPropagator(); 