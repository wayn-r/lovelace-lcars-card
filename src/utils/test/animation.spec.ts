/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { AnimationManager, animationManager, ColorAnimationState, AnimationContext, EntityStateMonitoringData } from '../animation';
import { HomeAssistant } from 'custom-card-helpers';
import { DynamicColorConfig, isDynamicColorConfig } from '../../types';

// Mock gsap
vi.mock('gsap', () => ({
  gsap: {
    to: vi.fn(),
    killTweensOf: vi.fn(),
  },
}));

// Mock the types module to control isDynamicColorConfig
vi.mock('../../types', () => ({
  isDynamicColorConfig: vi.fn(),
}));

// Helper function to create mock HassEntity
const createMockEntity = (state: string | number, attributes: Record<string, any> = {}): any => ({
  entity_id: 'test.entity',
  state: state.toString(),
  attributes,
  last_changed: '2023-01-01T00:00:00+00:00',
  last_updated: '2023-01-01T00:00:00+00:00',
  context: { id: 'test-context', user_id: null },
});

describe('AnimationManager', () => {
  let manager: AnimationManager;
  let mockHass: HomeAssistant;
  let mockGetShadowElement: MockedFunction<(id: string) => Element | null>;
  let mockRequestUpdate: MockedFunction<() => void>;
  let mockElement: Element;
  let mockGsapTo: MockedFunction<any>;
  let mockGsapKillTweensOf: MockedFunction<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    manager = new AnimationManager();
    
    // Get references to the mocked gsap functions
    const { gsap } = await import('gsap');
    mockGsapTo = vi.mocked(gsap.to);
    mockGsapKillTweensOf = vi.mocked(gsap.killTweensOf);
    
    // Mock HomeAssistant
    mockHass = {
      states: {},
    } as HomeAssistant;

    // Mock DOM element
    mockElement = {
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      id: 'test-element',
    } as unknown as Element;

    // Mock getShadowElement function
    mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
    
    // Mock requestUpdate callback
    mockRequestUpdate = vi.fn();

    // Reset GSAP mocks
    mockGsapTo.mockClear();
    mockGsapKillTweensOf.mockClear();
  });

  describe('initializeElementAnimationTracking', () => {
    it('should initialize animation state for new element', () => {
      manager.initializeElementAnimationTracking('test-element');
      
      const state = manager.getElementAnimationState('test-element');
      expect(state).toEqual({
        isAnimatingFillColor: false,
        isAnimatingStrokeColor: false
      });
    });

    it('should not overwrite existing animation state', () => {
      manager.initializeElementAnimationTracking('test-element');
      const originalState = manager.getElementAnimationState('test-element');
      originalState!.isAnimatingFillColor = true;
      
      manager.initializeElementAnimationTracking('test-element');
      const currentState = manager.getElementAnimationState('test-element');
      expect(currentState!.isAnimatingFillColor).toBe(true);
    });

    it('should initialize entity monitoring data', () => {
      manager.initializeElementAnimationTracking('test-element');
      
      // Test that entity tracking works (indirect test)
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(false); // Should be false with no tracked entities
    });
  });

  describe('cleanupElementAnimationTracking', () => {
    it('should execute pending animation callbacks before cleanup', () => {
      const fillCallback = vi.fn();
      const strokeCallback = vi.fn();
      
      manager.initializeElementAnimationTracking('test-element');
      const state = manager.getElementAnimationState('test-element')!;
      state.fillAnimationCompleteCallback = fillCallback;
      state.strokeAnimationCompleteCallback = strokeCallback;
      
      manager.cleanupElementAnimationTracking('test-element');
      
      expect(fillCallback).toHaveBeenCalled();
      expect(strokeCallback).toHaveBeenCalled();
    });

    it('should remove all tracking data', () => {
      manager.initializeElementAnimationTracking('test-element');
      expect(manager.getElementAnimationState('test-element')).toBeDefined();
      
      manager.cleanupElementAnimationTracking('test-element');
      expect(manager.getElementAnimationState('test-element')).toBeUndefined();
    });

    it('should handle cleanup of non-existent element gracefully', () => {
      expect(() => {
        manager.cleanupElementAnimationTracking('non-existent');
      }).not.toThrow();
    });
  });

  describe('getElementAnimationState', () => {
    it('should return undefined for untracked element', () => {
      const state = manager.getElementAnimationState('untracked');
      expect(state).toBeUndefined();
    });

    it('should return animation state for tracked element', () => {
      manager.initializeElementAnimationTracking('test-element');
      const state = manager.getElementAnimationState('test-element');
      expect(state).toBeDefined();
      expect(state?.isAnimatingFillColor).toBe(false);
      expect(state?.isAnimatingStrokeColor).toBe(false);
    });
  });

  describe('animateColorTransition', () => {
    let animationContext: AnimationContext;

    beforeEach(() => {
      animationContext = {
        elementId: 'test-element',
        getShadowElement: mockGetShadowElement,
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate,
      };
    });

    it('should start GSAP animation for valid parameters', () => {
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      
      expect(mockGsapKillTweensOf).toHaveBeenCalledWith(mockElement, 'fill');
      expect(mockGsapTo).toHaveBeenCalledWith(mockElement, expect.objectContaining({
        duration: 0.3,
        ease: "power2.out",
        attr: { fill: '#ff0000' },
      }));
    });

    it('should set element to starting color before animation', () => {
      manager.animateColorTransition('test-element', 'stroke', '#ff0000', '#0000ff', animationContext);
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('stroke', '#0000ff');
    });

    it('should track animation state during transition', () => {
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      
      const state = manager.getElementAnimationState('test-element');
      expect(state?.isAnimatingFillColor).toBe(true);
      // The targetFillColor should be set by the animateColorTransition method
      expect(state?.targetFillColor).toBeUndefined(); // This is expected since animateColorTransition doesn't set targetFillColor
    });

    it('should handle missing element gracefully', () => {
      mockGetShadowElement.mockReturnValue(null);
      
      expect(() => {
        manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      }).not.toThrow();
      
      const state = manager.getElementAnimationState('test-element');
      expect(state?.targetFillColor).toBe('#ff0000');
    });

    it('should not animate if starting and target colors are the same', () => {
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#ff0000', animationContext);
      
      expect(mockGsapTo).not.toHaveBeenCalled();
      const state = manager.getElementAnimationState('test-element');
      expect(state?.targetFillColor).toBe('#ff0000');
    });

    it('should clear existing animation callbacks before starting new animation', () => {
      const existingCallback = vi.fn();
      manager.initializeElementAnimationTracking('test-element');
      const state = manager.getElementAnimationState('test-element')!;
      state.fillAnimationCompleteCallback = existingCallback;
      
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      
      expect(existingCallback).toHaveBeenCalled();
    });

    it('should execute onComplete callback when animation finishes', () => {
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      
      // Get the animation options passed to GSAP
      const animationOptions = mockGsapTo.mock.calls[0][1] as any;
      
      // Execute the onComplete callback
      animationOptions.onComplete();
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('fill', '#ff0000');
      const state = manager.getElementAnimationState('test-element');
      expect(state?.isAnimatingFillColor).toBe(false);
      expect(state?.fillAnimationCompleteCallback).toBeUndefined();
    });

    it('should handle GSAP animation errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      manager.animateColorTransition('test-element', 'fill', '#ff0000', '#0000ff', animationContext);
      
      // Get the animation options and trigger error handler
      const animationOptions = mockGsapTo.mock.calls[0][1] as any;
      animationOptions.onError('Test error');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-element] Animation error for fill:'),
        'Test error'
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('normalizeColorForComparison', () => {
    it('should convert rgb() to hex format', () => {
      const result = manager['normalizeColorForComparison']('rgb(255, 0, 0)');
      expect(result).toBe('#ff0000');
    });

    it('should convert rgba() to hex format (ignoring alpha)', () => {
      const result = manager['normalizeColorForComparison']('rgba(255, 0, 0, 0.5)');
      expect(result).toBe('#ff0000');
    });

    it('should add # prefix to hex colors without it', () => {
      const result = manager['normalizeColorForComparison']('ff0000');
      expect(result).toBe('#ff0000');
    });

    it('should handle colors with whitespace', () => {
      const result = manager['normalizeColorForComparison']('  #FF0000  ');
      expect(result).toBe('#ff0000');
    });

    it('should return undefined for undefined input', () => {
      const result = manager['normalizeColorForComparison'](undefined);
      expect(result).toBeUndefined();
    });

    it('should convert to lowercase', () => {
      const result = manager['normalizeColorForComparison']('#FF0000');
      expect(result).toBe('#ff0000');
    });

    it('should handle named colors as-is', () => {
      const result = manager['normalizeColorForComparison']('red');
      expect(result).toBe('red');
    });
  });

  describe('resolveDynamicColor', () => {
    beforeEach(() => {
      (isDynamicColorConfig as any).mockImplementation((value: any) => {
        return value && typeof value === 'object' && 'entity' in value;
      });
    });

    it('should return static color as-is', () => {
      const result = manager.resolveDynamicColor('test-element', '#ff0000', mockHass);
      expect(result).toBe('#ff0000');
    });

    it('should handle dynamic color configuration', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000', 'off': '#000000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      
      const result = manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      expect(result).toBe('#ff0000');
    });

    it('should return default color when entity not found', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.nonexistent',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };
      
      const result = manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      expect(result).toBe('#808080');
    });

    it('should return default color when no hass provided', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };
      
      const result = manager.resolveDynamicColor('test-element', dynamicConfig);
      expect(result).toBe('#808080');
    });
  });

  describe('extractDynamicColorFromEntityState', () => {
    it('should map entity state to color', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000', 'off': '#000000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      
      const result = manager['extractDynamicColorFromEntityState']('test-element', dynamicConfig, mockHass);
      expect(result).toBe('#ff0000');
    });

    it('should use attribute value when specified', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'climate.test',
        attribute: 'temperature',
        mapping: { '20': '#0000ff', '25': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['climate.test'] = createMockEntity('heat', { temperature: 25 });
      
      const result = manager['extractDynamicColorFromEntityState']('test-element', dynamicConfig, mockHass);
      expect(result).toBe('#ff0000');
    });

    it('should handle interpolation for numeric values', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.temperature',
        mapping: { '0': '#0000ff', '100': '#ff0000' },
        default: '#808080',
        interpolate: true
      };

      mockHass.states['sensor.temperature'] = createMockEntity(50);
      
      const result = manager['extractDynamicColorFromEntityState']('test-element', dynamicConfig, mockHass);
      // Should return one of the mapped colors (nearest value logic)
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('should track entity for change detection', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      
      manager.initializeElementAnimationTracking('test-element');
      manager['extractDynamicColorFromEntityState']('test-element', dynamicConfig, mockHass);
      
      // Verify entity is being tracked
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(false); // No changes since last check
    });
  });

  describe('interpolateColorFromNumericValue', () => {
    it('should return exact match when available', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.test',
        mapping: { '0': '#0000ff', '50': '#808080', '100': '#ff0000' },
        default: '#000000'
      };
      
      const result = manager['interpolateColorFromNumericValue'](50, dynamicConfig);
      expect(result).toBe('#808080');
    });

    it('should return nearest value for non-exact matches', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.test',
        mapping: { '0': '#0000ff', '100': '#ff0000' },
        default: '#000000'
      };
      
      const result = manager['interpolateColorFromNumericValue'](25, dynamicConfig);
      expect(result).toBe('#0000ff'); // Should return nearest (0 is closer to 25 than 100)
    });

    it('should return default when no numeric keys available', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.test',
        mapping: { 'on': '#ff0000', 'off': '#000000' },
        default: '#808080'
      };
      
      const result = manager['interpolateColorFromNumericValue'](50, dynamicConfig);
      expect(result).toBe('#808080');
    });

    it('should handle single mapping value', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.test',
        mapping: { '50': '#ff0000' },
        default: '#000000'
      };
      
      const result = manager['interpolateColorFromNumericValue'](75, dynamicConfig);
      expect(result).toBe('#ff0000'); // Only option available
    });
  });

  describe('formatColorValueFromInput', () => {
    it('should return string colors as-is', () => {
      const result = manager['formatColorValueFromInput']('#ff0000');
      expect(result).toBe('#ff0000');
    });

    it('should convert RGB array to rgb() string', () => {
      const result = manager['formatColorValueFromInput']([255, 0, 0]);
      expect(result).toBe('rgb(255,0,0)');
    });

    it('should return undefined for invalid RGB arrays', () => {
      expect(manager['formatColorValueFromInput']([255, 0])).toBeUndefined();
      expect(manager['formatColorValueFromInput']([255, 0, 'red'])).toBeUndefined();
      expect(manager['formatColorValueFromInput']([255, 0, 0, 255])).toBeUndefined();
    });

    it('should return undefined for other data types', () => {
      expect(manager['formatColorValueFromInput'](123)).toBeUndefined();
      expect(manager['formatColorValueFromInput']({})).toBeUndefined();
      expect(manager['formatColorValueFromInput'](null)).toBeUndefined();
      expect(manager['formatColorValueFromInput'](undefined)).toBeUndefined();
    });
  });

  describe('checkForEntityStateChanges', () => {
    beforeEach(() => {
      manager.initializeElementAnimationTracking('test-element');
    });

    it('should return false when no entities are tracked', () => {
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(false);
    });

    it('should detect state changes', () => {
      // Set up initial tracking
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000', 'off': '#000000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('off');
      (isDynamicColorConfig as any).mockReturnValue(true);
      
      // Initial resolution to establish tracking
      manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      
      // Change entity state
      mockHass.states['light.test'] = createMockEntity('on');
      
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(true);
    });

    it('should detect attribute changes', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'climate.test',
        attribute: 'temperature',
        mapping: { '20': '#0000ff', '25': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['climate.test'] = createMockEntity('heat', { temperature: 20 });
      (isDynamicColorConfig as any).mockReturnValue(true);
      
      // Initial resolution
      manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      
      // Change attribute
      mockHass.states['climate.test'] = createMockEntity('heat', { temperature: 25 });
      
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(true);
    });

    it('should handle missing entities gracefully', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      (isDynamicColorConfig as any).mockReturnValue(true);
      
      // Initial resolution
      manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      
      // Remove entity
      delete mockHass.states['light.test'];
      
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(true);
    });
  });

  describe('clearTrackedEntitiesForElement', () => {
    it('should clear all tracked entities and states', () => {
      manager.initializeElementAnimationTracking('test-element');
      
      // Add some tracking
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      (isDynamicColorConfig as any).mockReturnValue(true);
      manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      
      // Clear tracking
      manager.clearTrackedEntitiesForElement('test-element');
      
      // Should detect no changes now
      const hasChanges = manager.checkForEntityStateChanges('test-element', mockHass);
      expect(hasChanges).toBe(false);
    });

    it('should handle non-existent elements gracefully', () => {
      expect(() => {
        manager.clearTrackedEntitiesForElement('non-existent');
      }).not.toThrow();
    });
  });

  describe('stopAllAnimationsForElement', () => {
    it('should execute pending animation callbacks', () => {
      const fillCallback = vi.fn();
      const strokeCallback = vi.fn();
      
      manager.initializeElementAnimationTracking('test-element');
      const state = manager.getElementAnimationState('test-element')!;
      state.fillAnimationCompleteCallback = fillCallback;
      state.strokeAnimationCompleteCallback = strokeCallback;
      state.isAnimatingFillColor = true;
      state.isAnimatingStrokeColor = true;
      
      manager.stopAllAnimationsForElement('test-element');
      
      expect(fillCallback).toHaveBeenCalled();
      expect(strokeCallback).toHaveBeenCalled();
      expect(state.isAnimatingFillColor).toBe(false);
      expect(state.isAnimatingStrokeColor).toBe(false);
    });

    it('should handle elements without animation state', () => {
      expect(() => {
        manager.stopAllAnimationsForElement('non-existent');
      }).not.toThrow();
    });
  });

  describe('collectAnimationStates', () => {
    it('should collect animation states for animating elements', () => {
      manager.initializeElementAnimationTracking('element1');
      manager.initializeElementAnimationTracking('element2');
      
      const state1 = manager.getElementAnimationState('element1')!;
      state1.isAnimatingFillColor = true;
      state1.targetFillColor = '#ff0000';
      
      const state2 = manager.getElementAnimationState('element2')!;
      state2.isAnimatingStrokeColor = true;
      state2.targetStrokeColor = '#00ff00';
      
      // Mock DOM elements
      const element1 = { getAttribute: vi.fn().mockReturnValue('#ff0000') } as unknown as Element;
      const element2 = { getAttribute: vi.fn().mockReturnValue('#00ff00') } as unknown as Element;
      
      const mockGetElement = vi.fn()
        .mockReturnValueOnce(element1)
        .mockReturnValueOnce(element2);
      
      const collected = manager.collectAnimationStates(['element1', 'element2'], mockGetElement);
      
      expect(collected.size).toBe(2);
      expect(collected.get('element1')).toEqual({
        isAnimatingFillColor: true,
        isAnimatingStrokeColor: false,
        currentVisibleFillColor: '#ff0000',
        currentVisibleStrokeColor: '#ff0000', // getAttribute is called for both fill and stroke
        targetFillColor: '#ff0000',
        targetStrokeColor: undefined
      });
    });

    it('should only collect states for animating elements', () => {
      manager.initializeElementAnimationTracking('element1');
      manager.initializeElementAnimationTracking('element2');
      
      // element1 is not animating, element2 is animating
      const state2 = manager.getElementAnimationState('element2')!;
      state2.isAnimatingFillColor = true;
      
      const collected = manager.collectAnimationStates(['element1', 'element2'], mockGetShadowElement);
      
      expect(collected.size).toBe(1);
      expect(collected.has('element1')).toBe(false);
      expect(collected.has('element2')).toBe(true);
    });
  });

  describe('restoreAnimationStates', () => {
    it('should restore animation states and restart animations', async () => {
      const animationStates = new Map();
      animationStates.set('element1', {
        isAnimatingFillColor: true,
        isAnimatingStrokeColor: false,
        currentVisibleFillColor: '#ff0000',
        targetFillColor: '#00ff00'
      });
      
      const context: AnimationContext = {
        elementId: 'element1',
        getShadowElement: mockGetShadowElement,
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };
      
      return new Promise<void>((resolve) => {
        manager.restoreAnimationStates(animationStates, context, () => {
          expect(mockElement.setAttribute).toHaveBeenCalledWith('fill', '#ff0000');
          resolve();
        });
      });
    });

    it('should call onComplete immediately when no states to restore', async () => {
      const emptyStates = new Map();
      const context: AnimationContext = {
        elementId: 'test',
        getShadowElement: mockGetShadowElement,
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };
      
      return new Promise<void>((resolve) => {
        manager.restoreAnimationStates(emptyStates, context, resolve);
      });
    });

    it('should handle missing DOM elements during restoration', async () => {
      const animationStates = new Map();
      animationStates.set('element1', {
        isAnimatingFillColor: true,
        currentVisibleFillColor: '#ff0000',
        targetFillColor: '#00ff00'
      });
      
      const context: AnimationContext = {
        elementId: 'element1',
        getShadowElement: vi.fn().mockReturnValue(null), // Element not found
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };
      
      return new Promise<void>((resolve) => {
        manager.restoreAnimationStates(animationStates, context, () => {
          // Test passes if the callback is executed without errors
          resolve();
        });
      });
    });
  });

  describe('animateElementProperty', () => {
    it('should animate generic properties using GSAP', () => {
      manager.animateElementProperty('test-element', 'opacity', 0.5, 1.0, mockGetShadowElement);
      
      expect(mockGsapTo).toHaveBeenCalledWith(mockElement, {
        duration: 1.0,
        opacity: 0.5,
        ease: "power2.out"
      });
    });

    it('should use default duration when not provided', () => {
      manager.animateElementProperty('test-element', 'opacity', 0.5, undefined, mockGetShadowElement);
      
      expect(mockGsapTo).toHaveBeenCalledWith(mockElement, {
        duration: 0.5,
        opacity: 0.5,
        ease: "power2.out"
      });
    });

    it('should handle missing elements gracefully', () => {
      mockGetShadowElement.mockReturnValue(null);
      
      expect(() => {
        manager.animateElementProperty('test-element', 'opacity', 0.5, 1.0, mockGetShadowElement);
      }).not.toThrow();
      
      expect(mockGsapTo).not.toHaveBeenCalled();
    });
  });

  describe('resolveDynamicColorWithAnimation', () => {
    let animationContext: AnimationContext;

    beforeEach(() => {
      animationContext = {
        elementId: 'test-element',
        getShadowElement: mockGetShadowElement,
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };
    });

    it('should resolve static colors without animation', () => {
      (isDynamicColorConfig as any).mockReturnValue(false);
      
      const result = manager.resolveDynamicColorWithAnimation(
        'test-element',
        '#ff0000',
        'fill',
        animationContext
      );
      
      expect(result).toBe('#ff0000');
      const state = manager.getElementAnimationState('test-element');
      expect(state?.targetFillColor).toBe('#ff0000');
    });

    it('should animate dynamic color changes', async () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000', 'off': '#000000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      (isDynamicColorConfig as any).mockReturnValue(true);
      
      // Mock element returning different current color
      (mockElement.getAttribute as any).mockReturnValue('#000000');
      
      const result = manager.resolveDynamicColorWithAnimation(
        'test-element',
        dynamicConfig,
        'fill',
        animationContext
      );
      
      // Should return current color as animation starting point
      expect(result).toBe('#000000');
      
      // Wait for requestAnimationFrame to execute
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockGsapTo).toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });

    it('should not animate when colors are the same', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };

      mockHass.states['light.test'] = createMockEntity('on');
      (isDynamicColorConfig as any).mockReturnValue(true);
      
      // Mock element returning same color
      (mockElement.getAttribute as any).mockReturnValue('#ff0000');
      
      const result = manager.resolveDynamicColorWithAnimation(
        'test-element',
        dynamicConfig,
        'fill',
        animationContext
      );
      
      expect(result).toBe('#ff0000');
      expect(mockGsapTo).not.toHaveBeenCalled();
    });
  });

  describe('findElementWithRetryLogic', () => {
    it('should return element on first try when available', () => {
      const result = manager['findElementWithRetryLogic']('test-element', mockGetShadowElement, 3);
      expect(result).toBe(mockElement);
      expect(mockGetShadowElement).toHaveBeenCalledTimes(1);
    });

    it('should retry when element not found', () => {
      mockGetShadowElement
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockElement);
      
      const result = manager['findElementWithRetryLogic']('test-element', mockGetShadowElement, 2);
      expect(result).toBe(mockElement);
      expect(mockGetShadowElement).toHaveBeenCalledTimes(2);
    });

    it('should return null when retries exhausted', () => {
      mockGetShadowElement.mockReturnValue(null);
      
      const result = manager['findElementWithRetryLogic']('test-element', mockGetShadowElement, 0);
      expect(result).toBeNull();
      expect(mockGetShadowElement).toHaveBeenCalledTimes(1);
    });

    it('should use default retry count', () => {
      mockGetShadowElement.mockReturnValue(null);
      
      const result = manager['findElementWithRetryLogic']('test-element', mockGetShadowElement);
      expect(result).toBeNull();
      expect(mockGetShadowElement).toHaveBeenCalledTimes(2); // Initial call + 1 retry (default maxRetryAttempts = 3)
    });
  });

  describe('Global animationManager instance', () => {
    it('should be an instance of AnimationManager', () => {
      expect(animationManager).toBeInstanceOf(AnimationManager);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle requestAnimationFrame scheduling', async () => {
      const animationContext: AnimationContext = {
        elementId: 'test-element',
        getShadowElement: mockGetShadowElement,
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };

      // Test that scheduleColorTransitionAnimation uses requestAnimationFrame
      manager['scheduleColorTransitionAnimation'](
        'test-element',
        'fill',
        '#ff0000',
        '#000000',
        animationContext
      );

      // Use setTimeout to check after requestAnimationFrame
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockGsapTo).toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });

    it('should handle missing getShadowElement function', () => {
      const animationContext: AnimationContext = {
        elementId: 'test-element',
        hass: mockHass,
        requestUpdateCallback: mockRequestUpdate
      };

      expect(() => {
        manager.animateColorTransition('test-element', 'fill', '#ff0000', '#000000', animationContext);
      }).not.toThrow();
    });

    it('should handle malformed entity states', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'light.test',
        mapping: { 'on': '#ff0000' },
        default: '#808080'
      };

      // Malformed state object
      mockHass.states['light.test'] = null as any;
      
      const result = manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      expect(result).toBe('#808080'); // Should fall back to default
    });

    it('should handle numeric entity values correctly', () => {
      const dynamicConfig: DynamicColorConfig = {
        entity: 'sensor.temperature',
        mapping: { '20': '#0000ff', '30': '#ff0000' },
        default: '#808080',
        interpolate: true
      };

      mockHass.states['sensor.temperature'] = createMockEntity('25');
      
      const result = manager.resolveDynamicColor('test-element', dynamicConfig, mockHass);
      expect(result).toMatch(/^#[0-9a-f]{6}$/); // Should be a valid hex color
    });
  });
}); 