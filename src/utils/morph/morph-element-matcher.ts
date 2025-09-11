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

    const candidateMatches: GroupMatch[] = [];
    candidateMatches.push(
      ...this._generateCandidateMatchesForType(
        filteredSourceHorizontal,
        filteredTargetHorizontal,
        'horizontal',
        options
      ),
      ...this._generateCandidateMatchesForType(
        filteredSourceVertical,
        filteredTargetVertical,
        'vertical',
        options
      )
    );

    candidateMatches.sort((a, b) => b.matchConfidence - a.matchConfidence);

    const sourceGroupsById = new Map<string, ElementGroup>(
      [...sourceGrouping.horizontalGroups, ...sourceGrouping.verticalGroups].map(g => [g.id, g])
    );
    const targetGroupsById = new Map<string, ElementGroup>(
      [...targetGrouping.horizontalGroups, ...targetGrouping.verticalGroups].map(g => [g.id, g])
    );

    const selectedMatches: GroupMatch[] = [];
    const usedSourceNonElbow = new Set<string>();
    const usedTargetNonElbow = new Set<string>();
    const usedSourceElbowsByDirection = new Map<string, Set<'horizontal' | 'vertical'>>();
    const usedTargetElbowsByDirection = new Map<string, Set<'horizontal' | 'vertical'>>();

    for (const candidate of candidateMatches) {
      const sourceGroup = sourceGroupsById.get(candidate.sourceGroupId);
      const targetGroup = targetGroupsById.get(candidate.targetGroupId);
      if (!sourceGroup || !targetGroup) continue;

      const sourceAllowed = this._groupUsageIsAllowed(
        sourceGroup,
        candidate.groupType,
        usedSourceNonElbow,
        usedSourceElbowsByDirection
      );
      if (!sourceAllowed) continue;

      const targetAllowed = this._groupUsageIsAllowed(
        targetGroup,
        candidate.groupType,
        usedTargetNonElbow,
        usedTargetElbowsByDirection
      );
      if (!targetAllowed) continue;

      selectedMatches.push(candidate);
      this._markGroupElementsUsed(
        sourceGroup,
        candidate.groupType,
        usedSourceNonElbow,
        usedSourceElbowsByDirection
      );
      this._markGroupElementsUsed(
        targetGroup,
        candidate.groupType,
        usedTargetNonElbow,
        usedTargetElbowsByDirection
      );
    }

    return selectedMatches;
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

  private static _generateCandidateMatchesForType(
    sourceGroups: ElementGroup[],
    targetGroups: ElementGroup[],
    groupType: 'horizontal' | 'vertical',
    options: GroupMatchingOptions
  ): GroupMatch[] {
    const candidates: GroupMatch[] = [];
    for (const sourceGroup of sourceGroups) {
      for (const targetGroup of targetGroups) {
        const match = this._calculateGroupMatch(sourceGroup, targetGroup, groupType, options);
        if (match) candidates.push(match);
      }
    }
    return candidates;
  }

  private static _groupUsageIsAllowed(
    group: ElementGroup,
    direction: 'horizontal' | 'vertical',
    usedNonElbow: Set<string>,
    usedElbowsByDirection: Map<string, Set<'horizontal' | 'vertical'>>
  ): boolean {
    for (const element of group.elements) {
      const elementId = element.id;
      const category = ElementTypeUtils.getElementCategory(element);
      const elementIsElbow = category === 'elbow';

      if (elementIsElbow) {
        const usedDirections = usedElbowsByDirection.get(elementId);
        if (usedDirections && usedDirections.has(direction)) {
          return false;
        }
      } else {
        if (usedNonElbow.has(elementId)) {
          return false;
        }
      }
    }
    return true;
  }

  private static _markGroupElementsUsed(
    group: ElementGroup,
    direction: 'horizontal' | 'vertical',
    usedNonElbow: Set<string>,
    usedElbowsByDirection: Map<string, Set<'horizontal' | 'vertical'>>
  ): void {
    for (const element of group.elements) {
      const elementId = element.id;
      const category = ElementTypeUtils.getElementCategory(element);
      const elementIsElbow = category === 'elbow';

      if (elementIsElbow) {
        let usedDirections = usedElbowsByDirection.get(elementId);
        if (!usedDirections) {
          usedDirections = new Set<'horizontal' | 'vertical'>();
          usedElbowsByDirection.set(elementId, usedDirections);
        }
        usedDirections.add(direction);
      } else {
        usedNonElbow.add(elementId);
      }
    }
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
    const endcapDirection = this.getEndcapDirection(element);
    const connectionDirection = this.determineConnectionDirection(endcapDirection);
    const constraint = this.determineConstraint(endcapDirection);
    
    return [this.createConnection(element.id, connectionDirection, constraint)];
  }

  allowsElementInDirection(endcapElement: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    if (direction !== 'horizontal') return true;
    
    const endcapDirection = this.getEndcapDirection(endcapElement);
    const endcapRect = endcapElement.layout;
    const otherRect = otherElement.layout;
    
    return this.elementRespectsSpatialConstraint(endcapDirection, endcapRect, otherRect);
  }

  private getEndcapDirection(element: LayoutElement): 'left' | 'right' {
    return ((element as any).props?.direction || 'left') as 'left' | 'right';
  }

  private determineConnectionDirection(endcapDirection: 'left' | 'right'): ConnectionDirection {
    return endcapDirection === 'left' ? 'right' : 'left';
  }

  private determineConstraint(endcapDirection: 'left' | 'right'): ElementConnection['constraint'] {
    return endcapDirection === 'left' ? 'leftmost' : 'rightmost';
  }

  private elementRespectsSpatialConstraint(
    endcapDirection: 'left' | 'right',
    endcapRect: { x: number; width: number },
    otherRect: { x: number; width: number }
  ): boolean {
    const otherElementRightEdge = otherRect.x + otherRect.width;
    const otherElementLeftEdge = otherRect.x;
    const endcapLeftEdge = endcapRect.x;
    const endcapRightEdge = endcapRect.x + endcapRect.width;

    return endcapDirection === 'right' 
      ? otherElementRightEdge <= endcapLeftEdge
      : otherElementLeftEdge >= endcapRightEdge;
  }
}

