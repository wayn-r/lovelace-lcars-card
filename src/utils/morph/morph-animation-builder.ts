import type { LayoutElement } from '../../layout/elements/element.js';
import gsap from 'gsap';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('AnimationBuilder');

export interface AnimationInstruction {
  targetElementId: string;
  animationType: 'fade' | 'morph' | 'transform' | 'pathMorph' | 'scale' | 'visibility' | 'squish' | 'reverseSquish' | 'textStyle' | 'shapeStyle';
  properties: Record<string, any>;
  duration: number;
  delay?: number;
}

export interface PhaseAnimationBundle {
  phaseName: string;
  simultaneousAnimations: AnimationInstruction[];
  totalPhaseDuration: number;
}

export interface MorphAnimationContext {
  sourceElements: LayoutElement[];
  targetElements: LayoutElement[];
  elementMapping: Map<string, string>;
  cloneElementsById?: Map<string, Element>;
  sourceCloneElementsById?: Map<string, Element>;
  targetCloneElementsById?: Map<string, Element>;
  overlay?: SVGGElement;
}

abstract class BaseAnimationBuilder {
  protected currentAnimations: AnimationInstruction[] = [];
  protected defaultDuration: number = 1.0;

  constructor(phaseDuration: number = 1.0) {
    this.defaultDuration = phaseDuration;
  }

  protected addAnimation(
    elementId: string,
    animationType: AnimationInstruction['animationType'],
    properties: Record<string, any>,
    duration?: number,
    delay: number = 0
  ): this {
    this.currentAnimations.push({
      targetElementId: elementId,
      animationType,
      properties,
      duration: duration ?? this.defaultDuration,
      delay
    });
    return this;
  }

  clearAnimations(): this {
    this.currentAnimations = [];
    return this;
  }
}

export class AnimationBuilder extends BaseAnimationBuilder {
  constructor(phaseDuration: number = 1.0) {
    super(phaseDuration);
  }

  static createForPhase(_phaseName: string, phaseDuration: number = 1.0): AnimationBuilder {
    const builder = new AnimationBuilder(phaseDuration);
    return builder;
  }

  addFadeOutAnimation(elementId: string, duration?: number, delay: number = 0): this {
    return this.addAnimation(elementId, 'fade', { opacity: 0 }, duration, delay);
  }

  addFadeInAnimation(elementId: string, delay: number = 0, duration?: number): this {
    return this.addAnimation(elementId, 'fade', { opacity: 1 }, duration, delay);
  }

  addTransformAnimation(elementId: string, transformProperties: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  }, delay: number = 0): this {
    return this.addAnimation(elementId, 'transform', {
      ...transformProperties,
      transformOrigin: '0px 0px'
    }, undefined, delay);
  }

  addSquishAnimation(elementId: string, duration?: number, delay?: number): this {
    return this.addAnimation(elementId, 'squish', {
      scaleY: 0,
      transformOrigin: '50% 50%'
    }, duration, delay ?? 0);
  }

  addReverseSquishAnimation(elementId: string, duration?: number, delay?: number): this {
    return this.addAnimation(elementId, 'reverseSquish', {
      scaleY: 1,
      opacity: 1,
      transformOrigin: '50% 50%'
    }, duration, delay ?? 0);
  }

  addPathMorphAnimation(elementId: string, targetPath: string, delay: number = 0): this {
    return this.addAnimation(elementId, 'pathMorph', {
      morphSVG: { shape: targetPath, shapeIndex: 'auto' }
    }, undefined, delay);
  }

  addTextStyleAnimation(
    elementId: string,
    matchedTargetId: string,
    options: { delay?: number; preserveMaskFill?: boolean } = {}
  ): this {
    const { delay = 0, preserveMaskFill = false } = options;
    return this.addAnimation(elementId, 'textStyle', {
      matchedTargetId,
      preserveMaskFill
    }, undefined, delay);
  }

  addShapeStyleAnimation(elementId: string, matchedTargetId: string, delay: number = 0): this {
    return this.addAnimation(elementId, 'shapeStyle', {
      matchedTargetId
    }, undefined, delay);
  }

  addVisibilityToggle(elementId: string, isVisible: boolean, delay: number = 0): this {
    return this.addAnimation(elementId, 'visibility', {
      display: isVisible ? 'inline' : 'none'
    }, 0, delay);
  }

  addScaleAnimation(elementId: string, scaleX: number, scaleY: number, delay: number = 0): this {
    return this.addAnimation(elementId, 'scale', {
      scaleX,
      scaleY,
      transformOrigin: '0px 0px'
    }, undefined, delay);
  }

  buildPhaseBundle(phaseName: string): PhaseAnimationBundle {
    const animations = [...this.currentAnimations];
    const maxEndTime = Math.max(
      ...animations.map(anim => (anim.delay || 0) + anim.duration),
      this.defaultDuration
    );

    return {
      phaseName,
      simultaneousAnimations: animations,
      totalPhaseDuration: maxEndTime
    };
  }
}

