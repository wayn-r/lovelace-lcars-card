import { ElementTypeUtils, ElementAnalyzer } from '../morph-element-utils.js';
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

      const preserveMaskFill = ElementTypeUtils.elementUsesCutoutMask(sourceElement) || ElementTypeUtils.elementUsesCutoutMask(targetElement);
      builder.addTextStyleAnimation(sourceId, targetId, { preserveMaskFill });

    });

    const topHeaderShapeMappings = ElementAnalyzer.findTopHeaderShapeMappings(
      context.sourceElements,
      context.targetElements,
      matchedTextPairs
    );

    topHeaderShapeMappings.forEach((dstId, srcId) => {
      const srcEl = sourceElementsById.get(srcId);
      const dstEl = targetElementsById.get(dstId);
      if (!srcEl || !dstEl) return;

      try {
        const targetPath = ElementTypeUtils.generatePathForElement(dstEl);
        if (targetPath) builder.addPathMorphAnimation(srcId, targetPath);
      } catch {}

      try {
        builder.addShapeStyleAnimation(srcId, dstId);
      } catch {}
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
