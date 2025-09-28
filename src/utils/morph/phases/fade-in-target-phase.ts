import { ElementTypeUtils, ElementAnalyzer } from '../morph-element-utils.js';
import { BaseMorphPhase, type MorphPhaseContext } from './types.js';
import { ElementOrderingUtils } from './utils.js';
import type { LayoutElement } from '../../../layout/elements/element.js';
import type { AnimationBuilder } from '../morph-animation-builder.js';

export class FadeInTargetPhase extends BaseMorphPhase {
  constructor() {
    super('fadeInTarget', 3);
  }

  buildAnimations(context: MorphPhaseContext) {
    const builder = this._createPhaseBuilder(context);
    const matchedTextPairs = context.matchedTextPairs || new Map<string, string>();
    const cascadePlans = context.elbowCascadePlans || new Map<string, any>();

    const matchedTargetIds = new Set<string>(Array.from(matchedTextPairs.values()));

    context.elementMapping.forEach(targetId => {
      if (targetId) {
        matchedTargetIds.add(targetId);
      }
    });

    const topHeaderShapeMappings = ElementAnalyzer.findTopHeaderShapeMappings(
      context.sourceElements,
      context.targetElements,
      matchedTextPairs
    );
    topHeaderShapeMappings.forEach((dstId) => matchedTargetIds.add(dstId));
    cascadePlans.forEach(plan => { if (plan.targetElbowId) matchedTargetIds.add(plan.targetElbowId); });

    const cascadeTargetElementIds = new Set<string>();
    const scheduledTargetDelays = new Map<string, number>();

    cascadePlans.forEach(plan => {
      const targetElbow = context.targetElements.find(element => element.id === plan.targetElbowId);
      if (!targetElbow) return;

      // Schedule cascades for directions provided by the plan
      for (const direction of plan.directions) {
        this._scheduleCascadeForGroup(
          context,
          builder,
          targetElbow,
          direction.groupType,
          direction.direction,
          direction.stepDelaySeconds,
          matchedTargetIds,
          scheduledTargetDelays,
          cascadeTargetElementIds,
          0
        );
      }

      // If the plan only matched one orientation, also propagate along the orthogonal target group
      const presentTypes = new Set(plan.directions.map((d: any) => d.groupType as 'horizontal' | 'vertical'));
      const allTypes: Array<'horizontal' | 'vertical'> = ['horizontal', 'vertical'];
      const missingTypes = allTypes.filter(t => !presentTypes.has(t));

      for (const missingType of missingTypes) {
        // Only schedule if the target has a corresponding group containing this elbow
        const targetGroup = this._findGroupContainingElement(context.targetGrouping, missingType, plan.targetElbowId);
        if (!targetGroup || targetGroup.elements.length <= 1) continue;

        const directions: Array<'left' | 'right' | 'up' | 'down'> = missingType === 'horizontal'
          ? ['left', 'right']
          : ['up', 'down'];

        for (const dir of directions) {
          this._scheduleCascadeForGroup(
            context,
            builder,
            targetElbow,
            missingType,
            dir,
            undefined,
            matchedTargetIds,
            scheduledTargetDelays,
            cascadeTargetElementIds,
            0
          );
        }

        // Traverse to elbows beyond anchor and cascade their orthogonal groups as well (avoids stopping at first elbow)
        const visited = new Set<string>([targetElbow.id]);
        for (const dir of directions) {
          this._traverseElbowsAndCascade(
            context,
            builder,
            targetElbow,
            missingType,
            dir,
            matchedTargetIds,
            scheduledTargetDelays,
            cascadeTargetElementIds,
            visited,
            0
          );
        }
      }
    });

    // Ensure unmatched fades wait until cascades complete
    let maxCascadeEndTime = 0;
    scheduledTargetDelays.forEach(delay => {
      const end = delay + BaseMorphPhase.cascadeAnimationDurationSeconds;
      if (end > maxCascadeEndTime) maxCascadeEndTime = end;
    });

    for (const element of context.targetElements) {
      if (matchedTargetIds.has(element.id)) continue;
      if (cascadeTargetElementIds.has(element.id)) continue;
      const delay = maxCascadeEndTime;
      if (ElementTypeUtils.elementIsText(element)) {
        builder.addReverseSquishAnimation(element.id, 0.15, delay);
      } else {
        builder.addFadeInAnimation(element.id, delay);
      }
    }

    return builder.buildPhaseBundle(this.phaseName);
  }

  private _findGroupContainingElement(
    grouping: any,
    groupType: 'horizontal' | 'vertical',
    elementId: string
  ): any {
    if (!grouping) return undefined;
    const groups = groupType === 'horizontal' ? grouping.horizontalGroups : grouping.verticalGroups;
    return groups.find((group: any) => group.elements.some((element: any) => element.id === elementId));
  }

