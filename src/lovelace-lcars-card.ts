import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import './types';
import gsap from 'gsap';

import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';

import './editor/lcars-card-editor.js';

import { editorStyles } from './styles/styles.js';

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
  @state() private _viewBox: string = '0 0 100 100';
  @state() private _elementStateNeedsRefresh: boolean = false;
  @state() private _calculatedHeight: number = 100;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  private _layoutCalculationPending: boolean = false;
  @state() private _hasRenderedOnce: boolean = false;
  @state() private _hasMeasuredRenderedText: boolean = false;
  private _fontsLoaded: boolean = false;
  private _fontLoadAttempts: number = 0;
  private _maxFontLoadAttempts: number = 3;
  private _initialLoadComplete: boolean = false;
  private _resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  private _editModeObserver?: MutationObserver;
  private _forceRecalcRetryCount: number = 0;
  private _maxForceRecalcRetries: number = 10;
  private _visibilityChangeTimeout?: ReturnType<typeof setTimeout>;
  private _isForceRecalculating: boolean = false;
  private _visibilityChangeCount: number = 0;
  
  // Dynamic color monitoring
  private _lastHassStates?: { [entityId: string]: any };
  private _dynamicColorCheckScheduled: boolean = false;

  static styles = [editorStyles];

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
    
    // Listen for window resize as a backup to ResizeObserver
    window.addEventListener('resize', this._handleWindowResize.bind(this));

    // Handle page visibility changes to recalculate on tab switch
    document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
    
    // Listen for potential panel/edit mode changes
    this._setupEditModeObserver();
    
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

    // Force layout recalculation after a short timeout to ensure dimensions are correct
    // This helps ensure proper initial layout, especially in complex layouts like grid views
    setTimeout(() => this._forceLayoutRecalculation(), 100);
    
    // Backup recalculation in case the initial one didn't work due to container not being ready
    setTimeout(() => {
      if (!this._initialLoadComplete) {
        this._forceLayoutRecalculation();
        this._initialLoadComplete = true;
      }
    }, 1000);
  }
  
  public firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
      this._loadFontsAndInitialize();
    } else {
      console.error("[firstUpdated] Could not find .card-container to observe.");
    }
    this._hasRenderedOnce = true;
  }

  private _loadFontsAndInitialize(): void {
    // Collect all fonts used in the card
    const fontLoadPromises: Promise<FontFace[]>[] = [];
    const fontFamilies = new Set<string>();
    
    // Add fonts from text elements
    if (this._config.elements) {
      this._config.elements.forEach(el => {
        if (el.type?.toLowerCase() === 'text' && el.props) {
          const ff = (el.props.fontFamily || 'sans-serif').toString();
          fontFamilies.add(ff);
          const fs = (el.props.fontSize || DEFAULT_FONT_SIZE).toString();
          const fw = (el.props.fontWeight || 'normal').toString();
          try {
            fontLoadPromises.push(document.fonts.load(`${fw} ${fs}px ${ff}`));
          } catch (_e) {
            console.warn(`Failed to load font: ${fw} ${fs}px ${ff}`, _e);
          }
        } else if (el.type?.toLowerCase() === 'top_header' && el.props) {
          const ff = (el.props.fontFamily || 'Antonio').toString();
          fontFamilies.add(ff);
          const fw = (el.props.fontWeight || 'normal').toString();
          // Load at multiple sizes to ensure proper metrics
          try {
            fontLoadPromises.push(document.fonts.load(`${fw} 16px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 24px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 32px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 48px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 64px ${ff}`));
            fontLoadPromises.push(document.fonts.load(`${fw} 200px ${ff}`)); // For metrics calculation
          } catch (_e) {
            console.warn(`Failed to load font: ${fw} <size>px ${ff}`, _e);
          }
        }
      });
    }
    
    // If no specific fonts, ensure system fonts are ready
    if (fontLoadPromises.length === 0) {
      fontLoadPromises.push(document.fonts.load('normal 16px sans-serif'));
    }
    
    // Wait for fonts to load before calculating layout
    const fontsLoaded = Promise.all(fontLoadPromises);
    
    Promise.all([this.updateComplete, fontsLoaded])
      .then(() => {
        this._fontsLoaded = true;
        this._fontLoadAttempts = 0;
        console.log(`Fonts loaded successfully: ${Array.from(fontFamilies).join(', ')}`);
        // Use double requestAnimationFrame to ensure browser has time to process font loading
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this._scheduleInitialCalculation();
          });
        });
      })
      .catch((error) => {
        console.warn('Font loading error:', error);
        this._fontLoadAttempts++;
        
        if (this._fontLoadAttempts < this._maxFontLoadAttempts) {
          // Retry loading fonts with a delay
          setTimeout(() => {
            this._loadFontsAndInitialize();
          }, 200 * this._fontLoadAttempts); // Increasing delay for each attempt
        } else {
          // Proceed anyway after max attempts
          this._fontsLoaded = true;
          console.warn(`Proceeding with layout after ${this._maxFontLoadAttempts} font load attempts`);
          requestAnimationFrame(() => {
            this._scheduleInitialCalculation();
          });
        }
      });
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    window.removeEventListener('resize', this._handleWindowResize.bind(this));
    document.removeEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
    
    // Clean up timeouts
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
      this._resizeTimeout = undefined;
    }
    
    if (this._visibilityChangeTimeout) {
      clearTimeout(this._visibilityChangeTimeout);
      this._visibilityChangeTimeout = undefined;
    }
    
    // Clear recalculation flags
    this._isForceRecalculating = false;
    this._forceRecalcRetryCount = 0;
    this._visibilityChangeCount = 0;
    
    // Clean up edit mode observer
    if (this._editModeObserver) {
      this._editModeObserver.disconnect();
      this._editModeObserver = undefined;
    }
    
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
                // Set flag to try again on next update cycle
                this._layoutCalculationPending = true;
                this.requestUpdate();
            }
        } else {
            console.warn("[_scheduleInitialCalculation] Container element not found.");
            // Schedule retry
            setTimeout(() => this._scheduleInitialCalculation(), 50);
        }
    } else {
         if(this._layoutCalculationPending){
            this._performLayoutCalculation(this._containerRect);
         }
    }
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
    const hasHassChanged = changedProperties.has('hass');
    const hasConfigChanged = changedProperties.has('_config');

    if (hasConfigChanged || hasHassChanged) {
      this._updateLayoutEngineWithHass();
    }

    if (hasConfigChanged) {
      if (this._containerRect) {
        this._performLayoutCalculation(this._containerRect);
      }
    }

    // Handle dynamic color changes
    if (hasHassChanged && this.hass && this._lastHassStates) {
      this._checkDynamicColorChanges();
    }

    // Store current hass states for next comparison
    if (this.hass) {
      this._lastHassStates = { ...this.hass.states };
    }
  }
  
  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        this._layoutCalculationPending = false;
        return;
    }

    console.log("[_performLayoutCalculation] Calculating layout with dimensions:", rect.width, "x", rect.height);

    const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
    if (svgElement) {
      (this._layoutEngine as any).tempSvgContainer = svgElement;
    }
    
    // Clear previous layout
    this._layoutEngine.clearLayout();
    
    // Parse config and add elements to layout engine
    const groups = parseConfig(this._config, this.hass, () => { 
      this._elementStateNeedsRefresh = true; 
      this.requestUpdate(); 
    }); 
    
    groups.forEach((group: Group) => { 
      this._layoutEngine.addGroup(group); 
    });

    // Clear all entity monitoring before recalculating layout
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.clearMonitoredEntities();
      }
    }

    // Calculate layout using the available width and dynamicHeight option
    const inputRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
    const layoutDimensions = this._layoutEngine.calculateBoundingBoxes(inputRect, { dynamicHeight: true });
    
    // Get the required height from the layout engine
    this._calculatedHeight = layoutDimensions.height;

    // Render elements
    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    const TOP_MARGIN = 8;  // offset for broken HA UI
    
    // Update viewBox to match container dimensions and calculated height
    const newViewBox = `0 ${-TOP_MARGIN} ${rect.width} ${this._calculatedHeight + TOP_MARGIN}`;

    
    if (JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !==
        JSON.stringify(this._layoutElementTemplates.map(t => ({s:t.strings, v: (t.values || []).map(val => String(val))}))) || newViewBox !== this._viewBox) {
        this._layoutElementTemplates = newTemplates;
        this._viewBox = newViewBox;
    }
    
    this._layoutCalculationPending = false;
  }

  private _refreshElementRenders(): void {
    if (!this._config || !this._containerRect || this._layoutEngine.layoutGroups.length === 0) {
        this._elementStateNeedsRefresh = false;
        return;
    }

    // Update hass references for all elements before re-rendering
    this._layoutEngine.layoutGroups.forEach(group => {
        group.elements.forEach(el => {
            const layoutEl = el as any;
            if (layoutEl.updateHass) {
                layoutEl.updateHass(this.hass);
            }
        });
    });

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    this._layoutElementTemplates = newTemplates;

    this._elementStateNeedsRefresh = false;
  }

  private _handleVisibilityChange(): void {
    // Track multiple rapid visibility changes for debugging
    this._visibilityChangeCount++;
    console.log(`Visibility change #${this._visibilityChangeCount}, state: ${document.visibilityState}, currently recalculating: ${this._isForceRecalculating}`);
    
    // Clear any existing timeout
    if (this._visibilityChangeTimeout) {
      clearTimeout(this._visibilityChangeTimeout);
    }
    
    if (document.visibilityState === 'visible') {
        // If we're already in a recalculation cycle, skip this event
        if (this._isForceRecalculating) {
            console.log("Skipping visibility change - already recalculating");
            return;
        }
        
        // Add a longer delay to give the browser more time to restore the layout properly
        // and to debounce rapid visibility changes more aggressively
        this._visibilityChangeTimeout = setTimeout(() => {
            // Double check that we're still visible and not already recalculating
            if (document.visibilityState === 'visible' && !this._isForceRecalculating) {
                // Reset retry counter for a fresh start, but only if we're not already retrying
                this._forceRecalcRetryCount = 0;
                
                requestAnimationFrame(() => {
                    this._forceLayoutRecalculation();
                });
            }
            this._visibilityChangeTimeout = undefined;
        }, 500); // Increased from 250ms to 500ms for more aggressive debouncing
    }
  }

  private _handleWindowResize(): void {
    // Debounce resize handling to avoid excessive calculations
    if (this._resizeTimeout) {
        clearTimeout(this._resizeTimeout);
    }
    
    this._resizeTimeout = setTimeout(() => {
        const container = this.shadowRoot?.querySelector('.card-container');
        if (container) {
            const newRect = container.getBoundingClientRect();
            if (newRect.width > 0 && newRect.height > 0) {
                this._handleDimensionChange(newRect);
            }
        }
        this._resizeTimeout = undefined;
    }, 50);
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    
    const newRect = entry.contentRect;
    
    // Only process if dimensions are valid
    if (newRect.width > 0 && newRect.height > 0) {
        this._handleDimensionChange(newRect);
    } else {
        console.warn("ResizeObserver received invalid dimensions:", newRect);
        // If we got invalid dimensions from ResizeObserver, check directly
        const container = this.shadowRoot?.querySelector('.card-container');
        if (container) {
            const directRect = container.getBoundingClientRect();
            if (directRect.width > 0 && directRect.height > 0) {
                this._handleDimensionChange(directRect);
            }
        }
    }
  }

  private _handleDimensionChange(newRect: DOMRect): void {
    // Check if dimensions have changed significantly
    if (!this._containerRect || 
        Math.abs(this._containerRect.width - newRect.width) > 1 ||
        Math.abs(this._containerRect.height - newRect.height) > 1) 
    {
        console.log("Dimension change detected:", newRect.width, "x", newRect.height);
        
        // Update container dimensions
        this._containerRect = newRect;
        
        // Reset all layouts for a complete recalculation
        if (this._layoutEngine && this._layoutEngine.layoutGroups) {
            this._layoutEngine.layoutGroups.forEach(group => {
                group.elements.forEach(el => {
                    el.resetLayout();
                });
            });
        }
        
        // Only mark for recalculation but don't change height yet - that will be done in _performLayoutCalculation
        this._layoutCalculationPending = true;
        this.requestUpdate();
        
        // If this is the first successful resize with valid dimensions, mark initial load complete
        if (!this._initialLoadComplete && newRect.width > 50 && newRect.height > 50) {
            this._initialLoadComplete = true;
        }
    }
  }

  private _forceLayoutRecalculation(): void {
    // If we're already recalculating, avoid overlapping attempts
    if (this._isForceRecalculating) {
      console.log("Skipping force recalculation - already in progress");
      return;
    }
    
    // Get current container dimensions
    const container = this.shadowRoot?.querySelector('.card-container');
    if (!container) {
      console.warn("Container not found during force recalculation");
      this._forceRecalcRetryCount = 0; // Reset counter
      this._isForceRecalculating = false; // Clear flag
      return;
    }

    const newRect = container.getBoundingClientRect();
    
    // Only proceed if container has non-zero dimensions
    if (newRect.width > 0 && newRect.height > 0) {
        console.log("Forcing layout recalculation:", newRect.width, "x", newRect.height);
        
        // Set the flag to indicate we're recalculating
        this._isForceRecalculating = true;
        
        // Reset retry counter on success
        this._forceRecalcRetryCount = 0;
        
        // Reset all layouts for recalculation
        if (this._layoutEngine && this._layoutEngine.layoutGroups) {
            this._layoutEngine.layoutGroups.forEach(group => {
                group.elements.forEach(el => {
                    el.resetLayout();
                });
            });
        }
        
        // Update container rect and trigger recalculation
        this._containerRect = newRect;
        this._layoutCalculationPending = true;
        this.requestUpdate();
        
        // Clear the flag after a short delay to allow the recalculation to complete
        // We use a timeout here because requestUpdate is async
        setTimeout(() => {
            this._isForceRecalculating = false;
        }, 100);
    } else {
        // If container has zero dimensions, check retry limit
        this._forceRecalcRetryCount++;
        
        if (this._forceRecalcRetryCount <= this._maxForceRecalcRetries) {
            console.warn(`Container has zero dimensions during force recalculation (attempt ${this._forceRecalcRetryCount}/${this._maxForceRecalcRetries})`);
            
            // Set flag to indicate we're in a retry cycle
            this._isForceRecalculating = true;
            
            // Use increasing delays to give the browser more time to restore dimensions
            const delay = Math.min(100 * this._forceRecalcRetryCount, 1000);
            setTimeout(() => {
                this._forceLayoutRecalculation();
            }, delay);
        } else {
            console.warn(`Giving up force recalculation after ${this._maxForceRecalcRetries} attempts with zero dimensions`);
            this._forceRecalcRetryCount = 0; // Reset for future attempts
            this._isForceRecalculating = false; // Clear flag
        }
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
           
           // Log debug info
           console.warn(`[RENDER] Showing 'calculating layout' - pending: ${this._layoutCalculationPending}, templates: ${this._layoutElementTemplates.length}, hasRendered: ${this._hasRenderedOnce}, containerRect: ${this._containerRect ? 'available' : 'missing'}`);
           
           // Safety timeout to prevent getting stuck in calculating state
           setTimeout(() => {
             if (this._layoutCalculationPending) {
               console.warn("Layout calculation seems stuck, forcing retry...");
               this._layoutCalculationPending = false;
               if (this._containerRect) {
                 this._performLayoutCalculation(this._containerRect);
               }
             }
           }, 3000); // 3 second timeout
      }
    }

    // Extract dimensions from viewBox
    const viewBoxParts = this._viewBox.split(' ');
    const viewBoxWidth = parseFloat(viewBoxParts[2]) || 100;
    const viewBoxHeight = parseFloat(viewBoxParts[3]) || 100;
    
    // Define dimensions based on container rect or view box
    const width = this._containerRect ? this._containerRect.width : viewBoxWidth;
    const height = this._calculatedHeight || viewBoxHeight;
    
    // Style for the SVG
    const svgStyle = `width: 100%; height: ${height}px;`;
    
    // Simple container style
    const containerStyle = `width: 100%; height: ${height}px;`;

    return html`
      <ha-card>
        <div class="card-container" 
             style="${containerStyle}">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox=${this._viewBox}
            preserveAspectRatio="none"
            style=${svgStyle}
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
    // Skip if fonts aren't loaded yet
    if (!this._fontsLoaded) {
      console.warn('Skipping measurement - fonts not fully loaded yet');
      // Schedule another attempt
      setTimeout(() => this._loadFontsAndInitialize(), 100);
      return;
    }
    
    const svg = this.shadowRoot?.querySelector<SVGSVGElement>('.card-container svg');
    if (!svg || !this._containerRect) return;
    
    // Force a reflow to ensure accurate measurements
    svg.style.display = 'none';
    // Use getBoundingClientRect to force reflow without TypeScript errors
    void svg.getBoundingClientRect();
    svg.style.display = '';
    
    const measured: Record<string, {w: number; h: number}> = {};
    svg.querySelectorAll<SVGTextElement>('text[id]').forEach(el => {
      try {
        const bbox = el.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          measured[el.id] = { w: bbox.width, h: bbox.height };
        }
      } catch (e) {
        console.warn(`Error measuring text element ${el.id}:`, e);
      }
    });
    
    // Create a map of updated sizes to pass to the engine
    const updatedSizesMap = new Map<string, {width: number, height: number}>();
    
    // Compare measured sizes with current intrinsic sizes
    const engineAny = this._layoutEngine as any;
    const elementsMap: Map<string, any> = engineAny.elements;
    
    elementsMap.forEach((el: any, id: string) => {
      const m = measured[id];
      if (m && (el.intrinsicSize.width !== m.w || el.intrinsicSize.height !== m.h)) {
        // Store the updated sizes in the map
        updatedSizesMap.set(id, { width: m.w, height: m.h });
      }
    });
    
    if (updatedSizesMap.size > 0) {
      // Pass the updated sizes to the layout engine for recalculation
      const layoutDimensions = this._layoutEngine.updateIntrinsicSizesAndRecalculate(
        updatedSizesMap, 
        this._containerRect
      );
      
      // Update the card's calculated height
      this._calculatedHeight = layoutDimensions.height;
      
      // Update rendered elements
      const newTemplates = this._layoutEngine.layoutGroups.flatMap((group: any) =>
        group.elements.map((e: any) => e.render()).filter((t: any) => t !== null)
      );
      
      // Update viewBox and trigger a re-render
      this._layoutElementTemplates = newTemplates;
      this._viewBox = `0 0 ${this._containerRect.width} ${this._calculatedHeight}`;
      this.requestUpdate();
    }
  }

  private _setupEditModeObserver(): void {
    // Clean up any existing observer
    if (this._editModeObserver) {
      this._editModeObserver.disconnect();
    }
    
    // Create a new observer to watch for changes in the DOM that might affect edit mode
    this._editModeObserver = new MutationObserver((mutations) => {
      // If any mutation might have affected the edit mode or panel layout, adjust
      const shouldCheck = mutations.some(mutation => {
        // Check for relevant class changes
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          return true;
        }
        // Check for added/removed nodes that might affect layout
        if (mutation.type === 'childList' && 
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
          return true;
        }
        return false;
      });
    });
    
    // Observe changes to document body and its children
    this._editModeObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  private _updateLayoutEngineWithHass(): void {
    // Update all layout elements with new hass instance
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.updateHass(this.hass);
      }
    }
  }

  private _checkDynamicColorChanges(): void {
    if (this._dynamicColorCheckScheduled) return;
    
    this._dynamicColorCheckScheduled = true;
    
    // Use longer delay to reduce frequency of checks
    setTimeout(() => {
      this._dynamicColorCheckScheduled = false;
      
      let needsRefresh = false;
      
      // Check all layout elements for entity changes
      for (const group of this._layoutEngine.layoutGroups) {
        for (const element of group.elements) {
          if (element.checkEntityChanges(this.hass!)) {
            needsRefresh = true;
            // Break early since we already know we need to refresh
            break;
          }
        }
        if (needsRefresh) break; // Break outer loop too
      }
      
      if (needsRefresh) {
        this._refreshElementRenders();
      }
    }, 100); // Increased delay from 0ms to 100ms to reduce frequency
  }
}
