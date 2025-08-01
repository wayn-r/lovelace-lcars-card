import { ColorValue, DynamicColorConfig, isDynamicColorConfig } from '../types';
import { AnimationContext, animationManager } from './animation';
import { LayoutElementProps } from '../layout/engine';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../layout/engine.js';
import { Color, ColorStateContext, ComputedElementColors, ColorResolutionDefaults } from './color.js';
import yaml from 'js-yaml';
import { EMBEDDED_THEME_YAML } from './embedded-theme.js';

interface ThemeConfig {
  [key: string]: string | Record<string, string>;
}

interface ResolvedThemeColors {
  [key: string]: string;
}

export class ColorResolver {
  private static _resolvedThemeColors: ResolvedThemeColors | null = null;
  private static _themeLoadPromise: Promise<ResolvedThemeColors> | null = null;

  static createLightenExpression(color: string, percent: number): string {
    return `lighten(${color}, ${percent})`;
  }

  static createDarkenExpression(color: string, percent: number): string {
    return `darken(${color}, ${percent})`;
  }

  static calculateLightenedColor(color: string, percent: number): string {
    return ColorResolver.adjustColorBrightness(color, percent);
  }

  static calculateDarkenedColor(color: string, percent: number): string {
    return ColorResolver.adjustColorBrightness(color, -percent);
  }

  static async preloadThemeColors(): Promise<void> {
    await this.getResolvedThemeColors();
  }

  static resolveCssVariable(color: string, element?: Element | null): string {
    if (!this.isCssVariable(color)) {
      return color;
    }

    const varName = this.extractVariableName(color);
    if (!varName) {
      return color;
    }

    const domResolvedColor = this.tryResolvingFromDom(varName, element);
    if (domResolvedColor) {
      return domResolvedColor;
    }

    const themeResolvedColor = this.tryResolvingFromTheme(varName);
    return themeResolvedColor || color;
  }

  static getFallbackColorFromTheme(varName: string): string | undefined {
    const colors = this.getResolvedThemeColorsSync();
    return colors[varName];
  }

  private static getResolvedThemeColorsSync(): ResolvedThemeColors {
    return this._resolvedThemeColors || {};
  }

  private static async getResolvedThemeColors(): Promise<ResolvedThemeColors> {
    if (this._resolvedThemeColors) {
      return this._resolvedThemeColors;
    }

    if (this._themeLoadPromise) {
      return this._themeLoadPromise;
    }

    this._themeLoadPromise = this._loadThemeColors();
    this._resolvedThemeColors = await this._themeLoadPromise;
    this._themeLoadPromise = null;

    return this._resolvedThemeColors;
  }

  private static async _loadThemeColors(): Promise<ResolvedThemeColors> {
    try {
      const embeddedTheme = this._getEmbeddedThemeData();
      if (embeddedTheme) {
        return this._parseThemeYaml(embeddedTheme);
      }

      console.log('Using embedded theme data as fallback');
      return this._parseThemeYaml(EMBEDDED_THEME_YAML);
    } catch (error) {
      console.error('Failed to load theme colors for fallback:', error);
      return {};
    }
  }

  private static _getEmbeddedThemeData(): string | null {
    // Try global variable (for build-time embedding)
    const globalTheme = (globalThis as any).__LCARS_THEME_FALLBACK__;
    if (globalTheme) {
      return globalTheme;
    }

    // Try to read from a script tag (alternative embedding method)
    const scriptTag = document.querySelector('script[data-lcars-theme]');
    if (scriptTag) {
      return scriptTag.textContent || null;
    }

    return null;
  }

  private static _parseThemeYaml(yamlContent: string): ResolvedThemeColors {
    try {
      const themeData = yaml.load(yamlContent) as Record<string, any>;
      
      // Extract the theme configuration (assuming it's under 'lcars_theme')
      const themeKey = 'lcars_theme';
      const themeConfig = themeData[themeKey] as ThemeConfig;
      
      if (!themeConfig) {
        console.warn('No lcars_theme found in theme YAML');
        return {};
      }

      return this._resolveCssVariables(themeConfig);
    } catch (error) {
      console.error('Failed to parse theme YAML:', error);
      return {};
    }
  }

