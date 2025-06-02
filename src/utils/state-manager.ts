import { AnimationDefinition, AnimationSequence, ElementStateManagementConfig } from '../types.js';
import { animationManager, AnimationContext } from './animation.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../layout/elements/element.js';

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

    // Get target element for animation
    const targetElement = this.animationContext.getShadowElement?.(elementId);
    if (!targetElement) {
      console.warn(`[StateManager] Cannot execute animation: DOM element ${elementId} not found`);
      return;
    }

    try {
      // Execute animation based on type
      switch (animConfig.type) {
        case 'fade':
          this.executeFadeAnimation(targetElement, animConfig);
          break;
        case 'slide':
          this.executeSlideAnimation(targetElement, animConfig);
          break;
        case 'scale':
          this.executeScaleAnimation(targetElement, animConfig);
          break;
        case 'custom_gsap':
          this.executeCustomGsapAnimation(targetElement, animConfig);
          break;
        default:
          console.warn(`[StateManager] Unknown animation type: ${animConfig.type}`);
      }
    } catch (error) {
      console.error(`[StateManager] Error executing animation for ${elementId}:`, error);
    }
  }

  /**
   * Execute fade animation
   */
  private executeFadeAnimation(element: Element, config: any): void {
    const { fade_params, duration = 0.5, ease = 'power2.out' } = config;
    const { opacity_start, opacity_end } = fade_params || {};

    // Import GSAP dynamically to ensure it's available
    import('gsap').then(({ gsap }) => {
      if (opacity_start !== undefined) {
        gsap.set(element, { opacity: opacity_start });
      }
      
      gsap.to(element, {
        opacity: opacity_end !== undefined ? opacity_end : 1,
        duration,
        ease
      });
    }).catch(error => {
      console.error('[StateManager] GSAP import failed:', error);
    });
  }

  /**
   * Execute slide animation
   */
  private executeSlideAnimation(element: Element, config: any): void {
    const { slide_params, duration = 0.5, ease = 'power2.out' } = config;
    const { direction, distance, opacity_start, opacity_end } = slide_params || {};

    import('gsap').then(({ gsap }) => {
      // Set initial position based on direction
      const initialTransform: any = {};
      const finalTransform: any = {};

      switch (direction) {
        case 'left':
          initialTransform.x = `-${distance}`;
          finalTransform.x = 0;
          break;
        case 'right':
          initialTransform.x = distance;
          finalTransform.x = 0;
          break;
        case 'up':
          initialTransform.y = `-${distance}`;
          finalTransform.y = 0;
          break;
        case 'down':
          initialTransform.y = distance;
          finalTransform.y = 0;
          break;
      }

      if (opacity_start !== undefined) {
        initialTransform.opacity = opacity_start;
      }
      if (opacity_end !== undefined) {
        finalTransform.opacity = opacity_end;
      }

      gsap.set(element, initialTransform);
      gsap.to(element, {
        ...finalTransform,
        duration,
        ease
      });
    }).catch(error => {
      console.error('[StateManager] GSAP import failed:', error);
    });
  }

  /**
   * Execute scale animation
   */
  private executeScaleAnimation(element: Element, config: any): void {
    const { scale_params, duration = 0.5, ease = 'power2.out', repeat, yoyo } = config;
    const { scale_start, scale_end, transform_origin } = scale_params || {};

    import('gsap').then(({ gsap }) => {
      if (scale_start !== undefined) {
        gsap.set(element, { 
          scale: scale_start,
          transformOrigin: transform_origin || 'center center'
        });
      }

      const animationProps: any = {
        scale: scale_end !== undefined ? scale_end : 1,
        duration,
        ease,
        transformOrigin: transform_origin || 'center center'
      };

      if (repeat !== undefined) {
        animationProps.repeat = repeat;
      }
      if (yoyo !== undefined) {
        animationProps.yoyo = yoyo;
      }

      gsap.to(element, animationProps);
    }).catch(error => {
      console.error('[StateManager] GSAP import failed:', error);
    });
  }

  /**
   * Execute custom GSAP animation
   */
  private executeCustomGsapAnimation(element: Element, config: any): void {
    const { custom_gsap_vars, duration = 0.5 } = config;

    if (!custom_gsap_vars) {
      console.warn('[StateManager] Custom GSAP animation missing custom_gsap_vars');
      return;
    }

    import('gsap').then(({ gsap }) => {
      gsap.to(element, {
        ...custom_gsap_vars,
        duration
      });
    }).catch(error => {
      console.error('[StateManager] GSAP import failed:', error);
    });
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
    if (!this.animationContext || !this.elementsMap) {
      console.warn(`[StateManager] Cannot execute ${lifecycle} animation: missing context or elements map`);
      return;
    }

    const targetElement = this.animationContext.getShadowElement?.(elementId);
    if (!targetElement) {
      console.warn(`[StateManager] Cannot execute ${lifecycle} animation: DOM element ${elementId} not found`);
      return;
    }

    try {
      // Handle animation sequences (multiple steps)
      if (animConfig.steps && Array.isArray(animConfig.steps)) {
        this._executeAnimationSequence(targetElement, animConfig, lifecycle);
      } else {
        // Handle single animation
        this._executeSingleLifecycleAnimation(targetElement, animConfig, lifecycle);
      }
    } catch (error) {
      console.error(`[StateManager] Error executing ${lifecycle} animation for ${elementId}:`, error);
    }
  }

  /**
   * Execute a single lifecycle animation
   */
  private _executeSingleLifecycleAnimation(element: Element, config: any, lifecycle: string): void {
    switch (config.type) {
      case 'fade':
        this._executeFadeAnimation(element, config);
        break;
      case 'slide':
        this._executeSlideAnimation(element, config);
        break;
      case 'scale':
        this._executeScaleAnimation(element, config);
        break;
      case 'custom_gsap':
        this._executeCustomGsapAnimation(element, config);
        break;
      default:
        console.warn(`[StateManager] Unknown ${lifecycle} animation type: ${config.type}`);
    }
  }

  /**
   * Execute an animation sequence with multiple steps
   */
  private _executeAnimationSequence(element: Element, config: any, lifecycle: string): void {
    import('gsap').then(({ gsap }) => {
      const timeline = gsap.timeline();
      
      config.steps.forEach((step: any) => {
        const delay = step.delay || 0;
        const duration = step.duration || 0.5;
        
        switch (step.type) {
          case 'fade':
            const fadeProps: any = {
              duration
            };
            if (step.fade_params?.opacity_start !== undefined) {
              gsap.set(element, { opacity: step.fade_params.opacity_start });
            }
            if (step.fade_params?.opacity_end !== undefined) {
              fadeProps.opacity = step.fade_params.opacity_end;
            }
            timeline.to(element, fadeProps, delay);
            break;
            
          case 'slide':
            const slideProps: any = { duration };
            const { direction, distance } = step.slide_params || {};
            
            if (direction && distance) {
              switch (direction) {
                case 'up':
                  gsap.set(element, { y: distance });
                  slideProps.y = 0;
                  break;
                case 'down':
                  gsap.set(element, { y: `-${distance}` });
                  slideProps.y = 0;
                  break;
                case 'left':
                  gsap.set(element, { x: distance });
                  slideProps.x = 0;
                  break;
                case 'right':
                  gsap.set(element, { x: `-${distance}` });
                  slideProps.x = 0;
                  break;
              }
            }
            timeline.to(element, slideProps, delay);
            break;
            
          case 'scale':
            const scaleProps: any = { duration };
            if (step.scale_params?.scale_start !== undefined) {
              gsap.set(element, { scale: step.scale_params.scale_start });
            }
            if (step.scale_params?.scale_end !== undefined) {
              scaleProps.scale = step.scale_params.scale_end;
            }
            if (step.scale_params?.transform_origin) {
              scaleProps.transformOrigin = step.scale_params.transform_origin;
            }
            if (step.repeat !== undefined) {
              scaleProps.repeat = step.repeat;
            }
            if (step.yoyo !== undefined) {
              scaleProps.yoyo = step.yoyo;
            }
            timeline.to(element, scaleProps, delay);
            break;
        }
      });
    }).catch(error => {
      console.error(`[StateManager] GSAP import failed for ${lifecycle} sequence:`, error);
    });
  }

  /**
   * Execute fade animation (refactored for reuse)
   */
  private _executeFadeAnimation(element: Element, config: any): void {
    this.executeFadeAnimation(element, config);
  }

  /**
   * Execute slide animation (refactored for reuse)
   */
  private _executeSlideAnimation(element: Element, config: any): void {
    this.executeSlideAnimation(element, config);
  }

  /**
   * Execute scale animation (refactored for reuse)
   */
  private _executeScaleAnimation(element: Element, config: any): void {
    this.executeScaleAnimation(element, config);
  }

  /**
   * Execute custom GSAP animation (refactored for reuse)
   */
  private _executeCustomGsapAnimation(element: Element, config: any): void {
    this.executeCustomGsapAnimation(element, config);
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