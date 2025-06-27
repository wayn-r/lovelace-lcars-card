import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetRegistry, WidgetFactory } from '../registry.js';
import { LayoutElement } from '../../elements/element.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { HomeAssistant } from 'custom-card-helpers';

describe('Widget Registry', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let mockFactory: WidgetFactory;
  let mockElement: LayoutElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    
    mockElement = new RectangleElement('mock-element');
    mockFactory = vi.fn().mockReturnValue([mockElement]);
    
    // Clear registry between tests by accessing the internal registry
    const registryModule = await import('../registry.js');
    (registryModule.WidgetRegistry as any).registry?.clear?.();
  });

  describe('registerWidget', () => {
    it('should register a widget factory with lowercase type', () => {
      WidgetRegistry.registerWidget('TestWidget', mockFactory);
      
      const result = WidgetRegistry.expandWidget('testwidget', 'test-id');
      expect(result).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledWith('test-id', {}, {}, undefined, undefined, undefined);
    });

    it('should register widget factory with case-insensitive type', () => {
      WidgetRegistry.registerWidget('MixedCaseWidget', mockFactory);
      
      const resultLower = WidgetRegistry.expandWidget('mixedcasewidget', 'test-1');
      const resultMixed = WidgetRegistry.expandWidget('MixedCaseWidget', 'test-2');
      const resultUpper = WidgetRegistry.expandWidget('MIXEDCASEWIDGET', 'test-3');
      
      expect(resultLower).toEqual([mockElement]);
      expect(resultMixed).toEqual([mockElement]);
      expect(resultUpper).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledTimes(3);
    });

    it('should trim whitespace from widget type during registration', () => {
      WidgetRegistry.registerWidget('  spacedWidget  ', mockFactory);
      
      const result = WidgetRegistry.expandWidget('spacedwidget', 'test-id');
      expect(result).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalled();
    });

    it('should override existing widget registration', () => {
      const firstElement = new RectangleElement('first');
      const secondElement = new RectangleElement('second');
      const firstFactory = vi.fn().mockReturnValue([firstElement]);
      const secondFactory = vi.fn().mockReturnValue([secondElement]);
      
      WidgetRegistry.registerWidget('overrideWidget', firstFactory);
      WidgetRegistry.registerWidget('overrideWidget', secondFactory);
      
      const result = WidgetRegistry.expandWidget('overridewidget', 'test-id');
      expect(result).toEqual([secondElement]);
      expect(secondFactory).toHaveBeenCalled();
      expect(firstFactory).not.toHaveBeenCalled();
    });
  });

  describe('expandWidget', () => {
    beforeEach(() => {
      WidgetRegistry.registerWidget('registeredWidget', mockFactory);
    });

    it('should return null for unregistered widget type', () => {
      const result = WidgetRegistry.expandWidget('unknownWidget', 'test-id');
      expect(result).toBeNull();
      expect(mockFactory).not.toHaveBeenCalled();
    });

    it('should expand widget with minimal parameters', () => {
      const result = WidgetRegistry.expandWidget('registeredWidget', 'test-id');
      
      expect(result).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledWith('test-id', {}, {}, undefined, undefined, undefined);
    });

    it('should expand widget with all parameters', () => {
      const props = { customProp: 'value' };
      const layoutConfig = { offsetX: 10 };
      
      const result = WidgetRegistry.expandWidget(
        'registeredWidget', 
        'test-id', 
        props, 
        layoutConfig, 
        mockHass, 
        mockRequestUpdate, 
        mockGetShadowElement
      );
      
      expect(result).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledWith(
        'test-id', 
        props, 
        layoutConfig, 
        mockHass, 
        mockRequestUpdate, 
        mockGetShadowElement
      );
    });

    it('should handle factory returning multiple elements', () => {
      const element1 = new RectangleElement('element1');
      const element2 = new RectangleElement('element2');
      const multiElementFactory = vi.fn().mockReturnValue([element1, element2]);
      
      WidgetRegistry.registerWidget('multiWidget', multiElementFactory);
      
      const result = WidgetRegistry.expandWidget('multiWidget', 'test-id');
      expect(result).toEqual([element1, element2]);
      expect(multiElementFactory).toHaveBeenCalled();
    });

    it('should handle factory returning empty array', () => {
      const emptyFactory = vi.fn().mockReturnValue([]);
      WidgetRegistry.registerWidget('emptyWidget', emptyFactory);
      
      const result = WidgetRegistry.expandWidget('emptyWidget', 'test-id');
      expect(result).toEqual([]);
      expect(emptyFactory).toHaveBeenCalled();
    });

    it('should trim whitespace from widget type during expansion', () => {
      const result = WidgetRegistry.expandWidget('  registeredWidget  ', 'test-id');
      
      expect(result).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledWith('test-id', {}, {}, undefined, undefined, undefined);
    });

    it('should use case-insensitive lookup for expansion', () => {
      const resultLower = WidgetRegistry.expandWidget('registeredwidget', 'test-1');
      const resultMixed = WidgetRegistry.expandWidget('RegisteredWidget', 'test-2');
      const resultUpper = WidgetRegistry.expandWidget('REGISTEREDWIDGET', 'test-3');
      
      expect(resultLower).toEqual([mockElement]);
      expect(resultMixed).toEqual([mockElement]);
      expect(resultUpper).toEqual([mockElement]);
      expect(mockFactory).toHaveBeenCalledTimes(3);
    });
  });

  describe('WidgetFactory type compliance', () => {
    it('should accept factory with correct signature', () => {
      const validFactory: WidgetFactory = (id, props, layoutConfig, hass, callback, getShadow) => {
        return [new RectangleElement(id)];
      };
      
      expect(() => WidgetRegistry.registerWidget('validFactory', validFactory)).not.toThrow();
    });

    it('should work with factory using optional parameters', () => {
      const optionalParamFactory: WidgetFactory = (id) => {
        return [new RectangleElement(id)];
      };
      
      expect(() => WidgetRegistry.registerWidget('optionalFactory', optionalParamFactory)).not.toThrow();
      
      const result = WidgetRegistry.expandWidget('optionalFactory', 'test-id');
      expect(result).toHaveLength(1);
      expect(result![0]).toBeInstanceOf(RectangleElement);
    });
  });

  describe('integration scenarios', () => {
    it('should support widget factory that creates complex widget hierarchies', () => {
      const complexFactory: WidgetFactory = (id, props, layoutConfig) => {
        const container = new RectangleElement(`${id}_container`, props, layoutConfig);
        const child1 = new RectangleElement(`${id}_child1`);
        const child2 = new RectangleElement(`${id}_child2`);
        return [container, child1, child2];
      };
      
      WidgetRegistry.registerWidget('complexWidget', complexFactory);
      
      const result = WidgetRegistry.expandWidget('complexWidget', 'complex-test', { width: 100 }, { offsetX: 5 });
      
      expect(result).toHaveLength(3);
      expect(result![0].id).toBe('complex-test_container');
      expect(result![1].id).toBe('complex-test_child1');
      expect(result![2].id).toBe('complex-test_child2');
    });

    it('should handle widget factory that accesses all provided parameters', () => {
      const parameterAccessFactory: WidgetFactory = (id, props, layoutConfig, hass, callback, getShadow) => {
        const element = new RectangleElement(id, props, layoutConfig, hass, callback, getShadow);
        return [element];
      };
      
      WidgetRegistry.registerWidget('parameterWidget', parameterAccessFactory);
      
      const result = WidgetRegistry.expandWidget(
        'parameterWidget',
        'param-test',
        { fill: 'red' },
        { width: 50 },
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );
      
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe('param-test');
      expect(result![0].props).toEqual({ fill: 'red' });
      expect(result![0].layoutConfig).toEqual({ width: 50 });
      expect(result![0].hass).toBe(mockHass);
      expect(result![0].requestUpdateCallback).toBe(mockRequestUpdate);
    });
  });
}); 