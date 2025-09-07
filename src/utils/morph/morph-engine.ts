import type { LcarsCardConfig } from '../../types.js';
import { ConfigParser } from '../../layout/parser.js';
import { Group, LayoutEngine } from '../../layout/engine.js';
import type { LayoutElement } from '../../layout/elements/element.js';
import { Diagnostics } from '../diagnostics.js';
import { ElementAnalyzer, ElementTypeUtils } from './morph-element-utils.js';
import { DestinationResolver, type ContainerResizeRequirement } from './morph-destination-resolver.js';
import { ElementMatcher } from './morph-element-matcher.js';
import { 
  AnimationBuilder, 
  MorphAnimationOrchestrator, 
  type PhaseAnimationBundle, 
  type MorphAnimationContext 
} from './morph-animation-builder';
import { MorphUtilities, ValidationUtils, TimeUtils } from './morph-utilities.js';
import gsap from 'gsap';

const logger = Diagnostics.create('MorphEngine');



export interface MorphEngineOptions {
  durationMs?: number;
  transitionName?: string;
  easing?: string;
  textMatchMaxDeltaX?: number;
  textMatchMaxDeltaY?: number;
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

export interface MorphPhaseConfiguration {
  phaseName: string;
  phaseIndex: number;
  isEnabled: boolean;
  animationBuilder: (context: MorphPhaseContext) => PhaseAnimationBundle;
}

export interface MorphPhaseContext {
  sourceElements: LayoutElement[];
  targetElements: LayoutElement[];
  elementMapping: Map<string, string>;
  phaseDuration: number;
  suppressedElementIds?: Set<string>;
  expandedElementData?: Map<string, { expandedScaleX: number; side: 'left' | 'right' }>;
  matchedTextPairs?: Map<string, string>;
  
}

export class MorphEngine {
  private static readonly defaultPhaseDurationSeconds: number = 1.0;
  

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
      hooks.getShadowElement
    );

    const targetCloneElementsById = this._createTargetElementClones(
      overlay,
      targetElements,
      hooks.getAnimationContext()
    );

    // Combined map retained for backward compatibility only; keep both separate maps to avoid ID collisions
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
    
    // Phase 0: Match components
    // Determine matched text pairs to preserve during fade-out and transition them
    const matchedTextPairs = ElementAnalyzer.findMatchingText(
      sourceElements,
      targetElements
    );

    (animationContext as any).__matchedTextPairs = matchedTextPairs;
    const phaseConfigurations = this._createPhaseConfigurations();    
    await this._executeAnimationPhases(phaseConfigurations, animationContext, hooks);    
    utilities.scheduleOverlayCleanup(overlay, hiddenOriginalElements, this.defaultPhaseDurationSeconds * phaseConfigurations.length);
  }
  
  private static _createPhaseConfigurations(): MorphPhaseConfiguration[] {
    const configs: MorphPhaseConfiguration[] = [];

    
    // Phase 1: Fade out all source elements (skip matched texts)
    configs.push({
      phaseName: 'fadeOutSource',
      phaseIndex: 1,
      isEnabled: true,
      animationBuilder: (context) => {
        const builder = AnimationBuilder.createForPhase('fadeOutSource', context.phaseDuration);
        // match text pairs
        const matchedText = context.matchedTextPairs || new Map<string, string>();
        for (const element of context.sourceElements) {
          const isMatchedText = matchedText.has(element.id);
          if (!isMatchedText && ElementTypeUtils.elementIsText(element)) builder.addSquishAnimation(element.id, 0.15, 0.25);
          if (!ElementTypeUtils.elementIsText(element)) builder.addFadeOutAnimation(element.id);
        }
        return builder.buildPhaseBundle('fadeOutSource');
      }
    });
    
    // Phase 2: Transition matched texts to destination positions
    configs.push({
      phaseName: 'transitionMatchedText',
      phaseIndex: 2,
      isEnabled: true,
      animationBuilder: (context) => {
        const builder = AnimationBuilder.createForPhase('transitionMatchedText', context.phaseDuration);
        const matched = context.matchedTextPairs || new Map<string, string>();
        if (matched.size === 0) return builder.buildPhaseBundle('transitionMatchedText');
        
        const sourceById = new Map(context.sourceElements.map(e => [e.id, e] as const));
        const targetById = new Map(context.targetElements.map(e => [e.id, e] as const));
        
        matched.forEach((destId, sourceId) => {
          const src = sourceById.get(sourceId);
          const dst = targetById.get(destId);
          if (!src || !dst) return;

          // Do NOT apply transform for matched text; x/y will be aligned via attribute tween
          // Attempt minor shape morph to accommodate subtle size/radius differences
          try {
            const targetPath = ElementTypeUtils.generatePathForElement(dst);
            if (targetPath) builder.addPathMorphAnimation(sourceId, targetPath);
          } catch {}

          // Animate text style/attributes (font, size, spacing, anchor, baseline, color, position)
          builder.addTextStyleAnimation(sourceId, destId);
        });
        
        return builder.buildPhaseBundle('transitionMatchedText');
      }
    });
    
    // Phase 3: Fade in all target elements (skip matched texts to avoid double-visibility)
    configs.push({
      phaseName: 'fadeInTarget',
      phaseIndex: 3,
      isEnabled: true,
      animationBuilder: (context) => {
        const builder = AnimationBuilder.createForPhase('fadeInTarget', context.phaseDuration);
        const matched = context.matchedTextPairs || new Map<string, string>();
        const matchedTargetIds = new Set<string>(Array.from(matched.values()));
        for (const element of context.targetElements) {
          if (matchedTargetIds.has(element.id)) continue;
          if (ElementTypeUtils.elementIsText(element)) {
            // Reverse of phase 1 squish: bring back unmatched text via reverse squish
            builder.addReverseSquishAnimation(element.id, 0.15, 0.75);
          } else {
            builder.addFadeInAnimation(element.id);
          }
        }
        return builder.buildPhaseBundle('fadeInTarget');
      }
    });
    
    return configs.filter(config => config.isEnabled).sort((a, b) => a.phaseIndex - b.phaseIndex);
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
          // Start target elements as invisible for fade-in effect
          (syntheticElement as any).style.opacity = '0';
          overlay.appendChild(syntheticElement);
          targetCloneElementsById.set(element.id, syntheticElement);
        }
      }
  
      return targetCloneElementsById;
    }
  
  private static async _executeAnimationPhases(
    phaseConfigurations: MorphPhaseConfiguration[],
    animationContext: MorphAnimationContext,
    hooks: MorphEngineHooks
  ): Promise<void> {
    const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
    let currentStartTime = 0;
    const debug = Boolean((animationContext as any).debugMorph);
    
    for (const phaseConfig of phaseConfigurations) {
      const phaseContext: MorphPhaseContext = {
        sourceElements: animationContext.sourceElements,
        targetElements: animationContext.targetElements,
        elementMapping: animationContext.elementMapping,
        phaseDuration: this.defaultPhaseDurationSeconds,
        matchedTextPairs: (animationContext as any).__matchedTextPairs as Map<string, string> | undefined
      };

      const phaseBundle: PhaseAnimationBundle = phaseConfig.animationBuilder(phaseContext);
      if (debug) {
        const ids = phaseBundle.simultaneousAnimations.map(a => a.targetElementId);
        logger.info('[Morph Debug] schedule phase', {
          phase: phaseConfig.phaseName,
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

