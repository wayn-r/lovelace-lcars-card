import { svg, SVGTemplateResult } from 'lit';
import { LayoutElement } from './element.js';
import { HistoryMap } from '../../utils/data-fetcher.js';
import { gsap } from 'gsap';
import { nice } from 'd3-array';

const lineGradients = [
    { color: '#0b6288' }, // Blue
    { color: '#FF9900' }, // Orange
    { color: '#FF6666' }, // Red
    { color: '#66FF66' }, // Green
    { color: '#9966FF' }, // Purple
    { color: '#FFFF66' }, // Yellow
];

export class GraphElement extends LayoutElement {
  private historyMap: HistoryMap = {};
  private gradientIds: string[] = [];
  private entityConfigs: { id: string, color?: string }[] = [];
  private animations: gsap.core.Tween[] = [];

  constructor(id: string, props: any, layoutConfig: any, hass?: any, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    this.updateGradientIds();
  }

  setHistory(historyMap: HistoryMap): void {
    this.historyMap = historyMap;
    this.requestUpdateCallback?.();
    this.setupAnimation();
  }

  setEntityConfigs(configs?: { id: string, color?: string }[]): void {
    this.entityConfigs = configs || [];
    this.updateGradientIds();
    this.requestUpdateCallback?.();
  }
  
  cleanup(): void {
    super.cleanup();
    this.animations.forEach(a => a.kill());
    this.animations = [];
  }

  private updateGradientIds(): void {
    const numGradients = this.entityConfigs.length || lineGradients.length;
    this.gradientIds = Array.from({ length: numGradients }, (_, i) => `grad-${this.id}-${i}`);
  }

  private setupAnimation(): void {
    if (!this.getShadowElement) {
        return;
    }

    this.animations.forEach(a => a.kill());
    this.animations = [];

    const getElement = this.getShadowElement;
    const gradients = this.gradientIds.map(id => getElement(id)).filter(el => el) as Element[];
    
    if (gradients.length !== this.gradientIds.length) {
        requestAnimationFrame(() => this.setupAnimation());
        return;
    }

    const newAnimations: gsap.core.Tween[] = [];
    gradients.forEach((gradient) => {
        gsap.set(gradient, { attr: { spreadMethod: 'none' } });
        const animation = gsap.fromTo(gradient, 
            { attr: { x1: '-100%', x2: '0%' } },
            { 
                attr: { x1: '0%', x2: '100%' },
                duration: 3,
                ease: 'none',
                onComplete: () => {
                    this.startLoopingAnimation(gradient);
                }
            }
        );
        newAnimations.push(animation);
    });
    this.animations = newAnimations;
  }

  private startLoopingAnimation(gradient: Element): void {
    gsap.set(gradient, { attr: { spreadMethod: 'repeat', x1: '0%', x2: '100%' } });

    const animation = gsap.to(gradient, {
        attr: { x1: '100%', x2: '200%' },
        duration: 3,
        ease: 'none',
        repeat: -1,
    });
    
    const index = this.animations.findIndex(a => a.targets().includes(gradient));
    if (index !== -1) {
      this.animations[index] = animation;
    } else {
      this.animations.push(animation);
    }
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
    
    const entityIds = this.entityConfigs.map(config => config.id);
    const hasData = entityIds.some(id => this.historyMap[id] && this.historyMap[id].length >= 2);

    if (!hasData) {
      const textX = this.layout.x + 10;
      const textY = this.layout.y + 20;
      return svg`<text x="${textX}" y="${textY}" fill="orange">Insufficient data</text>`;
    }

    const allPoints = this.calculateAllPoints();
    const paths = this.entityConfigs.map((config, index) => {
      const points = allPoints[config.id];
      if (!points || points.length < 2) return null;

      const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const gradientId = this.gradientIds[index % this.gradientIds.length];
      
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
          stroke="${this.props.appearance?.fill ?? '#0b6288'}" stroke-width="2" stroke-opacity="0.5" />
      `);

      const textX = this.layout.x + 5;
      
      elements.push(svg`
        <text
          x="${textX}"
          y="${y}"
          dominant-baseline="middle"
          font-family="Antonio, sans-serif"
          fill="${this.props.textColor ?? 'white'}"
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