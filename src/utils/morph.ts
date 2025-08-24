import yaml from 'js-yaml';
import type { LcarsCardConfig } from '../types.js';
import { ConfigParser } from '../layout/parser.js';
import { Group, LayoutEngine } from '../layout/engine.js';
import type { LayoutElement } from '../layout/elements/element.js';
import type { AnimationContext, AnimationManager } from './animation.js';
import { Diagnostics } from './diagnostics.js';
import gsap from 'gsap';
import Animate1Raw from '../../yaml-animate/animate-1.yaml?raw';
import Animate2Raw from '../../yaml-animate/animate-2.yaml?raw';
import { OffsetCalculator } from './offset-calculator.js';
import { ShapeGenerator } from './shapes.js';

const logger = Diagnostics.create('MorphEngine');

export interface MorphOptions {
  durationMs?: number;
}

export interface MorphRuntimeHooks {
  getShadowElement: (id: string) => Element | null;
  requestUpdate: () => void;
  setCalculatedHeight?: (height: number) => void;
  getContainerRect: () => DOMRect | undefined;
  getCurrentGroups: () => Group[];
  getAnimationManager: () => AnimationManager;
  getAnimationContext: () => AnimationContext;
}

 

type WidgetCluster = {
  baseId: string;
  elements: LayoutElement[];
  bounds: { x: number; y: number; width: number; height: number };
  signature: string;
};


export class MorphEngine {
  // Tunable weights for similarity scoring. Higher POSITION_WEIGHT emphasizes spatial proximity
  // over size similarity. SIZE_WEIGHT controls the penalty for size differences via log-ratio.
  private static readonly POSITION_WEIGHT: number = 20.0;
  private static readonly SIZE_WEIGHT: number = 1000.0;
  static async morphToNavigationPath(
    host: MorphRuntimeHooks,
    navigationPath: string,
    hass?: import('custom-card-helpers').HomeAssistant,
    options: MorphOptions = {}
  ): Promise<void> {
    const url = this._deriveYamlUrlFromNavigationPath(navigationPath);
    if (!url) {
      logger.warn(`Could not derive YAML URL from navigation path: ${navigationPath}`);
      return;
    }
    const config = await this._loadYamlConfigFromUrl(url);
    await this.morphToConfig(host, config, hass, options);
  }

  static async morphToConfig(
    host: MorphRuntimeHooks,
    toConfig: LcarsCardConfig,
    hass?: import('custom-card-helpers').HomeAssistant,
    options: MorphOptions = {}
  ): Promise<void> {
    const durationMs = options.durationMs ?? 1000;
    const durationSec = Math.max(0.01, durationMs / 1000);

    const fromGroups = host.getCurrentGroups();
    if (!fromGroups || fromGroups.length === 0) {
      logger.warn('No source groups to morph from.');
      return;
    }

    const getShadowElement = host.getShadowElement;
    const requestUpdateCallback = host.requestUpdate;

    const toGroups: Group[] = ConfigParser.parseConfig(
      toConfig,
      hass,
      requestUpdateCallback,
      getShadowElement as any,
      undefined as any
    );

    const tempEngine = new LayoutEngine();
    tempEngine.setGroups(toGroups);

    const containerRect = host.getContainerRect();
    if (!containerRect) {
      logger.warn('No container rect available; skipping morph.');
      return;
    }
    const toBounds = tempEngine.recalculate(containerRect, { dynamicHeight: true });
    const fromBounds = (() => {
      const e = new LayoutEngine();
      e.setGroups(fromGroups);
      return e.recalculate(containerRect, { dynamicHeight: true });
    })();

    const maxHeight = Math.max(fromBounds.height, toBounds.height);
    if (host.setCalculatedHeight && maxHeight > containerRect.height) {
      try {
        host.setCalculatedHeight(maxHeight);
        requestUpdateCallback();
      } catch (e) {}
    }

    const fromElements = this._collectLayoutElements(fromGroups).filter(e => e.layout?.calculated);
    const toElements = this._collectLayoutElements(toGroups).filter(e => e.layout?.calculated);

    const fromClusters = this._buildWidgetClusters(fromElements);
    const toClusters = this._buildWidgetClusters(toElements);

    const fromBySig = new Map<string, WidgetCluster[]>();
    const toBySig = new Map<string, WidgetCluster[]>();
    for (const c of fromClusters) {
      const arr = fromBySig.get(c.signature) || [];
      arr.push(c);
      fromBySig.set(c.signature, arr);
    }
    for (const c of toClusters) {
      const arr = toBySig.get(c.signature) || [];
      arr.push(c);
      toBySig.set(c.signature, arr);
    }

    const mapping = new Map<string, string>();
    const usedTargets = new Set<string>();

    for (const [sig, fromList] of fromBySig.entries()) {
      const candidates = (toBySig.get(sig) || []).slice();
      if (fromList.length === 0 || candidates.length === 0) continue;

      fromList.sort((a, b) => this._calculateClusterArea(b) - this._calculateClusterArea(a));
      candidates.sort((a, b) => this._calculateClusterArea(b) - this._calculateClusterArea(a));

      const taken = new Set<string>();
      for (const fa of fromList) {
        let best: WidgetCluster | undefined;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const tb of candidates) {
          if (taken.has(tb.baseId)) continue;
          const c = this._calculateClusterMatchCost(fa, tb);
          if (c < bestCost) {
            best = tb;
            bestCost = c;
          }
        }
        if (!best) continue;

        const localFrom = fa.elements;
        const localTo = best.elements;
        const localMap = this._computeGreedyTypeMatching(localFrom, localTo);
        for (const [fromId, toId] of localMap.entries()) {
          if (usedTargets.has(toId)) continue;
          mapping.set(fromId, toId);
          usedTargets.add(toId);
        }
        taken.add(best.baseId);
      }
    }

