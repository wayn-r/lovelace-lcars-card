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
    const height = (typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : undefined) || EntityTextWidget.DEFAULT_HEIGHT;

    const bounds = this.createBoundsElement();
    const leadingRect = this.createLeadingRectangle(bounds, height);
    const labelRect = this.createLabelRectangle(leadingRect, height);
    const valueText = this.createValueText(labelRect, height as number);

    this.unifyButtonActions(leadingRect, labelRect, valueText);

    this.syncHoverAcrossElements([leadingRect, labelRect, valueText]);

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

    const baseValueFill = valueConfig.fill;
    const baseValueTextColor = valueConfig.fill; // preserve tests expecting props.fill while using textColor for hover
    const defaultTextColor = baseValueTextColor || 'var(--lcars-color-white)';
    const hoverTextColor = baseValueTextColor
      ? `lighten(${defaultTextColor}, 20)`
      : `darken(${defaultTextColor}, 20)`;
    const valueText = new TextElement(
      `${this.id}_value_text`,
      {
        text: textContent,
        // Keep fill as provided (tests assert this), drive hover via textColor
        fill: baseValueFill !== undefined ? baseValueFill : 'var(--lcars-color-white)',
        textColor: {
          default: defaultTextColor,
          hover: hoverTextColor
        },
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
      const entityIds = (Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity || '']).map(e => String(e as any));
      const attribute = this.props.attribute || 'state';

      valueText.updateHass = function (this: typeof valueText, hass?: HomeAssistant): void {
        TextElement.prototype.updateHass.call(this, hass);

        let combinedValue: string;
        if (entityIds.length === 2) {
            const value1 = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[0], attribute, fallback: 'Unavailable' },
                hass
            );
            const value2 = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[1], attribute, fallback: 'Unavailable' },
                hass
            );
            combinedValue = `${value1} (${value2})`;
        } else {
            combinedValue = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[0], attribute, fallback: 'Unavailable' },
                hass
            );
        }

        if (combinedValue !== (this as unknown as TextElement).props.text) {
          (this as unknown as TextElement).props.text = combinedValue;
          this.requestUpdateCallback?.();
        }
      } as any;

      // Add entity change detection to integrate with ColorResolver's change detection system
      valueText.entityChangesDetected = function (this: typeof valueText, hass: HomeAssistant): boolean {
        let combinedValue: string;
        if (entityIds.length === 2) {
            const value1 = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[0], attribute, fallback: 'Unavailable' },
                hass
            );
            const value2 = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[1], attribute, fallback: 'Unavailable' },
                hass
            );
            combinedValue = `${value1} (${value2})`;
        } else {
            combinedValue = EntityValueResolver.resolveEntityValue(
                { entity: entityIds[0], attribute, fallback: 'Unavailable' },
                hass
            );
        }

        const hasChanged = combinedValue !== (this as unknown as TextElement).props.text;
        
        if (hasChanged) {
          (this as unknown as TextElement).props.text = combinedValue;
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

    const entityId = Array.isArray(this.props.entity)
      ? String(this.props.entity[0] ?? '')
      : String(this.props.entity ?? '');
    return EntityValueResolver.resolveEntityFriendlyName(
      entityId,
      this.hass,
      entityId
    );
  }

  private resolveValueText(): string {
    const entityIds = (Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity || '']).map(e => String(e as any));
    const attribute = this.props.attribute || 'state';
    
    if (entityIds.length === 2) {
        const value1 = EntityValueResolver.resolveEntityValue(
            { entity: entityIds[0], attribute, fallback: 'Unavailable' },
            this.hass
        );
        const value2 = EntityValueResolver.resolveEntityValue(
            { entity: entityIds[1], attribute, fallback: 'Unavailable' },
            this.hass
        );
        return `${value1} (${value2})`;
    } else {
        return EntityValueResolver.resolveEntityValue(
            { entity: entityIds[0], attribute, fallback: 'Unavailable' },
            this.hass
        );
    }
  }

  private addDefaultInteraction(element: LayoutElement): void {
    const entityId = String(Array.isArray(this.props.entity) ? (this.props.entity[0] as any) : (this.props.entity as any));
    if (this.hasButtonConfig(element)) return;
    if (!entityId || entityId === 'undefined') return;

    (element.props as any).button = {
      enabled: true,
      actions: {
        tap: {
          action: 'more-info',
          entity: entityId
        }
      }
    };

    element.button = new Button(
      element.id,
      element.props,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private unifyButtonActions(leadingRect: LayoutElement, labelRect: LayoutElement, valueText: LayoutElement): void {
    const primary = (this.hasButtonConfig(labelRect) && labelRect) ||
                    (this.hasButtonConfig(leadingRect) && leadingRect) ||
                    (this.hasButtonConfig(valueText) && valueText) ||
                    null;

    if (!primary) {
      this.addDefaultInteraction(labelRect);
    }

    const entityId = String(Array.isArray(this.props.entity) ? (this.props.entity[0] as any) : (this.props.entity as any));
    const source = (this.hasButtonConfig(labelRect) && labelRect) ||
                   (this.hasButtonConfig(leadingRect) && leadingRect) ||
                   (this.hasButtonConfig(valueText) && valueText) ||
                   (entityId && entityId !== 'undefined' && entityId !== '' ? labelRect : null);

    const buttonConfig = source ? (source.props as any).button : undefined;

    [leadingRect, labelRect, valueText].forEach((el) => {
      if (buttonConfig) {
        (el.props as any).button = buttonConfig;
        el.button = new Button(
          el.id,
          el.props,
          this.hass,
          this.requestUpdateCallback,
          this.getShadowElement
        );
      }
    });
  }

  private hasButtonConfig(element: LayoutElement): boolean {
    return Boolean(element.props.button?.enabled);
  }

  /**
   * Links hover state between two rectangles so that hovering over one affects both.
   */
  private syncHoverAcrossElements(elements: LayoutElement[]): void {
    const attachListeners = () => {
      const domEls = elements.map(e => this.getShadowElement?.(e.id) as Element | null);
      if (domEls.some(d => !d)) {
        requestAnimationFrame(attachListeners);
        return;
      }

      const isWithinAny = (node: Node | null): boolean => {
        if (!node) return false;
        return domEls.some(el => el && el.contains(node));
      };

      const enterHandler = (_ev: Event) => {
        elements.forEach(e => { e.elementIsHovering = true; });
      };

      const leaveHandler = (ev: Event) => {
        const related = (ev as MouseEvent).relatedTarget as Node | null;
        if (isWithinAny(related)) {
          return;
        }
        elements.forEach(e => { e.elementIsHovering = false; });
      };

      domEls.forEach((el) => {
        if (!el) return;
        el.addEventListener('mouseenter', enterHandler);
        el.addEventListener('mouseleave', leaveHandler);
      });
    };

    attachListeners();
  }
}

WidgetRegistry.registerWidget('entity-text-widget', (id, props, layoutConfig, hass, reqUpd, getEl, runtime) => {
  const widget = new EntityTextWidget(id, props, layoutConfig, hass, reqUpd, getEl, runtime as any);
  WidgetRegistry.registerInstance(runtime as any, id, widget);
  return widget.expand();
});