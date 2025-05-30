import { HomeAssistant } from 'custom-card-helpers';
import { gsap } from 'gsap';
import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';
import { Color } from './color.js';

/**
 * Animation state tracking for managing ongoing color transitions
 */
export interface ColorAnimationState {
  isAnimatingFillColor: boolean;
  isAnimatingStrokeColor: boolean;
  isAnimatingTextColor: boolean;
  currentVisibleFillColor?: string;
  currentVisibleStrokeColor?: string;
  currentVisibleTextColor?: string;
  targetFillColor?: string;
  targetStrokeColor?: string;
  targetTextColor?: string;
  fillAnimationCompleteCallback?: () => void;
  strokeAnimationCompleteCallback?: () => void;
  textColorAnimationCompleteCallback?: () => void;
}

/**
 * Animation context containing element-specific data and callbacks
 */
export interface AnimationContext {
  elementId: string;
  getShadowElement?: (id: string) => Element | null;
  hass?: HomeAssistant;
  requestUpdateCallback?: () => void;
}

/**
 * Entity state monitoring data for tracking dynamic color dependencies
 */
export interface EntityStateMonitoringData {
  trackedEntityIds: Set<string>;
  lastKnownEntityStates: Map<string, any>;
}

/**
 * Animation manager responsible for coordinating all color transition animations
 * and entity state-based dynamic color updates
 */
export class AnimationManager {
  private elementAnimationStates = new Map<string, ColorAnimationState>();
  private entityStateMonitoring = new Map<string, EntityStateMonitoringData>();
  private dynamicColorCache = new Map<string, { fillColor?: string; strokeColor?: string }>();

  /**
   * Initialize animation state tracking for a new element
   */
  initializeElementAnimationTracking(elementId: string): void {
    if (!this.elementAnimationStates.has(elementId)) {
      this.elementAnimationStates.set(elementId, {
        isAnimatingFillColor: false,
        isAnimatingStrokeColor: false,
        isAnimatingTextColor: false
      });
    }

    if (!this.entityStateMonitoring.has(elementId)) {
      this.entityStateMonitoring.set(elementId, {
        trackedEntityIds: new Set<string>(),
        lastKnownEntityStates: new Map<string, any>()
      });
    }
  }

  /**
   * Clean up animation state and entity monitoring for removed elements
   */
  cleanupElementAnimationTracking(elementId: string): void {
    const animationState = this.elementAnimationStates.get(elementId);
    if (animationState) {
      // Execute any pending animation completion callbacks
      if (animationState.fillAnimationCompleteCallback) {
        animationState.fillAnimationCompleteCallback();
      }
      if (animationState.strokeAnimationCompleteCallback) {
        animationState.strokeAnimationCompleteCallback();
      }
      if (animationState.textColorAnimationCompleteCallback) {
        animationState.textColorAnimationCompleteCallback();
      }
    }

    this.elementAnimationStates.delete(elementId);
    this.entityStateMonitoring.delete(elementId);
    this.dynamicColorCache.delete(elementId);
  }

  /**
   * Invalidate the dynamic color cache completely
   * This is useful when switching views or when the context changes significantly
   */
  invalidateDynamicColorCache(): void {
    this.dynamicColorCache.clear();
  }

  /**
   * Force refresh of dynamic colors for all elements
   * This will clear caches and re-evaluate all dynamic color configurations
   */
  forceRefreshDynamicColors(animationContext: AnimationContext): void {
    // Clear the dynamic color cache to force re-evaluation
    this.invalidateDynamicColorCache();
    
    // Clear entity state monitoring to force fresh tracking
    this.entityStateMonitoring.clear();
    
    // Note: Individual elements will need to re-call resolveDynamicColorWithAnimation
    // to trigger the refresh. This method just clears the caches.
  }

  /**
   * Clear all caches and state for a complete reset
   * This is the most aggressive cleanup method
   */
  clearAllCaches(): void {
    this.dynamicColorCache.clear();
    this.entityStateMonitoring.clear();
    // Don't clear elementAnimationStates as ongoing animations should continue
  }

  /**
   * Get current animation state for an element
   */
  getElementAnimationState(elementId: string): ColorAnimationState | undefined {
    return this.elementAnimationStates.get(elementId);
  }

