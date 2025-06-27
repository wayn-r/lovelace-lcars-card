/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager } from '../state-manager.js';
import { StoreProvider, StateChangeEvent } from '../../core/store.js';
import gsap from 'gsap';

describe('StateManager Visibility Integration', () => {
  let stateManager: StateManager;
  let stateChangeEvents: StateChangeEvent[] = [];

  beforeEach(() => {
    // Reset the store to ensure clean state
    StoreProvider.reset();
    stateManager = new StateManager();
    stateChangeEvents = [];
    
    // Set up state change listener
    stateManager.onStateChange((event) => {
      stateChangeEvents.push(event);
    });
  });

  afterEach(() => {
    // Clean up after each test
    stateManager.cleanup();
    StoreProvider.reset();
  });

  describe('Visibility States', () => {
    it('should initialize element with hidden state', () => {
      stateManager.initializeElementState('test-element', {
        default_state: 'hidden'
      });
      
      const state = stateManager.getState('test-element');
      expect(state).toBe('hidden');
    });

    it('should initialize element with visible state', () => {
      stateManager.initializeElementState('test-element', {
        default_state: 'visible'
      });
      
      const state = stateManager.getState('test-element');
      expect(state).toBe('visible');
    });

    it('should toggle between hidden and visible states', () => {
      stateManager.initializeElementState('test-element', {
        default_state: 'hidden'
      });
      
      // Toggle from hidden to visible
      const result1 = stateManager.toggleState('test-element', ['hidden', 'visible']);
      expect(result1).toBe(true);
      expect(stateManager.getState('test-element')).toBe('visible');
      
      // Toggle from visible back to hidden
      const result2 = stateManager.toggleState('test-element', ['hidden', 'visible']);
      expect(result2).toBe(true);
      expect(stateManager.getState('test-element')).toBe('hidden');
    });

    it('should emit state change events for visibility states', () => {
      stateManager.initializeElementState('test-element', {
        default_state: 'hidden'
      });
      
      // Clear initial events
      stateChangeEvents = [];
      
      // Change state to visible
      stateManager.setState('test-element', 'visible');
      
      expect(stateChangeEvents).toHaveLength(1);
      expect(stateChangeEvents[0]).toMatchObject({
        elementId: 'test-element',
        fromState: 'hidden',
        toState: 'visible'
      });
    });

    it('should handle toggle with uninitialized element', () => {
      const result = stateManager.toggleState('uninitialized-element', ['hidden', 'visible']);
      expect(result).toBe(false);
      expect(stateManager.getState('uninitialized-element')).toBe(undefined);
    });

    it('should handle toggle with empty states array', () => {
      stateManager.initializeElementState('test-element', {
        default_state: 'hidden'
      });
      
      const result = stateManager.toggleState('test-element', []);
      expect(result).toBe(false);
    });
  });
});

