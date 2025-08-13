import { svg, SVGTemplateResult } from 'lit';
import { LayoutElement } from './element.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { HomeAssistant } from 'custom-card-helpers';
import { EntityValueResolver } from '../../utils/entity-value-resolver.js';
import { ColorResolver } from '../../utils/color-resolver.js';
import { lineGradients } from './graph.js';
import { ColorValue } from '../../types.js';
import { EntityControlService } from '../../utils/entity-service-manager.js';
import { animationManager } from '../../utils/animation.js';

export interface SliderEntityConfig {
  id: string;
  color?: string;
  label?: string;
  min?: number;
  max?: number;
  attribute?: string;
}

export class VerticalSliderElement extends LayoutElement {
  private entityConfigs: SliderEntityConfig[] = [];
  private lastValues: Record<string, number> = {};
  private dragValues: Record<string, number | undefined> = {};
  private isDragging: boolean = false;
  private activeIndex: number | null = null;
  private boundDown?: (e: Event) => void;
  private boundMove?: (e: Event) => void;
  private boundUp?: (e: Event) => void;
  private listenersAttached = false;
  private updateQueued = false;
  private pulsingLabels: Set<string> = new Set();

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
  }

  public setEntityConfigs(configs: SliderEntityConfig[]): void {
    this.entityConfigs = configs || [];
    this._scheduleRequestUpdate();
  }

  updateHass(hass?: HomeAssistant): void {
    super.updateHass(hass);
    if (this._entityValuesChanged()) this._scheduleRequestUpdate();
  }

  private _entityValuesChanged(): boolean {
    if (!this.hass) return false;
    let changed = false;
    const epsilon = this._epsilon();
    for (const cfg of this.entityConfigs) {
      const key = this._configKey(cfg);
      const optimistic = EntityControlService.resolveOptimisticNumericValue(this.hass, cfg);
      const num = (optimistic !== undefined)
        ? optimistic
        : EntityValueResolver.readEntityNumeric(this.hass, cfg.id, cfg.attribute);
      if (!isNaN(num)) {
        const prev = this.lastValues[key];
        if (prev === undefined || Math.abs(prev - num) > epsilon) {
          this.lastValues[key] = num;
          changed = true;
        }
      }

      const range = EntityValueResolver.readEntityNumericRange(this.hass, cfg.id, cfg.attribute);
      const minKey = `${this._configKey(cfg)}::__min`;
      const maxKey = `${this._configKey(cfg)}::__max`;
      const prevMin = this.lastValues[minKey];
      const prevMax = this.lastValues[maxKey];
      const nextMin = typeof range.min === 'number' ? range.min : NaN;
      const nextMax = typeof range.max === 'number' ? range.max : NaN;
      if (!isNaN(nextMin)) {
        if (prevMin === undefined || Math.abs(prevMin - nextMin) > epsilon) {
          this.lastValues[minKey] = nextMin;
          changed = true;
        }
      }
      if (!isNaN(nextMax)) {
        if (prevMax === undefined || Math.abs(prevMax - nextMax) > epsilon) {
          this.lastValues[maxKey] = nextMax;
          changed = true;
        }
      }
    }
    return changed;
  }

  protected renderShape(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;
    const count = Math.max(1, this.entityConfigs.length);

    const spacing = typeof this.props.spacing === 'number' ? this.props.spacing : 14;
    const labelAreaHeight = typeof this.props.label_height === 'number' ? this.props.label_height : 28;
    const topPadding = typeof this.props.top_padding === 'number' ? this.props.top_padding : 6;
    const segments = this.props.grid?.num_lines ?? 8;

    const availableWidth = Math.max(1, this.layout.width - (count - 1) * spacing);
    const trackWidth = availableWidth / count;
    const trackHeight = Math.max(1, this.layout.height - labelAreaHeight - topPadding);

    const connectorColor = this._resolveColor(this.props.grid?.fill, 'var(--lcars-color-vertical-slider-background)');
    const labelColor = this._resolveColor(this.props.grid?.label_fill ?? this.props.text?.fill, connectorColor);

    const connectorHeight = 6;
    const connectorsWidth = count * trackWidth + (count - 1) * spacing;
    const connectorsX = this.layout.x;
    const topConnectorY = this.layout.y;
    const extensionGap = 2;
    const labelFontSize = 18;
    const labelBaselinePadding = 6;
    const bottomExtensionHeight = Math.max(0, labelAreaHeight - connectorHeight - labelFontSize - labelBaselinePadding - extensionGap);
    const bottomExtensionY = this.layout.y + topPadding + trackHeight + extensionGap;
    const bottomConnectorY = bottomExtensionY + bottomExtensionHeight;

    const textCfg = this.props.text || {};
    const valueFontFamily = textCfg.fontFamily || 'Antonio, sans-serif';
    const valueFontSize = (textCfg.fontSize || 18);
    const valueFontWeight = (textCfg.fontWeight || 'bold');
    const valueTextTransform = textCfg.textTransform || 'uppercase';
    const textFillProvided = textCfg.fill !== undefined;
    const valueCutout = (textCfg.cutout !== undefined) ? Boolean(textCfg.cutout) : !textFillProvided;
    const overlayValueColor = this._resolveColor(textCfg.fill as unknown as ColorValue, 'var(--lcars-color-white)');

    const groups: SVGTemplateResult[] = [];
    const maskDefs: SVGTemplateResult[] = [];
    const connectorExtensions: SVGTemplateResult[] = [];
    const overlayValueTexts: SVGTemplateResult[] = [];
    const labelTexts: SVGTemplateResult[] = [];
    const labelsToPulseStart: Array<{ id: string; base: string; dark: string }> = [];
    const labelsToPulseStop: Array<{ id: string; base: string }> = [];

    for (let i = 0; i < count; i++) {
      const cfg = this.entityConfigs[i] || this.entityConfigs[0];
      const baseX = this.layout.x + i * (trackWidth + spacing);
      const baseY = this.layout.y + topPadding;

      const key = this._configKey(cfg);
      const liveDrag = (this.isDragging && this.activeIndex === i && this.dragValues[key] !== undefined)
        ? (this.dragValues[key] as number)
        : undefined;
      const optimistic = EntityControlService.resolveOptimisticNumericValue(this.hass, cfg);
      const liveValue = EntityValueResolver.readEntityNumeric(this.hass, cfg.id, cfg.attribute);
      const rawValue = liveDrag !== undefined
        ? liveDrag
        : (optimistic !== undefined
            ? optimistic
            : liveValue);
      const value = this._maybeSnapValue(rawValue);
      const { min, max } = this._resolveMinMax(cfg);
      const clamped = Math.max(min, Math.min(max, value));
      const ratio = max > min ? (clamped - min) / (max - min) : 0;
      const fillHeight = trackHeight * ratio;
      const fillColor = this._resolveEntityColor(cfg, i);
      const trackBackground = ColorResolver.adjustColorBrightness(fillColor, -50);

      const label = (cfg.label || EntityValueResolver.resolveEntityFriendlyName(cfg.id, this.hass, cfg.id) || cfg.id).toUpperCase();
      const valueText = this._formatValueForDisplay(value);

      const segmentLines: SVGTemplateResult[] = [];
      if (segments > 0) {
        const total = segments;
        const logBase = Math.log(total + 1);
        for (let s = 0; s < total; s++) {
          const segmentPositionNormalized = Math.log(s + 2) / logBase;
          const segmentY = Math.round(baseY + trackHeight * (1 - segmentPositionNormalized)) + 0.5;
          segmentLines.push(svg`
            <line x1="${baseX}" y1="${segmentY}" x2="${baseX + trackWidth}" y2="${segmentY}"
                  stroke="black" stroke-opacity="0.9" stroke-width="0.8" />
          `);
        }
      }

      const topExtensionHeight = Math.max(0, topPadding - extensionGap);
      const valueCenterX = baseX + trackWidth / 2;
      const valueCenterY = bottomExtensionY + bottomExtensionHeight / 2;
      connectorExtensions.push(svg`
        <rect x="${baseX}" y="${topConnectorY + connectorHeight}" width="${trackWidth}" height="${topExtensionHeight}" fill="${connectorColor}" shape-rendering="crispEdges" />
      `);
      if (bottomExtensionHeight > 0) {
        if (valueText && valueCutout) {
          const extMaskId = `${this.id}__slider_${i}__value_mask`;
          maskDefs.push(svg`
            <mask id="${extMaskId}">
              <rect x="${baseX}" y="${bottomExtensionY}" width="${trackWidth}" height="${bottomExtensionHeight}" fill="white" />
              <text x="${valueCenterX}" y="${valueCenterY}"
                fill="black"
                text-anchor="middle" dominant-baseline="middle" dy="0.1em"
                font-family="${valueFontFamily}" font-size="${valueFontSize}" font-weight="${valueFontWeight}"
                style="text-transform: ${valueTextTransform}; pointer-events: none;">
                ${valueText}
              </text>
            </mask>
          `);
          connectorExtensions.push(svg`
            <rect x="${baseX}" y="${bottomExtensionY}" width="${trackWidth}" height="${bottomExtensionHeight}" fill="${connectorColor}" mask="url(#${extMaskId})" shape-rendering="crispEdges" />
          `);
        } else {
          connectorExtensions.push(svg`
            <rect x="${baseX}" y="${bottomExtensionY}" width="${trackWidth}" height="${bottomExtensionHeight}" fill="${connectorColor}" shape-rendering="crispEdges" />
          `);
          if (valueText) {
            overlayValueTexts.push(svg`
              <text x="${valueCenterX}" y="${valueCenterY}"
                fill="${overlayValueColor}"
                text-anchor="middle" dominant-baseline="middle"
                font-family="${valueFontFamily}" font-size="${valueFontSize}" font-weight="${valueFontWeight}"
                style="text-transform: ${valueTextTransform}; pointer-events: none;">
                ${valueText}
              </text>
            `);
          }
        }
      }

      const sliderGroup = svg`
        <g id="${this.id}__slider_${i}">
          <rect id="${this.id}__slider_${i}__track" x="${baseX}" y="${baseY}" width="${trackWidth}" height="${trackHeight}"
                rx="0" ry="0"
                fill="${trackBackground}" stroke="none" />
          <rect id="${this.id}__slider_${i}__fill" x="${baseX}" y="${baseY + (trackHeight - fillHeight)}" width="${trackWidth}" height="${fillHeight}"
                rx="0" ry="0"
                fill="${fillColor}" stroke="none" />
          ${segmentLines}
        </g>
      `;
      groups.push(sliderGroup);

      const labelId = `${this.id}__slider_${i}__label`;
      const awaiting = (!this.isDragging)
        && optimistic !== undefined
        && isFinite(liveValue)
        && Math.abs((optimistic as number) - (liveValue as number)) > this._epsilon();
      if (awaiting) {
        const dark = ColorResolver.adjustColorBrightness(labelColor, -35);
        labelsToPulseStart.push({ id: labelId, base: labelColor, dark });
      } else {
        labelsToPulseStop.push({ id: labelId, base: labelColor });
      }
      labelTexts.push(svg`
        <text id="${labelId}" x="${baseX + trackWidth / 2}" y="${this.layout.y + this.layout.height - 6}"
              text-anchor="middle" dominant-baseline="auto"
              font-family="Antonio, sans-serif" font-size="${labelFontSize}" font-weight="bold" fill="${labelColor}" style="text-transform: uppercase; pointer-events: none;">
          ${label}
        </text>
      `);
    }

    const connectors = svg`
      <g style="pointer-events: none;">
        <defs>${maskDefs}</defs>
        <rect x="${connectorsX}" y="${topConnectorY}" width="${connectorsWidth}" height="${connectorHeight}" fill="${connectorColor}" shape-rendering="crispEdges" />
        ${connectorExtensions}
        <rect x="${connectorsX}" y="${bottomConnectorY}" width="${connectorsWidth}" height="${connectorHeight}" fill="${connectorColor}" shape-rendering="crispEdges" />
      </g>
    `;

    requestAnimationFrame(() => this._applyLabelPulseAnimations(labelsToPulseStart, labelsToPulseStop));
    return svg`<g>${groups}${connectors}<g style="pointer-events:none;">${overlayValueTexts}${labelTexts}</g></g>`;
  }

  private _resolveEntityColor(cfg: SliderEntityConfig, index: number): string {
    const baseColor = cfg.color || lineGradients[index % lineGradients.length].color;
    return ColorResolver
      .resolve(baseColor)
      .withDom(this.getShadowElement?.(this.id) ?? null)
      .toString();
  }


  public setupInteractiveListeners(): void {
    super.setupInteractiveListeners();
    if (!this.getShadowElement) return;
    const root = this.getShadowElement(this.id);
    if (!root) return;
    if (this.listenersAttached) return;

    if (!this.boundDown) this.boundDown = this._handlePointerDown.bind(this) as any;
    if (!this.boundMove) this.boundMove = this._handlePointerMove.bind(this) as any;
    if (!this.boundUp) this.boundUp = this._handlePointerUp.bind(this) as any;

    root.addEventListener('mousedown', this.boundDown!, { passive: false } as any);
    root.addEventListener('touchstart', this.boundDown!, { passive: false } as any);
    window.addEventListener('mousemove', this.boundMove!, { passive: false } as any);
    window.addEventListener('touchmove', this.boundMove!, { passive: false } as any);
    window.addEventListener('mouseup', this.boundUp!, { passive: true } as any);
    window.addEventListener('touchend', this.boundUp!, { passive: true } as any);
    this.listenersAttached = true;
  }

  public cleanup(): void {
    super.cleanup();
    if (!this.boundDown || !this.boundMove || !this.boundUp) return;
    const root = this.getShadowElement?.(this.id);
    if (root) {
      root.removeEventListener('mousedown', this.boundDown as any);
      root.removeEventListener('touchstart', this.boundDown as any);
    }
    window.removeEventListener('mousemove', this.boundMove as any);
    window.removeEventListener('touchmove', this.boundMove as any);
    window.removeEventListener('mouseup', this.boundUp as any);
    window.removeEventListener('touchend', this.boundUp as any);
    this.listenersAttached = false;
  }

  private _handlePointerDown(e: Event): void {
    const info = this._getSliderIndexFromEvent(e);
    if (!info) return;
    const { index } = info;
    const cfg = this.entityConfigs[index];
    if (!cfg) return;
    if (!this._entityIsAdjustable(cfg)) return;
    e.preventDefault();
    this.isDragging = true;
    this.activeIndex = index;
    this._updateDragValueFromEvent(e);
  }

  private _handlePointerMove(e: Event): void {
    if (!this.isDragging) return;
    e.preventDefault();
    this._updateDragValueFromEvent(e);
  }

  private _handlePointerUp(_e: Event): void {
    if (!this.isDragging) return;
    const index = this.activeIndex;
    this.isDragging = false;
    this.activeIndex = null;
    if (index === null || index < 0) return;
    const cfg = this.entityConfigs[index];
    if (!cfg) return;
    const key = this._configKey(cfg);
    const value = this.dragValues[key];
    if (value === undefined) return;
    this._commitValue(cfg, value);
  }

  private _getSliderIndexFromEvent(e: Event): { index: number } | null {
    const path = (e as any).composedPath?.() || [];
    for (const node of path) {
      if (node && typeof (node as any).id === 'string') {
        const id: string = (node as any).id;
        const prefix = `${this.id}__slider_`;
        if (id.startsWith(prefix)) {
          const rest = id.slice(prefix.length);
          const idx = parseInt(rest.split('__')[0], 10);
          if (!isNaN(idx)) return { index: idx };
        }
      }
    }
    const root = this.getShadowElement?.(this.id) as SVGGElement | null;
    if (!root) return null;
    const rect = (root as any).getBoundingClientRect?.();
    if (!rect) return null;
    const clientX = this._getClientX(e);
    const xRatio = (clientX - rect.left) / Math.max(1, rect.width);
    const index = Math.floor(xRatio * Math.max(1, this.entityConfigs.length));
    return { index: Math.max(0, Math.min(this.entityConfigs.length - 1, index)) };
  }

  private _updateDragValueFromEvent(e: Event): void {
    if (this.activeIndex === null) return;
    const index = this.activeIndex;
    const cfg = this.entityConfigs[index];
    const track = this.getShadowElement?.(`${this.id}__slider_${index}__track`) as SVGRectElement | null;
    if (!cfg || !track) return;
    const bounds = track.getBoundingClientRect();
    const clientY = this._getClientY(e);
    const clampedY = Math.min(Math.max(clientY, bounds.top), bounds.bottom);
    const ratio = 1 - (clampedY - bounds.top) / Math.max(1, bounds.height);
    const { min, max } = this._resolveMinMax(cfg);
    const rawValue = min + ratio * (max - min);
    const key = this._configKey(cfg);
    this.dragValues[key] = this._maybeSnapValue(rawValue);
    this._scheduleRequestUpdate();
  }

  private _getClientX(e: Event): number {
    if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 0) {
      return (e as TouchEvent).touches[0].clientX;
    }
    if ((e as any).clientX != null) return (e as MouseEvent).clientX;
    return 0;
  }

  private _getClientY(e: Event): number {
    if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 0) {
      return (e as TouchEvent).touches[0].clientY;
    }
    if ((e as any).clientY != null) return (e as MouseEvent).clientY;
    return 0;
  }

  private _entityIsAdjustable(cfg: SliderEntityConfig): boolean {
    if (cfg.attribute) {
      return this._attributeIsAdjustable(cfg.id, cfg.attribute);
    }
    const domain = cfg.id.split('.')[0];
    return domain === 'input_number' || domain === 'number';
  }

  private _attributeIsAdjustable(entityId: string, attribute: string): boolean {
    const domain = entityId.split('.')[0];
    if (domain === 'climate') {
      return [
        'target_temp',
        'target_temperature',
        'target_temp_low',
        'target_temperature_low',
        'target_temp_high',
        'target_temperature_high'
      ].includes(attribute);
    }
    return true;
  }

  private async _commitValue(cfg: SliderEntityConfig, value: number): Promise<void> {
    if (!this.hass) return;
    const entityId = cfg.id;
    const rounded = this._roundForCommit(value);
    try {
      await EntityControlService.setNumericTarget(this.hass, cfg, rounded);
    } catch (err) {
      console.error(`[VerticalSlider] Failed to set value for ${entityId}:`, err);
    }
  }

  private _resolveColor(value: string | ColorValue | undefined, fallback: string): string {
    return ColorResolver
      .resolve(value !== undefined ? value : fallback)
      .withDom(this.getShadowElement?.(this.id) ?? null)
      .toString();
  }

  private _floatsEnabled(): boolean {
    return Boolean((this as any).props?.use_floats);
  }

  private _epsilon(): number {
    return this._floatsEnabled() ? 1e-3 : 0;
  }

  private _maybeSnapValue(value: number): number {
    if (isNaN(value)) return value;
    return this._floatsEnabled() ? value : Math.round(value);
  }

  private _roundForCommit(value: number): number {
    if (isNaN(value)) return value;
    if (this._floatsEnabled()) {
      return Math.round(value * 1000) / 1000;
    }
    return Math.round(value);
  }

  private _formatValueForDisplay(value: number): string {
    if (!isFinite(value)) return '';
    if (this._floatsEnabled()) {
      const rounded = Math.round(value * 100) / 100;
      return Number(rounded.toFixed(2)).toString();
    }
    return Math.round(value).toString();
  }

  private _configKey(cfg: SliderEntityConfig): string {
    return cfg.attribute ? `${cfg.id}::${cfg.attribute}` : cfg.id;
  }

  private _deriveEntityRange(cfg: SliderEntityConfig): { min?: number; max?: number } {
    if (!this.hass) return { min: undefined, max: undefined };
    return EntityValueResolver.readEntityNumericRange(this.hass, cfg.id, cfg.attribute);
  }

  private _resolveMinMax(cfg: SliderEntityConfig): { min: number; max: number } {
    const { min: derivedMin, max: derivedMax } = this._deriveEntityRange(cfg);
    const min = cfg.min ?? (typeof this.props.min === 'number' ? this.props.min : (derivedMin ?? 0));
    const max = cfg.max ?? (typeof this.props.max === 'number' ? this.props.max : (derivedMax ?? 100));
    return { min, max };
  }

  private _scheduleRequestUpdate(): void {
    if (this.updateQueued) return;
    this.updateQueued = true;
    requestAnimationFrame(() => {
      this.updateQueued = false;
      this.requestUpdateCallback?.();
    });
  }

  private _applyLabelPulseAnimations(
    toStart: Array<{ id: string; base: string; dark: string }>,
    toStop: Array<{ id: string; base: string }>
  ): void {
    // Stop animations for labels that should no longer pulse
    for (const { id, base } of toStop) {
      if (this.pulsingLabels.has(id)) {
        animationManager.stopAllAnimationsForElement(id);
        this.pulsingLabels.delete(id);
        animationManager.animateElementProperty(id, 'fill', base, 0.2, this.getShadowElement);
      }
    }
    for (const { id, base, dark } of toStart) {
      if (!this.pulsingLabels.has(id)) {
        animationManager.initializeElementAnimationTracking(id);
        animationManager.executeAnimation(
          id,
          {
            type: 'color',
            duration: 0.8,
            ease: 'power1.inOut',
            repeat: -1,
            yoyo: true,
            color_params: { property: 'fill', color_start: base, color_end: dark }
          },
          {
            elementId: id,
            getShadowElement: this.getShadowElement,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdateCallback
          }
        );
        this.pulsingLabels.add(id);
      }
    }
  }

}


