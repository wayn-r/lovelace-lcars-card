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

  static analyzeGroupAndElementMatching(sourceGroups: Group[], targetGroups: Group[]): MatchingResult {
    const sourceElements = this._flattenElementsFromGroups(sourceGroups);
    const targetElements = this._flattenElementsFromGroups(targetGroups);


    return {
      groupMatches: [],
      elementMatches: [],
      unmatchedSourceElementIds: sourceElements.map(element => element.id),
      unmatchedTargetElementIds: targetElements.map(element => element.id)
    };
  }


  private static _flattenElementsFromGroups(groups: Group[]): LayoutElement[] {
    const flattenedElements: LayoutElement[] = [];
    groups.forEach(group => group.elements.forEach(element => flattenedElements.push(element)));
    return flattenedElements;
  }
}
