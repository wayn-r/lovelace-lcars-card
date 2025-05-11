import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import './types';
import gsap from 'gsap';

import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './elements/element.js';
import { parseConfig } from './layout/parser.js';

import './editor/lcars-card-editor.js';

export interface LcarsCardConfig {
  type: string;
  title?: string;
  text?: string;
  fontSize?: number;
  elements?: LcarsElementConfig[];
}

export interface LcarsButtonActionConfig {
  type: 'call-service' | 'navigate' | 'toggle' | 'more-info' | 'url' | 'none';
  service?: string;
  service_data?: Record<string, any>;
  navigation_path?: string;
  url_path?: string;
  entity?: string;
  confirmation?: boolean | {
    text?: string;
    exemptions?: Array<{
      user: string;
    }>;
  };
}

export interface LcarsButtonElementConfig {
  enabled?: boolean;
  text?: string;
  cutout_text?: boolean;

  text_color?: any;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  letter_spacing?: string | number;
  text_transform: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  text_anchor?: 'start' | 'middle' | 'end';
  dominant_baseline?: 'auto' | 'middle' | 'central' | 'hanging' | 'text-bottom' | 'text-top' | 'alphabetic' | 'ideographic';


  hover_fill?: any;
  active_fill?: any;
  hover_stroke?: string;
  active_stroke?: string;
  hover_text_color?: any;
  active_text_color?: any;

  hover_transform?: string;
  active_transform?: string;

  action_config?: LcarsButtonActionConfig;
}

export interface LcarsElementConfig {
  id: string;
  type: string;
  props?: Record<string, any>;
  layout?: LcarsLayoutConfig;
  group?: string;
  button?: LcarsButtonElementConfig;
}

export interface LcarsLayoutConfig {
  width?: number | string;
  height?: number | string;
  offsetX?: number | string;
  offsetY?: number | string;
  
  anchor?: {
    anchorTo: string;
    anchorPoint?: string;
    targetAnchorPoint?: string;
  };
  
  stretch?: {
    stretchTo1?: string;
    stretchAxis1?: 'X' | 'Y';
    targetStretchAnchorPoint1?: string;
    stretchPadding1?: number;
    stretchTo2?: string;
    stretchAxis2?: 'X' | 'Y';
    targetStretchAnchorPoint2?: string;
    stretchPadding2?: number;
  };
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: CARD_NAME,
  description: 'A LCARS themed card for Home Assistant',
});

