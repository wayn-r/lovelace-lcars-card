import { TextElement } from '../elements/text.js';
import { RectangleElement } from '../elements/rectangle.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';
import { LogMessage } from '../../types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { DistanceParser } from '../../utils/animation.js';
import gsap from 'gsap';

interface LogWidgetConfig {
  maxLines?: number;
  textColor?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  height?: number;
  lineSpacing?: number | string;
}

type ColorPhase = 'bright' | 'medium' | 'fade' | 'hidden';

class LogAnimationConfig {
  static readonly SLIDE_DURATION = 0.3;
  static readonly FADE_IN_DURATION = 0.3;
  static readonly FADE_IN_EASE = 'bounce.in';
  
  static readonly TRANSITION_DELAYS = {
    brightToMedium: 5000,
    mediumToFade: 5000,
    fadeToHidden: 5000
  };
}

class LogColorUtils {
  private static readonly DEFAULT_COLORS = {
    bright: '#ffc996',
    medium: '#df8313',
    fade: '#864f0b'
  };

  static resolveColor(phase: ColorPhase, userColor?: string): string {
    if (userColor) return userColor;
    
    switch (phase) {
      case 'bright': return this.DEFAULT_COLORS.bright;
      case 'medium': return this.DEFAULT_COLORS.medium;
      case 'fade': return this.DEFAULT_COLORS.fade;
      case 'hidden': return this.DEFAULT_COLORS.fade;
      default: return this.DEFAULT_COLORS.bright;
    }
  }

  static colorPhaseIsVisible(phase: ColorPhase): boolean {
    return phase !== 'hidden';
  }

  static resolveOpacity(phase: ColorPhase): number {
    return phase === 'hidden' ? 0 : 1;
  }
}

class LogEntryTimer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly onPhaseChange: (newPhase: ColorPhase) => void) {}

  startTransitionSequence(): void {
    this.clearAllTimers();
    this.scheduleTransitions();
  }

  destroy(): void {
    this.clearAllTimers();
  }

  private scheduleTransitions(): void {
    this.timers.set('toMedium', setTimeout(() => {
      this.onPhaseChange('medium');
      this.scheduleToFade();
    }, LogAnimationConfig.TRANSITION_DELAYS.brightToMedium));
  }

  private scheduleToFade(): void {
    this.timers.set('toFade', setTimeout(() => {
      this.onPhaseChange('fade');
      this.scheduleToHidden();
    }, LogAnimationConfig.TRANSITION_DELAYS.mediumToFade));
  }

  private scheduleToHidden(): void {
    this.timers.set('toHidden', setTimeout(() => {
      this.onPhaseChange('hidden');
    }, LogAnimationConfig.TRANSITION_DELAYS.fadeToHidden));
  }

  private clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

class LogEntry {
  private colorPhase: ColorPhase = 'bright';
  private readonly timer: LogEntryTimer;
  private timerStarted = false;

  constructor(
    public readonly message: LogMessage,
    private readonly userColor: string | undefined,
    private readonly onDisplayUpdate: () => void,
    startTimer = true
  ) {
    this.timer = new LogEntryTimer((newPhase) => this.handlePhaseChange(newPhase));
    if (startTimer) {
      this.startTimer();
    }
  }

  startTimer(): void {
    if (!this.timerStarted) {
      this.timerStarted = true;
      this.timer.startTransitionSequence();
    }
  }

  getCurrentColor(): string {
    return LogColorUtils.resolveColor(this.colorPhase, this.userColor);
  }

  getCurrentOpacity(): number {
    return LogColorUtils.resolveOpacity(this.colorPhase);
  }

  entryIsVisible(): boolean {
    return LogColorUtils.colorPhaseIsVisible(this.colorPhase);
  }

  destroy(): void {
    this.timer.destroy();
  }

  private handlePhaseChange(newPhase: ColorPhase): void {
    this.colorPhase = newPhase;
    this.onDisplayUpdate();
  }
}

class LogEntryCollection {
  private entries: LogEntry[] = [];
  
  constructor(
    private readonly maxSize: number,
    private readonly userColor: string | undefined,
    private readonly onDisplayUpdate: () => void
  ) {}

  addEntries(messages: LogMessage[], startTimers = false): void {
    const newEntries = messages.map(message => 
      new LogEntry(message, this.userColor, this.onDisplayUpdate, startTimers)
    );
    
    this.entries = [...newEntries, ...this.entries];
    this.trimToMaxSize();
  }

  getVisibleEntries(): LogEntry[] {
    return this.entries.slice(0, this.maxSize);
  }

  startTimersForVisibleEntries(): void {
    const visibleEntries = this.getVisibleEntries();
    visibleEntries.forEach(entry => entry.startTimer());
  }

