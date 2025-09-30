import { RectangleElement } from '../elements/rectangle.js';
import { TextElement } from '../elements/text.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';
import { Button } from '../../utils/button.js';
import { EntityValueResolver } from '../../utils/entity-value-resolver.js';
import { ColorValue } from '../../types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { FontManager } from '../../utils/font-manager.js';

export interface EntityMetricLabelConfig {
  content?: string;
  width?: number;
  height?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: ColorValue;
  offsetX?: number;
  textTransform?: string;
  cutout?: boolean;
}

export interface EntityMetricValueConfig {
  content?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: ColorValue;
  offsetX?: number;
  textTransform?: string;
}

export interface EntityMetricUnitConfig {
  content?: string;
  width?: number;
  height?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: ColorValue;
  offsetX?: number;
  textTransform?: string;
  cutout?: boolean;
}

export interface EntityMetricAppearanceConfig {
  fill?: ColorValue;
  rounded?: 'left' | 'right' | 'both';
}

export class EntityMetricWidget extends Widget {
  private static readonly DEFAULT_LABEL_WIDTH = 200;
  private static readonly DEFAULT_HEIGHT = 25;
  private static readonly DEFAULT_LABEL_OFFSET_X = 0;
  private static readonly DEFAULT_VALUE_OFFSET_X = 10;
  private static readonly DEFAULT_UNIT_OFFSET_X = 10;
  private static readonly DEFAULT_UNIT_WIDTH = 60;

  public expand(): LayoutElement[] {
    const height = (this.layoutConfig.height as number) || EntityMetricWidget.DEFAULT_HEIGHT;

    const labelConfig = this._getLabelConfig();
    const valueConfig = this._getValueConfig();
    const unitConfig = this._getUnitConfig();

    const labelWidth = labelConfig.width || EntityMetricWidget.DEFAULT_LABEL_WIDTH;
    const unitWidth = unitConfig.width || EntityMetricWidget.DEFAULT_UNIT_WIDTH;
    const unitHeight = unitConfig.height || height;

    const labelOffsetX = labelConfig.offsetX || EntityMetricWidget.DEFAULT_LABEL_OFFSET_X;
    const valueOffsetX = valueConfig.offsetX || EntityMetricWidget.DEFAULT_VALUE_OFFSET_X;
    const unitOffsetX = unitConfig.offsetX || EntityMetricWidget.DEFAULT_UNIT_OFFSET_X;

    const valueTextContent = valueConfig.content || this._resolveValueText();
    const valueFontFamily = valueConfig.fontFamily || 'Antonio';
    const valueFontWeight = (valueConfig.fontWeight as string) || 'bold';
    const valueTextTransform = valueConfig.textTransform || 'uppercase';

    const metrics = FontManager.getFontMetrics(valueFontFamily, valueFontWeight);
    const capHeightRatio = Math.abs(metrics?.capHeight ?? 0);
    const valueFontSize = capHeightRatio > 0 ? (height / capHeightRatio) : (height);
    const measuredValueWidth = FontManager.measureTextWidth(valueTextContent || '', {
      fontFamily: valueFontFamily,
      fontSize: valueFontSize,
      fontWeight: valueFontWeight,
      letterSpacing: 'normal',
      textTransform: valueTextTransform,
    } as any);

    const boundsWidth = labelOffsetX + labelWidth + valueOffsetX + measuredValueWidth + unitOffsetX + unitWidth;
    const boundsHeight = Math.max(height, unitHeight);

    const bounds = this._createBoundsElement(boundsWidth, boundsHeight);
    const labelRect = this._createLabelPill(bounds, height);
    const valueText = this._createValueText(labelRect, height);
    const unitRect = this._createUnitPill(valueText, height);

    this._unifyButtonActions(labelRect, valueText, unitRect);
    this._syncHoverAcrossElements([labelRect, valueText, unitRect]);

    return [bounds, labelRect, valueText, unitRect];
  }

