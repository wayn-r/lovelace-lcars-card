import { ColorValue, DynamicColorConfig, isDynamicColorConfig, isStatefulColorConfig, ColorStateContext, ComputedElementColors, ColorResolutionDefaults, StatefulColorConfig } from '../types.js';
import { AnimationContext } from './animation';
import { LayoutElementProps } from '../layout/engine';
import { HomeAssistant } from 'custom-card-helpers';
import { EntityValueResolver } from './entity-value-resolver';
import { Group } from '../layout/engine.js';
import yaml from 'js-yaml';
import { EMBEDDED_THEME_YAML } from './embedded-theme.js';

export type ColorChain = string & {
  withDom(ctx: Element | null): ColorChain;
  withAnimation(id: string, prop: 'fill' | 'stroke' | 'textColor', ctx: AnimationContext): ColorChain;
  withState(ctx: ColorStateContext): ColorChain;
  withHass(hass: HomeAssistant): ColorChain;
  withStateAccessor(accessor: (name: string) => string | undefined): ColorChain;
  withFallback(color: string): ColorChain;
};

interface ThemeConfig {
  [key: string]: string | Record<string, string>;
}

interface ResolvedThemeColors {
  [key: string]: string;
}

interface ResolveColorOptions {
  elementId?: string;
  animationProperty?: 'fill' | 'stroke' | 'textColor';
  animationContext?: AnimationContext;
  stateContext?: ColorStateContext;
  hass?: HomeAssistant;
  context?: Element | { themeOnly: true } | null;
  fallback?: string;
  stateAccessor?: (name: string) => string | undefined;
}

export class ColorResolver {
  private stateAccessor?: (name: string) => string | undefined;
  private static _resolvedThemeColors: ResolvedThemeColors | null = null;
  private static _themeLoadPromise: Promise<ResolvedThemeColors> | null = null;
  private elementIdToEntityIds: Map<string, Set<string>> = new Map();
  private entityIdToElementIds: Map<string, Set<string>> = new Map();

  // Removed unused expression helpers in favor of a single brightness adjuster

  static async preloadThemeColors(): Promise<void> {
    await this._getResolvedThemeColors();
  }

  setStateAccessor(accessor: (name: string) => string | undefined): void {
    this.stateAccessor = accessor;
  }

  static resolve(value: string | ColorValue | DynamicColorConfig): ColorChain {
    const options: ResolveColorOptions & { value: string | ColorValue | DynamicColorConfig } = {
      value,
      fallback: 'transparent'
    } as any;

    const builder: any = {
      withDom(context: Element | null) {
        options.context = context;
        return builder as ColorChain;
      },
      withAnimation(id: string, property: 'fill' | 'stroke' | 'textColor', ctx: AnimationContext) {
        options.elementId = id;
        options.animationProperty = property;
        options.animationContext = ctx;
        return builder as ColorChain;
      },
      withState(state: ColorStateContext) {
        options.stateContext = state;
        return builder as ColorChain;
      },
      withHass(hass: HomeAssistant) {
        options.hass = hass;
        return builder as ColorChain;
      },
      withStateAccessor(accessor: (name: string) => string | undefined) {
        options.stateAccessor = accessor;
        return builder as ColorChain;
      },
      withFallback(color: string) {
        options.fallback = color;
        return builder as ColorChain;
      },
      toString() {
        return ColorResolver._internalResolve(options.value, options);
      },
      valueOf() {
        return ColorResolver._internalResolve(options.value, options);
      }
    };

    return builder as ColorChain;
  }



