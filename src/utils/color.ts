import { ColorValue, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { AnimationContext } from './animation';
import { colorResolver, ColorResolver } from './color-resolver';
import { stateManager } from './state-manager';

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
        return (resolved ?? '') || this._getStaticFallbackColor(elementId ? animationContext?.getShadowElement?.(elementId) || undefined : undefined);
      } else {
        const resolved = colorResolver.resolveColor(
          this._value,
          elementId || 'fallback',
          undefined,
          animationContext,
          undefined,
          'transparent'
        );
        return (resolved ?? '') || this._getStaticFallbackColor(elementId ? animationContext?.getShadowElement?.(elementId) || undefined : undefined);
      }
    }

    return this._formatStaticColorValue(this._value, elementId ? animationContext?.getShadowElement?.(elementId) || undefined : undefined) || this._fallback;
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

  toStaticString(element: Element): string {
    if (this.isStatic) {
      return this._formatStaticColorValue(this._value, element) || this._fallback;
    }
    
    return this._getStaticFallbackColor(element);
  }

  withFallback(newFallback: string): Color {
    return new Color(this._value, newFallback);
  }

  toString(): string {
    if (typeof this._value === 'string') {
      return this._value;
    } else if (Array.isArray(this._value) && this._value.length === 3 && this._value.every(component => typeof component === 'number')) {
      return `rgb(${this._value[0]},${this._value[1]},${this._value[2]})`;
    }
    return this._fallback;
  }

  private _resolveStateBasedColorValue(
    statefulConfig: StatefulColorConfig,
    stateContext?: ColorStateContext
  ): ColorValue | undefined {
    if (stateContext?.isCurrentlyActive && statefulConfig.active !== undefined) {
      return statefulConfig.active;
    }

    if (statefulConfig.state_name && statefulConfig.state_map) {
        const currentState = stateManager.getState(statefulConfig.state_name);
        const colorStateKey = currentState ? statefulConfig.state_map[currentState] : undefined;

        if (colorStateKey) {
            // Type-safe access to dynamic properties by casting to Record<string, any>
            const configAsRecord = statefulConfig as Record<string, any>;
            const hoverKey = `${colorStateKey}_hover`;
            
            if (stateContext?.isCurrentlyHovering && configAsRecord[hoverKey] !== undefined) {
                return configAsRecord[hoverKey];
            }
            if (configAsRecord[colorStateKey] !== undefined) {
                return configAsRecord[colorStateKey];
            }
        }
    }
    
    if (stateContext?.isCurrentlyHovering && statefulConfig.hover !== undefined) {
      return statefulConfig.hover;
    }
    
    return statefulConfig.default;
  }

  private _formatStaticColorValue(color: ColorValue, element?: Element): string {
    if (typeof color === 'string' && color.trim().length > 0) {
        const trimmedColor = color.trim();

        const lightenMatch = trimmedColor.match(/^lighten\((.+),\s*(\d+%?)\)$/);
        if (lightenMatch && element) {
            const baseColor = this._formatStaticColorValue(lightenMatch[1], element);
            const percent = parseFloat(lightenMatch[2]);
            if (ColorResolver.isColor(baseColor)) {
                const resolvedBaseColor = ColorResolver.resolveCssVariable(baseColor, element);
                return ColorResolver.calculateLightenColor(resolvedBaseColor, percent);
            }
        }

        const darkenMatch = trimmedColor.match(/^darken\((.+),\s*(\d+%?)\)$/);
        if (darkenMatch && element) {
            const baseColor = this._formatStaticColorValue(darkenMatch[1], element);
            const percent = parseFloat(darkenMatch[2]);
            if (ColorResolver.isColor(baseColor)) {
                const resolvedBaseColor = ColorResolver.resolveCssVariable(baseColor, element);
                return ColorResolver.calculateDarkenColor(resolvedBaseColor, percent);
            }
        }
        
        return trimmedColor; // Ensure a string is always returned if it's a string color
    }
    
    if (Array.isArray(color) && 
        color.length === 3 && 
        color.every(component => typeof component === 'number')) {
      return `rgb(${color[0]},${color[1]},${color[2]})`;
    }
    
    return this._fallback; // Final fallback to ensure string return
  }

  private _getStaticFallbackColor(element?: Element): string {
    if (isDynamicColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColorValue(this._value.default, element);
      return defaultColor; 
    }
    
    if (isStatefulColorConfig(this._value) && this._value.default !== undefined) {
      const defaultColor = this._formatStaticColorValue(this._value.default, element);
      return defaultColor; 
    }
    
    return this._fallback;
  }
} 