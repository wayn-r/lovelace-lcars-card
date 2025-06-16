import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';
import { AnimationContext, animationManager } from './animation';
import { LayoutElementProps } from '../layout/engine';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../layout/engine.js';
import { Color, ColorStateContext, ComputedElementColors, ColorResolutionDefaults } from './color.js';

export class ColorResolver {
  resolveAllElementColors(
    elementId: string,
    elementProps: LayoutElementProps,
    animationContext: AnimationContext,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const resolvedDefaults = this._setDefaultColorValues(colorDefaults);
    const colorInstances = this._createColorInstances(elementProps, resolvedDefaults);

    return {
      fillColor: colorInstances.fillColor.resolve(elementId, 'fill', animationContext, interactiveState),
      strokeColor: colorInstances.strokeColor.resolve(elementId, 'stroke', animationContext, interactiveState),
      strokeWidth: elementProps.strokeWidth?.toString() ?? resolvedDefaults.fallbackStrokeWidth,
      textColor: colorInstances.textColor.resolve(elementId, 'textColor', animationContext, interactiveState)
    };
  }

  createButtonPropsWithResolvedColors(
    elementId: string,
    originalElementProps: LayoutElementProps,
    animationContext: AnimationContext,
    interactiveState: ColorStateContext = {}
  ): LayoutElementProps {
    const computedColors = this.resolveAllElementColors(elementId, originalElementProps, animationContext, {
      fallbackTextColor: 'white' // Default text color for interactive elements
    }, interactiveState);
    
    return this._buildPropsWithResolvedColors(originalElementProps, computedColors);
  }

  resolveColorsWithoutAnimationContext(
    elementId: string,
    elementProps: LayoutElementProps,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const basicAnimationContext = this._createBasicAnimationContext(elementId);
    return this.resolveAllElementColors(elementId, elementProps, basicAnimationContext, colorDefaults, interactiveState);
  }

  resolveColor(
    colorValue: ColorValue,
    elementId?: string,
    animationProperty?: 'fill' | 'stroke' | 'textColor',
    animationContext?: AnimationContext,
    stateContext?: ColorStateContext,
    fallback: string = 'transparent'
  ): string {
    // 1. Directly resolve dynamic colors to avoid infinite recursion with Color.resolve()
    if (isDynamicColorConfig(colorValue)) {
      return this._resolveDynamicColorValue(colorValue, animationContext?.hass, fallback);
    }

    // 2. For all other color types defer to Color helper (static or stateful)
    const color = Color.withFallback(colorValue, fallback);
    return color.resolve(elementId, animationProperty, animationContext, stateContext);
  }

  checkDynamicColorChanges(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number = 25
  ): void {
    if (this._dynamicColorCheckScheduled) {
      return;
    }
    
    this._scheduleColorChangeCheck(layoutGroups, hass, refreshCallback, checkDelay);
  }

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

  extractEntityIdsFromElement(element: any): Set<string> {
    const entityIds = new Set<string>();
    const props = element.props;
    
    if (!props) {
      return entityIds;
    }
    
    this._extractEntityIdsFromColorProperties(props, entityIds);
    this._extractEntityIdsFromButtonProperties(props, entityIds);
    
    return entityIds;
  }

  hasSignificantEntityChanges(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant
  ): boolean {
    if (!lastHassStates) {
      return false;
    }
    
    return this._checkForSignificantChangesInGroups(layoutGroups, lastHassStates, currentHass);
  }

