/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Color } from '../color';
import { ColorResolver } from '../color-resolver';
import { DynamicColorConfig, StatefulColorConfig } from '../../types';
import { EMBEDDED_THEME_YAML } from '../embedded-theme';

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

  // ============================================================================
  // Color Class Integration Tests (from comprehensive-fallback.spec.ts)
  // ============================================================================

  describe('Color Class Integration with Fallback System', () => {
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

    describe('Entity Text Widget Colors', () => {
      it('should resolve entity text colors through Color class', () => {
        const color = new Color('var(--lcars-color-entity-text)', 'transparent');
        const resolved = color.resolve(); // No element provided, should use fallback
        expect(resolved).toBe('#5ca8ea');
      });

      it('should resolve white text colors through Color class', () => {
        const color = new Color('var(--lcars-color-white)', 'transparent');
        const resolved = color.resolve();
        expect(resolved).toBe('#FFFFFF');
      });
    });

    describe('Color Function Processing', () => {
      it('should resolve CSS variables in lighten() functions', () => {
        const color = new Color('lighten(var(--lcars-color-blue), 20)', 'transparent');
        const resolved = color.resolve(undefined, undefined, undefined, undefined);
        // Should resolve the variable first, then apply lighten
        expect(resolved).not.toBe('lighten(var(--lcars-color-blue), 20)');
        expect(resolved).toMatch(/^#[0-9a-fA-F]{6}$/); // Should be a hex color
      });

      it('should resolve CSS variables in darken() functions', () => {
        const color = new Color('darken(var(--lcars-color-cyan), 30)', 'transparent');
        const resolved = color.resolve(undefined, undefined, undefined, undefined);
        // Should resolve the variable first, then apply darken
        expect(resolved).not.toBe('darken(var(--lcars-color-cyan), 30)');
        expect(resolved).toMatch(/^#[0-9a-fA-F]{6}$/); // Should be a hex color
      });
    });

    describe('CSS Variable Resolution in Color Class', () => {
      it('should handle CSS variables with fallback when element is null', () => {
        const color = new Color('var(--lcars-color-blue)', 'transparent');
        const resolved = color.resolve(null);
        expect(resolved).toBe('#5ca8ea');
      });

      it('should handle CSS variables with fallback when element is undefined', () => {
        const color = new Color('var(--lcars-color-cyan)', 'red');
        const resolved = color.resolve();
        expect(resolved).toBe('#04bfd8');
      });

      it('should use fallback for unknown CSS variables', () => {
        const color = new Color('var(--unknown-variable)', 'fallback-color');
        const resolved = color.resolve();
        // CSS variable resolution returns original string when not found, then Color class uses fallback
        expect(resolved).toBe('var(--unknown-variable)');
      });

      it('should resolve nested CSS variables through Color class', () => {
        // Test with a variable that references another variable
        const color = new Color('var(--lcars-color-logger-bright)', 'transparent');
        const resolved = color.resolve();
        expect(resolved).toBe('#86c8ff'); // Should resolve to light-sky-blue as per embedded theme
      });
    });

    describe('Color class with stateful configurations and CSS variables', () => {
      it('should resolve CSS variables in stateful configurations', () => {
        const statefulConfig: StatefulColorConfig = {
          default: 'var(--lcars-color-blue)',
          hover: 'var(--lcars-color-cyan)',
          active: '#ff0000'
        };

        const color = Color.from(statefulConfig);
        
        // Test default state
        expect(color.resolve('test', 'fill', undefined, {})).toBe('#5ca8ea');
        
        // Test hover state
        expect(color.resolve('test', 'fill', undefined, { isCurrentlyHovering: true })).toBe('#04bfd8');
        
        // Test active state (should not use CSS variable resolution)
        expect(color.resolve('test', 'fill', undefined, { isCurrentlyActive: true })).toBe('#ff0000');
      });

      it('should handle CSS variables in RGB array format', () => {
        // This tests fallback when CSS variable resolution fails in array context
        const color = new Color('var(--lcars-color-environmental-button-1)', 'transparent');
        const resolved = color.resolve();
        expect(resolved).toBe('#3ad8e6');
      });
    });
  });
}); 