  /**
   * Resolve and animate dynamic colors with smooth transitions
   */
  resolveDynamicColorWithAnimation(
    elementId: string,
    colorConfiguration: ColorValue,
    animationProperty: 'fill' | 'stroke' | 'textColor',
    animationContext: AnimationContext
  ): string | undefined {
    // Always initialize element animation tracking
    this.initializeElementAnimationTracking(elementId);

    if (!isDynamicColorConfig(colorConfiguration)) {
      // For static colors, resolve and store the color
      const staticColor = this.resolveDynamicColor(elementId, colorConfiguration, animationContext.hass);
      
      // Set the target color in animation state for static colors too
      const animationState = this.elementAnimationStates.get(elementId);
      if (animationState && staticColor) {
        if (animationProperty === 'fill') {
          animationState.targetFillColor = staticColor;
        } else if (animationProperty === 'stroke') {
          animationState.targetStrokeColor = staticColor;
        } else if (animationProperty === 'textColor') {
          animationState.targetTextColor = staticColor;
        }
      }
      
      return staticColor;
    }

    const resolvedColor = this.extractDynamicColorFromEntityState(elementId, colorConfiguration, animationContext.hass);
    
    // Debug logging to trace invalid color values
    if (resolvedColor !== undefined && typeof resolvedColor !== 'string') {
      console.error(`[${elementId}] Non-string color resolved for ${animationProperty}:`, resolvedColor, typeof resolvedColor);
    }
    
    if (resolvedColor !== undefined && typeof resolvedColor === 'string' && !this.isValidColorForAnimation(resolvedColor)) {
      console.warn(`[${elementId}] Invalid color resolved for ${animationProperty}:`, resolvedColor);
    }

    // If resolution failed or returned invalid color, use property-specific fallback
    let finalColor = resolvedColor;
    if (!finalColor || !this.isValidColorForAnimation(finalColor)) {
      finalColor = this.getPropertySpecificFallbackColor(animationProperty);
      console.warn(`[${elementId}] Using fallback color for ${animationProperty}:`, finalColor);
    }

    // Ensure we have a valid color before proceeding
    if (!this.isValidColorForAnimation(finalColor)) {
      console.error(`[${elementId}] Even fallback color is invalid for ${animationProperty}:`, finalColor);
      // Last resort emergency fallback
      finalColor = '#FF0000';
    }

    // Always set the target color in animation state for tracking
    const animationState = this.elementAnimationStates.get(elementId);
    if (animationState) {
      if (animationProperty === 'fill') {
        animationState.targetFillColor = finalColor;
      } else if (animationProperty === 'stroke') {
        animationState.targetStrokeColor = finalColor;
      } else if (animationProperty === 'textColor') {
        animationState.targetTextColor = finalColor;
      }
    }

    // Get current visible color for comparison
    const currentVisibleColor = this.getCurrentVisibleColor(elementId, animationProperty);
    
    // Only animate if the color is actually changing
    if (finalColor === currentVisibleColor) {
      return finalColor; // No animation needed
    }

    // Schedule color transition animation with validated colors
    this.scheduleColorTransitionAnimation(
      elementId,
      animationProperty,
      finalColor,
      currentVisibleColor,
      animationContext,
      undefined
    );

    return finalColor;
  }

  /**
   * Validates if a color value is suitable for GSAP animation
   * @param color The color value to validate
   * @returns true if the color is valid for animation, false otherwise
   */
  private isValidColorForAnimation(color: string | undefined | null): boolean {
    // Reject null, undefined, or empty values
    if (!color || (typeof color === 'string' && color.trim().length === 0)) {
      return false;
    }
    
    // Reject numeric values (both number type and numeric strings)
    if (typeof color === 'number') {
      return false;
    }
    
    // Reject pure numeric strings (like "0", "1", etc.)
    if (typeof color === 'string' && !isNaN(Number(color.trim()))) {
      return false;
    }
    
    // Reject object-like values that got stringified incorrectly
    if (typeof color === 'string' && (color.includes('[object') || color === '[object Object]')) {
      return false;
    }
    
    return true;
  }

  /**
   * Get property-specific fallback colors for emergency situations
   * @param animationProperty The animation property that needs a fallback color
   * @returns A valid fallback color string
   */
  private getPropertySpecificFallbackColor(animationProperty: 'fill' | 'stroke' | 'textColor'): string {
    switch (animationProperty) {
      case 'fill':
        return '#999999'; // Gray fallback for fill
      case 'stroke':
        return 'none'; // No stroke by default
      case 'textColor':
        return '#FFFFFF'; // White text fallback
      default:
        return '#FF0000'; // Red emergency fallback
    }
  }

