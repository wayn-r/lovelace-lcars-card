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
  positionDelta: number;
  sizeDelta: number;
  groupType: 'horizontal' | 'vertical';
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

export type ConnectionDirection = 'up' | 'down' | 'left' | 'right';

export interface ElementConnection {
  elementId: string;
  direction: ConnectionDirection;
  constraint: 'none' | 'upper' | 'lower' | 'leftmost' | 'rightmost';
}

export interface ElementConnections {
  elementId: string;
  connections: ElementConnection[];
}

export interface GroupMatchingOptions {
  positionTolerance: number;
  sizeToleranceRatio: number;
}

type ElementCategoryType = ReturnType<typeof ElementTypeUtils.getElementCategory>;
type GroupableCategory = Extract<ElementCategoryType, 'text' | 'rectangle' | 'endcap' | 'elbow'>;
type HorizontalConstraint = 'requiresLeftOf' | 'requiresRightOf';
type VerticalConstraint = 'requiresAbove' | 'requiresBelow';

interface ConnectionRule {
  connections: Array<{ direction: ConnectionDirection; constraint: ElementConnection['constraint'] }>;
  horizontalConstraint?: HorizontalConstraint;
  verticalConstraint?: VerticalConstraint;
}

const END_CAP_RULES: Record<'left' | 'right', ConnectionRule> = {
  left: {
    connections: [{ direction: 'right', constraint: 'leftmost' }],
    horizontalConstraint: 'requiresRightOf'
  },
  right: {
    connections: [{ direction: 'left', constraint: 'rightmost' }],
    horizontalConstraint: 'requiresLeftOf'
  }
};

const ELBOW_RULES: Record<string, ConnectionRule> = {
  'top-left': {
    connections: [{ direction: 'right', constraint: 'leftmost' }, { direction: 'down', constraint: 'upper' }],
    horizontalConstraint: 'requiresRightOf',
    verticalConstraint: 'requiresBelow'
  },
  'top-right': {
    connections: [{ direction: 'left', constraint: 'rightmost' }, { direction: 'down', constraint: 'upper' }],
    horizontalConstraint: 'requiresLeftOf',
    verticalConstraint: 'requiresBelow'
  },
  'bottom-left': {
    connections: [{ direction: 'right', constraint: 'leftmost' }, { direction: 'up', constraint: 'lower' }],
    horizontalConstraint: 'requiresRightOf',
    verticalConstraint: 'requiresAbove'
  },
  'bottom-right': {
    connections: [{ direction: 'left', constraint: 'rightmost' }, { direction: 'up', constraint: 'lower' }],
    horizontalConstraint: 'requiresLeftOf',
    verticalConstraint: 'requiresAbove'
  }
};

const RELEVANT_DIRECTIONS: Record<'horizontal' | 'vertical', ReadonlySet<ConnectionDirection>> = {
  horizontal: new Set<ConnectionDirection>(['left', 'right']),
  vertical: new Set<ConnectionDirection>(['up', 'down'])
};

const CONSTRAINT_COMPATIBILITY: Record<'horizontal' | 'vertical', ReadonlySet<string>> = {
  horizontal: new Set(['leftmost:rightmost', 'rightmost:leftmost']),
  vertical: new Set(['upper:lower', 'lower:upper'])
};

const GROUPABLE_CATEGORIES: ReadonlySet<GroupableCategory> = new Set(['text', 'rectangle', 'endcap', 'elbow']);
const ALL_DIRECTIONS: ConnectionDirection[] = ['up', 'down', 'left', 'right'];

const UNCONSTRAINED_RULE: ConnectionRule = {
  connections: ALL_DIRECTIONS.map(direction => ({ direction, constraint: 'none' as const }))
};

class ElementSpatialConstraintEvaluator {
  static allows(
    direction: 'horizontal' | 'vertical',
    rule: ConnectionRule,
    elementRect: LayoutElement['layout'],
    otherRect: LayoutElement['layout']
  ): boolean {
    return direction === 'horizontal'
      ? this._horizontalConstraintAllows(rule.horizontalConstraint, elementRect, otherRect)
      : this._verticalConstraintAllows(rule.verticalConstraint, elementRect, otherRect);
  }

