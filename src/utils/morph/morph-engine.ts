import type { LcarsCardConfig } from '../../types.js';
import { ConfigParser } from '../../layout/parser.js';
import { Group, LayoutEngine } from '../../layout/engine.js';
import type { LayoutElement } from '../../layout/elements/element.js';
import { Diagnostics } from '../diagnostics.js';
import { ElementAnalyzer, ElementTypeUtils } from './morph-element-utils.js';
import { DestinationResolver, type ContainerResizeRequirement } from './morph-destination-resolver.js';
import { ElementMatcher, ElementGrouper, ConnectionIdentifier, type ElementGroupingResult, type GroupMatchingOptions, type GroupMatch, type ElementGroup as MatcherElementGroup } from './morph-element-matcher.js';
import { MorphDebugger } from './morph-debug.js';
import { 
  AnimationBuilder, 
  MorphAnimationOrchestrator, 
  type PhaseAnimationBundle, 
  type MorphAnimationContext 
} from './morph-animation-builder';
import { MorphUtilities, ValidationUtils, TimeUtils } from './morph-utilities.js';
import { MorphPhaseFactory } from './phases/phase-factory.js';
import type { IMorphPhase, MorphPhaseContext, ElbowCascadePlan } from './phases/types.js';
import { ElbowCascadePlanBuilder } from './phases/utils.js';
import gsap from 'gsap';

const logger = Diagnostics.create('MorphEngine');

export interface MorphEngineOptions {
  durationMs?: number;
  transitionName?: string;
  easing?: string;
  textMatchMaxDeltaX?: number;
  textMatchMaxDeltaY?: number;
  debugMorph?: boolean;
  groupMatchPositionTolerance?: number;
  groupMatchSizeToleranceRatio?: number;
}

export interface MorphEngineHooks {
  getShadowElement: (id: string) => Element | null;
  requestUpdate: () => void;
  setCalculatedHeight?: (height: number) => void;
  getContainerRect: () => DOMRect | undefined;
  getCurrentGroups: () => Group[];
  getAnimationManager: () => import('../animation.js').AnimationManager;
  getAnimationContext: () => import('../animation.js').AnimationContext;
  expandCanvasTo?: (width: number, height: number) => void;
}


export class MorphEngine {
  private static readonly defaultPhaseDurationSeconds: number = 0.5;
  

  static getPhaseDurationSeconds(): number { 
    return this.defaultPhaseDurationSeconds; 
  }

  static async morphToNavigationPath(
    hooks: MorphEngineHooks,
    navigationPath: string,
    homeAssistant?: import('custom-card-helpers').HomeAssistant,
    options: MorphEngineOptions = {}
  ): Promise<void> {
    try {
      const mergedOptions: MorphEngineOptions = { ...options };
      const destinationResult = await DestinationResolver.resolveConfigurationFromNavigationPath(
        navigationPath, 
        homeAssistant
      );
    
      if (destinationResult.isValid) {
        await this._morphToConfiguration(hooks, destinationResult.config, homeAssistant, mergedOptions);
      } else {
        logger.warn(`Could not resolve valid configuration from navigation path: ${navigationPath}`);
      }
    } catch (error) {
      logger.warn(`Error during navigation path morph: ${navigationPath}`, error);
    }
  }

  static async _morphToConfiguration(
    hooks: MorphEngineHooks,
    targetConfiguration: LcarsCardConfig,
    homeAssistant?: import('custom-card-helpers').HomeAssistant,
    options: MorphEngineOptions = {}
  ): Promise<void> {
    const sourceGroups = hooks.getCurrentGroups();

    if (!sourceGroups.some(group => ValidationUtils.groupHasValidElements(group))) {
      logger.warn('No valid source groups available for morphing.');
      return;
    }

    const targetGroups = this._createTargetGroups(targetConfiguration, homeAssistant, hooks);
    const containerRect = hooks.getContainerRect();
    
    if (!ValidationUtils.containerRectIsValid(containerRect)) {
      logger.warn('Invalid container dimensions; skipping morph.');
      return;
    }

    const resizeResult = await this._ensureContainerCanAccommodateTargets(
      hooks, 
      sourceGroups, 
      targetGroups, 
      containerRect
    );

    const sourceElements = this._extractValidElements(sourceGroups);
    const targetElements = this._extractValidElements(targetGroups);
    const elementMapping = ElementMatcher.createElementMappings(sourceGroups, targetGroups);    

    const utilities = new MorphUtilities();
    const svgRoot = utilities.locateSvgRoot(sourceElements, hooks.getShadowElement);
    if (!svgRoot) {
      return;
    }

    await this._executeMorphPipeline(
      hooks,
      svgRoot,
      sourceElements,
      targetElements,
      elementMapping,
      options
    );
  }

