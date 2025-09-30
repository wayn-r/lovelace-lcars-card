import { describe, it, expect, beforeEach } from 'vitest';
import { EntityTextWidget } from '../entity-text.js';
import { WidgetRegistry } from '../registry.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { TextElement } from '../../elements/text.js';

const mockHass = {
  states: {
    'light.kitchen_sink_light': {
      state: 'on',
      attributes: {
        friendly_name: 'Kitchen Sink Light',
        brightness: 255
      }
    },
    'sensor.temperature': {
      state: '23.5',
      attributes: {
        friendly_name: 'Temperature Sensor',
        unit_of_measurement: '°C'
      }
    }
  }
} as any;

describe('EntityTextWidget', () => {
  let widget: EntityTextWidget;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;

  beforeEach(() => {
    mockRequestUpdate = () => {};
    mockGetShadowElement = () => null;
  });

  describe('Widget Creation and Expansion', () => {
    it('should create widget with minimal configuration', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements).toHaveLength(4);
      expect(elements[0]).toBeInstanceOf(RectangleElement); // bounds
      expect(elements[1]).toBeInstanceOf(RectangleElement); // leading rect
      expect(elements[2]).toBeInstanceOf(RectangleElement); // label rect
      expect(elements[3]).toBeInstanceOf(TextElement); // value text
    });

    it('should create elements with correct IDs', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements[0].id).toBe('test_widget');
      expect(elements[1].id).toBe('test_widget_leading_rect');
      expect(elements[2].id).toBe('test_widget_label_rect');
      expect(elements[3].id).toBe('test_widget_value_text');
    });

    it('should use default height when not specified', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const leadingRect = elements[1] as RectangleElement;
      const labelRect = elements[2] as RectangleElement;
      
      expect(leadingRect.layoutConfig.height).toBe(25);
      expect(labelRect.layoutConfig.height).toBe(25);
    });

    it('should use configured height when specified', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        { height: 40 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const leadingRect = elements[1] as RectangleElement;
      const labelRect = elements[2] as RectangleElement;
      const valueText = elements[3] as TextElement;
      
      expect(leadingRect.layoutConfig.height).toBe(40);
      expect(labelRect.layoutConfig.height).toBe(40);
      expect(valueText.layoutConfig.height).toBe(40);
    });
  });

  describe('Configuration Handling', () => {
    it('should apply label configuration correctly', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          label: {
            content: 'Custom Label',
            width: 120,
            height: 18,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fill: '#FF0000',
            offsetX: 5
          }
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      
      expect(labelRect.props.text).toBe('Custom Label');
      expect(labelRect.props.width).toBe(120);
      expect(labelRect.props.fontSize).toBe(18);
      expect(labelRect.props.fontFamily).toBe('Arial');
      expect(labelRect.props.fontWeight).toBe('bold');
      expect(labelRect.props.textColor).toBe('#FF0000');
      expect(labelRect.layoutConfig.offsetX).toBe(5);
    });

    it('should apply value configuration correctly', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          value: {
            content: 'Custom Value',
            fontFamily: 'Courier',
            fontWeight: 'normal',
            fill: '#00FF00',
            offsetX: 15
          }
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const valueText = elements[3] as TextElement;
      
      expect(valueText.props.text).toBe('Custom Value');
      expect(valueText.props.fontFamily).toBe('Courier');
      expect(valueText.props.fontWeight).toBe('normal');
      expect(valueText.props.fill).toBe('#00FF00');
      expect(valueText.layoutConfig.offsetX).toBe(15);
    });

    it('should apply appearance configuration correctly', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          appearance: {
            fill: '#0000FF'
          }
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const leadingRect = elements[1] as RectangleElement;
      const labelRect = elements[2] as RectangleElement;
      
      expect((leadingRect.props.fill as any).default).toBe('#0000FF');
      expect((labelRect.props.fill as any).default).toBe('#0000FF');
    });
  });

  describe('Label Text Resolution', () => {
    it('should use configured label content when provided', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          label: { content: 'Custom Label' }
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      expect(labelRect.props.text).toBe('Custom Label');
    });

    it('should use entity friendly name when no label content configured', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      expect(labelRect.props.text).toBe('Kitchen Sink Light');
    });

    it('should fallback to entity ID when entity not found', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.nonexistent' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      expect(labelRect.props.text).toBe('light.nonexistent');
    });
  });

  describe('Value Text Resolution', () => {
    it('should use configured value content when provided', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          value: { content: 'Custom Value' }
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const valueText = elements[3] as TextElement;
      expect(valueText.props.text).toBe('Custom Value');
    });

    it('should use entity state when no value content configured', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const valueText = elements[3] as TextElement;
      expect(valueText.props.text).toBe('on');
    });

    it('should use entity attribute when attribute specified', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {
          entity: 'light.kitchen_sink_light',
          attribute: 'brightness'
        },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const valueText = elements[3] as TextElement;
      expect(valueText.props.text).toBe('255');
    });

    it('should fallback when entity not found', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.nonexistent' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const valueText = elements[3] as TextElement;
      expect(valueText.props.text).toBe('Unavailable');
    });
  });

  describe('Default Button Interaction', () => {
    it('should add default more-info button to label when entity provided', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      
      expect(labelRect.props.button?.enabled).toBe(true);
      expect(labelRect.props.button?.actions?.tap?.action).toBe('more-info');
      expect(labelRect.props.button?.actions?.tap?.entity).toBe('light.kitchen_sink_light');
      expect(labelRect.button).toBeDefined();
    });

    it('should not add default button when no entity provided', () => {
      widget = new EntityTextWidget(
        'test_widget',
        {},
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2] as RectangleElement;
      
      expect(labelRect.props.button).toBeUndefined();
      expect(labelRect.button).toBeUndefined();
    });
  });

  describe('Layout Anchoring', () => {
    it('should correctly anchor elements in sequence', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const bounds = elements[0];
      const leadingRect = elements[1];
      const labelRect = elements[2];
      const valueText = elements[3];

      // Leading rect anchors to bounds
      expect(leadingRect.layoutConfig.anchor?.anchorTo).toBe(bounds.id);
      expect(leadingRect.layoutConfig.anchor?.anchorPoint).toBe('top-left');
      expect(leadingRect.layoutConfig.anchor?.targetAnchorPoint).toBe('top-left');

      // Label rect anchors to leading rect
      expect(labelRect.layoutConfig.anchor?.anchorTo).toBe(leadingRect.id);
      expect(labelRect.layoutConfig.anchor?.anchorPoint).toBe('top-left');
      expect(labelRect.layoutConfig.anchor?.targetAnchorPoint).toBe('top-right');

      // Value text anchors to label rect
      expect(valueText.layoutConfig.anchor?.anchorTo).toBe(labelRect.id);
      expect(valueText.layoutConfig.anchor?.anchorPoint).toBe('top-left');
      expect(valueText.layoutConfig.anchor?.targetAnchorPoint).toBe('top-right');
    });

    it('should use default offsets when not configured', () => {
      widget = new EntityTextWidget(
        'test_widget',
        { entity: 'light.kitchen_sink_light' },
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      const labelRect = elements[2];
      const valueText = elements[3];

      expect(labelRect.layoutConfig.offsetX).toBe(3); // DEFAULT_LABEL_OFFSET_X
      expect(valueText.layoutConfig.offsetX).toBe(10); // DEFAULT_VALUE_OFFSET_X
    });
  });
});

describe('EntityTextWidget Registry Integration', () => {
  it('should be registered in widget registry', () => {
    const elements = WidgetRegistry.expandWidget(
      'entity-text-widget',
      'test_widget',
      { entity: 'light.kitchen_sink_light' },
      {},
      mockHass,
      () => {},
      () => null
    );

    expect(elements).not.toBeNull();
    expect(elements).toHaveLength(4);
  });

  it('should return null for unknown widget types', () => {
    const elements = WidgetRegistry.expandWidget(
      'unknown-widget',
      'test_widget',
      {},
      {},
      mockHass,
      () => {},
      () => null
    );

    expect(elements).toBeNull();
  });
}); 