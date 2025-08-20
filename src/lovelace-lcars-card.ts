import { LitElement, html, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME } from './constants';
import { 
  LcarsCardConfig, 
} from './types.js';
import gsap from 'gsap';

import './layout/widgets/index.js';
import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';
import { animationManager, AnimationContext, AnimationManager } from './utils/animation.js';
import { colorResolver, ColorResolver } from './utils/color-resolver.js';
import { StoreProvider, StateChangeEvent } from './core/store.js';
import { CardRuntime, RuntimeFactory } from './core/runtime.js';
import { FontManager } from './utils/font-manager.js';
import { ConfigValidator, logValidationResult } from './utils/config-validator.js';
import { WidgetRegistry } from './layout/widgets/registry.js';


import { editorStyles } from './styles/styles.js';

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: CARD_NAME,
  description: 'A LCARS themed card for Home Assistant',
});

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
  @state() private _fontsLoaded = false;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  private _lastHassStates?: { [entityId: string]: any };
  private _needsReinitialization = false;
  private _layoutInitialized = false;
  private _fontsReady: Promise<void>;
  private _resolveFontsReady!: () => void;
  private _runtime?: CardRuntime;
  private _storeUnsubscribe?: () => void;
  private _elementGraph?: Group[];

  static styles = [editorStyles];

  constructor() {
    super();
    this._fontsReady = new Promise<void>((resolve) => {
      this._resolveFontsReady = resolve;
    });
    
    ColorResolver.preloadThemeColors().catch(error => {
      console.warn('Failed to preload theme fallback colors:', error);
    });
  }

  public setConfig(config: LcarsCardConfig | any): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (JSON.stringify(config) === JSON.stringify(this._lastConfig)) {
        return;
    }
    
    const normalizedConfig = this.normalizeConfig(config);

    const validation = ConfigValidator.validateConfig(normalizedConfig);
    logValidationResult(validation);

    this._config = normalizedConfig;
    this._ensureRuntime();
    this._lastConfig = config;
    
    this._cleanupElementGraph();
    this._elementGraph = undefined;
    
    this.requestUpdate(); 
  }

  private _ensureRuntime(): void {
    if (this._runtime) return;
    const getShadowElement = (id: string): Element | null => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
    this._runtime = RuntimeFactory.create({
      requestUpdate: () => this._refreshElementRenders(),
      getShadowElement,
      hass: this.hass
    });
  }

  private normalizeConfig(config: any): LcarsCardConfig {
    if (!config.groups || !Array.isArray(config.groups)) {
      throw new Error('Invalid configuration: groups array is required. Please update to the new YAML format.');
    }

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
    
    AnimationManager.initializeGsap();
    this._storeUnsubscribe = StoreProvider.getStore().subscribe(() => this._refreshElementRenders());
    
    this._resizeObserver = new ResizeObserver((entries) => {
      this._handleResize(entries);
    });

    if (this._needsReinitialization) {
      this._runtime = undefined;
      if (this._config) {
        this._ensureRuntime();
      }
    }

    if (this._needsReinitialization && this._config && this._containerRect) {
      this._scheduleReinitialization();
    }
  }
  
  public async firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
    }
    
    this._layoutInitialized = false;

    try {
      await FontManager.ensureFontsLoaded(['Antonio']);
      this._fontsLoaded = true;
      FontManager.clearMetricsCache();
      this._resolveFontsReady();
    } catch (error) {
      console.error("Font loading failed", error);
      this._fontsLoaded = true;
      this._resolveFontsReady();
    }

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

    if (this._config && this._containerRect) {
      if (hasConfigChanged) {
        this._performLayoutCalculation(this._containerRect);
      } else if (hasHassChanged && this._lastHassStates) {
        const hasSignificantEntityChanges = colorResolver.elementEntityStatesChanged(
          this._layoutEngine.layoutGroups,
          this._lastHassStates,
          this.hass
        );
        
        if (hasSignificantEntityChanges) {
          this._performLayoutCalculation(this._containerRect);
        }
      }
    }

    if (hasHassChanged && this.hass && this._lastHassStates) {
      colorResolver.scheduleDynamicColorChangeDetection(
        this._layoutEngine.layoutGroups,
        this.hass,
        () => this._refreshElementRenders()
      );
    }

    if (this.hass) {
      this._lastHassStates = { ...this.hass.states };
    }

    if (hasTemplatesChanged || hasConfigChanged) {
      setTimeout(() => {
        if (this._layoutEngine.layoutGroups.length > 0) {
          this._setupAllElementListeners();
        }
      }, 50);
    }
  }

  private _scheduleInitialLayout(): void {
    requestAnimationFrame(() => {
      this._tryCalculateInitialLayout();
    });
    
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this._tryCalculateInitialLayout();
      }, { once: true });
    }
  }

  private _scheduleReinitialization(): void {
    requestAnimationFrame(async () => {
      if (this._config && this._containerRect) {
        this._needsReinitialization = false;
        await this._performLayoutCalculation(this._containerRect);
      }
    });
  }

  private async _tryCalculateInitialLayout(): Promise<void> {
    if (this._layoutInitialized) {
      return;
    }

    await this._fontsReady;
    
    const container = this.shadowRoot?.querySelector('.card-container');
    if (!container || !this._config) {
      requestAnimationFrame(() => this._tryCalculateInitialLayout());
      return;
    }
    
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this._containerRect = rect;
      await this._performLayoutCalculation(rect);
      this._layoutInitialized = true;
    } else {
      requestAnimationFrame(() => this._tryCalculateInitialLayout());
    }
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    this._storeUnsubscribe?.();
    this._storeUnsubscribe = undefined;
    
    colorResolver.cleanup();
    this._runtime?.state.cleanup();
    
    this._cleanupElementGraph();
    this._elementGraph = undefined;
    this._runtime = undefined;
    this._layoutInitialized = false;

    this._needsReinitialization = true;
    
    super.disconnectedCallback();
  }


  
  private _calculateRequiredHeight(containerWidth: number, containerHeight: number): number {
    let requiredHeight = containerHeight;
    
    if (!this._config?.groups) {
      return requiredHeight;
    }
    
    for (const group of this._config.groups) {
      for (const elementConfig of group.elements) {
        if (!elementConfig.layout) continue;
        
        const height = this._parseSize(elementConfig.layout.height, containerHeight);
        const anchor = elementConfig.layout.anchor;
        
        if (anchor?.to === 'container' && 
            anchor.element_point === 'center' && 
            anchor.target_point === 'center') {
          requiredHeight = Math.max(requiredHeight, height);
        }
        
        if (anchor?.to === 'container' && 
            anchor.target_point?.includes('bottom')) {
          requiredHeight = Math.max(requiredHeight, height);
        }
        
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

  private async _performLayoutCalculation(rect: DOMRect): Promise<void> {
    const isValidLayoutRequest = this._config && rect && rect.width > 0 && rect.height > 0;
    if (!isValidLayoutRequest) {
      console.warn('Skipping layout calculation - invalid config or dimensions');
      return;
    }

    try {
      await this._fontsReady;
    } catch (error) {
      console.warn('Font loading failed, proceeding with layout calculation:', error);
    }

    try {
      const isFirstLayoutOrConfigChanged = !this._elementGraph;
      
      if (isFirstLayoutOrConfigChanged) {
        this._performFullLayoutRebuild(rect);
      } else {
        this._performLayoutRecalculation(rect);
      }
    } catch (error) {
      this._handleLayoutError(error, rect);
    }
  }

  private _performFullLayoutRebuild(rect: DOMRect): void {
    this._setupLayoutEngine(rect);
    const groups = this._createLayoutGroups();
    this._initializeAnimationSystem(groups);
    
    const containerRect = this._calculateFinalContainerRect(rect);
    const layoutDimensions = this._layoutEngine.calculateBoundingBoxes(containerRect, { dynamicHeight: true });
    this._calculatedHeight = layoutDimensions.height;

    const shouldUpdateLayout = this._shouldUpdateLayout(rect);
    if (shouldUpdateLayout) {
      this._applyLayoutChanges(groups);
    }
  }

  private _performLayoutRecalculation(rect: DOMRect): void {
    this._setupLayoutEngine(rect);
    const groups = this._createLayoutGroups(); // Uses cached graph
    
    const containerRect = this._calculateFinalContainerRect(rect);
    const layoutDimensions = this._layoutEngine.calculateBoundingBoxes(containerRect, { dynamicHeight: true });
    this._calculatedHeight = layoutDimensions.height;

    const shouldUpdateLayout = this._shouldUpdateLayout(rect);
    if (shouldUpdateLayout) {
      this._applyLayoutRecalculationChanges();
    }
  }

  private _refreshElementRenders(): void {
    if (!this.isConnected || !this._runtime) {
      return;
    }
    const canRefresh = this._config && this._containerRect && this._layoutEngine.layoutGroups.length > 0;
    if (!canRefresh) {
      return;
    }

    this._updateElementsWithLatestHass();
    const animationStates = this._collectCurrentAnimationStates();
    const newTemplates = this._renderVisibleElements();

    this._layoutElementTemplates = newTemplates;
    this.requestUpdate();

    this._schedulePostRenderUpdates(animationStates);
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    
    const newRect = entry.contentRect;
    const newWidth = newRect.width;
    const newHeight = newRect.height;
    
    if (newWidth > 0 && (newWidth !== this._containerRect?.width || newHeight !== this._containerRect?.height)) {
      this._containerRect = new DOMRect(newRect.x, newRect.y, newWidth, newHeight);
      if (this._runtime) {
        WidgetRegistry.getAllInstances(this._runtime).forEach(w => {
          try { w.onResize(this._containerRect!); } catch (e) { /* noop */ }
        });
      }
      
      this._performLayoutCalculation(this._containerRect);
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
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
    
    if (!this._config) {
      svgContent = [svg`<text x="10" y="30" fill="orange" font-size="14">Loading configuration...</text>`];
    } else if (!this._containerRect) {
      svgContent = [svg`<text x="10" y="30" fill="orange" font-size="14">Waiting for container...</text>`];
    } else if (this._layoutElementTemplates.length > 0) {
      svgContent = this._layoutElementTemplates;
      
      defsContent = this._layoutEngine.layoutGroups.flatMap((group: Group) =>
        group.elements.flatMap((e: LayoutElement) => {
            if ('renderDefs' in e && typeof e.renderDefs === 'function') {
                return e.renderDefs() || [];
            }
            return [];
        }).filter((d) => d !== null)
      );
    } else {
      svgContent = [svg`<text x="10" y="30" fill="red" font-size="14">No layout elements to render</text>`];
    }

    const viewBoxParts = this._viewBox.split(' ');
    const viewBoxWidth = parseFloat(viewBoxParts[2]) || 100;
    const viewBoxHeight = parseFloat(viewBoxParts[3]) || 100;
    
    const width = this._containerRect ? this._containerRect.width : viewBoxWidth;
    const height = this._calculatedHeight || viewBoxHeight;
    
    const svgStyle = `width: 100%; height: ${height}px; min-height: 50px;`;
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
    if (this._elementGraph) {
      for (const group of this._elementGraph) {
        for (const element of group.elements) {
          element.updateHass(this.hass);
        }
      }
    }
    
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.updateHass(this.hass);
      }
    }
  }

  private _initializeElementStates(groups: Group[]): void {
    const sm = this._runtime!.state;
    groups.forEach(group => {
      group.elements.forEach(element => {
        if (element.props.state_management || element.props.animations) {
          sm.initializeElementState(
            element.id,
            element.props.state_management,
            element.props.animations
          );
        }
      });
    });
  }

  private _setupStateChangeHandling(elementsMap: Map<string, LayoutElement>): void {
    const sm = this._runtime!.state;
    sm.onStateChange((_event: StateChangeEvent) => {
      this.requestUpdate();
    });
  }

  private _renderAllElements(): SVGTemplateResult[] {
    return this._layoutEngine.layoutGroups.flatMap(group =>
      group.elements
        .map(el => {
          try {
            const elementTemplate = el.render();
            if (!elementTemplate) {
              return null;
            }

            const currentState = this._runtime!.state.getState(el.id);
            const isVisible = currentState !== 'hidden';
            
            if (!isVisible) {
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
    const sm = this._runtime!.state;
    groups.forEach(group => {
      group.elements.forEach(element => {
        if (element.props.animations?.on_load) {
          sm.triggerLifecycleAnimation(element.id, 'on_load');
        }
      });
    });
  }


  private _setupAllElementListeners(): void {
    this._layoutEngine.layoutGroups.forEach(group => {
      group.elements.forEach(element => {
        element.setupInteractiveListeners();
      });
    });
  }

  private _getShadowElement(id: string): Element | null {
    return this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
  }

  private _setupLayoutEngine(rect: DOMRect): void {
    const svgElement = this.shadowRoot?.querySelector('.card-container svg') as SVGSVGElement | null;
    if (svgElement) {
      (this._layoutEngine as any).tempSvgContainer = svgElement;
    }
    this._layoutEngine.clearLayout();
  }

  private _buildElementGraph(): Group[] {
    const getShadowElement = (id: string): Element | null => 
      this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
    
    return parseConfig(this._config, this.hass, () => this._refreshElementRenders(), getShadowElement, this._runtime);
  }

  private _ensureElementGraph(): Group[] {
    if (!this._elementGraph) {
      this._elementGraph = this._buildElementGraph();
    }
    return this._elementGraph;
  }

  private _cleanupElementGraph(): void {
    if (this._elementGraph) {
      for (const group of this._elementGraph) {
        for (const element of group.elements) {
          element.cleanup();
        }
      }
    }
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        element.cleanup();
      }
    }
    if (this._runtime) {
      const instances = WidgetRegistry.getAllInstances(this._runtime);
      instances.forEach(instance => {
        try { instance.destroy(); } catch (e) { /* noop */ }
      });
      WidgetRegistry.clearInstances(this._runtime);
    }
  }

  private _createLayoutGroups(): Group[] {
    const groups = this._ensureElementGraph();
    groups.forEach((group: Group) => this._layoutEngine.addGroup(group));
    return groups;
  }

  private _initializeAnimationSystem(groups: Group[]): void {
    const getShadowElement = (id: string): Element | null => 
      this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;

    const animationContext: AnimationContext = {
      elementId: 'card',
      getShadowElement,
      hass: this.hass,
      requestUpdateCallback: () => this.requestUpdate()
    };

    const elementsMap = new Map<string, LayoutElement>();
    groups.forEach(group => {
      group.elements.forEach(element => {
        elementsMap.set(element.id, element);
      });
    });

    const sm = this._runtime!.state;
    sm.setAnimationContext(animationContext, elementsMap);
    this._initializeElementStates(groups);
    this._setupStateChangeHandling(elementsMap);
  }

  private _cleanupPreviousAnimations(): void {
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        try {
          element.cleanupAnimations();
        } catch (error) {
          console.error('Error clearing element state', element.id, error);
        }
      }
    }
  }

  private _calculateFinalContainerRect(rect: DOMRect): DOMRect {
    const requiredHeight = this._calculateRequiredHeight(rect.width, rect.height);
    return new DOMRect(rect.x, rect.y, rect.width, requiredHeight);
  }

  private _shouldUpdateLayout(rect: DOMRect): boolean {
    const newTemplates = this._renderAllElements();
    const topMargin = 8;
    const newViewBox = `0 ${-topMargin} ${rect.width} ${this._calculatedHeight + topMargin}`;

    const templatesChanged = JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !==
      JSON.stringify(this._layoutElementTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))})));
    
    const viewBoxChanged = newViewBox !== this._viewBox;
    
    if (templatesChanged || viewBoxChanged) {
      this._layoutElementTemplates = newTemplates;
      this._viewBox = newViewBox;
      return true;
    }
    return false;
  }

  private _applyLayoutChanges(groups: Group[]): void {
    this.requestUpdate();
    this.updateComplete.then(() => {
      this._setupAllElementListeners();
      this._runtime!.state.setInitialAnimationStates(groups);
      this._triggerOnLoadAnimations(groups);
    });
  }

  private _applyLayoutRecalculationChanges(): void {
    this.requestUpdate();
    this.updateComplete.then(() => {
      this._setupAllElementListeners();
    });
  }

  private _handleLayoutError(error: any, rect: DOMRect): void {
    console.error('Layout calculation failed:', error);
    this._layoutElementTemplates = [];
    this._viewBox = `0 0 ${rect.width} 100`;
    this._calculatedHeight = 100;
  }

  private _updateElementsWithLatestHass(): void {
    if (this._elementGraph) {
      this._elementGraph.forEach(group => {
        group.elements.forEach(el => {
          const layoutEl = el as LayoutElement;
          if (layoutEl.updateHass) {
            layoutEl.updateHass(this.hass);
          }
        });
      });
    }
    
    this._layoutEngine.layoutGroups.forEach(group => {
      group.elements.forEach(el => {
        const layoutEl = el as LayoutElement;
        if (layoutEl.updateHass) {
          layoutEl.updateHass(this.hass);
        }
      });
    });
  }

  private _collectCurrentAnimationStates(): Map<string, any> {
    const elementIds = this._layoutEngine.layoutGroups.flatMap(group => 
      group.elements.map(el => el.id)
    );

    if (!this.isConnected) {
      return new Map();
    }

    return animationManager.collectAnimationStates(
      elementIds,
      (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null
    );
  }

  private _renderVisibleElements(): SVGTemplateResult[] {
    const runtime = this._runtime;
    if (!runtime) {
      return [];
    }
    const sm = runtime.state;
    return this._layoutEngine.layoutGroups.flatMap(group =>
      group.elements
        .map(el => {
          try {
            const elementTemplate = el.render();
            if (!elementTemplate) {
              return null;
            }

            const currentState = sm.getState(el.id);
            const isVisible = currentState !== 'hidden';
            
            if (!isVisible) {
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

  private _schedulePostRenderUpdates(animationStates: Map<string, any>): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._setupAllElementListeners();
        
        if (animationStates.size > 0) {
          const context: AnimationContext = {
            elementId: '',
            getShadowElement: (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdate.bind(this)
          };
          animationManager.restoreAnimationStates(animationStates, context, () => {});
        }
      });
    });
  }
}