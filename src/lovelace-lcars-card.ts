import { LitElement, html, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME } from './constants';
import { 
  LcarsCardConfig, 
} from './types.js';
import gsap from 'gsap';

import './layout/widgets/index.js';
import './layout/elements/index.js';
import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';
import { animationManager, AnimationContext, AnimationManager } from './utils/animation.js';
import { ColorResolver } from './utils/color-resolver.js';
import { StoreProvider, StateChangeEvent } from './core/store.js';
import { CardRuntime, RuntimeFactory } from './core/runtime.js';
import { FontManager } from './utils/font-manager.js';
import { ConfigValidator, logValidationResult } from './utils/config-validator.js';
import { WidgetRegistry } from './layout/widgets/registry.js';
import { Diagnostics } from './utils/diagnostics.js';
import { MorphEngine } from './utils/morph.js';


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
  private static readonly PREVIEW_DESIGN_WIDTH = 900;
  private static readonly PREVIEW_MIN_SCALE = 0.2;
  private static readonly PREVIEW_MAX_SCALE = 1;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) private _config!: LcarsCardConfig;
  @state() private _layoutElementTemplates: SVGTemplateResult[] = [];
  @state() private _viewBox: string = '0 0 100 100';
  @state() private _calculatedHeight: number = 100;
  @state() private _fontsLoaded = false;
  @state() private _isPreviewMode = false;
  @state() private _previewScale = 1;
  @state() private _designWidth: number = LcarsCard.PREVIEW_DESIGN_WIDTH;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private readonly logger = Diagnostics.create('LcarsCard');
  private _renderKeys: string[] = [];
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
  private _lastAnimationContext?: AnimationContext;
  private _suspendRenders: boolean = false;
  private _pendingRenderRefresh: boolean = false;
  private _pendingLayoutRect?: DOMRect;

  static styles = [editorStyles];

  constructor() {
    
    Diagnostics.setGlobalLevel(4);

    super();
    this._fontsReady = new Promise<void>((resolve) => {
      this._resolveFontsReady = resolve;
    });
    
    ColorResolver.preloadThemeColors().catch(error => {
      this.logger.warn('Failed to preload theme fallback colors', error as unknown);
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
    this._designWidth = LcarsCard.PREVIEW_DESIGN_WIDTH;
    this._previewScale = 1;
    
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

    (window as any).__lcarsNavigateInterceptor = async (path: string, el: Element) => {
      (window as any).__lcarsMorphInProgress = true;
      try {
        await this.morphNavigate(path, { durationMs: 1000 });
      } finally {
        (window as any).__lcarsMorphInProgress = false;
      }
    };
  }
  
  public async firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
    }
    
    this._layoutInitialized = false;
    this._checkPreviewMode();

    try {
      await FontManager.ensureFontsLoaded(['Antonio']);
      this._fontsLoaded = true;
      FontManager.clearMetricsCache();
      this._resolveFontsReady();
    } catch (error) {
      this.logger.error('Font loading failed', error as unknown);
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
        const hasSignificantEntityChanges = this._runtime!.colors.elementEntityStatesChanged(
          this._layoutEngine.layoutGroups,
          this._lastHassStates,
          this.hass
        );

        if (hasSignificantEntityChanges) {
          this._performLayoutCalculation(this._containerRect);
        }

        this._runtime!.colors.processHassChange(
          this._layoutEngine.layoutGroups,
          this._lastHassStates,
          this.hass,
          () => this._refreshElementRenders()
        );
      }
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
    setTimeout(() => {
        requestAnimationFrame(() => {
            this._tryCalculateInitialLayout();
        });
    }, 100);

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

  private _resolveLayoutRect(rect: DOMRect): DOMRect {
    if (!rect) {
      return rect;
    }

    if (!this._isPreviewMode) {
      return rect;
    }

    const width = this._designWidth || LcarsCard.PREVIEW_DESIGN_WIDTH;
    const height = Math.max(rect.height, this._calculatedHeight || rect.height || 1);
    return new DOMRect(rect.x, rect.y, width, height);
  }

  private _checkPreviewMode(): void {
    let element: HTMLElement | null = this as HTMLElement;
    let depth = 0;
    const maxDepth = 10;
    let isPreview = false;

    while (element && depth < maxDepth) {
      const classList = element.classList;
      const tag = element.tagName?.toUpperCase();
      if (classList?.contains('element-preview') || classList?.contains('element-editor') || tag === 'HUI-CARD-PREVIEW') {
        isPreview = true;
        break;
      }
      element = element.parentElement;
      depth++;
    }

    if (this._isPreviewMode !== isPreview) {
      this._isPreviewMode = isPreview;
    }

    if (this._isPreviewMode) {
      this._calculatePreviewScale();
    } else if (this._previewScale !== 1) {
      this._previewScale = 1;
    }
  }

  private _calculatePreviewScale(): void {
    if (!this._isPreviewMode) {
      return;
    }

    requestAnimationFrame(() => {
      const haCard = this.shadowRoot?.querySelector('ha-card') as HTMLElement | null;
      if (!haCard) {
        return;
      }

      const designWidth = this._designWidth > 0 ? this._designWidth : LcarsCard.PREVIEW_DESIGN_WIDTH;
      if (designWidth <= 0) {
        return;
      }

      const rect = haCard.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }

      const computedStyle = window.getComputedStyle(haCard);
      const paddingLeft = parseFloat(computedStyle.paddingLeft || '0');
      const paddingRight = parseFloat(computedStyle.paddingRight || '0');
      const availableWidth = Math.max(1, rect.width - (paddingLeft + paddingRight));

      if (availableWidth >= designWidth) {
        if (this._previewScale !== 1) {
          this._previewScale = 1;
        }
        return;
      }

      let scale = availableWidth / designWidth;
      scale = Math.max(LcarsCard.PREVIEW_MIN_SCALE, Math.min(LcarsCard.PREVIEW_MAX_SCALE, scale));

      if (Math.abs(this._previewScale - scale) > 0.005) {
        this._previewScale = scale;
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
      this._checkPreviewMode();
    } else {
      requestAnimationFrame(() => this._tryCalculateInitialLayout());
    }
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    this._storeUnsubscribe?.();
    this._storeUnsubscribe = undefined;
    
    if (this._runtime) {
      try { this._runtime.destroy(); } catch {}
    }
    
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
    if (this._suspendRenders) {
      this._pendingLayoutRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
      return;
    }
    const adjustedRect = this._resolveLayoutRect(rect);
    const isValidLayoutRequest = this._config && adjustedRect && adjustedRect.width > 0 && adjustedRect.height > 0;
    if (!isValidLayoutRequest) {
      this.logger.warn('Skipping layout calculation - invalid config or dimensions');
      return;
    }

    try {
      await this._fontsReady;
    } catch (error) {
      this.logger.warn('Font loading failed, proceeding with layout calculation', error as unknown);
    }

    try {
      const isFirstLayoutOrConfigChanged = !this._elementGraph;
      
      if (isFirstLayoutOrConfigChanged) {
        this._performFullLayoutRebuild(adjustedRect);
      } else {
        this._performLayoutRecalculation(adjustedRect);
      }
    } catch (error) {
      this._handleLayoutError(error, adjustedRect);
    }
  }

  private _performFullLayoutRebuild(rect: DOMRect): void {
    this._setupLayoutEngine(rect);
    const groups = this._createLayoutGroups();
    this._runtime!.colors.buildEntityDependencyIndex(groups);
    this._initializeAnimationSystem(groups);
    
    const containerRect = this._calculateFinalContainerRect(rect);
    const layoutDimensions = this._layoutEngine.recalculate(containerRect, { dynamicHeight: true });
    this._calculatedHeight = layoutDimensions.height;
    this._containerRect = new DOMRect(
      containerRect.x,
      containerRect.y,
      containerRect.width,
      this._calculatedHeight
    );
    this._designWidth = containerRect.width;

    this._clearDomTransformsForElements(groups);

    const shouldUpdateLayout = this._shouldUpdateLayout(rect);
    if (shouldUpdateLayout) {
      this._applyLayoutChanges(groups);
    }
  }

  private _performLayoutRecalculation(rect: DOMRect): void {
    this._setupLayoutEngine(rect);
    const groups = this._createLayoutGroups(); // Uses cached graph
    this._runtime!.colors.buildEntityDependencyIndex(groups);
    
    const containerRect = this._calculateFinalContainerRect(rect);
    const layoutDimensions = this._layoutEngine.recalculate(containerRect, { dynamicHeight: true });
    this._calculatedHeight = layoutDimensions.height;
    this._containerRect = new DOMRect(
      containerRect.x,
      containerRect.y,
      containerRect.width,
      this._calculatedHeight
    );
    this._designWidth = containerRect.width;

    this._clearDomTransformsForElements(groups);

    const shouldUpdateLayout = this._shouldUpdateLayout(rect);
    if (shouldUpdateLayout) {
      this._applyLayoutRecalculationChanges();
    }
  }

  private _refreshElementRenders(): void {
    if (this._suspendRenders) {
      this._pendingRenderRefresh = true;
      return;
    }
    this._pendingRenderRefresh = false;
    if (!this.isConnected || !this._runtime) {
      return;
    }
    const canRefresh = this._config && this._containerRect && this._layoutEngine.layoutGroups.length > 0;
    if (!canRefresh) {
      return;
    }

    this._updateElementsWithLatestHass();
    const animationStates = this._collectCurrentAnimationStates();
    const entries = this._renderElementsWithKeys();
    this._layoutElementTemplates = entries.map(e => e.template);
    this._renderKeys = entries.map(e => e.key);
    this.requestUpdate();

    this._schedulePostRenderUpdates(animationStates);
  }

  private _handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    
    const newRect = entry.contentRect;
    const newWidth = newRect.width;
    const newHeight = newRect.height;
    const logicalHeight = this._calculateLogicalHeightFromRenderHeight(newHeight);
    
    if (newWidth > 0 && (newWidth !== this._containerRect?.width || logicalHeight !== this._containerRect?.height)) {
      const logicalRect = new DOMRect(newRect.x, newRect.y, newWidth, logicalHeight);
      this._containerRect = logicalRect;
      if (this._runtime) {
        WidgetRegistry.getAllInstances(this._runtime).forEach(w => {
          try { w.onResize(this._containerRect!); } catch (e) { /* noop */ }
        });
      }
      
      this._performLayoutCalculation(this._containerRect);
    }

    this._checkPreviewMode();
  }

  private _calculateLogicalHeightFromRenderHeight(renderHeight: number): number {
    return Math.max(renderHeight, 1);
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor.js');
    return document.createElement('lovelace-lcars-card-editor');
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
    const viewBoxWidth = parseFloat(viewBoxParts[2]) || this._designWidth;
    const viewBoxHeight = parseFloat(viewBoxParts[3]) || 100;
    const logicalHeight = this._calculatedHeight || viewBoxHeight;
    const renderHeight = Math.max(logicalHeight, 1);

    const svgStyle = `width: 100%; height: ${renderHeight}px; min-height: 50px;`;

    if (this._isPreviewMode) {
      const scale = this._previewScale;
      const designWidth = this._designWidth;
      const scaledWidth = designWidth * scale;
      const scaledHeight = renderHeight * scale;
      const containerStyle = `width: ${designWidth}px; height: ${renderHeight}px; transform: scale(${scale}); transform-origin: top left;`;
      const wrapperStyle = `width: ${scaledWidth}px; height: ${scaledHeight}px; overflow: hidden; margin: 0 auto;`;

      return html`
        <ha-card style="padding: 0;">
          <div class="card-wrapper" style=${wrapperStyle}>
            <div class="card-container"
                 style=${containerStyle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox=${this._viewBox}
                preserveAspectRatio="none"
                style=${svgStyle}
              >
                ${defsContent.length > 0 ? svg`<defs>${defsContent}</defs>` : ''}
                ${this._layoutElementTemplates.length > 0
                  ? repeat(
                      this._layoutElementTemplates,
                      (_t, index) => this._renderKeys[index] || index,
                      (t) => t
                    )
                  : svgContent}
              </svg>
            </div>
          </div>
        </ha-card>
      `;
    }

    const containerStyle = `width: 100%; height: ${renderHeight}px; min-height: 50px; overflow: visible;`;

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
            ${this._layoutElementTemplates.length > 0
              ? repeat(
                  this._layoutElementTemplates,
                  (_t, index) => this._renderKeys[index] || index,
                  (t) => t
                )
              : svgContent}
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
            element.props.state_management as any,
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

  private _renderElementsWithKeys(): Array<{ key: string; template: SVGTemplateResult }> {
    const entries: Array<{ key: string; template: SVGTemplateResult }> = [];
    this._layoutEngine.layoutGroups.forEach(group => {
      group.elements.forEach(el => {
        try {
          const elementTemplate = el.render();
          if (!elementTemplate) {
            return;
          }
          const currentState = this._runtime!.state.getState(el.id);
          const isVisible = currentState !== 'hidden';
          const wrapped = isVisible
            ? elementTemplate
            : svg`<g style="visibility: hidden; opacity: 0; pointer-events: none;">${elementTemplate}</g>`;
          entries.push({ key: el.getRenderKey(), template: wrapped });
        } catch (error) {
          this.logger.error(`Error rendering element ${el.id}`, error as unknown);
        }
      });
    });
    return entries;
  }

  private _triggerOnLoadAnimations(groups: Group[]): void {
    const sm = this._runtime!.state;
    groups.forEach(group => {
      group.elements.forEach(element => {
        if ((element.props.animations as any)?.on_load) {
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
    this._layoutEngine.setGroups([]);
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
    this._layoutEngine.setGroups(groups);
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
    this._lastAnimationContext = animationContext;
    this._initializeElementStates(groups);
    this._setupStateChangeHandling(elementsMap);
  }

  private _cleanupPreviousAnimations(): void {
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        try {
          element.cleanupAnimations();
        } catch (error) {
          this.logger.error(`Error clearing element state ${element.id}`, error as unknown);
        }
      }
    }
  }

  private _calculateFinalContainerRect(rect: DOMRect): DOMRect {
    const requiredHeight = this._calculateRequiredHeight(rect.width, rect.height);
    return new DOMRect(rect.x, rect.y, rect.width, requiredHeight);
  }

  private _updateDesignWidthFromViewBox(viewBox: string): void {
    const parts = viewBox.split(' ');
    if (parts.length === 4) {
      const width = parseFloat(parts[2]);
      if (!Number.isNaN(width) && width > 0 && this._designWidth !== width) {
        this._designWidth = width;
      }
    }
  }

  private _shouldUpdateLayout(rect: DOMRect): boolean {
    const entries = this._renderElementsWithKeys();
    const newTemplates = entries.map(e => e.template);
    const newKeys = entries.map(e => e.key);
    const newViewBox = `0 0 ${rect.width} ${this._calculatedHeight}`;

    const prevKeys = this._renderKeys;
    const templatesChanged = newKeys.length !== prevKeys.length || newKeys.some((k, i) => k !== prevKeys[i]);
    const viewBoxChanged = newViewBox !== this._viewBox;

    if (templatesChanged) {
      this._layoutElementTemplates = newTemplates;
      this._renderKeys = newKeys;
    }
    if (viewBoxChanged) {
      this._viewBox = newViewBox;
      this._updateDesignWidthFromViewBox(newViewBox);
    }
    return templatesChanged || viewBoxChanged;
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
    this.logger.error('Layout calculation failed', error as unknown);
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

    return this._runtime!.animations.collectAnimationStates(
      elementIds,
      (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null
    );
  }

  private _renderVisibleElements(): SVGTemplateResult[] {
    const entries = this._renderElementsWithKeys();
    return entries.map(e => e.template);
  }

  private _schedulePostRenderUpdates(animationStates: Map<string, any>): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._setupAllElementListeners();
        
        if (animationStates.size > 0 && this._runtime) {
          const context: AnimationContext = {
            elementId: '',
            getShadowElement: (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null,
            hass: this.hass,
            requestUpdateCallback: this.requestUpdate.bind(this)
          };
          this._runtime.animations.restoreAnimationStates(animationStates, context, () => {});
        }
      });
    });
  }

  private _clearDomTransformsForElements(groups: Group[]): void {
    const anim = this._runtime?.animations;
    const resetProps = 'transform,transformOrigin,x,y,scale,scaleX,scaleY,rotation,opacity';
    const getEl = (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) as Element | null;
    try {
      for (const group of groups) {
        for (const element of group.elements) {
          try { anim?.stopAllAnimationsForElement(element.id); } catch {}
          const domEl = getEl(element.id);
          if (domEl) {
            try { (domEl as any).style.visibility = ''; } catch {}
            gsap.set(domEl as any, { clearProps: resetProps } as any);
          }
        }
      }
    } catch {}
  }

  /** Public: perform a morph transition to a navigation path, then navigate. */
  public async morphNavigate(navigationPath: string, options: { durationMs?: number } = {}): Promise<void> {
    if (!this._runtime || !this._containerRect) return;
    try {
      this._suspendRenders = true;
      const hooks = {
        getShadowElement: (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null,
        requestUpdate: () => this._refreshElementRenders(),
        setCalculatedHeight: (h: number) => { this._calculatedHeight = Math.max(this._calculatedHeight, h); },
        getContainerRect: () => this._containerRect!,
        getCurrentGroups: () => this._layoutEngine.layoutGroups,
        getAnimationManager: () => this._runtime!.animations,
        getAnimationContext: () => this._lastAnimationContext || {
          elementId: 'card',
          getShadowElement: (id: string) => this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null,
          hass: this.hass,
          requestUpdateCallback: () => this.requestUpdate()
        },
        expandCanvasTo: (width: number, height: number) => this._expandCanvasTo(width, height)
      };
      const debugMorph = (typeof window !== 'undefined' && (window as any).__lcarsDebugMorph === true);
    await MorphEngine.morphToNavigationPath(hooks, navigationPath, this.hass, { durationMs: options.durationMs ?? 1000, debugMorph });
    } catch (e) {
    } finally {
      setTimeout(() => {
        this._suspendRenders = false;
        if (this._pendingLayoutRect) {
          const pendingRect = this._pendingLayoutRect;
          this._pendingLayoutRect = undefined;
          void this._performLayoutCalculation(pendingRect);
        }
        if (this._pendingRenderRefresh) {
          this._pendingRenderRefresh = false;
          this._refreshElementRenders();
        }
      }, 0);
    }
  }

  private _expandCanvasTo(width: number, height: number): void {
    const current = this._containerRect!;
    const desiredWidth = Number.isFinite(width) && width > 0 ? width : current.width;
    const targetWidth = Math.max(current.width, desiredWidth);
    const desiredHeight = Number.isFinite(height) && height > 0 ? height : this._calculatedHeight || 1;
    const targetHeight = Math.max(this._calculatedHeight, desiredHeight, 1);
    this._calculatedHeight = Math.max(this._calculatedHeight, targetHeight);
    this._viewBox = `0 0 ${targetWidth} ${this._calculatedHeight}`;
    this._containerRect = new DOMRect(current.x, current.y, targetWidth, this._calculatedHeight);
    this.requestUpdate();
  }

}