  private _scheduleCascadeForGroup(
    context: MorphPhaseContext,
    builder: AnimationBuilder,
    targetElbow: LayoutElement,
    groupType: 'horizontal' | 'vertical',
    direction: 'left' | 'right' | 'up' | 'down',
    stepDelaySeconds: number | undefined,
    matchedTargetIds: Set<string>,
    scheduledTargetDelays: Map<string, number>,
    cascadeTargetElementIds: Set<string>,
    baseDelaySeconds: number
  ): void {
    const targetGroup = this._findGroupContainingElement(context.targetGrouping, groupType, targetElbow.id);
    if (!targetGroup || targetGroup.elements.length <= 1) return;

    const orderedFarToNear = ElementOrderingUtils.orderGroupElementsForCascade(
      targetElbow,
      targetGroup.elements,
      groupType,
      direction
    );
    if (orderedFarToNear.length === 0) return;

    const orderedNearToFar = [...orderedFarToNear].reverse();
    for (let index = 0; index < orderedNearToFar.length; index++) {
      const id = orderedNearToFar[index];
      if (matchedTargetIds.has(id)) {
        break;
      }

      const delay = baseDelaySeconds + index * (stepDelaySeconds ?? BaseMorphPhase.cascadeStepDelaySeconds);
      const existing = scheduledTargetDelays.get(id);
      if (existing !== undefined && existing <= delay) return;
      scheduledTargetDelays.set(id, delay);
      cascadeTargetElementIds.add(id);
      const tgt = context.targetElements.find(e => e.id === id);
      if (tgt && ElementTypeUtils.elementIsText(tgt)) {
        builder.addReverseSquishAnimation(id, 0.15, delay);
      } else {
        builder.addFadeInAnimation(id, delay);
      }
    }
  }

  private _traverseElbowsAndCascade(
    context: MorphPhaseContext,
    builder: AnimationBuilder,
    startElbow: LayoutElement,
    groupType: 'horizontal' | 'vertical',
    direction: 'left' | 'right' | 'up' | 'down',
    matchedTargetIds: Set<string>,
    scheduledTargetDelays: Map<string, number>,
    cascadeTargetElementIds: Set<string>,
    visitedElbowIds: Set<string>,
    accumulatedStepIndex: number
  ): void {
    const group = this._findGroupContainingElement(context.targetGrouping, groupType, startElbow.id);
    if (!group || group.elements.length <= 1) return;

    const elbowIdsFarToNear = ElementOrderingUtils.findElbowsBeyondAnchorForCascade(startElbow, group.elements, groupType, direction);
    if (elbowIdsFarToNear.length === 0) return;

    const elbowsNearToFar = [...elbowIdsFarToNear].reverse();
    for (let i = 0; i < elbowsNearToFar.length; i++) {
      const elbowId = elbowsNearToFar[i];
      if (matchedTargetIds.has(elbowId)) {
        break;
      }

      if (visitedElbowIds.has(elbowId)) continue;
      visitedElbowIds.add(elbowId);
      const elbowEl = context.targetElements.find(e => e.id === elbowId);
      if (!elbowEl) continue;

      // Schedule the elbow itself to fade in as part of the cascade
      const elbowDelay = (accumulatedStepIndex + i) * BaseMorphPhase.cascadeStepDelaySeconds;
      const existingElbowDelay = scheduledTargetDelays.get(elbowId);
      if (existingElbowDelay === undefined || elbowDelay < existingElbowDelay) {
        scheduledTargetDelays.set(elbowId, elbowDelay);
        cascadeTargetElementIds.add(elbowId);
        builder.addFadeInAnimation(elbowId, elbowDelay);
      }

      // Schedule along this same group beyond this elbow (continue the line)
      this._scheduleCascadeForGroup(
        context,
        builder,
        elbowEl,
        groupType,
        direction,
        undefined,
        matchedTargetIds,
        scheduledTargetDelays,
        cascadeTargetElementIds,
        elbowDelay + BaseMorphPhase.cascadeStepDelaySeconds
      );

      // Also cascade into the orthogonal group at this elbow
      const orthogonal: 'horizontal' | 'vertical' = groupType === 'horizontal' ? 'vertical' : 'horizontal';
      const orthogonalDirs: Array<'left' | 'right' | 'up' | 'down'> = orthogonal === 'horizontal' ? ['left', 'right'] : ['up', 'down'];
      for (const ortDir of orthogonalDirs) {
        this._scheduleCascadeForGroup(
          context,
          builder,
          elbowEl,
          orthogonal,
          ortDir,
          undefined,
          matchedTargetIds,
          scheduledTargetDelays,
          cascadeTargetElementIds,
          elbowDelay + BaseMorphPhase.cascadeStepDelaySeconds
        );
      }

      // Continue traversing in the same direction along the same group
      this._traverseElbowsAndCascade(
        context,
        builder,
        elbowEl,
        groupType,
        direction,
        matchedTargetIds,
        scheduledTargetDelays,
        cascadeTargetElementIds,
        visitedElbowIds,
        accumulatedStepIndex + i + 1
      );
    }
  }
}