  private static _horizontalConstraintAllows(
    constraint: HorizontalConstraint | undefined,
    elementRect: LayoutElement['layout'],
    otherRect: LayoutElement['layout']
  ): boolean {
    if (!constraint) return true;

    const elementLeftEdge = elementRect.x;
    const elementRightEdge = elementRect.x + elementRect.width;
    const otherLeftEdge = otherRect.x;
    const otherRightEdge = otherRect.x + otherRect.width;

    if (constraint === 'requiresLeftOf') {
      return otherRightEdge <= elementLeftEdge;
    }

    return otherLeftEdge >= elementRightEdge;
  }

  private static _verticalConstraintAllows(
    constraint: VerticalConstraint | undefined,
    elementRect: LayoutElement['layout'],
    otherRect: LayoutElement['layout']
  ): boolean {
    if (!constraint) return true;

    const elementTopEdge = elementRect.y;
    const elementBottomEdge = elementRect.y + elementRect.height;
    const otherTopEdge = otherRect.y;
    const otherBottomEdge = otherRect.y + otherRect.height;

    if (constraint === 'requiresAbove') {
      return otherBottomEdge <= elementTopEdge;
    }

    return otherTopEdge >= elementBottomEdge;
  }
}

class ElementGroupingCoordinateCalculator {
  static calculate(element: LayoutElement, direction: 'horizontal' | 'vertical'): number | null {
    const { x, y, width, height } = element.layout;
    const category = ElementTypeUtils.getElementCategory(element);

    if (category === 'elbow') {
      return this._calculateForElbow(element, direction);
    }

    return direction === 'horizontal' ? y + height / 2 : x + width / 2;
  }

  private static _calculateForElbow(element: LayoutElement, direction: 'horizontal' | 'vertical'): number | null {
    const { x, y, width, height } = element.layout;
    const orientation = (element as any).props?.orientation ?? 'top-left';
    const bodyWidth = ElementTypeUtils.resolveElbowBodyWidth(element);
    const armHeight = ElementTypeUtils.resolveElbowArmHeight(element);

    switch (orientation) {
      case 'top-right':
        return direction === 'horizontal' ? y + armHeight / 2 : x + width - bodyWidth / 2;
      case 'top-left':
        return direction === 'horizontal' ? y + armHeight / 2 : x + bodyWidth / 2;
      case 'bottom-right':
        return direction === 'horizontal' ? y + height - armHeight / 2 : x + width - bodyWidth / 2;
      case 'bottom-left':
        return direction === 'horizontal' ? y + height - armHeight / 2 : x + bodyWidth / 2;
      default:
        logger.warn(`Unknown elbow orientation: ${orientation}`);
        return null;
    }
  }
}

class ElementUsageRegistry {
  private readonly usedNonElbow = new Set<string>();
  private readonly usedElbowDirections = new Map<string, Set<'horizontal' | 'vertical'>>();

  groupIsAvailable(group: ElementGroup, direction: 'horizontal' | 'vertical'): boolean {
    return group.elements.every(element => this._elementUsageIsAllowed(element, direction));
  }

  markGroupUsed(group: ElementGroup, direction: 'horizontal' | 'vertical'): void {
    group.elements.forEach(element => this._markElementUsed(element, direction));
  }

  private _elementUsageIsAllowed(element: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    const category = ElementTypeUtils.getElementCategory(element);
    if (category === 'elbow') {
      return !this._elementDirectionIsUsed(element.id, direction);
    }
    return !this.usedNonElbow.has(element.id);
  }

  private _elementDirectionIsUsed(elementId: string, direction: 'horizontal' | 'vertical'): boolean {
    const usedDirections = this.usedElbowDirections.get(elementId);
    return Boolean(usedDirections && usedDirections.has(direction));
  }

  private _markElementUsed(element: LayoutElement, direction: 'horizontal' | 'vertical'): void {
    const category = ElementTypeUtils.getElementCategory(element);
    if (category === 'elbow') {
      const usedDirections = this.usedElbowDirections.get(element.id) ?? new Set<'horizontal' | 'vertical'>();
      usedDirections.add(direction);
      this.usedElbowDirections.set(element.id, usedDirections);
      return;
    }
    this.usedNonElbow.add(element.id);
  }
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