  private _createBoundsElement(width?: number, height?: number): RectangleElement {
    const layoutConfig = {
      ...this.layoutConfig,
      width: width ?? this.layoutConfig.width,
      height: height ?? this.layoutConfig.height,
    } as any;
    return new RectangleElement(
      this.id,
      { fill: 'none', stroke: 'none' },
      layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private _createLabelPill(bounds: RectangleElement, height: number): RectangleElement {
    const labelText = this._resolveLabelText();
    const labelConfig = this._getLabelConfig();
    const baseColor = this._resolveBaseColor();
    const cornerRadii = this._resolveCornerRadii('label', height);

    return new RectangleElement(
      `${this.id}_label_pill`,
      {
        fill: { default: baseColor, hover: `lighten(${baseColor}, 20)` },
        width: labelConfig.width || EntityMetricWidget.DEFAULT_LABEL_WIDTH,
        cornerRadii,
        text: labelText,
        fontFamily: labelConfig.fontFamily || 'Antonio',
        fontWeight: labelConfig.fontWeight || 'normal',
        textTransform: labelConfig.textTransform || 'uppercase',
        fontSize: labelConfig.height || height * 0.8,
        textAnchor: 'end',
        textOffsetX: -8,
        textColor: labelConfig.fill,
        cutout: this._isCutoutEnabled(labelConfig),
      },
      {
        anchor: {
          anchorTo: bounds.id,
          anchorPoint: 'top-left',
          targetAnchorPoint: 'top-left',
        },
        offsetX: labelConfig.offsetX || EntityMetricWidget.DEFAULT_LABEL_OFFSET_X,
        height,
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private _createValueText(labelRect: RectangleElement, height: number): TextElement {
    const valueConfig = this._getValueConfig();
    const textContent = valueConfig.content || this._resolveValueText();

    const valueText = new TextElement(
      `${this.id}_value_text`,
      {
        text: textContent,
        fill: valueConfig.fill || this._resolveBaseColor(),
        textColor: {
          default: valueConfig.fill || this._resolveBaseColor(),
          hover: `lighten(${valueConfig.fill || this._resolveBaseColor()}, 20)`
        },
        fontFamily: valueConfig.fontFamily || 'Antonio',
        fontWeight: valueConfig.fontWeight || 'bold',
        textTransform: valueConfig.textTransform || 'uppercase',
      },
      {
        height,
        anchor: {
          anchorTo: labelRect.id,
          anchorPoint: 'top-left',
          targetAnchorPoint: 'top-right',
        },
        offsetX: valueConfig.offsetX || EntityMetricWidget.DEFAULT_VALUE_OFFSET_X,
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    if (!valueConfig.content) {
      const entityIds = Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity || ''];
      const attribute = this.props.attribute || 'state';

      valueText.updateHass = function (this: typeof valueText, hass?: HomeAssistant): void {
        TextElement.prototype.updateHass.call(this, hass);

        let combinedValue: string;
        if (entityIds.length === 2) {
          const value1 = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[0] as any), attribute, fallback: 'Unavailable' },
            hass
          );
          const value2 = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[1] as any), attribute, fallback: 'Unavailable' },
            hass
          );
          combinedValue = `${value1} (${value2})`;
        } else {
          combinedValue = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[0] as any), attribute, fallback: 'Unavailable' },
            hass
          );
        }

