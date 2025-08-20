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
  private static instances = new Map<import('../../core/runtime.js').CardRuntime, Map<string, import('./widget.js').Widget>>();

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

  static registerInstance(
    runtime: import('../../core/runtime.js').CardRuntime | undefined,
    id: string,
    instance: import('./widget.js').Widget
  ): void {
    if (!runtime) return;
    let map = this.instances.get(runtime);
    if (!map) {
      map = new Map();
      this.instances.set(runtime, map);
    }
    map.set(id, instance);
  }

  static getInstance(
    runtime: import('../../core/runtime.js').CardRuntime | undefined,
    id: string
  ): import('./widget.js').Widget | undefined {
    if (!runtime) return undefined;
    return this.instances.get(runtime)?.get(id);
  }

  static getAllInstances(
    runtime: import('../../core/runtime.js').CardRuntime | undefined
  ): import('./widget.js').Widget[] {
    if (!runtime) return [];
    return Array.from(this.instances.get(runtime)?.values() || []);
  }

  static clearInstances(
    runtime: import('../../core/runtime.js').CardRuntime | undefined
  ): void {
    if (!runtime) return;
    this.instances.delete(runtime);
  }
}

 