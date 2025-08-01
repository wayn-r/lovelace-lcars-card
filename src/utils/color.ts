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
      return this._resolveStatefulColor(elementId, animationProperty, animationContext, stateContext);
    }

    if (isDynamicColorConfig(this._value)) {
      return this._resolveDynamicColor(elementId, animationProperty, animationContext);
    }

    const shadowElement = this._getShadowElement(elementId, animationContext);
    return this._formatStaticColorValue(this._value, shadowElement) || this._fallback;
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
    if (this._shouldUseActiveState(statefulConfig, stateContext)) {
      return statefulConfig.active;
    }

    const stateMapColor = this._resolveFromStateMap(statefulConfig, stateContext);
    if (stateMapColor !== undefined) {
      return stateMapColor;
    }
    
    if (this._shouldUseHoverState(statefulConfig, stateContext)) {
      return statefulConfig.hover;
    }
    
    return statefulConfig.default;
  }

  private _formatStaticColorValue(color: ColorValue, element?: Element): string {
    if (typeof color === 'string' && color.trim().length > 0) {
      const trimmedColor = color.trim();
      
      const processedColor = this._processColorFunctions(trimmedColor, element) ||
                           this._processCssVariables(trimmedColor, element) ||
                           trimmedColor;
      
      return processedColor;
    }
    
    if (this._isRgbArray(color)) {
      return `rgb(${color[0]},${color[1]},${color[2]})`;
    }
    
    return this._fallback;
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

  private _resolveStatefulColor(
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext
  ): string {
    const selectedColorValue = this._resolveStateBasedColorValue(this._value as StatefulColorConfig, stateContext);
    
    if (selectedColorValue !== undefined) {
      const stateColor = new Color(selectedColorValue, this._fallback);
      return stateColor.resolve(elementId, animationProperty, animationContext, stateContext);
    }
    
    return this._fallback;
  }

  private _resolveDynamicColor(
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext
  ): string {
    const hasCompleteContext = elementId && animationProperty && animationContext;
    const fallbackElementId = elementId || 'fallback';
    
    const resolved = colorResolver.resolveColor(
      this._value,
      hasCompleteContext ? elementId : fallbackElementId,
      hasCompleteContext ? animationProperty : undefined,
      animationContext,
      undefined,
      'transparent'
    );
    
    const shadowElement = this._getShadowElement(elementId, animationContext);
    return resolved || this._getStaticFallbackColor(shadowElement);
  }

  private _getShadowElement(elementId?: string, animationContext?: AnimationContext): Element | undefined {
    return elementId ? animationContext?.getShadowElement?.(elementId) || undefined : undefined;
  }

  private _shouldUseActiveState(config: StatefulColorConfig, stateContext?: ColorStateContext): boolean {
    return !!(stateContext?.isCurrentlyActive && config.active !== undefined);
  }

  private _shouldUseHoverState(config: StatefulColorConfig, stateContext?: ColorStateContext): boolean {
    return !!(stateContext?.isCurrentlyHovering && config.hover !== undefined);
  }

  private _resolveFromStateMap(config: StatefulColorConfig, stateContext?: ColorStateContext): ColorValue | undefined {
    if (!config.state_name || !config.state_map) {
      return undefined;
    }

    const currentState = stateManager.getState(config.state_name);
    const colorStateKey = currentState ? config.state_map[currentState] : undefined;

    if (colorStateKey) {
      const configAsRecord = config as Record<string, any>;
      const hoverKey = `${colorStateKey}_hover`;
      
      if (stateContext?.isCurrentlyHovering && configAsRecord[hoverKey] !== undefined) {
        return configAsRecord[hoverKey];
      }
      
      if (configAsRecord[colorStateKey] !== undefined) {
        return configAsRecord[colorStateKey];
      }
    }

    return undefined;
  }

  private _processColorFunctions(color: string, element?: Element): string | null {
    const lightenMatch = color.match(/^lighten\((.+),\s*(\d+%?)\)$/);
    if (lightenMatch) {
      return this._processLightenFunction(lightenMatch[1], lightenMatch[2], element);
    }

    const darkenMatch = color.match(/^darken\((.+),\s*(\d+%?)\)$/);
    if (darkenMatch) {
      return this._processDarkenFunction(darkenMatch[1], darkenMatch[2], element);
    }

    return null;
  }

  private _processLightenFunction(baseColorStr: string, percentStr: string, element?: Element): string | null {
    const baseColor = this._formatStaticColorValue(baseColorStr, element);
    const percent = parseFloat(percentStr);
    
    if (ColorResolver.isColor(baseColor)) {
      const resolvedBaseColor = ColorResolver.resolveCssVariable(baseColor, element);
      return ColorResolver.calculateLightenedColor(resolvedBaseColor, percent);
    }
    
    return null;
  }

  private _processDarkenFunction(baseColorStr: string, percentStr: string, element?: Element): string | null {
    const baseColor = this._formatStaticColorValue(baseColorStr, element);
    const percent = parseFloat(percentStr);
    
    if (ColorResolver.isColor(baseColor)) {
      const resolvedBaseColor = ColorResolver.resolveCssVariable(baseColor, element);
      return ColorResolver.calculateDarkenedColor(resolvedBaseColor, percent);
    }
    
    return null;
  }

  private _processCssVariables(color: string, element?: Element): string | null {
    if (color.startsWith('var(')) {
      return ColorResolver.resolveCssVariable(color, element);
    }
    return null;
  }

  private _isRgbArray(color: ColorValue): color is [number, number, number] {
    return Array.isArray(color) && 
           color.length === 3 && 
           color.every(component => typeof component === 'number');
  }
} 