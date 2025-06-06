import { ColorValue, DynamicColorConfig, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { AnimationContext, animationManager } from './animation';

// ============================================================================
// Core Color Types and Interfaces
// ============================================================================

export type ColorState = 'default' | 'hover' | 'active';

export interface ColorStateContext {
  isCurrentlyHovering?: boolean;
  isCurrentlyActive?: boolean;
}

export interface ComputedElementColors {
  fillColor: string;
  strokeColor: string;
  strokeWidth: string;
  textColor: string;
}

export interface ColorResolutionDefaults {
  fallbackFillColor?: string;
  fallbackStrokeColor?: string;
  fallbackStrokeWidth?: string;
  fallbackTextColor?: string;
}

// ============================================================================
// Unified Color Class
// ============================================================================

export class Color {
  private readonly _value: ColorValue;
  private readonly _fallback: string;
  
  constructor(value: ColorValue, fallback: string = 'transparent') {
    this._value = value;
    this._fallback = fallback;
  }

  static from(value: ColorValue, fallback?: string): Color {
    return new Color(value, fallback || 'transparent');
  }

  static withFallback(value: ColorValue, fallback: string): Color {
    return new Color(value, fallback);
  }

  resolve(
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext
  ): string {
    // Handle stateful colors (hover/active states)
    if (isStatefulColorConfig(this._value)) {
      const selectedColorValue = this._resolveStateBasedColorValue(this._value, stateContext);
      
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
        return resolved || this._getStaticFallbackColor();
      } else {
        // Basic resolution without animation
        const resolved = animationManager.resolveDynamicColor(
          elementId || 'fallback',
          this._value,
          animationContext?.hass
        );
        return resolved || this._getStaticFallbackColor();
      }
    }

    // Handle static colors
    return this._formatStaticColorValue(this._value) || this._fallback;
  }

  get value(): ColorValue {
    return this._value;
  }

  get fallback(): string {
    return this._fallback;
  }

  get hasInteractiveStates(): boolean {
    return isStatefulColorConfig(this._value);
  }

  get isDynamic(): boolean {
    return isDynamicColorConfig(this._value);
  }

  get isStatic(): boolean {
    return !this.isDynamic && !this.hasInteractiveStates;
  }

  toStaticString(): string {
    if (this.isStatic) {
      return this._formatStaticColorValue(this._value) || this._fallback;
    }
    
    // For non-static colors, return the best available fallback
    return this._getStaticFallbackColor();
  }

  withFallback(newFallback: string): Color {
    return new Color(this._value, newFallback);
  }

  toString(): string {
    return this.toStaticString();
  }

  static fromValue(value: ColorValue | undefined, fallback: string = 'transparent'): Color {
    if (value === undefined || value === null) {
      return new Color(fallback, fallback);
    }
    return new Color(value, fallback);
  }

  /**
   * Formats a raw color value to a CSS string without resolution logic.
   * This is specifically for the animation manager when processing individual color values from mappings.
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

  // ============================================================================
  // Private Implementation
  // ============================================================================

  private _resolveStateBasedColorValue(
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

  private _formatStaticColorValue(color: ColorValue): string | undefined {
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

  private _getStaticFallbackColor(): string {
    // Try to extract a static color from complex configurations
    if (isDynamicColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColorValue(this._value.default);
      if (defaultColor) return defaultColor;
    }
    
    if (isStatefulColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColorValue(this._value.default);
      if (defaultColor) return defaultColor;
    }
    
    return this._fallback;
  }
} 