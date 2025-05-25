import { HomeAssistant } from 'custom-card-helpers';
import { gsap } from 'gsap';
import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';

/**
 * Animation state tracking for managing ongoing color transitions
 */
export interface ColorAnimationState {
  isAnimatingFillColor: boolean;
  isAnimatingStrokeColor: boolean;
  currentVisibleFillColor?: string;
  currentVisibleStrokeColor?: string;
  targetFillColor?: string;
  targetStrokeColor?: string;
  fillAnimationCompleteCallback?: () => void;
  strokeAnimationCompleteCallback?: () => void;
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
        isAnimatingStrokeColor: false
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
    }

    this.elementAnimationStates.delete(elementId);
    this.entityStateMonitoring.delete(elementId);
    this.dynamicColorCache.delete(elementId);
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
    animationProperty: 'fill' | 'stroke',
    animationContext: AnimationContext
  ): string | undefined {
    this.initializeElementAnimationTracking(elementId);
    
    const resolvedColor = this.resolveDynamicColor(elementId, colorConfiguration, animationContext.hass);
    if (!resolvedColor) return resolvedColor;
    
    const animationState = this.elementAnimationStates.get(elementId)!;
    const lastKnownColor = animationProperty === 'fill' ? animationState.targetFillColor : animationState.targetStrokeColor;
    
    // For dynamic colors, always check if we need to animate
    if (isDynamicColorConfig(colorConfiguration)) {
      // Try to get the current visual color from the DOM element with retry logic
      const domElement = this.findElementWithRetryLogic(elementId, animationContext.getShadowElement);
      const currentVisualColor = domElement?.getAttribute(animationProperty) || lastKnownColor;
      
      // Normalize colors for comparison to handle different formats (hex, rgb, etc.)
      const normalizedCurrentColor = this.normalizeColorForComparison(currentVisualColor);
      const normalizedNewColor = this.normalizeColorForComparison(resolvedColor);
      
      // If the new color is different from current visual color, animate to it
      if (normalizedCurrentColor && normalizedNewColor && normalizedCurrentColor !== normalizedNewColor) {
        // Schedule animation using requestAnimationFrame to ensure DOM is ready
        this.scheduleColorTransitionAnimation(elementId, animationProperty, resolvedColor, currentVisualColor, animationContext, domElement);
        
        // Update the stored target color
        if (animationProperty === 'fill') {
          animationState.targetFillColor = resolvedColor;
        } else {
          animationState.targetStrokeColor = resolvedColor;
        }
        
        // Return the current visual color for the template (animation starting point)
        return currentVisualColor || resolvedColor;
      }
      
      // If colors are the same, just update stored color and return
      if (animationProperty === 'fill') {
        animationState.targetFillColor = resolvedColor;
      } else {
        animationState.targetStrokeColor = resolvedColor;
      }
      
      return resolvedColor;
    }
    
    // For static colors, update stored color and return
    if (animationProperty === 'fill') {
      animationState.targetFillColor = resolvedColor;
    } else {
      animationState.targetStrokeColor = resolvedColor;
    }
    
    return resolvedColor;
  }

  /**
   * Execute smooth color transitions using GSAP animation library
   */
  animateColorTransition(
    elementId: string,
    animationProperty: 'fill' | 'stroke',
    targetColor: string,
    startingColor?: string,
    animationContext?: AnimationContext
  ): void {
    this.initializeElementAnimationTracking(elementId);
    
    const targetElement = this.findElementWithRetryLogic(elementId, animationContext?.getShadowElement, 2);
    if (!targetElement || !startingColor || startingColor === targetColor) {
      // If no element or invalid colors, still update stored color
      const animationState = this.elementAnimationStates.get(elementId)!;
      if (animationProperty === 'fill') {
        animationState.targetFillColor = targetColor;
      } else {
        animationState.targetStrokeColor = targetColor;
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
    }

    // Mark as animating
    if (animationProperty === 'fill') {
      animationState.isAnimatingFillColor = true;
    } else {
      animationState.isAnimatingStrokeColor = true;
    }

    // Ensure the element starts with the current color (which may be mid-animation)
    targetElement.setAttribute(animationProperty, startingColor);

    // Create animation complete callback
    const onAnimationComplete = () => {
      // Ensure the final color is set after animation
      targetElement.setAttribute(animationProperty, targetColor);
      
      // Clear animation state
      if (animationProperty === 'fill') {
        animationState.isAnimatingFillColor = false;
        animationState.fillAnimationCompleteCallback = undefined;
      } else {
        animationState.isAnimatingStrokeColor = false;
        animationState.strokeAnimationCompleteCallback = undefined;
      }
    };

    // Store the complete callback for potential cleanup
    if (animationProperty === 'fill') {
      animationState.fillAnimationCompleteCallback = onAnimationComplete;
    } else {
      animationState.strokeAnimationCompleteCallback = onAnimationComplete;
    }

    // Use GSAP to animate the color change for SVG elements
    gsap.to(targetElement, {
      duration: 0.3,
      ease: "power2.out",
      // Force GSAP to use setAttribute for SVG elements
      attr: { [animationProperty]: targetColor },
      onComplete: onAnimationComplete,
      // Add error handling for complex layouts
      onCompleteParams: [targetElement, animationProperty, targetColor],
      onError: (error: any) => {
        console.warn(`[${elementId}] Animation error for ${animationProperty}:`, error);
        // Fallback: set color directly
        if (targetElement) {
          targetElement.setAttribute(animationProperty, targetColor);
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
    animationProperty: 'fill' | 'stroke',
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
          } else {
            animationState.targetStrokeColor = targetColor;
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
    return this.formatColorValueFromInput(colorConfiguration);
  }

  /**
   * Extract color value from entity state based on dynamic configuration
   */
  private extractDynamicColorFromEntityState(elementId: string, dynamicConfig: DynamicColorConfig, hass?: HomeAssistant): string | undefined {
    if (!hass) {
      return this.formatColorValueFromInput(dynamicConfig.default);
    }

    const entityState = hass.states[dynamicConfig.entity];
    if (!entityState) {
      return this.formatColorValueFromInput(dynamicConfig.default);
    }

    // Track this entity for change detection
    const entityMonitoring = this.entityStateMonitoring.get(elementId);
    if (entityMonitoring) {
      entityMonitoring.trackedEntityIds.add(dynamicConfig.entity);
      entityMonitoring.lastKnownEntityStates.set(dynamicConfig.entity, entityState);
    }

    // Get the value to map
    const entityValue = dynamicConfig.attribute ? entityState.attributes[dynamicConfig.attribute] : entityState.state;
    
    // Handle interpolation for numeric values
    if (dynamicConfig.interpolate && typeof entityValue === 'number') {
      return this.interpolateColorFromNumericValue(entityValue, dynamicConfig);
    }

    // Direct mapping
    const mappedColor = dynamicConfig.mapping[entityValue] || dynamicConfig.default;
    return this.formatColorValueFromInput(mappedColor);
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
      return this.formatColorValueFromInput(dynamicConfig.default);
    }

    // Find the two closest values for interpolation
    let lowerBoundKey = numericMappingKeys[0];
    let upperBoundKey = numericMappingKeys[numericMappingKeys.length - 1];

    for (let i = 0; i < numericMappingKeys.length - 1; i++) {
      if (numericValue >= numericMappingKeys[i] && numericValue <= numericMappingKeys[i + 1]) {
        lowerBoundKey = numericMappingKeys[i];
        upperBoundKey = numericMappingKeys[i + 1];
        break;
      }
    }

    // If exact match, return that color
    if (dynamicConfig.mapping[numericValue.toString()]) {
      return this.formatColorValueFromInput(dynamicConfig.mapping[numericValue.toString()]);
    }

    // For now, just return the nearest value (true interpolation can be added later)
    const lowerBoundDistance = Math.abs(numericValue - lowerBoundKey);
    const upperBoundDistance = Math.abs(numericValue - upperBoundKey);
    const nearestKey = lowerBoundDistance <= upperBoundDistance ? lowerBoundKey : upperBoundKey;
    
    return this.formatColorValueFromInput(dynamicConfig.mapping[nearestKey.toString()] || dynamicConfig.default);
  }

  /**
   * Format color value from different possible input formats
   */
  private formatColorValueFromInput(colorInput: any): string | undefined {
    if (typeof colorInput === 'string') {
      return colorInput;
    }
    if (Array.isArray(colorInput) && colorInput.length === 3 && colorInput.every(component => typeof component === 'number')) {
      return `rgb(${colorInput[0]},${colorInput[1]},${colorInput[2]})`;
    }
    return undefined;
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
    animationState.isAnimatingFillColor = false;
    animationState.isAnimatingStrokeColor = false;
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
      if (state && (state.isAnimatingFillColor || state.isAnimatingStrokeColor)) {
        const domElement = getShadowElement?.(elementId);
        if (domElement) {
          animationStates.set(elementId, {
            isAnimatingFillColor: state.isAnimatingFillColor,
            isAnimatingStrokeColor: state.isAnimatingStrokeColor,
            currentVisibleFillColor: domElement.getAttribute('fill') || undefined,
            currentVisibleStrokeColor: domElement.getAttribute('stroke') || undefined,
            targetFillColor: state.targetFillColor,
            targetStrokeColor: state.targetStrokeColor
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