export class MorphAnimationOrchestrator {
  static executePhaseBundle(
    timeline: gsap.core.Timeline,
    phaseBundle: PhaseAnimationBundle,
    phaseStartTime: number,
    context: MorphAnimationContext
  ): number {
    const debug = Boolean((context as any).debugMorph);
    for (const animation of phaseBundle.simultaneousAnimations) {
      const resolution = this._resolveAnimationElement(phaseBundle.phaseName, animation, context);

      if (!resolution) {
        this._logMissingElement(debug, phaseBundle, animation, context);
        continue;
      }

      if (debug) {
        this._logEnqueuedAnimation(phaseBundle, animation, resolution);
      }

      const animationStartTime = this._calculateAnimationStartTime(phaseStartTime, animation);
      this._executeAnimation(timeline, animation, animationStartTime, context, resolution.element);
    }

    return phaseBundle.totalPhaseDuration;
  }

  private static _resolveAnimationElement(
    phaseName: string,
    animation: AnimationInstruction,
    context: MorphAnimationContext
  ): { element: Element; origin: 'source' | 'target' | 'combined' } | null {
    const preferTarget = phaseName === 'fadeInTarget';
    const sourceMap = context.sourceCloneElementsById;
    const targetMap = context.targetCloneElementsById;
    const combinedMap = context.cloneElementsById;

    if (preferTarget) {
      const targetElement = targetMap?.get(animation.targetElementId);
      if (targetElement) {
        return { element: targetElement, origin: 'target' };
      }

      const combinedElement = combinedMap?.get(animation.targetElementId);
      if (combinedElement) {
        return { element: combinedElement, origin: 'combined' };
      }
      return null;
    }

    const sourceElement = sourceMap?.get(animation.targetElementId);
    if (sourceElement) {
      return { element: sourceElement, origin: 'source' };
    }

    const combinedElement = combinedMap?.get(animation.targetElementId);
    if (combinedElement) {
      return { element: combinedElement, origin: 'combined' };
    }

    return null;
  }

  private static _logMissingElement(
    debug: boolean,
    phaseBundle: PhaseAnimationBundle,
    animation: AnimationInstruction,
    context: MorphAnimationContext
  ): void {
    if (!debug) {
      return;
    }

    // eslint-disable-next-line no-console
    console.info('[Morph Debug] element not found for phase', phaseBundle.phaseName, {
      id: animation.targetElementId,
      preferTarget: phaseBundle.phaseName === 'fadeInTarget',
      hasSourceMap: Boolean(context.sourceCloneElementsById),
      hasTargetMap: Boolean(context.targetCloneElementsById)
    });
  }

  private static _logEnqueuedAnimation(
    phaseBundle: PhaseAnimationBundle,
    animation: AnimationInstruction,
    resolution: { element: Element; origin: 'source' | 'target' | 'combined' }
  ): void {
    let initialOpacity: string | undefined;
    try {
      const castElement = resolution.element as HTMLElement;
      initialOpacity = castElement.style?.opacity ?? getComputedStyle(castElement).opacity;
    } catch {}

    // eslint-disable-next-line no-console
    console.info('[Morph Debug] enqueue', {
      phase: phaseBundle.phaseName,
      type: animation.animationType,
      id: animation.targetElementId,
      map: resolution.origin,
      duration: animation.duration,
      delay: animation.delay || 0,
      initialOpacity
    });
  }

  private static _calculateAnimationStartTime(phaseStartTime: number, animation: AnimationInstruction): number {
    return phaseStartTime + (animation.delay || 0);
  }

