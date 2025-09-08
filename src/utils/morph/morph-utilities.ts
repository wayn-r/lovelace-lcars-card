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
    getShadowElement: (id: string) => Element | null
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
    animationContext: AnimationContext
  ): Element | null;
}

export class MorphUtilities implements SvgRootLocator, OverlayManager, SyntheticElementCreator {
  locateSvgRoot(elements: LayoutElement[], getShadowElement: (id: string) => Element | null): SVGSVGElement | null {
    for (const element of elements) {
      const domElement = getShadowElement?.(element.id) as (Element & { 
        ownerSVGElement?: SVGSVGElement; 
        closest?: (selector: string) => Element | null;
        tagName?: string;
      }) | null;
      
      if (!domElement) continue;
      
      let svgElement = (domElement as any).ownerSVGElement as SVGSVGElement | null;
      
      if (!svgElement) {
        if (domElement.tagName && String(domElement.tagName).toLowerCase() === 'svg') {
          svgElement = domElement as unknown as SVGSVGElement;
        } else if (typeof domElement.closest === 'function') {
          const foundSvg = domElement.closest('svg') as SVGSVGElement | null;
          if (foundSvg) svgElement = foundSvg;
        }
      }
      
      if (svgElement) return svgElement;
    }
    
    return null;
  }

  createOverlayWithClones(
    svgRoot: SVGSVGElement,
    sourceElements: LayoutElement[],
    getShadowElement: (id: string) => Element | null
  ): {
    overlay: SVGGElement;
    cloneElementsById: Map<string, Element>;
    hiddenOriginalElements: Element[];
  } {
    const overlayId = 'lcars-morph-overlay';
    let overlay = svgRoot.querySelector(`#${overlayId}`) as SVGGElement | null;
    
    if (overlay) {
      try { 
        overlay.remove(); 
      } catch {}
    }
    
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
    overlay.setAttribute('id', overlayId);
    overlay.setAttribute('style', 'pointer-events: none;');
    svgRoot.appendChild(overlay);

    const hiddenOriginalElements: Element[] = [];
    const cloneElementsById = new Map<string, Element>();

    const debug = typeof window !== 'undefined' && (window as any).__lcarsDebugMorph === true;
    for (const element of sourceElements) {
      const originalDomElement = getShadowElement?.(element.id) as Element | null;
      if (!originalDomElement) {
        continue;
      }
      
      const clonedElement = originalDomElement.cloneNode(true) as Element;
      
      try { 
        (clonedElement as any).style.visibility = ''; 
      } catch {
      }

      try { 
        clonedElement.removeAttribute('visibility'); 
      } catch {
      }

      try { 
        (clonedElement as any).id = `${element.id}__morph_clone`; 
      } catch {
      }
      
      // Ensure internal defs/masks in the clone have unique IDs and references
      this._rewriteCloneDefinitionReferences(clonedElement);
      overlay.appendChild(clonedElement);
      cloneElementsById.set(element.id, clonedElement);
      
      try {
        (originalDomElement as any).setAttribute('data-lcars-morph-hidden', '1');
        (originalDomElement as any).style.visibility = 'hidden';
        hiddenOriginalElements.push(originalDomElement);

      } catch {
        logger.warn('failed to hide original element ',
          element.id
        )
      }
      
      this._initializeCloneTransform(clonedElement);

      if (debug) {
        let initialOpacity: string | undefined;
        try { initialOpacity = (clonedElement as HTMLElement).style?.opacity ?? getComputedStyle(clonedElement as any).opacity; } catch {}
      }
    }
    
    return { overlay, cloneElementsById, hiddenOriginalElements };
  }

  scheduleOverlayCleanup(overlay: SVGGElement, hiddenElements: Element[], delaySeconds: number): void {
    const cleanupOverlay = () => {
      try { 
        document.removeEventListener('visibilitychange', onVisibilityChange); 
      } catch {}
      try { 
        window.removeEventListener('pagehide', onPageHide as any); 
      } catch {}
      
      for (const hiddenElement of hiddenElements) {
        try { 
          (hiddenElement as any).style.visibility = '';
          (hiddenElement as any).removeAttribute('data-lcars-morph-hidden'); 
        } catch {}
      }
      
      if (overlay && overlay.parentNode) {
        try { 
          overlay.parentNode.removeChild(overlay); 
        } catch {}
      }
    };
    
    const onVisibilityChange = () => { 
      if (typeof document !== 'undefined' && (document as any).hidden) cleanupOverlay(); 
    };
    const onPageHide = () => cleanupOverlay();
    
    try { 
      document.addEventListener('visibilitychange', onVisibilityChange as any, { once: true } as any); 
    } catch {}
    try { 
      window.addEventListener('pagehide', onPageHide as any, { once: true } as any); 
    } catch {}

    setTimeout(() => cleanupOverlay(), delaySeconds * 1000 + 550);
  }

  createSyntheticElement(
    targetElement: LayoutElement,
    animationContext: AnimationContext
  ): Element | null {
    const debug = typeof window !== 'undefined' && (window as any).__lcarsDebugMorph === true;
    
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

      try {
        (domElement as any).style.pointerEvents = 'none';
        (domElement as any).style.opacity = '0';
      } catch {}

      // Fix any internal definition IDs to avoid collisions
      this._rewriteCloneDefinitionReferences(domElement);
      
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

  private _initializeCloneTransform(clonedElement: Element): void {
    import('gsap').then(gsap => {
      gsap.default.set(clonedElement as any, { 
        x: 0, 
        y: 0, 
        scaleX: 1, 
        scaleY: 1, 
        opacity: 1, 
        transformOrigin: '0px 0px' 
      } as any);
    });
  }

  private _rewriteCloneDefinitionReferences(cloneRoot: Element): void {
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
        const newId = `${oldId}__morph_clone`;
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

