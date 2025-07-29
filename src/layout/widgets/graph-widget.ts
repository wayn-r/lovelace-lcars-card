import { HomeAssistant } from 'custom-card-helpers';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { GraphElement, RichEntityConfig, lineGradients } from '../elements/graph.js';
import { RectangleElement } from '../elements/rectangle.js';
import { WidgetRegistry } from './registry.js';
import { getSensorHistory, HistoryMap } from '../../utils/data-fetcher.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { stateManager } from '../../utils/state-manager.js';
import { ColorResolver } from '../../utils/color-resolver.js';
import { EntityValueResolver } from '../../utils/entity-value-resolver.js';

interface GraphButtonDimensions {
  width: number;
  height: number;
  spacing: number;
  startYOffset: number;
}

interface GraphButtonConfig {
  entityConfig: RichEntityConfig;
  index: number;
  dimensions: GraphButtonDimensions;
  parentGraphId: string;
}

class GraphButtonFactory {
  static createToggleButton(
    config: GraphButtonConfig,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null,
    originalIndex?: number
  ): RectangleElement {
    const { entityConfig, index, dimensions, parentGraphId } = config;
    
    const stateName = `${parentGraphId}_${entityConfig.id}_visible`;
    const colorIndex = originalIndex ?? index;
    const buttonColor = this.determineButtonColor(entityConfig, colorIndex);
    
    const buttonProps = this.createButtonProps(buttonColor, entityConfig.id, stateName, dimensions.height);
    const layoutConfig = this.createButtonLayoutConfig(dimensions, index, parentGraphId);
    
    return new RectangleElement(
      `${parentGraphId}_button_${index}`,
      buttonProps,
      layoutConfig,
      hass,
      requestUpdateCallback,
      getShadowElement
    );
  }

  /**
   * Calculates optimal button dimensions to fit within the available graph height.
   * Automatically reduces button height when too many buttons would exceed the graph bounds.
   */
  static calculateButtonDimensions(
    numButtons: number,
    graphHeight: number,
    defaultButtonHeight: number = 36,
    buttonSpacing: number = 10,
    minButtonHeight: number = 20
  ): GraphButtonDimensions {
    if (numButtons === 0) {
      return { width: 180, height: defaultButtonHeight, spacing: buttonSpacing, startYOffset: 0 };
    }

    let buttonHeight = defaultButtonHeight;
    const requiredHeight = (numButtons * buttonHeight) + (Math.max(0, numButtons - 1) * buttonSpacing);

    if (requiredHeight > graphHeight) {
      const availableHeightForButtons = graphHeight - (Math.max(0, numButtons - 1) * buttonSpacing);
      buttonHeight = Math.max(minButtonHeight, availableHeightForButtons / numButtons);
    }

    const totalButtonsHeight = (numButtons * buttonHeight) + (Math.max(0, numButtons - 1) * buttonSpacing);
    const startYOffset = (graphHeight - totalButtonsHeight) / 2;

    return {
      width: 180,
      height: buttonHeight,
      spacing: buttonSpacing,
      startYOffset
    };
  }

  private static determineButtonColor(entityConfig: RichEntityConfig, index: number): string {
    return entityConfig.color || lineGradients[index % lineGradients.length].color;
  }

  private static createButtonProps(
    buttonColor: string,
    entityId: string,
    stateName: string,
    buttonHeight: number
  ): LayoutElementProps {
    return {
      fill: {
        default: buttonColor,
        hover: `lighten(${buttonColor}, 20)`,
        toggled_off: `darken(${buttonColor}, 40)`,
        toggled_off_hover: `lighten(darken(${buttonColor}, 40), 20)`,
        state_map: {
          "hidden": "toggled_off"
        },
        state_name: stateName,
      },
      cornerRadius: buttonHeight / 2,
      text: EntityValueResolver.formatEntityIdAsDisplayText(entityId),
      textColor: "white",
      fontSize: 16,
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontFamily: "Antonio, sans-serif",
      textTransform: "uppercase",
      cutout: true,
      button: {
        enabled: true,
        actions: {
          tap: {
            action: "toggle_state",
            target_element_ref: stateName,
            states: ["visible", "hidden"]
          }
        }
      }
    };
  }

  private static createButtonLayoutConfig(
    dimensions: GraphButtonDimensions,
    index: number,
    parentGraphId: string
  ): LayoutConfigOptions {
    const currentYOffset = dimensions.startYOffset + (index * (dimensions.height + dimensions.spacing));

    return {
      width: dimensions.width,
      height: dimensions.height,
      anchor: {
        anchorTo: parentGraphId,
        anchorPoint: 'topLeft',
        targetAnchorPoint: 'topRight',
      },
      offsetX: 20,
      offsetY: currentYOffset,
    };
  }
}

export class GraphWidget extends Widget {
  private graphElement: GraphElement;
  private entityConfigs: RichEntityConfig[] = [];
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

    this.entityConfigs = this.parseEntityConfigs();
    this.entityIds = this.entityConfigs.map(config => config.id);
    this.initializeEntityStates();
    this.createGraphElement();
    this.updateHass(hass);
  }

  public expand(): LayoutElement[] {
    const toggleableButtons = this.getToggleableEntityConfigs();
    
    if (toggleableButtons.length === 0) {
      return [this.graphElement];
    }

    const dimensions = GraphButtonFactory.calculateButtonDimensions(
      toggleableButtons.length,
      this.determineGraphHeight()
    );

    const buttonElements = toggleableButtons.map((config, index) => {
      const originalIndex = this.entityConfigs.findIndex(c => c.id === config.id);
      return GraphButtonFactory.createToggleButton(
        {
          entityConfig: config,
          index,
          dimensions,
          parentGraphId: this.id
        },
        this.hass,
        this.requestUpdateCallback,
        this.getShadowElement,
        originalIndex
      );
    });

    return [this.graphElement, ...buttonElements];
  }

  public updateHass(hass?: HomeAssistant): void {
    if (!this.hasValidEntityConfiguration(hass)) return;

    this.hass = hass;
    this.fetchAndUpdateHistory();
  }

  private parseEntityConfigs(): RichEntityConfig[] {
    const rawEntities = Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity];
    return rawEntities.map(entity => 
      typeof entity === 'string' ? { id: entity } : entity
    );
  }

  private initializeEntityStates(): void {
    this.entityConfigs.forEach(config => {
      const stateName = `${this.id}_${config.id}_visible`;
      if (stateManager.getState(stateName) === undefined) {
        stateManager.registerState(stateName, "visible");
      }
    });
  }

  private createGraphElement(): void {
    this.graphElement = new GraphElement(
      this.id,
      this.props,
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
    this.graphElement.setEntityConfigs(this.entityConfigs);
  }

  private getToggleableEntityConfigs(): RichEntityConfig[] {
    return this.entityConfigs.filter(config => config.toggleable !== false);
  }

  private determineGraphHeight(): number {
    return typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : 200;
  }

  private hasValidEntityConfiguration(hass?: HomeAssistant): boolean {
    return !!(hass && this.entityIds && this.entityIds.length > 0);
  }

  private fetchAndUpdateHistory(): void {
    getSensorHistory(this.hass!, this.entityIds)
      .then(historyMap => {
        if (this.historyHasChanged(historyMap)) {
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

  private historyHasChanged(newHistory: HistoryMap): boolean {
    return JSON.stringify(newHistory) !== JSON.stringify(this.lastHistory);
  }
}

WidgetRegistry.registerWidget('graph-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new GraphWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  return widget.expand();
}); 