import type { LayoutElement } from '../../layout/elements/element.js';
import type { AnimationContext } from '../animation.js';
import { render, svg } from 'lit';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('MorphUtilities');

export interface SvgRootLocator {
  locateSvgRoot(elements: LayoutElement[], getShadowElement: (id: string) => Element | null): SVGSVGElement | null;
}

export interface OverlayManager {
  createOverlayWithClones(
    svgRoot: SVGSVGElement,
    sourceElements: LayoutElement[],
    getShadowElement: (id: string) => Element | null,
    animationContext?: AnimationContext
  ): {
    overlay: SVGGElement;
    cloneElementsById: Map<string, Element>;
    hiddenOriginalElements: Element[];
  };
  scheduleOverlayCleanup(overlay: SVGGElement, hiddenElements: Element[], delaySeconds: number): void;
}

export interface SyntheticElementCreator {
  createSyntheticElement(
    targetElement: LayoutElement,
    animationContext: AnimationContext | undefined,
    options?: CloneRenderOptions
  ): Element | null;
}

interface CloneRenderOptions {
  initialOpacity?: number;
  initialVisibility?: 'visible' | 'hidden';
  initialDisplay?: string;
  idSuffix?: string;
}

export class MorphUtilities implements SvgRootLocator, OverlayManager, SyntheticElementCreator {
  private static readonly OVERLAY_ID = 'lcars-morph-overlay';

  locateSvgRoot(elements: LayoutElement[], getShadowElement: (id: string) => Element | null): SVGSVGElement | null {
    return elements
      .map(element => this._getShadowSvgRoot(getShadowElement, element.id))
      .find((svgElement): svgElement is SVGSVGElement => Boolean(svgElement)) ?? null;
  }

  createOverlayWithClones(
    svgRoot: SVGSVGElement,
    sourceElements: LayoutElement[],
    getShadowElement: (id: string) => Element | null,
    animationContext?: AnimationContext
  ): {
    overlay: SVGGElement;
    cloneElementsById: Map<string, Element>;
    hiddenOriginalElements: Element[];
  } {
    const overlay = this._prepareOverlay(svgRoot);
    const debug = this._debugEnabled();
    const { clonesById, hiddenElements } = sourceElements.reduce(
      (accumulator, element) => this._cloneElementForOverlay(
        {
          element,
          overlay,
          getShadowElement,
          animationContext,
          debug
        },
        accumulator
      ),
      { clonesById: new Map<string, Element>(), hiddenElements: [] as Element[] }
    );

    return { overlay, cloneElementsById: clonesById, hiddenOriginalElements: hiddenElements };
  }

  scheduleOverlayCleanup(overlay: SVGGElement, hiddenElements: Element[], delaySeconds: number): void {
    let hasCleaned = false;
    let detachListeners: () => void = () => {};
    const cleanupOverlay = () => {
      if (hasCleaned) return;
      hasCleaned = true;
      detachListeners();
      this._restoreHiddenElements(hiddenElements);
      this._removeElement(overlay);
    };

    detachListeners = this._attachCleanupListeners(cleanupOverlay);

    setTimeout(() => cleanupOverlay(), delaySeconds * 1000 + 550);
  }

  createSyntheticElement(
    targetElement: LayoutElement,
    animationContext: AnimationContext | undefined,
    options: CloneRenderOptions = {}
  ): Element | null {
    const debug = this._debugEnabled();
    const { initialOpacity = 0, initialVisibility, initialDisplay, idSuffix } = options;
    
    try {
      const renderedTemplate = targetElement.render();
      if (!renderedTemplate) {
        if (debug) {
          logger.warn('[Morph Debug] target synthetic: FAILED (no template)', { id: targetElement.id });
        }
        return null;
      }

      const domElement = this._convertSvgTemplateToDom(renderedTemplate);
      if (!domElement) {
        if (debug) {
          logger.warn('[Morph Debug] target synthetic: FAILED (template conversion)', { id: targetElement.id });
        }
        return null;
      }

      this._applyInitialCloneStyles(domElement, { initialOpacity, initialVisibility, initialDisplay });
      this._applyCloneIdSuffix(domElement, targetElement, idSuffix);

      // Fix any internal definition IDs to avoid collisions
      const definitionSuffix = idSuffix ?? '__morph_clone';
      this._rewriteCloneDefinitionReferences(domElement, definitionSuffix);
      
      return domElement;
    } catch (error) {
      if (debug) {
        logger.warn('[Morph Debug] target synthetic: FAILED (exception)', { id: targetElement.id, error });
      }
      return null;
    }
  }