  private static _internalResolve(
    colorOrConfig: string | DynamicColorConfig | ColorValue,
    options: ResolveColorOptions = {}
  ): string {
    const {
      elementId,
      animationContext,
      stateContext,
      hass,
      context,
      fallback = 'transparent'
    } = options;

    if (elementId) {
      const effectiveContext = context ?? animationContext?.getShadowElement?.(elementId) ?? null;
      const nestedOptions: ResolveColorOptions = { ...options, context: effectiveContext, hass: animationContext?.hass || hass };
      delete (nestedOptions as any).elementId;
      delete (nestedOptions as any).animationProperty;
      delete (nestedOptions as any).animationContext;
      return this._internalResolve(colorOrConfig as any, nestedOptions);
    }

    if (Array.isArray(colorOrConfig)) {
      const normalized = this._normalizeToString(colorOrConfig);
      return normalized || fallback;
    }

    if (typeof colorOrConfig === 'object' && isDynamicColorConfig(colorOrConfig)) {
      return this._resolveDynamicColor(colorOrConfig, hass, fallback);
    }

    if (typeof colorOrConfig === 'object' && isStatefulColorConfig(colorOrConfig)) {
      return this._resolveStatefulColor(colorOrConfig, options, fallback);
    }

    if (typeof colorOrConfig !== 'string') {
      const normalized = this._normalizeToString(colorOrConfig as any);
      return normalized || fallback;
    }

    const color = colorOrConfig as string;

    if (this._isCssVar(color)) {
      return this._resolveCssVariable(color, context);
    }

    if (this._isDynamicJsonString(color)) {
      try {
        const config = JSON.parse(color) as DynamicColorConfig;
        if (isDynamicColorConfig(config)) {
          return this._resolveDynamicColor(config, hass, fallback);
        }
      } catch {
      }
    }

    const trimmedColor = color.trim();

    const lightenMatch = trimmedColor.match(/^lighten\((.+),\s*(\d+%?)\)$/);
    if (lightenMatch) {
      const baseColor = this._internalResolve(lightenMatch[1], options);
      const percent = parseFloat(lightenMatch[2]);
      return this.adjustColorBrightness(baseColor, percent);
    }

    const darkenMatch = trimmedColor.match(/^darken\((.+),\s*(\d+%?)\)$/);
    if (darkenMatch) {
      const baseColor = this._internalResolve(darkenMatch[1], options);
      const percent = parseFloat(darkenMatch[2]);
      return this.adjustColorBrightness(baseColor, -percent);
    }

    return trimmedColor;
  }

  static _resolveCssVariable(
    color: string,
    elementOrContext?: Element | { themeOnly: true } | null
  ): string {
    const varName = this._extractCssVarName(color);
    if (!varName) {
      return color;
    }

    if (elementOrContext && typeof elementOrContext === 'object' && 'themeOnly' in elementOrContext) {
      const themeResolvedColor = this._getFallbackColorFromTheme(varName.replace(/^--/, ''));
      return themeResolvedColor || color;
    }

    if (elementOrContext && 'tagName' in elementOrContext) {
      try {
        const resolvedColor = getComputedStyle(elementOrContext as Element).getPropertyValue(varName).trim();
        if (resolvedColor) {
          return resolvedColor;
        }
      } catch (error) {
      }
    }

    const themeResolvedColor = this._getFallbackColorFromTheme(varName.replace(/^--/, ''));
    return themeResolvedColor || color;
  }

  private static _resolveDynamicColor(
    config: DynamicColorConfig,
    hass: HomeAssistant | undefined,
    fallback: string
  ): string {
    if (!hass) {
      return this._normalizeToString(config.default) || fallback;
    }

    const rawValue = this._readEntityValue(config, hass);
    if (rawValue === undefined || rawValue === null) {
      return this._normalizeToString(config.default) || fallback;
    }

    const exactMatch = config.mapping[rawValue as keyof typeof config.mapping];
    if (exactMatch !== undefined) {
      return this._normalizeToString(exactMatch) || fallback;
    }

    const hasNumericMapping = Object.keys(config.mapping).some(key => !Number.isNaN(parseFloat(key)));
    if (!hasNumericMapping) {
      return this._normalizeToString(config.default) || fallback;
    }

    const numericValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
    if (Number.isNaN(numericValue)) {
      return this._normalizeToString(config.default) || fallback;
    }

    return this._interpolateColor(config, numericValue, fallback);
  }

