import { TextElement } from '../elements/text.js';
import { RectangleElement } from '../elements/rectangle.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';
import { LogMessage } from '../../types.js';
import { LOG_LINE_HEIGHT_PX } from '../../constants.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';

interface LogWidgetConfig {
  maxLines?: number;
  textColor?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  height?: number;
}

export class LogWidget extends Widget {
  private static readonly DEFAULT_HEIGHT = 100;
  private static readonly DEFAULT_MAX_LINES = 5;
  private static readonly DEFAULT_FONT_SIZE = 14;
  private static readonly DEFAULT_TEXT_COLOR = '#ffc996';
  private static readonly FADE_COLOR = '#864f0b';
  private static readonly MEDIUM_COLOR = '#df8313';
  private static readonly FADE_THRESHOLD_MS = 500;

  private logMessages: LogMessage[] = [];
  private newlyAddedIds: Set<string> = new Set();
  private previousHass?: HomeAssistant;
  private logLineElements: TextElement[] = [];
  private unsubscribeFromEvents?: () => void;

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    // Initialize previousHass if hass is provided
    this.previousHass = hass;
    
    // Set up event subscription if hass is available
    if (hass) {
      this.initializeLogging(hass);
    }
  }

  public expand(): LayoutElement[] {
    const config = this.getWidgetConfig();
    const bounds = this.createBoundsElement();
    
    // Create a fixed number of log line elements (max_lines) upfront
    this.logLineElements = this.createFixedLogLineElements(bounds, config);
    this.updateLogLineElementsContent();
    
    // Always return all elements but make empty ones transparent
    return [bounds, ...this.logLineElements];
  }
  
  public updateHass(hass?: HomeAssistant): void {
    if (!hass) return;
    
    // Prevent recursive calls by checking if this is the same hass object
    if (this.hass === hass) return;
    
    // Initialize logging if this is the first time we get hass
    if (!this.unsubscribeFromEvents && this.hass !== hass) {
      this.initializeLogging(hass);
    }
    
    // Only process manual updateHass calls if we don't have event subscription
    // (When we have subscription, live updates come through handleStateChangeEvent)
    if (!this.unsubscribeFromEvents && this.previousHass && this.previousHass !== hass) {
      const newMessages = this.detectStateChanges(this.previousHass, hass);
      if (newMessages.length > 0) {
        this.addLogMessages(newMessages);
        this.recreateElements();
        this.requestUpdateCallback?.();
      }
    }
    
    // Update state for next comparison
    this.previousHass = this.hass; // Keep the old hass as previous
    this.hass = hass;
  }
  
  public updateLogMessages(messages: LogMessage[], newIds: Set<string> = new Set()): void {
    this.logMessages = messages.slice(0, this.getMaxLines());
    this.newlyAddedIds = newIds;
    this.recreateElements();
    this.requestUpdateCallback?.();
  }

  private getWidgetConfig(): LogWidgetConfig {
    return {
      maxLines: this.props.maxLines || LogWidget.DEFAULT_MAX_LINES,
      textColor: this.props.textColor || LogWidget.DEFAULT_TEXT_COLOR,
      textAnchor: this.props.textAnchor || 'start',
      fontSize: this.props.fontSize || LogWidget.DEFAULT_FONT_SIZE,
      fontFamily: this.props.fontFamily || 'Antonio',
      fontWeight: this.props.fontWeight || 'normal',
      height: this.layoutConfig.height || LogWidget.DEFAULT_HEIGHT
    };
  }

  private createBoundsElement(): RectangleElement {
    const bounds = new RectangleElement(
      this.id,
      { fill: 'none', stroke: 'none' },
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
    
    // Inject updateHass method to keep the widget alive and receive updates
    const widget = this;
    bounds.updateHass = function(this: RectangleElement, hass?: HomeAssistant): void {
      // Call the original updateHass method
      RectangleElement.prototype.updateHass.call(this, hass);
      
      // Forward to the widget
      widget.updateHass(hass);
    };
    
    return bounds;
  }

  private createFixedLogLineElements(bounds: RectangleElement, config: LogWidgetConfig): TextElement[] {
    const elements: TextElement[] = [];
    const maxLines = this.getMaxLines();

    // Create a fixed number of elements equal to max_lines
    for (let index = 0; index < maxLines; index++) {
      const element = this.createEmptyLogLineElement(bounds, index, config);
      elements.push(element);
    }

    return elements;
  }
  
  private createEmptyLogLineElement(
    bounds: RectangleElement, 
    index: number, 
    config: LogWidgetConfig
  ): TextElement {
    const yOffset = index * LOG_LINE_HEIGHT_PX;

    return new TextElement(
      `${this.id}_line_${index}`,
      {
        text: '', // Start empty
        fill: config.textColor,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        fontWeight: config.fontWeight,
        textAnchor: config.textAnchor,
        dominantBaseline: 'hanging'
      },
      {
        anchor: {
          anchorTo: bounds.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topLeft'
        },
        offsetY: yOffset
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  private updateLogLineElementsContent(): void {
    const config = this.getWidgetConfig();
    
    for (let index = 0; index < this.logLineElements.length; index++) {
      const element = this.logLineElements[index];
      const message = this.logMessages[index];

      if (message) {
        // Update element with log message
        element.props.text = message.text;
        element.props.fill = this.calculateLogColor(message, index, config);
        element.props.fillOpacity = 1; // Make visible
      } else {
        // Hide element if no message by making it transparent
        element.props.text = '';
        element.props.fillOpacity = 0;
      }
    }
  }



  private calculateLogColor(message: LogMessage, index: number, config: LogWidgetConfig): string {
    // User-specified color takes precedence
    if (this.props.textColor) {
      return config.textColor!;
    }
    
    // Newly added messages get full brightness
    if (this.newlyAddedIds.has(message.id)) {
      return config.textColor!;
    }
    
    // First line gets full brightness
    if (index === 0) {
      return config.textColor!;
    }
    
    // Apply fade based on age
    const age = Date.now() - message.timestamp;
    if (age > LogWidget.FADE_THRESHOLD_MS) {
      return LogWidget.FADE_COLOR;
    }
    
    return LogWidget.MEDIUM_COLOR;
  }

  private detectStateChanges(oldHass: HomeAssistant, newHass: HomeAssistant): LogMessage[] {
    const changes: LogMessage[] = [];
    
    for (const entityId in newHass.states) {
      const newState = newHass.states[entityId];
      const oldState = oldHass.states[entityId];
      
      if (this.stateChanged(oldState, newState)) {
        // Use entity_id from the state object if available, otherwise use the key
        const actualEntityId = newState.entity_id || entityId;
        const friendlyName = newState.attributes?.friendly_name || actualEntityId;
        const message: LogMessage = {
          id: `${actualEntityId}-${newState.last_changed}`,
          text: `${friendlyName}: ${newState.state}`,
          timestamp: new Date(newState.last_changed).getTime()
        };
        changes.push(message);
      }
    }
    
    return changes.sort((a, b) => b.timestamp - a.timestamp);
  }

  private stateChanged(oldState: any, newState: any): boolean {
    if (!newState) return false;
    if (!oldState) return true;
    return oldState.state !== newState.state;
  }

  private addLogMessages(newMessages: LogMessage[]): void {
    this.newlyAddedIds.clear();
    newMessages.forEach(msg => this.newlyAddedIds.add(msg.id));
    
    this.logMessages = [...newMessages, ...this.logMessages]
      .slice(0, this.getMaxLines());
  }

  private recreateElements(): void {
    // Update existing elements with new log content instead of recreating
    this.updateLogLineElementsContent();
  }

  private getMaxLines(): number {
    return this.props.maxLines || LogWidget.DEFAULT_MAX_LINES;
  }

  private async initializeLogging(hass: HomeAssistant): Promise<void> {
    // Only populate initial logs if we have a real connection (not in tests)
    if (hass.connection) {
      this.populateInitialLogs(hass);
    }
    
    // Subscribe to state change events
    await this.subscribeToStateChanges(hass);
  }

  private populateInitialLogs(hass: HomeAssistant): void {
    const initialMessages: LogMessage[] = Object.entries(hass.states)
      .filter(([_, entity]) => entity.state)
      .map(([entityId, entity]) => {
        const actualEntityId = entity.entity_id || entityId;
        const friendlyName = entity.attributes?.friendly_name || actualEntityId;
        return {
          id: `${actualEntityId}-${entity.last_changed}`,
          text: `${friendlyName}: ${entity.state}`,
          timestamp: new Date(entity.last_changed).getTime(),
        };
      });

    initialMessages.sort((a, b) => b.timestamp - a.timestamp);
    this.logMessages = initialMessages.slice(0, this.getMaxLines());
  }

  private async subscribeToStateChanges(hass: HomeAssistant): Promise<void> {
    if (!hass.connection || this.unsubscribeFromEvents) return;

    try {
      this.unsubscribeFromEvents = await hass.connection.subscribeEvents(
        (event: any) => this.handleStateChangeEvent(event),
        'state_changed'
      );
    } catch (error) {
      console.warn('LCARS Card Logger Widget: Failed to subscribe to state changes', error);
    }
  }

  private handleStateChangeEvent(event: any): void {
    const newState = event.data.new_state;
    const oldState = event.data.old_state;
    
    if (!newState || (oldState && oldState.state === newState.state)) {
      return;
    }

    const actualEntityId = newState.entity_id;
    const friendlyName = newState.attributes?.friendly_name || actualEntityId;
    const message: LogMessage = {
      id: `${actualEntityId}-${newState.last_changed}`,
      text: `${friendlyName}: ${newState.state}`,
      timestamp: new Date(newState.last_changed).getTime(),
    };
    
    // Check if this message already exists to prevent duplicates
    const messageExists = this.logMessages.some(existingMessage => existingMessage.id === message.id);
    if (messageExists) return;
    
    this.newlyAddedIds.clear();
    this.newlyAddedIds.add(message.id);
    
    this.logMessages = [message, ...this.logMessages].slice(0, this.getMaxLines());
    this.recreateElements();
    this.requestUpdateCallback?.();
  }

  public destroy(): void {
    if (this.unsubscribeFromEvents) {
      this.unsubscribeFromEvents();
      this.unsubscribeFromEvents = undefined;
    }
  }
}

WidgetRegistry.registerWidget('logger-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new LogWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  const elements = widget.expand();
  
  // Keep the widget alive by storing it on the bounds element
  if (elements.length > 0) {
    (elements[0] as any)._logWidget = widget;
  }
  
  return elements;
}); 