  clear(): void {
    this.entries.forEach(entry => entry.destroy());
    this.entries = [];
  }

  destroy(): void {
    this.clear();
  }

  private trimToMaxSize(): void {
    while (this.entries.length > this.maxSize) {
      const removedEntry = this.entries.pop();
      if (removedEntry) {
        removedEntry.destroy();
      }
    }
  }
}

class LogElementRenderer {
  constructor(
    private readonly elements: TextElement[],
    private readonly userColor: string | undefined
  ) {}

  updateElementsFromEntries(entries: LogEntry[]): void {
    this.elements.forEach((element, index) => {
      const entry = entries[index];
      
      if (entry && entry.entryIsVisible()) {
        this.renderVisibleEntry(element, entry);
      } else {
        this.renderEmptyElement(element);
      }
    });
  }

  private renderVisibleEntry(element: TextElement, entry: LogEntry): void {
    element.props.text = entry.message.text;
    element.props.fill = entry.getCurrentColor();
    element.props.fillOpacity = entry.getCurrentOpacity();
  }

  private renderEmptyElement(element: TextElement): void {
    element.props.text = '';
    element.props.fillOpacity = 0;
  }
}

class LogAnimationManager {
  constructor(
    private readonly getShadowElement: (id: string) => Element | null
  ) {}

  async animateNewMessage(
    logLineElements: TextElement[],
    message: LogMessage,
    widgetConfig: LogWidgetConfig,
    entryCollection: LogEntryCollection,
    lineSpacing: number,
    onAnimationComplete: () => void,
    requestUpdateCallback?: () => void
  ): Promise<void> {
    const timeline = gsap.timeline({
      onComplete: () => {
        entryCollection.addEntries([message], false);
        this.resetElementPositions(logLineElements);
        onAnimationComplete();
        entryCollection.startTimersForVisibleEntries();
      }
    });

    const visibleEntries = entryCollection.getVisibleEntries();
    const maxLines = widgetConfig.maxLines!;
    const shouldFadeOut = visibleEntries.length >= maxLines;

    if (shouldFadeOut) {
      this.fadeOutLastElement(timeline, logLineElements, maxLines, 0);
    }

    this.slideDownElements(timeline, logLineElements, visibleEntries, maxLines, lineSpacing, 0);
    
    const newElement = logLineElements[0];
    const newDomElement = this.getShadowElement(newElement.id);

    if (newDomElement) {
      this.fadeInNewElement(timeline, newElement, newDomElement, message, widgetConfig, requestUpdateCallback, LogAnimationConfig.SLIDE_DURATION);
    }

    await timeline;
  }

  private fadeInNewElement(
    timeline: gsap.core.Timeline,
    newElement: TextElement,
    newDomElement: Element,
    message: LogMessage,
    widgetConfig: LogWidgetConfig,
    requestUpdateCallback?: () => void,
    delay: number = 0
  ): void {
    const tempEntry = new LogEntry(message, widgetConfig.textColor, () => {}, false);

    newElement.props.text = tempEntry.message.text;
    newElement.props.fill = tempEntry.getCurrentColor();
    requestUpdateCallback?.();

    gsap.set(newDomElement, { opacity: 0 });

    timeline.to(newDomElement, {
      opacity: 1,
      duration: LogAnimationConfig.FADE_IN_DURATION,
      ease: LogAnimationConfig.FADE_IN_EASE
    }, delay);

    tempEntry.destroy();
  }

  private slideDownElements(
    timeline: gsap.core.Timeline,
    logLineElements: TextElement[],
    visibleEntries: LogEntry[],
    maxLines: number,
    lineSpacing: number,
    delay: number = 0
  ): void {
    for (let i = visibleEntries.length - 1; i >= 0; i--) {
      const currentElement = logLineElements[i];
      const targetElement = logLineElements[i + 1];

      if (targetElement && i < maxLines - 1) {
        const currentDomElement = this.getShadowElement(currentElement.id);
        const targetDomElement = this.getShadowElement(targetElement.id);
        
        if (currentDomElement && targetDomElement) {
          this.copyElementContent(currentDomElement, targetDomElement);
          
          targetDomElement.setAttribute('opacity', '1');
          targetElement.props.fillOpacity = 1;

          timeline.fromTo(targetDomElement,
            { y: -lineSpacing, opacity: 1 },
            {
              y: 0,
              opacity: 1,
              duration: LogAnimationConfig.SLIDE_DURATION,
              ease: 'power2.out',
            }, delay
          );
        }
      }
    }
  }

  private fadeOutLastElement(
    timeline: gsap.core.Timeline,
    logLineElements: TextElement[],
    maxLines: number,
    delay: number = 0
  ): void {
    const lastElement = logLineElements[maxLines - 1];
    const lastDomElement = this.getShadowElement(lastElement.id);

    if (lastDomElement) {
      timeline.to(lastDomElement, {
        opacity: 0,
        duration: LogAnimationConfig.SLIDE_DURATION,
        ease: 'power2.out',
      }, delay);
    }
  }

