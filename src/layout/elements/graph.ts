import { svg, SVGTemplateResult } from 'lit';
import { LayoutElement } from './element.js';
import { HistoryMap } from '../../utils/data-fetcher.js';
import { gsap } from 'gsap';
import { nice } from 'd3-array';
import { stateManager } from '../../utils/state-manager.js';
import { StateChangeEvent } from '../../core/store.js';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { HomeAssistant } from 'custom-card-helpers';
import { ColorResolver } from '../../utils/color-resolver.js';

export const lineGradients = [
    { color: 'var(--lcars-color-graph-line-1)' },
    { color: 'var(--lcars-color-graph-line-2)' },
    { color: 'var(--lcars-color-graph-line-3)' },
];

export interface RichEntityConfig {
    id: string;
    color?: string;
    toggleable?: boolean;
    animated?: boolean;
    duration?: number;
}

export class GraphElement extends LayoutElement {
  private historyMap: HistoryMap = {};
  private gradientIds: string[] = [];
  private entityConfigs: RichEntityConfig[] = [];
  private animations: Map<string, gsap.core.Tween> = new Map();
  private unsubscribeFromStateChanges?: () => void;

  constructor(id: string, props: LayoutElementProps, layoutConfig: LayoutConfigOptions, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    this.updateGradientIds();
    this.subscribeToStateChanges();
  }

  private subscribeToStateChanges(): void {
    this.unsubscribeFromStateChanges = stateManager.onStateChange((event: StateChangeEvent) => {
        const stateNamePrefix = `${this.id}_`;
        const stateNameSuffix = `_visible`;

        if (event.elementId.startsWith(stateNamePrefix) && event.elementId.endsWith(stateNameSuffix)) {
            const entityId = event.elementId.substring(stateNamePrefix.length, event.elementId.length - stateNameSuffix.length);
            
            // Ensure we are not accidentally picking up a state change from a widget with a similar name
            if (!this.entityConfigs.some(config => config.id === entityId)) {
                return;
            }

            if (event.toState === 'visible') {
                this.startEntityAnimation(entityId);
            } else if (event.toState === 'hidden') {
                if (this.animations.has(entityId)) {
                    this.animations.get(entityId)?.kill();
                    this.animations.delete(entityId);
                }
            }
        }
    });
  }

  setHistory(historyMap: HistoryMap): void {
    this.historyMap = historyMap;
    this.requestUpdateCallback?.();
    this.setupAnimation();
  }

  setEntityConfigs(configs?: RichEntityConfig[]): void {
    this.entityConfigs = configs || [];
    this.updateGradientIds();
    this.requestUpdateCallback?.();
  }
  
  cleanup(): void {
    super.cleanup();
    this.animations.forEach(a => a.kill());
    this.animations.clear();
    if (this.unsubscribeFromStateChanges) {
        this.unsubscribeFromStateChanges();
    }
  }

  private updateGradientIds(): void {
    const numGradients = this.entityConfigs.length || lineGradients.length;
    this.gradientIds = Array.from({ length: numGradients }, (_, i) => `grad-${this.id}-${i}`);
  }

  private setupAnimation(): void {
    this.animations.forEach(a => a.kill());
    this.animations.clear();

    const visibleEntityConfigs = this.entityConfigs.filter(config => {
        const stateName = `${this.id}_${config.id}_visible`;
        return stateManager.getState(stateName) !== 'hidden';
    });

    visibleEntityConfigs.forEach(config => {
        this.startEntityAnimation(config.id);
    });
  }

