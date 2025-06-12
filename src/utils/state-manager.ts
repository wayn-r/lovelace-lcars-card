import { AnimationDefinition, AnimationSequence, ElementStateManagementConfig } from '../types.js';
import { animationManager, AnimationContext } from './animation.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../layout/elements/element.js';
import { transformPropagator, AnimationSyncData } from './transform-propagator.js';
import gsap from 'gsap';

export interface ElementState {
  currentState: string;
  previousState?: string;
  lastChange: number;
}

export interface StateChangeEvent {
  elementId: string;
  fromState: string;
  toState: string;
  timestamp: number;
}

export type StateChangeCallback = (event: StateChangeEvent) => void;

export interface ElementVisibilityState {
  visible: boolean;
  animated?: boolean;
}

/**
 * Manages element states and triggers animations based on state changes
 */
export class StateManager {
  private elementStates = new Map<string, ElementState>();
  private stateConfigs = new Map<string, ElementStateManagementConfig>();
  private animationConfigs = new Map<string, any>();
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private elementsMap?: Map<string, LayoutElement>;
  private animationContext?: AnimationContext;
  
  // Visibility management
  private elementVisibility = new Map<string, ElementVisibilityState>();
  private groupVisibility = new Map<string, ElementVisibilityState>();
  private requestUpdateCallback?: () => void;

  constructor(requestUpdateCallback?: () => void) {
    this.requestUpdateCallback = requestUpdateCallback;
  }

  setRequestUpdateCallback(callback: () => void): void {
    this.requestUpdateCallback = callback;
  }

  /**
   * Initialize an element's state management
   */
  initializeElementState(
    elementId: string, 
    stateConfig?: ElementStateManagementConfig,
    animationConfig?: any
  ): void {
    if (stateConfig) {
      this.stateConfigs.set(elementId, stateConfig);
      
      // Initialize with default state
      const defaultState = stateConfig.default_state || 'default';
      this.elementStates.set(elementId, {
        currentState: defaultState,
        lastChange: Date.now()
      });
      
      // Handle visibility states
      if (defaultState === 'hidden' || defaultState === 'visible') {
        const shouldBeVisible = defaultState === 'visible';
        this.setElementVisibility(elementId, shouldBeVisible, false);
      }
    }
    
    if (animationConfig) {
      this.animationConfigs.set(elementId, animationConfig);
    }
    
    // Initialize state tracking for elements with only animations (no explicit state_management)
    if (!stateConfig && animationConfig) {
      this.elementStates.set(elementId, {
        currentState: 'default',
        lastChange: Date.now()
      });
    }
  }

  /**
   * Set the animation context for triggering animations
   */
  setAnimationContext(context: AnimationContext, elementsMap?: Map<string, LayoutElement>): void {
    this.animationContext = context;
    this.elementsMap = elementsMap;
    
    // Initialize transform propagator with current layout state
    if (elementsMap && context.getShadowElement) {
      transformPropagator.initialize(elementsMap, context.getShadowElement);
    }
  }

  /**
   * Set element state and trigger any associated animations
   */
  setState(elementId: string, newState: string): boolean {
    // Auto-initialize element if not already initialized
    this._ensureElementInitialized(elementId);
    
    if (!this._isElementInitialized(elementId)) {
      console.warn(`[StateManager] setState failed - element ${elementId} not initialized`);
      return false;
    }

    const currentStateData = this.elementStates.get(elementId)!;
    if (this._isAlreadyInState(currentStateData, newState)) {
      return false;
    }

    const previousState = currentStateData.currentState;
    
    this._updateElementState(elementId, newState, previousState);
    this._notifyStateChangeCallbacks(elementId, previousState, newState);
    
    // Handle visibility states
    this._handleVisibilityState(elementId, newState, previousState);
    
    this._triggerStateChangeAnimations(elementId, previousState, newState);

    return true;
  }

  /**
   * Get current state of an element
   */
  getState(elementId: string): string | undefined {
    const stateData = this.elementStates.get(elementId);
    return stateData?.currentState;
  }

  /**
   * Toggle between two states
   */
  toggleState(elementId: string, states: string[]): boolean {
    if (states.length < 2) {
      console.warn(`[StateManager] Toggle requires at least 2 states, got ${states.length}`);
      return false;
    }

    // Auto-initialize element if not already initialized
    this._ensureElementInitialized(elementId);

    const currentState = this.getState(elementId);
    
    if (!currentState) {
      // If no current state, set to the first state
      return this.setState(elementId, states[0]);
    }

    // Find current state index
    const currentIndex = states.indexOf(currentState);
    if (currentIndex === -1) {
      // Current state not in the provided states array, set to first state
      return this.setState(elementId, states[0]);
    }

    // Toggle to next state (cycle back to beginning if at end)
    const nextIndex = (currentIndex + 1) % states.length;
    return this.setState(elementId, states[nextIndex]);
  }