  private static _executeAnimation(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    context: MorphAnimationContext,
    targetElement: Element
  ): void {
    switch (animation.animationType) {
      case 'fade':
      case 'transform':
      case 'scale':
        this._applySimpleTween(timeline, animation, animationStartTime, targetElement);
        break;
      case 'textStyle':
        this._applyTextStyle(timeline, animation, animationStartTime, context, targetElement);
        break;
      case 'pathMorph':
        this._applyPathMorph(timeline, animation, animationStartTime, targetElement);
        break;
      case 'shapeStyle':
        this._applyShapeStyle(timeline, animation, animationStartTime, context, targetElement);
        break;
      case 'visibility':
        this._applyVisibility(timeline, animation, animationStartTime, targetElement);
        break;
      case 'squish':
        this._applySquish(timeline, animation, animationStartTime, targetElement);
        break;
      case 'reverseSquish':
        this._applyReverseSquish(timeline, animation, animationStartTime, targetElement);
        break;
    }
  }

  private static _applySimpleTween(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    targetElement: Element
  ): void {
    this._queueTween(timeline, targetElement, animation.duration, animation.properties ?? {}, animationStartTime, 'power2.out');
  }

  private static _applyTextStyle(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    context: MorphAnimationContext,
    cloneElement: Element
  ): void {
    const srcText = this._findTextElementInClone(cloneElement, animation.targetElementId);
    if (!srcText) {
      return;
    }

    const properties = animation.properties ?? {};
    const matchedTargetId: string | undefined = properties.matchedTargetId;
    const preserveMaskFill = Boolean(properties.preserveMaskFill);
    const attrTargets = this._buildTextAttributeTargets(context, matchedTargetId, preserveMaskFill);

    if (Object.keys(attrTargets).length === 0) {
      return;
    }

    this._queueTween(
      timeline,
      srcText,
      animation.duration,
      { attr: attrTargets },
      animationStartTime,
      'power2.out'
    );
  }

  private static _applyPathMorph(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    cloneElement: Element
  ): void {
    const pathElement = this._findPathElementInClone(cloneElement, animation.targetElementId);
    if (!pathElement) {
      return;
    }

    this._queueTween(timeline, pathElement, animation.duration, animation.properties ?? {}, animationStartTime, 'power2.out');
  }

  private static _applyShapeStyle(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    context: MorphAnimationContext,
    cloneElement: Element
  ): void {
    const srcPath = this._findPathElementInClone(cloneElement, animation.targetElementId);
    if (!srcPath) {
      return;
    }

    const properties = animation.properties ?? {};
    const matchedTargetId: string | undefined = properties.matchedTargetId;
    const attrTargets = this._buildShapeAttributeTargets(context, matchedTargetId);

    if (Object.keys(attrTargets).length === 0) {
      return;
    }

    this._queueTween(
      timeline,
      srcPath,
      animation.duration,
      { attr: attrTargets },
      animationStartTime,
      'power2.out'
    );
  }

  private static _applyVisibility(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    targetElement: Element
  ): void {
    timeline.set(targetElement as unknown as gsap.TweenTarget, (animation.properties ?? {}) as gsap.TweenVars, animationStartTime);
  }

  private static _applySquish(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    targetElement: Element
  ): void {
    this._queueTween(timeline, targetElement, animation.duration, animation.properties ?? {}, animationStartTime, 'power4.out');
  }

  private static _applyReverseSquish(
    timeline: gsap.core.Timeline,
    animation: AnimationInstruction,
    animationStartTime: number,
    targetElement: Element
  ): void {
    const toProps = { ...(animation.properties ?? {}) };
    const fromProps = {
      scaleY: 0,
      transformOrigin: (toProps as { transformOrigin?: string }).transformOrigin || '50% 50%',
      opacity: 1
    };

    this._queueFromToTween(
      timeline,
      targetElement,
      fromProps,
      {
        duration: animation.duration,
        ease: 'power4.out',
        ...toProps
      },
      animationStartTime
    );
  }

  private static _queueTween(
    timeline: gsap.core.Timeline,
    element: Element,
    duration: number,
    properties: Record<string, unknown>,
    animationStartTime: number,
    ease: string
  ): void {
    timeline.to(
      element as unknown as gsap.TweenTarget,
      {
        duration,
        ease,
        ...properties
      } as gsap.TweenVars,
      animationStartTime
    );
  }

