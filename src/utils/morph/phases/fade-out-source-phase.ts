import { ElementTypeUtils, ElementAnalyzer } from '../morph-element-utils.js';
import { BaseMorphPhase, type MorphPhaseContext } from './types.js';
import { CascadeAnimationUtils } from './utils.js';

export class FadeOutSourcePhase extends BaseMorphPhase {
  constructor() {
    super('fadeOutSource', 1);
  }

  buildAnimations(context: MorphPhaseContext) {
    const builder = this._createPhaseBuilder(context);
    const matchedTextPairs = context.matchedTextPairs || new Map<string, string>();
    const cascadePlans = context.elbowCascadePlans || new Map<string, any>();

    const topHeaderShapeMappings = ElementAnalyzer.findTopHeaderShapeMappings(
      context.sourceElements,
      context.targetElements,
      matchedTextPairs
    );
    const topHeaderShapeSourceIds = new Set<string>(Array.from(topHeaderShapeMappings.keys()));

    const preserveOpacityElementIds = new Set<string>(
      context.sourceElements
        .filter(element => Boolean((element as any).props?.cutout) && !ElementTypeUtils.elementShouldForceCutoutFade(element))
        .map(element => element.id)
    );

    const { cascadeElementIds, cascadeElbowIds } = CascadeAnimationUtils.extractCascadeElementIds(cascadePlans);
    const scheduledElementDelays = CascadeAnimationUtils.buildElementDelaySchedule(cascadePlans, matchedTextPairs);
    const planMaxEndTimes = CascadeAnimationUtils.calculateMaxCascadeEndTime(cascadePlans, matchedTextPairs);

    scheduledElementDelays.forEach((delay, elementId) => {
      if (preserveOpacityElementIds.has(elementId)) return;
      builder.addFadeOutAnimation(elementId, BaseMorphPhase.cascadeAnimationDurationSeconds, delay);
    });


    for (const element of context.sourceElements) {
      const isMatchedText = matchedTextPairs.has(element.id);
      const isInCascade = cascadeElementIds.has(element.id) || cascadeElbowIds.has(element.id);
      const isTopHeaderShape = topHeaderShapeSourceIds.has(element.id);
      if (isInCascade) continue;
      if (isMatchedText) continue;
      if (preserveOpacityElementIds.has(element.id)) continue;

      if (ElementTypeUtils.elementIsText(element)) {
        builder.addSquishAnimation(element.id, 0.15, 0.25);
        continue;
      }

      if (!ElementTypeUtils.elementIsText(element) && !isTopHeaderShape) {
        builder.addFadeOutAnimation(element.id);
      }
    }

    return builder.buildPhaseBundle(this.phaseName);
  }
}
