import { LayoutElementProps } from '../layout/engine';
import { ColorValue, isStatefulColorConfig } from '../types';
import { animationManager, AnimationContext } from './animation.js';

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
 */
export interface InteractiveStateContext {
  isCurrentlyHovering?: boolean;
  isCurrentlyActive?: boolean;
}

/**
 * Centralized color resolution service that handles entity-state-based colors,
 * interactive states (hover/active), and coordinates with animation transitions
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
    interactiveState: InteractiveStateContext = {}
  ): ComputedElementColors {
    const {
      fallbackFillColor = 'none',
      fallbackStrokeColor = 'none',
      fallbackStrokeWidth = '0',
      fallbackTextColor = 'currentColor'
    } = colorDefaults;

    // Resolve fill color with animation and interactive state support
    let computedFillColor = fallbackFillColor;
    if (elementProps.fill !== undefined) {
      const resolvedFillValue = this.resolveColorValueWithInteractiveStates(
        elementId,
        elementProps.fill,
        'fill',
        animationContext,
        interactiveState
      );
      computedFillColor = resolvedFillValue || elementProps.fill.toString();
    }

    // Resolve stroke color with animation and interactive state support
    let computedStrokeColor = fallbackStrokeColor;
    if (elementProps.stroke !== undefined) {
      const resolvedStrokeValue = this.resolveColorValueWithInteractiveStates(
        elementId,
        elementProps.stroke,
        'stroke',
        animationContext,
        interactiveState
      );
      computedStrokeColor = resolvedStrokeValue || elementProps.stroke.toString();
    }

    // Resolve text color with interactive state support
    let computedTextColor = fallbackTextColor;
    if (elementProps.text_color !== undefined) {
      const resolvedTextColorValue = this.resolveColorValueWithInteractiveStates(
        elementId,
        elementProps.text_color,
        'fill', // Text color uses fill internally for animation purposes
        animationContext,
        interactiveState
      );
      computedTextColor = resolvedTextColorValue || elementProps.text_color.toString();
    }

    // Resolve stroke width
    const computedStrokeWidth = elementProps.strokeWidth?.toString() ?? fallbackStrokeWidth;

    return {
      fillColor: computedFillColor,
      strokeColor: computedStrokeColor,
      strokeWidth: computedStrokeWidth,
      textColor: computedTextColor
    };
  }

  /**
   * Resolve a color value considering interactive states (hover/active) and animation
   */
  private resolveColorValueWithInteractiveStates(
    elementId: string,
    colorConfiguration: ColorValue,
    animationProperty: 'fill' | 'stroke',
    animationContext: AnimationContext,
    interactiveState: InteractiveStateContext
  ): string | undefined {
    // Check if this is a stateful color configuration with hover/active states
    if (isStatefulColorConfig(colorConfiguration)) {
      // Determine which color to use based on state priority: active > hover > default
      let selectedColorValue = colorConfiguration.default;
      
      if (interactiveState.isCurrentlyActive && colorConfiguration.active !== undefined) {
        selectedColorValue = colorConfiguration.active;
      } else if (interactiveState.isCurrentlyHovering && colorConfiguration.hover !== undefined) {
        selectedColorValue = colorConfiguration.hover;
      }
      
      // If we have a selected color value, resolve it (which may be dynamic or static)
      if (selectedColorValue !== undefined) {
        return animationManager.resolveDynamicColorWithAnimation(
          elementId,
          selectedColorValue,
          animationProperty,
          animationContext
        );
      }
      
      return undefined;
    }
    
    // For non-stateful colors, use existing resolution logic
    return animationManager.resolveDynamicColorWithAnimation(
      elementId,
      colorConfiguration,
      animationProperty,
      animationContext
    );
  }

  /**
   * Create a new props object with resolved colors for button-like elements
   * This handles the common pattern where interactive elements need computed colors
   */
  createButtonPropsWithResolvedColors(
    elementId: string,
    originalElementProps: LayoutElementProps,
    animationContext: AnimationContext,
    interactiveState: InteractiveStateContext = {}
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

    if (originalElementProps.text_color !== undefined) {
      propsWithResolvedColors.text_color = computedColors.textColor;
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
    interactiveState: InteractiveStateContext = {}
  ): ComputedElementColors {
    const basicAnimationContext: AnimationContext = {
      elementId,
      getShadowElement: undefined,
      hass: undefined,
      requestUpdateCallback: undefined
    };

    return this.resolveAllElementColors(elementId, elementProps, basicAnimationContext, colorDefaults, interactiveState);
  }
}

// Export a singleton instance for convenient access across the application
export const colorResolver = new ColorResolver(); 