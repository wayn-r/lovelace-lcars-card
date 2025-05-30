/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { Color } from '../color';
import { DynamicColorConfig, StatefulColorConfig } from '../../types';

describe('Color', () => {
  describe('static color handling', () => {
    it('handles string colors', () => {
      const color = Color.from('#ff0000');
      expect(color.toStaticString()).toBe('#ff0000');
      expect(color.isStatic).toBe(true);
      expect(color.isDynamic).toBe(false);
      expect(color.hasInteractiveStates).toBe(false);
    });

    it('handles RGB array colors', () => {
      const color = Color.from([255, 0, 0]);
      expect(color.toStaticString()).toBe('rgb(255,0,0)');
      expect(color.isStatic).toBe(true);
    });

    it('handles invalid static colors with fallback', () => {
      const color = Color.withFallback(123 as any, 'red');
      expect(color.toStaticString()).toBe('red');
    });

    it('trims whitespace from string colors', () => {
      const color = Color.from('  #ff0000  ');
      expect(color.toStaticString()).toBe('#ff0000');
    });
  });

  describe('stateful color handling', () => {
    const statefulConfig: StatefulColorConfig = {
      default: '#blue',
      hover: '#lightblue',
      active: '#darkblue'
    };

    it('identifies stateful colors', () => {
      const color = Color.from(statefulConfig);
      expect(color.hasInteractiveStates).toBe(true);
      expect(color.isStatic).toBe(false);
      expect(color.isDynamic).toBe(false);
    });

    it('resolves default state', () => {
      const color = Color.from(statefulConfig);
      const resolved = color.resolve('test-element', 'fill', undefined, {});
      expect(resolved).toBe('#blue');
    });

    it('resolves hover state', () => {
      const color = Color.from(statefulConfig);
      const resolved = color.resolve('test-element', 'fill', undefined, {
        isCurrentlyHovering: true
      });
      expect(resolved).toBe('#lightblue');
    });

    it('resolves active state (priority over hover)', () => {
      const color = Color.from(statefulConfig);
      const resolved = color.resolve('test-element', 'fill', undefined, {
        isCurrentlyHovering: true,
        isCurrentlyActive: true
      });
      expect(resolved).toBe('#darkblue');
    });

    it('handles nested color configurations', () => {
      const nestedConfig: StatefulColorConfig = {
        default: [255, 0, 0],
        hover: '#green'
      };
      
      const color = Color.from(nestedConfig);
      expect(color.resolve('test', 'fill', undefined, {})).toBe('rgb(255,0,0)');
      expect(color.resolve('test', 'fill', undefined, { isCurrentlyHovering: true })).toBe('#green');
    });
  });

  describe('dynamic color handling', () => {
    const dynamicConfig: DynamicColorConfig = {
      entity: 'sensor.temperature',
      mapping: {
        'hot': '#ff0000',
        'cold': '#0000ff'
      },
      default: '#gray'
    };

    it('identifies dynamic colors', () => {
      const color = Color.from(dynamicConfig);
      expect(color.isDynamic).toBe(true);
      expect(color.isStatic).toBe(false);
      expect(color.hasInteractiveStates).toBe(false);
    });

    it('returns static fallback for dynamic colors without context', () => {
      const color = Color.from(dynamicConfig);
      expect(color.toStaticString()).toBe('#gray');
    });
  });

  describe('fromValue factory method', () => {
    it('handles undefined values', () => {
      const color = Color.fromValue(undefined, 'red');
      expect(color.toStaticString()).toBe('red');
    });

    it('handles null values', () => {
      const color = Color.fromValue(null as any, 'blue');
      expect(color.toStaticString()).toBe('blue');
    });

    it('handles valid values', () => {
      const color = Color.fromValue('#green');
      expect(color.toStaticString()).toBe('#green');
    });
  });

  describe('withFallback method', () => {
    it('creates color with specific fallback', () => {
      const color = Color.withFallback('#primary', 'defaultColor');
      expect(color.fallback).toBe('defaultColor');
      expect(color.toStaticString()).toBe('#primary');
    });

    it('returns fallback for invalid static colors', () => {
      const color = Color.withFallback(null as any, 'fallbackColor');
      expect(color.toStaticString()).toBe('fallbackColor');
    });
  });

  describe('utility methods', () => {
    it('toString returns static string', () => {
      const color = Color.from('#test');
      expect(color.toString()).toBe('#test');
    });

    it('withFallback creates new instance', () => {
      const original = Color.from('#test');
      const withNewFallback = original.withFallback('newFallback');
      
      expect(original.fallback).toBe('transparent');
      expect(withNewFallback.fallback).toBe('newFallback');
      expect(original).not.toBe(withNewFallback);
    });
  });
}); 