  static matchElementGroups(
    sourceGrouping: ElementGroupingResult,
    targetGrouping: ElementGroupingResult,
    options: GroupMatchingOptions
  ): GroupMatch[] {
    const filteredSourceHorizontal = this._filterGroupsWithAtLeastTwoElements(sourceGrouping.horizontalGroups);
    const filteredTargetHorizontal = this._filterGroupsWithAtLeastTwoElements(targetGrouping.horizontalGroups);
    const filteredSourceVertical = this._filterGroupsWithAtLeastTwoElements(sourceGrouping.verticalGroups);
    const filteredTargetVertical = this._filterGroupsWithAtLeastTwoElements(targetGrouping.verticalGroups);

    const candidateMatches = this._generateCandidateMatches(
      filteredSourceHorizontal,
      filteredTargetHorizontal,
      filteredSourceVertical,
      filteredTargetVertical,
      options
    );

    const sourceGroupsById = this._buildGroupLookup([...sourceGrouping.horizontalGroups, ...sourceGrouping.verticalGroups]);
    const targetGroupsById = this._buildGroupLookup([...targetGrouping.horizontalGroups, ...targetGrouping.verticalGroups]);
    const sourceUsage = new ElementUsageRegistry();
    const targetUsage = new ElementUsageRegistry();

    return candidateMatches.reduce<GroupMatch[]>((matches, candidate) => {
      const sourceGroup = sourceGroupsById.get(candidate.sourceGroupId);
      const targetGroup = targetGroupsById.get(candidate.targetGroupId);
      if (!sourceGroup || !targetGroup) {
        return matches;
      }

      if (!sourceUsage.groupIsAvailable(sourceGroup, candidate.groupType)) {
        return matches;
      }
      if (!targetUsage.groupIsAvailable(targetGroup, candidate.groupType)) {
        return matches;
      }

      sourceUsage.markGroupUsed(sourceGroup, candidate.groupType);
      targetUsage.markGroupUsed(targetGroup, candidate.groupType);
      matches.push(candidate);
      return matches;
    }, []);
  }

  private static _calculateGroupMatch(
    sourceGroup: ElementGroup,
    targetGroup: ElementGroup,
    groupType: 'horizontal' | 'vertical',
    options: GroupMatchingOptions
  ): GroupMatch | null {
    const positionDelta = Math.abs(sourceGroup.meanCoordinate - targetGroup.meanCoordinate);
    
    if (positionDelta > options.positionTolerance) {
      return null;
    }
    
    const sourceSize = this._calculateGroupSize(sourceGroup, groupType);
    const targetSize = this._calculateGroupSize(targetGroup, groupType);
    
    if (sourceSize === 0 || targetSize === 0) {
      return null;
    }
    
    const sizeDelta = Math.abs(sourceSize - targetSize);
    const maxSize = Math.max(sourceSize, targetSize);
    const sizeRatio = sizeDelta / maxSize;
    
    if (sizeRatio > options.sizeToleranceRatio) {
      return null;
    }
    
    const positionScore = 1 - (positionDelta / options.positionTolerance);
    const sizeScore = 1 - (sizeRatio / options.sizeToleranceRatio);
    const matchConfidence = (positionScore * 0.6 + sizeScore * 0.4);
    
    return {
      sourceGroupId: sourceGroup.id,
      targetGroupId: targetGroup.id,
      matchConfidence,
      positionDelta,
      sizeDelta,
      groupType
    };
  }

  private static _filterGroupsWithAtLeastTwoElements(groups: ElementGroup[]): ElementGroup[] {
    return groups.filter(group => group.elements.length >= 2);
  }

  private static _generateCandidateMatches(
    sourceHorizontal: ElementGroup[],
    targetHorizontal: ElementGroup[],
    sourceVertical: ElementGroup[],
    targetVertical: ElementGroup[],
    options: GroupMatchingOptions
  ): GroupMatch[] {
    const horizontalMatches = this._generateMatchesForPair(sourceHorizontal, targetHorizontal, 'horizontal', options);
    const verticalMatches = this._generateMatchesForPair(sourceVertical, targetVertical, 'vertical', options);
    return [...horizontalMatches, ...verticalMatches].sort((a, b) => b.matchConfidence - a.matchConfidence);
  }