describe('StateManager - Redundant State Change Prevention', () => {
  let stateManager: StateManager;
  let animationManager: any;
  let elementsMap: Map<string, any>;
  let mockGetShadowElement: ReturnType<typeof vi.fn>;
  let mockElement: any;
  let executeAnimationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset the store to ensure clean state
    StoreProvider.reset();
    stateManager = new StateManager();
    animationManager = (stateManager as any).store.animationManager;
    
    mockElement = document.createElement('div');
    mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
    
    elementsMap = new Map();
    elementsMap.set('test-element', {
      id: 'test-element',
      layoutConfig: {
        anchor: null,
        stretch: null
      },
      layout: { x: 0, y: 0, width: 100, height: 50 },
      props: {
        state_management: {
          default_state: 'normal',
          states: ['normal', 'scaled']
        },
        animations: {
          on_state_change: [
            {
              from_state: 'normal',
              to_state: 'scaled',
              type: 'scale',
              scale_params: { scale_start: 1, scale_end: 1.5 },
              duration: 500
            },
            {
              from_state: 'scaled', 
              to_state: 'normal',
              type: 'scale',
              scale_params: { scale_start: 1.5, scale_end: 1 },
              duration: 500
            }
          ]
        }
      }
    });

    stateManager.setAnimationContext({
      elementId: 'test-element',
      getShadowElement: mockGetShadowElement
    }, elementsMap);

    // Initialize the element
    stateManager.initializeElementState(
      'test-element', 
      elementsMap.get('test-element')!.props.state_management,
      elementsMap.get('test-element')!.props.animations
    );

    // Spy on executeAnimation to track animation calls
    executeAnimationSpy = vi.spyOn(stateManager, 'executeAnimation');
  });

  afterEach(() => {
    if (executeAnimationSpy) {
      executeAnimationSpy.mockRestore();
    }
    // Clean up after each test
    stateManager.cleanup();
    StoreProvider.reset();
  });

  it('should not trigger animation when setting state to current state', () => {
    // Element starts in 'normal' state
    expect(stateManager.getState('test-element')).toBe('normal');
    
    // Setting to 'normal' again should not trigger animation
    stateManager.setState('test-element', 'normal');
    
    expect(executeAnimationSpy).not.toHaveBeenCalled();
    expect(stateManager.getState('test-element')).toBe('normal');
  });

  it('should trigger animation when state actually changes', () => {
    // Change from 'normal' to 'scaled' - should trigger animation
    stateManager.setState('test-element', 'scaled');
    
    expect(executeAnimationSpy).toHaveBeenCalledOnce();
    expect(stateManager.getState('test-element')).toBe('scaled');
  });

  it('should not trigger animation when setting to same state after actual change', () => {
    // First change: normal -> scaled (should trigger animation)
    stateManager.setState('test-element', 'scaled');
    expect(executeAnimationSpy).toHaveBeenCalledOnce();
    
    executeAnimationSpy.mockClear();
    
    // Second call with same state (should NOT trigger animation)
    stateManager.setState('test-element', 'scaled');
    expect(executeAnimationSpy).not.toHaveBeenCalled();
    expect(stateManager.getState('test-element')).toBe('scaled');
  });

  it('should handle multiple redundant calls without side effects', () => {
    // Multiple calls to set 'normal' state (should not trigger any animations)
    stateManager.setState('test-element', 'normal');
    stateManager.setState('test-element', 'normal');
    stateManager.setState('test-element', 'normal');
    
    expect(executeAnimationSpy).not.toHaveBeenCalled();
    expect(stateManager.getState('test-element')).toBe('normal');
  });

  it('should work correctly with state transitions after redundant calls', () => {
    // Redundant call first
    stateManager.setState('test-element', 'normal');
    expect(executeAnimationSpy).not.toHaveBeenCalled();
    
    // Actual state change should still work
    stateManager.setState('test-element', 'scaled');
    expect(executeAnimationSpy).toHaveBeenCalledOnce();
    expect(stateManager.getState('test-element')).toBe('scaled');
    
    executeAnimationSpy.mockClear();
    
    // Another redundant call
    stateManager.setState('test-element', 'scaled');
    expect(executeAnimationSpy).not.toHaveBeenCalled();
    
    // Stop any existing animations to ensure new animation is created instead of reversed
    stateManager.stopAnimations('test-element');
    
    // Back to normal (should trigger animation)
    stateManager.setState('test-element', 'normal');
    expect(executeAnimationSpy).toHaveBeenCalledOnce();
  });

  it('should prevent redundant visibility state changes', () => {
    // Add a visibility element with animations to the map
    elementsMap.set('visibility-element', {
      id: 'visibility-element',
      layoutConfig: { anchor: null, stretch: null },
      layout: { x: 0, y: 0, width: 100, height: 50 },
      props: {
        state_management: { default_state: 'visible' },
        animations: {
          on_state_change: [
            {
              from_state: 'visible',
              to_state: 'hidden',
              type: 'fade',
              fade_params: { opacity_start: 1, opacity_end: 0 },
              duration: 300
            },
            {
              from_state: 'hidden',
              to_state: 'visible',
              type: 'fade',
              fade_params: { opacity_start: 0, opacity_end: 1 },
              duration: 300
            }
          ]
        }
      }
    });
    
    // Update the animation context with the new elements map
    stateManager.setAnimationContext({
      elementId: 'visibility-element',
      getShadowElement: mockGetShadowElement
    }, elementsMap);
    
    // Initialize with visibility state
    stateManager.initializeElementState(
      'visibility-element', 
      { default_state: 'visible' },
      elementsMap.get('visibility-element')!.props.animations
    );
    
    const visibilityExecuteSpy = vi.spyOn(stateManager, 'executeAnimation');
    
    // Setting to current visibility state should not trigger animation
    stateManager.setElementVisibility('visibility-element', true); // visible -> visible
    expect(visibilityExecuteSpy).not.toHaveBeenCalled();
    
    // Actual change should trigger
    stateManager.setElementVisibility('visibility-element', false); // visible -> hidden
    expect(visibilityExecuteSpy).toHaveBeenCalledOnce();
    
    visibilityExecuteSpy.mockRestore();
  });
});

