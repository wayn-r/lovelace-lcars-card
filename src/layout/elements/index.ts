import { ElementRegistry } from './registry.js';
import { RectangleElement } from './rectangle.js';
import { TextElement } from './text.js';
import { EndcapElement } from './endcap.js';
import { ElbowElement } from './elbow.js';
import { ChiselEndcapElement } from './chisel_endcap.js';
import { WeatherIcon } from '../widgets/weather-icon.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import type { CardRuntime } from '../../core/runtime.js';
import type { LayoutElement } from './element.js';

type ElementConstructor = new (
  id: string,
  props: LayoutElementProps,
  layoutConfig: LayoutConfigOptions,
  hass?: HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null,
  runtime?: CardRuntime
) => LayoutElement;

class ElementRegistrar {
  static register(type: string, ctor: ElementConstructor): void {
    ElementRegistry.registerElement(
      type,
      (id, props, layout, hass, reqUpd, getEl, runtime) => (
        runtime !== undefined
          ? new ctor(id, props, layout, hass, reqUpd, getEl, runtime)
          : new ctor(id, props, layout, hass, reqUpd, getEl)
      )
    );
  }

  static registerAll(entries: Array<[string, ElementConstructor]>): void {
    entries.forEach(([type, ctor]) => this.register(type, ctor));
  }
}

ElementRegistrar.registerAll([
  ['rectangle', RectangleElement],
  ['text', TextElement],
  ['endcap', EndcapElement],
  ['elbow', ElbowElement],
  ['chisel-endcap', ChiselEndcapElement],
  ['weather-icon', WeatherIcon],
]);


