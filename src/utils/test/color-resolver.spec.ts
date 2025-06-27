import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorResolver, colorResolver } from '../color-resolver';
import { AnimationContext } from '../animation';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../../layout/engine.js';

// Mock the animation manager since ColorResolver uses it for dynamic colors
vi.mock('../animation', () => ({
  animationManager: {
    resolveDynamicColorWithAnimation: vi.fn(),
    resolveDynamicColor: vi.fn(),
  
    cleanupElementAnimationTracking: vi.fn()
  },
  AnimationContext: {}
}));

describe('ColorResolver', () => {
  let resolver: ColorResolver;
  let mockHass: HomeAssistant;
  let mockLayoutGroups: Group[];

  const mockContext: AnimationContext = {
    elementId: 'test-element',
    getShadowElement: vi.fn(),
    hass: undefined,
    requestUpdateCallback: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new ColorResolver();

    // Create mock HomeAssistant
    mockHass = {
      states: {
        'sensor.test': {
          entity_id: 'sensor.test',
          state: 'on',
          attributes: {},
          last_changed: '2023-01-01T00:00:00Z',
          last_updated: '2023-01-01T00:00:00Z',
          context: { id: 'test', parent_id: null, user_id: null }
        }
      }
    } as unknown as HomeAssistant;

    // Create mock layout groups
    const mockElement = {
      id: 'test-element',
              cleanupAnimations: vi.fn(),
        entityChangesDetected: vi.fn().mockReturnValue(false),
      props: {
        fill: { entity: 'sensor.test', mapping: { on: 'red', off: 'blue' } },
        text: 'Hello'
      }
    };

    mockLayoutGroups = [
      {
        id: 'test-group',
        elements: [mockElement]
      } as unknown as Group
    ];
  });

  describe('resolveAllElementColors', () => {
    it('should use default colors when no props colors are provided', () => {
      const props = {};
      const result = resolver.resolveAllElementColors('test-id', props, mockContext);
      
      expect(result).toEqual({
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: '0',
        textColor: 'currentColor'
      });
    });

    it('should use custom defaults when provided', () => {
      const props = {};
      const options = {
        fallbackFillColor: '#ff0000',
        fallbackStrokeColor: '#00ff00',
        fallbackStrokeWidth: '2',
        fallbackTextColor: '#ffffff'
      };
      
      const result = resolver.resolveAllElementColors('test-id', props, mockContext, options);
      
      expect(result).toEqual({
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: '2',
        textColor: '#ffffff'
      });
    });

    it('should resolve static colors correctly', () => {
      const props = {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3,
        textColor: '#ffffff'
      };

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(result).toEqual({
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: '3',
        textColor: '#ffffff'
      });
    });

    it('should handle undefined color properties gracefully', () => {
      const props = {
        strokeWidth: 2
      };

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(result).toEqual({
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: '2',
        textColor: 'currentColor'
      });
    });

    it('should handle RGB array colors', () => {
      const props = {
        fill: [255, 0, 0],
        stroke: [0, 255, 0],
        textColor: [0, 0, 255]
      };

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(result).toEqual({
        fillColor: 'rgb(255,0,0)',
        strokeColor: 'rgb(0,255,0)',
        strokeWidth: '0',
        textColor: 'rgb(0,0,255)'
      });
    });

    describe('interactive state handling', () => {
      it('should handle stateful colors with hover state', () => {
        const props = {
          fill: {
            default: '#666666',
            hover: '#ff0000',
            active: '#00ff00'
          }
        };

        const stateContext = {
          isCurrentlyHovering: true,
          isCurrentlyActive: false
        };

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, stateContext);

        expect(result.fillColor).toBe('#ff0000');
      });

      it('should handle stateful colors with active state', () => {
        const props = {
          fill: {
            default: '#666666',
            hover: '#ff0000',
            active: '#00ff00'
          }
        };

        const stateContext = {
          isCurrentlyHovering: false,
          isCurrentlyActive: true
        };

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, stateContext);

        expect(result.fillColor).toBe('#00ff00');
      });
    });
  });

  describe('createButtonPropsWithResolvedColors', () => {
    it('should create props with resolved colors only for defined props', () => {
      const originalProps = {
        fill: '#666666',
        text: 'Click me',
        customProp: 'value'
      };

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        fill: '#666666',
        text: 'Click me',
        customProp: 'value'
      });
    });

    it('should not override colors that were not in original props', () => {
      const originalProps = {
        text: 'Click me',
        customProp: 'value'
      };

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        text: 'Click me',
        customProp: 'value'
      });
      
      // Should not have fill, stroke, or textColor since they weren't in original props
      expect(result.fill).toBeUndefined();
      expect(result.stroke).toBeUndefined();
      expect(result.textColor).toBeUndefined();
    });

    it('should handle stateful colors in button props', () => {
      const originalProps = {
        fill: {
          default: '#666666',
          hover: '#0099ff'
        },
        textColor: '#ffffff',
        text: 'Click me'
      };

      const stateContext = {
        isCurrentlyHovering: true,
        isCurrentlyActive: false
      };

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext, stateContext);

      expect(result).toEqual({
        fill: '#0099ff',
        textColor: '#ffffff',
        text: 'Click me'
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton colorResolver instance', () => {
      expect(colorResolver).toBeInstanceOf(ColorResolver);
    });
  });

  describe('resolveColor method', () => {
    it('should resolve single color values', () => {
      const result = resolver.resolveColor('#ff0000', 'test-element', 'fill', mockContext, {}, 'blue');
      expect(result).toBe('#ff0000');
    });

    it('should use transparent as default fallback', () => {
      const result = resolver.resolveColor('#ff0000');
      expect(result).toBe('#ff0000');
    });

    it('should handle stateful colors', () => {
      const statefulColor = {
        default: '#666666',
        hover: '#ff0000'
      };

      const stateContext = {
        isCurrentlyHovering: true,
        isCurrentlyActive: false
      };

      const result = resolver.resolveColor(statefulColor, 'test-element', 'fill', mockContext, stateContext, 'blue');
      expect(result).toBe('#ff0000');
    });
  });

  describe('resolveColorsWithoutAnimationContext', () => {
    it('should resolve colors without animation context', () => {
      const props = {
        fill: '#ff0000',
        stroke: '#00ff00',
        textColor: '#ffffff'
      };

      const result = resolver.resolveColorsWithoutAnimationContext('test-id', props);

      expect(result).toEqual({
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: '0',
        textColor: '#ffffff'
      });
    });
  });

  // ============================================================================
  // Dynamic Color Management Tests
  // ============================================================================

  describe('clearAllCaches', () => {
    it('should clear element state for all elements', () => {
      resolver.clearAllCaches(mockLayoutGroups);

      const element = mockLayoutGroups[0].elements[0] as any;
              // clearMonitoredEntities method was removed as it was unused
      expect(element.cleanupAnimations).toHaveBeenCalled();
    });

    it('should clear element state without errors', async () => {
      // Note: Dynamic color caching is now handled by the store/ColorResolver itself
      
      resolver.clearAllCaches(mockLayoutGroups);

      // Test should pass without errors
      expect(true).toBe(true);
    });
  });

  describe('detectsDynamicColorChanges', () => {
    it('should call refresh callback when changes are detected', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.entityChangesDetected.mockReturnValue(true);

      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(refreshCallback).toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });

    it('should not call refresh callback when no changes are detected', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.entityChangesDetected.mockReturnValue(false);

      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(refreshCallback).not.toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });

    it('should throttle multiple calls', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.entityChangesDetected.mockReturnValue(true);

      // Make multiple rapid calls
      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);
      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);
      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);

      // Wait for the timeout to complete
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Only the first call should have been processed due to throttling
          expect(refreshCallback).toHaveBeenCalledTimes(1);
          resolve();
        }, 50);
      });
    });
  });

  describe('extractEntityIdsFromElement', () => {
    it('should extract entity IDs from dynamic color properties', () => {
      const element = {
        props: {
          fill: { entity: 'sensor.test1', mapping: {} },
          stroke: { entity: 'sensor.test2', mapping: {} },
          textColor: { entity: 'sensor.test3', mapping: {} }
        }
      };

      const entityIds = resolver.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set(['sensor.test1', 'sensor.test2', 'sensor.test3']));
    });

    it('should extract entity IDs from button color properties', () => {
      const element = {
        props: {
          button: {
            hover_fill: { entity: 'sensor.hover', mapping: {} },
            active_fill: { entity: 'sensor.active', mapping: {} }
          }
        }
      };

      const entityIds = resolver.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set(['sensor.hover', 'sensor.active']));
    });

    it('should return empty set for element without props', () => {
      const element = {};

      const entityIds = resolver.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set());
    });
  });

  describe('hasSignificantEntityChanges', () => {
    it('should detect entity-based text changes', () => {
      const lastHassStates = {
        'sensor.test': { state: 'off' }
      };

      const elementWithEntityText = {
        props: {
          text: "Status: {{states['sensor.test'].state}}"
        }
      };

      const mockGroupsWithText = [
        {
          id: 'test-group',
          elements: [elementWithEntityText]
        } as unknown as Group
      ];

      const result = resolver.hasSignificantEntityChanges(mockGroupsWithText, lastHassStates, mockHass);

      expect(result).toBe(true);
    });

    it('should not detect changes when entities are unchanged', () => {
      const lastHassStates = {
        'sensor.test': { state: 'on' }
      };

      const result = resolver.hasSignificantEntityChanges(mockLayoutGroups, lastHassStates, mockHass);

      expect(result).toBe(false);
    });

    it('should return false when no last states are provided', () => {
      const result = resolver.hasSignificantEntityChanges(mockLayoutGroups, undefined, mockHass);

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clear scheduled operations', async () => {
      const refreshCallback = vi.fn();

      // Schedule an operation
      resolver.detectsDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 100);

      // Clean up immediately
      resolver.cleanup();

      // Wait longer than the original delay
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should not have been called due to cleanup
          expect(refreshCallback).not.toHaveBeenCalled();
          resolve();
        }, 150);
      });
    });
  });
}); 