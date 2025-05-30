import { ColorValue, DynamicColorConfig, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { AnimationContext, animationManager } from './animation';

/**
 * State types for interactive color resolution
 */
export type ColorState = 'default' | 'hover' | 'active';

/**
 * Interactive state context for determining which color to use
 */
export interface ColorStateContext {
  isCurrentlyHovering?: boolean;
  isCurrentlyActive?: boolean;
}

/**
 * Unified Color class that handles all color formats and resolution logic
 */
export class Color {
  private readonly _value: ColorValue;
  private readonly _fallback: string;
  
  constructor(value: ColorValue, fallback: string = 'transparent') {
    this._value = value;
    this._fallback = fallback;
  }

  /**
   * Create a Color instance from any valid color value
   */
  static from(value: ColorValue, fallback?: string): Color {
    return new Color(value, fallback || 'transparent');
  }

  /**
   * Create a Color instance with a specific fallback
   */
  static withFallback(value: ColorValue, fallback: string): Color {
    return new Color(value, fallback);
  }

  /**
   * Resolve the color to a CSS-compatible string for the current state
   */
  resolve(
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext
  ): string {
    // Handle stateful colors (hover/active states)
    if (isStatefulColorConfig(this._value)) {
      const selectedColorValue = this._getStateBasedColorValue(this._value, stateContext);
      
      if (selectedColorValue !== undefined) {
        // Recursively resolve the selected color value
        const stateColor = new Color(selectedColorValue, this._fallback);
        return stateColor.resolve(elementId, animationProperty, animationContext);
      }
      
      return this._fallback;
    }

    // Handle dynamic colors (entity-based)
    if (isDynamicColorConfig(this._value)) {
      if (elementId && animationProperty && animationContext) {
        const resolved = animationManager.resolveDynamicColorWithAnimation(
          elementId,
          this._value,
          animationProperty,
          animationContext
        );
        return resolved || this._getStaticFallback();
      } else {
        // Basic resolution without animation
        const resolved = animationManager.resolveDynamicColor(
          elementId || 'fallback',
          this._value,
          animationContext?.hass
        );
        return resolved || this._getStaticFallback();
      }
    }

    // Handle static colors
    return this._formatStaticColor(this._value) || this._fallback;
  }

  /**
   * Get the raw color value (for backwards compatibility)
   */
  get value(): ColorValue {
    return this._value;
  }

  /**
   * Get the fallback color
   */
  get fallback(): string {
    return this._fallback;
  }

  /**
   * Check if this color has interactive states (hover/active)
   */
  get hasInteractiveStates(): boolean {
    return isStatefulColorConfig(this._value);
  }

  /**
   * Check if this color is dynamic (entity-based)
   */
  get isDynamic(): boolean {
    return isDynamicColorConfig(this._value);
  }

  /**
   * Check if this color is static (string or RGB array)
   */
  get isStatic(): boolean {
    return !this.isDynamic && !this.hasInteractiveStates;
  }

  /**
   * Get a resolved color string without any animation or state context
   */
  toStaticString(): string {
    if (this.isStatic) {
      return this._formatStaticColor(this._value) || this._fallback;
    }
    
    // For non-static colors, return the best available fallback
    return this._getStaticFallback();
  }

  /**
   * Create a copy of this color with a different fallback
   */
  withFallback(newFallback: string): Color {
    return new Color(this._value, newFallback);
  }

  /**
   * Convert this Color to a string representation
   */
  toString(): string {
    return this.toStaticString();
  }

  /**
   * Create a Color instance from an existing ColorValue with validation
   */
  static fromValue(value: ColorValue | undefined, fallback: string = 'transparent'): Color {
    if (value === undefined || value === null) {
      return new Color(fallback, fallback);
    }
    return new Color(value, fallback);
  }

  /**
   * Format a raw color value to a CSS string without resolution logic
   * This is specifically for the animation manager when processing individual color values from mappings
   */
  static formatValue(value: ColorValue | undefined): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    
    if (Array.isArray(value) && 
        value.length === 3 && 
        value.every(component => typeof component === 'number')) {
      return `rgb(${value[0]},${value[1]},${value[2]})`;
    }
    
    return undefined;
  }

  /**
   * Get the appropriate color value based on current interactive state
   */
  private _getStateBasedColorValue(
    statefulConfig: StatefulColorConfig,
    stateContext?: ColorStateContext
  ): ColorValue | undefined {
    // Priority: active > hover > default
    if (stateContext?.isCurrentlyActive && statefulConfig.active !== undefined) {
      return statefulConfig.active;
    }
    
    if (stateContext?.isCurrentlyHovering && statefulConfig.hover !== undefined) {
      return statefulConfig.hover;
    }
    
    return statefulConfig.default;
  }

  /**
   * Format static color values (strings and RGB arrays) to CSS strings
   */
  private _formatStaticColor(color: ColorValue): string | undefined {
    if (typeof color === 'string' && color.trim().length > 0) {
      return color.trim();
    }
    
    if (Array.isArray(color) && 
        color.length === 3 && 
        color.every(component => typeof component === 'number')) {
      return `rgb(${color[0]},${color[1]},${color[2]})`;
    }
    
    return undefined;
  }

  /**
   * Get a static fallback color for complex color configurations
   */
  private _getStaticFallback(): string {
    // Try to extract a static color from complex configurations
    if (isDynamicColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColor(this._value.default);
      if (defaultColor) return defaultColor;
    }
    
    if (isStatefulColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColor(this._value.default);
      if (defaultColor) return defaultColor;
    }
    
    return this._fallback;
  }
} 