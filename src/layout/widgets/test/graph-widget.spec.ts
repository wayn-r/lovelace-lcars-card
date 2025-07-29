import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GraphWidget } from '../graph-widget.js';
import { WidgetRegistry } from '../registry.js';
import { GraphElement } from '../../elements/graph.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { stateManager } from '../../../utils/state-manager.js';
import { getSensorHistory } from '../../../utils/data-fetcher.js';
import { HomeAssistant } from 'custom-card-helpers';

// Mock the data-fetcher module
vi.mock('../../../utils/data-fetcher.js', () => ({
  getSensorHistory: vi.fn()
}));

const mockHass = {
  states: {
    'sensor.temperature': {
      state: '23.5',
      attributes: {
        friendly_name: 'Temperature Sensor',
        unit_of_measurement: '°C'
      }
    },
    'sensor.humidity': {
      state: '45',
      attributes: {
        friendly_name: 'Humidity Sensor',
        unit_of_measurement: '%'
      }
    },
    'sensor.pressure': {
      state: '1013',
      attributes: {
        friendly_name: 'Pressure Sensor',
        unit_of_measurement: 'hPa'
      }
    }
  }
} as any;

describe('GraphWidget', () => {
  let widget: GraphWidget;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let mockGetSensorHistory: any;

  beforeEach(() => {
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    mockGetSensorHistory = vi.mocked(getSensorHistory);
    mockGetSensorHistory.mockResolvedValue({});
    
    // Clear state manager
    stateManager.clearAll();
  });

  afterEach(() => {
    vi.clearAllMocks();
    stateManager.clearAll();
  });

  describe('Widget Creation and Expansion', () => {
    it('should create widget with single string entity', () => {
      widget = new GraphWidget(
        'test_graph',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements).toHaveLength(2); // Graph + 1 toggle button (single entities are toggleable by default)
      expect(elements[0]).toBeInstanceOf(GraphElement);
      expect(elements[0].id).toBe('test_graph');
    });

    it('should create widget with array of string entities', () => {
      widget = new GraphWidget(
        'test_multi_graph',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements).toHaveLength(3); // Graph + 2 toggle buttons
      expect(elements[0]).toBeInstanceOf(GraphElement);
      expect(elements[1]).toBeInstanceOf(RectangleElement);
      expect(elements[2]).toBeInstanceOf(RectangleElement);
    });

    it('should create widget with rich entity configuration', () => {
      widget = new GraphWidget(
        'test_rich_graph',
        { 
          entity: [
            { id: 'sensor.temperature', color: '#FF0000' },
            { id: 'sensor.humidity', color: '#00FF00', toggleable: false }
          ]
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements).toHaveLength(2); // Graph + 1 toggle button (humidity is not toggleable)
      expect(elements[0]).toBeInstanceOf(GraphElement);
      expect(elements[1]).toBeInstanceOf(RectangleElement);
    });

    it('should create elements with correct IDs', () => {
      widget = new GraphWidget(
        'id_test_graph',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements[0].id).toBe('id_test_graph');
      expect(elements[1].id).toBe('id_test_graph_button_0');
      expect(elements[2].id).toBe('id_test_graph_button_1');
    });
  });

  describe('Entity Configuration Parsing', () => {
    it('should parse single string entity correctly', () => {
      widget = new GraphWidget(
        'parse_test1',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      // Access private property for testing
      const entityConfigs = (widget as any).entityConfigs;
      expect(entityConfigs).toHaveLength(1);
      expect(entityConfigs[0]).toEqual({ id: 'sensor.temperature' });
    });

    it('should parse array of string entities correctly', () => {
      widget = new GraphWidget(
        'parse_test2',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const entityConfigs = (widget as any).entityConfigs;
      expect(entityConfigs).toHaveLength(2);
      expect(entityConfigs[0]).toEqual({ id: 'sensor.temperature' });
      expect(entityConfigs[1]).toEqual({ id: 'sensor.humidity' });
    });

    it('should parse rich entity configurations correctly', () => {
      const richConfig = [
        { id: 'sensor.temperature', color: '#FF0000', toggleable: true },
        { id: 'sensor.humidity', color: '#00FF00', toggleable: false }
      ];

      widget = new GraphWidget(
        'parse_test3',
        { entity: richConfig },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const entityConfigs = (widget as any).entityConfigs;
      expect(entityConfigs).toHaveLength(2);
      expect(entityConfigs[0]).toEqual(richConfig[0]);
      expect(entityConfigs[1]).toEqual(richConfig[1]);
    });

    it('should extract entity IDs correctly', () => {
      widget = new GraphWidget(
        'id_test',
        { entity: [
          { id: 'sensor.temperature', color: '#FF0000' },
          'sensor.humidity',
          { id: 'sensor.pressure' }
        ]},
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const entityIds = (widget as any).entityIds;
      expect(entityIds).toEqual(['sensor.temperature', 'sensor.humidity', 'sensor.pressure']);
    });
  });

  describe('State Management', () => {
    it('should initialize entity states for all entities', () => {
      widget = new GraphWidget(
        'state_test',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect(stateManager.getState('state_test_sensor.temperature_visible')).toBe('visible');
      expect(stateManager.getState('state_test_sensor.humidity_visible')).toBe('visible');
    });

    it('should not reinitialize existing states', () => {
      const stateName = 'existing_state_test_sensor.temperature_visible';
      stateManager.registerState(stateName, 'hidden');

      widget = new GraphWidget(
        'existing_state_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect(stateManager.getState(stateName)).toBe('hidden');
    });
  });

  describe('Toggle Button Creation', () => {
    it('should create toggle buttons for toggleable entities only', () => {
      widget = new GraphWidget(
        'toggle_test',
        { 
          entity: [
            { id: 'sensor.temperature', toggleable: true },
            { id: 'sensor.humidity', toggleable: false },
            { id: 'sensor.pressure' } // defaults to toggleable
          ]
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements).toHaveLength(3); // Graph + 2 toggle buttons (temperature & pressure)
      
      const buttons = elements.slice(1) as RectangleElement[];
      expect(buttons[0].id).toBe('toggle_test_button_0');
      expect(buttons[1].id).toBe('toggle_test_button_1');
    });

    it('should create buttons with correct text from entity IDs', () => {
      widget = new GraphWidget(
        'button_text_test',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      expect(buttons[0].props.text).toBe('temperature');
      expect(buttons[1].props.text).toBe('humidity');
    });

    it('should create buttons with correct colors', () => {
      widget = new GraphWidget(
        'button_color_test',
        { 
          entity: [
            { id: 'sensor.temperature', color: '#FF0000' },
            { id: 'sensor.humidity' } // should use default gradient color
          ]
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      expect(buttons[0].props.fill.default).toBe('#FF0000');
      expect(buttons[1].props.fill.default).toBe('var(--lcars-color-graph-line-2)');
    });

    it('should create buttons with toggle functionality', () => {
      widget = new GraphWidget(
        'toggle_func_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const button = elements[1] as RectangleElement;
      
      expect(button.props.button?.enabled).toBe(true);
      expect(button.props.button?.actions?.tap?.action).toBe('toggle_state');
      expect(button.props.button?.actions?.tap?.target_element_ref).toBe('toggle_func_test_sensor.temperature_visible');
      expect(button.props.button?.actions?.tap?.states).toEqual(['visible', 'hidden']);
    });
  });

  describe('Button Dimensions Calculation', () => {
    it('should create buttons with calculated dimensions', () => {
      widget = new GraphWidget(
        'dimensions_test',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        { height: 200 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      expect(buttons).toHaveLength(2);
      expect(buttons[0].layoutConfig.width).toBe(180);
      expect(buttons[0].layoutConfig.height).toBe(36); // Default button height
      expect(buttons[1].layoutConfig.width).toBe(180);
      expect(buttons[1].layoutConfig.height).toBe(36);
    });

    it('should adjust button dimensions for many entities', () => {
      const manyEntities = Array.from({ length: 8 }, (_, i) => `sensor.test_${i}`);
      
      widget = new GraphWidget(
        'many_buttons_test',
        { entity: manyEntities },
        { height: 200 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      expect(buttons).toHaveLength(8);
      
      // Buttons should have reduced height to fit within graph bounds
      const buttonHeight = buttons[0].layoutConfig.height!;
      expect(buttonHeight).toBeLessThan(36);
      expect(buttonHeight).toBeGreaterThanOrEqual(20); // Should respect minimum height
      
      // All buttons should have same dimensions
      buttons.forEach(button => {
        expect(button.layoutConfig.height).toBe(buttonHeight);
        expect(button.layoutConfig.width).toBe(180);
      });
    });

    it('should position buttons within graph bounds', () => {
      const manyEntities = Array.from({ length: 6 }, (_, i) => `sensor.test_${i}`);
      
      widget = new GraphWidget(
        'bounds_test',
        { entity: manyEntities },
        { height: 300 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      // Check that all buttons fit within the graph height
      const graphHeight = 300;
      buttons.forEach(button => {
        const buttonY = button.layoutConfig.offsetY!;
        const buttonHeight = button.layoutConfig.height!;
        expect(buttonY + buttonHeight).toBeLessThanOrEqual(graphHeight);
        expect(buttonY).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Layout Configuration', () => {
    it('should configure button anchoring to graph element', () => {
      widget = new GraphWidget(
        'anchor_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const button = elements[1] as RectangleElement;
      
      expect(button.layoutConfig.anchor).toEqual({
        anchorTo: 'anchor_test',
        anchorPoint: 'topLeft',
        targetAnchorPoint: 'topRight'
      });
      expect(button.layoutConfig.offsetX).toBe(20);
    });

    it('should position multiple buttons with correct Y offsets', () => {
      widget = new GraphWidget(
        'multi_anchor_test',
        { entity: ['sensor.temperature', 'sensor.humidity', 'sensor.pressure'] },
        { height: 200 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const buttons = elements.slice(1) as RectangleElement[];
      
      // First button should have the startYOffset
      const firstOffset = buttons[0].layoutConfig.offsetY!;
      expect(firstOffset).toBeGreaterThanOrEqual(0);
      
      // Subsequent buttons should have incremental Y offsets
      const secondOffset = buttons[1].layoutConfig.offsetY!;
      const thirdOffset = buttons[2].layoutConfig.offsetY!;
      
      expect(secondOffset).toBeGreaterThan(firstOffset);
      expect(thirdOffset).toBeGreaterThan(secondOffset);
    });

    it('should use configured graph height for button calculations', () => {
      widget = new GraphWidget(
        'height_test',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        { height: 150 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const graphHeight = (widget as any).determineGraphHeight();
      expect(graphHeight).toBe(150);
    });

    it('should use default height when not configured', () => {
      widget = new GraphWidget(
        'default_height_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const graphHeight = (widget as any).determineGraphHeight();
      expect(graphHeight).toBe(200);
    });
  });

  describe('History Data Handling', () => {
    it('should fetch history data when hass is provided', async () => {
      mockGetSensorHistory.mockResolvedValue({ 'sensor.temperature': [] });

      widget = new GraphWidget(
        'history_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockGetSensorHistory).toHaveBeenCalledWith(mockHass, ['sensor.temperature']);
    });

    it('should handle history fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetSensorHistory.mockRejectedValue(new Error('Fetch failed'));

      widget = new GraphWidget(
        'error_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should detect history changes correctly', () => {
      widget = new GraphWidget(
        'change_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      // Test with no previous history
      expect((widget as any).historyHasChanged({ 'sensor.temperature': [] })).toBe(true);

      // Set initial history
      (widget as any).lastHistory = { 'sensor.temperature': [] };

      // Test with same history
      expect((widget as any).historyHasChanged({ 'sensor.temperature': [] })).toBe(false);

      // Test with different history
      expect((widget as any).historyHasChanged({ 'sensor.temperature': [{ state: '25' }] })).toBe(true);
    });

    it('should update graph element with history data', async () => {
      const historyData = { 'sensor.temperature': [{ state: '25' }] };
      mockGetSensorHistory.mockResolvedValue(historyData);

      widget = new GraphWidget(
        'update_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const graphElement = (widget as any).graphElement;
      const setHistorySpy = vi.spyOn(graphElement, 'setHistory');

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(setHistorySpy).toHaveBeenCalledWith(historyData);
    });
  });

  describe('Hass Updates', () => {
    it('should handle hass updates when valid', () => {
      widget = new GraphWidget(
        'hass_update_test',
        { entity: 'sensor.temperature' },
        {},
        undefined,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const fetchSpy = vi.spyOn(widget as any, 'fetchAndUpdateHistory');
      
      widget.updateHass(mockHass);

      expect(fetchSpy).toHaveBeenCalled();
      expect(mockGetSensorHistory).toHaveBeenCalledWith(mockHass, (widget as any).entityIds);
    });

    it('should ignore hass updates when invalid configuration', () => {
      widget = new GraphWidget(
        'invalid_hass_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const fetchSpy = vi.spyOn(widget as any, 'fetchAndUpdateHistory');
      
      // Update with undefined hass
      widget.updateHass(undefined);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should validate entity configuration correctly', () => {
      widget = new GraphWidget(
        'validation_test',
        { entity: 'sensor.temperature' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect((widget as any).hasValidEntityConfiguration(mockHass)).toBe(true);
      expect((widget as any).hasValidEntityConfiguration(undefined)).toBe(false);
    });
  });

  describe('Integration with Graph Element', () => {
    it('should set entity configs on graph element', () => {
      // Create a spy on the GraphElement prototype before widget construction
      const setEntityConfigsSpy = vi.spyOn(GraphElement.prototype, 'setEntityConfigs');
      
      widget = new GraphWidget(
        'graph_element_test',
        { entity: ['sensor.temperature', 'sensor.humidity'] },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect(setEntityConfigsSpy).toHaveBeenCalledWith([
        { id: 'sensor.temperature' },
        { id: 'sensor.humidity' }
      ]);
      
      setEntityConfigsSpy.mockRestore();
    });

    it('should pass constructor parameters to graph element', () => {
      const props = { entity: 'sensor.temperature', fill: '#FF0000' };
      const layoutConfig = { width: 400 };

      widget = new GraphWidget(
        'param_test',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const graphElement = (widget as any).graphElement;
      
      expect(graphElement.id).toBe('param_test');
      expect(graphElement.props).toBe(props);
      expect(graphElement.layoutConfig).toBe(layoutConfig);
      expect(graphElement.hass).toBe(mockHass);
      expect(graphElement.requestUpdateCallback).toBe(mockRequestUpdate);
      expect(graphElement.getShadowElement).toBe(mockGetShadowElement);
    });
  });
});

describe('GraphWidget Registry Integration', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    vi.mocked(getSensorHistory).mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
    stateManager.clearAll();
  });

  it('should be registered in widget registry', () => {
    const elements = WidgetRegistry.expandWidget(
      'graph-widget',
      'registry_test',
      { entity: 'sensor.temperature' },
      {},
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement
    );

    expect(elements).not.toBeNull();
    expect(elements).toHaveLength(2); // Graph + 1 button
    expect(elements![0]).toBeInstanceOf(GraphElement);
    expect(elements![1]).toBeInstanceOf(RectangleElement);
  });

  it('should handle registry calls with different configurations', () => {
    const multiEntityElements = WidgetRegistry.expandWidget(
      'graph-widget',
      'multi_registry_test',
      { entity: ['sensor.temperature', 'sensor.humidity', 'sensor.pressure'] },
      { height: 300 },
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement
    );

    expect(multiEntityElements).not.toBeNull();
    expect(multiEntityElements).toHaveLength(4); // Graph + 3 buttons
  });

  it('should return null for unknown widget types', () => {
    const elements = WidgetRegistry.expandWidget(
      'unknown-graph-widget',
      'unknown_test',
      { entity: 'sensor.temperature' },
      {},
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement
    );

    expect(elements).toBeNull();
  });
}); 