import {
  LitElement,
  html,
  svg,
  CSSResult,
  TemplateResult,
  PropertyValues
} from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import {
  HomeAssistant,
  LovelaceCardEditor,
  getLovelace
} from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';

// Import types
import {
    LcarsView, StateChangedEvent, LogMessage, LcarsCardConfig, LcarsButtonConfig, LcarsLayout, LcarsShipMapLayout, MapRectLayout, HomeLayoutContextForShipMap // Import new context type
} from './types';

// Import constants
import * as C from './constants';
// Explicitly import needed constants
import {
    TOP_HEADER_FONT_SIZE_PX,
    MAIN_HEADER_FONT_SIZE_PX,
    MAX_LOG_MESSAGES // Assuming needed later in renderLogWidget call
} from './constants';

// Import styles
import { styles } from './styles';

// Import layout calculation
import { calculateLayout } from './layout';
import { calculateShipMapLayout } from './shipmap-layout'; // Import ship map layout calculation

// Import utility functions
import { formatTime, formatDate } from './utils/time-format';
import { formatStateChangedEvent, generateUniqueId } from './utils/log-processing';
import { TransitionManager } from './utils/transitions';
import {
    measureTextBBox,
    calculateDynamicBarHeight,
    generateEndcapPath,
    generateElbowPath
} from './utils/shapes';

// Import rendering functions/components
import { renderTopHeader } from './components/top-header';
import { renderMainHeader } from './components/main-header';
import { renderVerticalButtons } from './components/vertical-buttons'; // Import the render function
import { renderFillerBar } from './components/filler-bar';
import { renderClockDisplay } from './components/clock-display';
import { renderLogWidget } from './components/log-widget';
import { renderButtonOverlays } from './components/button-overlays';
import { renderBottomHeader } from './components/bottom-header'; // Import new component
import { renderLeftCorner } from './components/left-corner';

// --- Constants for Text Element IDs ---
const ID_TOP_LEFT_TEXT = "lcars-text-measure-top-left";
const ID_TOP_RIGHT_TEXT = "lcars-text-measure-top-right";
const ID_MAIN_HEADER_TEXT = "lcars-text-measure-main";
const ID_BOTTOM_HEADER_TEXT = "lcars-text-measure-bottom";
const ID_CLOCK_TIME_TEXT = "lcars-text-measure-clock";
const ID_CLOCK_TIME_SHORT_TEXT = "lcars-text-measure-clock-short";
const ID_MAP_TEXT = "lcars-text-measure-map"; // ID for MAP text

@customElement('lovelace-lcars-card')
export class LcarsCard extends LitElement {

  // --- Properties & State ---
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: LcarsCardConfig;
  @state() private _fontsLoaded: boolean = false;
  @state() private _containerWidth: number = 0;
  @state() private _containerHeight: number = 0;
  @state() private _layout: LcarsLayout | LcarsShipMapLayout | null = null;
  @state() private _homeLayout: LcarsLayout | null = null;
  @state() private _buttons: LcarsButtonConfig[] = C.DEFAULT_BUTTONS;
  @state() private _logMessages: LogMessage[] = [];
  @state() private _error: string | null = null;
  @state() private _newlyAddedIds: Set<string> = new Set();
  @state() private _currentTime: string = '';
  @state() private _currentDate: string = '';
  @state() private _messageQueue: LogMessage[] = [];
  @state() private _isProcessingQueue: boolean = false;

  // State for view management and transitions (managed by TransitionManager)
  @state() _currentView: LcarsView = 'home';
  @state() _isTransitioning: boolean = false;
  @state() _mainHeaderDimmed: boolean = false;
  @state() _mainHeaderShifted: boolean = false;
  @state() _clockVisible: boolean = true;
  @state() _dateVisible: boolean = true;
  @state() _buttonsVisible: boolean = true;
  @state() _overlayRectsVisible: boolean = false;
  @state() _elementsShiftedRight: boolean = false; // New state for slide/resize

  // --- Private members ---
  private _unsubscribeEvents?: () => void;
  private _updateInterval?: number;
  private _queueTimeoutId?: number;
  _transitionTimeouts: number[] = []; // Made public for TransitionManager
  private _transitionManager: TransitionManager = new TransitionManager(this);