  /**
   * Add a callback for state changes
   */
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Remove a state change callback
   */
  removeStateChangeCallback(callback: StateChangeCallback): void {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Get all element states for template access
   */
  getAllStates(): Record<string, ElementState> {
    const states: Record<string, ElementState> = {};
    this.elementStates.forEach((state, elementId) => {
      states[elementId] = { ...state };
    });
    return states;
  }

  /**
   * Check if element is initialized for state management
   */
  private _isElementInitialized(elementId: string): boolean {
    const isInitialized = this.elementStates.has(elementId);
    if (!isInitialized) {
      console.warn(`[StateManager] Element ${elementId} not initialized for state management`);
    }
    return isInitialized;
  }

  /**
   * Ensure element is initialized for state management.
   * Auto-initializes elements that aren't explicitly configured but are being targeted by actions.
   */
  private _ensureElementInitialized(elementId: string): void {
    if (this.elementStates.has(elementId)) {
      return; // Already initialized
    }

    // Look up the element in the elements map to get its configuration
    const element = this.elementsMap?.get(elementId);
    if (!element) {
      console.warn(`[StateManager] Cannot auto-initialize ${elementId}: element not found in layout`);
      return;
    }

    // Check if element has state_management or animations configuration
    const hasStateConfig = Boolean(element.props.state_management);
    const hasAnimationConfig = Boolean(element.props.animations);

    if (hasStateConfig || hasAnimationConfig) {
      // Initialize using the element's actual configuration
      console.log(`[StateManager] Auto-initializing element ${elementId}`);
      this.initializeElementState(
        elementId,
        element.props.state_management,
        element.props.animations
      );
    } else {
      // Initialize with minimal default state for elements that don't have explicit config
      // but are being targeted by button actions
      console.log(`[StateManager] Auto-initializing ${elementId} with default state (no config found)`);
      this.elementStates.set(elementId, {
        currentState: 'default',
        lastChange: Date.now()
      });
    }
  }

  /**
   * Check if element is already in the target state
   */
  private _isAlreadyInState(currentStateData: ElementState, newState: string): boolean {
    return currentStateData.currentState === newState;
  }

  /**
   * Update element state data
   */
  private _updateElementState(elementId: string, newState: string, previousState: string): void {
    this.elementStates.set(elementId, {
      currentState: newState,
      previousState: previousState,
      lastChange: Date.now()
    });
  }

  /**
   * Notify all registered state change callbacks
   */
  private _notifyStateChangeCallbacks(elementId: string, fromState: string, toState: string): void {
    const stateChangeEvent: StateChangeEvent = {
      elementId,
      fromState,
      toState,
      timestamp: Date.now()
    };

    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(stateChangeEvent);
      } catch (error) {
        console.error('[StateManager] Error in state change callback:', error);
      }
    });
  }

  /**
   * Trigger animations based on state changes
   */
  private _triggerStateChangeAnimations(elementId: string, fromState: string, toState: string): void {
    const animationConfig = this.animationConfigs.get(elementId);
    if (!animationConfig?.on_state_change || !this.animationContext) {
      return;
    }

    // Find matching animation configuration
    const stateChangeAnimations = animationConfig.on_state_change;
    if (!Array.isArray(stateChangeAnimations)) {
      return;
    }

    for (const animConfig of stateChangeAnimations) {
      if (this._animationMatchesStateTransition(animConfig, fromState, toState)) {
        this._executeAnimation(elementId, animConfig);
        break; // Execute first matching animation only
      }
    }
  }

  /**
   * Check if animation configuration matches the state transition
   */
  private _animationMatchesStateTransition(animConfig: any, fromState: string, toState: string): boolean {
    return animConfig.from_state === fromState && animConfig.to_state === toState;
  }

  /**
   * Execute an animation configuration
   */
  private _executeAnimation(elementId: string, animConfig: any): void {
    if (!this.animationContext || !this.elementsMap) {
      console.warn('[StateManager] Cannot execute animation: missing context or elements map');
      return;
    }

    const element = this.elementsMap.get(elementId);
    if (!element) {
      console.warn(`[StateManager] Cannot execute animation: element ${elementId} not found`);
      return;
    }

    // Delegate to AnimationManager for execution
    animationManager.executeTransformableAnimation(
      elementId,
      animConfig,
      gsap,
      this.animationContext.getShadowElement
    );
  }

  /**
   * Clear all state data
   */
  clearAll(): void {
    this.elementStates.clear();
    this.stateConfigs.clear();
    this.animationConfigs.clear();
    this.stateChangeCallbacks = [];
    this.elementVisibility.clear();
    this.groupVisibility.clear();
  }

  /**
   * Trigger lifecycle animations (on_load, on_show, on_hide)
   */
  triggerLifecycleAnimation(elementId: string, lifecycle: 'on_load' | 'on_show' | 'on_hide'): void {
    const animationConfig = this.animationConfigs.get(elementId);
    if (!animationConfig?.[lifecycle] || !this.animationContext) {
      return;
    }

    this._executeLifecycleAnimation(elementId, animationConfig[lifecycle], lifecycle);
  }

  /**
   * Execute a lifecycle animation configuration
   */
  private _executeLifecycleAnimation(elementId: string, animConfig: any, lifecycle: string): void {
    const element = this.elementsMap?.get(elementId);
    if (!element || !this.animationContext?.getShadowElement) return;

    if (animConfig.steps && Array.isArray(animConfig.steps)) {
      // This is an animation sequence
      this._executeAnimationSequence(element, animConfig, lifecycle);
    } else {
      // This is a single animation
      this._executeSingleLifecycleAnimation(element, animConfig, lifecycle);
    }
  }

  /**
   * Execute a single lifecycle animation
   */
  private _executeSingleLifecycleAnimation(element: LayoutElement, config: any, lifecycle: string): void {
    if (!this.animationContext?.getShadowElement) return;
    
    // Delegate to AnimationManager
    animationManager.executeTransformableAnimation(
      element.id,
      config, 
      gsap,
      this.animationContext?.getShadowElement
    );
  }

  /**
   * Execute an animation sequence with multiple steps
   */
  private _executeAnimationSequence(element: LayoutElement, config: any, lifecycle: string): void {
    if (!this.animationContext?.getShadowElement || !config.steps || !Array.isArray(config.steps)) {
      return;
    }

    // Create base sync data from the sequence configuration
    const baseSyncData = {
      duration: 0.5, // Default duration, will be overridden by individual steps
      ease: 'power2.out' // Default ease, will be overridden by individual steps
    };

    // Check if any animation in any step group affects positioning and requires transform propagation
    const hasPositioningEffects = config.steps.some((stepGroup: any) => 
      stepGroup.animations?.some((animation: any) => this._stepAffectsPositioning(animation))
    );

    if (hasPositioningEffects) {
      // Use sequence-aware transform propagation
      import('./transform-propagator.js').then(({ transformPropagator }) => {
        transformPropagator.processAnimationSequenceWithPropagation(
          element.id,
          config,
          baseSyncData
        );
      }).catch(error => {
        console.error('[StateManager] Error importing transform propagator for sequence:', error);
      });
    }

    // Create a GSAP timeline for the primary element's animation sequence
    const tl = gsap.timeline();
    // Sort step groups by index, just in case they are not ordered in YAML
    const sortedStepGroups = [...config.steps].sort((a, b) => (a.index || 0) - (b.index || 0));
    let lastIndexProcessed = -1;

    // Track cumulative timeline position for proper sequencing
    let cumulativeTimelinePosition = 0;

    sortedStepGroups.forEach((stepGroup: any) => {
      const currentIndex = stepGroup.index || 0;
      let positionInTimeline: string | number;

      if (currentIndex > lastIndexProcessed) {
        // This step group starts after the previous index group is complete
        // Use the cumulative position to ensure proper timing
        positionInTimeline = cumulativeTimelinePosition;
      } else {
        // Fallback for unsorted or unexpectedly ordered steps
        console.warn(`[StateManager] Animation step group index ${currentIndex} is not greater than lastProcessedIndex ${lastIndexProcessed}. Using cumulative position.`);
        positionInTimeline = cumulativeTimelinePosition;
      }

      // Calculate the maximum duration for this group (including delays)
      let maxGroupDuration = 0;
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        stepGroup.animations.forEach((animation: any) => {
          const animationDuration = (animation.duration || 0) + (animation.delay || 0);
          maxGroupDuration = Math.max(maxGroupDuration, animationDuration);
        });
      }

      // Process all animations in this step group simultaneously
      if (stepGroup.animations && Array.isArray(stepGroup.animations)) {
        stepGroup.animations.forEach((animationConfig: any, animationIndex: number) => {
          // ALL animations in the same group use the same absolute timeline position
          // This ensures they start simultaneously without GSAP positioning conflicts
          const timelinePosition = positionInTimeline;

          // Execute each animation in the group
          animationManager.executeTransformableAnimation(
            element.id,
            animationConfig,
            gsap, // gsapInstance
            this.animationContext?.getShadowElement,
            tl, // Pass the timeline instance
            timelinePosition // Pass the calculated position for the timeline
          );
        });
      }

      // Update cumulative position for the next step group
      cumulativeTimelinePosition += maxGroupDuration;
      lastIndexProcessed = currentIndex;
    });
  }

  /**
   * Check if an animation step affects positioning (similar to AnimationManager._animationAffectsPositioning)
   */
  private _stepAffectsPositioning(step: any): boolean {
    switch (step.type) {
      case 'scale':
      case 'slide':
        return true;
      case 'custom_gsap':
        const customVars = step.custom_gsap_vars || {};
        return customVars.scale !== undefined || 
               customVars.x !== undefined || 
               customVars.y !== undefined ||
               customVars.rotation !== undefined;
      default:
        return false;
    }
  }

  /**
   * Clear state data for a specific element
   */
  clearElement(elementId: string): void {
    this.elementStates.delete(elementId);
    this.stateConfigs.delete(elementId);
    this.animationConfigs.delete(elementId);
    this.elementVisibility.delete(elementId);
  }

  /**
   * Handle visibility-related states (hidden/visible)
   */
  private _handleVisibilityState(elementId: string, newState: string, previousState: string): void {
    // Check if this is a visibility state transition
    const isVisibilityState = (state: string) => state === 'hidden' || state === 'visible';
    
    if (isVisibilityState(newState)) {
      console.log(`[StateManager] Visibility state change: ${elementId} ${previousState} -> ${newState}`);
      
      // Just trigger a re-render - the render logic will handle visibility via CSS
      this.requestUpdateCallback?.();
    }
  }

  // ============================================================================
  // Visibility Management
  // ============================================================================

  initializeVisibility(elementIds: string[], groupIds: string[]): void {
    // Initialize all elements as visible by default
    elementIds.forEach(id => {
      if (!this.elementVisibility.has(id)) {
        this.elementVisibility.set(id, { visible: true });
      }
    });

    // Initialize all groups as visible by default
    groupIds.forEach(id => {
      if (!this.groupVisibility.has(id)) {
        this.groupVisibility.set(id, { visible: true });
      }
    });
  }

  setElementVisibility(elementId: string, visible: boolean, animated: boolean = false): void {
    const previousVisibility = this.elementVisibility.get(elementId)?.visible ?? true;
    this.elementVisibility.set(elementId, { visible, animated });
    
    // No complex lifecycle animations - let state change animations handle everything
  }

  setGroupVisibility(groupId: string, visible: boolean, animated: boolean = false): void {
    const previousVisibility = this.groupVisibility.get(groupId)?.visible ?? true;
    this.groupVisibility.set(groupId, { visible, animated });
    
    // Note: Group visibility changes don't directly trigger animations
    // Individual elements within the group handle their own animations
  }

  getElementVisibility(elementId: string): boolean {
    return this.elementVisibility.get(elementId)?.visible ?? true;
  }

  getGroupVisibility(groupId: string): boolean {
    return this.groupVisibility.get(groupId)?.visible ?? true;
  }

  shouldElementBeVisible(elementId: string, groupId: string): boolean {
    const elementVisible = this.getElementVisibility(elementId);
    const groupVisible = this.getGroupVisibility(groupId);
    return elementVisible && groupVisible;
  }

  /**
   * Check if element should be rendered in DOM (even if not visible) for animations
   */
  shouldElementBeRendered(elementId: string, groupId: string): boolean {
    const groupVisible = this.getGroupVisibility(groupId);
    if (!groupVisible) {
      return false;
    }

    // Always render elements that have animations, even if they're in hidden state
    const element = this.elementsMap?.get(elementId);
    const hasAnimations = element?.props?.animations || element?.props?.state_management;
    
    if (hasAnimations) {
      return true;
    }

    // For elements without animations, use normal visibility logic
    return this.shouldElementBeVisible(elementId, groupId);
  }

  cleanup(): void {
    this.clearAll();
  }
}

// Export singleton instance
export const stateManager = new StateManager(); 