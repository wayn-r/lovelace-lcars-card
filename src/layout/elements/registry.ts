import type { HomeAssistant } from 'custom-card-helpers';
import type { LayoutElement } from './element.js';
import type { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import type { CardRuntime } from '../../core/runtime.js';

export type ElementFactory = (
  id: string,
  props: LayoutElementProps,
  layoutConfig: LayoutConfigOptions,
  hass?: HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null,
  runtime?: CardRuntime
) => LayoutElement;

export class ElementRegistry {
  private static registry = new Map<string, ElementFactory>();

  static registerElement(type: string, factory: ElementFactory): void {
    const normalizedType = type.trim().toLowerCase();
    this.registry.set(normalizedType, factory);
  }

  static createElement(
    type: string,
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null,
    runtime?: CardRuntime
  ): LayoutElement | null {
    const normalizedType = type.trim().toLowerCase();
    const factory = this.registry.get(normalizedType);
    if (!factory) return null;
    return factory(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement, runtime);
  }
}


