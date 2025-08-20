import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from '../elements/element.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { Widget } from './widget.js';
import { WidgetRegistry } from './registry.js';
import { VerticalSliderElement, SliderEntityConfig } from '../elements/vertical-slider.js';

export class VerticalSliderWidget extends Widget {
  private sliderElement: VerticalSliderElement;
  private entityConfigs: SliderEntityConfig[] = [];

  constructor(
    id: string,
    props: LayoutElementProps,
    layoutConfig: LayoutConfigOptions,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);

    this.entityConfigs = this._parseEntityConfigs();
    this.sliderElement = new VerticalSliderElement(
      this.id,
      this.props,
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
    this.sliderElement.setEntityConfigs(this.entityConfigs);
  }

  public expand(): LayoutElement[] {
    return [this.sliderElement];
  }

  public updateHass(hass?: HomeAssistant): void {
    this.hass = hass;
    this.sliderElement.updateHass(hass);
  }

  private _parseEntityConfigs(): SliderEntityConfig[] {
    const entityList = Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity];
    const defaultAttribute = typeof (this.props as any).attribute === 'string' ? (this.props as any).attribute : undefined;
    return entityList.reduce<SliderEntityConfig[]>((configs, entry) => {
      if (!entry) return configs;
      if (typeof entry === 'string') {
        configs.push({ id: entry, attribute: defaultAttribute });
        return configs;
      }
      if (typeof entry === 'object' && 'id' in entry) {
        const entityObject = entry as { id: string; color?: string; label?: string; min?: number; max?: number; attribute?: string };
        configs.push({
          id: entityObject.id,
          color: entityObject.color,
          label: entityObject.label,
          min: entityObject.min,
          max: entityObject.max,
          attribute: entityObject.attribute ?? defaultAttribute,
        });
      }
      return configs;
    }, []);
  }
}

WidgetRegistry.registerWidget('vertical-slider', (id, props, layoutConfig, hass, reqUpd, getEl, runtime) => {
  const widget = new VerticalSliderWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  WidgetRegistry.registerInstance(runtime as any, id, widget);
  return widget.expand();
});


