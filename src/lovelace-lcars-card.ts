import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import './types'; // Import types to ensure global declarations are included
import gsap from 'gsap';

// Import core layout engine classes
import { LayoutEngine, Group, LayoutElement } from './layout/engine.js';
import { parseConfig } from './layout/parser.js';

// Import the NEW editor from its new location
import './editor/lcars-card-editor.js';

// Define the card configuration options interface
export interface LcarsCardConfig {
  type: string;
  title?: string;
  text?: string;
  fontSize?: number;
  elements?: LcarsElementConfig[];
}

// New interface for element configuration
export interface LcarsElementConfig {
  id: string;
  type: string;
  props?: Record<string, any>;
  layout?: LcarsLayoutConfig;
  group?: string;
}

// Layout configuration interface
export interface LcarsLayoutConfig {
  width?: number | string;
  height?: number | string;
  offsetX?: number | string;
  offsetY?: number | string;
  
  // Anchor properties
  anchor?: {
    anchorTo: string;
    anchorPoint?: string;
    targetAnchorPoint?: string;
  };
  
  // New unified stretch property format
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

// Register the card with Home Assistant
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
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  private _layoutCalculationPending: boolean = false;
  private _hasRenderedOnce: boolean = false; // Track first render completion
  @state() private _hasMeasuredRenderedText: boolean = false; // Track if we've done post-render measurement

  // Static styles for the card
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

  // Set the config property
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
    
    // Mark for calculation and request update. Calculation will happen in `updated`.
    this._layoutCalculationPending = true;
    this.requestUpdate(); 
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._resizeObserver) {
       this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));
    }
    // After full page load (CSS/fonts), trigger a recalc to ensure correct measurements
    if (document.readyState === 'complete') {
      this._triggerRecalc();
    } else {
      window.addEventListener('load', () => this._triggerRecalc(), { once: true });
    }
    // Also recalc once all fonts have loaded to get correct text metrics
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
      // Explicitly load fonts used by text elements, then perform initial layout
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
              // ignore if FontFaceSet API not supported or invalid
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
    // Initial render happens, _scheduleInitialCalculation will trigger state update if needed
  }
  
  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    super.disconnectedCallback();
  }
  
  // New method to check initial dimensions and calculate
  private _scheduleInitialCalculation(): void {
    if (!this._containerRect) { // Only run if resize observer hasn't already provided rect
        const container = this.shadowRoot?.querySelector('.card-container');
        if (container) {
            const initialRect = container.getBoundingClientRect();
            if (initialRect.width > 0 && initialRect.height > 0) {
                this._containerRect = initialRect;
                this._performLayoutCalculation(this._containerRect); // Calculate directly
            } else {
                console.warn("[_scheduleInitialCalculation] Initial Rect still zero dimensions. Relying on ResizeObserver.");
            }
        }
    } else {
         // If rect exists, but calculation is pending (e.g. from setConfig before firstUpdated), trigger it via updated
         if(this._layoutCalculationPending){
            this.requestUpdate(); 
         }
    }
  }

  // updated is called after render
  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
      super.updated(changedProperties);
      // Perform layout calculation *after* the DOM update cycle if needed
      if (this._layoutCalculationPending && this._containerRect && this._config) {
          this._performLayoutCalculation(this._containerRect);
      }
      // After first layout and render, measure actual text via getBBox and rerun layout once
      if (!this._hasMeasuredRenderedText && this._hasRenderedOnce && this._containerRect) {
          this._hasMeasuredRenderedText = true;
          requestAnimationFrame(() => this._measureAndRecalc());
      }
  }
  
  // Performs the calculation and updates state
  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        this._layoutCalculationPending = false; // Abort this attempt
        return;
    }

    // Ensure measurements use the in-shadow SVG for correct font context
    const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
    if (svgElement) {
      (this._layoutEngine as any).tempSvgContainer = svgElement;
    }
    this._layoutEngine.clearLayout();
    const groups = parseConfig(this._config, this.hass);
    groups.forEach((group: Group) => { this._layoutEngine.addGroup(group); });

    this._layoutEngine.calculateBoundingBoxes(rect);

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group => 
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );
    const newViewBox = `0 0 ${rect.width} ${rect.height}`;

    // Check if state actually needs changing before setting it
    // This helps prevent unnecessary re-render loops if calculation result is the same
    if (JSON.stringify(newTemplates.map(t => t.strings)) !== JSON.stringify(this._layoutElementTemplates.map(t => t.strings)) || newViewBox !== this._viewBox) {
        this._layoutElementTemplates = newTemplates;
        this._viewBox = newViewBox;
    } else {
    }
    
    this._layoutCalculationPending = false; // Calculation attempt finished
  }

  // Handle resize: store rect and mark for calculation
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

  // Define the static method to return the editor instance
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    // Use the NEW editor tag
    return document.createElement('lcars-card-editor') as LovelaceCardEditor;
  }

  public getCardSize(): number {
    return 3; 
  }

  // Render the card
  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    let svgContent: SVGTemplateResult | SVGTemplateResult[] | TemplateResult | string = '';

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
      // Show calculating message only if calculation is pending AND we haven't rendered any templates yet
      // AND the component has had its first render pass completed (to avoid flash)
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
            ${svgContent}
          </svg>
        </div>
      </ha-card>
    `;
  }

  // Force a layout recalculation
  private _triggerRecalc(): void {
    this._layoutCalculationPending = true;
    this.requestUpdate();
  }

  // Measure rendered <text> elements and update layout based on real sizes
  private _measureAndRecalc(): void {
    const svg = this.shadowRoot?.querySelector<SVGSVGElement>('.card-container svg');
    if (!svg || !this._containerRect) return;
    const measured: Record<string, {w: number; h: number}> = {};
    // Collect bounding boxes of rendered text elements
    svg.querySelectorAll<SVGTextElement>('text[id]').forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          measured[el.id] = { w: bbox.width, h: bbox.height };
        }
      } catch {}
    });
    // Patch engine elements' intrinsic sizes
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
    // Rerun layout if any sizes changed
    if (changed) {
      this._layoutCalculationPending = true;
      this._performLayoutCalculation(this._containerRect);
      // Update state to reflect new templates
      const newTemplates = this._layoutEngine.layoutGroups.flatMap((group: any) =>
        group.elements.map((e: any) => e.render()).filter((t: any) => t !== null)
      );
      this._layoutElementTemplates = newTemplates;
      this._viewBox = `0 0 ${this._containerRect.width} ${this._containerRect.height}`;
      this.requestUpdate();
    }
  }
}
