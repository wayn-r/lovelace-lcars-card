import { AnimationDefinition, AnimationSequence, ElementStateManagementConfig } from '../types.js';
import { animationManager, AnimationContext } from './animation.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../layout/elements/element.js';
import { transformPropagator, AnimationSyncData } from './transform-propagator.js';
import gsap from 'gsap';
import { ReactiveStore, StoreProvider, StateChangeEvent, ElementState } from '../core/store.js';

// Legacy type aliases for backward compatibility
export type StateChangeCallback = (event: StateChangeEvent) => void;

/**
 * StateManager - Now a thin adapter over ReactiveStore
 * 
 * This maintains the existing API while delegating to the new reactive store implementation.
 * This allows existing code to continue working during the transition period.
 */
export class StateManager {
  private store: ReactiveStore;
  private elementsMap?: Map<string, LayoutElement>;
  private animationContext?: AnimationContext;

  constructor(requestUpdateCallback?: () => void) {
    this.store = StoreProvider.getStore();
    
    // Bridge store state changes to legacy callback format
    if (requestUpdateCallback) {
      this.store.subscribe(() => {
        requestUpdateCallback();
      });
    }
  }

  setRequestUpdateCallback(callback: () => void): void {
    // Subscribe to store changes and call the legacy callback
    this.store.subscribe(() => {
      callback();
    });
  }

  /**
   * Initialize an element's state management
   */
  initializeElementState(
    elementId: string, 
    stateConfig?: ElementStateManagementConfig,
    animationConfig?: any
  ): void {
    this.store.initializeElementState(elementId, stateConfig, animationConfig);
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
   * Set an element's state
   */
  setState(elementId: string, newState: string): void {
    // Auto-initialize if needed
    if (!this._ensureElementInitialized(elementId)) {
      console.warn(`[StateManager] Cannot set state for uninitialized element: ${elementId}`);
      return;
    }
    this.store.setState(elementId, newState);
    this._handleStateChangeAnimations(elementId, newState);
  }

  /**
   * Get an element's current state
   */
  getState(elementId: string): string | undefined {
    const state = this.store.getState();
    const elementState = state.elementStates.get(elementId);
    return elementState?.currentState;
  }

  /**
   * Toggle an element between states
   */
  toggleState(elementId: string, states: string[]): boolean {
    // Auto-initialize if needed
    if (!this._ensureElementInitialized(elementId)) {
      return false;
    }
    return this.store.toggleState(elementId, states);
  }

  /**
   * Subscribe to state change events
   */
  onStateChange(callback: StateChangeCallback): () => void {
    return this.store.onStateChange(callback);
  }

  /**
   * Auto-initialize element for state management if not already initialized
   */
  private _ensureElementInitialized(elementId: string): boolean {
    if (this._isElementInitialized(elementId)) {
      return true;
    }

    console.log(`[StateManager] Auto-initializing ${elementId} for state management`);
    
    // Try to find element in layout to get its configuration
    const element = this.elementsMap?.get(elementId);
    if (element) {
      const stateConfig = element.props?.state_management;
      const animationConfig = element.props?.animations;
      
      if (stateConfig || animationConfig) {
        this.initializeElementState(elementId, stateConfig, animationConfig);
        return true;
      }
    }
    
    // Fallback: For tests and uninitialized elements, only initialize if element can be found in layout
    if (this.elementsMap?.has(elementId)) {
      this.initializeElementState(elementId, { default_state: 'default' });
      return true;
    }
    
    console.warn(`[StateManager] Cannot auto-initialize ${elementId}: element not found in layout`);
    return false;
  }

  /**
   * Check if element is initialized for state management
   */
  private _isElementInitialized(elementId: string): boolean {
    const state = this.store.getState();
    const isInitialized = state.elementStates.has(elementId);
    
    if (!isInitialized) {
      console.log(`[StateManager] Element ${elementId} not initialized for state management`);
    }
    
    return isInitialized;
  }

  /**
   * Handle animations triggered by state changes
   */
  private _handleStateChangeAnimations(elementId: string, newState: string): void {
    if (!this.animationContext || !this.elementsMap) {
      return;
    }

    const element = this.elementsMap.get(elementId);
    if (!element?.props?.animations?.on_state_change) {
      return;
    }

    const stateChangeAnimations = element.props.animations.on_state_change;
    const storeState = this.store.getState();
    const elementState = storeState.elementStates.get(elementId);
    const fromState = elementState?.previousState || 'default';

    // Find matching state change animation
    const matchingAnimation = stateChangeAnimations.find((anim: any) => 
      anim.from_state === fromState && anim.to_state === newState
    );

    if (matchingAnimation) {
      this.executeAnimation(elementId, matchingAnimation);
    }
  }

  /**
   * Execute an animation using the animation manager
   */
  executeAnimation(elementId: string, animationDef: AnimationDefinition): void {
    if (!this.animationContext) {
      console.warn(`[StateManager] No animation context available for ${elementId}`);
      return;
    }

    animationManager.executeTransformableAnimation(
      elementId,
      animationDef,
      gsap,
      this.animationContext.getShadowElement
    );
  }

  /**
   * Trigger lifecycle animations (on_show, on_hide, on_load)
   */
  triggerLifecycleAnimation(elementId: string, lifecycle: 'on_show' | 'on_hide' | 'on_load'): void {
    if (!this.animationContext || !this.elementsMap) {
      return;
    }

    const element = this.elementsMap.get(elementId);
    const animationDef = element?.props?.animations?.[lifecycle];
    
    if (animationDef) {
      this.executeAnimation(elementId, animationDef);
    }
  }

  // Visibility management now uses regular state ('hidden'/'visible')
  setElementVisibility(elementId: string, visible: boolean, animated: boolean = false): void {
    const targetState = visible ? 'visible' : 'hidden';
    this.setState(elementId, targetState);
  }

  getElementVisibility(elementId: string): boolean {
    return this.store.isElementVisible(elementId);
  }

  // Group visibility is no longer supported - use individual element states instead
  getGroupVisibility(groupId: string): boolean {
    console.warn('[StateManager] Group visibility is deprecated. Use individual element states instead.');
    return true; // Default to visible for backward compatibility
  }

  shouldElementBeVisible(elementId: string, groupId: string): boolean {
    return this.getElementVisibility(elementId);
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
    this.store.cleanup();
  }

  /**
   * Clear all state (legacy method)
   */
  clearAll(): void {
    this.cleanup();
  }

  /**
   * Execute a set_state action using the unified Action interface
   */
  executeSetStateAction(action: import('../types.js').Action): void {
    const targetElementRef = action.target_element_ref;
    const state = action.state;
    
    if (!targetElementRef || !state) {
      console.warn('set_state action missing target_element_ref or state');
      return;
    }
    
    this.setState(targetElementRef, state);
  }

  /**
   * Execute a toggle_state action using the unified Action interface
   */
  executeToggleStateAction(action: import('../types.js').Action): void {
    const targetElementRef = action.target_element_ref;
    const states = action.states;
    
    if (!targetElementRef || !states || !Array.isArray(states)) {
      console.warn('toggle_state action missing target_element_ref or states array');
      return;
    }
    
    this.toggleState(targetElementRef, states);
  }
}

// Maintain singleton for backward compatibility, but now using the store
export const stateManager = new StateManager(); 