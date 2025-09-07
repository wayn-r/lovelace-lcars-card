import type { LayoutElement } from '../../layout/elements/element.js';
import gsap from 'gsap';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('AnimationBuilder');

export interface AnimationInstruction {
  targetElementId: string;
  animationType: 'fade' | 'morph' | 'transform' | 'pathMorph' | 'scale' | 'visibility' | 'squish' | 'reverseSquish' | 'textStyle';
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

  addFadeOutAnimation(elementId: string, delay: number = 0): this {
    return this.addAnimation(elementId, 'fade', { opacity: 0 }, undefined, delay);
  }

  addFadeInAnimation(elementId: string, delay: number = 0): this {
    return this.addAnimation(elementId, 'fade', { opacity: 1 }, undefined, delay);
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

  addTextStyleAnimation(elementId: string, matchedTargetId: string, delay: number = 0): this {
    return this.addAnimation(elementId, 'textStyle', {
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
      const preferTarget = phaseBundle.phaseName === 'fadeInTarget';
      const sourceMap = context.sourceCloneElementsById;
      const targetMap = context.targetCloneElementsById;

      let sourceChosen = false;
      let targetElement: Element | undefined;
      if (preferTarget) {
        targetElement = targetMap?.get(animation.targetElementId) || context.cloneElementsById?.get(animation.targetElementId);
        sourceChosen = false;
      } else {
        targetElement = sourceMap?.get(animation.targetElementId) || context.cloneElementsById?.get(animation.targetElementId);
        sourceChosen = true;
      }

      if (!targetElement) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.info('[Morph Debug] element not found for phase', phaseBundle.phaseName, {
            id: animation.targetElementId,
            preferTarget,
            hasSourceMap: Boolean(sourceMap),
            hasTargetMap: Boolean(targetMap)
          });
        }
        continue;
      }

      if (debug) {
        let initialOpacity: string | undefined;
        try { initialOpacity = (targetElement as HTMLElement).style?.opacity ?? getComputedStyle(targetElement as Element as HTMLElement).opacity; } catch {}
        // eslint-disable-next-line no-console
        console.info('[Morph Debug] enqueue', {
          phase: phaseBundle.phaseName,
          type: animation.animationType,
          id: animation.targetElementId,
          map: sourceChosen ? 'source' : (preferTarget ? 'target' : 'combined'),
          duration: animation.duration,
          delay: animation.delay || 0,
          initialOpacity
        });
      }

      const animationStartTime = phaseStartTime + (animation.delay || 0);

      switch (animation.animationType) {
        case 'fade':
        case 'transform':
        case 'scale':
          timeline.to(targetElement as any, {
            duration: animation.duration,
            ease: 'power2.out',
            ...animation.properties
          } as any, animationStartTime);
          break;
        case 'textStyle': {
          const srcText = this._findTextElementInClone(targetElement, animation.targetElementId);
          const matchedTargetId: string | undefined = (animation.properties || {}).matchedTargetId;
          const dstClone = matchedTargetId ? context.targetCloneElementsById?.get(matchedTargetId) : undefined;
          const dstText = matchedTargetId && dstClone ? this._findTextElementInClone(dstClone, matchedTargetId) : null;

          const attrTargets: Record<string, any> = {};
          if (dstText) {
            const attrs = ['font-size','font-family','font-weight','letter-spacing','text-anchor','dominant-baseline','fill'];
            for (const name of attrs) {
              const value = dstText.getAttribute(name);
              if (value !== null) attrTargets[name] = value;
            }
            // Align position exactly by animating x/y to match the destination text
            const xVal = dstText.getAttribute('x');
            const yVal = dstText.getAttribute('y');
            if (xVal !== null) attrTargets['x'] = xVal;
            if (yVal !== null) attrTargets['y'] = yVal;
          } else if (matchedTargetId) {
            try {
              const dst = (context.targetElements || []).find(e => e.id === matchedTargetId) as any;
              if (dst && dst.props) {
                logger.debug('dst attributes', dst.props);
                if (dst.props.fontSize !== undefined) attrTargets['font-size'] = String(dst.props.fontSize) + 'px';
                if (dst.props.fontFamily) attrTargets['font-family'] = String(dst.props.fontFamily);
                if (dst.props.fontWeight !== undefined) attrTargets['font-weight'] = String(dst.props.fontWeight);
                if (dst.props.letterSpacing !== undefined) {
                  const ls = dst.props.letterSpacing;
                  attrTargets['letter-spacing'] = typeof ls === 'number' ? `${ls}px` : String(ls);
                }
                if (dst.props.textAnchor) attrTargets['text-anchor'] = String(dst.props.textAnchor);
                if (dst.props.dominantBaseline) attrTargets['dominant-baseline'] = String(dst.props.dominantBaseline);
                if (dst.props.textColor) attrTargets['fill'] = String(dst.props.textColor);
                // Fallback position approximation using layout box and anchor
                try {
                  const x = (dst.layout?.x ?? 0) + (dst.props.textAnchor === 'end' ? (dst.layout?.width ?? 0) : (dst.props.textAnchor === 'middle' ? (dst.layout?.width ?? 0) / 2 : 0));
                  const y = (dst.layout?.y ?? 0) + ((dst.layout?.height ?? 0) / 2);
                  attrTargets['x'] = String(x);
                  attrTargets['y'] = String(y);
                } catch {}
              }
            } catch {}
          }

          if (srcText && Object.keys(attrTargets).length > 0) {
            timeline.to(srcText as any, {
              duration: animation.duration,
              ease: 'power2.out',
              attr: attrTargets
            } as any, animationStartTime);
          }
          break;
        }
        case 'pathMorph': {
          const pathElement = this._findPathElementInClone(targetElement, animation.targetElementId);
          if (pathElement) {
            timeline.to(pathElement as any, {
              duration: animation.duration,
              ease: 'power2.out',
              ...animation.properties
            } as any, animationStartTime);
          }
          break;
        }
        case 'visibility':
          timeline.set(targetElement as any, animation.properties as any, animationStartTime);
          break;
        case 'squish':
          timeline.to(targetElement as any, {
            duration: animation.duration,
            ease: 'power4.out',
            ...animation.properties
          } as any, animationStartTime);
          break;
        case 'reverseSquish': {
          const toProps = { ...animation.properties } as any;
          const fromProps: any = { scaleY: 0, transformOrigin: toProps.transformOrigin || '50% 50%', opacity: 1 };
          timeline.fromTo(targetElement as any, fromProps, {
            duration: animation.duration,
            ease: 'power4.out',
            ...toProps
          } as any, animationStartTime);
          break;
        }
      }
    }

    return phaseBundle.totalPhaseDuration;
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

    const textId = `${originalElementId}__text`;
    let textEl = cloneElement.querySelector(`#${textId}`) as SVGTextElement;
    if (!textEl) {
      textEl = cloneElement.querySelector('text') as SVGTextElement;
    }
    return textEl;
  }
}