  private static _interpolateColor(config: DynamicColorConfig, numericValue: number, fallback: string): string {
    const numericStops: number[] = Object.keys(config.mapping)
      .map(k => parseFloat(k))
      .filter(v => !Number.isNaN(v))
      .sort((a, b) => a - b);

    if (numericStops.length === 0) {
      return this._normalizeToString(config.default) || fallback;
    }

    let lower = numericStops[0];
    let upper = numericStops[numericStops.length - 1];

    for (let i = 0; i < numericStops.length; i++) {
      const stop = numericStops[i];
      if (stop <= numericValue) lower = stop;
      if (stop >= numericValue) { upper = stop; break; }
    }

    if (lower === upper) {
      return this._normalizeToString(config.mapping[String(lower)]) || this._normalizeToString(config.default) || fallback;
    }

    const lowerColor = ColorResolver.parseColorToRgb(this._normalizeToString(config.mapping[String(lower)]) || '');
    const upperColor = ColorResolver.parseColorToRgb(this._normalizeToString(config.mapping[String(upper)]) || '');

    if (!lowerColor || !upperColor) {
      return this._normalizeToString(config.default) || fallback;
    }

    const ratio = (numericValue - lower) / (upper - lower);
    const interp = lowerColor.map((c, idx) => Math.round(c + (upperColor[idx] - c) * ratio));
    return `rgb(${interp[0]},${interp[1]},${interp[2]})`;
  }

  static _getFallbackColorFromTheme(varName: string): string | undefined {
    const colors = this._getResolvedThemeColorsSync();
    return colors[varName];
  }

  private static _getResolvedThemeColorsSync(): ResolvedThemeColors {
    return this._resolvedThemeColors || {};
  }

  private static async _getResolvedThemeColors(): Promise<ResolvedThemeColors> {
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
    const globalTheme = (globalThis as any).__LCARS_THEME_FALLBACK__;
    if (globalTheme) {
      return globalTheme;
    }

    const scriptTag = document.querySelector('script[data-lcars-theme]');
    if (scriptTag) {
      return scriptTag.textContent || null;
    }

    return null;
  }

  private static _parseThemeYaml(yamlContent: string): ResolvedThemeColors {
    try {
      const themeData = yaml.load(yamlContent) as Record<string, any>;
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
      if (resolvedColors[key]) return resolvedColors[key];
      
      if (resolutionStack.has(key)) {
        console.warn(`Circular reference detected for theme variable: ${key}`);
        return resolvedColors[key] = value;
      }

      resolutionStack.add(key);
      const match = value.match(variableRegex);
      
      if (match) {
        const referencedKey = match[1].replace(/^--/, '');
        const referencedValue = themeConfig[referencedKey] as string;
        if (referencedValue) {
          const resolved = resolveValue(referencedKey, referencedValue);
          resolutionStack.delete(key);
          return resolvedColors[key] = resolved;
        }
      }

      resolutionStack.delete(key);
      return resolvedColors[key] = value;
    };

    for (const [key, value] of Object.entries(themeConfig)) {
      if (typeof value === 'string') {
        resolveValue(key, value);
      } else if (value && typeof value === 'object') {
        for (const [subKey, subValue] of Object.entries(value as Record<string, string>)) {
          resolveValue(subKey, subValue);
        }
      }
    }

    return resolvedColors;
  }

  static isColor(strColor: string): boolean {
    try {
      const s = new Option().style;
      s.color = strColor;
      return s.color !== '';
    } catch (error) {
      const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(strColor);
      const rgbMatch = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/i.test(strColor);
      const colorNameMatch = /^(red|green|blue|white|black|yellow|cyan|magenta|transparent)$/i.test(strColor);
      return hexMatch || rgbMatch || colorNameMatch;
    }
  }

