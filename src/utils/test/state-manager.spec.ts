import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager, StateChangeEvent } from '../state-manager.js';

describe('StateManager Visibility Integration', () => {
  let stateManager: StateManager;
  let stateChangeEvents: StateChangeEvent[] = [];

  beforeEach(() => {
    stateManager = new StateManager();
    stateChangeEvents = [];
    
    // Set up state change listener
    stateManager.onStateChange((event) => {
      stateChangeEvents.push(event);
    });
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