import type { LayoutElement } from '../../../layout/elements/element.js';
import { ElementTypeUtils } from '../morph-element-utils.js';
import { BaseMorphPhase, type ElbowCascadePlan, type ElbowCascadeDirectionPlan } from './types.js';
import { ConnectionIdentifier, type ElementGroupingResult, type GroupMatch } from '../morph-element-matcher.js';

export class ElementOrderingUtils {
  static orderGroupElementsForCascade(
    elbow: LayoutElement,
    groupElements: LayoutElement[],
    groupType: 'horizontal' | 'vertical',
    direction: 'left' | 'right' | 'up' | 'down'
  ): string[] {
    const nonElbowElements: LayoutElement[] = groupElements.filter(element => !ElementTypeUtils.elementIsElbow(element));

    if (groupType === 'horizontal') {
      const anchorX = this._calculateHorizontalAnchorX(elbow, direction as 'left' | 'right');
      const candidates = nonElbowElements
        .filter(element => this._isElementBeyondAnchor(element, 'horizontal', direction, anchorX))
        .map(element => ({ id: element.id, center: element.layout.x + element.layout.width / 2 }));

      candidates.sort((a, b) => direction === 'right' ? (b.center - a.center) : (a.center - b.center));
      return candidates.map(candidate => candidate.id);
    } else {
      const anchorY = this._calculateVerticalAnchorY(elbow, direction as 'up' | 'down');
      const candidates = nonElbowElements
        .filter(element => this._isElementBeyondAnchor(element, 'vertical', direction, anchorY))
        .map(element => ({ id: element.id, center: element.layout.y + element.layout.height / 2 }));

      candidates.sort((a, b) => direction === 'down' ? (b.center - a.center) : (a.center - b.center));
      return candidates.map(candidate => candidate.id);
    }
  }

  private static _calculateHorizontalAnchorX(elbow: LayoutElement, direction: 'left' | 'right'): number {
    const bodyWidth = ElementTypeUtils.resolveElbowBodyWidth(elbow);
    return direction === 'right'
      ? (elbow.layout.x + bodyWidth)
      : (elbow.layout.x + elbow.layout.width - bodyWidth);
  }

  private static _calculateVerticalAnchorY(elbow: LayoutElement, direction: 'up' | 'down'): number {
    const armHeight = ElementTypeUtils.resolveElbowArmHeight(elbow);
    return direction === 'down'
      ? (elbow.layout.y + armHeight)
      : (elbow.layout.y + elbow.layout.height - armHeight);
  }

  private static _isElementBeyondAnchor(
    element: LayoutElement,
    axis: 'horizontal' | 'vertical',
    direction: 'left' | 'right' | 'up' | 'down',
    anchor: number
  ): boolean {
    if (axis === 'horizontal') {
      const centerX = element.layout.x + element.layout.width / 2;
      return direction === 'right' ? centerX >= anchor : centerX <= anchor;
    }
    const centerY = element.layout.y + element.layout.height / 2;
    return direction === 'down' ? centerY >= anchor : centerY <= anchor;
  }

  static findElbowsBeyondAnchorForCascade(
    elbow: LayoutElement,
    groupElements: LayoutElement[],
    groupType: 'horizontal' | 'vertical',
    direction: 'left' | 'right' | 'up' | 'down'
  ): string[] {
    const otherElbows: LayoutElement[] = groupElements
      .filter(element => ElementTypeUtils.elementIsElbow(element) && element.id !== elbow.id);

    if (groupType === 'horizontal') {
      const anchorX = this._calculateHorizontalAnchorX(elbow, direction as 'left' | 'right');
      const candidates = otherElbows
        .filter(element => this._isElementBeyondAnchor(element, 'horizontal', direction, anchorX))
        .map(element => ({ id: element.id, center: element.layout.x + element.layout.width / 2 }));

      candidates.sort((a, b) => direction === 'right' ? (b.center - a.center) : (a.center - b.center));
      return candidates.map(candidate => candidate.id);
    } else {
      const anchorY = this._calculateVerticalAnchorY(elbow, direction as 'up' | 'down');
      const candidates = otherElbows
        .filter(element => this._isElementBeyondAnchor(element, 'vertical', direction, anchorY))
        .map(element => ({ id: element.id, center: element.layout.y + element.layout.height / 2 }));

      candidates.sort((a, b) => direction === 'down' ? (b.center - a.center) : (a.center - b.center));
      return candidates.map(candidate => candidate.id);
    }
  }
}

export class CascadeAnimationUtils {
  static buildElementDelaySchedule(
    cascadePlans: Map<string, ElbowCascadePlan>,
    matchedTextElements: Map<string, string>
  ): Map<string, number> {
    const scheduledElementDelays = new Map<string, number>();

    cascadePlans.forEach(plan => {
      const perPlanDelays = new Map<string, number>();
      
      for (const direction of plan.directions) {
        direction.orderedElementIds.forEach((elementId, index) => {
          const delay = index * (direction.stepDelaySeconds ?? BaseMorphPhase.cascadeStepDelaySeconds);
          const existingDelay = perPlanDelays.get(elementId);
          if (existingDelay === undefined || delay < existingDelay) {
            perPlanDelays.set(elementId, delay);
          }
        });
      }

      perPlanDelays.forEach((delay, elementId) => {
        const isMatchedText = matchedTextElements.has(elementId);
        if (!isMatchedText) {
          const alreadyScheduled = scheduledElementDelays.get(elementId);
          if (alreadyScheduled === undefined || delay < alreadyScheduled) {
            scheduledElementDelays.set(elementId, delay);
          }
        }
      });
    });

    return scheduledElementDelays;
  }