  // --- Queries for Measurement ---
  // @query('#main-header-text-tspan') private _mainHeaderTextElement?: SVGTextElement;
  // @query('#top-header-text-left-tspan') private _topHeaderTextLeftElement?: SVGTextElement;
  // @query('#top-header-text-right-tspan') private _topHeaderTextRightElement?: SVGTextElement;
  // @query('#bottom-header-text-tspan') private _bottomTextElement?: SVGTextElement;

  // ResizeObserver for Width
  private _resizeObserver?: ResizeObserver;

  // --- State for Measured Dimensions --- Add these
  @state() private _measuredTopLeftTextDims: { width: number; height: number } | null = null;
  @state() private _measuredTopRightTextDims: { width: number; height: number } | null = null;
  @state() private _measuredMainTextDims: { width: number; height: number } | null = null;
  @state() private _measuredBottomTextDims: { width: number; height: number } | null = null;
  @state() private _measuredClockTimeDims: { width: number; height: number } | null = null;
  @state() private _measuredClockTimeShortDims: { width: number; height: number } | null = null;
  @state() private _measuredMapTextDims: { width: number; height: number } | null = null; // State for MAP text dims

  @state() private _measurementPassComplete: boolean = false;

  // --- Lifecycle Callbacks ---
  connectedCallback(): void {
    super.connectedCallback();
    let resizeTimeout: number;
    this._resizeObserver = new ResizeObserver(entries => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
          if (entries.length > 0) {
            const newWidth = entries[0].contentRect.width;
            const newHeight = entries[0].contentRect.height;
            let updated = false;
            if (newWidth > 0 && newWidth !== this._containerWidth) {
              this._containerWidth = newWidth;
              updated = true;
            }
            if (newHeight > 0 && newHeight !== this._containerHeight) {
              this._containerHeight = newHeight;
              updated = true;
            }
            if (updated) {
                this.requestUpdate();
            }
          }
      }, 50);
    });
    this._resizeObserver.observe(this);
    this._containerWidth = this.offsetWidth;
    this._containerHeight = this.offsetHeight;

    // Initial time/date set
    const now = new Date();
    this._currentTime = formatTime(now);
    this._currentDate = formatDate(now);

    // Start clock update interval
    this._updateInterval = window.setInterval(() => {
        const now = new Date();
        this._currentTime = formatTime(now);
        this._currentDate = formatDate(now);
        // No need for requestUpdate here, Lit handles state updates
    }, C.UPDATE_INTERVAL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }
    if (this._unsubscribeEvents) {
      try { this._unsubscribeEvents(); } catch (e) { /* ignore */ }
      this._unsubscribeEvents = undefined;
    }
    if (this._updateInterval) {
        clearInterval(this._updateInterval);
        this._updateInterval = undefined;
    }
    if (this._queueTimeoutId) {
        clearTimeout(this._queueTimeoutId);
        this._queueTimeoutId = undefined;
    }
    this.clearTimeouts(); // Use helper method
  }

  // Method to clear transition timeouts, accessible by TransitionManager
  public clearTimeouts(): void {
      this._transitionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this._transitionTimeouts = [];
  }

  protected async firstUpdated(changedProperties: PropertyValues): Promise<void> {
      super.firstUpdated(changedProperties);
      this._containerWidth = this.offsetWidth;
      this._containerHeight = this.offsetHeight;
      
      try {
          await document.fonts.ready;
          this._fontsLoaded = true;
          this.requestUpdate(); // Re-render after fonts are ready
      } catch (e) {
          this._fontsLoaded = true; // Assume loaded even on error to allow rendering
          this.requestUpdate();
      }
  }

  protected async updated(changedProperties: PropertyValues): Promise<void> {
    super.updated(changedProperties);
    // Subscribe to HA events when hass object becomes available
    if (changedProperties.has('hass') && this.hass && !this._unsubscribeEvents) {
        this._subscribeToStateChanges();
    }

    // --- Trigger Measurement Pass --- (Only needed once)
    if (!this._measurementPassComplete && this._fontsLoaded && this._containerWidth > 0) {
        await this.updateComplete; // Wait for Lit's update cycle to finish
        if (!this._measurementPassComplete && this._fontsLoaded && this._containerWidth > 0) {
            this._measureTexts(); // Measures all text elements needed for both layouts
        }
    }

    // --- Calculate Layout --- (Based on current view)
    let shouldRecalculateLayout = false;
    if (this._measurementPassComplete) {
        // Recalculate if relevant properties change OR if the view changes
        if (changedProperties.has('_containerWidth') ||
            changedProperties.has('_containerHeight') ||
            changedProperties.has('_measurementPassComplete') || // First calculation
            changedProperties.has('_config') ||
            changedProperties.has('_currentView')) { // Recalculate on view change
            shouldRecalculateLayout = true;
        }
    }

    if (shouldRecalculateLayout) {
        // Always calculate home layout first if needed, as shipMap depends on it
        if (this._currentView === 'home' || !this._homeLayout) {
            this._homeLayout = calculateLayout(
                this._containerWidth,
                this._containerHeight,
                this._config?.buttons || C.DEFAULT_BUTTONS,
                this._config?.top_header_left_text || '',
                this._config?.top_header_right_text || '',
                this._config?.header_text || '',
                this._measuredTopLeftTextDims,
                this._measuredTopRightTextDims,
                this._measuredMainTextDims,
                this._fontsLoaded
            );
             if (!this._homeLayout) {
                 this._layout = null; // Clear general layout if home layout fails
             } else if (this._currentView === 'home') {
                 this._layout = this._homeLayout; // Use home layout directly
             }
        }

        // Calculate ship map layout if that's the current view and home layout is ready
        if (this._currentView === 'shipMap' && this._homeLayout && this._measuredBottomTextDims && this._measuredClockTimeDims && this._measuredClockTimeShortDims && this._measuredMapTextDims) {
             // Construct the minimal context object from homeLayout
             const homeContext: HomeLayoutContextForShipMap = {
                 mainHeaderHeight: this._homeLayout.mainHeader.height,
                 mainHeaderElbowTotalHeight: this._homeLayout.mainHeader.elbowTotalHeight,
                 // Extract only y and height for relevant buttons
                 buttonGeometry: this._homeLayout.buttons.map((btn, index) => {
                     if ([0, 2, 3, 4, 5, 6].includes(index)) { // Indices needed by shipMap layout calcs
                         return { y: btn.y, height: btn.height };
                     }
                     return undefined; // Return undefined for buttons not needed
                 })
             };

             this._layout = calculateShipMapLayout(
                 this._containerWidth,
                 this._containerHeight,
                 this._config,
                 homeContext, // Pass the constructed context
                 this._homeLayout.topHeader, // Pass topHeader separately
                 this._measuredBottomTextDims.height,
                 this._measuredBottomTextDims.width,
                 this._measuredClockTimeDims.width ?? null,
                 this._measuredClockTimeShortDims.width ?? null,
                 this._measuredMapTextDims.width ?? null,
                 this._measuredMapTextDims.height ?? null
             );
             if (!this._layout) {
                 console.error("LCARS Card: Ship map layout calculation returned null.");
             }
        } else if (this._currentView === 'shipMap' && (!this._homeLayout || !this._measuredBottomTextDims || !this._measuredClockTimeDims || !this._measuredClockTimeShortDims || !this._measuredMapTextDims )){
            this._layout = null;
        }

    } else if (!this._measurementPassComplete && this._layout !== null) {
         // Clear layout if measurement isn't complete
         this._layout = null;
         this._homeLayout = null; // Clear home layout too
    }

    // Check for view transitions
    if (changedProperties.has('_currentView')) {
        const oldView = changedProperties.get('_currentView');
        if (oldView !== this._currentView) {
            // Reset animation states if switching back to home manually
            if (this._currentView === 'home') {
                this._mainHeaderDimmed = false;
                this._mainHeaderShifted = false;
                this._clockVisible = true;
                this._dateVisible = true;
                this._buttonsVisible = true;
                this._overlayRectsVisible = false;
                this._elementsShiftedRight = false;
            }
        }
    }
  }

  // --- Configuration ---
  public setConfig(config: LcarsCardConfig): void {
    if (!config || !config.entity) throw new Error('You need to define an entity');
    // Separate the base config from the properties we might override or remove
    const { buttons, ...baseConfig } = config; 
    this._config = {
        header_text: "HOME",
        top_header_left_text: "U.S.S. HERCULES / WILLEMETTE CLASS",
        top_header_right_text: "NCC-1901",
        ...baseConfig, // Spread the base config (without buttons or filler_bar_height)
        buttons: buttons || C.DEFAULT_BUTTONS,
    };
    this._buttons = this._config.buttons || C.DEFAULT_BUTTONS;

    // Reset state on new config
    this._homeLayout = null; // Clear cached home layout
    this._layout = null; // Clear current layout
    this._measurementPassComplete = false; // Force remeasurement
    this._logMessages = [];
    this._messageQueue = [];
    this._isProcessingQueue = false;
    this._error = null;
    this._newlyAddedIds.clear();
    // Reset transition states? Might depend on desired behavior
    this._currentView = 'home';
    this._isTransitioning = false;
    this._mainHeaderDimmed = false;
    this._mainHeaderShifted = false;
    this._clockVisible = true;
    this._dateVisible = true;
    this._buttonsVisible = true;
    this._overlayRectsVisible = false;
    this._elementsShiftedRight = false;
    this.clearTimeouts();

    if (this.hass) {
        this._subscribeToStateChanges();
    } else {
        console.warn("LCARS Card: setConfig called, but hass not yet available.");
    }

    this.requestUpdate();
  }

  // --- Event Handling & Logic ---

  // Subscribe to state_changed events
  private async _subscribeToStateChanges(): Promise<void> {
    if (!this.hass || !this.hass.connection) {
        console.warn("LCARS Card: Attempted to subscribe but hass/connection is not available.");
        return;
     }
    // Unsubscribe first if already subscribed
    if (this._unsubscribeEvents) {
        try { this._unsubscribeEvents(); } catch (e) { console.warn("LCARS Card: Error during unsubscribe:", e); }
        this._unsubscribeEvents = undefined; // Clear reference
    }

    try {
        this._unsubscribeEvents = await this.hass.connection.subscribeEvents<StateChangedEvent>(
            (event) => {
                // Added type assertion for event data
                if (event?.data?.entity_id && event?.data?.new_state) {
                    const formattedText = formatStateChangedEvent(event);
                    if (formattedText) {
                        const newMessage: LogMessage = {
                            id: generateUniqueId(),
                            text: formattedText,
                            timestamp: Date.now()
                        };
                        this._messageQueue = [...this._messageQueue, newMessage];
                        this._processMessageQueue(); // Start processing if not already
                    }
                }
            },
            'state_changed'
        );
        this._error = null; // Clear previous errors
    } catch (err) {
        console.error("LCARS Card: Error subscribing to state_changed events:", err);
        this._error = "Error subscribing to state events.";
        this._unsubscribeEvents = undefined; // Ensure it's cleared on error
    }
  }

  // Process the message queue (simplified, actual formatting/truncation moved)
  private _processMessageQueue(): void {
    // Don't do anything while transitioning or if already processing
    if (this._isTransitioning || this._isProcessingQueue || this._messageQueue.length === 0) {
        return; // Exit if already processing or no messages
    }

    this._isProcessingQueue = true; // Set processing flag
    console.log("LCARS Card: Processing message queue, length:", this._messageQueue.length);

    // Create array to track new IDs
    const newIdsToAdd = [];
    
    // Get messages from the queue, respecting MAX_LOG_MESSAGES limit
    const messagesToAdd = this._messageQueue.splice(0, MAX_LOG_MESSAGES);
    
    // Add each to the log messages, but keep array at MAX_LOG_MESSAGES
    for (const msg of messagesToAdd) {
        // Only add if it's not a duplicate by ID
        if (!this._logMessages.some(existingMsg => existingMsg.id === msg.id)) {
            newIdsToAdd.push(msg.id);
            // Add to front of array - newer messages at top
            this._logMessages.unshift(msg);
        }
    }
    
    // Trim excess messages
    this._logMessages = this._logMessages.slice(0, MAX_LOG_MESSAGES);
    
    // Update new entry IDs for animation
    this._newlyAddedIds = new Set([...this._newlyAddedIds, ...newIdsToAdd]); // Track new IDs for animation
    
    // Clear process flag after timeout to allow entries to animate in
    this._queueTimeoutId = window.setTimeout(() => {
        this._isProcessingQueue = false;
        // Clear newlyAddedIds after animation
        this._newlyAddedIds.clear();
        this._processMessageQueue(); // Check queue again after animation timeout
    }, C.ANIMATION_FLASH_TOTAL_DURATION_S * 1000); // Use animation constant for log flash animation
  }

  // Handle clicks originating from buttons
  private _handleButtonClick(action?: string, index?: number): void {
      // Temporary: Use ABOUT button (index 6) to toggle views
      if (index === 6) {
          if (this._isTransitioning) return; // Don't switch during animation
          this._currentView = (this._currentView === 'home') ? 'shipMap' : 'home';
          // Don't trigger animation here, just change state for static rendering
          // Reset animation states if switching back to home manually
          if (this._currentView === 'home') {
              this._mainHeaderDimmed = false;
              this._mainHeaderShifted = false;
              this._clockVisible = true;
              this._dateVisible = true;
              this._buttonsVisible = true;
              this._overlayRectsVisible = false;
              this._elementsShiftedRight = false;
          }
          return; // Stop further processing for ABOUT button
      }

      // Original logic for other buttons (triggering animation)
      if (!action || this._isTransitioning || this._currentView !== 'home') return; // Only trigger animation from home view

      // Delegate animation to TransitionManager
      if (action === 'nav_ship_map') {
          this._transitionManager.handleShipMapClick();
      }
      // Add other actions later...
  }

  // --- Rendering ---
  protected render() {
    const layout = this._layout;

    // --- Pass 1: Render Text for Measurement --- (If not complete)
    if (!this._measurementPassComplete) {
        const measurementStyles = `visibility: hidden; position: absolute; top: -9999px; left: -9999px; z-index: -1;`;
        const mainHeaderTextMeas = this._config?.header_text || '';
        const topLeftTextMeas = this._config?.top_header_left_text || '';
        const topRightTextMeas = this._config?.top_header_right_text || '';
        const bottomTextMeas = this._config?.ship_map_bottom_header_text || "MASTER SYSTEM DISPLAY";
        const clockTimeMeas = "00.00.00";
        const clockTimeShortMeas = "00.00";
        const mapTextMeas = "MAP";
        return html`
             <svg style="${measurementStyles}">
                  <text id="${ID_TOP_LEFT_TEXT}" style="font: ${TOP_HEADER_FONT_SIZE_PX}px Antonio;">${topLeftTextMeas}</text>
                  <text id="${ID_TOP_RIGHT_TEXT}" style="font: ${TOP_HEADER_FONT_SIZE_PX}px Antonio;" text-anchor="end">${topRightTextMeas}</text>
                  <text id="${ID_MAIN_HEADER_TEXT}" class="header-text" style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;" text-anchor="middle" dy="-4.5" dominant-baseline="central">${mainHeaderTextMeas}</text>
                  <text id="${ID_BOTTOM_HEADER_TEXT}" class="header-text" style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;" text-anchor="end" dy="-4.5" dominant-baseline="central">${bottomTextMeas}</text>
                  <text 
                      id="${ID_CLOCK_TIME_TEXT}" 
                      class="clock-text" 
                      style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;" // Use correct font size for measurement
                      text-anchor="end" 
                      dominant-baseline="central" // Match rendering alignment 
                      dy="-4.5" // Match rendering alignment
                   >${clockTimeMeas}</text>
                   <text 
                       id="${ID_CLOCK_TIME_SHORT_TEXT}" 
                       class="clock-text" 
                       style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;" 
                       text-anchor="end" 
                       dominant-baseline="central"
                       dy="-4.5"
                   >${clockTimeShortMeas}</text>
                   <text 
                       id="${ID_MAP_TEXT}" 
                       class="header-text" 
                       style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;" 
                       text-anchor="end" 
                       dominant-baseline="central"
                       dy="-4.5"
                   >${mapTextMeas}</text>
             </svg>
         `;
    }

    // --- Pass 2 Render --- Check if layout is calculated for the current view
    if (!layout) {
        // Render a simple loading or error state, or nothing
        return html`<div class="loading-error">Calculating Layout...</div>`;
    }

    const svgHeight = layout?.totalSvgHeight ? `${layout.totalSvgHeight}px` : `${this._containerHeight}px`;

    // --- Render based on View --- //
    return html`
      <div class="card-wrapper">
          <svg
            id="lcars-svg-container"
            width="100%"
            height="${svgHeight}"
            xmlns="http://www.w3.org/2000/svg"
            font-family="inherit"
          >
             ${this._renderViewContent(layout)} 
          </svg>
          ${this._error ? html`<div class="error-display">${this._error}</div>` : ''}
      </div>
    `;
  }

  // --- Helper to Render Content Based on View --- //
  private _renderViewContent(layout: LcarsLayout | LcarsShipMapLayout) {
      if (this._currentView === 'home') {
          // --- HOME VIEW RENDER --- (Uses LcarsLayout type)
          const homeLayout = layout as LcarsLayout;
          const mainHeaderText = this._config?.header_text || "HOME";
          const topHeaderLeftText = this._config?.top_header_left_text || "U.S.S. HERCULES / WILLEMETTE CLASS";
          const topHeaderRightText = this._config?.top_header_right_text || "NCC-1901";

          return html`
              ${renderTopHeader(homeLayout.topHeader, topHeaderLeftText, topHeaderRightText)}

              ${renderMainHeader(
                  homeLayout.mainHeader,
                  mainHeaderText,
                  this._mainHeaderDimmed, // Use animation state for home view
                  this._mainHeaderShifted,
                  this._elementsShiftedRight,
                  homeLayout.containerWidth,
                  homeLayout.buttons
              )}

              ${renderButtonOverlays(
                  homeLayout.buttons,
                  this._overlayRectsVisible, // Use animation state
                  this._elementsShiftedRight,
                  homeLayout.containerWidth,
                  this._measuredBottomTextDims?.height ?? null // Pass measured height
              )}

              ${renderVerticalButtons(
                  homeLayout.buttons,
                  !this._buttonsVisible, // Use animation state
                  (action?: string, index?: number) => this._handleButtonClick(action, index) // Add types
              )}

              ${renderFillerBar(homeLayout.fillerBar)}

              ${renderClockDisplay(homeLayout.clockArea, this._currentTime, this._currentDate, this._clockVisible, this._dateVisible)} 

              ${renderLogWidget(homeLayout.logArea, this._logMessages, this._error, this._newlyAddedIds)}

              <!-- Bottom Header - Rendered only during animation via ButtonOverlays for now -->
              <!-- Consider if a static bottom header is needed for home view -->
          `;

      } else if (this._currentView === 'shipMap') {
          // --- SHIP MAP VIEW RENDER --- (Uses LcarsShipMapLayout type)
          const shipMapLayout = layout as LcarsShipMapLayout;
          const topHeaderLeftText = this._config?.top_header_left_text || "U.S.S. HERCULES / WILLEMETTE CLASS";
          const topHeaderRightText = this._config?.top_header_right_text || "NCC-1901";

          if (!shipMapLayout.bottomHeader) {
              return html``; 
          }

          // Remove viewBox and preserveAspectRatio from the SVG element
          return html`
              <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="${shipMapLayout.containerWidth}"
                  height="${shipMapLayout.totalSvgHeight}"
                  style="width:100%; height:auto;" 
              >
                  ${renderTopHeader(shipMapLayout.topHeader, topHeaderLeftText, topHeaderRightText)} 

                  <!-- Render Left Corner "Back Arrow" element -->
                  ${renderLeftCorner(shipMapLayout.leftCorner)}

                  <!-- Render Left Column Rectangles -->
                  ${shipMapLayout.leftColumnRects.map((rect: MapRectLayout) => svg`
                      <rect
                          class="left-column-rect"
                          x="${rect.x}"
                          y="${rect.y}"
                          width="${rect.width}"
                          height="${rect.height}"
                          fill="${rect.fill}"
                      />
                  `)}

                  <!-- Render New Left Header Elbow -->
                  ${shipMapLayout.leftHeaderElbow ? svg`
                      <path 
                          d="${generateElbowPath(shipMapLayout.leftHeaderElbow.x, shipMapLayout.leftHeaderElbow.horizontalWidth, shipMapLayout.leftHeaderElbow.verticalWidth, shipMapLayout.leftHeaderElbow.headerHeight, shipMapLayout.leftHeaderElbow.totalElbowHeight, shipMapLayout.leftHeaderElbow.orientation, shipMapLayout.leftHeaderElbow.y, shipMapLayout.leftHeaderElbow.outerCornerRadius)}" 
                          fill="${shipMapLayout.leftHeaderElbow.fill}" 
                      />
                  ` : ''}

                  <!-- Render STATIC ShipMap Main Header -->
                  ${renderMainHeader(
                      shipMapLayout.mainHeader,
                      "",
                      false,
                      false,
                      true,
                      shipMapLayout.containerWidth,
                      [],
                      true
                  )}

                  <!-- Render STATIC ShipMap Button Overlays -->
                  ${renderButtonOverlays(
                      shipMapLayout.buttonOverlays,
                      true,
                      true,
                      shipMapLayout.containerWidth,
                      shipMapLayout.bottomHeader.textHeight,
                      true
                  )}

                  <!-- Vertical buttons are hidden in ship map view -->

                  ${renderLogWidget(shipMapLayout.logArea, this._logMessages, this._error, new Set())} 

                  <!-- Render STATIC ShipMap Bottom Header (including its elbow) -->
                  ${renderBottomHeader(shipMapLayout.bottomHeader)} 

                  <!-- Render ShipMap Clock -->
                  ${shipMapLayout.displayClockFormat !== 'none' ? renderClockDisplay(
                      {
                          x: 0,
                          y: 0,
                          timeY_abs: shipMapLayout.clock.timeY,
                          dateY_abs: 0,
                          timeX_abs: shipMapLayout.clock.timeX,
                          timeFontSize: MAIN_HEADER_FONT_SIZE_PX,
                          timeFillColor: '#df8313'
                      },
                      this._currentTime,
                      "",
                      true,
                      false,
                      shipMapLayout.displayClockFormat
                  ) : ''}

                  <!-- Placeholder removed -->
              </svg>
          `;
      } else {
          return html`<div>Unknown View: ${this._currentView}</div>`;
      }
  }

  // --- getCardSize --- (Remains the same, uses _layout)
  public getCardSize(): number {
      const height = this._containerHeight > 0 ? this._containerHeight : (this._layout?.totalSvgHeight ?? 150);
      return Math.max(3, Math.ceil(height / 50));
  }

  // --- Static styles --- (Remains the same)
  static styles = styles;

  // --- Method to perform measurements --- (Measures all texts needed)
  private _measureTexts(): void {
      if (!this._fontsLoaded || !this.renderRoot) return;

      const topLeftElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_TOP_LEFT_TEXT}`);
      const topRightElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_TOP_RIGHT_TEXT}`);
      const mainElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_MAIN_HEADER_TEXT}`);
      const bottomElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_BOTTOM_HEADER_TEXT}`);
      const clockTimeElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_CLOCK_TIME_TEXT}`);
      const clockTimeShortElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_CLOCK_TIME_SHORT_TEXT}`);
      const mapTextElem = this.renderRoot.querySelector<SVGTextElement>(`#${ID_MAP_TEXT}`); // Query MAP text element

      this._measuredTopLeftTextDims = measureTextBBox(topLeftElem);
      this._measuredTopRightTextDims = measureTextBBox(topRightElem);
      this._measuredMainTextDims = measureTextBBox(mainElem);
      this._measuredBottomTextDims = measureTextBBox(bottomElem);
      this._measuredClockTimeDims = measureTextBBox(clockTimeElem);
      this._measuredClockTimeShortDims = measureTextBBox(clockTimeShortElem);
      this._measuredMapTextDims = measureTextBBox(mapTextElem); // Measure MAP text

      // Update check to include MAP text measurement
      if (this._measuredTopLeftTextDims && this._measuredTopRightTextDims && this._measuredMainTextDims && this._measuredBottomTextDims && this._measuredClockTimeDims && this._measuredClockTimeShortDims && this._measuredMapTextDims) {
          this._measurementPassComplete = true;
          this.requestUpdate(); // Trigger layout pass
      } else {
          console.warn("LCARS Card: Measurement pass failed (potentially missing map text measurement).");
      }
  }
}

// Log card version/phase
console.info(
  `%c LOVELACE-LCARS-CARD %c 
REFACTOR_VIEW_TOGGLE`, // Updated phase identifier
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// Register card with Lovelace
declare global {
  interface CustomCardEntry { type: string; name: string; description: string; preview: boolean; }
  interface Window { customCards: Array<CustomCardEntry>; }
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'lovelace-lcars-card')) {
    window.customCards.push({
        type: 'lovelace-lcars-card', name: 'LCARS Card',
        description: 'A Lovelace card styled after the LCARS interface.', preview: true,
    });
}

// Make types available on window for HACS checks if needed (optional)
// import { LcarsCard } from './lovelace-lcars-card';
// (window as any).LcarsCard = LcarsCard;