  private copyElementContent(sourceElement: Element, targetElement: Element): void {
    const sourceText = sourceElement.querySelector('text');
    const targetText = targetElement.querySelector('text');
    
    if (sourceText && targetText) {
      targetText.textContent = sourceText.textContent || '';
    }
  }
  
  private resetElementPositions(logLineElements: TextElement[]): void {
    logLineElements.forEach(element => {
      const domElement = this.getShadowElement(element.id);
      if (domElement) {
        gsap.set(domElement, { y: 0, clearProps: 'transform' });
      }
    });
  }
}

class LogMessageUtils {
  static messageIsDuplicate(candidate: LogMessage, existingEntries: LogEntry[], messageQueue: LogMessage[]): boolean {
    const regexSafe = candidate.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${regexSafe}$`, 'i');

    for (const entry of existingEntries) {
      if (pattern.test(entry.message.text)) return true;
    }

    for (const queued of messageQueue) {
      if (pattern.test(queued.text)) return true;
    }

    return false;
  }

  static createMessageFromStateChange(entityId: string, newState: any): LogMessage {
    const actualEntityId = newState.entity_id || entityId;
    const friendlyName = newState.attributes?.friendly_name || actualEntityId;
    return {
      id: `${actualEntityId}-${newState.last_changed}`,
      text: `${friendlyName}: ${newState.state}`,
      timestamp: new Date(newState.last_changed).getTime()
    };
  }

  static stateHasChanged(oldState: any, newState: any): boolean {
    if (!newState) return false;
    if (!oldState) return true;
    return oldState.state !== newState.state;
  }
}

export class LogWidget extends Widget {
  private static readonly DEFAULT_HEIGHT = 100;
  private static readonly DEFAULT_MAX_LINES = 5;
  private static readonly DEFAULT_FONT_SIZE = 14;

  private entryCollection: LogEntryCollection | undefined;
  private elementRenderer: LogElementRenderer | undefined;
  private previousHass: HomeAssistant | undefined;
  private logLineElements: TextElement[] = [];
  private boundsElement: RectangleElement | undefined;
  private widgetConfig: LogWidgetConfig | undefined;
  private unsubscribeFromEvents: (() => void) | undefined;
  private messageQueue: LogMessage[] = [];
  private isProcessingQueue = false;
  private animationManager: LogAnimationManager;

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    this.previousHass = hass;
    this.animationManager = new LogAnimationManager((id) => this.getShadowElement?.(id) ?? null);
    
    this.ensureInitialized();
    
    if (hass) {
      this.initializeLogging(hass);
    }
  }

  public expand(): LayoutElement[] {
    this.ensureInitialized();
    
    if (this.entryCollection && this.entryCollection.getVisibleEntries().length > 0) {
      this.refreshDisplay();
    }
    
    return [this.boundsElement!, ...this.logLineElements];
  }
  
  public updateHass(hass?: HomeAssistant): void {
    if (!hass || this.hass === hass) return;
    
    if (!this.unsubscribeFromEvents && this.hass !== hass) {
      this.initializeLogging(hass);
    }
    
    if (!this.unsubscribeFromEvents && this.hass && this.hass !== hass) {
      const newMessages = this.detectStateChanges(this.hass, hass);
      if (newMessages.length > 0) {
        this.ensureInitialized();
        this.addLogMessages(newMessages, false);
      }
    }
    
    this.previousHass = this.hass;
    this.hass = hass;
  }

  public updateLogMessages(messages: LogMessage[]): void {
    this.ensureInitialized();
    this.entryCollection!.clear();
    this.addLogMessages(messages, false);
  }

  private ensureInitialized(): void {
    if (!this.widgetConfig) {
      this.widgetConfig = this.createWidgetConfig();
    }
    
    if (!this.boundsElement) {
      this.boundsElement = this.createBoundsElement();
    }
    
    if (this.logLineElements.length === 0) {
      this.logLineElements = this.createLogLineElements(this.boundsElement, this.widgetConfig);
    }
    
    if (!this.entryCollection || !this.elementRenderer) {
      this.initializeCollectionAndRenderer(this.widgetConfig);
    }
  }

  private createWidgetConfig(): LogWidgetConfig {
    const fontSize = this.props.fontSize || LogWidget.DEFAULT_FONT_SIZE;
    return {
      maxLines: this.props.maxLines || LogWidget.DEFAULT_MAX_LINES,
      textColor: this.props.textColor,
      textAnchor: this.props.textAnchor || 'start',
      fontSize: fontSize,
      fontFamily: this.props.fontFamily || 'Antonio',
      fontWeight: this.props.fontWeight || 'normal',
      height: this.layoutConfig.height || LogWidget.DEFAULT_HEIGHT,
      lineSpacing: this.props.lineSpacing === undefined ? (fontSize * 1.4) : this.props.lineSpacing,
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
    
    const widget = this;
    bounds.updateHass = function(this: RectangleElement, hass?: HomeAssistant): void {
      RectangleElement.prototype.updateHass.call(this, hass);
      widget.updateHass(hass);
    };
    
    return bounds;
  }

  private createLogLineElements(bounds: RectangleElement, config: LogWidgetConfig): TextElement[] {
    const elements: TextElement[] = [];
    const maxLines = config.maxLines!;

    for (let index = 0; index < maxLines; index++) {
      const element = this.createLogLineElement(bounds, index, config);
      elements.push(element);
    }

    return elements;
  }
  
  private createLogLineElement(
    bounds: RectangleElement, 
    index: number, 
    config: LogWidgetConfig
  ): TextElement {
    const yOffset = this.calculateLineOffset(index, config);

    return new TextElement(
      `${this.id}_line_${index}`,
      {
        text: '',
        fill: LogColorUtils.resolveColor('bright'),
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        fontWeight: config.fontWeight,
        textAnchor: config.textAnchor,
        dominantBaseline: 'hanging',
        fillOpacity: 0
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

  private calculateLineOffset(index: number, config: LogWidgetConfig): number {
    const lineSpacingValue = config.lineSpacing!;
    const fontSize = config.fontSize!;

    const parsedLineSpacing = DistanceParser.parse(
      lineSpacingValue.toString(),
      { layout: { width: fontSize, height: fontSize } }
    );

    return index * parsedLineSpacing;
  }

  private initializeCollectionAndRenderer(config: LogWidgetConfig): void {
    this.entryCollection = new LogEntryCollection(
      config.maxLines!,
      config.textColor,
      () => this.refreshDisplay()
    );
    
    this.elementRenderer = new LogElementRenderer(
      this.logLineElements,
      config.textColor
    );
  }

  private detectStateChanges(oldHass: HomeAssistant, newHass: HomeAssistant): LogMessage[] {
    const changes: LogMessage[] = [];
    
    for (const entityId in newHass.states) {
      const newState = newHass.states[entityId];
      const oldState = oldHass.states[entityId];
      
      if (LogMessageUtils.stateHasChanged(oldState, newState)) {
        const message = LogMessageUtils.createMessageFromStateChange(entityId, newState);
        changes.push(message);
      }
    }
    
    return changes.sort((a, b) => b.timestamp - a.timestamp);
  }

  private addLogMessages(newMessages: LogMessage[], animated = true): void {
    if (!this.entryCollection) return;

    const uniqueNewMessages = newMessages.filter(msg => 
      !LogMessageUtils.messageIsDuplicate(msg, this.entryCollection!.getVisibleEntries(), this.messageQueue)
    );

    if (uniqueNewMessages.length === 0) return;

    if (animated) {
      this.messageQueue.push(...uniqueNewMessages);
      this.processMessageQueue();
    } else {
      this.entryCollection.addEntries(uniqueNewMessages, false);
      this.entryCollection.startTimersForVisibleEntries();
      this.refreshDisplay();
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      await this.animateNewMessage(message);
    }

    this.isProcessingQueue = false;
  }
  
  private async animateNewMessage(message: LogMessage): Promise<void> {
    this.ensureInitialized();
    const lineSpacing = this.calculateLineOffset(1, this.widgetConfig!);

    await this.animationManager.animateNewMessage(
      this.logLineElements,
      message,
      this.widgetConfig!,
      this.entryCollection!,
      lineSpacing,
      () => this.refreshDisplay(),
      this.requestUpdateCallback
    );
  }

  private refreshDisplay(): void {
    if (this.entryCollection && this.elementRenderer) {
      const visibleEntries = this.entryCollection.getVisibleEntries();
      this.elementRenderer.updateElementsFromEntries(visibleEntries);
    }
    this.requestUpdateCallback?.();
  }

  private async initializeLogging(hass: HomeAssistant): Promise<void> {
    await this.subscribeToStateChanges(hass);
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

    const message = LogMessageUtils.createMessageFromStateChange(newState.entity_id, newState);
    this.addLogMessages([message]);
  }

  public destroy(): void {
    this.entryCollection?.destroy();
    
    if (this.unsubscribeFromEvents) {
      this.unsubscribeFromEvents();
      this.unsubscribeFromEvents = undefined;
    }
  }
}

WidgetRegistry.registerWidget('logger-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new LogWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  const elements = widget.expand();
  
  if (elements.length > 0) {
    (elements[0] as any)._logWidget = widget;
  }
  
  return elements;
}); 