  private static _resolveCssVariables(themeConfig: ThemeConfig): ResolvedThemeColors {
    const resolvedColors: ResolvedThemeColors = {};
    const variableRegex = /var\((--[a-zA-Z0-9-]+)\)/;
    const resolutionStack = new Set<string>();

    const resolveValue = (key: string, value: string): string => {
      if (resolvedColors[key]) {
        return resolvedColors[key];
      }

      if (this._hasCircularReference(key, resolutionStack)) {
        console.warn(`Circular reference detected for theme variable: ${key}`);
        resolvedColors[key] = value;
        return value;
      }

      return this._resolveVariableValue(key, value, themeConfig, resolvedColors, resolutionStack, variableRegex, resolveValue);
    };

    this._processThemeConfig(themeConfig, resolveValue);
    return resolvedColors;
  }

  static isColor(strColor: string): boolean {
    try {
      const s = new Option().style;
      s.color = strColor;
      return s.color !== '';
    } catch (error) {
      // Fallback for test environment or when Option is not available
      // Check for common color formats
      const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(strColor);
      const rgbMatch = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/i.test(strColor);
      const colorNameMatch = /^(red|green|blue|white|black|yellow|cyan|magenta|transparent)$/i.test(strColor);
      return hexMatch || rgbMatch || colorNameMatch;
    }
  }