  private static _createTargetGroups(
    targetConfiguration: LcarsCardConfig,
    homeAssistant: import('custom-card-helpers').HomeAssistant | undefined,
    hooks: MorphEngineHooks
  ): Group[] {
    return ConfigParser.parseConfig(
      targetConfiguration,
      homeAssistant,
      hooks.requestUpdate,
      hooks.getShadowElement,
      undefined
    );
  }

  private static async _ensureContainerCanAccommodateTargets(
    hooks: MorphEngineHooks,
    sourceGroups: Group[],
    targetGroups: Group[],
    currentContainerRect: DOMRect
  ): Promise<{ containerRect: DOMRect; sourceBounds: any; targetBounds: any }> {
    const tempEngine = new LayoutEngine();
    tempEngine.setGroups(targetGroups);
    let targetBounds = tempEngine.recalculate(currentContainerRect, { dynamicHeight: true });
    
    const sourceEngine = new LayoutEngine();
    sourceEngine.setGroups(sourceGroups);
    let sourceBounds = sourceEngine.recalculate(currentContainerRect, { dynamicHeight: true });

    const resizeRequirement = DestinationResolver.determineContainerResizeRequirement(
      currentContainerRect,
      sourceBounds,
      targetBounds
    );

    let finalContainerRect = currentContainerRect;

    if (resizeRequirement.shouldExpand) {
      try {
        hooks.expandCanvasTo?.(resizeRequirement.requiredWidth, resizeRequirement.requiredHeight);
        hooks.setCalculatedHeight?.(resizeRequirement.requiredHeight);
        hooks.requestUpdate();
      } catch (error) {
        logger.warn('Failed to expand canvas', error);
      }

      try {
        const expandedRect = await DestinationResolver.waitForContainerToMeetMinimumHeight(
          hooks.getContainerRect,
          resizeRequirement.requiredHeight,
          600
        );
        finalContainerRect = expandedRect || currentContainerRect;

        // CRITICAL: Recalculate layouts with the new container dimensions
        if (expandedRect) {
          targetBounds = tempEngine.recalculate(expandedRect, { dynamicHeight: true });
          sourceBounds = sourceEngine.recalculate(expandedRect, { dynamicHeight: true });
        }
      } catch (error) {
        logger.warn('Failed to wait for container expansion', error);
      }
    }

    return { containerRect: finalContainerRect, sourceBounds, targetBounds };
  }

  private static _debugModeIsEnabled(options: MorphEngineOptions): boolean {
    return Boolean(options.debugMorph);
  }

  private static _createGroupMatchingOptions(options: MorphEngineOptions): GroupMatchingOptions {
    return {
      positionTolerance: options.groupMatchPositionTolerance ?? 50,
      sizeToleranceRatio: options.groupMatchSizeToleranceRatio ?? 0.8
    };
  }


  private static _extractValidElements(groups: Group[]): LayoutElement[] {
    return ElementAnalyzer.collectLayoutElements(groups).filter(element => 
      ValidationUtils.elementLayoutIsCalculated(element)
    );
  }


