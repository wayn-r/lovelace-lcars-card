import { AnimationDefinition, ElementStateManagementConfig, AnimationSequence, StateChangeAnimationConfig } from '../types.js';
import { animationManager, AnimationContext, DistanceParser, AnimationManager } from './animation.js';
import { LayoutElement } from '../layout/elements/element.js';
import { Group } from '../layout/engine.js';
import gsap from 'gsap';
import { ReactiveStore, StoreProvider, StateChangeEvent } from '../core/store.js';

export type StateChangeCallback = (event: StateChangeEvent) => void;

export class StateManager {
  private store: ReactiveStore;
  private elementsMap?: Map<string, LayoutElement>;
  private animationContext?: AnimationContext;
  private animations: AnimationManager;

  constructor(requestUpdateCallback?: () => void, store?: ReactiveStore, animations?: AnimationManager) {
    this.store = store ?? StoreProvider.getStore();
    this.animations = animations ?? animationManager;
    
    if (requestUpdateCallback) {
      this.store.subscribe(() => {
        requestUpdateCallback();
      });
    }
  }

  registerState(name: string, value: any): void {
    this.store.registerState(name, value);
  }

  initializeElementState(
    elementId: string, 
    stateConfig?: ElementStateManagementConfig,
    animationConfig?: any
  ): void {
    this.store.initializeElementState(elementId, stateConfig, animationConfig);
  }

  setAnimationContext(context: AnimationContext, elementsMap?: Map<string, LayoutElement>): void {
    this.animationContext = context;
    this.elementsMap = elementsMap;
    
    if (elementsMap) {
      this.animations.setElementsMap(elementsMap);
    }
    
    if (elementsMap && context.getShadowElement) {
      this.animations.initializePropagation(
        elementsMap,
        context.getShadowElement,
        this.store
      );
    }
  }

  setState(elementId: string, newState: string): void {
    if (!this.ensureElementInitialized(elementId)) {
      console.warn(`[StateManager] Cannot set state for uninitialized element: ${elementId}`);
      return;
    }
    
    const currentState = this.getState(elementId);
    if (currentState === newState) {
      console.debug(`[StateManager] State '${newState}' is already current for ${elementId}, skipping animation`);
      return;
    }
    
    this.store.setState(elementId, newState);
    this.handleStateChangeAnimations(elementId, newState);
  }

  getState(elementId: string): string | undefined {
    const state = this.store.getState();
    const elementState = state.elementStates.get(elementId);
    return elementState?.currentState;
  }

  toggleState(elementId: string, states: string[]): boolean {
    if (!this.ensureElementInitialized(elementId)) {
      return false;
    }
    const toggled = this.store.toggleState(elementId, states);

    if (toggled) {
      const newState = this.getState(elementId);
      if (newState) {
        this.handleStateChangeAnimations(elementId, newState);
      }
    }

    return toggled;
  }

  onStateChange(callback: StateChangeCallback): () => void {
    return this.store.onStateChange(callback);
  }

  private ensureElementInitialized(elementId: string): boolean {
    if (this.elementIsInitialized(elementId)) {
      return true;
    }

    console.log(`[StateManager] Auto-initializing ${elementId} for state management`);
    
    const element = this.elementsMap?.get(elementId);
    if (element) {
      const stateConfig = element.props?.state_management;
      const animationConfig = element.props?.animations;
      
      if (stateConfig || animationConfig) {
        this.initializeElementState(elementId, stateConfig, animationConfig);
        return true;
      }
    }
    
    if (this.elementsMap?.has(elementId)) {
      this.initializeElementState(elementId, { default_state: 'default' });
      return true;
    }
    
    console.warn(`[StateManager] Cannot auto-initialize ${elementId}: element not found in layout`);
    return false;
  }

  private elementIsInitialized(elementId: string): boolean {
    const state = this.store.getState();
    const isInitialized = state.elementStates.has(elementId);
    
    if (!isInitialized) {
      console.log(`[StateManager] Element ${elementId} not initialized for state management`);
    }
    
    return isInitialized;
  }

