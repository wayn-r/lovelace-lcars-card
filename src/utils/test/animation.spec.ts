/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager, AnimationContext, AnimationConfig, ColorAnimationUtils } from '../animation';
import { HomeAssistant } from 'custom-card-helpers';

// Mock gsap
vi.mock('gsap', () => ({
  default: {
    timeline: vi.fn(() => ({
      set: vi.fn(),
      to: vi.fn(),
      fromTo: vi.fn(),
      add: vi.fn(),
      play: vi.fn(),
      reverse: vi.fn(),
      kill: vi.fn(),
      delay: vi.fn(),
    })),
    to: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
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

    it('should create animation timeline for color animation', () => {
      const config: AnimationConfig = {
        type: 'color',
        duration: 1000,
        color_params: {
          property: 'fill',
          color_start: '#ffc996',
          color_end: '#df8313',
        },
      };

      const result = manager.createAnimationTimeline('test-element', config, mockElement);
      
      expect(result).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.affectsPositioning).toBe(false);
      expect(result.syncData.duration).toBe(1000);
    });

    it('should create color animation without start color', () => {
      const config: AnimationConfig = {
        type: 'color',
        duration: 500,
        color_params: {
          property: 'stroke',
          color_end: '#df8313',
        },
      };

      const result = manager.createAnimationTimeline('test-element', config, mockElement);
      
      expect(result).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.affectsPositioning).toBe(false);
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
      expect(manager.animationEffectsPositioning(config)).toBe(true);
    });

    it('should detect positioning effects for slide animations', () => {
      const config: AnimationConfig = { type: 'slide' };
      expect(manager.animationEffectsPositioning(config)).toBe(true);
    });

    it('should not detect positioning effects for fade animations', () => {
      const config: AnimationConfig = { type: 'fade' };
      expect(manager.animationEffectsPositioning(config)).toBe(false);
    });
  });

  describe('Timeline Reversal', () => {
    it('should reverse timeline instead of creating new animation for scale reversal', () => {
      const element = document.createElement('div');
      const getShadowElement = vi.fn().mockReturnValue(element);
      
      const scaleUpConfig: AnimationConfig = {
        type: 'scale',
        scale_params: {
          scale_start: 1,
          scale_end: 1.2,
          transform_origin: 'center center'
        },
        duration: 300,
        ease: 'bounce.out'
      };
      
      const context: AnimationContext = {
        elementId: 'test-element',
        getShadowElement
      };
      
      // Execute the initial scale up animation
      const result = manager.executeAnimation('test-element', scaleUpConfig, context);
      expect(result).not.toBeNull();
      expect(result!.timeline).toBeDefined();
      
      // Verify timeline is stored
      const activeTimelines = manager.getActiveTimelines('test-element');
      expect(activeTimelines).toBeDefined();
      expect(activeTimelines!.length).toBe(1);
      expect(activeTimelines![0].isReversed).toBe(false);
      
      // Now reverse the animation
      const reversed = manager.reverseAnimation('test-element');
      expect(reversed).toBe(true);
      
      // Verify the timeline is marked as reversed
      const timelinesAfterReverse = manager.getActiveTimelines('test-element');
      expect(timelinesAfterReverse).toBeDefined();
      expect(timelinesAfterReverse!.length).toBe(1);
      expect(timelinesAfterReverse![0].isReversed).toBe(true);
    });

    it('should detect reverse transitions correctly for scale animations', async () => {
      // Create a simple test that focuses on the core reversal detection logic
      const scaleUpConfig: AnimationConfig = {
        type: 'scale',
        scale_params: {
          scale_start: 1,
          scale_end: 1.2,
          transform_origin: 'center center'
        },
        duration: 300,
        ease: 'bounce.out'
      };
      
      const scaleDownConfig = {
        type: 'scale',
        scale_params: {
          scale_start: 1.2,
          scale_end: 1,
          transform_origin: 'center center'
        },
        duration: 300,
        ease: 'power2.inOut'
      };
      
      // Import StateManager and test the reverse detection
      const { StateManager } = await import('../state-manager.js');
      const stateManager = new StateManager();
      
      // Test the isReverseTransition method via the private method access
      const isReverse = (stateManager as any).isReverseTransition(
        scaleUpConfig,
        scaleDownConfig,
        'normal',
        'scaled'
      );
      
      expect(isReverse).toBe(true);
    });

    it('should use anchor point as transform origin for anchored elements', () => {
      const element = document.createElement('div');
      const getShadowElement = vi.fn().mockReturnValue(element);
      
      // Create a mock element with anchor configuration
      const mockElement = {
        layoutConfig: {
          anchor: {
            anchorTo: 'target-element',
            anchorPoint: 'top-left',
            targetAnchorPoint: 'top-right'
          }
        }
      };
      
      // Set up elements map
      const elementsMap = new Map();
      elementsMap.set('test-element', mockElement);
      manager.setElementsMap(elementsMap);
      
      const scaleConfig: AnimationConfig = {
        type: 'scale',
        scale_params: {
          scale_start: 1,
          scale_end: 1.2
          // No explicit transform_origin - should use anchor point
        },
        duration: 300,
        ease: 'bounce.out'
      };
      
      const context: AnimationContext = {
        elementId: 'test-element',
        getShadowElement
      };
      
      // Execute the animation
      const result = manager.executeAnimation('test-element', scaleConfig, context);
      expect(result).not.toBeNull();
      
      // Verify that the timeline was stored with the correct transform origin
      const activeTimelines = manager.getActiveTimelines('test-element');
      expect(activeTimelines).toBeDefined();
      expect(activeTimelines!.length).toBe(1);
      expect(activeTimelines![0].transformOrigin).toBe('left top'); // topLeft -> left top
    });
  });
});

describe('ColorAnimationUtils', () => {
  describe('parseColorToRgb', () => {
    it('should parse hex colors correctly', () => {
      const result = ColorAnimationUtils.parseColorToRgb('#ffc996');
      expect(result).toEqual({ r: 255, g: 201, b: 150 });
    });

    it('should parse hex colors without # prefix', () => {
      const result = ColorAnimationUtils.parseColorToRgb('df8313');
      expect(result).toEqual({ r: 223, g: 131, b: 19 });
    });

    it('should parse rgb colors correctly', () => {
      const result = ColorAnimationUtils.parseColorToRgb('rgb(255, 201, 150)');
      expect(result).toEqual({ r: 255, g: 201, b: 150 });
    });

    it('should return null for invalid colors', () => {
      const result = ColorAnimationUtils.parseColorToRgb('invalid-color');
      expect(result).toBeNull();
    });
  });

  describe('interpolateColors', () => {
    it('should interpolate between two hex colors', () => {
      const result = ColorAnimationUtils.interpolateColors('#ffc996', '#df8313', 0.5);
      expect(result).toBe('#efa655'); // #ffc996 (255,201,150) + #df8313 (223,131,19) at 0.5 = (239,166,85)
    });

    it('should return start color at progress 0', () => {
      const result = ColorAnimationUtils.interpolateColors('#ffc996', '#df8313', 0);
      expect(result).toBe('#ffc996');
    });

    it('should return end color at progress 1', () => {
      const result = ColorAnimationUtils.interpolateColors('#ffc996', '#df8313', 1);
      expect(result).toBe('#df8313');
    });

    it('should handle invalid colors gracefully', () => {
      const result = ColorAnimationUtils.interpolateColors('invalid', '#df8313', 0.5);
      expect(result).toBe('#df8313'); // Should return end color when start is invalid
    });
  });
}); 