  /**
   * Get the current visible color of an element for a specific property
   * @param elementId The element to check
   * @param animationProperty The color property to check
   * @returns The current visible color or undefined if not found
   */
  private getCurrentVisibleColor(elementId: string, animationProperty: 'fill' | 'stroke' | 'textColor'): string | undefined {
    const animationState = this.elementAnimationStates.get(elementId);
    if (!animationState) {
      return undefined;
    }

    // Return the current target color for this property
    switch (animationProperty) {
      case 'fill':
        return animationState.currentVisibleFillColor || animationState.targetFillColor;
      case 'stroke':
        return animationState.currentVisibleStrokeColor || animationState.targetStrokeColor;
      case 'textColor':
        return animationState.currentVisibleTextColor || animationState.targetTextColor;
      default:
        return undefined;
    }
  }

  /**
   * Animates a color transition using GSAP
   */
  animateColorTransition(
    elementId: string,
    animationProperty: 'fill' | 'stroke' | 'textColor',
    targetColor: string,
    startingColor?: string,
    animationContext?: AnimationContext
  ): void {
    // CRITICAL: Validate targetColor before any animation processing
    if (typeof targetColor !== 'string' || !this.isValidColorForAnimation(targetColor)) {
      console.error(`[${elementId}] Invalid targetColor for ${animationProperty}:`, targetColor, typeof targetColor);
      // Use emergency fallback instead of proceeding with invalid color
      targetColor = this.getPropertySpecificFallbackColor(animationProperty);
      console.warn(`[${elementId}] Using emergency fallback color for ${animationProperty}:`, targetColor);
    }

    // Also validate startingColor if provided
    if (startingColor !== undefined) {
      if (typeof startingColor !== 'string' || !this.isValidColorForAnimation(startingColor)) {
        console.warn(`[${elementId}] Invalid startingColor for ${animationProperty}:`, startingColor, typeof startingColor);
        startingColor = undefined; // Let GSAP determine the starting color
      }
    }

    this.initializeElementAnimationTracking(elementId);
    
    const targetElement = this.findElementWithRetryLogic(elementId, animationContext?.getShadowElement, 2);
    if (!targetElement || !startingColor || startingColor === targetColor) {
      // If no element or invalid colors, still update stored color
      const animationState = this.elementAnimationStates.get(elementId)!;
      if (animationProperty === 'fill') {
        animationState.targetFillColor = targetColor;
      } else if (animationProperty === 'stroke') {
        animationState.targetStrokeColor = targetColor;
      } else if (animationProperty === 'textColor') {
        animationState.targetTextColor = targetColor;
      }
      return;
    }

    const animationState = this.elementAnimationStates.get(elementId)!;

    // Kill any existing GSAP animations on this element for this property
    gsap.killTweensOf(targetElement, animationProperty);

    // Clear any existing animation callbacks for this property
    if (animationProperty === 'fill' && animationState.fillAnimationCompleteCallback) {
      animationState.fillAnimationCompleteCallback();
    } else if (animationProperty === 'stroke' && animationState.strokeAnimationCompleteCallback) {
      animationState.strokeAnimationCompleteCallback();
    } else if (animationProperty === 'textColor' && animationState.textColorAnimationCompleteCallback) {
      animationState.textColorAnimationCompleteCallback();
    }

    // Mark as animating
    if (animationProperty === 'fill') {
      animationState.isAnimatingFillColor = true;
    } else if (animationProperty === 'stroke') {
      animationState.isAnimatingStrokeColor = true;
    } else if (animationProperty === 'textColor') {
      animationState.isAnimatingTextColor = true;
    }

    // Update the target color in animation state
    if (animationProperty === 'fill') {
      animationState.targetFillColor = targetColor;
    } else if (animationProperty === 'stroke') {
      animationState.targetStrokeColor = targetColor;
    } else if (animationProperty === 'textColor') {
      animationState.targetTextColor = targetColor;
    }

    // Ensure the element starts with the current color (which may be mid-animation)
    const domAttributeName = animationProperty === 'textColor' ? 'fill' : animationProperty;
    targetElement.setAttribute(domAttributeName, startingColor);

    // Create animation complete callback
    const onAnimationComplete = () => {
      // Ensure the final color is set after animation
      targetElement.setAttribute(domAttributeName, targetColor);
      
      // Clear animation state
      if (animationProperty === 'fill') {
        animationState.isAnimatingFillColor = false;
        animationState.fillAnimationCompleteCallback = undefined;
      } else if (animationProperty === 'stroke') {
        animationState.isAnimatingStrokeColor = false;
        animationState.strokeAnimationCompleteCallback = undefined;
      } else if (animationProperty === 'textColor') {
        animationState.isAnimatingTextColor = false;
        animationState.textColorAnimationCompleteCallback = undefined;
      }
    };

    // Store the complete callback for potential cleanup
    if (animationProperty === 'fill') {
      animationState.fillAnimationCompleteCallback = onAnimationComplete;
    } else if (animationProperty === 'stroke') {
      animationState.strokeAnimationCompleteCallback = onAnimationComplete;
    } else if (animationProperty === 'textColor') {
      animationState.textColorAnimationCompleteCallback = onAnimationComplete;
    }

    // Use GSAP to animate the color change for SVG elements
    gsap.to(targetElement, {
      duration: 0.3,
      ease: "power2.out",
      // Force GSAP to use setAttribute for SVG elements
      attr: { [domAttributeName]: targetColor },
      onComplete: onAnimationComplete,
      // Add error handling for complex layouts
      onCompleteParams: [targetElement, animationProperty, targetColor],
      onError: (error: any) => {
        console.warn(`[${elementId}] Animation error for ${animationProperty}:`, error);
        // Fallback: set color directly
        if (targetElement) {
          targetElement.setAttribute(domAttributeName, targetColor);
        }
        onAnimationComplete();
      }
    });
  }