  private handleStateChangeAnimations(elementId: string, newState: string): void {
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

    const matchingAnimation = stateChangeAnimations.find((anim: any) => 
      anim.from_state === fromState && anim.to_state === newState
    );

    if (matchingAnimation) {
      const activeTimelines = this.animations.getActiveTimelines(elementId);
      
      if (activeTimelines && activeTimelines.length > 0) {
        const currentAnimation = activeTimelines[activeTimelines.length - 1];
        
        const isReverseTransition = this.isReverseTransition(
          currentAnimation.animationConfig,
          matchingAnimation,
          fromState,
          newState
        );
        
        if (isReverseTransition && !currentAnimation.isReversed) {
          console.log(`[StateManager] Reversing existing animation for ${elementId} (${fromState} -> ${newState})`);
          this.animations.reverseAnimation(elementId);
          return;
        } else {
          console.log(`[StateManager] Stopping existing animation and starting new one for ${elementId} (${fromState} -> ${newState})`);
          
          const targetElement = this.animationContext.getShadowElement?.(elementId);
          if (targetElement) {
            const currentOpacity = parseFloat(gsap.getProperty(targetElement, "opacity") as string);
            const currentX = parseFloat(gsap.getProperty(targetElement, "x") as string);
            const currentY = parseFloat(gsap.getProperty(targetElement, "y") as string);
            const initialValues = { opacity: currentOpacity, x: currentX, y: currentY };
            this.animations.stopAllAnimationsForElement(elementId);
            gsap.set(targetElement, { opacity: currentOpacity, x: currentX, y: currentY });
            this.executeAnimation(elementId, matchingAnimation, initialValues);
          } else {
            this.animations.stopAllAnimationsForElement(elementId);
            this.executeAnimation(elementId, matchingAnimation);
          }
        }
      } else {
        this.executeAnimation(elementId, matchingAnimation);
      }
    }
  }

  private isReverseTransition(
    currentConfig: import('./animation.js').AnimationConfig,
    newAnimationDef: AnimationDefinition,
    fromState: string,
    toState: string
  ): boolean {
    if (currentConfig.type !== newAnimationDef.type) {
      return false;
    }

    if (currentConfig.type === 'scale' && newAnimationDef.type === 'scale') {
      const currentScaleStart = currentConfig.scale_params?.scale_start;
      const currentScaleEnd = currentConfig.scale_params?.scale_end;
      const newScaleStart = newAnimationDef.scale_params?.scale_start;
      const newScaleEnd = newAnimationDef.scale_params?.scale_end;
      
      return (currentScaleEnd === newScaleStart && currentScaleStart === newScaleEnd);
    }
    
    if (currentConfig.type === 'slide' && newAnimationDef.type === 'slide') {
      const currentMovement = currentConfig.slide_params?.movement;
      const newMovement = newAnimationDef.slide_params?.movement;
      
      return (currentMovement === 'in' && newMovement === 'out') || 
             (currentMovement === 'out' && newMovement === 'in');
    }
    
    if (currentConfig.type === 'fade' && newAnimationDef.type === 'fade') {
      const currentOpacityStart = currentConfig.fade_params?.opacity_start;
      const currentOpacityEnd = currentConfig.fade_params?.opacity_end;
      const newOpacityStart = newAnimationDef.fade_params?.opacity_start;
      const newOpacityEnd = newAnimationDef.fade_params?.opacity_end;
      
      return (currentOpacityEnd === newOpacityStart && currentOpacityStart === newOpacityEnd);
    }
    
    return false;
  }

  executeAnimation(elementId: string, animationDef: AnimationDefinition, initialValues?: { opacity?: number; x?: number; y?: number; }): void {
    if (!this.animationContext || !this.elementsMap) {
      console.warn(`[StateManager] No animation context available for ${elementId}`);
      return;
    }

    const element = this.elementsMap.get(elementId);
    if (!element) {
      console.warn(`[StateManager] Element ${elementId} not found for animation`);
      return;
    }

    const animationConfig = this.convertToAnimationConfig(animationDef);
    if (animationConfig) {
      this.animations.executeAnimation(elementId, animationConfig, this.animationContext, gsap, initialValues);
    }
  }

  private convertToAnimationConfig(animationDef: AnimationDefinition): import('./animation.js').AnimationConfig | null {
    if (!animationDef || !animationDef.type) {
      return null;
    }

    const config: import('./animation.js').AnimationConfig = {
      type: animationDef.type,
      duration: animationDef.duration || 500,
      ease: animationDef.ease || 'power2.out',
      delay: animationDef.delay,
      repeat: animationDef.repeat,
      yoyo: animationDef.yoyo
    };

    if (animationDef.scale_params) {
      config.scale_params = animationDef.scale_params;
    }
    if (animationDef.slide_params) {
      config.slide_params = animationDef.slide_params;
    }
    if (animationDef.fade_params) {
      config.fade_params = animationDef.fade_params;
    }
    if (animationDef.color_params) {
      config.color_params = animationDef.color_params;
    }
    if (animationDef.custom_gsap_vars) {
      config.custom_gsap_params = animationDef.custom_gsap_vars;
    }

    return config;
  }

  triggerLifecycleAnimation(elementId: string, lifecycle: 'on_show' | 'on_hide' | 'on_load'): void {
    if (!this.animationContext || !this.elementsMap) {
      return;
    }

    const element = this.elementsMap.get(elementId);
    const animationDef: AnimationDefinition | AnimationSequence | undefined = element?.props?.animations?.[lifecycle];
    if (!animationDef) return;

    if ('steps' in animationDef) {
      this.animations.executeAnimationSequence(elementId, animationDef, this.animationContext, gsap);
      return;
    }

    this.executeAnimation(elementId, animationDef);
  }

