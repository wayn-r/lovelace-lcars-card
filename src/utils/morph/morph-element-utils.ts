import type { LayoutElement } from '../../layout/elements/element.js';
import type { Group } from '../../layout/engine.js';
import { DistanceParser } from '../animation.js';
import { ShapeGenerator } from '../shapes.js';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('ElementTypeUtils');

export class ElementTypeUtils {

  static getTextTransform(element: LayoutElement): string {
    return (element as any).props?.textTransform ?? 'none';
  }

  static applyTextTransform(text: string, transform: string): string {
    switch (transform) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'capitalize':
        return text.replace(/\b\w/g, c => c.toUpperCase());
      default:
        return text;
    }
  }

  static getElementTypeName(element: LayoutElement): string {
    return (element as any).constructor?.name || 'Unknown';
  }

  static getElementCategory(element: LayoutElement): 'text' | 'rectangle' | 'endcap' | 'elbow' | 'unknown' {
    const typeName = this.getElementTypeName(element);
    if (typeName.includes('Text')) return 'text';
    if (typeName.includes('Rectangle')) return 'rectangle';
    if (typeName.includes('Endcap')) return 'endcap';
    if (typeName.includes('Elbow')) return 'elbow';
    return 'unknown';
  }

  static elementIsText(element: LayoutElement): boolean {
    return this.getElementCategory(element) === 'text';
  }

  static elementIsRectangle(element: LayoutElement): boolean {
    return this.getElementCategory(element) === 'rectangle';
  }

  static elementIsElbow(element: LayoutElement): boolean {
    return this.getElementCategory(element) === 'elbow';
  }

  static elementUsesCutoutMask(element: LayoutElement): boolean {
    return Boolean((element as any).props?.cutout);
  }

  static elementShouldForceCutoutFade(element: LayoutElement): boolean {
    if (!this.elementUsesCutoutMask(element)) return false;

    const id = String(element.id ?? '').toLowerCase();
    if (!id) return false;

    const forcedSuffixes = ['_label_rect', '_label_pill', '_unit_pill', '_unit_rect'];
    if (forcedSuffixes.some(suffix => id.endsWith(suffix))) {
      return true;
    }

    if (/_button_\d+$/.test(id)) {
      return true;
    }

    return false;
  }

  static getTextContent(element: LayoutElement): string {
    const props: any = (element as any).props || {};

    if (this.elementIsText(element)) {
      const textValue = props?.text;
      return typeof textValue === 'string' ? textValue.trim() : '';
    }

    const shapeText = typeof props?.text === 'string' ? props.text.trim() : '';
    return shapeText;
  }

  static elementHasRenderableText(element: LayoutElement): boolean {
    const props: any = (element as any).props || {};
    const text = this.getTextContent(element);
    return text.length > 0;
  }

  static textsHaveEqualContent(elementA: LayoutElement, elementB: LayoutElement): boolean {
    if (!this.elementIsText(elementA) || !this.elementIsText(elementB)) return false;
    return this.getTextContent(elementA) === this.getTextContent(elementB);
  }

  static textElementHasEqualMappingTarget(
    sourceTextElement: LayoutElement, 
    elementMapping: Map<string, string>, 
    destinationElements: LayoutElement[]
  ): boolean {
    if (!this.elementIsText(sourceTextElement)) return false;
    
    const mappedElementId = elementMapping.get(sourceTextElement.id);
    if (!mappedElementId) return false;
    
    const destinationElement = destinationElements.find(element => element.id === mappedElementId);
    if (!destinationElement) return false;
    
    return this.elementIsText(destinationElement) && 
           this.textsHaveEqualContent(sourceTextElement, destinationElement);
  }

  static elbowsHaveCompatibleOrientation(elbowA: LayoutElement, elbowB: LayoutElement): boolean {
    if (!this.elementIsElbow(elbowA) || !this.elementIsElbow(elbowB)) return true;
    
    const orientationA = (elbowA as any).props?.orientation ?? 'top-left';
    const orientationB = (elbowB as any).props?.orientation ?? 'top-left';
    return orientationA === orientationB;
  }

  static resolveElbowBodyWidth(elbowElement: LayoutElement): number {
    if (!this.elementIsElbow(elbowElement)) return 0;
    
    const rawBodyWidth = (elbowElement as any).props?.bodyWidth ?? 30;
    const layoutWidth = elbowElement.layout?.width ?? 0;
    return Math.max(1, DistanceParser.parse(String(rawBodyWidth), { layout: { width: layoutWidth, height: 0 } }));
  }

  static resolveElbowArmHeight(elbowElement: LayoutElement): number {
    if (!this.elementIsElbow(elbowElement)) return 0;
    
    const rawArmHeight = (elbowElement as any).props?.armHeight ?? 30;
    const layoutHeight = elbowElement.layout?.height ?? 0;
    return Math.max(1, DistanceParser.parse(String(rawArmHeight), { layout: { width: 0, height: layoutHeight } }));
  }

  static generatePathForElement(element: LayoutElement): string {
    const { x, y, width, height } = element.layout;
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const props: any = (element as any).props || {};
    const category = this.getElementCategory(element);


    switch (category) {
      case 'rectangle':
        return props.cornerRadii
          ? ShapeGenerator.generateRectangleCorners(x, y, w, h, props.cornerRadii)
          : ShapeGenerator.generateRectangle(x, y, w, h, (props.rx ?? props.cornerRadius ?? 0));
      
      case 'endcap':
        const direction = (props.direction || 'left') as 'left' | 'right';
        return props.chisel
          ? ShapeGenerator.generateChiselEndcap(w, h, direction, x, y)
          : ShapeGenerator.generateEndcap(w, h, direction, x, y);
      
      case 'elbow':
        const orientation = props.orientation || 'top-left';
        const bodyWidth = this.resolveElbowBodyWidth(element);
        const armHeight = this.resolveElbowArmHeight(element);
        return ShapeGenerator.generateElbow(x, w, bodyWidth, armHeight, h, orientation, y, armHeight);
      
      case 'text':
        // Text approximated as rectangle for morph continuity
        return ShapeGenerator.generateRectangle(x, y, w, h, 0);
      
      default:
        // Fallback: generic rectangle
        return ShapeGenerator.generateRectangle(x, y, w, h, 0);
    }
  }
}