  static parseColorToRgb(colorStr: string): [number, number, number] | null {
    if (!colorStr) return null;

    const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colorStr);
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
    const resolvedDefaults = this._getResolvedDefaults(colorDefaults);
    const dom = animationContext.getShadowElement?.(elementId) ?? null;

    const resolve = (value: any, property: 'fill' | 'stroke' | 'textColor', fallback: string) => {
      let chain: any = ColorResolver
        .resolve(value as any)
        .withFallback(fallback)
        .withDom(dom)
        .withAnimation(elementId, property, animationContext)
        .withState(interactiveState);
      if (this.stateAccessor) {
        chain = chain.withStateAccessor(this.stateAccessor);
      }
      return String(chain);
    };

    const fillColor = elementProps.fill !== undefined
      ? resolve(elementProps.fill, 'fill', resolvedDefaults.fallbackFillColor)
      : resolvedDefaults.fallbackFillColor;

    const strokeColor = elementProps.stroke !== undefined
      ? resolve(elementProps.stroke, 'stroke', resolvedDefaults.fallbackStrokeColor)
      : resolvedDefaults.fallbackStrokeColor;

    const textColor = elementProps.textColor !== undefined
      ? resolve(elementProps.textColor, 'textColor', resolvedDefaults.fallbackTextColor)
      : resolvedDefaults.fallbackTextColor;

    return {
      fillColor,
      strokeColor,
      strokeWidth: elementProps.strokeWidth?.toString() ?? resolvedDefaults.fallbackStrokeWidth,
      textColor
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
    
    return this._buildPropsWithResolvedColors(originalElementProps, computedColors);
  }

  extractEntityIds(input: any): Set<string> {
    const entityIds = new Set<string>();
    const props = input?.props || input;
    if (!props) return entityIds;

    const extractFromColor = (colorProp: ColorValue | undefined) => {
      if (colorProp && typeof colorProp === 'object' && 'entity' in colorProp && colorProp.entity) {
        entityIds.add(colorProp.entity);
      }
    };

    extractFromColor(props.fill);
    extractFromColor(props.stroke);
    extractFromColor(props.textColor);

    if (props.grid) {
      extractFromColor(props.grid.fill);
      extractFromColor(props.grid.label_fill);
    }

    if (props.button) {
      extractFromColor(props.button.hover_fill);
      extractFromColor(props.button.active_fill);
      extractFromColor(props.button.hover_text_color);
      extractFromColor(props.button.active_text_color);
    }

    if (props.entity) {
      const entityProp = props.entity as unknown;
      if (typeof entityProp === 'string') {
        entityIds.add(entityProp);
      } else if (Array.isArray(entityProp)) {
        for (const entry of entityProp) {
          if (typeof entry === 'string') {
            entityIds.add(entry);
          } else if (entry && typeof entry === 'object' && 'id' in entry && typeof (entry as any).id === 'string') {
            entityIds.add((entry as any).id);
          }
        }
      } else if (entityProp && typeof entityProp === 'object' && 'id' in entityProp && typeof (entityProp as any).id === 'string') {
        entityIds.add((entityProp as any).id);
      }
    }

    if (typeof props.text === 'string') {
      const fromText = ColorResolver._extractEntityRefsFromTextStatic(props.text);
      fromText.forEach(id => entityIds.add(id));
    }

    return entityIds;
  }