describe('StateManager - Initial Animation States', () => {
  let stateManager: StateManager;
  let mockGetShadowElement: any;
  let mockElement: any;
  let elementsMap: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
    
    // Mock element
    mockElement = {
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      id: 'test-element',
    };
    
    mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
    
    elementsMap = new Map();
  });

  it('should set initial opacity for on_load fade animations', () => {
    // Create element with on_load fade animation
    const fadeElement = {
      id: 'fade-element',
      layoutConfig: { anchor: null, stretch: null },
      layout: { x: 0, y: 0, width: 100, height: 50 },
      props: {
        animations: {
          on_load: {
            type: 'fade',
            fade_params: {
              opacity_start: 0,
              opacity_end: 1
            },
            duration: 2000
          }
        }
      }
    };
    
    elementsMap.set('fade-element', fadeElement);
    
    // Set animation context
    stateManager.setAnimationContext({
      elementId: 'fade-element',
      getShadowElement: mockGetShadowElement
    }, elementsMap);
    
    // Mock GSAP set method
    const gsapSetSpy = vi.spyOn(gsap, 'set');
    
    // Call setInitialAnimationStates
    const groups = [{
      id: 'test-group',
      elements: [fadeElement as any]
    }] as any;
    
    stateManager.setInitialAnimationStates(groups);
    
    // Verify that GSAP.set was called with the correct initial opacity
    expect(gsapSetSpy).toHaveBeenCalledWith(mockElement, expect.objectContaining({ opacity: 0 }));
    
    gsapSetSpy.mockRestore();
  });

  it('should set final state opacity for state-based fade animations', () => {
    // Create element with state-based fade animations
    const stateElement = {
      id: 'state-element',
      layoutConfig: { anchor: null, stretch: null },
      layout: { x: 0, y: 0, width: 100, height: 50 },
      props: {
        state_management: { default_state: 'normal' },
        animations: {
          on_state_change: [
            {
              from_state: 'normal',
              to_state: 'changed',
              type: 'fade',
              fade_params: { opacity_start: 0.2, opacity_end: 1 },
              duration: 300
            },
            {
              from_state: 'changed',
              to_state: 'normal',
              type: 'fade',
              fade_params: { opacity_start: 1, opacity_end: 0.2 },
              duration: 300
            }
          ]
        }
      }
    };
    
    elementsMap.set('state-element', stateElement);
    
    // Set animation context
    stateManager.setAnimationContext({
      elementId: 'state-element',
      getShadowElement: mockGetShadowElement
    }, elementsMap);
    
    // Initialize element state
    stateManager.initializeElementState(
      'state-element',
      { default_state: 'normal' },
      stateElement.props.animations
    );
    
    // Mock GSAP set method
    const gsapSetSpy = vi.spyOn(gsap, 'set');
    
    // Call setInitialAnimationStates
    const groups = [{
      id: 'test-group',
      elements: [stateElement as any]
    }] as any;
    
    stateManager.setInitialAnimationStates(groups);
    
    // Verify that GSAP.set was called with the final opacity for the current state (normal = 0.2)
    expect(gsapSetSpy).toHaveBeenCalledWith(mockElement, expect.objectContaining({ opacity: 0.2 }));
    
    gsapSetSpy.mockRestore();
  });

  it('should handle elements without animations gracefully', () => {
    // Create element without animations
    const plainElement = {
      id: 'plain-element',
      layoutConfig: { anchor: null, stretch: null },
      layout: { x: 0, y: 0, width: 100, height: 50 },
      props: {}
    };
    
    elementsMap.set('plain-element', plainElement);
    
    // Set animation context
    stateManager.setAnimationContext({
      elementId: 'plain-element',
      getShadowElement: mockGetShadowElement
    }, elementsMap);
    
    // Mock GSAP set method
    const gsapSetSpy = vi.spyOn(gsap, 'set');
    
    // Call setInitialAnimationStates
    const groups = [{
      id: 'test-group',
      elements: [plainElement as any]
    }] as any;
    
    stateManager.setInitialAnimationStates(groups);
    
    // Verify that GSAP.set was not called for elements without animations
    expect(gsapSetSpy).not.toHaveBeenCalled();
    
    gsapSetSpy.mockRestore();
  });
}); 