  static calculateMaxCascadeEndTime(
    cascadePlans: Map<string, ElbowCascadePlan>,
    matchedTextElements: Map<string, string>
  ): Map<string, number> {
    const planMaxEndTimes = new Map<string, number>();

    cascadePlans.forEach((plan, planKey) => {
      const perPlanDelays = new Map<string, number>();
      
      for (const direction of plan.directions) {
        direction.orderedElementIds.forEach((elementId, index) => {
          const delay = index * (direction.stepDelaySeconds ?? BaseMorphPhase.cascadeStepDelaySeconds);
          const existingDelay = perPlanDelays.get(elementId);
          if (existingDelay === undefined || delay < existingDelay) {
            perPlanDelays.set(elementId, delay);
          }
        });
      }

      let planMaxEnd = 0;
      perPlanDelays.forEach((delay, elementId) => {
        const isMatchedText = matchedTextElements.has(elementId);
        if (!isMatchedText) {
          const animationEndTime = delay + BaseMorphPhase.cascadeAnimationDurationSeconds;
          if (animationEndTime > planMaxEnd) {
            planMaxEnd = animationEndTime;
          }
        }
      });

      planMaxEndTimes.set(planKey, planMaxEnd);
    });

    return planMaxEndTimes;
  }

  static extractCascadeElementIds(cascadePlans: Map<string, ElbowCascadePlan>): {
    cascadeElementIds: Set<string>;
    cascadeElbowIds: Set<string>;
    targetElbowIds: Set<string>;
  } {
    const cascadeElementIds = new Set<string>();
    const cascadeElbowIds = new Set<string>();
    const targetElbowIds = new Set<string>();

    cascadePlans.forEach(plan => {
      cascadeElbowIds.add(plan.sourceElbowId);
      if (plan.targetElbowId) targetElbowIds.add(plan.targetElbowId);
      
      for (const direction of plan.directions) {
        direction.orderedElementIds.forEach(id => cascadeElementIds.add(id));
      }
    });

    return { cascadeElementIds, cascadeElbowIds, targetElbowIds };
  }
}

export class ElbowCascadePlanBuilder {
  static buildElbowCascadePlans(
    sourceGrouping: ElementGroupingResult,
    targetGrouping: ElementGroupingResult,
    groupMatches: GroupMatch[]
  ): Map<string, ElbowCascadePlan> {
    const plans = new Map<string, ElbowCascadePlan>();

    const sourceGroupsById = new Map(
      [...sourceGrouping.horizontalGroups, ...sourceGrouping.verticalGroups].map(group => [group.id, group])
    );
    const targetGroupsById = new Map(
      [...targetGrouping.horizontalGroups, ...targetGrouping.verticalGroups].map(group => [group.id, group])
    );

    for (const match of groupMatches) {
      const sourceGroup = sourceGroupsById.get(match.sourceGroupId);
      const targetGroup = targetGroupsById.get(match.targetGroupId);
      if (!sourceGroup || !targetGroup) continue;

      if (sourceGroup.elements.length <= 1) continue;

      const sourceElbows = sourceGroup.elements.filter(element => ElementTypeUtils.elementIsElbow(element));
      if (sourceElbows.length === 0) continue;

      const targetElbows = targetGroup.elements.filter(element => ElementTypeUtils.elementIsElbow(element));
      if (targetElbows.length === 0) continue;

      for (const sourceElbow of sourceElbows) {
        const compatibleTarget = targetElbows.find(targetElbow => 
          ElementTypeUtils.elbowsHaveCompatibleOrientation(sourceElbow, targetElbow)
        );
        if (!compatibleTarget) continue;

        const connections = ConnectionIdentifier.identifyElementConnections(sourceElbow).connections;
        const relevantDirections = this._resolveRelevantDirectionsForGroup(match.groupType);
        const elbowDirections = connections
          .map(connection => connection.direction)
          .filter(direction => (relevantDirections as readonly string[]).includes(direction)) as Array<'left'|'right'|'up'|'down'>;

        if (elbowDirections.length === 0) continue;

        const directionPlans: ElbowCascadeDirectionPlan[] = [];
        for (const direction of elbowDirections) {
          const orderedIds = ElementOrderingUtils.orderGroupElementsForCascade(
            sourceElbow, 
            sourceGroup.elements, 
            match.groupType, 
            direction
          );
          if (orderedIds.length === 0) continue;
          directionPlans.push({
            groupType: match.groupType,
            direction,
            orderedElementIds: orderedIds,
            stepDelaySeconds: BaseMorphPhase.cascadeStepDelaySeconds
          });
        }

        if (directionPlans.length > 0) {
          const existingPlan = plans.get(sourceElbow.id);
          if (!existingPlan) {
            plans.set(sourceElbow.id, {
              sourceElbowId: sourceElbow.id,
              targetElbowId: compatibleTarget.id,
              directions: directionPlans
            });
          } else {
            const existingKeys = new Set(existingPlan.directions.map(direction => `${direction.groupType}:${direction.direction}`));
            for (const directionPlan of directionPlans) {
              const key = `${directionPlan.groupType}:${directionPlan.direction}`;
              if (!existingKeys.has(key)) {
                existingPlan.directions.push(directionPlan);
                existingKeys.add(key);
              }
            }
            plans.set(sourceElbow.id, existingPlan);
          }
        }
      }
    }

    return plans;
  }

  private static _resolveRelevantDirectionsForGroup(groupType: 'horizontal' | 'vertical'): ReadonlyArray<'left'|'right'|'up'|'down'> {
    return groupType === 'horizontal' ? (['left', 'right'] as const) : (['up', 'down'] as const);
  }
}


