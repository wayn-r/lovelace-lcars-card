export type WidgetFactory = (
  id: string,
  props: import('../engine.js').LayoutElementProps,
  layoutConfig: import('../engine.js').LayoutConfigOptions,
  hass?: import('custom-card-helpers').HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null,
  runtime?: import('../../core/runtime.js').CardRuntime
) => import('../elements/element.js').LayoutElement[];

export class WidgetRegistry {
  private static registry = new Map<string, WidgetFactory>();

  static registerWidget(type: string, factory: WidgetFactory): void {
    this.registry.set(type.trim().toLowerCase(), factory);
  }

  static expandWidget(
    type: string,
    id: string,
    props: import('../engine.js').LayoutElementProps = {},
    layoutConfig: import('../engine.js').LayoutConfigOptions = {},
    hass?: import('custom-card-helpers').HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null,
    runtime?: import('../../core/runtime.js').CardRuntime
  ): import('../elements/element.js').LayoutElement[] | null {
    const factory = this.registry.get(type.trim().toLowerCase());
    if (!factory) return null;
    return factory(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement, runtime);
  }
}

 