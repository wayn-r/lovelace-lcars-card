import { ElementTypeUtils } from '../morph-element-utils.js';
import { BaseMorphPhase, type MorphPhaseContext } from './types.js';

export class TransitionMatchedTextPhase extends BaseMorphPhase {
  constructor() {
    super('transitionMatchedText', 2);
  }

  buildAnimations(context: MorphPhaseContext) {
    const builder = this._createPhaseBuilder(context);
    const matchedTextPairs = context.matchedTextPairs || new Map<string, string>();

    const sourceElementsById = new Map(context.sourceElements.map(element => [element.id, element] as const));
    const targetElementsById = new Map(context.targetElements.map(element => [element.id, element] as const));

    matchedTextPairs.forEach((targetId, sourceId) => {
      const sourceElement = sourceElementsById.get(sourceId);
      const targetElement = targetElementsById.get(targetId);
      if (!sourceElement || !targetElement) return;

      try {
        const targetPath = ElementTypeUtils.generatePathForElement(targetElement);
        if (targetPath) builder.addPathMorphAnimation(sourceId, targetPath);
      } catch {}

      builder.addTextStyleAnimation(sourceId, targetId);
    });

    const cascadePlans = context.elbowCascadePlans || new Map<string, any>();
    cascadePlans.forEach((plan) => {
      const targetElbow = context.targetElements.find(element => element.id === plan.targetElbowId);
      if (!targetElbow) return;
      try {
        const targetPath = ElementTypeUtils.generatePathForElement(targetElbow);
        builder.addPathMorphAnimation(plan.sourceElbowId, targetPath);
      } catch {}

      // Transition elbow color to match target elbow
      try {
        if (plan.targetElbowId) {
          builder.addShapeStyleAnimation(plan.sourceElbowId, plan.targetElbowId);
        }
      } catch {}
    });

    return builder.buildPhaseBundle(this.phaseName);
  }
}