  buildEntityDependencyIndex(layoutGroups: Group[]): void {
    this.elementIdToEntityIds.clear();
    this.entityIdToElementIds.clear();
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        const deps = this.extractEntityIds(element);
        this._indexElementEntityDeps(element.id, deps);
      }
    }
  }

  processHassChange(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant,
    refreshCallback: () => void
  ): void {
    if (!lastHassStates || !currentHass) {
      return;
    }

    if (this.elementIdToEntityIds.size === 0 || this.entityIdToElementIds.size === 0) {
      this.buildEntityDependencyIndex(layoutGroups);
    }

    const changedEntities = this._calculateChangedEntities(lastHassStates, currentHass);
    if (changedEntities.size === 0) {
      return;
    }

    const impactedElementIds = new Set<string>();
    changedEntities.forEach(entityId => {
      const elements = this.entityIdToElementIds.get(entityId);
      if (elements) {
        elements.forEach(elId => impactedElementIds.add(elId));
      }
    });

    if (impactedElementIds.size === 0) {
      return;
    }

    const elementsById = new Map<string, any>();
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        elementsById.set(element.id, element);
      }
    }

    let needsRefresh = false;
    impactedElementIds.forEach(elementId => {
      const element = elementsById.get(elementId);
      if (element && typeof element.entityChangesDetected === 'function') {
        try {
          if (element.entityChangesDetected(currentHass)) {
            needsRefresh = true;
          }
        } catch (error) {
          // ignore element-level errors for change detection
        }
      }
    });

    if (needsRefresh) {
      refreshCallback();
    }
  }

  elementEntityStatesChanged(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant
  ): boolean {
    if (!lastHassStates) {
      return false;
    }

    return this._checkForSignificantChangesInGroups(layoutGroups, lastHassStates, currentHass);
  }

  cleanup(): void {
    this.elementIdToEntityIds.clear();
    this.entityIdToElementIds.clear();
  }

  private _getResolvedDefaults(colorDefaults: ColorResolutionDefaults) {
    return {
      fallbackFillColor: colorDefaults.fallbackFillColor || 'none',
      fallbackStrokeColor: colorDefaults.fallbackStrokeColor || 'none',
      fallbackStrokeWidth: colorDefaults.fallbackStrokeWidth || '0',
      fallbackTextColor: colorDefaults.fallbackTextColor || 'currentColor'
    };
  }

  private _buildPropsWithResolvedColors(
    originalElementProps: LayoutElementProps, 
    computedColors: ComputedElementColors
  ): LayoutElementProps {
    return {
      ...originalElementProps,
      ...(originalElementProps.fill !== undefined && { fill: computedColors.fillColor }),
      ...(originalElementProps.stroke !== undefined && { stroke: computedColors.strokeColor }),
      ...(originalElementProps.textColor !== undefined && { textColor: computedColors.textColor })
    };
  }

  private _indexElementEntityDeps(elementId: string, entityIds: Set<string>): void {
    this.elementIdToEntityIds.set(elementId, new Set(entityIds));
    entityIds.forEach(entityId => {
      const set = this.entityIdToElementIds.get(entityId) || new Set<string>();
      set.add(elementId);
      this.entityIdToElementIds.set(entityId, set);
    });
  }

  private _calculateChangedEntities(
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): Set<string> {
    const changed = new Set<string>();
    const trackedEntities = Array.from(this.entityIdToElementIds.keys());
    for (const entityId of trackedEntities) {
      const oldEntity = lastHassStates[entityId];
      const newEntity = currentHass.states[entityId];
      if (!oldEntity && !newEntity) {
        continue;
      }
      if (!oldEntity || !newEntity) {
        changed.add(entityId);
        continue;
      }
      if (oldEntity.state !== newEntity.state) {
        changed.add(entityId);
        continue;
      }
      const oldAttrs = oldEntity.attributes || {};
      const newAttrs = newEntity.attributes || {};
      if (JSON.stringify(oldAttrs) !== JSON.stringify(newAttrs)) {
        changed.add(entityId);
      }
    }
    return changed;
  }

  private _checkForSignificantChangesInGroups(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        if (element.props && this._hasElementChanges(element.props, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    return false;
  }

  private _hasElementChanges(
    props: LayoutElementProps,
    lastStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    if (props.text && typeof props.text === 'string' && 
        ColorResolver._textContainsChangedEntityRef(props.text, lastStates, currentHass)) {
      return true;
    }

    const colorProps = [props.fill, props.stroke, props.textColor];
    return colorProps.some(colorProp => 
      typeof colorProp === 'string' && 
      colorProp.includes('states[') && 
      ColorResolver._textContainsChangedEntityRef(colorProp, lastStates, currentHass)
    );
  }

  private _performDynamicColorCheck(layoutGroups: Group[], hass: HomeAssistant): boolean {
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        try {
          if (typeof element.entityChangesDetected === 'function' && 
              element.entityChangesDetected(hass)) {
            return true;
          }
        } catch (error) {
          console.warn('Error checking entity changes for element:', element.id, error);
        }
      }
    }
    return false;
  }

  private static _extractEntityRefsFromTextStatic(text: string): Set<string> {
    const set = new Set<string>();
    if (!text || typeof text !== 'string') {
      return set;
    }
    const matches = text.match(/states\['([^']+)'\]/g);
    if (!matches) {
      return set;
    }
    for (const match of matches) {
      const m = match.match(/states\['([^']+)'\]/);
      if (m && m[1]) {
        set.add(m[1]);
      }
    }
    return set;
  }
  private static _resolveStatefulColor(
    config: StatefulColorConfig,
    options: ResolveColorOptions,
    fallback: string
  ): string {
    const selectedColorValue = this._resolveStateBasedColorValue(
      config,
      options.stateContext,
      options.stateAccessor
    );
    if (selectedColorValue !== undefined) {
      return this._internalResolve(selectedColorValue, options);
    }
    return fallback;
  }

  private static _resolveStateBasedColorValue(
    statefulConfig: StatefulColorConfig,
    stateContext?: ColorStateContext,
    stateAccessor?: (name: string) => string | undefined
  ): ColorValue | undefined {
    if (this._shouldUseActiveState(statefulConfig, stateContext)) {
      return statefulConfig.active;
    }

    const stateMapColor = this._resolveFromStateMap(statefulConfig, stateContext, stateAccessor);
    if (stateMapColor !== undefined) {
      return stateMapColor;
    }

    if (this._shouldUseHoverState(statefulConfig, stateContext)) {
      return statefulConfig.hover;
    }

    return statefulConfig.default;
  }

  private static _shouldUseActiveState(config: StatefulColorConfig, stateContext?: ColorStateContext): boolean {
    return !!(stateContext?.isCurrentlyActive && config.active !== undefined);
  }

  private static _shouldUseHoverState(config: StatefulColorConfig, stateContext?: ColorStateContext): boolean {
    return !!(stateContext?.isCurrentlyHovering && config.hover !== undefined);
  }

  private static _resolveFromStateMap(
    config: StatefulColorConfig,
    stateContext?: ColorStateContext,
    stateAccessor?: (name: string) => string | undefined
  ): ColorValue | undefined {
    if (!config.state_name || !config.state_map) {
      return undefined;
    }

    const currentState = stateAccessor ? stateAccessor(config.state_name) : undefined;
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

  private static _normalizeToString(value: ColorValue | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length === 3 && value.every(component => typeof component === 'number')) {
      return `rgb(${value[0]},${value[1]},${value[2]})`;
    }
    return undefined;
  }

  private static _extractCssVarName(color: string): string | null {
    return color.match(/--[a-zA-Z0-9-]+/)?.[0] || null;
  }

  private static _isCssVar(color: string): boolean {
    return Boolean(color && color.startsWith('var('));
  }

  private static _isDynamicJsonString(color: string): boolean {
    return color.startsWith('{') && color.includes('entity');
  }

  private static _readEntityValue(config: DynamicColorConfig, hass: HomeAssistant): any {
    return EntityValueResolver.readEntityRaw(hass, config.entity, config.attribute);
  }

  private static _textContainsChangedEntityRef(
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
        if (oldState !== newState) return true;
      }
    }
    return false;
  }
}
export const colorResolver = new ColorResolver();