  private static _generateMatchesForPair(
    sourceGroups: ElementGroup[],
    targetGroups: ElementGroup[],
    groupType: 'horizontal' | 'vertical',
    options: GroupMatchingOptions
  ): GroupMatch[] {
    return sourceGroups.flatMap(sourceGroup => (
      targetGroups
        .map(targetGroup => this._calculateGroupMatch(sourceGroup, targetGroup, groupType, options))
        .filter((match): match is GroupMatch => Boolean(match))
    ));
  }

  private static _buildGroupLookup(groups: ElementGroup[]): Map<string, ElementGroup> {
    return new Map(groups.map(group => [group.id, group]));
  }

  private static _calculateGroupSize(group: ElementGroup, groupType: 'horizontal' | 'vertical'): number {
    if (group.elements.length === 0) return 0;
    
    let totalSize = 0;
    let validElements = 0;
    
    for (const element of group.elements) {
      const category = ElementTypeUtils.getElementCategory(element);
      let elementSize: number;
      
      if (category === 'elbow') {
        elementSize = groupType === 'horizontal' 
          ? ElementTypeUtils.resolveElbowArmHeight(element)
          : ElementTypeUtils.resolveElbowBodyWidth(element);
      } else {
        elementSize = groupType === 'horizontal' 
          ? element.layout.height 
          : element.layout.width;
      }
      
      if (elementSize > 0) {
        totalSize += elementSize;
        validElements++;
      }
    }
    
    return validElements > 0 ? totalSize / validElements : 0;
  }

  private static _flattenElementsFromGroups(groups: Group[]): LayoutElement[] {
    const flattenedElements: LayoutElement[] = [];
    groups.forEach(group => group.elements.forEach(element => flattenedElements.push(element)));
    return flattenedElements;
  }
}

interface IElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[];
  allowsElementInDirection(element: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean;
}

abstract class BaseElementConnectionHandler implements IElementConnectionHandler {
  abstract identifyConnections(element: LayoutElement): ElementConnection[];
  
  allowsElementInDirection(element: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    return true;
  }

  protected createConnection(elementId: string, direction: ConnectionDirection, constraint: ElementConnection['constraint']): ElementConnection {
    return { elementId, direction, constraint };
  }
}

class EndcapConnectionHandler extends BaseElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[] {
    const rule = this.getEndcapRule(element);
    if (!rule) {
      return [];
    }

    return rule.connections.map(def => this.createConnection(element.id, def.direction, def.constraint));
  }

  allowsElementInDirection(endcapElement: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    if (direction !== 'horizontal') return true;

    const rule = this.getEndcapRule(endcapElement);
    if (!rule) {
      return true;
    }

    return ElementSpatialConstraintEvaluator.allows(direction, rule, endcapElement.layout, otherElement.layout);
  }

  private getEndcapDirection(element: LayoutElement): 'left' | 'right' {
    return ((element as any).props?.direction || 'left') as 'left' | 'right';
  }

  private getEndcapRule(element: LayoutElement): ConnectionRule | null {
    const direction = this.getEndcapDirection(element);
    return END_CAP_RULES[direction] ?? null;
  }
}

class ElbowConnectionHandler extends BaseElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[] {
    const rule = this.getElbowRule(element);
    if (!rule) {
      return [];
    }

    return rule.connections.map(def => this.createConnection(element.id, def.direction, def.constraint));
  }

  allowsElementInDirection(elbowElement: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    const rule = this.getElbowRule(elbowElement);
    if (!rule) {
      return true;
    }

    return ElementSpatialConstraintEvaluator.allows(direction, rule, elbowElement.layout, otherElement.layout);
  }

  private getElbowOrientation(element: LayoutElement): string {
    return (element as any).props?.orientation ?? 'top-left';
  }

  private getElbowRule(element: LayoutElement): ConnectionRule | null {
    const orientation = this.getElbowOrientation(element);
    const rule = ELBOW_RULES[orientation];
    if (!rule) {
      logger.warn(`Unknown elbow orientation: ${orientation}`);
      return null;
    }
    return rule;
  }
}

class UnconstrainedElementConnectionHandler extends BaseElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[] {
    return UNCONSTRAINED_RULE.connections.map(def => this.createConnection(element.id, def.direction, def.constraint));
  }
}