  /**
   * Schedule color animation with proper timing for complex layouts
   */
  private scheduleColorTransitionAnimation(
    elementId: string,
    animationProperty: 'fill' | 'stroke' | 'textColor',
    targetColor: string,
    currentVisualColor: string | undefined,
    animationContext: AnimationContext,
    cachedElement?: Element | null
  ): void {
    // Use requestAnimationFrame to ensure DOM is ready and animation is smooth
    requestAnimationFrame(() => {
      // Double-check element availability at animation time
      const elementForAnimation = cachedElement || this.findElementWithRetryLogic(elementId, animationContext.getShadowElement, 1);
      
      if (elementForAnimation && currentVisualColor) {
        this.animateColorTransition(elementId, animationProperty, targetColor, currentVisualColor, animationContext);
      } else {
        // If still no element, fallback to setting the color directly
        console.warn(`[${elementId}] Element not available for animation, setting color directly`);
        const animationState = this.elementAnimationStates.get(elementId);
        if (animationState) {
          if (animationProperty === 'fill') {
            animationState.targetFillColor = targetColor;
          } else if (animationProperty === 'stroke') {
            animationState.targetStrokeColor = targetColor;
          } else if (animationProperty === 'textColor') {
            animationState.targetTextColor = targetColor;
          }
        }
        
        // Try to set the color directly if we have an element
        if (elementForAnimation) {
          elementForAnimation.setAttribute(animationProperty, targetColor);
        }
      }
    });
  }

  /**
   * Find DOM element with retry logic for complex layouts
   */
  private findElementWithRetryLogic(
    elementId: string,
    getShadowElement?: (id: string) => Element | null,
    maxRetryAttempts: number = 3
  ): Element | null {
    let targetElement = getShadowElement?.(elementId) || null;
    
    // If element not found and we have retries left, try again
    if (!targetElement && maxRetryAttempts > 0) {
      // For complex layouts, the element might not be available immediately
      // This is a synchronous retry that checks immediately
      targetElement = getShadowElement?.(elementId) || null;
    }
    
    return targetElement;
  }

  /**
   * Normalize color formats for accurate comparison (handles hex, rgb, rgba formats)
   */
  private normalizeColorForComparison(colorString: string | undefined): string | undefined {
    if (!colorString) return colorString;
    
    // Remove whitespace and convert to lowercase
    const cleanedColor = colorString.trim().toLowerCase();
    
    // Convert rgb(r,g,b) to hex for consistent comparison
    const rgbPatternMatch = cleanedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbPatternMatch) {
      const redHex = parseInt(rgbPatternMatch[1]).toString(16).padStart(2, '0');
      const greenHex = parseInt(rgbPatternMatch[2]).toString(16).padStart(2, '0');
      const blueHex = parseInt(rgbPatternMatch[3]).toString(16).padStart(2, '0');
      return `#${redHex}${greenHex}${blueHex}`;
    }
    
    // Convert rgba(r,g,b,a) to hex (ignoring alpha for now)
    const rgbaPatternMatch = cleanedColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (rgbaPatternMatch) {
      const redHex = parseInt(rgbaPatternMatch[1]).toString(16).padStart(2, '0');
      const greenHex = parseInt(rgbaPatternMatch[2]).toString(16).padStart(2, '0');
      const blueHex = parseInt(rgbaPatternMatch[3]).toString(16).padStart(2, '0');
      return `#${redHex}${greenHex}${blueHex}`;
    }
    
