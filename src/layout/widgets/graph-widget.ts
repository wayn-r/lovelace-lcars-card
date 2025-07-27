import { HomeAssistant } from 'custom-card-helpers';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { GraphElement } from '../elements/graph.js';
import { WidgetRegistry } from './registry.js';
import { getSensorHistory, HistoryMap } from '../../utils/data-fetcher.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';

export class GraphWidget extends Widget {
  private graphElement: GraphElement;
  private entityConfigs: { id: string, color?: string }[];
  private entityIds: string[];
  private lastHistory?: HistoryMap;

  constructor(
    id: string,
    props: LayoutElementProps,
    layoutConfig: LayoutConfigOptions,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);

    const rawEntities = Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity];
    this.entityConfigs = rawEntities.map(entity => {
      if (typeof entity === 'string') {
        return { id: entity };
      }
      return entity;
    });

    this.entityIds = this.entityConfigs.map(config => config.id);

    this.graphElement = new GraphElement(
      `${id}_graph`,
      this.props,
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    this.graphElement.setEntityConfigs(this.entityConfigs);
    this.updateHass(hass);
  }

  public expand(): LayoutElement[] {
    return [this.graphElement];
  }

  public updateHass(hass?: HomeAssistant): void {
    if (!hass || !this.entityIds || this.entityIds.length === 0) return;

    this.hass = hass;
    getSensorHistory(this.hass, this.entityIds)
      .then(historyMap => {
        if (JSON.stringify(historyMap) !== JSON.stringify(this.lastHistory)) {
          this.lastHistory = historyMap;
          this.graphElement.setHistory(historyMap);
        }
      })
      .catch(error => {
        const ids = this.entityIds.join(', ');
        console.error(`[GraphWidget] Error fetching history for ${ids}:`, error);
        this.graphElement.setHistory({});
      });
  }
}

WidgetRegistry.registerWidget('graph-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new GraphWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  return widget.expand();
}); 