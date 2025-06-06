import { ColorValue, DynamicColorConfig, StatefulColorConfig, isDynamicColorConfig, isStatefulColorConfig } from '../types';
import { AnimationContext, animationManager } from './animation';
import { LayoutElementProps } from '../layout/engine';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../layout/engine.js';

// ============================================================================
// Core Color Types and Interfaces
// ============================================================================

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

// ============================================================================
// Unified Color Class
// ============================================================================

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

// ============================================================================
// Color Resolution Service
// ============================================================================

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

// ============================================================================
// Dynamic Color Management
// ============================================================================

/**
 * Manages dynamic color system operations including cache invalidation,
 * entity monitoring cleanup, and refresh scheduling
 */
export class DynamicColorManager {
  private _dynamicColorCheckScheduled: boolean = false;
  private _refreshTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Clear all dynamic color system caches and entity monitoring
   */
  clearAllCaches(layoutGroups: Group[]): void {
    // Clear element-level entity monitoring and animation state
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        this._clearElementState(element);
      }
    }

    // Clear global animation manager caches
    animationManager.invalidateDynamicColorCache();
  }

  /**
   * Check for dynamic color changes with throttling to prevent excessive checks
   */
  checkDynamicColorChanges(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number = 25
  ): void {
    if (this._dynamicColorCheckScheduled) {
      return;
    }
    
    this._dynamicColorCheckScheduled = true;
    
    // Clear any existing timeout
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
    }
    
    this._refreshTimeout = setTimeout(() => {
      this._dynamicColorCheckScheduled = false;
      this._refreshTimeout = undefined;
      
      const needsRefresh = this._performDynamicColorCheck(layoutGroups, hass);
      
      if (needsRefresh) {
        refreshCallback();
      }
    }, checkDelay);
  }

  /**
   * Schedule a dynamic color refresh with a delay
   */
  scheduleDynamicColorRefresh(
    hass: HomeAssistant,
    containerRect: DOMRect | undefined,
    checkCallback: () => void,
    refreshCallback: () => void,
    delay: number = 50
  ): void {
    setTimeout(() => {
      if (hass && containerRect) {
        checkCallback();
        refreshCallback();
      }
    }, delay);
  }

  /**
   * Extract entity IDs that an element is using for dynamic colors
   */
  extractEntityIdsFromElement(element: any): Set<string> {
    const entityIds = new Set<string>();
    const props = element.props;
    
    if (!props) {
      return entityIds;
    }
    
    // Check dynamic color properties
    this._extractFromColorProperty(props.fill, entityIds);
    this._extractFromColorProperty(props.stroke, entityIds);
    this._extractFromColorProperty(props.textColor, entityIds);
    
    // Check button color properties
    if (props.button) {
      this._extractFromColorProperty(props.button.hover_fill, entityIds);
      this._extractFromColorProperty(props.button.active_fill, entityIds);
      this._extractFromColorProperty(props.button.hover_text_color, entityIds);
      this._extractFromColorProperty(props.button.active_text_color, entityIds);
    }
    
    return entityIds;
  }

  /**
   * Check if there are significant entity changes that might affect layout
   */
  hasSignificantEntityChanges(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant
  ): boolean {
    if (!lastHassStates) {
      return false;
    }
    
    // Check for entity state changes that might affect text content or dimensions
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        if (this._elementHasSignificantChanges(element, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Cleanup any pending operations
   */
  cleanup(): void {
    this._dynamicColorCheckScheduled = false;
    
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = undefined;
    }
  }

  /**
   * Clear state for a specific element
   */
  private _clearElementState(element: any): void {
    // Clear entity monitoring and animation state
    if (typeof element.clearMonitoredEntities === 'function') {
      element.clearMonitoredEntities();
    }
    
    if (typeof element.cleanupAnimations === 'function') {
      element.cleanupAnimations();
    }
    
    // Clear from animation manager directly
    animationManager.cleanupElementAnimationTracking(element.id);
  }

  /**
   * Perform the actual dynamic color check
   */
  private _performDynamicColorCheck(layoutGroups: Group[], hass: HomeAssistant): boolean {
    let needsRefresh = false;
    let elementsChecked = 0;
    
    // Collect all elements that need entity change checks
    const elementsToCheck = this._collectElementsForChecking(layoutGroups);
    
    // Check each element for entity changes
    for (const { element } of elementsToCheck) {
      elementsChecked++;
      if (this._checkElementEntityChanges(element, hass)) {
        needsRefresh = true;
        // Continue checking all elements to ensure comprehensive updates
      }
    }
    
    return needsRefresh;
  }

  /**
   * Collect elements that need to be checked for entity changes
   */
  private _collectElementsForChecking(layoutGroups: Group[]): Array<{ element: any }> {
    const elementsToCheck: Array<{ element: any }> = [];
    
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        elementsToCheck.push({ element });
      }
    }
    
    return elementsToCheck;
  }

  /**
   * Check if an element has entity changes that require refresh
   */
  private _checkElementEntityChanges(element: any, hass: HomeAssistant): boolean {
    try {
      return typeof element.checkEntityChanges === 'function' 
        ? element.checkEntityChanges(hass)
        : false;
    } catch (error) {
      console.warn('Error checking entity changes for element:', element.id, error);
      return false;
    }
  }

  /**
   * Extract entity ID from a color property if it's a dynamic color config
   */
  private _extractFromColorProperty(colorProp: any, entityIds: Set<string>): void {
    if (colorProp && typeof colorProp === 'object' && colorProp.entity) {
      entityIds.add(colorProp.entity);
    }
  }

  /**
   * Check if a specific element has significant changes
   */
  private _elementHasSignificantChanges(
    element: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const props = element.props;
    
    // Check for text elements with entity-based content
    if (this._hasEntityBasedTextChanges(props, lastHassStates, currentHass)) {
      return true;
    }
    
    // Check for dynamic color changes that might affect entity-based colors
    if (this._hasEntityBasedColorChanges(props, lastHassStates, currentHass)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check for entity-based text content changes
   */
  private _hasEntityBasedTextChanges(
    props: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    if (props.text && typeof props.text === 'string') {
      return this._checkEntityReferencesInText(props.text, lastHassStates, currentHass);
    }
    return false;
  }

  /**
   * Check for entity-based color changes
   */
  private _hasEntityBasedColorChanges(
    props: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const colorProps = [props.fill, props.stroke, props.textColor];
    
    for (const colorProp of colorProps) {
      if (this._isEntityBasedColor(colorProp)) {
        if (this._checkEntityReferencesInText(colorProp, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a color property is entity-based
   */
  private _isEntityBasedColor(colorProp: any): boolean {
    return typeof colorProp === 'string' && colorProp.includes('states[');
  }

  /**
   * Check entity references in text/color strings
   */
  private _checkEntityReferencesInText(
    text: string,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const entityMatches = text.match(/states\['([^']+)'\]/g);
    if (!entityMatches) return false;
    
    for (const match of entityMatches) {
      const entityIdMatch = match.match(/states\['([^']+)'\]/);
      if (entityIdMatch) {
        const entityId = entityIdMatch[1];
        const oldState = lastHassStates[entityId]?.state;
        const newState = currentHass.states[entityId]?.state;
        
        if (oldState !== newState) {
          return true;
        }
      }
    }
    
    return false;
  }
}

// ============================================================================
// Singleton Exports for Convenient Access
// ============================================================================

// Export singleton instances for convenient access across the application
export const colorResolver = new ColorResolver();
export const dynamicColorManager = new DynamicColorManager(); 