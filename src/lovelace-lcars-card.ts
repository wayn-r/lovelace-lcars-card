import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import { 
  LcarsCardConfig, 
  GroupConfig, 
  ElementConfig,
  StateManagementConfig
} from './types.js';
import gsap from 'gsap';

import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';
import { animationManager, AnimationContext } from './utils/animation.js';
import { colorResolver } from './utils/color-resolver.js';
import { stateManager } from './utils/state-manager.js';
import { StateChangeEvent, StoreProvider } from './core/store.js';
import { transformPropagator } from './utils/transform-propagator.js';

// Editor temporarily disabled - import './editor/lcars-card-editor.js';

import { editorStyles } from './styles/styles.js';

// Interfaces moved to types.ts - keeping import only

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: CARD_NAME,
  description: 'A LCARS themed card for Home Assistant',
});

// ---------------------------------------------------------------------------
// Ensure Antonio font is loaded once for every environment (dev server, tests,
// Home Assistant dashboards). Doing this at module-initialisation time means it
// happens before any <lovelace-lcars-card> element renders text.
// ---------------------------------------------------------------------------

(() => {
  if (typeof document === 'undefined') return;
  const href = 'https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&display=swap';
  const alreadyLoaded = document.head.querySelector(`link[href="${href}"]`);
  if (!alreadyLoaded) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
})();

