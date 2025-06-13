/**
 * Reactive Store for LCARS Card State Management
 * 
 * This replaces the singleton StateManager with a more modern, reactive approach
 * using signals for state changes and selectors for derived state.
 */

// Simple signal implementation for reactive state management
export interface Signal<T> {
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

// Store state interfaces
export interface ElementState {
  currentState: string;
  previousState?: string;
  lastChange: number;
}

export interface StoreState {
  elementStates: Map<string, ElementState>;
  stateConfigs: Map<string, any>;
  animationConfigs: Map<string, any>;
}

export interface StateChangeEvent {
  elementId: string;
  fromState: string;
  toState: string;
  timestamp: number;
}

// Selector function type
export type Selector<T> = (state: StoreState) => T;

// Store implementation
export class ReactiveStore {
  private _state: Signal<StoreState>;
  private _stateChangeCallbacks = new Set<(event: StateChangeEvent) => void>();

  constructor() {
    this._state = createSignal<StoreState>({
      elementStates: new Map(),
      stateConfigs: new Map(),
      animationConfigs: new Map()
    });
  }

  // Core state access
  getState(): StoreState {
    return this._state.value;
  }

  subscribe(callback: (state: StoreState) => void): () => void {
    return this._state.subscribe(callback);
  }

  // Selector utilities
  select<T>(selector: Selector<T>): T {
    return selector(this.getState());
  }

  // State change events
  onStateChange(callback: (event: StateChangeEvent) => void): () => void {
    this._stateChangeCallbacks.add(callback);
    return () => this._stateChangeCallbacks.delete(callback);
  }

  private emitStateChange(event: StateChangeEvent): void {
    this._stateChangeCallbacks.forEach(callback => callback(event));
  }

  // Element state management
  initializeElementState(
    elementId: string,
    stateConfig?: any,
    animationConfig?: any
  ): void {
    this._state.update(state => {
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
      
      // Initialize state tracking for elements with only animations
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
    
    this._state.update(state => {
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

    // Emit state change event
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

    // Check if element is initialized
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

  // Element visibility now handled through regular state ('hidden'/'visible' state values)
  isElementVisible(elementId: string): boolean {
    const currentState = this.getElementState(elementId);
    return currentState !== 'hidden';
  }

  // Store cleanup
  cleanup(): void {
    this._state.set({
      elementStates: new Map(),
      stateConfigs: new Map(),
      animationConfigs: new Map()
    });
    this._stateChangeCallbacks.clear();
  }
}

// Store provider for dependency injection
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

// Hook for accessing the store (for future React-like patterns)
export function useStore(): ReactiveStore {
  return StoreProvider.getStore();
}

// Selectors for common state queries
export const selectors = {
  getElementState: (elementId: string): Selector<string> => 
    (state) => state.elementStates.get(elementId)?.currentState || 'default',
    
  // Visibility is now based on state - element is visible unless state is 'hidden'
  isElementVisible: (elementId: string): Selector<boolean> => 
    (state) => {
      const currentState = state.elementStates.get(elementId)?.currentState || 'default';
      return currentState !== 'hidden';
    },
    
  getAllElementStates: (): Selector<Map<string, ElementState>> => 
    (state) => new Map(state.elementStates),
    
  getElementsInState: (targetState: string): Selector<string[]> => 
    (state) => {
      const result: string[] = [];
      state.elementStates.forEach((elementState, elementId) => {
        if (elementState.currentState === targetState) {
          result.push(elementId);
        }
      });
      return result;
    },
    
  getVisibleElements: (): Selector<string[]> =>
    (state) => {
      const result: string[] = [];
      state.elementStates.forEach((elementState, elementId) => {
        if (elementState.currentState !== 'hidden') {
          result.push(elementId);
        }
      });
      return result;
    },
    
  getHiddenElements: (): Selector<string[]> =>
    (state) => {
      const result: string[] = [];
      state.elementStates.forEach((elementState, elementId) => {
        if (elementState.currentState === 'hidden') {
          result.push(elementId);
        }
      });
      return result;
    }
}; 