    const matchedFromIds = new Set<string>(Array.from(mapping.keys()));
    const remainingFrom = fromElements.filter(e => !matchedFromIds.has(e.id));
    const remainingTo = toElements.filter(e => !usedTargets.has(e.id));
    const globalMap = this._computeGreedyTypeMatching(remainingFrom, remainingTo);
    for (const [fromId, toId] of globalMap.entries()) {
      if (usedTargets.has(toId)) continue;
      mapping.set(fromId, toId);
      usedTargets.add(toId);
    }

    const svgRoot = this._getSvgRoot(fromElements, getShadowElement);

    if (svgRoot) {
      const overlayId = 'lcars-morph-overlay';
      let overlay = svgRoot.querySelector(`#${overlayId}`) as SVGGElement | null;
      if (overlay) {
        try { overlay.remove(); } catch {}
      }
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlay.setAttribute('id', overlayId);
      overlay.setAttribute('style', 'pointer-events: none;');
      svgRoot.appendChild(overlay);

      const createdClones: Element[] = [];
      const hiddenOriginals: Element[] = [];

      for (const [fromId, toId] of mapping.entries()) {
        const fromEl = fromElements.find(e => e.id === fromId)!;
        const toEl = toElements.find(e => e.id === toId)!;
        const domFrom = getShadowElement?.(fromId) as Element | null;
        if (!domFrom) continue;

        const clone = domFrom.cloneNode(true) as Element;
        try { (clone as any).style.visibility = ''; } catch {}
        try { clone.removeAttribute('visibility'); } catch {}
        try { (clone as any).id = `${fromId}__morph_clone`; } catch {}
        overlay.appendChild(clone);
        createdClones.push(clone);

        try {
          (domFrom as any).setAttribute('data-lcars-morph-hidden', '1');
          (domFrom as any).style.visibility = 'hidden';
          hiddenOriginals.push(domFrom);
        } catch {}

        const fx = fromEl.layout.x;
        const fy = fromEl.layout.y;
        const fw = Math.max(1, fromEl.layout.width);
        const fh = Math.max(1, fromEl.layout.height);
        const tx = toEl.layout.x;
        const ty = toEl.layout.y;
        const tw = Math.max(1, toEl.layout.width);
        const th = Math.max(1, toEl.layout.height);

        const bothElbows = this._elementIsElbow(fromEl) && this._elementIsElbow(toEl) && this._elbowsHaveCompatibleOrientation(fromEl, toEl);
        if (bothElbows) {
          this._animateElbowMorph(clone, fromEl, toEl, durationSec);
        } else {
          const deltaX = tx - fx;
          const deltaY = ty - fy;
          const scaleX = tw / fw;
          const scaleY = th / fh;
          gsap.set(clone as any, { x: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: '0px 0px' } as any);
          gsap.to(clone as any, { duration: durationSec, ease: 'power2.out', x: deltaX, y: deltaY, scaleX, scaleY, transformOrigin: '0px 0px' } as any);
        }
      }

      const matchedFromIds2 = new Set<string>(Array.from(mapping.keys()));
      for (const el of fromElements) {
        if (!matchedFromIds2.has(el.id)) {
          const domFrom = getShadowElement?.(el.id) as Element | null;
          if (!domFrom) continue;
          const clone = domFrom.cloneNode(true) as Element;
          try { (clone as any).style.visibility = ''; } catch {}
          try { clone.removeAttribute('visibility'); } catch {}
          try { (clone as any).id = `${el.id}__morph_clone`; } catch {}
          overlay.appendChild(clone);
          createdClones.push(clone);
          gsap.set(clone as any, { opacity: 1 } as any);
          gsap.to(clone as any, { duration: durationSec, ease: 'power2.out', opacity: 0 } as any);

          try {
            (domFrom as any).setAttribute('data-lcars-morph-hidden', '1');
            (domFrom as any).style.visibility = 'hidden';
            hiddenOriginals.push(domFrom);
          } catch {}
        }
      }

      const removeOverlay = () => {
        try { document.removeEventListener('visibilitychange', onVis); } catch {}
        try { window.removeEventListener('pagehide', onPH as any); } catch {}
        for (const orig of hiddenOriginals) {
          try { (orig as any).style.visibility = '';
            (orig as any).removeAttribute('data-lcars-morph-hidden'); } catch {}
        }
        if (overlay && overlay.parentNode) {
          try { overlay.parentNode.removeChild(overlay); } catch {}
        }
      };
      const onVis = () => { if (document.hidden) removeOverlay(); };
      const onPH = () => removeOverlay();
      document.addEventListener('visibilitychange', onVis, { once: true } as any);
      window.addEventListener('pagehide', onPH as any, { once: true } as any);

      await new Promise<void>((resolve) => setTimeout(resolve, durationMs + 50));
      setTimeout(removeOverlay, 500);
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, durationMs + 50));
  }

  
  private static _deriveYamlUrlFromNavigationPath(path: string): string | null {
    const match = path.match(/\/lcars-new\/(.+)$/);
    if (!match) return null;
    const name = match[1];
    return `/yaml-animate/${name}.yaml`;
  }

  private static async _loadYamlConfigFromUrl(url: string): Promise<LcarsCardConfig> {
    const devOrigin = (() => {
      try {
        return new URL(import.meta.url).origin;
      } catch {
        return window.location.origin;
      }
    })();

    const candidates = [
      new URL(url, devOrigin).toString(),
      new URL(url, window.location.origin).toString(),
    ];

    for (const absoluteUrl of candidates) {
      try {
        const resp = await fetch(absoluteUrl, { credentials: 'omit' });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const text = await resp.text();
        const obj = yaml.load(text) as any;
        return obj as LcarsCardConfig;
      } catch (e) {}
    }

    const lowered = url.toLowerCase();
    let embeddedRaw: string | undefined;
    if (lowered.includes('animate-1')) embeddedRaw = Animate1Raw;
    if (lowered.includes('animate-2')) embeddedRaw = Animate2Raw;
    if (embeddedRaw) {
      logger.info(`Using embedded YAML fallback for ${url}`);
      const obj = yaml.load(embeddedRaw) as any;
      return obj as LcarsCardConfig;
    }
    throw new Error(`Unable to load YAML from ${url}`);
  }

  private static _collectLayoutElements(groups: Group[]): LayoutElement[] {
    const list: LayoutElement[] = [];
    groups.forEach(g => g.elements.forEach(e => list.push(e)));
    return list;
  }

  private static _getElementCenter(el: LayoutElement): { cx: number; cy: number } {
    const { x, y, width, height } = el.layout;
    return { cx: x + width / 2, cy: y + height / 2 };
    }

  private static _calculateElementArea(el: LayoutElement): number {
    return el.layout.width * el.layout.height;
  }

  private static _getElementTypeKey(el: LayoutElement): string {
    return (el as any).constructor?.name || 'Unknown';
  }

  private static _calculateRectUnion(bounds: { x: number; y: number; width: number; height: number }[], fallback?: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
    if (bounds.length === 0) return fallback || { x: 0, y: 0, width: 0, height: 0 };
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const b of bounds) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  private static _createClusterSignature(elements: LayoutElement[]): string {
    const types = new Set<string>();
    for (const el of elements) {
      const tk = this._getElementTypeKey(el);
      if (tk === 'TextElement') continue;
      types.add(tk);
    }
    return Array.from(types.values()).sort().join('|');
  }

  private static _buildWidgetClusters(elements: LayoutElement[]): WidgetCluster[] {
    const byId = new Map<string, LayoutElement>();
    for (const el of elements) byId.set(el.id, el);

    const childrenByBase = new Map<string, LayoutElement[]>();
    for (const el of elements) {
      const id = el.id;
      const underscoreIndex = id.indexOf('_');
      if (underscoreIndex <= 0) continue;
      const candidateBase = id.substring(0, underscoreIndex);
      if (byId.has(candidateBase)) {
        const arr = childrenByBase.get(candidateBase) || [];
        arr.push(el);
        childrenByBase.set(candidateBase, arr);
        continue;
      }
      const parts = id.split('_');
      for (let i = parts.length - 1; i >= 1; i--) {
        const base = parts.slice(0, i).join('_');
        if (byId.has(base)) {
          const arr = childrenByBase.get(base) || [];
          arr.push(el);
          childrenByBase.set(base, arr);
          break;
        }
      }
    }

    const clusters: WidgetCluster[] = [];
    for (const [baseId, children] of childrenByBase.entries()) {
      const baseEl = byId.get(baseId);
      if (!baseEl) continue;
      const els = [baseEl, ...children];
      const bounds = this._calculateRectUnion(els.map(e => e.layout), baseEl.layout);
      const signature = this._createClusterSignature(els);
      clusters.push({ baseId, elements: els, bounds, signature });
    }

    return clusters;
  }

  private static _getClusterCenter(c: WidgetCluster): { cx: number; cy: number } {
    return { cx: c.bounds.x + c.bounds.width / 2, cy: c.bounds.y + c.bounds.height / 2 };
  }

  private static _calculateClusterArea(c: WidgetCluster): number {
    return Math.max(1, c.bounds.width * c.bounds.height);
  }

  private static _calculateClusterMatchCost(a: WidgetCluster, b: WidgetCluster): number {
    const ca = this._getClusterCenter(a);
    const cb = this._getClusterCenter(b);
    const dx = ca.cx - cb.cx;
    const dy = ca.cy - cb.cy;
    const dist2 = dx * dx + dy * dy;
    const areaA = this._calculateClusterArea(a);
    const areaB = this._calculateClusterArea(b);
    const areaRatio = areaA > areaB ? areaA / areaB : areaB / areaA;
    return dist2 * this.POSITION_WEIGHT + Math.pow(Math.log(areaRatio), 2) * this.SIZE_WEIGHT;
  }

  private static _calculateElementMatchCost(a: LayoutElement, b: LayoutElement): number {
    const ca = this._getElementCenter(a);
    const cb = this._getElementCenter(b);
    const dx = ca.cx - cb.cx;
    const dy = ca.cy - cb.cy;
    const dist2 = dx * dx + dy * dy;
    const areaA = this._calculateElementArea(a) || 1;
    const areaB = this._calculateElementArea(b) || 1;
    const areaRatio = areaA > areaB ? areaA / areaB : areaB / areaA;
    return dist2 * this.POSITION_WEIGHT + Math.pow(Math.log(areaRatio), 2) * this.SIZE_WEIGHT;
  }

  private static _elbowsHaveCompatibleOrientation(a: LayoutElement, b: LayoutElement): boolean {
    const typeA = this._getElementTypeKey(a);
    const typeB = this._getElementTypeKey(b);
    if (typeA !== 'ElbowElement' || typeB !== 'ElbowElement') return true;
    const orientationA = (a as any).props?.orientation ?? 'top-left';
    const orientationB = (b as any).props?.orientation ?? 'top-left';
    return orientationA === orientationB;
  }

  private static _computeGreedyTypeMatching(fromEls: LayoutElement[], toEls: LayoutElement[]): Map<string, string> {
    const mapping = new Map<string, string>();
    const usedTargets = new Set<string>();

    const fromByType = new Map<string, LayoutElement[]>();
    const toByType = new Map<string, LayoutElement[]>();

    for (const el of fromEls) {
      const tk = this._getElementTypeKey(el);
      const arr = fromByType.get(tk) || [];
      arr.push(el);
      fromByType.set(tk, arr);
    }
    for (const el of toEls) {
      const tk = this._getElementTypeKey(el);
      const arr = toByType.get(tk) || [];
      arr.push(el);
      toByType.set(tk, arr);
    }

    fromByType.forEach(list => list.sort((a, b) => this._calculateElementArea(b) - this._calculateElementArea(a)));

    for (const [tk, fromList] of fromByType.entries()) {
      const candidates = (toByType.get(tk) || []).slice();
      candidates.sort((a, b) => this._calculateElementArea(b) - this._calculateElementArea(a));
      for (const a of fromList) {
        let best: LayoutElement | undefined;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const b of candidates) {
          if (usedTargets.has(b.id)) continue;
          if (!this._elbowsHaveCompatibleOrientation(a, b)) continue;
          const c = this._calculateElementMatchCost(a, b);
          if (c < bestCost) {
            best = b;
            bestCost = c;
          }
        }
        if (best) {
          mapping.set(a.id, best.id);
          usedTargets.add(best.id);
        }
      }
    }

    return mapping;
  }

  private static _getSvgRoot(fromElements: LayoutElement[], getShadowElement: MorphRuntimeHooks['getShadowElement']): SVGSVGElement | null {
    for (const el of fromElements) {
      const domEl = getShadowElement?.(el.id) as (Element & { ownerSVGElement?: SVGSVGElement }) | null;
      const svg = domEl?.ownerSVGElement || null;
      if (svg) return svg;
    }
    return null;
  }

  // Elbow helpers
  private static _elementIsElbow(el: LayoutElement): boolean {
    return this._getElementTypeKey(el) === 'ElbowElement';
  }

  private static _resolveElbowBodyWidth(el: LayoutElement): number {
    const raw = (el as any).props?.bodyWidth ?? 30;
    const base = el.layout?.width ?? 0;
    return Math.max(1, OffsetCalculator.calculateTextOffset(raw, base));
  }

  private static _resolveElbowArmHeight(el: LayoutElement): number {
    const raw = (el as any).props?.armHeight ?? 30;
    const base = el.layout?.height ?? 0;
    return Math.max(1, OffsetCalculator.calculateTextOffset(raw, base));
  }

  private static _animateElbowMorph(clone: Element, fromEl: LayoutElement, toEl: LayoutElement, durationSec: number): void {
    const pathId = `${fromEl.id}__shape`;
    const pathEl = (clone.querySelector(`#${pathId}`) as SVGPathElement) || (clone.querySelector('path') as SVGPathElement | null);
    if (!pathEl) {
      const fx = fromEl.layout.x;
      const fy = fromEl.layout.y;
      const fw = Math.max(1, fromEl.layout.width);
      const fh = Math.max(1, fromEl.layout.height);
      const tx = toEl.layout.x;
      const ty = toEl.layout.y;
      const tw = Math.max(1, toEl.layout.width);
      const th = Math.max(1, toEl.layout.height);
      const deltaX = tx - fx;
      const deltaY = ty - fy;
      const scaleX = tw / fw;
      const scaleY = th / fh;
      gsap.set(clone as any, { x: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: '0px 0px' } as any);
      gsap.to(clone as any, { duration: durationSec, ease: 'power2.out', x: deltaX, y: deltaY, scaleX, scaleY, transformOrigin: '0px 0px' } as any);
      return;
    }

    const orientation = ((fromEl as any).props?.orientation ?? 'top-left') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    const start = {
      x: fromEl.layout.x,
      y: fromEl.layout.y,
      width: Math.max(1, fromEl.layout.width),
      height: Math.max(1, fromEl.layout.height),
      bodyWidth: this._resolveElbowBodyWidth(fromEl),
      armHeight: this._resolveElbowArmHeight(fromEl)
    };
    const end = {
      x: toEl.layout.x,
      y: toEl.layout.y,
      width: Math.max(1, toEl.layout.width),
      height: Math.max(1, toEl.layout.height),
      bodyWidth: this._resolveElbowBodyWidth(toEl),
      armHeight: this._resolveElbowArmHeight(toEl)
    };

    const state: any = { ...start };
    const updatePath = () => {
      const d = ShapeGenerator.generateElbow(state.x, state.width, state.bodyWidth, state.armHeight, state.height, orientation, state.y, state.armHeight);
      try { pathEl.setAttribute('d', d); } catch {}
    };

    updatePath();
    gsap.to(state, {
      duration: durationSec,
      ease: 'power2.out',
      x: end.x,
      y: end.y,
      width: end.width,
      height: end.height,
      bodyWidth: end.bodyWidth,
      armHeight: end.armHeight,
      onUpdate: updatePath
    } as any);
  }
}