@customElement(CARD_TYPE)
export class LcarsCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) private _config!: LcarsCardConfig;
  @state() private _layoutElementTemplates: SVGTemplateResult[] = [];
  @state() private _viewBox: string = '0 0 100 100';
  @state() private _calculatedHeight: number = 100;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  
  // Utility classes for better organization
  // Note: visibility is now managed by stateManager
  
  // Legacy state tracking for compatibility
  private _lastHassStates?: { [entityId: string]: any };

  static styles = [editorStyles];

  public setConfig(config: LcarsCardConfig | any): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (JSON.stringify(config) === JSON.stringify(this._lastConfig)) {
        return;
    }
    
    // Convert legacy configuration to new format if necessary
    const normalizedConfig = this._normalizeConfig(config);
    this._config = normalizedConfig;
    this._lastConfig = config;
    
    // Trigger update - layout will happen in updated() if container is ready
    this.requestUpdate(); 
  }

  private _normalizeConfig(config: any): LcarsCardConfig {
    // Validate that we have the new format
    if (!config.groups || !Array.isArray(config.groups)) {
      throw new Error('Invalid configuration: groups array is required. Please update to the new YAML format.');
    }

    // Validate groups structure
    config.groups.forEach((group: any, index: number) => {
      if (!group.group_id || typeof group.group_id !== 'string') {
        throw new Error(`Invalid configuration: group at index ${index} is missing group_id`);
      }
      if (!group.elements || !Array.isArray(group.elements)) {
        throw new Error(`Invalid configuration: group "${group.group_id}" is missing elements array`);
      }
    });

    return {
      type: config.type,
      title: config.title,
      groups: config.groups,
      state_management: config.state_management
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    
    // Subscribe to store changes directly
    StoreProvider.getStore().subscribe(() => this._refreshElementRenders());
    
    // Set up resize observer
    this._resizeObserver = new ResizeObserver((entries) => {
      this._handleResize(entries);
    });
  }
  
  public firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
    }
    
    // Use event-driven approach for initial layout calculation
    this._scheduleInitialLayout();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>): void {
    super.updated(changedProperties);

    const hasHassChanged = changedProperties.has('hass');
    const hasConfigChanged = changedProperties.has('_config');
    const hasTemplatesChanged = changedProperties.has('_layoutElementTemplates');

    if (hasConfigChanged || hasHassChanged) {
      this._updateLayoutEngineWithHass();
    }

    // Simple logic: if we have both config and container, calculate layout
    if (this._config && this._containerRect) {
      if (hasConfigChanged) {
        // Config changed - always recalculate
        this._performLayoutCalculation(this._containerRect);
      } else if (hasHassChanged && this._lastHassStates) {
        // Check for significant entity changes using the ColorResolver
        const hasSignificantEntityChanges = colorResolver.hasSignificantEntityChanges(
          this._layoutEngine.layoutGroups,
          this._lastHassStates,
          this.hass
        );
        
        if (hasSignificantEntityChanges) {
          this._performLayoutCalculation(this._containerRect);
        }
      }
    }

    // Handle dynamic color changes using the ColorResolver
    if (hasHassChanged && this.hass && this._lastHassStates) {
      colorResolver.checkDynamicColorChanges(
        this._layoutEngine.layoutGroups,
        this.hass,
        () => this._refreshElementRenders()
      );
    }

    // Store current hass states for next comparison
    if (this.hass) {
      this._lastHassStates = { ...this.hass.states };
    }

    // Ensure interactive listeners are set up after any template changes or view switches
    if (hasTemplatesChanged || hasConfigChanged) {
      // Use timeout to ensure DOM elements are fully rendered
      setTimeout(() => {
        if (this._layoutEngine.layoutGroups.length > 0) {
          this._setupAllElementListeners();
        }
      }, 50);
    }
  }

  private _scheduleInitialLayout(): void {
    // Wait for browser to complete layout using requestAnimationFrame
    requestAnimationFrame(() => {
      this._tryCalculateInitialLayout();
    });
    
    // Also listen for load event as fallback
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this._tryCalculateInitialLayout();
      }, { once: true });
    }
  }

  private _tryCalculateInitialLayout(): void {
    // Only calculate if we haven't already successfully calculated
    if (this._containerRect && this._layoutElementTemplates.length > 0) {
      return; // Already calculated
    }
    
    const container = this.shadowRoot?.querySelector('.card-container');
    if (!container || !this._config) {
      return; // Not ready yet
    }
    
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this._containerRect = rect;
      this._performLayoutCalculation(rect);
    } else {
      // If still no dimensions, try again next frame
      requestAnimationFrame(() => {
        this._tryCalculateInitialLayout();
      });
    }
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    
    // Clean up utility classes
    colorResolver.cleanup();
    stateManager.cleanup();
    
    // Clean up all element animations and entity monitoring
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.cleanup();
      }
    }
    
    super.disconnectedCallback();
  }

  private _handleViewChange(): void {
    console.log('[LCARS Card] View change detected, refreshing dynamic color system');
    
    // Clear all dynamic color caches and entity monitoring using the ColorResolver
    colorResolver.clearAllCaches(this._layoutEngine.layoutGroups);
    
    // Force invalidation of last hass states to ensure fresh comparison
    this._lastHassStates = undefined;
    
    // Schedule a dynamic color refresh using the ColorResolver
    colorResolver.scheduleDynamicColorRefresh(
      this.hass,
      this._containerRect,
      () => colorResolver.checkDynamicColorChanges(
        this._layoutEngine.layoutGroups,
        this.hass,
        () => this._refreshElementRenders()
      ),
      () => this._refreshElementRenders()
    );
  }
  
  private _calculateRequiredHeight(containerWidth: number, containerHeight: number): number {
    // Analyze elements to determine the minimum container height needed
    // for proper anchoring and positioning
    let requiredHeight = containerHeight; // Start with original height
    
    if (!this._config?.groups) {
      return requiredHeight;
    }
    
    // Find elements that directly define height requirements
    for (const group of this._config.groups) {
      for (const elementConfig of group.elements) {
        if (!elementConfig.layout) continue;
        
        const height = this._parseSize(elementConfig.layout.height, containerHeight);
        const anchor = elementConfig.layout.anchor;
        
        // For center-anchored elements, ensure container is at least as tall as the element
        if (anchor?.to === 'container' && 
            anchor.element_point === 'center' && 
            anchor.target_point === 'center') {
          requiredHeight = Math.max(requiredHeight, height);
        }
        
        // For bottom-anchored elements, ensure container has enough space
        if (anchor?.to === 'container' && 
            anchor.target_point?.includes('bottom')) {
          requiredHeight = Math.max(requiredHeight, height);
        }
        
        // For top-anchored elements with significant height
        if (anchor?.to === 'container' && 
            anchor.target_point?.includes('top')) {
          requiredHeight = Math.max(requiredHeight, height);
        }
      }
    }
    
    return requiredHeight;
  }
  
  private _parseSize(size: number | string | undefined, containerDimension: number): number {
    if (typeof size === 'number') {
      return size;
    }
    if (typeof size === 'string') {
      if (size.endsWith('%')) {
        const percentage = parseFloat(size) / 100;
        return containerDimension * percentage;
      }
      return parseFloat(size) || 0;
    }
    return 0;
  }

  private _performLayoutCalculation(rect: DOMRect): void {
    if (!this._config || !rect || rect.width <= 0 || rect.height <= 0) {
        console.warn("[_performLayoutCalculation] Skipping, invalid config or rect", this._config, rect);
        return;
    }

    try {
      const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
      if (svgElement) {
        (this._layoutEngine as any).tempSvgContainer = svgElement;
      }
      
      // Clear previous layout and visibility triggers
      this._layoutEngine.clearLayout();
      
      // Parse config and add elements to layout engine
      const getShadowElement = (id: string): Element | null => {
        return this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
      };
      
      const groups = parseConfig(this._config, this.hass, () => { 
        this._refreshElementRenders(); 
      }, getShadowElement); 
      
      groups.forEach((group: Group) => { 
        this._layoutEngine.addGroup(group); 
      });

      // Collect all element IDs and group IDs
      const elementIds: string[] = [];
      const groupIds: string[] = [];

      groups.forEach(group => {
        groupIds.push(group.id);
        console.log(`[LcarsCard] Processing group: ${group.id}`);
        group.elements.forEach(element => {
          elementIds.push(element.id);
          console.log(`[LcarsCard] Processing element: ${element.id}`);
        });
      });

      // Visibility is now managed through regular state values ('hidden'/'visible')

      // Initialize state manager
      const animationContext: AnimationContext = {
        elementId: 'card',
        getShadowElement: getShadowElement,
        hass: this.hass,
        requestUpdateCallback: () => this.requestUpdate()
      };
      
      const elementsMap = new Map<string, LayoutElement>();
      groups.forEach(group => {
        group.elements.forEach(element => {
          elementsMap.set(element.id, element);
        });
      });
      
      stateManager.setAnimationContext(animationContext, elementsMap);
      this._initializeElementStates(groups);
      this._setupStateChangeHandling(elementsMap);
      
      // Initialize transform propagator with current layout state
      transformPropagator.initialize(elementsMap, animationContext.getShadowElement);

      // Clear all entity monitoring and animation state before recalculating layout
      for (const group of this._layoutEngine.layoutGroups) {
        for (const element of group.elements) {
          try {
            element.clearMonitoredEntities();
            element.cleanupAnimations();
          } catch (error) {
            console.error("[_performLayoutCalculation] Error clearing element state", element.id, error);
          }
        }
      }

      // For dynamic height mode, we need to pre-determine the required container height
      // by analyzing element size requirements, then perform layout with that height
      const inputRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
      
      // Pre-calculate required height by examining element constraints
      const requiredHeight = this._calculateRequiredHeight(rect.width, rect.height);
      
      // Use the required height for layout calculation to ensure proper anchoring
      const finalContainerRect = new DOMRect(rect.x, rect.y, rect.width, requiredHeight);
      const layoutDimensions = this._layoutEngine.calculateBoundingBoxes(finalContainerRect, { dynamicHeight: true });
      
      // Store the calculated height for rendering
      this._calculatedHeight = layoutDimensions.height;

      // Render all elements (hidden elements styled with CSS)
      const newTemplates = this._renderAllElements();

      const TOP_MARGIN = 8;  // offset for broken HA UI
      
      // Update viewBox to match container dimensions and calculated height
      const newViewBox = `0 ${-TOP_MARGIN} ${rect.width} ${this._calculatedHeight + TOP_MARGIN}`;

      
      if (JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !==
          JSON.stringify(this._layoutElementTemplates.map(t => ({s:t.strings, v: (t.values || []).map(val => String(val))}))) || newViewBox !== this._viewBox) {
          this._layoutElementTemplates = newTemplates;
          this._viewBox = newViewBox;
          // Trigger re-render to show the new content
          this.requestUpdate();
          
          // Set up event listeners and trigger lifecycle animations after DOM elements are rendered
          setTimeout(() => {
            this._setupAllElementListeners();
            
            // Trigger on_load animations for all elements
            this._triggerOnLoadAnimations(groups);
          }, 100);
      }
      
    } catch (error) {
      console.error("[_performLayoutCalculation] Layout calculation failed with error:", error);
      console.error("[_performLayoutCalculation] Error stack:", (error as Error).stack);
      // Set a fallback state to prevent infinite pending
      this._layoutElementTemplates = [];
      this._viewBox = `0 0 ${rect.width} 100`;
      this._calculatedHeight = 100;
    }
  }

  private _refreshElementRenders(): void {
    if (!this._config || !this._containerRect || this._layoutEngine.layoutGroups.length === 0) {
        return;
    }

    // Update hass references for all elements before re-rendering
    this._layoutEngine.layoutGroups.forEach(group => {
        group.elements.forEach(el => {
            // Ensure el is treated as LayoutElement for type safety
            const layoutEl = el as LayoutElement; 
            if (layoutEl.updateHass) {
                layoutEl.updateHass(this.hass);
            }
        });
    });

    // Collect element IDs for animation state restoration
    const elementIds = this._layoutEngine.layoutGroups.flatMap(group => 
        group.elements.map(el => el.id)
    );

    // Store animation states before re-render using animation manager
    const animationStates = animationManager.collectAnimationStates(
        elementIds,
        (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null
    );

    const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
        group.elements
            .map(el => {
              try {
                // Always render all elements to keep them in DOM for animations
                const elementTemplate = el.render();
                if (!elementTemplate) {
                  return null;
                }

                // Apply CSS visibility for hidden elements but keep them in DOM
                const currentState = stateManager.getState(el.id);
                const isVisible = currentState !== 'hidden';
                
                if (!isVisible) {
                  // Wrap hidden elements with CSS to hide them but keep in DOM for animations
                  return svg`<g style="visibility: hidden; opacity: 0; pointer-events: none;">${elementTemplate}</g>`;
                }
                
                return elementTemplate;
              } catch (error) {
                console.error("[LcarsCard] Error rendering element", el.id, error);
                return null;
              }
            })
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    this._layoutElementTemplates = newTemplates;
    
    // Trigger LitElement re-render to update non-button elements with new colors
    // Button elements handle their color updates directly via _updateButtonAppearanceDirectly()
    this.requestUpdate();

    // Schedule interactive listener setup and animation restoration to occur after the next render cycle
    // Use multiple frame delays to ensure DOM is fully updated after view switches
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Set up interactive listeners after DOM elements are updated
            this._setupAllElementListeners();
            
            // Schedule animation restoration to occur after listener setup
            if (animationStates.size > 0) {
                const context: AnimationContext = {
                    elementId: '', // Not used in restoration context for multiple elements
                    getShadowElement: (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null,
                    hass: this.hass,
                    requestUpdateCallback: this.requestUpdate.bind(this)
                };
                animationManager.restoreAnimationStates(animationStates, context, () => {
                     // Optional callback after all animations are restored
                });
            }
        });
    });
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    
    const newRect = entry.contentRect;
    
    // Only process if dimensions are valid
    if (newRect.width > 0 && newRect.height > 0) {
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
        
        // If we have config, immediately calculate layout
        if (this._config) {
          this._performLayoutCalculation(this._containerRect);
        }
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    // Visual editor temporarily disabled - YAML configuration only
    const element = document.createElement('div') as any;
    element.innerHTML = `
      <div style="padding: 16px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">
        <h3 style="margin-top: 0; color: #d32f2f;">Visual Editor Disabled</h3>
        <p style="color: #666;">The visual editor is temporarily disabled while we migrate to the new YAML configuration system.</p>
        <p style="color: #666;">Please configure this card using YAML only. See the documentation for the new configuration format.</p>
      </div>
    `;
    element.setConfig = () => {};
    return element;
  }

  public getCardSize(): number {
    return 3; 
  }

  protected render(): TemplateResult {
    let svgContent: SVGTemplateResult[] = [];
    let defsContent: SVGTemplateResult[] = [];
    
    // Simple state logic: Show loading until we have both config and container
    if (!this._config) {
      svgContent = [svg`<text x="10" y="30" fill="orange" font-size="14">Loading configuration...</text>`];
    } else if (!this._containerRect) {
      svgContent = [svg`<text x="10" y="30" fill="orange" font-size="14">Waiting for container...</text>`];
    } else if (this._layoutElementTemplates.length > 0) {
      // Normal rendering with layout elements
      svgContent = this._layoutElementTemplates;
      
      // Collect defs content
      defsContent = this._layoutEngine.layoutGroups.flatMap((group: any) =>
        group.elements.flatMap((e: any) => e.renderDefs?.() || []).filter((d: any) => d !== null)
      );
    } else {
      // We have config and container but no templates - show error
      svgContent = [svg`<text x="10" y="30" fill="red" font-size="14">No layout elements to render</text>`];
    }

    // Extract dimensions from viewBox
    const viewBoxParts = this._viewBox.split(' ');
    const viewBoxWidth = parseFloat(viewBoxParts[2]) || 100;
    const viewBoxHeight = parseFloat(viewBoxParts[3]) || 100;
    
    // Define dimensions based on container rect or view box
    const width = this._containerRect ? this._containerRect.width : viewBoxWidth;
    const height = this._calculatedHeight || viewBoxHeight;
    
    // Style for the SVG - ensure it takes full width and has proper minimum height
    const svgStyle = `width: 100%; height: ${height}px; min-height: 50px;`;
    
    // Container style - ensure proper width and minimum height
    const containerStyle = `width: 100%; height: ${height}px; min-height: 50px; overflow: visible;`;

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

  private _updateLayoutEngineWithHass(): void {
    // Update all layout elements with new hass instance
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.updateHass(this.hass);
      }
    }
  }

  private _initializeElementStates(groups: Group[]): void {
    groups.forEach(group => {
      group.elements.forEach(element => {
        // Initialize elements that have state management or animations
        if (element.props.state_management || element.props.animations) {
          stateManager.initializeElementState(
            element.id,
            element.props.state_management,
            element.props.animations
          );
          
          // Initial visibility states are now handled by the state system automatically
          // through the default_state configuration in initializeElementState
        }
      });
    });
  }

  private _setupStateChangeHandling(elementsMap: Map<string, LayoutElement>): void {
    stateManager.onStateChange((event) => {
      console.log(`[LcarsCard] State change: ${event.elementId} -> ${event.toState}`);
      
      this.updateStatusIndicators(elementsMap);
      this.requestUpdate();
    });
  }

  private _renderAllElements(): SVGTemplateResult[] {
    return this._layoutEngine.layoutGroups.flatMap(group =>
      group.elements
        .map(el => {
          try {
            // Always render all elements to keep them in DOM for animations
            const elementTemplate = el.render();
            if (!elementTemplate) {
              return null;
            }

            // Apply CSS visibility for hidden elements but keep them in DOM
            const currentState = stateManager.getState(el.id);
            const isVisible = currentState !== 'hidden';
            
            if (!isVisible) {
              // Wrap hidden elements with CSS to hide them but keep in DOM for animations
              return svg`<g style="visibility: hidden; opacity: 0; pointer-events: none;">${elementTemplate}</g>`;
            }
            
            return elementTemplate;
          } catch (error) {
            console.error("[LcarsCard] Error rendering element", el.id, error);
            return null;
          }
        })
        .filter((template): template is SVGTemplateResult => template !== null)
    );
  }

  private _triggerOnLoadAnimations(groups: Group[]): void {
    groups.forEach(group => {
      group.elements.forEach(element => {
        if (element.props.animations?.on_load) {
          stateManager.triggerLifecycleAnimation(element.id, 'on_load');
        }
      });
    });
  }

  private updateStatusIndicators(elementsMap: Map<string, LayoutElement>): void {
    // Update panel status indicator
    const panelStatus = elementsMap.get('status_indicators.panel_status');
    if (panelStatus && panelStatus.props) {
      const panelState = stateManager.getState('animated_elements.sliding_panel') || 'hidden';
      panelStatus.props.text = `Panel: ${panelState}`;
    }

    // Update scale status indicator
    const scaleStatus = elementsMap.get('status_indicators.scale_status');
    if (scaleStatus && scaleStatus.props) {
      const scaleState = stateManager.getState('animated_elements.scale_target') || 'normal';
      scaleStatus.props.text = `Scale: ${scaleState}`;
    }
  }

  private _setupAllElementListeners(): void {
    this._layoutEngine.layoutGroups.forEach(group => {
      group.elements.forEach(element => {
        element.setupInteractiveListeners();
      });
    });
  }

  /**
   * Get shadow DOM element by ID for transform propagation
   */
  private _getShadowElement(id: string): Element | null {
    return this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
  }
}