    // Ensure hex colors have # prefix
    if (/^[0-9a-f]{6}$/i.test(cleanedColor)) {
      return `#${cleanedColor}`;
    }
    
    return cleanedColor;
  }

  /**
   * Resolve a color value that might be static or dynamic (entity-based)
   */
  resolveDynamicColor(elementId: string, colorConfiguration: ColorValue, hass?: HomeAssistant): string | undefined {
    if (isDynamicColorConfig(colorConfiguration)) {
      return this.extractDynamicColorFromEntityState(elementId, colorConfiguration, hass);
    }
    const color = Color.fromValue(colorConfiguration, 'transparent');
    return color.toStaticString() === 'transparent' ? undefined : color.toStaticString();
  }

  /**
   * Extract color value from entity state based on dynamic configuration
   */
  private extractDynamicColorFromEntityState(elementId: string, dynamicConfig: DynamicColorConfig, hass?: HomeAssistant): string | undefined {
    if (!hass) {
      const defaultColor = Color.formatValue(dynamicConfig.default);
      // Only reject if it's null or explicitly invalid, not if it's a fallback
      if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
        console.warn(`[${elementId}] Dynamic color config has invalid default color:`, dynamicConfig.default);
        return undefined; // Let the higher-level fallback handle this
      }
      return defaultColor;
    }

    const entityState = hass.states[dynamicConfig.entity];
    if (!entityState) {
      const defaultColor = Color.formatValue(dynamicConfig.default);
      if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
        console.warn(`[${elementId}] Entity not found and default color is invalid for entity: ${dynamicConfig.entity}`);
        return undefined; // Let the higher-level fallback handle this
      }
      return defaultColor;
    }

    // Track this entity for change detection
    const entityMonitoring = this.entityStateMonitoring.get(elementId);
    if (entityMonitoring) {
      entityMonitoring.trackedEntityIds.add(dynamicConfig.entity);
      entityMonitoring.lastKnownEntityStates.set(dynamicConfig.entity, entityState);
    }

    // Get the value to map
    const entityValue = dynamicConfig.attribute ? entityState.attributes[dynamicConfig.attribute] : entityState.state;
    
    // Ensure we have a valid entity value to map against
    if (entityValue === undefined || entityValue === null) {
      const defaultColor = Color.formatValue(dynamicConfig.default);
      if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
        console.warn(`[${elementId}] Entity value is null/undefined and default color is invalid`);
        return undefined; // Let the higher-level fallback handle this
      }
      return defaultColor;
    }
    
    // Handle interpolation for numeric values
    if (dynamicConfig.interpolate && typeof entityValue === 'number') {
      const interpolatedColor = this.interpolateColorFromNumericValue(entityValue, dynamicConfig);
      if (!interpolatedColor) {
        console.warn(`[${elementId}] Interpolation failed for value: ${entityValue}`);
        const defaultColor = Color.formatValue(dynamicConfig.default);
        if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
          return undefined; // Let the higher-level fallback handle this
        }
        return defaultColor;
      }
      return interpolatedColor;
    }

    // Direct mapping - ensure we check for exact string match
    const entityValueString = entityValue.toString();
    const mappedColor = dynamicConfig.mapping[entityValueString];
    
    // If we have a mapping for this value, use it; otherwise use default
    if (mappedColor !== undefined) {
      const formattedMappedColor = Color.formatValue(mappedColor);
      if (!formattedMappedColor || !this.isValidCSSColor(formattedMappedColor)) {
        console.warn(`[${elementId}] Mapped color is invalid for entity value "${entityValueString}":`, mappedColor);
        const defaultColor = Color.formatValue(dynamicConfig.default);
        if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
          return undefined; // Let the higher-level fallback handle this
        }
        return defaultColor;
      }
      return formattedMappedColor;
    } else {
      const defaultColor = Color.formatValue(dynamicConfig.default);
      if (!defaultColor || !this.isValidCSSColor(defaultColor)) {
        console.warn(`[${elementId}] No mapping found for "${entityValueString}" and default color is invalid`);
        return undefined; // Let the higher-level fallback handle this
      }
      return defaultColor;
    }
  }

  /**
   * Validate if a color string is a valid CSS color (excluding our own fallbacks)
   */
  private isValidCSSColor(color: string | undefined): boolean {
    if (!color || typeof color !== 'string') return false;
    
    // Check for basic CSS color formats
    const trimmedColor = color.trim();
    if (trimmedColor.length === 0) return false;
    
    // Accept most reasonable color values - this is less strict than the animation validation
    // since this is just for detecting truly invalid values vs valid CSS colors
    return (
      /^#[0-9a-f]{3,8}$/i.test(trimmedColor) ||          // hex colors
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(trimmedColor) ||  // rgb
      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i.test(trimmedColor) || // rgba
      /^[a-z]+$/i.test(trimmedColor)                     // named colors
    );
  }

  /**
   * Interpolate color for numeric entity values
   */
  private interpolateColorFromNumericValue(numericValue: number, dynamicConfig: DynamicColorConfig): string | undefined {
    const numericMappingKeys = Object.keys(dynamicConfig.mapping)
      .map(keyString => parseFloat(keyString))
      .filter(parsedKey => !isNaN(parsedKey))
      .sort((a, b) => a - b);

    if (numericMappingKeys.length === 0) {
      const defaultColor = Color.formatValue(dynamicConfig.default);
      return (defaultColor && this.isValidCSSColor(defaultColor)) ? defaultColor : undefined;
    }

    // If we only have one mapping key, use it or default
    if (numericMappingKeys.length === 1) {
      const singleKey = numericMappingKeys[0];
      const color = Color.formatValue(dynamicConfig.mapping[singleKey.toString()]) ||
                    Color.formatValue(dynamicConfig.default);
      return (color && this.isValidCSSColor(color)) ? color : undefined;
    }

    // Check for exact match first
    const exactMatch = dynamicConfig.mapping[numericValue.toString()];
    if (exactMatch !== undefined) {
      const color = Color.formatValue(exactMatch);
      return (color && this.isValidCSSColor(color)) ? color : undefined;
    }

    // Find the two closest values for interpolation
    let lowerBoundKey: number;
    let upperBoundKey: number;

    if (numericValue <= numericMappingKeys[0]) {
      // Value is below the lowest mapping - use the lowest color
      const color = Color.formatValue(dynamicConfig.mapping[numericMappingKeys[0].toString()]) ||
                    Color.formatValue(dynamicConfig.default);
      return (color && this.isValidCSSColor(color)) ? color : undefined;
    }

    if (numericValue >= numericMappingKeys[numericMappingKeys.length - 1]) {
      // Value is above the highest mapping - use the highest color
      const color = Color.formatValue(dynamicConfig.mapping[numericMappingKeys[numericMappingKeys.length - 1].toString()]) ||
                    Color.formatValue(dynamicConfig.default);
      return (color && this.isValidCSSColor(color)) ? color : undefined;
    }

    // Find the two keys that bracket our value
    for (let i = 0; i < numericMappingKeys.length - 1; i++) {
      if (numericValue >= numericMappingKeys[i] && numericValue <= numericMappingKeys[i + 1]) {
        lowerBoundKey = numericMappingKeys[i];
        upperBoundKey = numericMappingKeys[i + 1];
        break;
      }
    }

    // Get the colors for interpolation
    const lowerColor = Color.formatValue(dynamicConfig.mapping[lowerBoundKey!.toString()]);
    const upperColor = Color.formatValue(dynamicConfig.mapping[upperBoundKey!.toString()]);

    if (!lowerColor || !upperColor || !this.isValidCSSColor(lowerColor) || !this.isValidCSSColor(upperColor)) {
      console.warn(`Invalid colors for interpolation: ${lowerColor}, ${upperColor}`);
      const defaultColor = Color.formatValue(dynamicConfig.default);
      return (defaultColor && this.isValidCSSColor(defaultColor)) ? defaultColor : undefined;
    }

    // Perform the actual color interpolation
    const interpolatedColor = this.interpolateColors(lowerColor, upperColor, numericValue, lowerBoundKey!, upperBoundKey!);
    return interpolatedColor;
  }

  /**
   * Interpolate between two colors based on a numeric value between two bounds
   */
  private interpolateColors(color1: string, color2: string, value: number, bound1: number, bound2: number): string | undefined {
    // Calculate interpolation factor (0 = color1, 1 = color2)
    const factor = bound2 === bound1 ? 0 : (value - bound1) / (bound2 - bound1);
    const clampedFactor = Math.max(0, Math.min(1, factor));

    // Parse colors to RGB
    const rgb1 = this.parseColorToRgb(color1);
    const rgb2 = this.parseColorToRgb(color2);

    if (!rgb1 || !rgb2) {
      console.warn(`Failed to parse colors for interpolation: ${color1}, ${color2}`);
      return undefined;
    }

    // Interpolate each RGB component
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * clampedFactor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * clampedFactor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * clampedFactor);

    // Convert back to hex
    return this.rgbToHex(r, g, b);
  }

  /**
   * Parse a color string to RGB components
   */
  private parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
    const trimmedColor = color.trim().toLowerCase();

    // Handle hex colors (#RGB, #RRGGBB, #RRGGBBAA)
    const hexMatch = trimmedColor.match(/^#([0-9a-f]{3,8})$/);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        // #RGB -> #RRGGBB
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
      } else if (hex.length === 6) {
        // #RRGGBB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return { r, g, b };
      } else if (hex.length === 8) {
        // #RRGGBBAA (ignore alpha for interpolation)
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return { r, g, b };
      }
    }

    // Handle rgb() and rgba() colors
    const rgbMatch = trimmedColor.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)$/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        return { r, g, b };
      }
    }

    // Handle named colors (basic set)
    const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
      'red': { r: 255, g: 0, b: 0 },
      'green': { r: 0, g: 128, b: 0 },
      'blue': { r: 0, g: 0, b: 255 },
      'white': { r: 255, g: 255, b: 255 },
      'black': { r: 0, g: 0, b: 0 },
      'yellow': { r: 255, g: 255, b: 0 },
      'cyan': { r: 0, g: 255, b: 255 },
      'magenta': { r: 255, g: 0, b: 255 },
      'orange': { r: 255, g: 165, b: 0 },
      'purple': { r: 128, g: 0, b: 128 },
      'lime': { r: 0, g: 255, b: 0 },
      'pink': { r: 255, g: 192, b: 203 },
      'brown': { r: 165, g: 42, b: 42 },
      'gray': { r: 128, g: 128, b: 128 },
      'grey': { r: 128, g: 128, b: 128 },
      'transparent': { r: 0, g: 0, b: 0 }
    };

    if (namedColors[trimmedColor]) {
      return namedColors[trimmedColor];
    }

    return null;
  }

  /**
   * Convert RGB components to hex color string
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const clampedR = Math.max(0, Math.min(255, Math.round(r)));
    const clampedG = Math.max(0, Math.min(255, Math.round(g)));
    const clampedB = Math.max(0, Math.min(255, Math.round(b)));
    
    const hexR = clampedR.toString(16).padStart(2, '0');
    const hexG = clampedG.toString(16).padStart(2, '0');
    const hexB = clampedB.toString(16).padStart(2, '0');
    
    return `#${hexR}${hexG}${hexB}`;
  }

  /**
   * Check if any monitored entities have changed and trigger update if needed
   */
  checkForEntityStateChanges(elementId: string, hass: HomeAssistant): boolean {
    const entityMonitoring = this.entityStateMonitoring.get(elementId);
    if (!entityMonitoring || entityMonitoring.trackedEntityIds.size === 0) {
      return false;
    }

    let hasDetectedChanges = false;
    
    for (const entityId of entityMonitoring.trackedEntityIds) {
      const currentEntityState = hass.states[entityId];
      const lastKnownEntityState = entityMonitoring.lastKnownEntityStates.get(entityId);
      
      // Check if entity state or attributes changed
      if (!currentEntityState || !lastKnownEntityState || 
          currentEntityState.state !== lastKnownEntityState.state ||
          JSON.stringify(currentEntityState.attributes) !== JSON.stringify(lastKnownEntityState.attributes)) {
        hasDetectedChanges = true;
        entityMonitoring.lastKnownEntityStates.set(entityId, currentEntityState);
      }
    }

    return hasDetectedChanges;
  }

  /**
   * Clear monitored entities for an element (called before recalculating dynamic colors)
   */
  clearTrackedEntitiesForElement(elementId: string): void {
    const entityMonitoring = this.entityStateMonitoring.get(elementId);
    if (entityMonitoring) {
      entityMonitoring.trackedEntityIds.clear();
      entityMonitoring.lastKnownEntityStates.clear();
    }
  }

  /**
   * Stop any ongoing animations for an element
   */
  stopAllAnimationsForElement(elementId: string): void {
    const animationState = this.elementAnimationStates.get(elementId);
    if (!animationState) return;

    if (animationState.fillAnimationCompleteCallback) {
      animationState.fillAnimationCompleteCallback();
    }
    if (animationState.strokeAnimationCompleteCallback) {
      animationState.strokeAnimationCompleteCallback();
    }
    if (animationState.textColorAnimationCompleteCallback) {
      animationState.textColorAnimationCompleteCallback();
    }
    animationState.isAnimatingFillColor = false;
    animationState.isAnimatingStrokeColor = false;
    animationState.isAnimatingTextColor = false;
  }

  /**
   * Collect animation states for multiple elements (used for animation restoration)
   */
  collectAnimationStates(
    elementIds: string[],
    getShadowElement?: (id: string) => Element | null
  ): Map<string, ColorAnimationState> {
    const animationStates = new Map<string, ColorAnimationState>();

    elementIds.forEach(elementId => {
      const state = this.elementAnimationStates.get(elementId);
      if (state && (state.isAnimatingFillColor || state.isAnimatingStrokeColor || state.isAnimatingTextColor)) {
        const domElement = getShadowElement?.(elementId);
        if (domElement) {
          animationStates.set(elementId, {
            isAnimatingFillColor: state.isAnimatingFillColor,
            isAnimatingStrokeColor: state.isAnimatingStrokeColor,
            isAnimatingTextColor: state.isAnimatingTextColor,
            currentVisibleFillColor: domElement.getAttribute('fill') || undefined,
            currentVisibleStrokeColor: domElement.getAttribute('stroke') || undefined,
            currentVisibleTextColor: (domElement.querySelector && domElement.querySelector('text')?.getAttribute('fill')) || undefined,
            targetFillColor: state.targetFillColor,
            targetStrokeColor: state.targetStrokeColor,
            targetTextColor: state.targetTextColor
          });
        }
      }
    });

    return animationStates;
  }

  /**
   * Restore animation states after re-render (used for animation restoration)
   */
  restoreAnimationStates(
    animationStates: Map<string, ColorAnimationState>,
    context: AnimationContext,
    onComplete?: () => void
  ): void {
    if (animationStates.size === 0) {
      onComplete?.();
      return;
    }

    // Use a longer timeout for complex layouts to ensure DOM has been updated
    const restoreAnimations = (attempt: number = 0) => {
      let restoredCount = 0;
      
      animationStates.forEach((state, elementId) => {
        const domElement = context.getShadowElement?.(elementId);
        
        if (domElement && state.currentVisibleFillColor) {
          // Restore the current animation color
          domElement.setAttribute('fill', state.currentVisibleFillColor);
          
          if (state.targetFillColor && state.targetFillColor !== state.currentVisibleFillColor) {
            // Restart the animation from current position
            this.animateColorTransition(elementId, 'fill', state.targetFillColor, state.currentVisibleFillColor, context);
            restoredCount++;
          }
        }
        
        if (domElement && state.currentVisibleStrokeColor) {
          domElement.setAttribute('stroke', state.currentVisibleStrokeColor);
          
          if (state.targetStrokeColor && state.targetStrokeColor !== state.currentVisibleStrokeColor) {
            this.animateColorTransition(elementId, 'stroke', state.targetStrokeColor, state.currentVisibleStrokeColor, context);
            restoredCount++;
          }
        }
        
        if (domElement && state.currentVisibleTextColor) {
          const textElement = domElement.querySelector && domElement.querySelector('text');
          if (textElement) {
            textElement.setAttribute('fill', state.currentVisibleTextColor);
            
            if (state.targetTextColor && state.targetTextColor !== state.currentVisibleTextColor) {
              this.animateColorTransition(elementId, 'textColor', state.targetTextColor, state.currentVisibleTextColor, context);
              restoredCount++;
            }
          }
        }
      });
      
      // If we didn't restore all animations and haven't exceeded retry limit, try again
      if (restoredCount < animationStates.size && attempt < 3) {
        setTimeout(() => restoreAnimations(attempt + 1), 25 * (attempt + 1)); // Increasing delay
      } else {
        if (attempt > 0) {
        }
        onComplete?.();
      }
    };
    
    // Start with a longer initial delay for complex layouts
    setTimeout(() => restoreAnimations(), 25);
  }

  /**
   * Create a generic property animation (for future extensibility beyond colors)
   */
  animateElementProperty(
    elementId: string,
    animationProperty: string,
    targetPropertyValue: any,
    animationDurationSeconds: number = 0.5,
    getShadowElement?: (id: string) => Element | null
  ): void {
    const targetElement = getShadowElement?.(elementId);
    if (!targetElement) return;
    
    const animationProperties: { [key: string]: any } = {};
    animationProperties[animationProperty] = targetPropertyValue;
    
    gsap.to(targetElement, {
      duration: animationDurationSeconds,
      ...animationProperties,
      ease: "power2.out"
    });
  }
}

// Global animation manager instance for convenient access across the application
export const animationManager = new AnimationManager(); 