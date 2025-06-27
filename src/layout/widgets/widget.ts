import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../elements/element.js';

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

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    this.id = id;
    this.props = props;
    this.layoutConfig = layoutConfig;
    this.hass = hass;
    this.requestUpdateCallback = requestUpdateCallback;
    this.getShadowElement = getShadowElement;
  }

  public abstract expand(): LayoutElement[];
} 