  private startEntityAnimation(entityId: string): void {
    if (!this.getShadowElement) {
        return;
    }

    if (this.animations.has(entityId)) {
        this.animations.get(entityId)?.kill();
        this.animations.delete(entityId);
    }

    const config = this.entityConfigs.find(c => c.id === entityId);
    if (!config) return;

    const getElement = this.getShadowElement;
    const originalIndex = this.entityConfigs.findIndex(ec => ec.id === entityId);
    const gradientId = `grad-${this.id}-${originalIndex}`;
    const gradient = getElement(gradientId);

    if (!gradient) {
        requestAnimationFrame(() => this.startEntityAnimation(entityId));
        return;
    }

    gsap.set(gradient, { attr: { spreadMethod: 'pad' } });
    const animation = gsap.fromTo(gradient, 
        { attr: { x1: '-100%', x2: '0%' } },
        { 
            attr: { x1: '0%', x2: '100%' },
            duration: (config.duration || 3000) / 1000,
            ease: 'none',
            onComplete: () => {
                this.startContinuousAnimation(gradient, entityId);
            }
        }
    );
    this.animations.set(entityId, animation);
  }

  private startContinuousAnimation(gradient: Element, entityId: string): void {
    gsap.set(gradient, { attr: { spreadMethod: 'repeat', x1: '0%', x2: '100%' } });

    const config = this.entityConfigs.find(c => c.id === entityId);
    if (!config) return;

    const animation = gsap.to(gradient, {
        attr: { x1: '100%', x2: '200%' },
        duration: (config.duration || 3000) / 1000,
        ease: 'none',
        repeat: -1,
    });
    
    this.animations.set(entityId, animation);
  }

  renderDefs(): SVGTemplateResult {
    const gradients = this.entityConfigs.map((config, index) => {
        const color = config.color || lineGradients[index % lineGradients.length].color;
        return { color };
    });

      return svg`
        ${gradients.map((gradient, index) => svg`
            <linearGradient id="${this.gradientIds[index]}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${gradient.color}" stop-opacity="0" />
                <stop offset="40%" stop-color="${gradient.color}" stop-opacity="0" />
                <stop offset="75%" stop-color="${gradient.color}" stop-opacity="1" />
                <stop offset="95%" stop-color="${gradient.color}" stop-opacity="1" />
                <stop offset="99%" stop-color="white" stop-opacity="1" />
                <stop offset="100%" stop-color="white" stop-opacity="0" />
            </linearGradient>
        `)}
      `;
  }

  protected renderShape(): SVGTemplateResult | null {
    if (!this.layout.calculated) {
      return null;
    }
    
    const allEntityIds = this.entityConfigs.map(config => config.id);
    
    if (!this.hasSufficientData(allEntityIds)) {
      const textX = this.layout.x + 10;
      const textY = this.layout.y + 20;
      return svg`<text x="${textX}" y="${textY}" fill="orange">Insufficient data</text>`;
    }

    const visibleEntityConfigs = this.entityConfigs.filter(config => {
        const stateName = `${this.id}_${config.id}_visible`;
        return stateManager.getState(stateName) !== 'hidden';
    });
    const allPoints = this.calculateAllPoints();

    const paths = visibleEntityConfigs.map((config) => {
      const points = allPoints[config.id];
      if (!points || points.length < 2) return null;

      const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const originalIndex = this.entityConfigs.findIndex(ec => ec.id === config.id);
      const gradientId = this.gradientIds[originalIndex % this.gradientIds.length];

      if (config.animated === false) {
        return svg`<path d="${path}" fill="none" stroke="${ColorResolver.resolveCssVariable(config.color || lineGradients[originalIndex % lineGradients.length].color, this.getShadowElement?.(this.id) as Element)}" stroke-width="4" />`;
      }
      
      return svg`<path d="${path}" fill="none" stroke="url(#${gradientId})" stroke-width="4" />`;
    }).filter(p => p !== null);


    const colors = this.resolveElementColors({
        fallbackFillColor: 'none',
        fallbackStrokeColor: 'none',
    });

    return svg`
      <g>
        <rect x="${this.layout.x}" y="${this.layout.y}" width="${this.layout.width}" height="${this.layout.height}" fill="transparent" stroke="${colors.strokeColor}" stroke-width="1" />
        ${this.renderGridLines()}
        ${paths}
      </g>
    `;
  }

