import { RectangleElement } from '../elements/rectangle.js';
import { TextElement } from '../elements/text.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';
import { Button } from '../../utils/button.js';
import { EntityValueResolver } from '../../utils/entity-value-resolver.js';
import { ColorValue } from '../../types.js';
import { HomeAssistant } from 'custom-card-helpers';

export interface EntityTextLabelConfig {
  content?: string;
  width?: number;
  height?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: ColorValue;
  offsetX?: number;
  textTransform?: string;
}

export interface EntityTextValueConfig {
  content?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: ColorValue;
  offsetX?: number;
  textTransform?: string;
}

export interface EntityTextAppearanceConfig {
  fill?: ColorValue;
}

export class EntityTextWidget extends Widget {
  private static readonly LEADING_RECT_WIDTH = 8;
  private static readonly DEFAULT_LABEL_WIDTH = 200;
  private static readonly DEFAULT_LABEL_HEIGHT = 20;
  private static readonly DEFAULT_HEIGHT = 25;
  private static readonly DEFAULT_LABEL_OFFSET_X = 3;
  private static readonly DEFAULT_VALUE_OFFSET_X = 10;

  public expand(): LayoutElement[] {
    const height = this.layoutConfig.height || EntityTextWidget.DEFAULT_HEIGHT;

    const bounds = this.createBoundsElement();
    const leadingRect = this.createLeadingRectangle(bounds, height);
    const labelRect = this.createLabelRectangle(leadingRect, height);
    const valueText = this.createValueText(labelRect, height);

    this.addDefaultLabelInteraction(labelRect);

    // Synchronize hover states between leading and label rectangles
    this.syncHoverStates(leadingRect, labelRect);

    return [bounds, leadingRect, labelRect, valueText];
  }

