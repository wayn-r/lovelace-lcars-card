export type WidgetFactory = (
  id: string,
  props: import('../engine.js').LayoutElementProps,
  layoutConfig: import('../engine.js').LayoutConfigOptions,
  hass?: import('custom-card-helpers').HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null
) => import('../elements/element.js').LayoutElement[];

const registry = new Map<string, WidgetFactory>();

/**
 * Register a widget factory under a type name (case-insensitive).
 */
export function registerWidget(type: string, factory: WidgetFactory): void {
  registry.set(type.trim().toLowerCase(), factory);
}

/**
 * Expand a widget of the given type if a factory is registered. Returns null if unknown.
 */
export function expandWidget(
  type: string,
  id: string,
  props: import('../engine.js').LayoutElementProps = {},
  layoutConfig: import('../engine.js').LayoutConfigOptions = {},
  hass?: import('custom-card-helpers').HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null
): import('../elements/element.js').LayoutElement[] | null {
  const factory = registry.get(type.trim().toLowerCase());
  if (!factory) return null;
  return factory(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
} 