  private hasSufficientData(entityIds: string[]): boolean {
    return entityIds.some(id => this.historyMap[id] && this.historyMap[id].length >= 2);
  }

  private renderGridLines(): SVGTemplateResult | null {
    if (!this.layout.calculated) {
      return null;
    }

    const minMax = this.getMinMaxValues();
    if (!minMax) {
      return null;
    }

    const numGraphLines = this.props.grid?.num_lines ?? 6;
    const [min, max] = nice(minMax.minVal, minMax.maxVal, numGraphLines - 1);

    const elements = [];
    for (let i = 0; i < numGraphLines; i++) {
      const value = min + (i * (max - min) / (numGraphLines - 1));
      const y = this.layout.y + this.layout.height - ((value - min) / (max - min)) * this.layout.height;
      elements.push(svg`
        <line 
          x1="${this.layout.x}" y1="${y}" 
          x2="${this.layout.x + this.layout.width}" y2="${y}" 
          stroke="${this.props.grid?.fill ?? 'var(--lcars-color-background)'}" stroke-width="2" stroke-opacity="0.5" />
      `);

      const textX = this.layout.x + 5;
      
      elements.push(svg`
        <text
          x="${textX}"
          y="${y}"
          dominant-baseline="middle"
          font-family="Antonio, sans-serif"
          fill="${this.props.grid?.label_fill ?? 'white'}"
          font-size="14px"
          text-anchor="start"
        >
          ${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
        </text>
      `);
    }

    return svg`<g>${elements}</g>`;
  }

  private getMinMaxValues(): { minVal: number; maxVal: number } | null {
    const allValues = Object.values(this.historyMap).flat().map(h => parseFloat(h.state)).filter(v => !isNaN(v));
    if (allValues.length < 2) {
      return null;
    }
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);

    return { minVal, maxVal };
  }

  private calculateAllPoints(): Record<string, { x: number; y: number }[]> {
    const allPoints: Record<string, { x: number; y: number }[]> = {};
    const entityIds = this.entityConfigs.map(config => config.id);
    if (entityIds.length === 0) return allPoints;

    const minMax = this.getMinMaxValues();
    if (!minMax) return allPoints;

    const allTimestamps = Object.values(this.historyMap).flat().map(h => new Date(h.last_changed).getTime());
    const minTime = Math.min(...allTimestamps);
    const maxTime = Math.max(...allTimestamps);
    
    const numGraphLines = this.props.grid?.num_lines ?? 6;
    const [minVal, maxVal] = nice(minMax.minVal, minMax.maxVal, numGraphLines - 1);

    const valRange = maxVal - minVal;
    const timeRange = maxTime - minTime;

    if (!this.layout.calculated) return allPoints;

    const valScale = valRange > 0 ? this.layout.height / valRange : 0;
    const timeScale = timeRange > 0 ? this.layout.width / timeRange : 0;

    for (const entityId of entityIds) {
      const history = this.historyMap[entityId] || [];
      const validHistory = history.filter(h => h.state !== null && h.state !== undefined && !isNaN(parseFloat(h.state)));
      if (validHistory.length === 0) continue;

      const points = validHistory.map(h => {
        const value = parseFloat(h.state);
        const time = new Date(h.last_changed).getTime();
        
        const x = this.layout.x + (time - minTime) * timeScale;
        const y = this.layout.y + this.layout.height - ((value - minVal) * valScale);

        return { x, y };
      });

      const lastDataPointTime = new Date(validHistory[validHistory.length - 1].last_changed).getTime();
      if (lastDataPointTime < maxTime) {
        const lastPoint = points[points.length - 1];
        points.push({
            x: this.layout.x + this.layout.width,
            y: lastPoint.y
        });
      }
      
      allPoints[entityId] = points;
    }

    return allPoints;
  }
} 