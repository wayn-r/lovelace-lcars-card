import { ElementTypeUtils } from '../morph-element-utils.js';
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

    const { cascadeElementIds, cascadeElbowIds } = CascadeAnimationUtils.extractCascadeElementIds(cascadePlans);
    const scheduledElementDelays = CascadeAnimationUtils.buildElementDelaySchedule(cascadePlans, matchedTextPairs);
    const planMaxEndTimes = CascadeAnimationUtils.calculateMaxCascadeEndTime(cascadePlans, matchedTextPairs);

    scheduledElementDelays.forEach((delay, elementId) => {
      builder.addFadeOutAnimation(elementId, BaseMorphPhase.cascadeAnimationDurationSeconds, delay);
    });


    for (const element of context.sourceElements) {
      const isMatchedText = matchedTextPairs.has(element.id);
      const isInCascade = cascadeElementIds.has(element.id) || cascadeElbowIds.has(element.id);
      if (isInCascade) continue;

      if (!isMatchedText && ElementTypeUtils.elementIsText(element)) {
        builder.addSquishAnimation(element.id, 0.15, 0.25);
        continue;
      }

      if (!ElementTypeUtils.elementIsText(element)) {
        builder.addFadeOutAnimation(element.id);
      }
    }

    return builder.buildPhaseBundle(this.phaseName);
  }
}


