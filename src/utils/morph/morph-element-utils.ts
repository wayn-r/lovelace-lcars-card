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

  static getTextContent(element: LayoutElement): string {
    if (!this.elementIsText(element)) return '';
    const textValue = (element as any).props?.text;
    return typeof textValue === 'string' ? textValue.trim() : '';
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
    const srcTexts = sourceElements.filter(el => ElementTypeUtils.elementIsText(el));
    const dstTexts = destinationElements.filter(el => ElementTypeUtils.elementIsText(el));
    const tolerance = 100;

    if (srcTexts.length === 0 || dstTexts.length === 0) return matchedPairs;

    const dstByContent = new Map<string, LayoutElement[]>(
      Array.from(new Set(dstTexts.map(el => {
        const transform = ElementTypeUtils.getTextTransform(el);
        return ElementTypeUtils.applyTextTransform(ElementTypeUtils.getTextContent(el), transform);
      }))).map(text => [
        text,
        dstTexts.filter(el => {
          const transform = ElementTypeUtils.getTextTransform(el);
          return ElementTypeUtils.applyTextTransform(ElementTypeUtils.getTextContent(el), transform) === text;
        })
      ])
    );

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
        if (dx > tolerance || dy > tolerance) continue;
        const cost = GeometryUtils.calculateMatchCost(src, dst);
        if (!best || cost < best.cost) best = { id: dst.id, cost, dx, dy };
      }
      if (best) matchedPairs.set(src.id, best.id);
    }

    return matchedPairs;
  }
}
