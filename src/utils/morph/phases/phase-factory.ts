import type { IMorphPhase } from './types.js';
import { FadeOutSourcePhase } from './fade-out-source-phase.js';
import { TransitionMatchedTextPhase } from './morph-phase.js';
import { FadeInTargetPhase } from './fade-in-target-phase.js';

export class MorphPhaseFactory {
  private static readonly phaseRegistry = new Map<string, () => IMorphPhase>([
    ['fadeOutSource', () => new FadeOutSourcePhase()],
    ['transitionMatchedText', () => new TransitionMatchedTextPhase()],
    ['fadeInTarget', () => new FadeInTargetPhase()]
  ]);

  static createPhase(phaseName: string): IMorphPhase | null {
    const phaseCreator = this.phaseRegistry.get(phaseName);
    return phaseCreator ? phaseCreator() : null;
  }

  static createAllStandardPhases(): IMorphPhase[] {
    return [
      new FadeOutSourcePhase(),
      new TransitionMatchedTextPhase(),
      new FadeInTargetPhase()
    ].sort((a, b) => a.phaseIndex - b.phaseIndex);
  }

  static registerCustomPhase(phaseName: string, phaseCreator: () => IMorphPhase): void {
    this.phaseRegistry.set(phaseName, phaseCreator);
  }

  static getAvailablePhaseNames(): string[] {
    return Array.from(this.phaseRegistry.keys());
  }
}