class ElbowConnectionHandler extends BaseElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[] {
    const orientation = this.getElbowOrientation(element);
    const connectionDefinition = this.getConnectionDefinition(orientation);
    
    if (!connectionDefinition) {
      logger.warn(`Unknown elbow orientation: ${orientation}`);
      return [];
    }

    return connectionDefinition.map(def => 
      this.createConnection(element.id, def.direction, def.constraint)
    );
  }

  allowsElementInDirection(elbowElement: LayoutElement, otherElement: LayoutElement, direction: 'horizontal' | 'vertical'): boolean {
    const orientation = this.getElbowOrientation(elbowElement);
    const elbowRect = elbowElement.layout;
    const otherRect = otherElement.layout;

    return direction === 'horizontal'
      ? this.horizontalConstraintAllows(orientation, elbowRect, otherRect)
      : this.verticalConstraintAllows(orientation, elbowRect, otherRect);
  }

  private getElbowOrientation(element: LayoutElement): string {
    return (element as any).props?.orientation ?? 'top-left';
  }

  private getConnectionDefinition(orientation: string): Array<{ direction: ConnectionDirection; constraint: ElementConnection['constraint'] }> | null {
    const connectionMap: Record<string, Array<{ direction: ConnectionDirection; constraint: ElementConnection['constraint'] }>> = {
      'top-left': [
        { direction: 'right' as ConnectionDirection, constraint: 'leftmost' as const },
        { direction: 'down' as ConnectionDirection, constraint: 'upper' as const }
      ],
      'top-right': [
        { direction: 'left' as ConnectionDirection, constraint: 'rightmost' as const },
        { direction: 'down' as ConnectionDirection, constraint: 'upper' as const }
      ],
      'bottom-left': [
        { direction: 'right' as ConnectionDirection, constraint: 'leftmost' as const },
        { direction: 'up' as ConnectionDirection, constraint: 'lower' as const }
      ],
      'bottom-right': [
        { direction: 'left' as ConnectionDirection, constraint: 'rightmost' as const },
        { direction: 'up' as ConnectionDirection, constraint: 'lower' as const }
      ]
    };

    return connectionMap[orientation] || null;
  }

  private horizontalConstraintAllows(
    orientation: string,
    elbowRect: { x: number; width: number },
    otherRect: { x: number; width: number }
  ): boolean {
    const rightOrientations = ['top-right', 'bottom-right'];
    const leftOrientations = ['top-left', 'bottom-left'];
    
    const otherElementRightEdge = otherRect.x + otherRect.width;
    const otherElementLeftEdge = otherRect.x;
    const elbowLeftEdge = elbowRect.x;
    const elbowRightEdge = elbowRect.x + elbowRect.width;

    if (rightOrientations.includes(orientation)) {
      return otherElementRightEdge <= elbowLeftEdge;
    } else if (leftOrientations.includes(orientation)) {
      return otherElementLeftEdge >= elbowRightEdge;
    }
    return true;
  }

  private verticalConstraintAllows(
    orientation: string,
    elbowRect: { y: number; height: number },
    otherRect: { y: number; height: number }
  ): boolean {
    const topOrientations = ['top-right', 'top-left'];
    const bottomOrientations = ['bottom-right', 'bottom-left'];
    
    const otherElementBottomEdge = otherRect.y + otherRect.height;
    const otherElementTopEdge = otherRect.y;
    const elbowTopEdge = elbowRect.y;
    const elbowBottomEdge = elbowRect.y + elbowRect.height;

    if (topOrientations.includes(orientation)) {
      return otherElementTopEdge >= elbowBottomEdge;
    } else if (bottomOrientations.includes(orientation)) {
      return otherElementBottomEdge <= elbowTopEdge;
    }
    return true;
  }
}