  private static _queueFromToTween(
    timeline: gsap.core.Timeline,
    element: Element,
    fromProps: Record<string, unknown>,
    toProps: gsap.TweenVars,
    animationStartTime: number
  ): void {
    timeline.fromTo(
      element as unknown as gsap.TweenTarget,
      fromProps as gsap.TweenVars,
      toProps,
      animationStartTime
    );
  }

  private static _buildTextAttributeTargets(
    context: MorphAnimationContext,
    matchedTargetId: string | undefined,
    preserveMaskFill: boolean
  ): Record<string, string> {
    if (!matchedTargetId) {
      return {};
    }

    const attrTargets: Record<string, string> = {};
    const dstClone = context.targetCloneElementsById?.get(matchedTargetId);
    const dstText = dstClone ? this._findTextElementInClone(dstClone, matchedTargetId) : null;

    if (!dstText) {
      throw new Error(`Morph target text missing for ${matchedTargetId}`);
    }

    const attributes = preserveMaskFill
      ? ['font-size', 'font-family', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'x', 'y']
      : ['font-size', 'font-family', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'fill', 'x', 'y'];

    for (const name of attributes) {
      const value = dstText.getAttribute(name);
      if (value === null) {
        continue;
      }

      if (name === 'fill' && preserveMaskFill) {
        continue;
      }

      attrTargets[name] = this._maybeRoundTextAttribute(name, value);
    }

    return attrTargets;
  }

  private static _buildShapeAttributeTargets(
    context: MorphAnimationContext,
    matchedTargetId: string | undefined
  ): Record<string, string> {
    if (!matchedTargetId) {
      return {};
    }

    const attrTargets: Record<string, string> = {};
    const dstClone = context.targetCloneElementsById?.get(matchedTargetId);
    const dstPath = dstClone ? this._findPathElementInClone(dstClone, matchedTargetId) : null;

    if (dstPath) {
      const fill = dstPath.getAttribute('fill');
      const stroke = dstPath.getAttribute('stroke');

      if (fill !== null) {
        attrTargets['fill'] = fill;
      }

      if (stroke !== null) {
        attrTargets['stroke'] = stroke;
      }

      return attrTargets;
    }

    const matchedTarget = (context.targetElements || []).find(element => element.id === matchedTargetId) as any;
    if (!matchedTarget || !matchedTarget.props) {
      return attrTargets;
    }

    if (matchedTarget.props.fill) {
      attrTargets['fill'] = String(matchedTarget.props.fill);
    }

    if (matchedTarget.props.stroke) {
      attrTargets['stroke'] = String(matchedTarget.props.stroke);
    }

    return attrTargets;
  }


  private static _findPathElementInClone(cloneElement: Element, originalElementId: string): SVGPathElement | null {
    // If the clone itself is a <path>, return it directly
    try {
      const tag = (cloneElement as any).tagName ? String((cloneElement as any).tagName).toLowerCase() : '';
      if (tag === 'path') return cloneElement as unknown as SVGPathElement;
    } catch {}

    const pathId = `${originalElementId}__shape`;
    let pathElement = cloneElement.querySelector(`#${pathId}`) as SVGPathElement;
    if (!pathElement) {
      pathElement = cloneElement.querySelector('path') as SVGPathElement;
    }
    return pathElement;
  }

  private static _findTextElementInClone(cloneElement: Element, originalElementId: string): SVGTextElement | null {
    // If the clone itself is a <text>, return it directly
    try {
      const tag = (cloneElement as any).tagName ? String((cloneElement as any).tagName).toLowerCase() : '';
      if (tag === 'text') return cloneElement as unknown as SVGTextElement;
    } catch {}

    const maskText = cloneElement.querySelector(`[id="${originalElementId}__mask_text"]`) as SVGTextElement | null;
    if (maskText) {
      return maskText;
    }

    const namedText = cloneElement.querySelector(`[id="${originalElementId}__text"]`) as SVGTextElement | null;
    if (namedText) {
      return namedText;
    }

    return cloneElement.querySelector('text') as SVGTextElement | null;
  }

  private static _maybeRoundTextAttribute(name: string, value: string): string {
    if (!['x', 'y'].includes(name)) return value;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return numeric.toFixed(3);
  }
}
