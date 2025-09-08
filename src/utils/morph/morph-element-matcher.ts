import type { LayoutElement } from '../../layout/elements/element.js';
import type { Group } from '../../layout/engine.js';
import { ElementTypeUtils, GeometryUtils, ElementAnalyzer } from './morph-element-utils.js';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('ElementMatcher');

export interface ElementMatch {
  sourceElementId: string;
  targetElementId: string;
  matchConfidence: number;
}

export interface GroupMatch {
  sourceGroupId: string;
  targetGroupId: string;
  matchConfidence: number;
}

export interface MatchingResult {
  groupMatches: GroupMatch[];
  elementMatches: ElementMatch[];
  unmatchedSourceElementIds: string[];
  unmatchedTargetElementIds: string[];
}

export interface ElementGroup {
  id: string;
  elements: LayoutElement[];
  groupType: 'horizontal' | 'vertical';
  meanCoordinate: number;
  coordinateType: 'x' | 'y';
}

export interface ElementGroupingResult {
  horizontalGroups: ElementGroup[];
  verticalGroups: ElementGroup[];
  ungroupedElements: LayoutElement[];
}

export class ElementMatcher {
  static createElementMappings(sourceGroups: Group[], targetGroups: Group[]): Map<string, string> {
    const mapping = new Map<string, string>();

    const sourceElements = this._flattenElementsFromGroups(sourceGroups);
    const targetElements = this._flattenElementsFromGroups(targetGroups);

    const textPairs = ElementAnalyzer.findMatchingText(sourceElements, targetElements);
    textPairs.forEach((targetId, sourceId) => mapping.set(sourceId, targetId));

    // other type matching will be added

    return mapping;
  }

  private static _flattenElementsFromGroups(groups: Group[]): LayoutElement[] {
    const flattenedElements: LayoutElement[] = [];
    groups.forEach(group => group.elements.forEach(element => flattenedElements.push(element)));
    return flattenedElements;
  }
}

export class ElementGrouper {
  static groupElementsByAlignment(elements: LayoutElement[], tolerance: number = 5): ElementGroupingResult {
    const horizontalGroups: ElementGroup[] = [];
    const verticalGroups: ElementGroup[] = [];
    const ungroupedElements: LayoutElement[] = [];
    
    const groupableElements = this._filterGroupableElements(elements);

    const horizontalGroupMap = this._groupElementsByCoordinate(groupableElements, 'horizontal', tolerance);
    horizontalGroupMap.forEach((groupElements, meanY) => {
      horizontalGroups.push({
        id: `horizontal_${meanY.toFixed(1)}`,
        elements: groupElements,
        groupType: 'horizontal',
        meanCoordinate: meanY,
        coordinateType: 'y'
      });
    });

    const verticalGroupMap = this._groupElementsByCoordinate(groupableElements, 'vertical', tolerance);
    verticalGroupMap.forEach((groupElements, meanX) => {
      verticalGroups.push({
        id: `vertical_${meanX.toFixed(1)}`,
        elements: groupElements,
        groupType: 'vertical',
        meanCoordinate: meanX,
        coordinateType: 'x'
      });
    });

    const groupedElementIds = this._collectGroupedElementIds(horizontalGroups, verticalGroups);
    elements.forEach(element => {
      if (!groupedElementIds.has(element.id)) {
        ungroupedElements.push(element);
      }
    });

    return {
      horizontalGroups,
      verticalGroups,
      ungroupedElements
    };
  }

  private static _filterGroupableElements(elements: LayoutElement[]): LayoutElement[] {
    return elements.filter(element => {
      const category = ElementTypeUtils.getElementCategory(element);
      return category === 'text' || category === 'rectangle' || category === 'endcap' || category === 'elbow';
    });
  }

  private static _collectGroupedElementIds(
    horizontalGroups: ElementGroup[], 
    verticalGroups: ElementGroup[]
  ): Set<string> {
    const groupedElementIds = new Set<string>();
    [...horizontalGroups, ...verticalGroups].forEach(group => {
      group.elements.forEach(element => groupedElementIds.add(element.id));
    });
    return groupedElementIds;
  }

  private static _groupElementsByCoordinate(
    elements: LayoutElement[], 
    direction: 'horizontal' | 'vertical', 
    tolerance: number
  ): Map<number, LayoutElement[]> {
    const coordinateGroups: Array<{ coordinate: number; elements: LayoutElement[] }> = [];
    
    for (const element of elements) {
      const coordinate = this._calculateGroupingCoordinate(element, direction);
      if (coordinate === null) continue;

      let foundGroup = false;
      for (const group of coordinateGroups) {
        if (this._coordinatesAreWithinTolerance(coordinate, group.coordinate, tolerance)) {
          if (this._elementIsCompatibleWithGroup(element, group.elements, direction)) {
            group.elements.push(element);
            foundGroup = true;
            break;
          }
        }
      }

      if (!foundGroup) {
        coordinateGroups.push({ coordinate, elements: [element] });
      }
    }

    return this._convertToUniqueKeyedMap(coordinateGroups);
  }

