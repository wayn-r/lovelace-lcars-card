import type { LayoutElement } from '../../../layout/elements/element.js';
import type { ElementGroupingResult, GroupMatch } from '../morph-element-matcher.js';
import { AnimationBuilder, type PhaseAnimationBundle } from '../morph-animation-builder';

export interface IMorphPhase {
  readonly phaseName: string;
  readonly phaseIndex: number;
  buildAnimations(context: MorphPhaseContext): PhaseAnimationBundle;
}

export interface MorphPhaseContext {
  sourceElements: LayoutElement[];
  targetElements: LayoutElement[];
  elementMapping: Map<string, string>;
  phaseDuration: number;
  suppressedElementIds?: Set<string>;
  expandedElementData?: Map<string, { expandedScaleX: number; side: 'left' | 'right' }>;
  matchedTextPairs?: Map<string, string>;
  sourceGrouping?: ElementGroupingResult;
  targetGrouping?: ElementGroupingResult;
  groupMatches?: GroupMatch[];
  elbowCascadePlans?: Map<string, ElbowCascadePlan>;
  debugMorph?: boolean;
  cloneElementsById?: Map<string, Element>;
  sourceCloneElementsById?: Map<string, Element>;
  targetCloneElementsById?: Map<string, Element>;
}

export type ElbowCascadeDirectionPlan = {
  groupType: 'horizontal' | 'vertical';
  direction: 'left' | 'right' | 'up' | 'down';
  orderedElementIds: string[];
  stepDelaySeconds?: number;
};

export type ElbowCascadePlan = {
  sourceElbowId: string;
  targetElbowId: string;
  directions: ElbowCascadeDirectionPlan[];
};

export abstract class BaseMorphPhase implements IMorphPhase {
  public static readonly cascadeStepDelaySeconds: number = 0.12;
  public static readonly cascadeAnimationDurationSeconds: number = 0.12;

  constructor(
    public readonly phaseName: string,
    public readonly phaseIndex: number
  ) {}

  abstract buildAnimations(context: MorphPhaseContext): PhaseAnimationBundle;

  protected _createPhaseBuilder(context: MorphPhaseContext): AnimationBuilder {
    return AnimationBuilder.createForPhase(this.phaseName, context.phaseDuration);
  }
}

