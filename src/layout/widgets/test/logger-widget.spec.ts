import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LoggerWidget } from '../logger-widget.js';
import { WidgetRegistry } from '../registry.js';
import { TextElement } from '../../elements/text.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { FontManager } from '../../../utils/font-manager.js';
import { animationManager } from '../../../utils/animation.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LogMessage } from '../../../types.js';
import gsap from 'gsap';

// Mock a simple LoggerService class to be used as fallback/runtime logger
class MockLoggerService {
  registerWidget = vi.fn(() => vi.fn());
  updateHass = vi.fn();
  getMessages = vi.fn(() => []);
  addMessages = vi.fn();
  addMessagesInOrder = vi.fn();
  clearMessages = vi.fn();
}

// Mock FontManager
vi.mock('../../../utils/font-manager.js', () => ({
  FontManager: {
    measureTextWidth: vi.fn(() => 100)
  }
}));

// Mock animation utilities
vi.mock('../../../utils/animation.js', () => ({
  animationManager: {
    register: vi.fn(),
    unregister: vi.fn(),
    initializeElementAnimationTracking: vi.fn()
  },
  DistanceParser: {
    parse: vi.fn((value) => parseFloat(value) || 20)
  }
}));

// Mock GSAP
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    killTweensOf: vi.fn(),
    fromTo: vi.fn((element, from, to) => {
      // Simulate immediate completion
      if (to.onComplete) {
        setTimeout(to.onComplete, 0);
      }
    }),
    to: vi.fn((element, props) => {
      // Simulate immediate completion
      if (props.onComplete) {
        setTimeout(props.onComplete, 0);
      }
    }),
    set: vi.fn(),
    getProperty: vi.fn(() => 0)
  }
}));

vi.mock('gsap/CustomEase', () => ({
  CustomEase: {
    create: vi.fn(() => 'custom-ease')
  }
}));

const mockHass = {
  states: {
    'sensor.temperature': {
      entity_id: 'sensor.temperature',
      state: '23.5',
      last_changed: '2023-01-01T10:00:00Z',
      attributes: {
        friendly_name: 'Temperature Sensor',
        unit_of_measurement: '°C'
      }
    },
    'sensor.humidity': {
      entity_id: 'sensor.humidity',
      state: '45',
      last_changed: '2023-01-01T10:01:00Z',
      attributes: {
        friendly_name: 'Humidity Sensor',
        unit_of_measurement: '%'
      }
    }
  },
  connection: {
    subscribeEvents: vi.fn()
  }
} as any;

const mockLogMessages: LogMessage[] = [
  {
    id: 'msg1',
    text: 'Temperature Sensor: 23.5°C',
    timestamp: Date.now() - 10000
  },
  {
    id: 'msg2',
    text: 'Humidity Sensor: 45%',
    timestamp: Date.now() - 5000
  },
  {
    id: 'msg3',
    text: 'System initialized',
    timestamp: Date.now()
  }
];

function createRuntime() {
  return {
    logger: new MockLoggerService(),
  } as any;
}

