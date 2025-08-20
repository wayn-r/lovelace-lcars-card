import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorResolver, colorResolver } from '../color-resolver';

// Temporary helper to adapt existing tests to fluent API after legacy wrapper removal
const resolveColor = (value: any, options: any = {}): string => {
  let chain: any = ColorResolver.resolve(value);
  if (options.context !== undefined) {
    chain = chain.withDom(options.context ?? null);
  }
  if (options.elementId) {
    chain = chain.withAnimation(options.elementId, options.animationProperty || 'fill', options.animationContext);
  }
  if (options.stateContext) {
    chain = chain.withState(options.stateContext);
  }
  if (options.hass) {
    chain = chain.withHass(options.hass);
  }
  if (options.fallback) {
    chain = chain.withFallback(options.fallback);
  }
  return `${chain}`;
};
import { AnimationContext } from '../animation';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../../layout/engine.js';
import { EMBEDDED_THEME_YAML } from '../embedded-theme';

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

  describe('resolveColor static method', () => {
    it('should resolve single color values', () => {
      const result = resolveColor('#ff0000', { 
        elementId: 'test-element', 
        animationProperty: 'fill', 
        animationContext: mockContext, 
        stateContext: {}, 
        fallback: 'blue' 
      });
      expect(result).toBe('#ff0000');
    });

    it('should use transparent as default fallback', () => {
      const result = resolveColor('#ff0000');
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

      const result = resolveColor(statefulColor, { 
        elementId: 'test-element', 
        animationProperty: 'fill', 
        animationContext: mockContext, 
        stateContext: stateContext, 
        fallback: 'blue' 
      });
      expect(result).toBe('#ff0000');
    });
  });



  // ============================================================================
  // Dynamic Color Management Tests
  // ============================================================================



  describe('event-driven color change processing', () => {
    it('should call refresh callback when impacted elements detect changes', () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.entityChangesDetected.mockReturnValue(true);

      // Build dependencies and simulate hass change
      resolver.buildEntityDependencyIndex(mockLayoutGroups);

      const lastStates = { 'sensor.test': { state: 'off', attributes: {} } } as any;

      resolver.processHassChange(
        mockLayoutGroups,
        lastStates,
        mockHass,
        refreshCallback
      );

      expect(refreshCallback).toHaveBeenCalled();
    });

    it('should not call refresh callback when no impacted elements report changes', () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.entityChangesDetected.mockReturnValue(false);

      resolver.buildEntityDependencyIndex(mockLayoutGroups);
      const lastStates = { 'sensor.test': { state: 'on', attributes: {} } } as any;

      resolver.processHassChange(
        mockLayoutGroups,
        lastStates,
        mockHass,
        refreshCallback
      );

      expect(refreshCallback).not.toHaveBeenCalled();
    });
  });

  describe('extractEntityIds', () => {
    it('should extract entity IDs from dynamic color properties', () => {
      const element = {
        props: {
          fill: { entity: 'sensor.test1', mapping: {} },
          stroke: { entity: 'sensor.test2', mapping: {} },
          textColor: { entity: 'sensor.test3', mapping: {} }
        }
      };

      const entityIds = resolver.extractEntityIds(element);

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

      const entityIds = resolver.extractEntityIds(element);

      expect(entityIds).toEqual(new Set(['sensor.hover', 'sensor.active']));
    });

    it('should return empty set for element without props', () => {
      const element = {};

      const entityIds = resolver.extractEntityIds(element);

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

      const result = resolver.elementEntityStatesChanged(mockGroupsWithText, lastHassStates, mockHass);

      expect(result).toBe(true);
    });

    it('should not detect changes when entities are unchanged', () => {
      const lastHassStates = {
        'sensor.test': { state: 'on' }
      };

      const result = resolver.elementEntityStatesChanged(mockLayoutGroups, lastHassStates, mockHass);

      expect(result).toBe(false);
    });

    it('should return false when no last states are provided', () => {
      const result = resolver.elementEntityStatesChanged(mockLayoutGroups, undefined, mockHass);

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clear dependency indexes without throwing', () => {
      resolver.buildEntityDependencyIndex(mockLayoutGroups);
      expect(() => resolver.cleanup()).not.toThrow();
      // After cleanup, processing should rebuild index implicitly and not throw
      const cb = vi.fn();
      resolver.processHassChange(mockLayoutGroups, { 'sensor.test': { state: 'off', attributes: {} } } as any, mockHass, cb);
    });
  });

  // ============================================================================
  // Theme Fallback Tests (consolidated from theme-fallback.spec.ts)
  // ============================================================================

  describe('Theme Fallback', () => {
    beforeEach(() => {
      // Reset the static state before each test
      (ColorResolver as any)._resolvedThemeColors = null;
      (ColorResolver as any)._themeLoadPromise = null;
    });

    describe('parseYamlTheme', () => {
      it('should parse and store theme colors from YAML', () => {
        const yamlContent = `lcars_theme:
  lcars-color-blue: "#5ca8ea"
  lcars-color-cyan: "#04bfd8"
  lcars-color-derived: var(--lcars-color-blue)`;

        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        expect(colors['lcars-color-blue']).toBe('#5ca8ea');
        expect(colors['lcars-color-cyan']).toBe('#04bfd8');
        expect(colors['lcars-color-derived']).toBe('#5ca8ea'); // Should resolve CSS variable
      });

      it('should handle invalid YAML gracefully', () => {
        const invalidYaml = 'invalid: yaml: content: [';
        
        const colors = (ColorResolver as any)._parseThemeYaml(invalidYaml);
        expect(colors).toEqual({});
      });

      it('should handle missing lcars_theme section', () => {
        const yamlContent = `other_theme:
  some-color: "#ffffff"`;

        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        expect(colors).toEqual({});
      });
    });

    describe('getFallbackColorFromTheme', () => {
      beforeEach(() => {
        const yamlContent = `lcars_theme:
  lcars-color-blue: "#5ca8ea"
  lcars-color-cyan: "#04bfd8"
  lcars-color-derived: var(--lcars-color-blue)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        (ColorResolver as any)._resolvedThemeColors = colors;
      });

      it('should return fallback color for existing variable', () => {
        const color = (ColorResolver as any)._getFallbackColorFromTheme('lcars-color-blue');
        expect(color).toBe('#5ca8ea');
      });

      it('should return resolved color for CSS variable reference', () => {
        const color = (ColorResolver as any)._getFallbackColorFromTheme('lcars-color-derived');
        expect(color).toBe('#5ca8ea');
      });

      it('should return undefined for non-existent variable', () => {
        const color = (ColorResolver as any)._getFallbackColorFromTheme('non-existent-color');
        expect(color).toBeUndefined();
      });
    });

    describe('CSS variable resolution', () => {
      it('should resolve nested CSS variables', () => {
        const yamlContent = `lcars_theme:
  lcars-color-base: "#5ca8ea"
  lcars-color-level1: var(--lcars-color-base)
  lcars-color-level2: var(--lcars-color-level1)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        expect(colors['lcars-color-base']).toBe('#5ca8ea');
        expect(colors['lcars-color-level1']).toBe('#5ca8ea');
        expect(colors['lcars-color-level2']).toBe('#5ca8ea');
      });

      it('should handle circular references gracefully', () => {
        const yamlContent = `lcars_theme:
  lcars-color-a: var(--lcars-color-b)
  lcars-color-b: var(--lcars-color-a)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        // Should not crash and should return some fallback values
        expect(typeof colors).toBe('object');
      });

      it('should handle missing variable references', () => {
        const yamlContent = `lcars_theme:
  lcars-color-valid: "#5ca8ea"
  lcars-color-invalid: var(--non-existent-color)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        expect(colors['lcars-color-valid']).toBe('#5ca8ea');
        expect(colors['lcars-color-invalid']).toBe('var(--non-existent-color)'); // Should keep original
      });
    });

    describe('LCARS theme specific colors', () => {
      beforeEach(() => {
        const yamlContent = `lcars_theme:
  lcars-color-blue: "#5ca8ea"
  lcars-color-cyan: "#04bfd8"
  lcars-color-logger-bright: var(--lcars-color-blue)
  lcars-color-environmental-button-1: var(--lcars-color-cyan)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        (ColorResolver as any)._resolvedThemeColors = colors;
      });

      it('should resolve logger widget colors', () => {
        const color = (ColorResolver as any)._getFallbackColorFromTheme('lcars-color-logger-bright');
        expect(color).toBe('#5ca8ea');
      });

      it('should resolve environmental config colors', () => {
        const color = (ColorResolver as any)._getFallbackColorFromTheme('lcars-color-environmental-button-1');
        expect(color).toBe('#04bfd8');
      });
    });
  });

  // ============================================================================
  // CSS Variable Resolution Tests (consolidated from color-resolver-fallback.spec.ts)
  // ============================================================================

  describe('CSS Variable Resolution with Fallback', () => {
    let mockElement: Element;

    beforeEach(() => {
      // Reset the static state before each test
      (ColorResolver as any)._resolvedThemeColors = null;
      (ColorResolver as any)._themeLoadPromise = null;

      // Create a mock element
      mockElement = {
        style: {},
        tagName: 'DIV'
      } as any;

      // Mock getComputedStyle
      global.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''), // Return empty string to simulate missing CSS variable
      });

      // Set up theme fallback
      const yamlContent = `lcars_theme:
  lcars-color-blue: "#5ca8ea"
  lcars-color-cyan: "#04bfd8"
  lcars-color-aqua: "#3ad9e7"
  lcars-color-logger-bright: var(--lcars-color-blue)
  lcars-color-environmental-button-1: var(--lcars-color-cyan)`;
      
      const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
      (ColorResolver as any)._resolvedThemeColors = colors;
    });

    describe('resolveColor with CSS variables', () => {
      it('should return fallback color when CSS variable is not found', () => {
        const result = resolveColor('var(--lcars-color-blue)');
        expect(result).toBe('#5ca8ea');
      });

      it('should return fallback for resolved CSS variable references', () => {
        const result = resolveColor('var(--lcars-color-logger-bright)');
        expect(result).toBe('#5ca8ea');
      });

      it('should return original color when CSS variable is found', () => {
        // Mock getComputedStyle to return a value for this test
        global.getComputedStyle = vi.fn().mockReturnValue({
          getPropertyValue: vi.fn().mockReturnValue('#ff0000'), // Return red to simulate found CSS variable
        });

        const result = resolveColor('var(--lcars-color-blue)', { context: mockElement });
        expect(result).toBe('#ff0000');
      });

      it('should return original color when not a CSS variable', () => {
        const result = resolveColor('#123456', { context: mockElement });
        expect(result).toBe('#123456');
      });

      it('should return original color when fallback not found', () => {
        const result = resolveColor('var(--non-existent-color)', { context: mockElement });
        expect(result).toBe('var(--non-existent-color)');
      });

      it('should handle malformed CSS variable syntax', () => {
        const result = resolveColor('var(invalid)', { context: mockElement });
        expect(result).toBe('var(invalid)');
      });
    });

    describe('environmental color fallbacks', () => {
      it('should resolve environmental button colors', () => {
        const result = resolveColor('var(--lcars-color-environmental-button-1)');
        expect(result).toBe('#04bfd8');
      });

      it('should handle complex environmental color names', () => {
        // Add a more complex environmental color
        const yamlContent = `lcars_theme:
  lcars-color-dark-blue: "#044ea9"
  lcars-color-environmental-main-header-lower-bar-1: var(--lcars-color-dark-blue)`;
        
        const colors = (ColorResolver as any)._parseThemeYaml(yamlContent);
        (ColorResolver as any)._resolvedThemeColors = colors;

        const result = resolveColor('var(--lcars-color-environmental-main-header-lower-bar-1)');
        expect(result).toBe('#044ea9');
      });
    });

    describe('edge cases', () => {
      it('should handle empty variable name', () => {
        const result = resolveColor('var(--)', { context: mockElement });
        expect(result).toBe('var(--)');
      });

      it('should handle variable with spaces', () => {
        const result = resolveColor('var(--lcars-color-blue )');
        // Should still extract the variable name correctly
        expect(result).toBe('#5ca8ea');
      });

      it('should handle multiple var() calls', () => {
        // Should only process the first one
        const result = resolveColor('var(--lcars-color-blue) var(--lcars-color-cyan)');
        expect(result).toBe('#5ca8ea');
      });
    });
  });

  // ============================================================================
  // Graph Component Colors Tests (from comprehensive-fallback.spec.ts)
  // ============================================================================

  describe('Graph Component Colors with Embedded Theme', () => {
    beforeEach(() => {
      // Reset the static state before each test
      (ColorResolver as any)._resolvedThemeColors = null;
      (ColorResolver as any)._themeLoadPromise = null;

      // Mock getComputedStyle to return empty (simulate missing CSS variables)
      global.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(''), // Return empty string to simulate missing CSS variable
      });

      // Use the actual embedded theme data from the build process
      const colors = (ColorResolver as any)._parseThemeYaml(EMBEDDED_THEME_YAML);
      (ColorResolver as any)._resolvedThemeColors = colors;
    });

    it('should resolve animated gradient colors using fallback', () => {
      const color = resolveColor('var(--lcars-color-graph-line-1)');
      expect(color).toBe('#044ea9');
    });

    it('should resolve non-animated line colors using fallback', () => {
      const color = resolveColor('var(--lcars-color-graph-line-2)');
      expect(color).toBe('#04bfd8');
    });

    it('should resolve graph background colors using fallback', () => {
      const color = resolveColor('var(--lcars-color-graph-background)');
      expect(color).toBe('#0B6288');
    });

    it('should resolve graph button colors using fallback', () => {
      const color = resolveColor('var(--lcars-color-graph-line-3)');
      expect(color).toBe('#86c8ff');
    });

    it('should resolve environmental button colors using fallback', () => {
      const color = resolveColor('var(--lcars-color-environmental-button-1)');
      expect(color).toBe('#3ad8e6');
    });

    it('should resolve environmental button with new grey-blue color', () => {
      const color = resolveColor('var(--lcars-color-environmental-button-3)');
      expect(color).toBe('#7a9ca5');
    });

    describe('Error Handling', () => {
      it('should handle null/undefined elements gracefully', () => {
        const color = resolveColor('var(--lcars-color-blue)', { context: null });
        expect(color).toBe('#5ca8ea');
      });

      it('should handle invalid elements gracefully', () => {
        const invalidElement = {} as Element;
        const color = resolveColor('var(--lcars-color-blue)', { context: invalidElement });
        expect(color).toBe('#5ca8ea');
      });

      it('should return original color for non-existent variables', () => {
        const color = resolveColor('var(--non-existent-color)');
        expect(color).toBe('var(--non-existent-color)');
      });

      it('should return original color for non-CSS-variable strings', () => {
        const color = resolveColor('#ff0000');
        expect(color).toBe('#ff0000');
      });
    });

    describe('Fallback Priority', () => {
      it('should prioritize DOM resolution over theme fallback when available', () => {
        // Mock getComputedStyle to return a value for this test
        global.getComputedStyle = vi.fn().mockReturnValue({
          getPropertyValue: vi.fn().mockReturnValue('#ff0000'), // Return red to simulate found CSS variable
        });

        const mockElement = document.createElement('div');
        const color = resolveColor('var(--lcars-color-blue)', { context: mockElement });
        expect(color).toBe('#ff0000'); // Should use DOM value, not fallback
      });

      it('should use theme fallback when DOM resolution fails', () => {
        // getComputedStyle is already mocked to return empty string
        const color = resolveColor('var(--lcars-color-blue)');
        expect(color).toBe('#5ca8ea'); // Should use theme fallback
      });
    });
  });
}); 