  private static async _executeMorphPipeline(
    hooks: MorphEngineHooks,
    svgRoot: SVGSVGElement,
    sourceElements: LayoutElement[],
    targetElements: LayoutElement[],
    elementMapping: Map<string, string>,
    options: MorphEngineOptions = {}
  ): Promise<void> {
    const utilities = new MorphUtilities();
    
    const { overlay, cloneElementsById: sourceCloneElementsById, hiddenOriginalElements } = utilities.createOverlayWithClones(
      svgRoot,
      sourceElements,
      hooks.getShadowElement,
      hooks.getAnimationContext()
    );

    const targetCloneElementsById = this._createTargetElementClones(
      overlay,
      targetElements,
      hooks.getAnimationContext()
    );

    const allCloneElementsById = new Map<string, Element>([
      ...targetCloneElementsById,
      ...sourceCloneElementsById
    ]);

    const animationContext: MorphAnimationContext = {
      sourceElements,
      targetElements,
      elementMapping,
      cloneElementsById: allCloneElementsById,
      sourceCloneElementsById,
      targetCloneElementsById,
      overlay
    };

    // Group elements by alignment
    const sourceGrouping = ElementGrouper.groupElementsByAlignment(sourceElements, 2);
    const targetGrouping = ElementGrouper.groupElementsByAlignment(targetElements, 2);
    
    // Match groups between source and target layouts
    const groupMatchingOptions = this._createGroupMatchingOptions(options);
    const groupMatches = ElementMatcher.matchElementGroups(sourceGrouping, targetGrouping, groupMatchingOptions);
    
    (animationContext as any).__sourceGrouping = sourceGrouping;
    (animationContext as any).__targetGrouping = targetGrouping;
    (animationContext as any).__groupMatches = groupMatches;
    const elbowPlans = ElbowCascadePlanBuilder.buildElbowCascadePlans(
      sourceGrouping,
      targetGrouping,
      groupMatches
    );
    (animationContext as any).__elbowCascadePlans = elbowPlans;
    (animationContext as any).debugMorph = this._debugModeIsEnabled(options);

    if (this._debugModeIsEnabled(options)) {
      MorphDebugger.logElbowCascadePlans(elbowPlans, sourceGrouping, targetGrouping);
    }
    
    if (this._debugModeIsEnabled(options)) {
      await MorphDebugger.visualizeElementGroups(svgRoot, sourceGrouping);
      MorphDebugger.logGroupMatches(groupMatches, sourceGrouping, targetGrouping);
    }
    
    // Phase 0: Match components
    // Determine matched text pairs to preserve during fade-out and transition them
    const matchedTextPairs = ElementAnalyzer.findMatchingText(
      sourceElements,
      targetElements
    );

    (animationContext as any).__matchedTextPairs = matchedTextPairs;
    const morphPhases = this._createMorphPhases();    
    await this._executeAnimationPhases(morphPhases, animationContext, hooks);    
    
    utilities.scheduleOverlayCleanup(overlay, hiddenOriginalElements, this.defaultPhaseDurationSeconds * morphPhases.length);
  }
  


  private static _createMorphPhases(): IMorphPhase[] {
    return MorphPhaseFactory.createAllStandardPhases();
  }
  
    private static _createTargetElementClones(
      overlay: SVGGElement,
      targetElements: LayoutElement[],
      animationContext: import('../animation.js').AnimationContext
    ): Map<string, Element> {
      const utilities = new MorphUtilities();
      const targetCloneElementsById = new Map<string, Element>();
  
      for (const element of targetElements) {
        // Create synthetic elements for target elements since they don't exist in the DOM yet
        const syntheticElement = utilities.createSyntheticElement(element, animationContext);
        if (syntheticElement) {
          overlay.appendChild(syntheticElement);
          targetCloneElementsById.set(element.id, syntheticElement);
        }
      }
  
      return targetCloneElementsById;
    }
  
  private static async _executeAnimationPhases(
    morphPhases: IMorphPhase[],
    animationContext: MorphAnimationContext,
    hooks: MorphEngineHooks
  ): Promise<void> {
    const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
    let currentStartTime = 0;
    const debug = Boolean((animationContext as any).debugMorph);
    
    for (const morphPhase of morphPhases) {
      const phaseContext: MorphPhaseContext = {
        sourceElements: animationContext.sourceElements,
        targetElements: animationContext.targetElements,
        elementMapping: animationContext.elementMapping,
        phaseDuration: this.defaultPhaseDurationSeconds,
        matchedTextPairs: (animationContext as any).__matchedTextPairs as Map<string, string> | undefined,
        sourceGrouping: (animationContext as any).__sourceGrouping as ElementGroupingResult | undefined,
        targetGrouping: (animationContext as any).__targetGrouping as ElementGroupingResult | undefined,
        groupMatches: (animationContext as any).__groupMatches as GroupMatch[] | undefined,
        elbowCascadePlans: (animationContext as any).__elbowCascadePlans as Map<string, ElbowCascadePlan> | undefined,
        debugMorph: Boolean((animationContext as any).debugMorph)
      };

      const phaseBundle: PhaseAnimationBundle = morphPhase.buildAnimations(phaseContext);
      if (debug) {
        const ids = phaseBundle.simultaneousAnimations.map(animation => animation.targetElementId);
        logger.info('[Morph Debug] schedule phase', {
          phase: morphPhase.phaseName,
          startAt: currentStartTime.toFixed(2),
          duration: phaseBundle.totalPhaseDuration,
          count: ids.length,
          sampleIds: ids.slice(0, 10)
        } as any);
      }
      const phaseDuration = MorphAnimationOrchestrator.executePhaseBundle(
        timeline,
        phaseBundle,
        currentStartTime,
        animationContext
      );

      currentStartTime += phaseDuration;
    }

    await TimeUtils.waitFor(currentStartTime + 0.05); // Small buffer for completion
    if (debug) {
      logger.info('[Morph Debug] all phases complete', { totalDuration: currentStartTime } as any);
    }
  }

}