describe('LoggerWidget', () => {
  let widget: LoggerWidget;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let mockFontManager: any;
  let runtime: any;

  beforeEach(() => {
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    mockFontManager = vi.mocked(FontManager);
    runtime = createRuntime();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up default mock returns
    runtime.logger.getMessages.mockReturnValue([]);
    runtime.logger.registerWidget.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    widget?.destroy?.();
  });

  describe('Widget Creation and Initialization', () => {
    it('should create widget with default configuration', () => {
      widget = new LoggerWidget(
        'test_logger',
        {},
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      expect(widget).toBeDefined();
      expect(runtime.logger.registerWidget).toHaveBeenCalledWith(
        LoggerWidget.DEFAULTS.MAX_LINES,
        expect.any(Function)
      );
      expect(runtime.logger.updateHass).toHaveBeenCalledWith(mockHass);
    });

    it('should create widget with custom maxLines', () => {
      widget = new LoggerWidget(
        'test_custom_logger',
        { maxLines: 10 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      expect(runtime.logger.registerWidget).toHaveBeenCalledWith(
        10,
        expect.any(Function)
      );
    });

    it('should create widget without hass initially', () => {
      widget = new LoggerWidget(
        'test_no_hass',
        {},
        {},
        undefined,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      expect(widget).toBeDefined();
      expect(runtime.logger.updateHass).not.toHaveBeenCalled();
    });

    it('should handle resize correctly', () => {
      widget = new LoggerWidget(
        'test_resize',
        { maxLines: 3 },
        { height: 200 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      widget.onResize();
      expect(mockRequestUpdate).toHaveBeenCalled();
    });
  });

  describe('Widget Expansion and Elements', () => {
    it('should expand to include bounds and text elements', () => {
      widget = new LoggerWidget(
        'test_expand',
        { maxLines: 3 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      
      // Should include bounds element + (maxLines + 1) text elements
      expect(elements).toHaveLength(5); // 1 bounds + 4 text elements (maxLines + 1)
      expect(elements[0]).toBeInstanceOf(RectangleElement);
      
      // Check that remaining elements are TextElements
      for (let i = 1; i < elements.length; i++) {
        expect(elements[i]).toBeInstanceOf(TextElement);
      }
    });

    it('should create elements with correct IDs', () => {
      widget = new LoggerWidget(
        'id_test_logger',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      
      expect(elements[0].id).toBe('id_test_logger'); // bounds element
      expect(elements[1].id).toMatch(/id_test_logger_entry_\d+/); // text elements
      expect(elements[2].id).toMatch(/id_test_logger_entry_\d+/);
      expect(elements[3].id).toMatch(/id_test_logger_entry_\d+/);
    });

    it('should set correct height based on line spacing', () => {
      widget = new LoggerWidget(
        'height_test',
        { maxLines: 5, fontSize: 16 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // Height should be maxLines * lineSpacing
      const expectedLineSpacing = 16 * 1.4; // fontSize * 1.4 (default multiplier)
      const expectedHeight = 5 * expectedLineSpacing;
      
      expect(widget.getLayoutConfig().height).toBe(expectedHeight);
    });
  });

  describe('Message Processing and Display', () => {
    beforeEach(() => {
      runtime.logger.getMessages.mockReturnValue(mockLogMessages.slice(0, 2));
    });

    it('should populate entries from existing messages', () => {
      // Ensure the mock returns messages
      vi.clearAllMocks();
      runtime.logger.getMessages.mockReturnValue(mockLogMessages.slice(0, 2));
      
      widget = new LoggerWidget(
        'populate_test',
        { maxLines: 3 },
        { width: 400 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      expect(runtime.logger.getMessages).toHaveBeenCalled();
      // The widget should be created successfully and getMessages should be called during initialization
    });

    it('should handle message enqueueing and prevent duplicates', async () => {
      widget = new LoggerWidget(
        'queue_test',
        { maxLines: 3 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // Get the callback passed to registerWidget
      const messageCallback = runtime.logger.registerWidget.mock.calls[0][1];
      
      // Test message processing
      const newMessage: LogMessage = {
        id: 'new_msg',
        text: 'New message',
        timestamp: Date.now()
      };

      messageCallback(newMessage);
      
      // Give time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockRequestUpdate).toHaveBeenCalled();
    });

    it('should trim text that exceeds widget width', async () => {
      const longText = 'This is a very long message that should be trimmed';
      
      // Clear previous mock calls
      vi.clearAllMocks();
      
      // Mock FontManager to return width that exceeds widget width
      mockFontManager.measureTextWidth.mockImplementation((text: string) => {
        if (text === longText) return 500;
        if (text === '…') return 10;
        return text.length * 8;
      });

      widget = new LoggerWidget(
        'trim_test',
        { maxLines: 3 },
        { width: 200 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // Get the message callback from registerWidget and test it with a long message
      const messageCallback = runtime.logger.registerWidget.mock.calls[0][1];
      
      // Set up the bounds element with proper width
      if (widget['boundsElement']) {
        widget['boundsElement'].layout = { x: 0, y: 0, width: 200, height: 100, calculated: true } as any;
      }
      
      // Test message processing with long text
      messageCallback({
        id: 'long_msg',
        text: longText,
        timestamp: Date.now()
      });

      // Give time for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // FontManager should be called during message processing for text trimming
      expect(mockFontManager.measureTextWidth).toHaveBeenCalled();
    });
  });

  describe('Text Configuration and Styling', () => {
    it('should use custom text configuration', () => {
      widget = new LoggerWidget(
        'style_test',
        {
          maxLines: 3,
          fontSize: 18,
          fontFamily: 'Roboto',
          fontWeight: 'bold',
          textAnchor: 'end',
          textColor: '#ff0000'
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      expect(textElement.props.fontSize).toBe(18);
      expect(textElement.props.fontFamily).toBe('Roboto');
      expect(textElement.props.fontWeight).toBe('bold');
      expect(textElement.props.textAnchor).toBe('end');
      expect(textElement.props.fill).toBe('#ff0000');
    });

    it('should use defaults when no styling is provided', () => {
      widget = new LoggerWidget(
        'default_style_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      expect(textElement.props.fontSize).toBe(LoggerWidget.DEFAULTS.FONT_SIZE);
      expect(textElement.props.fontFamily).toBe(LoggerWidget.DEFAULTS.FONT_FAMILY);
      expect(textElement.props.fontWeight).toBe(LoggerWidget.DEFAULTS.FONT_WEIGHT);
      expect(textElement.props.textAnchor).toBe(LoggerWidget.DEFAULTS.TEXT_ANCHOR);
    });

    it('should handle custom line spacing', async () => {
      widget = new LoggerWidget(
        'spacing_test',
        { 
          maxLines: 3,
          lineSpacing: '25'
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // DistanceParser should be called with the lineSpacing value
      const { DistanceParser } = await import('../../../utils/animation.js');
      expect(DistanceParser.parse).toHaveBeenCalledWith(
        '25',
        expect.any(Object)
      );
    });
  });

  describe('Color Cycling Configuration', () => {
    it('should use custom color cycle when provided', () => {
      const customColorCycle = [
        { color: '#ff0000', duration: 3000 },
        { color: '#00ff00', duration: 2000 },
        { color: '#0000ff', duration: 1000 }
      ];

      widget = new LoggerWidget(
        'color_cycle_test',
        { 
          maxLines: 2,
          color_cycle: customColorCycle
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      // Should use first color from cycle as initial color
      expect(textElement.props.fill).toBe('#ff0000');
    });

    it('should use default text color when no color cycle provided', () => {
      widget = new LoggerWidget(
        'no_cycle_test',
        { 
          maxLines: 2,
          textColor: '#custom'
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      expect(textElement.props.fill).toBe('#custom');
    });
  });

  describe('Hass Integration', () => {
    it('should update hass on logger service when hass changes', () => {
      widget = new LoggerWidget(
        'hass_test',
        { maxLines: 3 },
        {},
        undefined,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      widget.updateHass(mockHass);
      
      expect(runtime.logger.updateHass).toHaveBeenCalledWith(mockHass);
    });

    it('should not update hass if same instance', () => {
      widget = new LoggerWidget(
        'same_hass_test',
        { maxLines: 3 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      vi.clearAllMocks();
      
      widget.updateHass(mockHass);
      
      expect(runtime.logger.updateHass).not.toHaveBeenCalled();
    });

    it('should handle bounds element hass updates', () => {
      widget = new LoggerWidget(
        'bounds_hass_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const boundsElement = elements[0] as RectangleElement;
      
      // Test that bounds element can update hass and it propagates to widget
      const updateHassSpy = vi.spyOn(widget, 'updateHass');
      boundsElement.updateHass(mockHass);
      
      expect(updateHassSpy).toHaveBeenCalledWith(mockHass);
    });
  });

  describe('Message Management', () => {
    it('should update log messages and refresh display', () => {
      widget = new LoggerWidget(
        'message_update_test',
        { maxLines: 3 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const newMessages = [
        { id: 'new1', text: 'Message 1', timestamp: Date.now() },
        { id: 'new2', text: 'Message 2', timestamp: Date.now() + 1000 }
      ];

      widget.updateLogMessages(newMessages);

      expect(runtime.logger.clearMessages).toHaveBeenCalled();
      expect(runtime.logger.addMessagesInOrder).toHaveBeenCalledWith(newMessages);
      expect(mockRequestUpdate).toHaveBeenCalled();
    });
  });

  describe('Widget Destruction and Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const mockUnsubscribe = vi.fn();
      runtime.logger.registerWidget.mockReturnValue(mockUnsubscribe);

      widget = new LoggerWidget(
        'cleanup_test',
        { maxLines: 3 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      widget.destroy();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      widget = new LoggerWidget(
        'multi_destroy_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // Should not throw on multiple destroy calls
      expect(() => {
        widget.destroy();
        widget.destroy();
        widget.destroy();
      }).not.toThrow();
    });
  });

  describe('Animation Integration', () => {
    it('should initialize animation contexts for entries', async () => {
      widget = new LoggerWidget(
        'animation_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      // Test animation by triggering a message
      const messageCallback = runtime.logger.registerWidget.mock.calls[0][1];
      const testMessage: LogMessage = {
        id: 'anim_msg',
        text: 'Animated message',
        timestamp: Date.now()
      };

      messageCallback(testMessage);

      // Allow animations to process
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(gsap.fromTo).toHaveBeenCalled();
    });

    it('should handle animation cleanup on reset', () => {
      widget = new LoggerWidget(
        'reset_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      widget.onResize(); // This triggers entry reset
      
      expect(gsap.killTweensOf).toHaveBeenCalled();
    });
  });

  describe('Layout Configuration', () => {
    it('should handle different anchor configurations', () => {
      widget = new LoggerWidget(
        'anchor_test',
        { 
          maxLines: 2,
          textAnchor: 'end'
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      // For end anchor, should anchor to topRight
      expect(textElement.layoutConfig.anchor?.anchorPoint).toBe('topRight');
      expect(textElement.layoutConfig.anchor?.targetAnchorPoint).toBe('topRight');
    });

    it('should use start anchor by default', () => {
      widget = new LoggerWidget(
        'default_anchor_test',
        { maxLines: 2 },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement,
        runtime
      );

      const elements = widget.expand();
      const textElement = elements[1] as TextElement;
      
      expect(textElement.layoutConfig.anchor?.anchorPoint).toBe('topLeft');
      expect(textElement.layoutConfig.anchor?.targetAnchorPoint).toBe('topLeft');
    });
  });
});

describe('LoggerWidget Registry Integration', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let runtime: any;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    vi.clearAllMocks();
    runtime = createRuntime();
    runtime.logger.getMessages.mockReturnValue([]);
    runtime.logger.registerWidget.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be registered in widget registry', () => {
    const elements = WidgetRegistry.expandWidget(
      'logger-widget',
      'registry_test',
      { maxLines: 3 },
      {},
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement,
      runtime
    );

    expect(elements).not.toBeNull();
    expect(elements).toHaveLength(5); // bounds + 4 text elements (maxLines + 1)
    expect(elements![0]).toBeInstanceOf(RectangleElement);
    
    // Check that widget reference is stored
    // With lifecycle API, instances are tracked in WidgetRegistry; no back-reference on elements
    expect(elements![0]).toBeInstanceOf(RectangleElement);
  });

  it('should handle registry calls with custom configuration', () => {
    const customElements = WidgetRegistry.expandWidget(
      'logger-widget',
      'custom_registry_test',
      { 
        maxLines: 5,
        fontSize: 16,
        textColor: '#00ff00'
      },
      { height: 200 },
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement,
      runtime
    );

    expect(customElements).not.toBeNull();
    expect(customElements).toHaveLength(7); // bounds + 6 text elements (maxLines + 1)
  });

  it('should return null for unknown widget types', () => {
    const elements = WidgetRegistry.expandWidget(
      'unknown-logger-widget',
      'unknown_test',
      { maxLines: 3 },
      {},
      mockHass,
      mockRequestUpdate,
      mockGetShadowElement,
      runtime
    );

    expect(elements).toBeNull();
  });
}); 