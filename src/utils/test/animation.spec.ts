/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager, AnimationContext, AnimationConfig } from '../animation';
import { HomeAssistant } from 'custom-card-helpers';

// Mock gsap
vi.mock('gsap', () => ({
  default: {
    timeline: vi.fn(() => ({
      set: vi.fn(),
      to: vi.fn(),
      play: vi.fn(),
    })),
    to: vi.fn(),
    killTweensOf: vi.fn(),
  },
}));

describe('AnimationManager - Pure Animation API', () => {
  let manager: AnimationManager;
  let mockElement: Element;
  let mockContext: AnimationContext;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new AnimationManager();
    
    // Mock DOM element
    mockElement = {
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      id: 'test-element',
    } as unknown as Element;

    // Mock animation context
    mockContext = {
      elementId: 'test-element',
      getShadowElement: vi.fn().mockReturnValue(mockElement),
    };
  });

  describe('element animation tracking', () => {
    it('should initialize animation state for new element', () => {
      manager.initializeElementAnimationTracking('test-element');
      
      const state = manager.getElementAnimationState('test-element');
      expect(state).toBeDefined();
      expect(state?.lastKnownEntityStates).toBeInstanceOf(Map);
    });

    it('should cleanup animation tracking', () => {
      manager.initializeElementAnimationTracking('test-element');
      expect(manager.getElementAnimationState('test-element')).toBeDefined();
      
      manager.cleanupElementAnimationTracking('test-element');
      expect(manager.getElementAnimationState('test-element')).toBeUndefined();
    });
  });

  describe('pure animation creation', () => {
    it('should create animation timeline for scale animation', () => {
      const config: AnimationConfig = {
        type: 'scale',
        duration: 1000,
        scale_params: {
          scale_start: 0.5,
          scale_end: 1.0,
        },
      };

      const result = manager.createAnimationTimeline('test-element', config, mockElement);
      
      expect(result).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.affectsPositioning).toBe(true);
      expect(result.syncData.duration).toBe(1000);
    });

    it('should create animation timeline for fade animation', () => {
      const config: AnimationConfig = {
        type: 'fade',
        duration: 500,
        fade_params: {
          opacity_start: 0,
          opacity_end: 1,
        },
      };

      const result = manager.createAnimationTimeline('test-element', config, mockElement);
      
      expect(result).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.affectsPositioning).toBe(false);
      expect(result.syncData.duration).toBe(500);
    });
  });

  describe('animation execution', () => {
    it('should execute animation when element is found', () => {
      const config: AnimationConfig = {
        type: 'fade',
        duration: 300,
        fade_params: {
          opacity_start: 0,
          opacity_end: 1,
        },
      };

      const result = manager.executeAnimation('test-element', config, mockContext);
      
      expect(result).toBeDefined();
      expect(mockContext.getShadowElement).toHaveBeenCalledWith('test-element');
    });

    it('should return null when element is not found', () => {
      const config: AnimationConfig = {
        type: 'fade',
        duration: 300,
      };

      const contextWithoutElement = {
        ...mockContext,
        getShadowElement: vi.fn().mockReturnValue(null),
      };

      const result = manager.executeAnimation('test-element', config, contextWithoutElement);
      
      expect(result).toBeNull();
    });
  });

  describe('positioning effects detection', () => {
    it('should detect positioning effects for scale animations', () => {
      const config: AnimationConfig = { type: 'scale' };
      expect(manager.hasPositioningEffects(config)).toBe(true);
    });

    it('should detect positioning effects for slide animations', () => {
      const config: AnimationConfig = { type: 'slide' };
      expect(manager.hasPositioningEffects(config)).toBe(true);
    });

    it('should not detect positioning effects for fade animations', () => {
      const config: AnimationConfig = { type: 'fade' };
      expect(manager.hasPositioningEffects(config)).toBe(false);
    });
  });
}); 