  private _convertSvgTemplateToDom(template: any): Element | null {
    try {
      const container = document.createElement('div');
      const wrapped = svg`<svg xmlns="http://www.w3.org/2000/svg">${template}</svg>`;
      render(wrapped, container);
      const svgEl = container.firstElementChild as SVGSVGElement | null;
      if (!svgEl) return null;
      const root = svgEl.firstElementChild as Element | null;
      return root || null;
    } catch {
      return null;
    }
  }

  private _rewriteCloneDefinitionReferences(cloneRoot: Element, definitionSuffix: string): void {
    try {
      const isDefElement = (el: Element): boolean => {
        const tag = (el.tagName || '').toLowerCase();
        return tag === 'mask' || tag === 'clippath' || tag === 'filter' || tag === 'pattern' || tag === 'lineargradient' || tag === 'radialgradient' || tag === 'marker';
      };

      const defElements = Array.from(cloneRoot.querySelectorAll('*[id]')).filter(isDefElement) as Element[];
      if (defElements.length === 0) return;

      const idMap = new Map<string, string>();
      defElements.forEach(el => {
        const oldId = el.getAttribute('id');
        if (!oldId) return;
        const newId = `${oldId}${definitionSuffix}`;
        el.setAttribute('id', newId);
        idMap.set(oldId, newId);
      });

      if (idMap.size === 0) return;

      const attributesToFix = ['mask', 'clip-path', 'filter', 'fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end'];
      const allElements = Array.from(cloneRoot.querySelectorAll('*')) as Element[];
      allElements.forEach(el => {
        attributesToFix.forEach(attr => {
          const value = el.getAttribute(attr);
          if (!value) return;
          idMap.forEach((newId, oldId) => {
            const token = `url(#${oldId})`;
            if (value.includes(token)) {
              el.setAttribute(attr, value.split(token).join(`url(#${newId})`));
            }
          });
        });
        const hrefAttr = (el.getAttribute('href') || el.getAttribute('xlink:href'));
        if (hrefAttr && hrefAttr.startsWith('#')) {
          const oldId = hrefAttr.slice(1);
          const newId = idMap.get(oldId);
          if (newId) {
            if (el.hasAttribute('href')) el.setAttribute('href', `#${newId}`);
            if (el.hasAttribute('xlink:href')) el.setAttribute('xlink:href', `#${newId}`);
          }
        }
      });
    } catch {
    }
  }

  private _debugEnabled(): boolean {
    return typeof window !== 'undefined' && (window as any).__lcarsDebugMorph === true;
  }

  private _getShadowSvgRoot(
    getShadowElement: (id: string) => Element | null,
    elementId: string
  ): SVGSVGElement | null {
    const domElement = getShadowElement?.(elementId) as (Element & {
      ownerSVGElement?: SVGSVGElement;
      closest?: (selector: string) => Element | null;
      tagName?: string;
    }) | null;

    if (!domElement) return null;

    const ownerSvg = (domElement as any).ownerSVGElement as SVGSVGElement | null | undefined;
    if (ownerSvg) return ownerSvg;

    const tagName = domElement.tagName ? String(domElement.tagName).toLowerCase() : '';
    if (tagName === 'svg') {
      return domElement as unknown as SVGSVGElement;
    }

    if (typeof domElement.closest === 'function') {
      const closestSvg = domElement.closest('svg');
      if (closestSvg) {
        return closestSvg as SVGSVGElement;
      }
    }

    return null;
  }

  private _prepareOverlay(svgRoot: SVGSVGElement): SVGGElement {
    this._removeElement(svgRoot.querySelector(`#${MorphUtilities.OVERLAY_ID}`));

    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
    overlay.setAttribute('id', MorphUtilities.OVERLAY_ID);
    overlay.setAttribute('style', 'pointer-events: none;');
    svgRoot.appendChild(overlay);
    return overlay;
  }

