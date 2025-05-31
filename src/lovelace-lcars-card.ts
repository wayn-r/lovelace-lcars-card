import { LitElement, html, css, SVGTemplateResult, TemplateResult, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CARD_TYPE, CARD_NAME, DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';
import { 
  LcarsCardConfig, 
  GroupConfig, 
  ElementConfig,
  StateManagementConfig,
  VisibilityTriggerConfig // Added for visibility interactions
} from './types.js';
import gsap from 'gsap';

import { LayoutEngine, Group } from './layout/engine.js';
import { LayoutElement } from './layout/elements/element.js';
import { parseConfig } from './layout/parser.js';
import { animationManager, AnimationContext } from './utils/animation.js';
import { DynamicColorManager } from './utils/dynamic-color-manager.js';

// Editor temporarily disabled - import './editor/lcars-card-editor.js';

import { editorStyles } from './styles/styles.js';

// Interfaces moved to types.ts - keeping import only

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
  @state() private _calculatedHeight: number = 100;
  
  private _layoutEngine: LayoutEngine = new LayoutEngine();
  private _resizeObserver?: ResizeObserver;
  private _elementsToRevertOnClickOutside: Map<string, VisibilityTriggerConfig> = new Map(); // Added for click-outside handling
  private _hideTimeouts: Map<string, number> = new Map(); // For hover hide delays
  private _containerRect?: DOMRect;
  private _lastConfig?: LcarsCardConfig;
  
  // Utility classes for better organization
  private _dynamicColorManager: DynamicColorManager = new DynamicColorManager();
  
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
    
    // Set up resize observer
    this._resizeObserver = new ResizeObserver((entries) => {
      this._handleResize(entries);
    });
    // Add global click listener for click-outside handling
    document.addEventListener('click', this._handleGlobalClick);
  }
  
  public firstUpdated() {
    const container = this.shadowRoot?.querySelector('.card-container');
    if (container && this._resizeObserver) {
      this._resizeObserver.observe(container);
    }
    
    // Use event-driven approach for initial layout calculation
    this._scheduleInitialLayout();
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
    // Remove global click listener
    document.removeEventListener('click', this._handleGlobalClick);
    
    // Clean up utility classes
    this._dynamicColorManager.cleanup();
    
    // Clean up all element animations and entity monitoring
    for (const group of this._layoutEngine.layoutGroups) {
      for (const element of group.elements) {
        animationManager.cleanupElementAnimationTracking(element.id);
      }
    }

    // Clear any active timeouts for hover effects
    this._hideTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this._hideTimeouts.clear();
    
    super.disconnectedCallback();
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>): void {
    const hasHassChanged = changedProperties.has('hass');
    const hasConfigChanged = changedProperties.has('_config');

    if (hasConfigChanged || hasHassChanged) {
      this._updateLayoutEngineWithHass();
    }

    // Simple logic: if we have both config and container, calculate layout
    if (this._config && this._containerRect) {
      if (hasConfigChanged) {
        // Config changed - always recalculate
        this._performLayoutCalculation(this._containerRect);
      } else if (hasHassChanged && this._lastHassStates) {
        // Check for significant entity changes using the DynamicColorManager
        const hasSignificantEntityChanges = this._dynamicColorManager.hasSignificantEntityChanges(
          this._layoutEngine.layoutGroups,
          this._lastHassStates,
          this.hass
        );
        
        if (hasSignificantEntityChanges) {
          this._performLayoutCalculation(this._containerRect);
        }
      }
    }

    // Handle dynamic color changes using the DynamicColorManager
    if (hasHassChanged && this.hass && this._lastHassStates) {
      this._dynamicColorManager.checkDynamicColorChanges(
        this._layoutEngine.layoutGroups,
        this.hass,
        () => this._refreshElementRenders()
      );
    }

    // Store current hass states for next comparison
    if (this.hass) {
      this._lastHassStates = { ...this.hass.states };
    }
  }

  private _handleViewChange(): void {
    console.log('[LCARS Card] View change detected, refreshing dynamic color system');
    
    // Clear all dynamic color caches and entity monitoring using the DynamicColorManager
    this._dynamicColorManager.clearAllCaches(this._layoutEngine.layoutGroups);
    
    // Force invalidation of last hass states to ensure fresh comparison
    this._lastHassStates = undefined;
    
    // Schedule a dynamic color refresh using the DynamicColorManager
    this._dynamicColorManager.scheduleDynamicColorRefresh(
      this.hass,
      this._containerRect,
      () => this._dynamicColorManager.checkDynamicColorChanges(
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
      
      // Clear previous layout
      this._layoutEngine.clearLayout();
      // Clear visibility state map as elements are being recalculated
      this._elementsToRevertOnClickOutside.clear();
      
      // Parse config and add elements to layout engine
      const getShadowElement = (id: string): Element | null => {
        return this.shadowRoot?.querySelector(`#${CSS.escape(id)}`) || null;
      };
      
      const groups = parseConfig(this._config, this.hass, () => { 
        this.requestUpdate(); 
      }, getShadowElement); 
      
      groups.forEach((group: Group) => { 
        this._layoutEngine.addGroup(group); 
      });

      // Attach event listeners for visibility triggers
      // This must happen AFTER elements are parsed and in the layoutEngine
      this._layoutEngine.layoutGroups.forEach(group => {
        group.elements.forEach(element => { // element is the source of the trigger
          const interactions = element.props.interactions;
          if (interactions?.visibility_triggers) {
            interactions.visibility_triggers.forEach(triggerConfig => {
              const triggerSourceRenderedElement = getShadowElement(element.id);

              if (triggerSourceRenderedElement) {
                // Store the trigger source ID on the config for later reference
                triggerConfig.trigger_source_id = element.id;

                // To prevent duplicate listeners if this runs multiple times without full re-render,
                // ideally, store and remove specific listeners. For now, assume full re-render or manage outside.

                if (triggerConfig.event === 'click' || triggerConfig.event === 'both') {
                  triggerSourceRenderedElement.addEventListener('click', (e: Event) => {
                    e.stopPropagation(); // Important: prevent global click handler if click is on trigger source
                    this._processVisibilityTrigger(triggerConfig, 'click');
                  });
                }
                if (triggerConfig.event === 'hover' || triggerConfig.event === 'both') {
                  triggerSourceRenderedElement.addEventListener('mouseenter', () => {
                    this._processVisibilityTrigger(triggerConfig, 'hover');
                  });
                  triggerSourceRenderedElement.addEventListener('mouseleave', () => {
                    let leaveAction = triggerConfig.action; // Default for toggle
                    if (triggerConfig.action === 'show') {
                      leaveAction = 'hide';
                    }
                    // If original action was 'hide', mouseleave doesn't typically trigger 'show'
                    // unless explicitly defined (which is not part of this basic setup).
                    // So, we only create a leaveTriggerConfig if the action is changing (show->hide) or toggle.

                    if (leaveAction === 'hide' || triggerConfig.action === 'toggle') {
                        const leaveTriggerConfig = { ...triggerConfig, action: leaveAction };
                        if (triggerConfig.hover_options?.mode === 'delay' && triggerConfig.hover_options.hide_delay && leaveAction === 'hide') {
                            console.log(`[LcarsCard] Mouseleave on ${element.id} (trigger source). Hide action for targets of ${triggerConfig.trigger_source_id} would be delayed by ${triggerConfig.hover_options.hide_delay}ms.`);
                            // Actual timeout will be handled in step 2 by _processVisibilityTrigger or the element itself.
                            // For now, logging is sufficient. The call below will log the "hide" intent.
                            this._processVisibilityTrigger(leaveTriggerConfig, 'hover'); // Pass 'hover' to indicate it's part of hover interaction
                        } else {
                            this._processVisibilityTrigger(leaveTriggerConfig, 'hover');
                        }
                    }
                  });
                }
              } else {
                console.warn(`[LcarsCard] Could not find element with ID ${element.id} (trigger source) to attach visibility listeners.`);
              }
            });
          }
        });
      });

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

      // Render elements
      const newTemplates = this._layoutEngine.layoutGroups.flatMap(group =>
          group.elements
              .map(el => {
                try {
                  return el.render();
                } catch (error) {
                  console.error("[_performLayoutCalculation] Error rendering element", el.id, error);
                  return null;
                }
              })
              .filter((template): template is SVGTemplateResult => template !== null)
      );

      const TOP_MARGIN = 8;  // offset for broken HA UI
      
      // Update viewBox to match container dimensions and calculated height
      const newViewBox = `0 ${-TOP_MARGIN} ${rect.width} ${this._calculatedHeight + TOP_MARGIN}`;

      
      if (JSON.stringify(newTemplates.map(t => ({s: t.strings, v: (t.values || []).map(val => String(val))}))) !==
          JSON.stringify(this._layoutElementTemplates.map(t => ({s:t.strings, v: (t.values || []).map(val => String(val))}))) || newViewBox !== this._viewBox) {
          this._layoutElementTemplates = newTemplates;
          this._viewBox = newViewBox;
          // Trigger re-render to show the new content
          this.requestUpdate();
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

  // Method to handle global clicks for click-outside behavior
  private _handleGlobalClick = (event: MouseEvent): void => {
    if (!this.shadowRoot || this._elementsToRevertOnClickOutside.size === 0) return;

    const clickedPath = event.composedPath();

    // Iterate backwards as an element might remove itself from the map
    const elementIds = Array.from(this._elementsToRevertOnClickOutside.keys());
    for (let i = elementIds.length - 1; i >= 0; i--) {
      const elementId = elementIds[i]; // This ID is the ID of the TARGET element.
      const triggerConfig = this._elementsToRevertOnClickOutside.get(elementId);

      if (!triggerConfig) continue;

      // Check if the click was inside the target element
      const targetRenderedElement = this.shadowRoot.querySelector(`#${CSS.escape(elementId)}`);
      if (targetRenderedElement && clickedPath.includes(targetRenderedElement)) {
        continue; // Click was inside this target element, so don't revert it.
      }

      // Check if the click was inside the original trigger source element for this specific triggerConfig
      // Assuming triggerConfig stores the ID of the element that initiated it (e.g., element.id from _performLayoutCalculation)
      if (triggerConfig.trigger_source_id) {
         const triggerSourceRenderedElement = this.shadowRoot.querySelector(`#${CSS.escape(triggerConfig.trigger_source_id)}`);
         if (triggerSourceRenderedElement && clickedPath.includes(triggerSourceRenderedElement)) {
           continue; // Click was inside the trigger source for this target, so don't revert.
         }
      }

      console.log(`[LcarsCard] Click outside detected for target ${elementId}. Reverting visibility.`);
      this._processVisibilityTrigger(triggerConfig, 'click', true); // true indicates revert
      this._elementsToRevertOnClickOutside.delete(elementId);
    }
  };

  private _processVisibilityTrigger(triggerConfig: VisibilityTriggerConfig, eventType: 'click' | 'hover', revert: boolean = false): void {
    console.log(`[LcarsCard] Processing visibility trigger. Event: ${eventType}, Revert: ${revert}, Config:`, triggerConfig);

    const { targets, action, hover_options, click_options } = triggerConfig;

    targets.forEach(targetId => {
      const targetLayoutElement = this._layoutEngine.getElementById(targetId);
      const targetGroup = !targetLayoutElement ? this._layoutEngine.getGroupById(targetId) : undefined;

      if (!targetLayoutElement && !targetGroup) {
        console.warn(`[LcarsCard] Target '${targetId}' not found for visibility trigger (Source: ${triggerConfig.trigger_source_id}).`);
        return;
      }

      const targetObject = targetLayoutElement || targetGroup;
      const targetType = targetLayoutElement ? 'Element' : 'Group';

      let effectiveAction = action;
      if (revert && click_options?.behavior === 'toggle_and_revert_on_click_outside') {
        effectiveAction = 'toggle';
      }

      // Helper function to apply action to a single element
      const applyToElement = (el: LayoutElement, act: string) => {
        console.log(`[LcarsCard] Applying action '${act}' to element '${el.id}'`);
        if (act === 'show') el.show();
        else if (act === 'hide') el.hide();
        else if (act === 'toggle') el.toggle();
      };

      // Helper function to apply action to a group
      const applyToGroup = (grp: Group, act: string) => {
        console.log(`[LcarsCard] Applying action '${act}' to group '${grp.id}'`);
        grp.elements.forEach(el => applyToElement(el, act));
      };

      // Clear any pending hide timeout for this target on any new interaction
      if (this._hideTimeouts.has(targetId)) {
        clearTimeout(this._hideTimeouts.get(targetId)!);
        this._hideTimeouts.delete(targetId);
      }

      if (eventType === 'click') {
        const behavior = click_options?.behavior || 'toggle'; // Default to toggle
        let actionToPerform = effectiveAction; // Use 'toggle' if reverting

        if (!revert) { // Only use specific behaviors if not reverting
            if (behavior === 'show_only') actionToPerform = 'show';
            else if (behavior === 'hide_only') actionToPerform = 'hide';
            else actionToPerform = 'toggle'; // Default for 'toggle' behavior
        }

        if (targetLayoutElement) applyToElement(targetLayoutElement, actionToPerform);
        else if (targetGroup) applyToGroup(targetGroup, actionToPerform);

        if (click_options?.behavior === 'toggle_and_revert_on_click_outside' && !revert) {
          console.log(`[LcarsCard] Registering target ${targetId} (from trigger ${triggerConfig.trigger_source_id}) for potential revert.`);
          this._elementsToRevertOnClickOutside.set(targetId, triggerConfig);
        }

      } else if (eventType === 'hover') {
        // The 'action' in triggerConfig for hover is set by mouseenter/mouseleave listeners in _performLayoutCalculation
        // 'show' on mouseenter, 'hide' or 'toggle' on mouseleave.
        const currentAction = effectiveAction; // This is 'show', 'hide', or 'toggle'

        if (currentAction === 'show') { // Mouseenter
          if (targetLayoutElement) applyToElement(targetLayoutElement, 'show');
          else if (targetGroup) applyToGroup(targetGroup, 'show');
        } else if (currentAction === 'hide') { // Mouseleave, configured to hide
          if (hover_options?.hide_delay && hover_options.hide_delay > 0) {
            console.log(`[LcarsCard] Hover: Scheduling hide for ${targetId} in ${hover_options.hide_delay}ms`);
            const timeoutId = window.setTimeout(() => {
              if (targetLayoutElement) applyToElement(targetLayoutElement, 'hide');
              else if (targetGroup) applyToGroup(targetGroup, 'hide');
              this._hideTimeouts.delete(targetId);
            }, hover_options.hide_delay);
            this._hideTimeouts.set(targetId, timeoutId);
          } else {
            if (targetLayoutElement) applyToElement(targetLayoutElement, 'hide');
            else if (targetGroup) applyToGroup(targetGroup, 'hide');
          }
        } else if (currentAction === 'toggle') { // Can be mouseenter or mouseleave if mode is toggle
            if (targetLayoutElement) applyToElement(targetLayoutElement, 'toggle');
            else if (targetGroup) applyToGroup(targetGroup, 'toggle');
            // If this toggle was on mouseleave and part of a toggle_on_enter_hide_on_leave,
            // the hide_on_leave part would be handled by the action being 'hide' if that's desired.
            // The current logic passes 'toggle' if original action was 'toggle'.
        }
      }
    });
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
            .map(el => el.render())
            .filter((template): template is SVGTemplateResult => template !== null)
    );

    this._layoutElementTemplates = newTemplates;
    
    // Trigger LitElement re-render to update non-button elements with new colors
    // Button elements handle their color updates directly via _updateButtonAppearanceDirectly()
    this.requestUpdate();

    // Schedule animation restoration to occur after the next render cycle
    Promise.resolve().then(() => {
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
}
