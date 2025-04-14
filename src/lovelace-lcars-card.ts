import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import './types'; // Import types to ensure global declarations are included
import gsap from 'gsap';

// Import core layout engine classes
import { LayoutEngine, Group, LayoutElement } from './layout/engine.js';
import { parseConfig } from './layout/parser.js';

// Define the card configuration options interface
export interface LcarsCardConfig {
  type: string;
  title?: string;
  text?: string;
  fontSize?: number;
  elements?: any[];
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
  }
  
  firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
      // Schedule the first check slightly later
      requestAnimationFrame(() => this._scheduleInitialCalculation());
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
      } else if (this._layoutCalculationPending) {
      }
  }
  
  // Performs the calculation and updates state
  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        this._layoutCalculationPending = false; // Abort this attempt
        return;
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

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor.js');
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
}