  private static _coordinatesAreWithinTolerance(
    coordinate1: number, 
    coordinate2: number, 
    tolerance: number
  ): boolean {
    return Math.abs(coordinate1 - coordinate2) <= tolerance;
  }

  private static _convertToUniqueKeyedMap(
    coordinateGroups: Array<{ coordinate: number; elements: LayoutElement[] }>
  ): Map<number, LayoutElement[]> {
    const resultMap = new Map<number, LayoutElement[]>();
    coordinateGroups.forEach((group, index) => {
      const uniqueKey = group.coordinate + (index * 0.001);
      resultMap.set(uniqueKey, group.elements);
    });
    return resultMap;
  }

  private static _calculateGroupingCoordinate(
    element: LayoutElement, 
    direction: 'horizontal' | 'vertical'
  ): number | null {
    const { x, y, width, height } = element.layout;
    const category = ElementTypeUtils.getElementCategory(element);

    if (category === 'elbow') {
      return this._calculateElbowGroupingCoordinate(element, direction);
    }

    if (direction === 'horizontal') {
      return y + height / 2;
    } else {
      return x + width / 2;
    }
  }

  private static _calculateElbowGroupingCoordinate(
    element: LayoutElement, 
    direction: 'horizontal' | 'vertical'
  ): number | null {
    const { x, y, width, height } = element.layout;
    const orientation = (element as any).props?.orientation ?? 'top-left';
    const bodyWidth = ElementTypeUtils.resolveElbowBodyWidth(element);
    const armHeight = ElementTypeUtils.resolveElbowArmHeight(element);

    switch (orientation) {
      case 'top-right':
        return direction === 'horizontal' 
          ? y + armHeight / 2 
          : x + width - bodyWidth / 2;

      case 'top-left':
        return direction === 'horizontal' 
          ? y + armHeight / 2 
          : x + bodyWidth / 2;

      case 'bottom-right':
        return direction === 'horizontal' 
          ? y + height - armHeight / 2 
          : x + width - bodyWidth / 2;

      case 'bottom-left':
        return direction === 'horizontal' 
          ? y + height - armHeight / 2 
          : x + bodyWidth / 2;

      default:
        logger.warn(`Unknown elbow orientation: ${orientation}`);
        return null;
    }
  }

  private static _elementIsCompatibleWithGroup(
    element: LayoutElement, 
    group: LayoutElement[], 
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const elementCategory = ElementTypeUtils.getElementCategory(element);
    
    for (const groupElement of group) {
      const groupCategory = ElementTypeUtils.getElementCategory(groupElement);
      
      if (elementCategory === 'elbow') {
        if (!this._elbowIsCompatibleWithElement(element, groupElement, direction)) {
          return false;
        }
      }
      
      if (groupCategory === 'elbow') {
        if (!this._elbowIsCompatibleWithElement(groupElement, element, direction)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private static _elbowIsCompatibleWithElement(
    elbowElement: LayoutElement,
    otherElement: LayoutElement,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const orientation = (elbowElement as any).props?.orientation ?? 'top-left';
    const elbowRect = elbowElement.layout;
    const otherRect = otherElement.layout;

    if (direction === 'horizontal') {
      return this._elbowHorizontalConstraintIsSatisfied(orientation, elbowRect, otherRect);
    } else {
      return this._elbowVerticalConstraintIsSatisfied(orientation, elbowRect, otherRect);
    }
  }

  private static _elbowHorizontalConstraintIsSatisfied(
    orientation: string,
    elbowRect: { x: number; width: number },
    otherRect: { x: number; width: number }
  ): boolean {
    switch (orientation) {
      case 'top-right':
      case 'bottom-right':
        return otherRect.x + otherRect.width <= elbowRect.x;
      case 'top-left':
      case 'bottom-left':
        return otherRect.x >= elbowRect.x + elbowRect.width;
      default:
        return true;
    }
  }

  private static _elbowVerticalConstraintIsSatisfied(
    orientation: string,
    elbowRect: { y: number; height: number },
    otherRect: { y: number; height: number }
  ): boolean {
    switch (orientation) {
      case 'top-right':
      case 'top-left':
        return otherRect.y >= elbowRect.y + elbowRect.height;
      case 'bottom-right':
      case 'bottom-left':
        return otherRect.y + otherRect.height <= elbowRect.y;
      default:
        return true;
    }
  }
}
