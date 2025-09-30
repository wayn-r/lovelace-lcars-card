import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Widget } from '../widget.js';
import { LayoutElement } from '../../elements/element.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { LayoutElementProps, LayoutConfigOptions } from '../../engine.js';
import { HomeAssistant } from 'custom-card-helpers';

class MockWidget extends Widget {
  public expand(): LayoutElement[] {
    return [new RectangleElement(this.id, this.props, this.layoutConfig, this.hass, this.requestUpdateCallback, this.getShadowElement)];
  }

  // Expose protected properties for testing
  public getProtectedId(): string {
    return this.id;
  }

  public getProtectedProps(): LayoutElementProps {
    return this.props;
  }

  public getProtectedLayoutConfig(): LayoutConfigOptions {
    return this.layoutConfig;
  }

  public getProtectedHass(): HomeAssistant | undefined {
    return this.hass;
  }

  public getProtectedRequestUpdateCallback(): (() => void) | undefined {
    return this.requestUpdateCallback;
  }

  public getProtectedGetShadowElement(): ((id: string) => Element | null) | undefined {
    return this.getShadowElement;
  }
}

describe('Widget', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let widget: MockWidget;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
  });

  describe('Constructor', () => {
    it('should initialize with minimal parameters', () => {
      widget = new MockWidget('test-widget');

      expect(widget.getProtectedId()).toBe('test-widget');
      expect(widget.getProtectedProps()).toEqual({});
      expect(widget.getProtectedLayoutConfig()).toEqual({});
      expect(widget.getProtectedHass()).toBeUndefined();
      expect(widget.getProtectedRequestUpdateCallback()).toBeUndefined();
      expect(widget.getProtectedGetShadowElement()).toBeUndefined();
    });

    it('should initialize with all parameters', () => {
      const props: LayoutElementProps = { width: 100, height: 50 };
      const layoutConfig: LayoutConfigOptions = { offsetX: 10, offsetY: 20 };

      widget = new MockWidget(
        'full-widget',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect(widget.getProtectedId()).toBe('full-widget');
      expect(widget.getProtectedProps()).toBe(props);
      expect(widget.getProtectedLayoutConfig()).toBe(layoutConfig);
      expect(widget.getProtectedHass()).toBe(mockHass);
      expect(widget.getProtectedRequestUpdateCallback()).toBe(mockRequestUpdate);
      expect(widget.getProtectedGetShadowElement()).toBe(mockGetShadowElement);
    });

    it('should handle undefined optional parameters explicitly', () => {
      widget = new MockWidget('undefined-widget', undefined, undefined, undefined, undefined, undefined);

      expect(widget.getProtectedId()).toBe('undefined-widget');
      expect(widget.getProtectedProps()).toEqual({});
      expect(widget.getProtectedLayoutConfig()).toEqual({});
      expect(widget.getProtectedHass()).toBeUndefined();
      expect(widget.getProtectedRequestUpdateCallback()).toBeUndefined();
      expect(widget.getProtectedGetShadowElement()).toBeUndefined();
    });

    it('should handle partial parameter initialization', () => {
      const props: LayoutElementProps = { fill: 'red' };

      widget = new MockWidget('partial-widget', props);

      expect(widget.getProtectedId()).toBe('partial-widget');
      expect(widget.getProtectedProps()).toBe(props);
      expect(widget.getProtectedLayoutConfig()).toEqual({});
      expect(widget.getProtectedHass()).toBeUndefined();
      expect(widget.getProtectedRequestUpdateCallback()).toBeUndefined();
      expect(widget.getProtectedGetShadowElement()).toBeUndefined();
    });
  });

  describe('Abstract expand method', () => {
    it('should require concrete implementation of expand method', () => {
      widget = new MockWidget('test-expand');
      const result = widget.expand();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(RectangleElement);
      expect(result[0].id).toBe('test-expand');
    });

    it('should pass all constructor parameters to expanded elements', () => {
      const props: LayoutElementProps = { width: 200, fill: 'blue' };
      const layoutConfig: LayoutConfigOptions = { anchor: { anchorTo: 'container' } };

      widget = new MockWidget(
        'param-test',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const result = widget.expand();
      const element = result[0];

      expect(element.props).toBe(props);
      expect(element.layoutConfig).toBe(layoutConfig);
      expect(element.hass).toBe(mockHass);
      expect(element.requestUpdateCallback).toBe(mockRequestUpdate);
    });
  });

  describe('Widget architecture compliance', () => {
    it('should not be a LayoutElement itself', () => {
      widget = new MockWidget('architecture-test');

      expect(widget).not.toBeInstanceOf(LayoutElement);
      expect(widget).toBeInstanceOf(Widget);
    });

    it('should produce LayoutElements through expand method', () => {
      widget = new MockWidget('element-production');
      const result = widget.expand();

      expect(Array.isArray(result)).toBe(true);
      result.forEach(element => {
        expect(element).toBeInstanceOf(LayoutElement);
      });
    });

    it('should maintain consistent interface for all parameters', () => {
      // Test that all constructor parameters match LayoutElement constructor signature
      const props: LayoutElementProps = { stroke: 'black', strokeWidth: 2 };
      const layoutConfig: LayoutConfigOptions = { offsetY: 15 };

      widget = new MockWidget(
        'interface-test',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const result = widget.expand();
      const element = result[0] as RectangleElement;

      // Verify the element received the same parameters that could be passed to any LayoutElement
      expect(element.id).toBe('interface-test');
      expect(element.props).toBe(props);
      expect(element.layoutConfig).toBe(layoutConfig);
      expect(element.hass).toBe(mockHass);
      expect(element.requestUpdateCallback).toBe(mockRequestUpdate);
    });
  });

  describe('Widget type verification', () => {
    it('should enforce abstract expand method through TypeScript', () => {
      // This test ensures the abstract method contract is working
      // The MockWidget implementation satisfies the abstract requirement
      widget = new MockWidget('type-test');
      
      expect(typeof widget.expand).toBe('function');
      expect(widget.expand()).toHaveLength(1);
    });

    it('should support widgets that return multiple elements', () => {
      class MultiElementWidget extends Widget {
        public expand(): LayoutElement[] {
          return [
            new RectangleElement(`${this.id}_1`),
            new RectangleElement(`${this.id}_2`),
            new RectangleElement(`${this.id}_3`)
          ];
        }
      }

      const multiWidget = new MultiElementWidget('multi-test');
      const result = multiWidget.expand();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('multi-test_1');
      expect(result[1].id).toBe('multi-test_2');
      expect(result[2].id).toBe('multi-test_3');
    });

    it('should support widgets that return empty arrays', () => {
      class EmptyWidget extends Widget {
        public expand(): LayoutElement[] {
          return [];
        }
      }

      const emptyWidget = new EmptyWidget('empty-test');
      const result = emptyWidget.expand();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Parameter propagation scenarios', () => {
    it('should handle complex props objects', () => {
      const complexProps: LayoutElementProps = {
        width: 300,
        height: 150,
        fill: 'rgba(255, 0, 0, 0.5)',
        stroke: '#000000',
        strokeWidth: 3,
        rx: 10,
        button: {
          enabled: true,
          actions: {
            tap: { action: 'toggle', entity: 'light.test' }
          }
        }
      };

      widget = new MockWidget('complex-props', complexProps);
      const result = widget.expand();

      expect(result[0].props).toBe(complexProps);
      expect(result[0].props.button?.enabled).toBe(true);
    });

    it('should handle complex layout config objects', () => {
      const complexLayoutConfig: LayoutConfigOptions = {
        anchor: {
          anchorTo: 'other-element',
          anchorPoint: 'top-left',
          targetAnchorPoint: 'bottom-right'
        },
        stretch: {
          stretchTo1: 'container',
          targetStretchAnchorPoint1: 'right'
        },
        offsetX: 25,
        offsetY: -10
      };

      widget = new MockWidget('complex-layout', {}, complexLayoutConfig);
      const result = widget.expand();

      expect(result[0].layoutConfig).toBe(complexLayoutConfig);
      expect(result[0].layoutConfig.anchor?.anchorTo).toBe('other-element');
      expect(result[0].layoutConfig.stretch?.stretchTo1).toBe('container');
    });
  });
}); 