export class GeometryUtils {
  static calculateElementCenter(element: LayoutElement): { x: number; y: number } {
    const centerX = element.layout.x + element.layout.width / 2;
    const centerY = element.layout.y + element.layout.height / 2;
    return { x: centerX, y: centerY };
  }

  static calculateElementArea(element: LayoutElement): number {
    return element.layout.width * element.layout.height;
  }

  static calculateMatchCost(elementA: LayoutElement, elementB: LayoutElement): number {
    const centerA = this.calculateElementCenter(elementA);
    const centerB = this.calculateElementCenter(elementB);
    const deltaX = centerA.x - centerB.x;
    const deltaY = centerA.y - centerB.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    const areaA = this.calculateElementArea(elementA) || 1;
    const areaB = this.calculateElementArea(elementB) || 1;
    const areaRatio = areaA > areaB ? areaA / areaB : areaB / areaA;
    const positionWeight = 20.0;
    const sizeWeight = 1000.0;
    return distanceSquared * positionWeight + Math.pow(Math.log(areaRatio), 2) * sizeWeight;
  }
}

export class ElementAnalyzer {
  private static readonly bandYTolerancePx: number = 12.0;
  private static readonly bandHeightToleranceRatio: number = 0.30;

  static collectLayoutElements(groups: Group[]): LayoutElement[] {
    const list: LayoutElement[] = [];
    groups.forEach(g => g.elements.forEach(e => list.push(e)));
    return list;
  }

  static elementsSameBand(a: LayoutElement, b: LayoutElement): boolean {
    const aMid = a.layout.y + a.layout.height / 2;
    const bMid = b.layout.y + b.layout.height / 2;
    const yClose = Math.abs(aMid - bMid) <= this.bandYTolerancePx;
    const maxH = Math.max(a.layout.height, b.layout.height);
    const heightClose = Math.abs(a.layout.height - b.layout.height) <= Math.max(1, maxH * this.bandHeightToleranceRatio);
    return yClose && heightClose;
  }

  static collectTextsToSuppress(
    sourceElements: LayoutElement[],
    destinationElements: LayoutElement[],
    elementMapping: Map<string, string>
  ): LayoutElement[] {
    const sourceTextElements = sourceElements.filter(element => ElementTypeUtils.elementIsText(element));
    return sourceTextElements.filter(textElement => 
      !ElementTypeUtils.textElementHasEqualMappingTarget(textElement, elementMapping, destinationElements)
    );
  }

  static findMatchingText(
    sourceElements: LayoutElement[],
    destinationElements: LayoutElement[]
  ): Map<string, string> {
    const matchedPairs = new Map<string, string>();
    const srcTexts = sourceElements.filter(el => ElementTypeUtils.elementHasRenderableText(el));
    const dstTexts = destinationElements.filter(el => ElementTypeUtils.elementHasRenderableText(el));
    const tolerance = 100;

    if (srcTexts.length === 0 || dstTexts.length === 0) return matchedPairs;

    const dstByContent = new Map<string, LayoutElement[]>();
    for (const dst of dstTexts) {
      const transform = ElementTypeUtils.getTextTransform(dst);
      const content = ElementTypeUtils.applyTextTransform(ElementTypeUtils.getTextContent(dst), transform);
      if (!content) continue;
      const existing = dstByContent.get(content);
      if (existing) {
        existing.push(dst);
      } else {
        dstByContent.set(content, [dst]);
      }
    }

    for (const src of srcTexts) {
      const srcTransform = ElementTypeUtils.getTextTransform(src);
      const content = ElementTypeUtils.applyTextTransform(ElementTypeUtils.getTextContent(src), srcTransform);
      if (!content) continue;
      const candidates = dstByContent.get(content) || [];
      if (candidates.length === 0) continue;

      let best: { id: string; cost: number; dx: number; dy: number } | undefined;
      for (const dst of candidates) {
        const dx = Math.abs((dst.layout?.x ?? 0) - (src.layout?.x ?? 0));
        const dy = Math.abs((dst.layout?.y ?? 0) - (src.layout?.y ?? 0));

        const enforceTolerance = ElementTypeUtils.elementIsText(src) && ElementTypeUtils.elementIsText(dst);
        if (enforceTolerance && (dx > tolerance || dy > tolerance)) continue;
        const cost = GeometryUtils.calculateMatchCost(src, dst);
        if (!best || cost < best.cost) best = { id: dst.id, cost, dx, dy };
      }
      if (best) matchedPairs.set(src.id, best.id);
    }

    return matchedPairs;
  }

