import { LayoutElement } from '../layout/elements/element.js';
import { AnimationDefinition } from '../types.js';
import { HomeAssistant } from 'custom-card-helpers';

/**
 * Represents a visual transformation that will occur during an animation
 */
export interface TransformEffect {
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

    // Find all elements that depend on this element
    const affectedElements = this._findDependentElements(primaryElementId);
    
    if (affectedElements.length > 0) {
      // Calculate and apply compensating transforms to dependent elements
      this._applyCompensatingTransforms(
        primaryElementId,
        transformEffects, // These are the effects from the primary's animation config
        selfCompensationEffect, // This is the translation applied for self-compensation
        affectedElements,
        syncData
      );
    }
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

    if (!animationSequence.steps || !Array.isArray(animationSequence.steps)) {
      console.warn('[TransformPropagator] Invalid animation sequence: missing steps array');
      return;
    }

    // Sort steps by index to ensure proper execution order
    const sortedSteps = [...animationSequence.steps].sort((a, b) => (a.index || 0) - (b.index || 0));
    
    // Find all elements that depend on this element once
    const affectedElements = this._findDependentElements(primaryElementId);
    
    if (affectedElements.length === 0) {
      return; // No dependent elements, no compensation needed
    }

    // Process each step and accumulate the transform effects
    const cumulativeTransformEffects: TransformEffect[] = [];
    let cumulativeDelay = 0;

    for (const step of sortedSteps) {
      // Create sync data for this step
      const stepSyncData: AnimationSyncData = {
        duration: step.duration,
        ease: step.ease || baseSyncData.ease,
        delay: cumulativeDelay + (step.delay || 0),
        repeat: step.repeat,
        yoyo: step.yoyo
      };

      // Analyze the transform effects of this step
      const stepTransformEffects = this._analyzeTransformEffects(primaryElementId, step);
      
      if (stepTransformEffects.length > 0) {
        // Update cumulative effects
        cumulativeTransformEffects.push(...stepTransformEffects);

        // Apply self-compensation for this step
        const stepSelfCompensation = this._applySelfCompensation(primaryElementId, stepTransformEffects, stepSyncData);

        // Calculate and apply compensating transforms to dependent elements for this step
        this._applyCompensatingTransforms(
          primaryElementId,
          stepTransformEffects,
          stepSelfCompensation,
          affectedElements,
          stepSyncData
        );

        // Update the element's transform state
        for (const effect of stepTransformEffects) {
          this._updateElementTransformState(primaryElementId, effect);
        }
      }

      // Update cumulative delay for next step
      // Next step should start after this step's delay + duration
      cumulativeDelay += (step.delay || 0) + step.duration;
    }

    console.log(`[TransformPropagator] Processed animation sequence for ${primaryElementId} with ${sortedSteps.length} steps affecting ${affectedElements.length} dependent elements`);
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
    const distance = this._parseDistance(slideParams?.distance || '0px');
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

    if (movement === 'in') {
      // If movement is 'in', the element animates TO its layout position.
      // So, its net displacement FROM its layout position for this step is 0.
      translateX = 0;
      translateY = 0;
    } else {
      // If movement is 'out' or undefined, it animates AWAY from (or directly from)
      // its layout position by 'distance'.
      translateX = baseTranslateX;
      translateY = baseTranslateY;
    }

    return {
      type: 'translate',
      translateX,
      translateY,
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
   * Apply compensating transforms to maintain anchor relationships
   */
  private _applyCompensatingTransforms(
    primaryElementId: string,
    transformEffects: TransformEffect[],
    primarySelfCompensation: TransformEffect | null, // Added: self-compensation of primary
    affectedDependencies: ElementDependency[],
    syncData: AnimationSyncData
  ): void {
    const primaryElement = this.elementsMap?.get(primaryElementId);
    if (!primaryElement) return;

    for (const dependency of affectedDependencies) {
      const dependentElement = this.elementsMap?.get(dependency.dependentElementId);
      if (!dependentElement) continue;

      // Calculate displacement of the anchor point on the primary element due to its direct animation effects
      const displacementFromEffects = this._calculateAnchorDisplacement(
        primaryElement,
        dependency.targetAnchorPoint,
        transformEffects // Use the original transform effects of the primary animation
      );

      // The dependent element should move to follow the net position of the primary's anchor point
      // This includes both the direct animation displacement AND any self-compensation the primary applies
      let compensationX = displacementFromEffects.x;
      let compensationY = displacementFromEffects.y;

      // Add the primary element's self-compensation translation
      // The dependent should follow the primary's net movement, including its self-compensation
      if (primarySelfCompensation && primarySelfCompensation.type === 'translate') {
        compensationX += primarySelfCompensation.translateX || 0;
        compensationY += primarySelfCompensation.translateY || 0;
      }
      
      if (compensationX === 0 && compensationY === 0) {
        // No net displacement, no compensation needed for this dependent
        continue; 
      }

      const compensatingTransformForDependent: TransformEffect = {
        type: 'translate',
        translateX: Math.round(compensationX * 1000) / 1000, // Round to 3 decimal places
        translateY: Math.round(compensationY * 1000) / 1000,
        transformOrigin: { x: 0, y: 0 } // Not relevant for pure translation
      };
      
      this._applyTransform(
        dependency.dependentElementId,
        compensatingTransformForDependent,
        syncData
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
        // Use relative positioning to ensure transforms are additive
        animationProps.x = `+=${transform.translateX || 0}`;
        animationProps.y = `+=${transform.translateY || 0}`;
      } else if (transform.type === 'scale') {
        animationProps.scale = transform.scaleTargetX || 1;
        if (transform.transformOrigin) {
          animationProps.transformOrigin = `${transform.transformOrigin.x}px ${transform.transformOrigin.y}px`;
        }
      }

      animationProps.delay = syncData.delay || 0; // Ensure delay is explicitly 0 if undefined for GSAP

      // Execute the animation
      gsap.to(targetElement, animationProps);
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
   * Parse distance string to pixels
   */
  private _parseDistance(distance: string): number {
    if (distance.endsWith('px')) {
      return parseFloat(distance);
    } else if (distance.endsWith('%')) {
      // For percentage, we'd need container context - assuming 100px for now
      const percentage = parseFloat(distance);
      return percentage; // Simplified
    }
    return parseFloat(distance) || 0;
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