import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogWidget } from '../log-widget.js';
import { LayoutElement } from '../../elements/element.js';
import { TextElement } from '../../elements/text.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { LayoutElementProps, LayoutConfigOptions } from '../../engine.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LogMessage } from '../../../types.js';
import { WidgetRegistry } from '../registry.js';

describe('LogWidget', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let widget: LogWidget;

  beforeEach(() => {
    mockHass = { states: {} } as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
  });

  describe('Constructor', () => {
    it('should initialize with minimal parameters', () => {
      widget = new LogWidget('test-log');
      const elements = widget.expand();

      expect(elements).toHaveLength(6); // bounds + 5 default max_lines elements
      expect(elements[0]).toBeInstanceOf(RectangleElement);
      expect(elements[0].id).toBe('test-log');
      // Log elements should be empty initially
      for (let i = 1; i < elements.length; i++) {
        expect((elements[i] as TextElement).props.text).toBe('');
      }
    });

    it('should initialize with all parameters', () => {
      const props: LayoutElementProps = { maxLines: 10, fontSize: 16 };
      const layoutConfig: LayoutConfigOptions = { offsetX: 10, offsetY: 20 };

      widget = new LogWidget(
        'full-log',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      const elements = widget.expand();
      expect(elements[0].id).toBe('full-log');
      expect(elements[0].layoutConfig).toBe(layoutConfig);
    });
  });

  describe('updateLogMessages method', () => {
    it('should allow manual log message updates', () => {
      widget = new LogWidget('manual-log', {}, {}, mockHass, mockRequestUpdate);
      const messages: LogMessage[] = [{ id: '1', text: 'Manual message', timestamp: Date.now() }];
      widget.updateLogMessages(messages);

      const elements = widget.expand();
      expect(elements).toHaveLength(6); // bounds + 5 max_lines elements
      const logElement = elements[1] as TextElement;
      expect(logElement.props.text).toBe('Manual message');
      expect(logElement.props.fillOpacity).toBe(1); // Should be visible
      expect(mockRequestUpdate).toHaveBeenCalled();
    });
  });

  describe('Global Logging with updateHass', () => {
    it('should not log anything on the first updateHass call', () => {
      widget = new LogWidget('first-update-log', {}, {}, undefined, mockRequestUpdate);
      const hass = { states: { 'sensor.a': { state: '10' } } } as any;
      
      widget.updateHass(hass);
      const elements = widget.expand();

      expect(elements).toHaveLength(6); // bounds + 5 max_lines elements
      // All log elements should be empty/invisible
      for (let i = 1; i < elements.length; i++) {
        expect((elements[i] as TextElement).props.text).toBe('');
        expect((elements[i] as TextElement).props.fillOpacity).toBe(0);
      }
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('should log state changes on subsequent updateHass calls', () => {
      const oldHass = {
        states: {
          'sensor.a': { state: '10', last_changed: '2023-01-01T00:00:00Z', attributes: { friendly_name: 'Sensor A' } },
          'sensor.b': { state: 'off', last_changed: '2023-01-01T00:00:00Z', attributes: { friendly_name: 'Sensor B' } }
        }
      } as any;
      const newHass = {
        states: {
          'sensor.a': { state: '20', last_changed: '2023-01-01T00:01:00Z', attributes: { friendly_name: 'Sensor A' } },
          'sensor.b': { state: 'off', last_changed: '2023-01-01T00:00:00Z', attributes: { friendly_name: 'Sensor B' } }
        }
      } as any;

      widget = new LogWidget('state-change-log', {}, {}, oldHass, mockRequestUpdate);
      widget.updateHass(newHass);

      const elements = widget.expand();
      expect(elements).toHaveLength(6); // bounds + 5 max_lines elements
      expect((elements[1] as TextElement).props.text).toBe('Sensor A: 20');
      expect((elements[1] as TextElement).props.fillOpacity).toBe(1); // Should be visible
      // Other elements should be empty/invisible
      for (let i = 2; i < elements.length; i++) {
        expect((elements[i] as TextElement).props.text).toBe('');
        expect((elements[i] as TextElement).props.fillOpacity).toBe(0);
      }
      expect(mockRequestUpdate).toHaveBeenCalled();
    });

    it('should not log if states have not changed', () => {
      const oldHass = { states: { 'sensor.a': { state: '10' } } } as any;
      const newHass = { states: { 'sensor.a': { state: '10' } } } as any;

      widget = new LogWidget('no-change-log', {}, {}, oldHass, mockRequestUpdate);
      widget.updateHass(newHass);
      
      const elements = widget.expand();
      expect(elements).toHaveLength(6); // bounds + 5 max_lines elements
      // All log elements should be empty/invisible
      for (let i = 1; i < elements.length; i++) {
        expect((elements[i] as TextElement).props.text).toBe('');
        expect((elements[i] as TextElement).props.fillOpacity).toBe(0);
      }
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });

    it('should prepend new logs and respect max_lines', () => {
      let oldHass = {
        states: {
          'sensor.a': { state: '10', last_changed: '2023-01-01T00:00:00Z', attributes: {} },
          'sensor.b': { state: '100', last_changed: '2023-01-01T00:00:00Z', attributes: {} }
        }
      } as any;

      widget = new LogWidget('max-lines-log', { maxLines: 2 }, {}, oldHass, mockRequestUpdate);
      
      // First change
      let newHass = { states: { ...oldHass.states, 'sensor.a': { state: '20', last_changed: '2023-01-01T00:01:00Z', attributes: {} } } } as any;
      widget.updateHass(newHass);

      // Second change
      oldHass = newHass;
      newHass = { states: { ...newHass.states, 'sensor.b': { state: '200', last_changed: '2023-01-01T00:02:00Z', attributes: {} } } } as any;
      widget.updateHass(newHass);
      
      // Third change (this should push the first log out)
      oldHass = newHass;
      newHass = { states: { ...newHass.states, 'sensor.a': { state: '30', last_changed: '2023-01-01T00:03:00Z', attributes: {} } } } as any;
      widget.updateHass(newHass);

      const elements = widget.expand();
      expect(elements).toHaveLength(3); // bounds + 2 max_lines elements (custom max_lines: 2)
      expect((elements[1] as TextElement).props.text).toBe('sensor.a: 30'); // Most recent
      expect((elements[2] as TextElement).props.text).toBe('sensor.b: 200'); // Second most recent
    });
  });

  describe('Registry Integration', () => {
    it('should be registered in widget registry', () => {
      const elements = WidgetRegistry.expandWidget(
        'logger-widget',
        'test_log',
        {},
        {},
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );

      expect(elements).not.toBeNull();
      expect(elements).toHaveLength(6); // bounds + 5 default max_lines elements
      expect(elements![0].id).toBe('test_log');
    });
  });
}); 