  private _cloneElementForOverlay(
    params: {
      element: LayoutElement;
      overlay: SVGGElement;
      getShadowElement: (id: string) => Element | null;
      animationContext?: AnimationContext;
      debug: boolean;
    },
    accumulator: { clonesById: Map<string, Element>; hiddenElements: Element[] }
  ): { clonesById: Map<string, Element>; hiddenElements: Element[] } {
    const { element, overlay, getShadowElement, animationContext, debug } = params;
    const originalDomElement = getShadowElement?.(element.id) as Element | null;
    if (!originalDomElement) {
      this._suppressInteractionState(element);
      return accumulator;
    }

    const renderedClone = this.createSyntheticElement(element, animationContext, {
      initialOpacity: 1,
      idSuffix: '__morph_source'
    });

    if (!renderedClone) {
      if (debug) {
        logger.warn('[Morph Debug] source synthetic: FAILED (render)', { id: element.id });
      }
      this._suppressInteractionState(element);
      return accumulator;
    }

    overlay.appendChild(renderedClone);
    accumulator.clonesById.set(element.id, renderedClone);

    if (this._applyHiddenState(originalDomElement, true)) {
      accumulator.hiddenElements.push(originalDomElement);
    } else {
      logger.warn('failed to hide original element ', element.id);
    }

    this._suppressInteractionState(element);
    return accumulator;
  }

  private _suppressInteractionState(element: LayoutElement): void {
    try {
      (element as any).elementIsHovering = false;
    } catch {}
    try {
      (element as any).elementIsActive = false;
    } catch {}
  }

  private _applyHiddenState(target: Element | null, hidden: boolean): boolean {
    if (!target) return false;
    try {
      if (hidden) {
        target.setAttribute('data-lcars-morph-hidden', '1');
      } else {
        target.removeAttribute('data-lcars-morph-hidden');
      }

      const targetWithStyle = target as Element & { style?: CSSStyleDeclaration };
      if (targetWithStyle.style) {
        targetWithStyle.style.visibility = hidden ? 'hidden' : '';
      }

      return true;
    } catch {
      return false;
    }
  }

  private _restoreHiddenElements(hiddenElements: Element[]): void {
    hiddenElements.forEach(element => this._applyHiddenState(element, false));
  }

  private _removeElement(element: Element | null): void {
    if (!element) return;
    try {
      const parent = element.parentNode;
      if (parent) {
        parent.removeChild(element);
      }
    } catch {}
  }

  private _attachCleanupListeners(cleanupOverlay: () => void): () => void {
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && (document as any).hidden) {
        cleanupOverlay();
      }
    };

    const onPageHide = () => cleanupOverlay();

    if (typeof document !== 'undefined') {
      try {
        document.addEventListener('visibilitychange', onVisibilityChange as any, { once: true } as any);
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('pagehide', onPageHide as any, { once: true } as any);
      } catch {}
    }

    return () => {
      if (typeof document !== 'undefined') {
        try {
          document.removeEventListener('visibilitychange', onVisibilityChange as any);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        try {
          window.removeEventListener('pagehide', onPageHide as any);
        } catch {}
      }
    };
  }

  private _applyInitialCloneStyles(
    domElement: Element,
    styles: { initialOpacity?: number; initialVisibility?: 'visible' | 'hidden'; initialDisplay?: string }
  ): void {
    const { initialOpacity, initialVisibility, initialDisplay } = styles;
    try {
      const elementWithStyle = domElement as Element & { style?: CSSStyleDeclaration };
      if (!elementWithStyle.style) return;

      elementWithStyle.style.pointerEvents = 'none';
      if (initialOpacity !== undefined) {
        elementWithStyle.style.opacity = String(initialOpacity);
      }
      if (initialVisibility) {
        elementWithStyle.style.visibility = initialVisibility;
      }
      if (initialDisplay !== undefined) {
        elementWithStyle.style.display = initialDisplay;
      }
    } catch {}
  }

  private _applyCloneIdSuffix(domElement: Element, targetElement: LayoutElement, idSuffix?: string): void {
    if (!idSuffix) return;
    try {
      const existingId = domElement.getAttribute('id');
      const newId = existingId ? `${existingId}${idSuffix}` : `${targetElement.id}${idSuffix}`;
      domElement.setAttribute('id', newId);
    } catch {}
  }

}

export class TimeUtils {
  static getCurrentTime(): number {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  static async waitForNextAnimationFrame(): Promise<void> {
    return new Promise<void>(resolve => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16);
      }
    });
  }

  static async waitFor(durationSeconds: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, durationSeconds * 1000)));
  }
}

export class ValidationUtils {
  static elementLayoutIsCalculated(element: LayoutElement): boolean {
    return Boolean((element as any).layout?.calculated);
  }

  static groupHasValidElements(group: import('../../layout/engine.js').Group): boolean {
    return group.elements.length > 0 && 
           group.elements.some(element => this.elementLayoutIsCalculated(element));
  }

  static containerRectIsValid(rect: DOMRect | undefined): rect is DOMRect {
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  }
}