@customElement(CARD_TYPE)
export class LcarsCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) private _config!: LcarsCardConfig;
  @state() private _layoutElementTemplates: SVGTemplateResult[] = [];
  @state() private _viewBox: string = '0 0 100 50';
  @state() private _elementStateNeedsRefresh: boolean = false;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  private _layoutCalculationPending: boolean = false;
  private _hasRenderedOnce: boolean = false;
  @state() private _hasMeasuredRenderedText: boolean = false;

  static styles = css`
    :host {
      display: block;
    }
    
    ha-card {
      width: 100%;
      box-sizing: border-box;
    }
    
    .card-container {
      width: 100%;
      position: relative;
      overflow: hidden;
    }
    
    svg {
      width: 100%;
      display: block;
      min-height: 50px;
    }
  `;

  public setConfig(config: LcarsCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (JSON.stringify(config) === JSON.stringify(this._lastConfig)) {
        return;
    }
    this._config = {
      ...config,
      title: config.title || DEFAULT_TITLE,
      text: config.text || DEFAULT_TEXT,
      fontSize: config.fontSize || DEFAULT_FONT_SIZE,
      elements: config.elements || []
    };
    this._lastConfig = config;
    
    this._layoutCalculationPending = true;
    this.requestUpdate(); 
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._resizeObserver) {
       this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));
    }
    if (document.readyState === 'complete') {
      this._triggerRecalc();
    } else {
      window.addEventListener('load', () => this._triggerRecalc(), { once: true });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this._layoutCalculationPending = true;
        this.requestUpdate();
      });
    }
  }
  
  public firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
      const fontLoadPromises: Promise<FontFace[]>[] = [];
      if (this._config.elements) {
        this._config.elements.forEach(el => {
          if (el.type?.toLowerCase() === 'text' && el.props) {
            const ff = (el.props.fontFamily || 'sans-serif').toString();
            const fs = (el.props.fontSize || DEFAULT_FONT_SIZE).toString();
            const fw = (el.props.fontWeight || 'normal').toString();
            try {
              fontLoadPromises.push(document.fonts.load(`${fw} ${fs}px ${ff}`));
            } catch (_e) {
            }
          }
        });
      }
      const fontsLoaded = fontLoadPromises.length ? Promise.all(fontLoadPromises) : Promise.resolve();
      Promise.all([this.updateComplete, fontsLoaded]).then(() => {
        requestAnimationFrame(() => this._scheduleInitialCalculation());
      }).catch(() => {
        requestAnimationFrame(() => this._scheduleInitialCalculation());
      });
    } else {
      console.error("[firstUpdated] Could not find .card-container to observe.");
    }
    this._hasRenderedOnce = true;
  }
  
  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    super.disconnectedCallback();
  }
  
  private _scheduleInitialCalculation(): void {
    if (!this._containerRect) {
        const container = this.shadowRoot?.querySelector('.card-container');
        if (container) {
            const initialRect = container.getBoundingClientRect();
            if (initialRect.width > 0 && initialRect.height > 0) {
                this._containerRect = initialRect;
                this._performLayoutCalculation(this._containerRect);
            } else {
                console.warn("[_scheduleInitialCalculation] Initial Rect still zero dimensions. Relying on ResizeObserver.");
            }
        }
    } else {
         if(this._layoutCalculationPending){
            this.requestUpdate(); 
         }
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
      super.updated(changedProperties);

      let didFullRecalc = false;
      if (this._layoutCalculationPending && this._containerRect && this._config) {
          this._performLayoutCalculation(this._containerRect);
          didFullRecalc = true;
      }

      if (didFullRecalc) {
          this._elementStateNeedsRefresh = false; 
      } else if (this._elementStateNeedsRefresh && this._containerRect && this._config && this._layoutEngine.layoutGroups.length > 0) {
          this._refreshElementRenders();
      }
      
      if (!this._hasMeasuredRenderedText && this._hasRenderedOnce && this._containerRect) {
          this._hasMeasuredRenderedText = true;
          requestAnimationFrame(() => this._measureAndRecalc());
      }
  }
  
  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        this._layoutCalculationPending = false;
        return;
    }

    const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
    if (svgElement) {
      (this._layoutEngine as any).tempSvgContainer = svgElement;
    }
    this._layoutEngine.clearLayout();
    const groups = parseConfig(this._config, this.hass, () => { this._elementStateNeedsRefresh = true; this.requestUpdate(); }); 
    groups.forEach((group: Group) => { this._layoutEngine.addGroup(group); });

    this._layoutEngine.calculateBoundingBoxes(rect);

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );
    const newViewBox = `0 0 ${rect.width} ${rect.height}`;

    if (JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !== JSON.stringify(this._layoutElementTemplates.map(t => ({s:t.strings, v: (t.values || []).map(val => String(val))}))) || newViewBox !== this._viewBox) {
        this._layoutElementTemplates = newTemplates;
        this._viewBox = newViewBox;
    } else {
    }
    this._layoutCalculationPending = false;
  }

  private _refreshElementRenders(): void {
    if (!this._config || !this._containerRect || this._layoutEngine.layoutGroups.length === 0) {
        this._elementStateNeedsRefresh = false;
        return;
    }

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    this._layoutElementTemplates = newTemplates;

    this._elementStateNeedsRefresh = false;
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    const newRect = entry.contentRect;

    if (newRect.width > 0 && newRect.height > 0) {
        if (!this._containerRect || 
            Math.abs(this._containerRect.width - newRect.width) > 1 ||
            Math.abs(this._containerRect.height - newRect.height) > 1) 
        {
            this._containerRect = newRect;
            this._layoutCalculationPending = true;
            this.requestUpdate();
        }
    } else {
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('lcars-card-editor') as LovelaceCardEditor;
  }

  public getCardSize(): number {
    return 3; 
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    let svgContent: SVGTemplateResult | SVGTemplateResult[] | TemplateResult | string = '';
    let defsContent: SVGTemplateResult[] = [];

    if (!this._config.elements || this._config.elements.length === 0) {
      const { title, text, fontSize } = this._config;
      svgContent = svg`
        <g>
          <text x="16" y="30" font-weight="bold" fill="var(--primary-text-color, white)">${title}</text>
          <text x="16" y="60" font-size="${fontSize}px" fill="var(--secondary-text-color, lightgrey)">${text}</text>
        </g>
      `;
    } else {
      svgContent = this._layoutElementTemplates;

      this._layoutEngine.layoutGroups.forEach(group => {
        group.elements.forEach(el => {
          const layoutEl = el as any;
          if (layoutEl._maskDefinition && layoutEl._maskDefinition !== null) {
            defsContent.push(layoutEl._maskDefinition);
          }
        });
      });

      if (this._layoutCalculationPending && this._layoutElementTemplates.length === 0 && this._hasRenderedOnce) {
           svgContent = svg`<text x="10" y="20" fill="orange">Calculating layout...</text>`;
      }
    }

    return html`
      <ha-card>
        <div class="card-container">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox=${this._viewBox}
            preserveAspectRatio="xMidYMid meet"
          >
            ${defsContent.length > 0 ? svg`<defs>${defsContent}</defs>` : ''}
            ${svgContent}
          </svg>
        </div>
      </ha-card>
    `;
  }

  private _triggerRecalc(): void {
    this._layoutCalculationPending = true;
    this.requestUpdate();
  }

  private _measureAndRecalc(): void {
    const svg = this.shadowRoot?.querySelector<SVGSVGElement>('.card-container svg');
    if (!svg || !this._containerRect) return;
    const measured: Record<string, {w: number; h: number}> = {};
    svg.querySelectorAll<SVGTextElement>('text[id]').forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          measured[el.id] = { w: bbox.width, h: bbox.height };
        }
      } catch {}
    });
    const engineAny = this._layoutEngine as any;
    const elementsMap: Map<string, any> = engineAny.elements;
    let changed = false;
    elementsMap.forEach((el: any, id: string) => {
      const m = measured[id];
      if (m && (el.intrinsicSize.width !== m.w || el.intrinsicSize.height !== m.h)) {
        el.intrinsicSize.width = m.w;
        el.intrinsicSize.height = m.h;
        el.intrinsicSize.calculated = true;
        changed = true;
      }
    });
    if (changed) {
      this._layoutCalculationPending = true;
      this._performLayoutCalculation(this._containerRect);
      const newTemplates = this._layoutEngine.layoutGroups.flatMap((group: any) =>
        group.elements.map((e: any) => e.render()).filter((t: any) => t !== null)
      );
      this._layoutElementTemplates = newTemplates;
      this._viewBox = `0 0 ${this._containerRect.width} ${this._containerRect.height}`;
      this.requestUpdate();
    }
  }
}
