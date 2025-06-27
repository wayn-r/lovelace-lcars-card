import { ColorValue, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { AnimationContext } from './animation';
import { colorResolver } from './color-resolver';

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

  static fromValue(value: ColorValue | undefined, fallback: string = 'transparent'): Color {
    if (value === undefined || value === null) {
      return new Color(fallback, fallback);
    }
    return new Color(value, fallback);
  }

  resolve(
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext
  ): string {
    if (isStatefulColorConfig(this._value)) {
      const selectedColorValue = this._resolveStateBasedColorValue(this._value, stateContext);
      
      if (selectedColorValue !== undefined) {
        const stateColor = new Color(selectedColorValue, this._fallback);
        return stateColor.resolve(elementId, animationProperty, animationContext, stateContext);
      }
      
      return this._fallback;
    }

    if (isDynamicColorConfig(this._value)) {
      if (elementId && animationProperty && animationContext) {
        const resolved = colorResolver.resolveColor(
          this._value,
          elementId,
          animationProperty,
          animationContext,
          undefined,
          'transparent'
        );
        return resolved || this._getStaticFallbackColor();
      } else {
        const resolved = colorResolver.resolveColor(
          this._value,
          elementId || 'fallback',
          undefined,
          animationContext,
          undefined,
          'transparent'
        );
        return resolved || this._getStaticFallbackColor();
      }
    }

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
    
    return this._getStaticFallbackColor();
  }

  withFallback(newFallback: string): Color {
    return new Color(this._value, newFallback);
  }

  toString(): string {
    return this.toStaticString();
  }

  private _resolveStateBasedColorValue(
    statefulConfig: StatefulColorConfig,
    stateContext?: ColorStateContext
  ): ColorValue | undefined {
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