class ConnectionHandlerFactory {
  static createHandler(element: LayoutElement): IElementConnectionHandler {
    const category = ElementTypeUtils.getElementCategory(element);
    
    switch (category) {
      case 'endcap':
        return new EndcapConnectionHandler();
      case 'elbow':
        return new ElbowConnectionHandler();
      case 'rectangle':
      case 'text':
        return new UnconstrainedElementConnectionHandler();
      default:
        return new UnconstrainedElementConnectionHandler();
    }
  }
}

class ConnectionCompatibilityAnalyzer {
  static analyzeCompatibility(
    connectionsA: ElementConnections,
    connectionsB: ElementConnections,
    groupDirection: 'horizontal' | 'vertical'
  ): boolean {
    const relevantConnectionsA = this._getRelevantConnections(connectionsA.connections, groupDirection);
    const relevantConnectionsB = this._getRelevantConnections(connectionsB.connections, groupDirection);

    if (!this._hasRelevantConnections(relevantConnectionsA, relevantConnectionsB)) {
      return false;
    }

    return this._constraintsAreCompatible(relevantConnectionsA, relevantConnectionsB, groupDirection);
  }

  private static _getRelevantConnections(
    connections: ElementConnection[],
    groupDirection: 'horizontal' | 'vertical'
  ): ElementConnection[] {
    const relevantDirections = RELEVANT_DIRECTIONS[groupDirection];
    return connections.filter(conn => relevantDirections.has(conn.direction));
  }

  private static _hasRelevantConnections(
    connectionsA: ElementConnection[],
    connectionsB: ElementConnection[]
  ): boolean {
    return connectionsA.length > 0 && connectionsB.length > 0;
  }

  private static _constraintsAreCompatible(
    connectionsA: ElementConnection[],
    connectionsB: ElementConnection[],
    groupDirection: 'horizontal' | 'vertical'
  ): boolean {
    if (this._hasUnconstrainedElement(connectionsA, connectionsB)) {
      return true;
    }

    return connectionsA.some(connA => (
      connectionsB.some(connB => this._constraintsArePairCompatible(connA.constraint, connB.constraint, groupDirection))
    ));
  }

  private static _hasUnconstrainedElement(
    connectionsA: ElementConnection[],
    connectionsB: ElementConnection[]
  ): boolean {
    return connectionsA.some(conn => conn.constraint === 'none') || connectionsB.some(conn => conn.constraint === 'none');
  }

  private static _constraintsArePairCompatible(
    constraintA: ElementConnection['constraint'],
    constraintB: ElementConnection['constraint'],
    direction: 'horizontal' | 'vertical'
  ): boolean {
    if (constraintA === 'none' || constraintB === 'none') {
      return true;
    }

    const pairKey = `${constraintA}:${constraintB}`;
    return CONSTRAINT_COMPATIBILITY[direction].has(pairKey);
  }
}

export class ConnectionIdentifier {
  static identifyElementConnections(element: LayoutElement): ElementConnections {
    const handler = ConnectionHandlerFactory.createHandler(element);
    const connections = handler.identifyConnections(element);

    return {
      elementId: element.id,
      connections
    };
  }

  static identifyConnectionsForElements(elements: LayoutElement[]): ElementConnections[] {
    return elements.map(element => this.identifyElementConnections(element));
  }

  static elementsAreConnectionCompatible(
    elementA: LayoutElement,
    elementB: LayoutElement,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const connectionsA = this.identifyElementConnections(elementA);
    const connectionsB = this.identifyElementConnections(elementB);

    const connectionsAreLogicallyCompatible = ConnectionCompatibilityAnalyzer.analyzeCompatibility(
      connectionsA, 
      connectionsB, 
      direction
    );

    const spatialConstraintsAreRespected = this.elementsSpatiallyCompatible(elementA, elementB, direction);

    return connectionsAreLogicallyCompatible && spatialConstraintsAreRespected;
  }

