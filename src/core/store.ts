/**
 * Reactive Store for LCARS Card State Management
 * 
 * Provides a reactive state management system using signals for state changes.
 */

import { ElementStateManagementConfig, AnimationsConfig } from '../types.js';

interface Signal<T> {
  value: T;
  subscribe(callback: (value: T) => void): () => void;
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

function createSignal<T>(initialValue: T): Signal<T> {
  let _value = initialValue;
  const subscribers = new Set<(value: T) => void>();
  
  return {
    get value() {
      return _value;
    },
    
    subscribe(callback: (value: T) => void) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    
    set(value: T) {
      if (_value !== value) {
        _value = value;
        subscribers.forEach(callback => callback(_value));
      }
    },
    
    update(updater: (value: T) => T) {
      this.set(updater(_value));
    }
  };
}

export interface ElementState {
  currentState: string;
  previousState?: string;
  lastChange: number;
}

export interface StoreState {
  elementStates: Map<string, ElementState>;
  stateConfigs: Map<string, ElementStateManagementConfig>;
  animationConfigs: Map<string, AnimationsConfig>;
}

export interface StateChangeEvent {
  elementId: string;
  fromState: string;
  toState: string;
  timestamp: number;
}

export class ReactiveStore {
  private state: Signal<StoreState>;
  private stateChangeCallbacks = new Set<(event: StateChangeEvent) => void>();

  constructor() {
    this.state = createSignal<StoreState>({
      elementStates: new Map(),
      stateConfigs: new Map(),
      animationConfigs: new Map()
    });
  }

  getState(): StoreState {
    return this.state.value;
  }

  subscribe(callback: (state: StoreState) => void): () => void {
    return this.state.subscribe(callback);
  }

  onStateChange(callback: (event: StateChangeEvent) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  private emitStateChange(event: StateChangeEvent): void {
    this.stateChangeCallbacks.forEach(callback => callback(event));
  }

  registerState(name: string, value: any): void {
    this.state.update(state => {
        if (!state.elementStates.has(name)) {
            state.elementStates.set(name, {
                currentState: value,
                lastChange: Date.now()
            });
        }
        return { ...state };
    });
  }

  initializeElementState(
    elementId: string,
    stateConfig?: ElementStateManagementConfig,
    animationConfig?: AnimationsConfig
  ): void {
    this.state.update(state => {
      if (stateConfig) {
        state.stateConfigs.set(elementId, stateConfig);
        
        const defaultState = stateConfig.default_state || 'default';
        state.elementStates.set(elementId, {
          currentState: defaultState,
          lastChange: Date.now()
        });
      }
      
      if (animationConfig) {
        state.animationConfigs.set(elementId, animationConfig);
      }
      
      if (!stateConfig && animationConfig) {
        state.elementStates.set(elementId, {
          currentState: 'default',
          lastChange: Date.now()
        });
      }
      
      return { ...state };
    });
  }

  setState(elementId: string, newState: string): void {
    const currentState = this.getElementState(elementId);
    if (currentState === newState) return;

    const timestamp = Date.now();
    
    this.state.update(state => {
      const elementState = state.elementStates.get(elementId);
      if (elementState) {
        state.elementStates.set(elementId, {
          currentState: newState,
          previousState: elementState.currentState,
          lastChange: timestamp
        });
      }
      
      return { ...state };
    });

    this.emitStateChange({
      elementId,
      fromState: currentState,
      toState: newState,
      timestamp
    });
  }

  getElementState(elementId: string): string {
    const elementState = this.getState().elementStates.get(elementId);
    return elementState?.currentState || 'default';
  }

  toggleState(elementId: string, states: string[]): boolean {
    if (!states || states.length < 2) {
      console.warn(`[Store] Toggle requires at least 2 states, got ${states?.length || 0}`);
      return false;
    }

    const elementState = this.getState().elementStates.get(elementId);
    if (!elementState) {
      console.warn(`[Store] Cannot toggle state for uninitialized element: ${elementId}`);
      return false;
    }

    const currentState = this.getElementState(elementId);
    const currentIndex = states.indexOf(currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex];

    this.setState(elementId, nextState);
    return true;
  }

  elementIsVisible(elementId: string): boolean {
    const currentState = this.getElementState(elementId);
    return currentState !== 'hidden';
  }

  cleanup(): void {
    this.state.set({
      elementStates: new Map(),
      stateConfigs: new Map(),
      animationConfigs: new Map()
    });
    this.stateChangeCallbacks.clear();
  }
}

export class StoreProvider {
  private static instance: ReactiveStore | null = null;
  
  static getStore(): ReactiveStore {
    if (!StoreProvider.instance) {
      StoreProvider.instance = new ReactiveStore();
    }
    return StoreProvider.instance;
  }
  
  static setStore(store: ReactiveStore): void {
    StoreProvider.instance = store;
  }
  
  static reset(): void {
    StoreProvider.instance = null;
  }
} 