  clearAllCaches(layoutGroups: Group[]): void {
    // Clear element-level entity monitoring and animation state
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        this._clearElementState(element);
      }
    }

    // Note: Dynamic color caching is now handled by the store/ColorResolver itself
  }

  cleanup(): void {
    this._dynamicColorCheckScheduled = false;
    
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = undefined;
    }
  }

  private _dynamicColorCheckScheduled: boolean = false;
  private _refreshTimeout?: ReturnType<typeof setTimeout>;

  private _setDefaultColorValues(colorDefaults: ColorResolutionDefaults) {
    return {
      fallbackFillColor: colorDefaults.fallbackFillColor || 'none',
      fallbackStrokeColor: colorDefaults.fallbackStrokeColor || 'none',
      fallbackStrokeWidth: colorDefaults.fallbackStrokeWidth || '0',
      fallbackTextColor: colorDefaults.fallbackTextColor || 'currentColor'
    };
  }

  private _createColorInstances(elementProps: LayoutElementProps, resolvedDefaults: any) {
    return {
      fillColor: elementProps.fill !== undefined 
        ? Color.withFallback(elementProps.fill, resolvedDefaults.fallbackFillColor)
        : Color.from(resolvedDefaults.fallbackFillColor),
      strokeColor: elementProps.stroke !== undefined
        ? Color.withFallback(elementProps.stroke, resolvedDefaults.fallbackStrokeColor) 
        : Color.from(resolvedDefaults.fallbackStrokeColor),
      textColor: elementProps.textColor !== undefined
        ? Color.withFallback(elementProps.textColor, resolvedDefaults.fallbackTextColor)
        : Color.from(resolvedDefaults.fallbackTextColor)
    };
  }

  private _buildPropsWithResolvedColors(
    originalElementProps: LayoutElementProps, 
    computedColors: ComputedElementColors
  ): LayoutElementProps {
    const propsWithResolvedColors = { ...originalElementProps };

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

  private _createBasicAnimationContext(elementId: string): AnimationContext {
    return {
      elementId,
      getShadowElement: undefined,
      hass: undefined,
      requestUpdateCallback: undefined
    };
  }

  private _scheduleColorChangeCheck(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number
  ): void {
    this._dynamicColorCheckScheduled = true;
    
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

  private _extractEntityIdsFromColorProperties(props: any, entityIds: Set<string>): void {
    this._extractFromColorProperty(props.fill, entityIds);
    this._extractFromColorProperty(props.stroke, entityIds);
    this._extractFromColorProperty(props.textColor, entityIds);
  }

  private _extractEntityIdsFromButtonProperties(props: any, entityIds: Set<string>): void {
    if (props.button) {
      this._extractFromColorProperty(props.button.hover_fill, entityIds);
      this._extractFromColorProperty(props.button.active_fill, entityIds);
      this._extractFromColorProperty(props.button.hover_text_color, entityIds);
      this._extractFromColorProperty(props.button.active_text_color, entityIds);
    }
  }

  private _extractFromColorProperty(colorProp: any, entityIds: Set<string>): void {
    if (colorProp && typeof colorProp === 'object' && colorProp.entity) {
      entityIds.add(colorProp.entity);
    }
  }

  private _checkForSignificantChangesInGroups(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        if (this._elementHasSignificantChanges(element, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private _elementHasSignificantChanges(
    element: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const props = element.props;
    
    return this._hasEntityBasedTextChanges(props, lastHassStates, currentHass) ||
           this._hasEntityBasedColorChanges(props, lastHassStates, currentHass);
  }

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

  private _isEntityBasedColor(colorProp: any): boolean {
    return typeof colorProp === 'string' && colorProp.includes('states[');
  }

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

  private _performDynamicColorCheck(layoutGroups: Group[], hass: HomeAssistant): boolean {
    let needsRefresh = false;
    const elementsToCheck = this._collectElementsForChecking(layoutGroups);
    
    for (const { element } of elementsToCheck) {
      if (this._checkElementEntityChanges(element, hass)) {
        needsRefresh = true;
      }
    }
    
    return needsRefresh;
  }

  private _collectElementsForChecking(layoutGroups: Group[]): Array<{ element: any }> {
    const elementsToCheck: Array<{ element: any }> = [];
    
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        elementsToCheck.push({ element });
      }
    }
    
    return elementsToCheck;
  }

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
   * Resolve a DynamicColorConfig object to a concrete CSS color string.
   * The resolution flow is:
   *   a) If Home Assistant instance or entity is not available, fall back to `default` or provided fallback.
   *   b) Read the entity state (or attribute) and attempt an exact mapping match.
   *   c) If `interpolate` is true and the mapping keys are numeric, perform linear interpolation
   *      between the nearest lower and higher mapping stops.
   *   d) Fallback to `default` then to provided fallback.
   */
  private _resolveDynamicColorValue(
    config: DynamicColorConfig,
    hass: HomeAssistant | undefined,
    fallback: string = 'transparent'
  ): string {
    // Helper to normalise any ColorValue to string (static only – no nested dynamic/stateful)
    const normaliseColor = (value: ColorValue | undefined): string | undefined => {
      if (value === undefined) return undefined;
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.length === 3) {
        return `rgb(${value[0]},${value[1]},${value[2]})`;
      }
      // Nested configs are not allowed here – return undefined to continue fallback chain
      return undefined;
    };

    if (!hass) {
      return normaliseColor(config.default) || fallback;
    }

    const entityStateObj = hass.states[config.entity];
    if (!entityStateObj) {
      return normaliseColor(config.default) || fallback;
    }

    const attrName = config.attribute || 'state';
    // Home Assistant stores the primary state in `state`, attributes in `attributes`
    const rawValue: any = attrName === 'state' ? entityStateObj.state : entityStateObj.attributes?.[attrName];

    // Early exit for undefined value
    if (rawValue === undefined || rawValue === null) {
      return normaliseColor(config.default) || fallback;
    }

    // Try exact match first (stringified)
    const exactMatch = config.mapping[rawValue as keyof typeof config.mapping];
    if (exactMatch !== undefined) {
      return normaliseColor(exactMatch) || fallback;
    }

    // If interpolate disabled, fallback immediately
    if (!config.interpolate) {
      return normaliseColor(config.default) || fallback;
    }

    // Interpolation – only works for numeric keys & numeric rawValue
    const numericValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
    if (Number.isNaN(numericValue)) {
      return normaliseColor(config.default) || fallback;
    }

    // Extract numeric mapping keys & sort
    const numericStops: number[] = Object.keys(config.mapping)
      .map(k => parseFloat(k))
      .filter(v => !Number.isNaN(v))
      .sort((a, b) => a - b);

    if (numericStops.length === 0) {
      return normaliseColor(config.default) || fallback;
    }

    // Identify surrounding stops
    let lower = numericStops[0];
    let upper = numericStops[numericStops.length - 1];

    for (let i = 0; i < numericStops.length; i++) {
      const stop = numericStops[i];
      if (stop <= numericValue) lower = stop;
      if (stop >= numericValue) { upper = stop; break; }
    }

    if (lower === upper) {
      return normaliseColor(config.mapping[String(lower)]) || normaliseColor(config.default) || fallback;
    }

    // Linear interpolation between lower & upper colors
    const lowerColor = this._parseToRgb(normaliseColor(config.mapping[String(lower)]));
    const upperColor = this._parseToRgb(normaliseColor(config.mapping[String(upper)]));

    if (!lowerColor || !upperColor) {
      return normaliseColor(config.default) || fallback;
    }

    const ratio = (numericValue - lower) / (upper - lower);
    const interp = lowerColor.map((c, idx) => Math.round(c + (upperColor[idx] - c) * ratio));
    return `rgb(${interp[0]},${interp[1]},${interp[2]})`;
  }

  /**
   * Parse a CSS hex/rgb string to an RGB triplet. Returns undefined if parsing fails.
   */
  private _parseToRgb(colorStr: string | undefined): [number, number, number] | undefined {
    if (!colorStr) return undefined;

    // Hex formats #RRGGBB or #RGB
    const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colorStr);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex.split('').map(ch => ch + ch).join('');
      }
      const intVal = parseInt(hex, 16);
      return [
        (intVal >> 16) & 255,
        (intVal >> 8) & 255,
        intVal & 255,
      ];
    }

    // rgb(a) format
    const rgbMatch = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(colorStr);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    }

    return undefined;
  }
}

// Export singleton instance for convenient access across the application
export const colorResolver = new ColorResolver();