  private createBoundsElement(): RectangleElement {
    return new RectangleElement(
      this.id,
      { fill: 'none', stroke: 'none' },
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private createLeadingRectangle(bounds: RectangleElement, height: number): RectangleElement {
    const appearanceConfig = this.getAppearanceConfig();
    const baseColor = appearanceConfig.fill || 'var(--lcars-color-entity-text)';
    
    return new RectangleElement(
      `${this.id}_leading_rect`,
      {
        fill: {
          default: baseColor,
          hover: `lighten(${baseColor}, 20)`
        },
        width: EntityTextWidget.LEADING_RECT_WIDTH,
        height: height
      },
      {
        anchor: {
          anchorTo: bounds.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topLeft'
        }
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private createLabelRectangle(leadingRect: RectangleElement, height: number): RectangleElement {
    const labelText = this.resolveLabelText();
    const labelConfig = this.getLabelConfig();
    const appearanceConfig = this.getAppearanceConfig();
    const baseColor = appearanceConfig.fill || 'var(--lcars-color-entity-text)';

    return new RectangleElement(
      `${this.id}_label_rect`,
      {
        fill: {
          default: baseColor,
          hover: `lighten(${baseColor}, 20)`
        },
        width: labelConfig.width || EntityTextWidget.DEFAULT_LABEL_WIDTH,
        height: height,
        text: labelText,
        fontFamily: labelConfig.fontFamily || 'Antonio',
        fontWeight: labelConfig.fontWeight || 'normal',
        textTransform: labelConfig.textTransform || 'uppercase',
        fontSize: labelConfig.height || EntityTextWidget.DEFAULT_LABEL_HEIGHT,
        textAnchor: 'end',
        textOffsetX: -5,
        textColor: labelConfig.fill,
        cutout: true
      },
      {
        anchor: {
          anchorTo: leadingRect.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        },
        offsetX: labelConfig.offsetX || EntityTextWidget.DEFAULT_LABEL_OFFSET_X
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private createValueText(labelRect: RectangleElement, height: number): TextElement {
    const valueConfig = this.getValueConfig();

    const textContent = valueConfig.content || this.resolveValueText();

    const valueText = new TextElement(
      `${this.id}_value_text`,
      {
        text: textContent,
        fill: valueConfig.fill || 'var(--lcars-color-white)',
        fontFamily: valueConfig.fontFamily || 'Antonio',
        fontWeight: valueConfig.fontWeight || 'normal',
        textTransform: valueConfig.textTransform || 'uppercase'
      },
      {
        height: height,
        anchor: {
          anchorTo: labelRect.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        },
        offsetX: valueConfig.offsetX || EntityTextWidget.DEFAULT_VALUE_OFFSET_X
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    // Inject dynamic text updating when content is resolved from an entity.
    if (!valueConfig.content) {
      const entityId = this.props.entity || '';
      const attribute = this.props.attribute || 'state';

      valueText.updateHass = function (this: typeof valueText, hass?: HomeAssistant): void {
        TextElement.prototype.updateHass.call(this, hass);

        const newValue = EntityValueResolver.resolveEntityValue(
          { entity: entityId, attribute, fallback: 'Unavailable' },
          hass
        );

        if (newValue !== (this as unknown as TextElement).props.text) {
          (this as unknown as TextElement).props.text = newValue;
          this.requestUpdateCallback?.();
        }
      } as any;

      // Add entity change detection to integrate with ColorResolver's change detection system
      valueText.entityChangesDetected = function (this: typeof valueText, hass: HomeAssistant): boolean {
        const newValue = EntityValueResolver.resolveEntityValue(
          { entity: entityId, attribute, fallback: 'Unavailable' },
          hass
        );

        const hasChanged = newValue !== (this as unknown as TextElement).props.text;
        
        if (hasChanged) {
          (this as unknown as TextElement).props.text = newValue;
          return true;
        }

        return false;
      } as any;
    }

    return valueText;
  }

  private getLabelConfig(): EntityTextLabelConfig {
    return this.props.label || {};
  }

  private getValueConfig(): EntityTextValueConfig {
    return this.props.value || {};
  }

  private getAppearanceConfig(): EntityTextAppearanceConfig {
    return this.props.appearance || {};
  }

  private resolveLabelText(): string {
    const labelConfig = this.getLabelConfig();
    
    if (labelConfig.content) {
      return labelConfig.content;
    }

    const entityId = this.props.entity || '';
    return EntityValueResolver.resolveEntityFriendlyName(
      entityId,
      this.hass,
      entityId
    );
  }

  private resolveValueText(): string {
    const entityId = this.props.entity || '';
    const attribute = this.props.attribute || 'state';

    return EntityValueResolver.resolveEntityValue(
      {
        entity: entityId,
        attribute: attribute,
        fallback: 'Unavailable'
      },
      this.hass
    );
  }

  private addDefaultLabelInteraction(labelRect: RectangleElement): void {
    const entityId = this.props.entity;
    
    if (!this.hasButtonConfig(labelRect) && entityId) {
      labelRect.props.button = {
        enabled: true,
        actions: {
          tap: {
            action: 'more-info',
            entity: entityId
          }
        }
      };
      
      labelRect.button = new Button(
        labelRect.id,
        labelRect.props,
        this.hass,
        this.requestUpdateCallback,
        this.getShadowElement
      );
    }
  }

  private hasButtonConfig(element: LayoutElement): boolean {
    return Boolean(element.props.button?.enabled);
  }

  /**
   * Links hover state between two rectangles so that hovering over one affects both.
   */
  private syncHoverStates(rect1: RectangleElement, rect2: RectangleElement): void {
    const attachListeners = () => {
      const el1 = this.getShadowElement?.(rect1.id);
      const el2 = this.getShadowElement?.(rect2.id);

      if (!el1 || !el2) {
        // Elements not yet rendered; try again on next animation frame.
        requestAnimationFrame(attachListeners);
        return;
      }

      const enterHandler = (_ev: Event) => {
        rect1.elementIsHovering = true;
        rect2.elementIsHovering = true;
      };

      const leaveHandler = (ev: Event) => {
        const related = (ev as MouseEvent).relatedTarget as Node | null;
        if (related && (el1.contains(related) || el2.contains(related))) {
          return; // Pointer moved within combined area; ignore.
        }
        rect1.elementIsHovering = false;
        rect2.elementIsHovering = false;
      };

      [el1, el2].forEach((el) => {
        el.addEventListener('mouseenter', enterHandler);
        el.addEventListener('mouseleave', leaveHandler);
      });
    };

    attachListeners();
  }
}

WidgetRegistry.registerWidget('entity-text-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new EntityTextWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  return widget.expand();
});