        if (combinedValue !== (this as unknown as TextElement).props.text) {
          (this as unknown as TextElement).props.text = combinedValue;
          this.requestUpdateCallback?.();
        }
      } as any;

      valueText.entityChangesDetected = function (this: typeof valueText, hass: HomeAssistant): boolean {
        let combinedValue: string;
        if (entityIds.length === 2) {
          const value1 = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[0] as any), attribute, fallback: 'Unavailable' },
            hass
          );
          const value2 = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[1] as any), attribute, fallback: 'Unavailable' },
            hass
          );
          combinedValue = `${value1} (${value2})`;
        } else {
          combinedValue = EntityValueResolver.resolveEntityValue(
            { entity: String(entityIds[0] as any), attribute, fallback: 'Unavailable' },
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

  private _createUnitPill(valueText: TextElement, height: number): RectangleElement {
    const unitConfig = this._getUnitConfig();
    const baseColor = this._resolveBaseColor();
    const unitHeight = unitConfig.height || height;
    const cornerRadii = this._resolveCornerRadii('unit', unitHeight);

    const unitText = unitConfig.content || this._resolveUnitText();

    return new RectangleElement(
      `${this.id}_unit_pill`,
      {
        fill: { default: baseColor, hover: `lighten(${baseColor}, 20)` },
        width: unitConfig.width || EntityMetricWidget.DEFAULT_UNIT_WIDTH,
        cornerRadii,
        text: unitText,
        fontFamily: unitConfig.fontFamily || 'Antonio',
        fontWeight: unitConfig.fontWeight || 'bold',
        fontSize: Math.round(unitHeight * 0.62),
        dominantBaseline: 'middle',
        textTransform: unitConfig.textTransform || 'uppercase',
        textAnchor: 'start',
        textOffsetX: 10,
        textOffsetY: Math.round(unitHeight * 0.12),
        textColor: unitConfig.fill,
        cutout: this._isCutoutEnabled(unitConfig),
      },
      {
        anchor: {
          anchorTo: valueText.id,
          anchorPoint: 'top-left',
          targetAnchorPoint: 'top-right',
        },
        offsetX: unitConfig.offsetX || EntityMetricWidget.DEFAULT_UNIT_OFFSET_X,
        height: unitHeight,
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private _resolveBaseColor(): string {
    const appearanceConfig = this._getAppearanceConfig();
    return String(appearanceConfig.fill || 'var(--lcars-color-entity-metric)');
  }

  private _resolveCornerRadii(which: 'label' | 'unit', height: number): { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number } {
    const appearanceConfig = this._getAppearanceConfig();
    const rounded = appearanceConfig.rounded; // default: no rounding when undefined
    const r = Math.max(1, Math.floor(height / 2));

    if (which === 'label') {
      const roundLeft = rounded === 'left' || rounded === 'both';
      return {
        topLeft: roundLeft ? r : 0,
        bottomLeft: roundLeft ? r : 0,
        topRight: 0,
        bottomRight: 0,
      };
    } else {
      const roundRight = rounded === 'right' || rounded === 'both';
      return {
        topLeft: 0,
        bottomLeft: 0,
        topRight: roundRight ? r : 0,
        bottomRight: roundRight ? r : 0,
      };
    }
  }

  private _getLabelConfig(): EntityMetricLabelConfig {
    return this.props.label || {};
  }

  private _getValueConfig(): EntityMetricValueConfig {
    return this.props.value || {};
  }

  private _getUnitConfig(): EntityMetricUnitConfig {
    return this.props.unit || {};
  }

  private _getAppearanceConfig(): EntityMetricAppearanceConfig {
    return this.props.appearance || {};
  }

  private _resolveLabelText(): string {
    const labelConfig = this._getLabelConfig();
    if (labelConfig.content) return labelConfig.content;

    const entityId = String(Array.isArray(this.props.entity) ? (this.props.entity[0] as any) : (this.props.entity as any) || '');
    return EntityValueResolver.resolveEntityFriendlyName(entityId, this.hass, entityId);
  }

  private _resolveValueText(): string {
    const entityIds = (Array.isArray(this.props.entity) ? this.props.entity : [this.props.entity || '']).map(e => String(e as any));
    const attribute = this.props.attribute || 'state';

    if (entityIds.length === 2) {
      const value1 = EntityValueResolver.resolveEntityValue({ entity: entityIds[0], attribute, fallback: 'Unavailable' }, this.hass);
      const value2 = EntityValueResolver.resolveEntityValue({ entity: entityIds[1], attribute, fallback: 'Unavailable' }, this.hass);
      return `${value1} (${value2})`;
    }
    return EntityValueResolver.resolveEntityValue({ entity: entityIds[0], attribute, fallback: 'Unavailable' }, this.hass);
  }

  private _resolveUnitText(): string {
    const entityId = String(Array.isArray(this.props.entity) ? (this.props.entity[0] as any) : (this.props.entity as any) || '');
    if (!entityId) return '';
    const raw = EntityValueResolver.readEntityRaw(this.hass as HomeAssistant, entityId, 'unit_of_measurement');
    return String(raw || '').toUpperCase();
  }

  private _addDefaultLabelInteraction(labelRect: RectangleElement): void {
    const entityId = Array.isArray(this.props.entity) ? this.props.entity[0] : this.props.entity;
    if (!this._hasButtonConfig(labelRect) && entityId) {
      labelRect.props.button = {
        enabled: true,
        actions: { tap: { action: 'more-info', entity: entityId } },
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

  private _hasButtonConfig(element: LayoutElement): boolean {
    return Boolean(element.props.button?.enabled);
  }

  private _syncHoverAcrossElements(elements: LayoutElement[]): void {
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
        if (isWithinAny(related)) return;
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

  private _unifyButtonActions(labelRect: LayoutElement, valueText: LayoutElement, unitRect: LayoutElement): void {
    const entityId = String(Array.isArray(this.props.entity) ? (this.props.entity[0] as any) : (this.props.entity as any));

    const primary = (this._hasButtonConfig(labelRect) && labelRect) ||
                    (this._hasButtonConfig(unitRect) && unitRect) ||
                    (this._hasButtonConfig(valueText) && valueText) ||
                    null;

    if (!primary && entityId && entityId !== 'undefined' && entityId !== '') {
      (labelRect.props as any).button = {
        enabled: true,
        actions: { tap: { action: 'more-info', entity: entityId } },
      };
      labelRect.button = new Button(
        labelRect.id,
        labelRect.props,
        this.hass,
        this.requestUpdateCallback,
        this.getShadowElement
      );
    }

    const source = (this._hasButtonConfig(labelRect) && labelRect) ||
                   (this._hasButtonConfig(unitRect) && unitRect) ||
                   (this._hasButtonConfig(valueText) && valueText) ||
                   (entityId && entityId !== 'undefined' && entityId !== '' ? labelRect : null);

    const buttonConfig = source ? (source.props as any).button : undefined;

    [labelRect, valueText, unitRect].forEach((el) => {
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

  private _isCutoutEnabled(config: { cutout?: boolean; fill?: ColorValue }): boolean {
    if (typeof config.cutout === 'boolean') return config.cutout;
    return config.fill === undefined; // if a text fill is provided, use non-cutout text by default
  }
}

WidgetRegistry.registerWidget('entity-metric-widget', (id, props, layoutConfig, hass, reqUpd, getEl, runtime) => {
  const widget = new EntityMetricWidget(id, props, layoutConfig, hass, reqUpd, getEl, runtime as any);
  WidgetRegistry.registerInstance(runtime as any, id, widget);
  return widget.expand();
});