  static parseColorToRgb(colorStr: string): [number, number, number] | null {
    if (!colorStr) return null;

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

    const rgbMatch = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*[\d.]+)?\)$/i.exec(colorStr);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    }

    return null;
  }

  static convertRgbToHex(rgb: [number, number, number]): string {
    return `#${rgb.map(c => {
      const hex = c.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    }).join('')}`;
  }

  static adjustColorBrightness(color: string, percent: number): string {
    const rgb = ColorResolver.parseColorToRgb(color);
    if (!rgb) return color;

    const amount = Math.floor(255 * (percent / 100));

    const newRgb = rgb.map(c => {
      const newColor = c + amount;
      if (newColor > 255) return 255;
      if (newColor < 0) return 0;
      return newColor;
    }) as [number, number, number];

    return ColorResolver.convertRgbToHex(newRgb);
  }

  resolveAllElementColors(
    elementId: string,
    elementProps: LayoutElementProps,
    animationContext: AnimationContext,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const resolvedDefaults = this.setDefaultColorValues(colorDefaults);
    const colorInstances = this.createColorInstances(elementProps, resolvedDefaults);

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
      fallbackTextColor: 'white'
    }, interactiveState);
    
    return this.buildPropsWithResolvedColors(originalElementProps, computedColors);
  }

  resolveColorsWithoutAnimationContext(
    elementId: string,
    elementProps: LayoutElementProps,
    colorDefaults: ColorResolutionDefaults = {},
    interactiveState: ColorStateContext = {}
  ): ComputedElementColors {
    const basicAnimationContext = this.createBasicAnimationContext(elementId);
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
    if (isDynamicColorConfig(colorValue)) {
      return this.resolveDynamicColorValue(colorValue, animationContext?.hass, fallback);
    }

    const color = Color.withFallback(colorValue, fallback);
    return color.resolve(elementId, animationProperty, animationContext, stateContext);
  }

  scheduleDynamicColorChangeDetection(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number = 25
  ): void {
    if (this.dynamicColorCheckScheduled) {
      return;
    }
    
    this.scheduleColorChangeCheck(layoutGroups, hass, refreshCallback, checkDelay);
  }

  extractEntityIdsFromElement(element: { props?: LayoutElementProps }): Set<string> {
    const entityIds = new Set<string>();
    
    if (!element.props) {
      return entityIds;
    }
    
    this.extractEntityIdsFromColorProperties(element.props, entityIds);
    this.extractEntityIdsFromButtonProperties(element.props, entityIds);
    this.extractEntityIdsFromWidgetProperties(element.props, entityIds);
    
    return entityIds;
  }

  elementEntityStatesChanged(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant
  ): boolean {
    if (!lastHassStates) {
      return false;
    }
    
    return this.checkForSignificantChangesInGroups(layoutGroups, lastHassStates, currentHass);
  }

  clearAllCaches(layoutGroups: Group[]): void {
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        this.clearElementState(element);
      }
    }
  }

  cleanup(): void {
    this.dynamicColorCheckScheduled = false;
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
  }

  private dynamicColorCheckScheduled: boolean = false;
  private refreshTimeout?: ReturnType<typeof setTimeout>;

  private setDefaultColorValues(colorDefaults: ColorResolutionDefaults) {
    return {
      fallbackFillColor: colorDefaults.fallbackFillColor || 'none',
      fallbackStrokeColor: colorDefaults.fallbackStrokeColor || 'none',
      fallbackStrokeWidth: colorDefaults.fallbackStrokeWidth || '0',
      fallbackTextColor: colorDefaults.fallbackTextColor || 'currentColor'
    };
  }

  private createColorInstances(elementProps: LayoutElementProps, resolvedDefaults: ReturnType<typeof this.setDefaultColorValues>) {
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

  private buildPropsWithResolvedColors(
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

  private createBasicAnimationContext(elementId: string): AnimationContext {
    return {
      elementId,
      getShadowElement: undefined,
      hass: undefined,
      requestUpdateCallback: undefined
    };
  }

  private scheduleColorChangeCheck(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number
  ): void {
    this.dynamicColorCheckScheduled = true;
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    this.refreshTimeout = setTimeout(() => {
      this.dynamicColorCheckScheduled = false;
      this.refreshTimeout = undefined;
      
      const needsRefresh = this.performDynamicColorCheck(layoutGroups, hass);
      
      if (needsRefresh) {
        refreshCallback();
      }
    }, checkDelay);
  }

  private clearElementState(element: { cleanupAnimations?: () => void; id: string }): void {
    if (typeof element.cleanupAnimations === 'function') {
      element.cleanupAnimations();
    }
    
    animationManager.cleanupElementAnimationTracking(element.id);
  }

  private extractEntityIdsFromColorProperties(props: LayoutElementProps, entityIds: Set<string>): void {
    this.extractFromColorProperty(props.fill, entityIds);
    this.extractFromColorProperty(props.stroke, entityIds);
    this.extractFromColorProperty(props.textColor, entityIds);
  }

  private extractEntityIdsFromButtonProperties(props: LayoutElementProps, entityIds: Set<string>): void {
    if (props.button) {
      this.extractFromColorProperty(props.button.hover_fill, entityIds);
      this.extractFromColorProperty(props.button.active_fill, entityIds);
      this.extractFromColorProperty(props.button.hover_text_color, entityIds);
      this.extractFromColorProperty(props.button.active_text_color, entityIds);
    }
  }

  private extractEntityIdsFromWidgetProperties(props: LayoutElementProps, entityIds: Set<string>): void {
    if (props.entity) {
      entityIds.add(props.entity);
    }
  }

  private extractFromColorProperty(colorProp: ColorValue, entityIds: Set<string>): void {
    if (colorProp && typeof colorProp === 'object' && 'entity' in colorProp && colorProp.entity) {
      entityIds.add(colorProp.entity);
    }
  }

  private checkForSignificantChangesInGroups(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        if (this.elementHasSignificantChanges(element, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private elementHasSignificantChanges(
    element: { props?: LayoutElementProps },
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    if (!element.props) {
      return false;
    }
    
    return this.hasEntityBasedTextChanges(element.props, lastHassStates, currentHass) ||
           this.hasEntityBasedColorChanges(element.props, lastHassStates, currentHass);
  }

  private hasEntityBasedTextChanges(
    props: LayoutElementProps,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    if (props.text && typeof props.text === 'string') {
      return this.checkEntityReferencesInText(props.text, lastHassStates, currentHass);
    }
    return false;
  }

  private hasEntityBasedColorChanges(
    props: LayoutElementProps,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const colorProps = [props.fill, props.stroke, props.textColor];
    
    for (const colorProp of colorProps) {
      if (this.isEntityBasedColor(colorProp)) {
        if (this.checkEntityReferencesInText(colorProp as string, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private isEntityBasedColor(colorProp: ColorValue): boolean {
    return typeof colorProp === 'string' && colorProp.includes('states[');
  }

  private checkEntityReferencesInText(
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

  private performDynamicColorCheck(layoutGroups: Group[], hass: HomeAssistant): boolean {
    let needsRefresh = false;
    const elementsToCheck = this.collectElementsForChecking(layoutGroups);
    
    for (const { element } of elementsToCheck) {
      if (this.checkElementEntityChanges(element, hass)) {
        needsRefresh = true;
      }
    }
    
    return needsRefresh;
  }

      private collectElementsForChecking(layoutGroups: Group[]): Array<{ element: { entityChangesDetected?: (hass: HomeAssistant) => boolean; id: string } }> {
        const elementsToCheck: Array<{ element: { entityChangesDetected?: (hass: HomeAssistant) => boolean; id: string } }> = [];
    
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        elementsToCheck.push({ element });
      }
    }
    
    return elementsToCheck;
  }

  private checkElementEntityChanges(element: { entityChangesDetected?: (hass: HomeAssistant) => boolean; id: string }, hass: HomeAssistant): boolean {
    try {
      return typeof element.entityChangesDetected === 'function' 
        ? element.entityChangesDetected(hass)
        : false;
    } catch (error) {
      console.warn('Error checking entity changes for element:', element.id, error);
      return false;
    }
  }

  private resolveDynamicColorValue(
    config: DynamicColorConfig,
    hass: HomeAssistant | undefined,
    fallback: string = 'transparent'
  ): string {
    const normaliseColor = (value: ColorValue | undefined): string | undefined => {
      if (value === undefined) return undefined;
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.length === 3) {
        return `rgb(${value[0]},${value[1]},${value[2]})`;
      }
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
    const rawValue: any = attrName === 'state' ? entityStateObj.state : entityStateObj.attributes?.[attrName];

    if (rawValue === undefined || rawValue === null) {
      return normaliseColor(config.default) || fallback;
    }

    const exactMatch = config.mapping[rawValue as keyof typeof config.mapping];
    if (exactMatch !== undefined) {
      return normaliseColor(exactMatch) || fallback;
    }

    if (!config.interpolate) {
      return normaliseColor(config.default) || fallback;
    }

    const numericValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
    if (Number.isNaN(numericValue)) {
      return normaliseColor(config.default) || fallback;
    }

    const numericStops: number[] = Object.keys(config.mapping)
      .map(k => parseFloat(k))
      .filter(v => !Number.isNaN(v))
      .sort((a, b) => a - b);

    if (numericStops.length === 0) {
      return normaliseColor(config.default) || fallback;
    }

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

    const lowerColor = ColorResolver.parseColorToRgb(normaliseColor(config.mapping[String(lower)]) || '');
    const upperColor = ColorResolver.parseColorToRgb(normaliseColor(config.mapping[String(upper)]) || '');

    if (!lowerColor || !upperColor) {
      return normaliseColor(config.default) || fallback;
    }

    const ratio = (numericValue - lower) / (upper - lower);
    const interp = lowerColor.map((c, idx) => Math.round(c + (upperColor[idx] - c) * ratio));
    return `rgb(${interp[0]},${interp[1]},${interp[2]})`;
  }

  private static isCssVariable(color: string): boolean {
    return Boolean(color && color.startsWith('var('));
  }

  private static extractVariableName(color: string): string | null {
    return color.match(/--[a-zA-Z0-9-]+/)?.[0] || null;
  }

  private static tryResolvingFromDom(varName: string, element?: Element | null): string | null {
    if (!element) {
      return null;
    }

    try {
      const resolvedColor = getComputedStyle(element).getPropertyValue(varName).trim();
      return resolvedColor || null;
    } catch (error) {
      return null;
    }
  }

  private static tryResolvingFromTheme(varName: string): string | null {
    return this.getFallbackColorFromTheme(varName.replace(/^--/, '')) || null;
  }

  private static _hasCircularReference(key: string, resolutionStack: Set<string>): boolean {
    return resolutionStack.has(key);
  }

  private static _resolveVariableValue(
    key: string, 
    value: string, 
    themeConfig: ThemeConfig, 
    resolvedColors: ResolvedThemeColors, 
    resolutionStack: Set<string>, 
    variableRegex: RegExp, 
    resolveValue: (key: string, value: string) => string
  ): string {
    resolutionStack.add(key);

    const match = value.match(variableRegex);
    if (match) {
      const varName = match[1];
      const referencedKey = varName.replace(/^--/, '');
      const referencedValue = themeConfig[referencedKey] as string;

      if (referencedValue) {
        const resolved = resolveValue(referencedKey, referencedValue);
        resolvedColors[key] = resolved;
        resolutionStack.delete(key);
        return resolved;
      }
    }

    resolvedColors[key] = value;
    resolutionStack.delete(key);
    return value;
  }

  private static _processThemeConfig(themeConfig: ThemeConfig, resolveValue: (key: string, value: string) => string): void {
    for (const key in themeConfig) {
      if (typeof themeConfig[key] === 'string') {
        resolveValue(key, themeConfig[key] as string);
      } else {
        const subConfig = themeConfig[key] as Record<string, string>;
        for (const subKey in subConfig) {
          resolveValue(subKey, subConfig[subKey]);
        }
      }
    }
  }
}

export const colorResolver = new ColorResolver();

