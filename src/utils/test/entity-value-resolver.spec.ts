import { describe, it, expect } from 'vitest';
import { EntityValueResolver } from '../entity-value-resolver.js';

const mockHass = {
  states: {
    'light.kitchen_sink_light': {
      state: 'on',
      attributes: {
        friendly_name: 'Kitchen Sink Light',
        brightness: 255,
        color_mode: 'brightness'
      }
    },
    'sensor.temperature': {
      state: '23.5',
      attributes: {
        friendly_name: 'Temperature Sensor',
        unit_of_measurement: '°C',
        device_class: 'temperature'
      }
    },
    'binary_sensor.door': {
      state: 'off',
      attributes: {
        friendly_name: 'Front Door',
        device_class: 'door'
      }
    }
  }
} as any;

describe('EntityValueResolver', () => {
  describe('resolveEntityValue', () => {
    it('should resolve entity state value when no attribute specified', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light' },
        mockHass
      );
      expect(result).toBe('on');
    });

    it('should resolve entity state value when attribute is "state"', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light', attribute: 'state' },
        mockHass
      );
      expect(result).toBe('on');
    });

    it('should resolve entity attribute value when attribute specified', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light', attribute: 'brightness' },
        mockHass
      );
      expect(result).toBe('255');
    });

    it('should return fallback when entity not found', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.nonexistent', fallback: 'Custom Fallback' },
        mockHass
      );
      expect(result).toBe('Custom Fallback');
    });

    it('should return default fallback when entity not found and no custom fallback', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.nonexistent' },
        mockHass
      );
      expect(result).toBe('Unavailable');
    });

    it('should return fallback when hass not provided', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light', fallback: 'No HASS' }
      );
      expect(result).toBe('No HASS');
    });

    it('should return default fallback when hass not provided and no custom fallback', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light' }
      );
      expect(result).toBe('Unknown');
    });

    it('should return fallback when entity provided but empty', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: '', fallback: 'Empty Entity' },
        mockHass
      );
      expect(result).toBe('Empty Entity');
    });

    it('should handle null attribute values', () => {
      const mockHassWithNull = {
        states: {
          'sensor.null_value': {
            state: 'unknown',
            attributes: {
              value: null
            }
          }
        }
      } as any;

      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'sensor.null_value', attribute: 'value', fallback: 'Null Value' },
        mockHassWithNull
      );
      expect(result).toBe('Null Value');
    });

    it('should handle undefined attribute values', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light', attribute: 'nonexistent_attr', fallback: 'Missing Attr' },
        mockHass
      );
      expect(result).toBe('Missing Attr');
    });

    it('should convert non-string values to strings', () => {
      const result = EntityValueResolver.resolveEntityValue(
        { entity: 'light.kitchen_sink_light', attribute: 'brightness' },
        mockHass
      );
      expect(result).toBe('255');
      expect(typeof result).toBe('string');
    });
  });

  describe('resolveEntityFriendlyName', () => {
    it('should return friendly name when entity exists', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        'light.kitchen_sink_light',
        mockHass
      );
      expect(result).toBe('Kitchen Sink Light');
    });

    it('should return fallback when entity not found', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        'light.nonexistent',
        mockHass,
        'Custom Fallback'
      );
      expect(result).toBe('Custom Fallback');
    });

    it('should return entity ID when entity not found and no fallback', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        'light.nonexistent',
        mockHass
      );
      expect(result).toBe('light.nonexistent');
    });

    it('should return fallback when hass not provided', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        'light.kitchen_sink_light',
        undefined,
        'No HASS'
      );
      expect(result).toBe('No HASS');
    });

    it('should return entity ID when hass not provided and no fallback', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        'light.kitchen_sink_light'
      );
      expect(result).toBe('light.kitchen_sink_light');
    });

    it('should return fallback when entity ID is empty', () => {
      const result = EntityValueResolver.resolveEntityFriendlyName(
        '',
        mockHass,
        'Empty ID'
      );
      expect(result).toBe('Empty ID');
    });

    it('should return entity ID when entity has no friendly name', () => {
      const mockHassNoFriendlyName = {
        states: {
          'sensor.no_friendly': {
            state: 'value',
            attributes: {}
          }
        }
      } as any;

      const result = EntityValueResolver.resolveEntityFriendlyName(
        'sensor.no_friendly',
        mockHassNoFriendlyName
      );
      expect(result).toBe('sensor.no_friendly');
    });
  });

  describe('entityStateChanged', () => {
    const lastHassStates = {
      'light.kitchen_sink_light': {
        state: 'off',
        attributes: {
          brightness: 128
        }
      },
      'sensor.temperature': {
        state: '20.0',
        attributes: {
          unit_of_measurement: '°C'
        }
      }
    };

    it('should detect state changes', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.kitchen_sink_light',
        'state',
        lastHassStates,
        mockHass
      );
      expect(result).toBe(true);
    });

    it('should detect attribute changes', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.kitchen_sink_light',
        'brightness',
        lastHassStates,
        mockHass
      );
      expect(result).toBe(true);
    });

    it('should return false when no changes detected', () => {
      const result = EntityValueResolver.entityStateChanged(
        'sensor.temperature',
        'unit_of_measurement',
        lastHassStates,
        mockHass
      );
      expect(result).toBe(false);
    });

    it('should return false when missing required parameters', () => {
      expect(EntityValueResolver.entityStateChanged('', 'state', lastHassStates, mockHass)).toBe(false);
      expect(EntityValueResolver.entityStateChanged('light.test', 'state', undefined, mockHass)).toBe(false);
      expect(EntityValueResolver.entityStateChanged('light.test', 'state', lastHassStates, undefined)).toBe(false);
    });

    it('should return false when both old and new entities are missing', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.nonexistent',
        'state',
        {},
        { states: {} } as any
      );
      expect(result).toBe(false);
    });

    it('should return true when entity was added', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.kitchen_sink_light',
        'state',
        {},
        mockHass
      );
      expect(result).toBe(true);
    });

    it('should return true when entity was removed', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.removed_entity',
        'state',
        { 'light.removed_entity': { state: 'on', attributes: {} } },
        { states: {} } as any
      );
      expect(result).toBe(true);
    });

    it('should default to checking state attribute when not specified', () => {
      const result = EntityValueResolver.entityStateChanged(
        'light.kitchen_sink_light',
        undefined,
        lastHassStates,
        mockHass
      );
      expect(result).toBe(true);
    });
  });

  describe('detectsEntityReferences', () => {
    it('should detect entity references from props', () => {
      const element = {
        props: {
          entity: 'light.kitchen_sink_light'
        }
      };

      const result = EntityValueResolver.detectsEntityReferences(element);
      expect(result.has('light.kitchen_sink_light')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should return empty set when no entity in props', () => {
      const element = {
        props: {
          other_prop: 'value'
        }
      };

      const result = EntityValueResolver.detectsEntityReferences(element);
      expect(result.size).toBe(0);
    });

    it('should return empty set when no props', () => {
      const element = {};

      const result = EntityValueResolver.detectsEntityReferences(element);
      expect(result.size).toBe(0);
    });

    it('should return empty set when props is undefined', () => {
      const element = {
        props: undefined
      };

      const result = EntityValueResolver.detectsEntityReferences(element);
      expect(result.size).toBe(0);
    });
  });
}); 