  static findTopHeaderShapeMappings(
    sourceElements: LayoutElement[],
    destinationElements: LayoutElement[],
    matchedTextPairs: Map<string, string>
  ): Map<string, string> {
    const mappings = new Map<string, string>();

    const srcIds = new Set(sourceElements.map(e => e.id));
    const dstIds = new Set(destinationElements.map(e => e.id));

    const srcBaseToDstBase = new Map<string, string>();
    const usedDstBases = new Set<string>();

    if (matchedTextPairs && matchedTextPairs.size > 0) {
      matchedTextPairs.forEach((dstId, srcId) => {
        const srcBase = this._extractTopHeaderBaseFromElementId(srcId);
        const dstBase = this._extractTopHeaderBaseFromElementId(dstId);
        if (srcBase && dstBase) {
          if (this._topHeaderFamilyExists(srcBase, srcIds) && this._topHeaderFamilyExists(dstBase, dstIds)) {
            srcBaseToDstBase.set(srcBase, dstBase);
            usedDstBases.add(dstBase);
          }
        }
      });
    }

    const srcBases = this._collectTopHeaderBases(srcIds);
    const dstBases = this._collectTopHeaderBases(dstIds);

    // Prefer direct base name matches so existing widget instances keep morphing even when text changes.
    srcBases.forEach(base => {
      if (srcBaseToDstBase.has(base)) return;
      if (!dstBases.has(base)) return;
      if (usedDstBases.has(base)) return;
      if (!this._topHeaderFamilyExists(base, srcIds) || !this._topHeaderFamilyExists(base, dstIds)) return;
      srcBaseToDstBase.set(base, base);
      usedDstBases.add(base);
    });

    // As a fallback, pair any remaining unmatched families when there is an unambiguous single choice.
    const remainingSrcBases = Array.from(srcBases).filter(base => !srcBaseToDstBase.has(base) && this._topHeaderFamilyExists(base, srcIds));
    const remainingDstBases = Array.from(dstBases).filter(base => !usedDstBases.has(base) && this._topHeaderFamilyExists(base, dstIds));
    if (remainingSrcBases.length === 1 && remainingDstBases.length === 1) {
      srcBaseToDstBase.set(remainingSrcBases[0], remainingDstBases[0]);
      usedDstBases.add(remainingDstBases[0]);
    }

    if (srcBaseToDstBase.size === 0) return mappings;

    const shapeSuffixes = ['_left_endcap', '_right_endcap', '_header_bar'];

    for (const [srcBase, dstBase] of srcBaseToDstBase.entries()) {
      for (const suffix of shapeSuffixes) {
        const srcShapeId = `${srcBase}${suffix}`;
        const dstShapeId = `${dstBase}${suffix}`;
        if (srcIds.has(srcShapeId) && dstIds.has(dstShapeId)) {
          mappings.set(srcShapeId, dstShapeId);
        }
      }
    }

    return mappings;
  }

  private static _extractTopHeaderBaseFromElementId(elementId: string): string | null {
    if (!elementId) return null;
    if (/(.*)_(left|right)_text$/.test(elementId)) {
      return elementId.replace(/_(left|right)_text$/, '');
    }
    if (/(.*)_(left|right)_endcap$/.test(elementId)) {
      return elementId.replace(/_(left|right)_endcap$/, '');
    }
    if (/_header_bar$/.test(elementId)) {
      return elementId.replace(/_header_bar$/, '');
    }
    return null;
  }

  private static _collectTopHeaderBases(idSet: Set<string>): Set<string> {
    const bases = new Set<string>();
    idSet.forEach(id => {
      const base = this._extractTopHeaderBaseFromElementId(id);
      if (base) bases.add(base);
    });
    return bases;
  }

  private static _topHeaderFamilyExists(baseId: string, idSet: Set<string>): boolean {
    const requiredAny = [
      `${baseId}_left_text`,
      `${baseId}_right_text`
    ];
    const hasAnyText = requiredAny.some(id => idSet.has(id));
    if (!hasAnyText) return false;
    return idSet.has(`${baseId}_left_endcap`) || idSet.has(`${baseId}_right_endcap`) || idSet.has(`${baseId}_header_bar`);
  }
}
