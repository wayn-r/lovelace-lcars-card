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
      
      // Set initial state
      const initialState = stateConfig.default_state || 'default';
      this.elementStates.set(elementId, {
        currentState: initialState,
        lastChange: Date.now()
      });
    }

    if (animationConfig) {
      this.animationConfigs.set(elementId, animationConfig);
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
    if (!this._isElementInitialized(elementId)) {
      return false;
    }

    const currentStateData = this.elementStates.get(elementId)!;
    if (this._isAlreadyInState(currentStateData, newState)) {
      return false;
    }

    const previousState = currentStateData.currentState;
    this._updateElementState(elementId, newState, previousState);
    this._notifyStateChangeCallbacks(elementId, previousState, newState);
    this._triggerStateChangeAnimations(elementId, previousState, newState);

    return true;
  }

  /**
   * Get current state of an element
   */
  getState(elementId: string): string | undefined {
    return this.elementStates.get(elementId)?.currentState;
  }

  /**
   * Toggle between two states
   */
  toggleState(elementId: string, states: string[]): boolean {
    if (states.length < 2) {
      console.warn(`[StateManager] Toggle requires at least 2 states, got ${states.length}`);
      return false;
    }

    const currentState = this.getState(elementId);
    if (!currentState) {
      console.warn(`[StateManager] Element ${elementId} not initialized for state management`);
      return false;
    }

    const currentIndex = states.indexOf(currentState);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];

    return this.setState(elementId, nextState);
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
    if (index !== -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Get all element states for template access
   */
  getAllStates(): Record<string, ElementState> {
    const result: Record<string, ElementState> = {};
    this.elementStates.forEach((state, elementId) => {
      result[elementId] = state;
    });
    return result;
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
   * Trigger state change animations
   */
  private _triggerStateChangeAnimations(elementId: string, fromState: string, toState: string): void {
    this.triggerStateChangeAnimations(elementId, fromState, toState);
  }

  /**
   * Trigger animations based on state changes
   */
  private triggerStateChangeAnimations(elementId: string, fromState: string, toState: string): void {
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

    // Execute each step using AnimationManager. The delay in each step config will handle sequencing.
    config.steps.forEach((stepConfig: any) => {
      animationManager.executeTransformableAnimation(
        element.id,
        stepConfig,
        gsap,
        this.animationContext?.getShadowElement
      );
    });
  }

  /**
   * Clear state data for a specific element
   */
  clearElement(elementId: string): void {
    this.elementStates.delete(elementId);
    this.stateConfigs.delete(elementId);
    this.animationConfigs.delete(elementId);
  }
}

// Export singleton instance
export const stateManager = new StateManager(); 