class UnconstrainedElementConnectionHandler extends BaseElementConnectionHandler {
  identifyConnections(element: LayoutElement): ElementConnection[] {
    const allDirections: ConnectionDirection[] = ['up', 'down', 'left', 'right'];
    return allDirections.map(direction => 
      this.createConnection(element.id, direction, 'none')
    );
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
    const relevantConnectionsA = this.getRelevantConnections(connectionsA.connections, groupDirection);
    const relevantConnectionsB = this.getRelevantConnections(connectionsB.connections, groupDirection);

    if (!this.elementsHaveRelevantConnections(relevantConnectionsA, relevantConnectionsB)) {
      return false;
    }

    return this.constraintsAreCompatible(relevantConnectionsA, relevantConnectionsB, groupDirection);
  }

  private static getRelevantConnections(connections: ElementConnection[], groupDirection: 'horizontal' | 'vertical'): ElementConnection[] {
    const relevantDirections = groupDirection === 'horizontal' ? ['left', 'right'] : ['up', 'down'];
    return connections.filter(conn => relevantDirections.includes(conn.direction));
  }

  private static elementsHaveRelevantConnections(connectionsA: ElementConnection[], connectionsB: ElementConnection[]): boolean {
    return connectionsA.length > 0 && connectionsB.length > 0;
  }

  private static constraintsAreCompatible(
    connectionsA: ElementConnection[],
    connectionsB: ElementConnection[],
    groupDirection: 'horizontal' | 'vertical'
  ): boolean {
    const hasUnconstrainedElement = this.hasUnconstrainedElement(connectionsA, connectionsB);
    
    if (hasUnconstrainedElement) {
      return true;
    }

    return this.constrainedElementsAreCompatible(connectionsA, connectionsB, groupDirection);
  }

  private static hasUnconstrainedElement(connectionsA: ElementConnection[], connectionsB: ElementConnection[]): boolean {
    return connectionsA.some(conn => conn.constraint === 'none') ||
           connectionsB.some(conn => conn.constraint === 'none');
  }

  private static constrainedElementsAreCompatible(
    connectionsA: ElementConnection[],
    connectionsB: ElementConnection[],
    groupDirection: 'horizontal' | 'vertical'
  ): boolean {
    for (const connA of connectionsA) {
      for (const connB of connectionsB) {
        if (this.individualConstraintsAreCompatible(connA.constraint, connB.constraint, groupDirection)) {
          return true;
        }
      }
    }
    return false;
  }

  private static individualConstraintsAreCompatible(
    constraintA: ElementConnection['constraint'],
    constraintB: ElementConnection['constraint'],
    direction: 'horizontal' | 'vertical'
  ): boolean {
    if (constraintA === 'none' || constraintB === 'none') {
      return true;
    }

    const horizontalCompatibilityPairs = [
      ['leftmost', 'rightmost'],
      ['rightmost', 'leftmost']
    ];

    const verticalCompatibilityPairs = [
      ['upper', 'lower'],
      ['lower', 'upper']
    ];

    const compatibilityPairs = direction === 'horizontal' ? horizontalCompatibilityPairs : verticalCompatibilityPairs;
    
    return compatibilityPairs.some(pair => 
      (constraintA === pair[0] && constraintB === pair[1])
    );
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
        meanCoordinate: this._calculateMeanCoordinateForGroup(groupElements, 'horizontal'),
        coordinateType: 'y'
      });
    });

    const verticalGroupMap = this._groupElementsByCoordinate(groupableElements, 'vertical', tolerance);
    verticalGroupMap.forEach((groupElements, meanX) => {
      verticalGroups.push({
        id: `vertical_${meanX.toFixed(1)}`,
        elements: groupElements,
        groupType: 'vertical',
        meanCoordinate: this._calculateMeanCoordinateForGroup(groupElements, 'vertical'),
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
      // Exclude endcaps from vertical groups entirely
      if (direction === 'vertical' && ElementTypeUtils.getElementCategory(element) === 'endcap') {
        continue;
      }

      const coordinate = this._calculateGroupingCoordinate(element, direction);
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
      const coord = this._calculateGroupingCoordinate(element, direction);
      if (coord !== null) coords.push(coord);
    }
    if (coords.length === 0) return 0;
    const sum = coords.reduce((acc, value) => acc + value, 0);
    return sum / coords.length;
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
    for (const groupElement of group) {
      if (!ConnectionIdentifier.elementsAreConnectionCompatible(element, groupElement, direction)) {
        return false;
      }
    }
    
    return true;
  }

}
