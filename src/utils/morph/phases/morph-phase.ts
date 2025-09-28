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

      if (!ElementTypeUtils.elementIsText(targetElement)) {
        const targetPath = this._resolveTargetPath(context, targetId);
        builder.addPathMorphAnimation(sourceId, targetPath);
      }

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

      const targetPath = this._resolveTargetPath(context, dstId);
      builder.addPathMorphAnimation(srcId, targetPath);

      try {
        builder.addShapeStyleAnimation(srcId, dstId);
      } catch {}
    });

    const cascadePlans = context.elbowCascadePlans || new Map<string, any>();
    cascadePlans.forEach((plan) => {
      const targetElbow = context.targetElements.find(element => element.id === plan.targetElbowId);
      if (!targetElbow) return;
      const targetPath = this._resolveTargetPath(context, plan.targetElbowId);
      builder.addPathMorphAnimation(plan.sourceElbowId, targetPath);

      // Transition elbow color to match target elbow
      try {
        if (plan.targetElbowId) {
          builder.addShapeStyleAnimation(plan.sourceElbowId, plan.targetElbowId);
        }
      } catch {}
    });

    return builder.buildPhaseBundle(this.phaseName);
}

  private _resolveTargetPath(
    context: MorphPhaseContext,
    targetElementId: string
  ): string {
    const clone = context.targetCloneElementsById?.get(targetElementId);
    const clonePath = clone ? this._extractPathDataFromClone(clone, targetElementId) : null;
    if (clonePath) {
      return clonePath;
    }

    throw new Error(`Morph target path missing for ${targetElementId}`);
  }

  private _extractPathDataFromClone(cloneElement: Element, originalElementId: string): string | null {
    try {
      const tag = (cloneElement as any).tagName ? String((cloneElement as any).tagName).toLowerCase() : '';
      if (tag === 'path') {
        const directPath = (cloneElement as SVGPathElement).getAttribute('d');
        return directPath ?? null;
      }

      const selector = `[id="${originalElementId}__shape"]`;
      const path = cloneElement.querySelector(selector) as SVGPathElement | null;
      if (path) {
        return path.getAttribute('d');
      }

      const anyPath = cloneElement.querySelector('path') as SVGPathElement | null;
      return anyPath?.getAttribute('d') ?? null;
    } catch {
      return null;
    }
  }
}
