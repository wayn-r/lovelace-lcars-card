import { LayoutElementProps } from '../layout/engine';
import { ColorValue } from '../types';
import { AnimationContext } from './animation.js';
import { Color, ColorStateContext } from './color.js';

/**
 * Computed color values for an element after resolution
 */
export interface ComputedElementColors {
  fillColor: string;
  strokeColor: string;
  strokeWidth: string;
  textColor: string;
}

/**
 * Default color fallbacks for color resolution
 */
export interface ColorResolutionDefaults {
  fallbackFillColor?: string;
  fallbackStrokeColor?: string;
  fallbackStrokeWidth?: string;
  fallbackTextColor?: string;
}

/**
 * Interactive state context for determining hover/active colors
 * @deprecated Use ColorStateContext from color.ts instead
 */
export interface InteractiveStateContext extends ColorStateContext {}

/**
 * Simplified color resolution service using the unified Color class
 */
export class ColorResolver {
  /**
   * Resolve all color properties for an element with full animation and state support
   */
  resolveAllElementColors(
    elementId: string,
    elementProps: LayoutElementProps,
    animationContext: AnimationContext,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const {
      fallbackFillColor = 'none',
      fallbackStrokeColor = 'none',
      fallbackStrokeWidth = '0',
      fallbackTextColor = 'currentColor'
    } = colorDefaults;

    // Create Color instances for each property
    const fillColor = elementProps.fill !== undefined 
      ? Color.withFallback(elementProps.fill, fallbackFillColor)
      : Color.from(fallbackFillColor);
      
    const strokeColor = elementProps.stroke !== undefined
      ? Color.withFallback(elementProps.stroke, fallbackStrokeColor) 
      : Color.from(fallbackStrokeColor);
      
    const textColor = elementProps.textColor !== undefined
      ? Color.withFallback(elementProps.textColor, fallbackTextColor)
      : Color.from(fallbackTextColor);

    // Resolve all colors with context
    return {
      fillColor: fillColor.resolve(elementId, 'fill', animationContext, interactiveState),
      strokeColor: strokeColor.resolve(elementId, 'stroke', animationContext, interactiveState),
      strokeWidth: elementProps.strokeWidth?.toString() ?? fallbackStrokeWidth,
      textColor: textColor.resolve(elementId, 'textColor', animationContext, interactiveState)
    };
  }

  /**
   * Create a new props object with resolved colors for button-like elements
   * This handles the common pattern where interactive elements need computed colors
   */
  createButtonPropsWithResolvedColors(
    elementId: string,
    originalElementProps: LayoutElementProps,
    animationContext: AnimationContext,
    interactiveState: ColorStateContext = {}
  ): LayoutElementProps {
    const computedColors = this.resolveAllElementColors(elementId, originalElementProps, animationContext, {
      fallbackTextColor: 'white' // Default text color for interactive elements
    }, interactiveState);
    
    const propsWithResolvedColors = { ...originalElementProps };

    // Only override colors that were actually defined in the original props (not defaults)
    if (originalElementProps.fill !== undefined) {
      propsWithResolvedColors.fill = computedColors.fillColor;
    }
    
    if (originalElementProps.stroke !== undefined) {
      propsWithResolvedColors.stroke = computedColors.strokeColor;
    }

    if (originalElementProps.textColor !== undefined) {
      propsWithResolvedColors.textColor = computedColors.textColor;
    }

    return propsWithResolvedColors;
  }

  /**
   * Simplified color resolution without animation context for basic scenarios
   * This can be used when animation support isn't available or needed
   */
  resolveColorsWithoutAnimationContext(
    elementId: string,
    elementProps: LayoutElementProps,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const basicAnimationContext: AnimationContext = {
      elementId,
      getShadowElement: undefined,
      hass: undefined,
      requestUpdateCallback: undefined
    };

    return this.resolveAllElementColors(elementId, elementProps, basicAnimationContext, colorDefaults, interactiveState);
  }

  /**
   * Resolve a single color value using the Color class
   */
  resolveColor(
    colorValue: ColorValue,
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext,
    fallback: string = 'transparent'
  ): string {
    const color = Color.withFallback(colorValue, fallback);
    return color.resolve(elementId, animationProperty, animationContext, stateContext);
  }
}

// Export a singleton instance for convenient access across the application
export const colorResolver = new ColorResolver(); 