import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../elements/element.js';
import { CardRuntime } from '../../core/runtime.js';

/**
 * Base class for compound widgets that expand into one or more primitive LayoutElements.
 * Widgets are *not* LayoutElements themselves – they simply return the primitives
 * that participate in normal layout calculation.
 */
export abstract class Widget {
  protected id: string;
  protected props: LayoutElementProps;
  protected layoutConfig: LayoutConfigOptions;
  protected hass?: HomeAssistant;
  protected requestUpdateCallback?: () => void;
  protected getShadowElement?: (id: string) => Element | null;
  protected runtime?: CardRuntime;

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null,
    runtime?: CardRuntime
  ) {
    this.id = id;
    this.props = props;
    this.layoutConfig = layoutConfig;
    this.hass = hass;
    this.requestUpdateCallback = requestUpdateCallback;
    this.getShadowElement = getShadowElement;
    this.runtime = runtime;
  }

  public abstract expand(): LayoutElement[];
  public onResize(_containerRect?: DOMRect): void {}
  public updateHass(hass?: HomeAssistant): void {
    this.hass = hass;
  }
  public destroy(): void {}
} 