  private static elementsSpatiallyCompatible(
    elementA: LayoutElement,
    elementB: LayoutElement,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const handlerA = ConnectionHandlerFactory.createHandler(elementA);
    const handlerB = ConnectionHandlerFactory.createHandler(elementB);

    const elementAAllowsB = handlerA.allowsElementInDirection(elementA, elementB, direction);
    const elementBAllowsA = handlerB.allowsElementInDirection(elementB, elementA, direction);

    return elementAAllowsB && elementBAllowsA;
  }
}

export class ElementGrouper {
  static groupElementsByAlignment(elements: LayoutElement[], tolerance: number = 5): ElementGroupingResult {
    const groupableElements = this._filterGroupableElements(elements);

    const horizontalGroups = this._buildGroupsForDirection(groupableElements, 'horizontal', tolerance, 'y');
    const verticalGroups = this._buildGroupsForDirection(groupableElements, 'vertical', tolerance, 'x');

    const groupedElementIds = new Set<string>([
      ...horizontalGroups.flatMap(group => group.elements.map(element => element.id)),
      ...verticalGroups.flatMap(group => group.elements.map(element => element.id))
    ]);

    const ungroupedElements = elements.filter(element => !groupedElementIds.has(element.id));

    return {
      horizontalGroups,
      verticalGroups,
      ungroupedElements
    };
  }

  private static _filterGroupableElements(elements: LayoutElement[]): LayoutElement[] {
    return elements.filter(element => GROUPABLE_CATEGORIES.has(ElementTypeUtils.getElementCategory(element) as GroupableCategory));
  }

  private static _buildGroupsForDirection(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical',
    tolerance: number,
    coordinateType: 'x' | 'y'
  ): ElementGroup[] {
    const groupMap = this._groupElementsByCoordinate(elements, direction, tolerance);
    return Array.from(groupMap.entries()).map(([meanCoordinate, groupElements]) => ({
      id: `${direction}_${meanCoordinate.toFixed(1)}`,
      elements: groupElements,
      groupType: direction,
      meanCoordinate: this._calculateMeanCoordinateForGroup(groupElements, direction),
      coordinateType
    }));
  }

  private static _groupElementsByCoordinate(
    elements: LayoutElement[], 
    direction: 'horizontal' | 'vertical', 
    tolerance: number
  ): Map<number, LayoutElement[]> {
    const coordinateGroups: Array<{ coordinate: number; elements: LayoutElement[] }> = [];
    
    for (const element of elements) {
      // Exclude endcaps from vertical groups entirely
      if (direction === 'vertical' && ElementTypeUtils.getElementCategory(element) === 'endcap') {
        continue;
      }

      const coordinate = ElementGroupingCoordinateCalculator.calculate(element, direction);
      if (coordinate === null) continue;

      const compatibleGroups: Array<{ coordinate: number; elements: LayoutElement[] }> = [];
      const compatibleEndcapGroups: Array<{ coordinate: number; elements: LayoutElement[] }> = [];

      for (const group of coordinateGroups) {
        if (!this._coordinatesAreWithinTolerance(coordinate, group.coordinate, tolerance)) continue;
        if (!this._elementIsCompatibleWithGroup(element, group.elements, direction)) continue;

        const groupContainsEndcap = group.elements.some(el => ElementTypeUtils.getElementCategory(el) === 'endcap');
        if (direction === 'horizontal' && groupContainsEndcap) {
          compatibleEndcapGroups.push(group);
        } else {
          compatibleGroups.push(group);
        }
      }

      const targetGroup = (compatibleEndcapGroups[0] || compatibleGroups[0]);
      if (targetGroup) {
        targetGroup.elements.push(element);
      } else {
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

  private static _calculateMeanCoordinateForGroup(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical'
  ): number {
    const coords: number[] = [];
    for (const element of elements) {
      const coord = ElementGroupingCoordinateCalculator.calculate(element, direction);
      if (coord !== null) coords.push(coord);
    }
    if (coords.length === 0) return 0;
    const sum = coords.reduce((acc, value) => acc + value, 0);
    return sum / coords.length;
  }

  private static _elementIsCompatibleWithGroup(
    element: LayoutElement, 
    group: LayoutElement[], 
    direction: 'horizontal' | 'vertical'
  ): boolean {
    for (const groupElement of group) {
      if (!ConnectionIdentifier.elementsAreConnectionCompatible(element, groupElement, direction)) {
        return false;
      }
    }
    
    return true;
  }

}