  setInitialAnimationStates(groups: Group[]): void {
    if (!this.animationContext?.getShadowElement) {
      return;
    }

    groups.forEach(group => {
      group.elements.forEach(element => {
        this.setElementInitialState(element);
      });
    });
  }

  private setElementInitialState(element: LayoutElement): void {
    if (!this.animationContext?.getShadowElement) {
      return;
    }

    const targetElement = this.animationContext.getShadowElement(element.id);
    if (!targetElement) {
      return;
    }

    const animations = element.props?.animations;
    if (!animations) {
      return;
    }

    if (animations.on_load) {
      const def = animations.on_load as any;
      if (Array.isArray(def?.steps)) {
        const first = def.steps?.[0]?.animations?.[0];
        if (first) this.applyInitialAnimationState(targetElement, first as any);
      } else {
        this.applyInitialAnimationState(targetElement, def as any);
      }
    }

    if (animations.on_state_change && Array.isArray(animations.on_state_change)) {
      const currentState = this.getState(element.id) || 'default';
      
      const incomingAnimation = animations.on_state_change.find((anim: StateChangeAnimationConfig) => 
        anim.to_state === currentState
      );
      
      if (incomingAnimation) {
        this.applyFinalAnimationState(targetElement, incomingAnimation);
      }
    }
  }

  private applyInitialAnimationState(targetElement: Element, animationDef: AnimationDefinition): void {
    const initialProps: { [key: string]: any } = {};

    if (animationDef.type === 'fade' && animationDef.fade_params?.opacity_start !== undefined) {
      initialProps.opacity = animationDef.fade_params.opacity_start;
    }

    if (animationDef.type === 'scale' && animationDef.scale_params?.scale_start !== undefined) {
      initialProps.scale = animationDef.scale_params.scale_start;
    }

    if (animationDef.type === 'slide' && animationDef.slide_params) {
      const slideParams = animationDef.slide_params;
      if (slideParams.opacity_start !== undefined) {
        initialProps.opacity = slideParams.opacity_start;
      }
      
      if (slideParams.movement === 'in') {
        const distance = DistanceParser.parse(slideParams.distance || '0');
        switch (slideParams.direction) {
          case 'left': initialProps.x = distance; break;
          case 'right': initialProps.x = -distance; break;
          case 'up': initialProps.y = distance; break;
          case 'down': initialProps.y = -distance; break;
        }
      }
    }

    if (Object.keys(initialProps).length > 0) {
      gsap.set(targetElement, initialProps);
    }
  }

  private applyFinalAnimationState(targetElement: Element, animationDef: AnimationDefinition): void {
    const finalProps: { [key: string]: any } = {};

    if (animationDef.type === 'fade' && animationDef.fade_params?.opacity_end !== undefined) {
      finalProps.opacity = animationDef.fade_params.opacity_end;
    }

    if (animationDef.type === 'scale' && animationDef.scale_params?.scale_end !== undefined) {
      finalProps.scale = animationDef.scale_params.scale_end;
    }

    if (animationDef.type === 'slide' && animationDef.slide_params?.opacity_end !== undefined) {
      finalProps.opacity = animationDef.slide_params.opacity_end;
    }

    if (Object.keys(finalProps).length > 0) {
      gsap.set(targetElement, finalProps);
    }
  }

  setElementVisibility(elementId: string, visible: boolean, animated: boolean = false): void {
    const targetState = visible ? 'visible' : 'hidden';
    this.setState(elementId, targetState);
  }

  getElementVisibility(elementId: string): boolean {
    return this.store.elementIsVisible(elementId);
  }

  cleanup(): void {
    this.store.cleanup();
  }

  clearAll(): void {
    this.cleanup();
  }

  executeSetStateAction(action: import('../types.js').Action): void {
    const targetElementRef = action.target_element_ref;
    const state = action.state;
    
    if (!targetElementRef || !state) {
      console.warn('set_state action missing target_element_ref or state');
      return;
    }
    
    this.setState(targetElementRef, state);
  }

  executeToggleStateAction(action: import('../types.js').Action): void {
    const targetElementRef = action.target_element_ref;
    const states = action.states;
    
    if (!targetElementRef || !states || !Array.isArray(states)) {
      console.warn('toggle_state action missing target_element_ref or states array');
      return;
    }
    
    this.toggleState(targetElementRef, states);
  }

  reverseAnimation(elementId: string): boolean {
    if (!this.animationContext) {
      console.warn(`[StateManager] No animation context available for reversing animation on ${elementId}`);
      return false;
    }

    return this.animations.reverseAnimation(elementId);
  }

  reverseAllAnimations(elementId: string): void {
    if (!this.animationContext) {
      console.warn(`[StateManager] No animation context available for reversing animations on ${elementId}`);
      return;
    }

    this.animations.reverseAllAnimations(elementId);
  }

  stopAnimations(elementId: string): void {
    this.animations.stopAllAnimationsForElement(elementId);
  }
}