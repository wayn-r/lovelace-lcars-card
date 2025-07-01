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

// ============================================================================
// Animation Durations (in seconds)
// ----------------------------------------------------------------------------
// These constants allow independent tuning of each animation phase. Placing
// them immediately after imports satisfies the "top of file" requirement and
// makes them easy to locate.
// ----------------------------------------------------------------------------
// Duration for slide-down and fade-out operations
export const SLIDE_ANIMATION_DURATION = 0.3;

// ----------------------------------------------------------------------------
// Fade-in configuration for new log entries
// ----------------------------------------------------------------------------
// Total duration for the fade-in (seconds)
export const FADE_IN_DURATION = 0.3;

// Customize bounce characteristics – see GSAP docs for options such as
// "bounce.out(0.7)" or "bounce.inOut(1.2)"
export const FADE_IN_EASE = 'bounce.in';
// ============================================================================

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

interface ColorConfiguration {
  readonly bright: string;
  readonly medium: string;
  readonly fade: string;
  readonly userOverride?: string;
}

class LogEntryColorResolver {
  static readonly DEFAULT_COLORS: ColorConfiguration = {
    bright: '#ffc996',
    medium: '#df8313',
    fade: '#864f0b'
  };

  static resolveColor(phase: ColorPhase, config: ColorConfiguration): string {
    if (config.userOverride) return config.userOverride;
    
    switch (phase) {
      case 'bright': return config.bright;
      case 'medium': return config.medium;
      case 'fade': return config.fade;
      case 'hidden': return config.fade;
      default: return config.bright;
    }
  }

  static createConfiguration(userColor?: string): ColorConfiguration {
    return {
      ...this.DEFAULT_COLORS,
      userOverride: userColor
    };
  }

  static resolveOpacity(phase: ColorPhase): number {
    return phase === 'hidden' ? 0 : 1;
  }
}

class LogEntryTimer {
  private static readonly TRANSITION_DELAYS = {
    brightToMedium: 2000,
    mediumToFade: 2000,
    fadeToHidden: 2000
  };

  private timers: {
    toMedium?: ReturnType<typeof setTimeout>;
    toFade?: ReturnType<typeof setTimeout>;
    toHidden?: ReturnType<typeof setTimeout>;
  } = {};

  constructor(private readonly onPhaseChange: (newPhase: ColorPhase) => void) {}

  startTransitionSequence(): void {
    this.clearAllTimers();
    this.scheduleTransitions();
  }

  destroy(): void {
    this.clearAllTimers();
  }

  private scheduleTransitions(): void {
    this.timers.toMedium = setTimeout(() => {
      this.onPhaseChange('medium');
      this.scheduleToFade();
    }, LogEntryTimer.TRANSITION_DELAYS.brightToMedium);
  }

  private scheduleToFade(): void {
    this.timers.toFade = setTimeout(() => {
      this.onPhaseChange('fade');
      this.scheduleToHidden();
    }, LogEntryTimer.TRANSITION_DELAYS.mediumToFade);
  }

  private scheduleToHidden(): void {
    this.timers.toHidden = setTimeout(() => {
      this.onPhaseChange('hidden');
    }, LogEntryTimer.TRANSITION_DELAYS.fadeToHidden);
  }

  private clearAllTimers(): void {
    Object.values(this.timers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.timers = {};
  }
}

class LogEntry {
  private colorPhase: ColorPhase = 'bright';
  private readonly timer: LogEntryTimer;
  private readonly colorConfiguration: ColorConfiguration;

  constructor(
    public readonly message: LogMessage,
    colorConfiguration: ColorConfiguration,
    private readonly onDisplayUpdate: () => void
  ) {
    this.colorConfiguration = colorConfiguration;
    this.timer = new LogEntryTimer((newPhase) => this.handlePhaseChange(newPhase));
    this.timer.startTransitionSequence();
  }

  getCurrentColor(): string {
    return LogEntryColorResolver.resolveColor(this.colorPhase, this.colorConfiguration);
  }

  getCurrentOpacity(): number {
    return LogEntryColorResolver.resolveOpacity(this.colorPhase);
  }

  entryIsVisible(): boolean {
    return this.colorPhase !== 'hidden';
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
    private readonly colorConfiguration: ColorConfiguration,
    private readonly onDisplayUpdate: () => void
  ) {}

  addEntries(messages: LogMessage[]): void {
    const newEntries = messages.map(message => 
      new LogEntry(message, this.colorConfiguration, this.onDisplayUpdate)
    );
    
    this.entries = [...newEntries, ...this.entries];
    this.trimToMaxSize();
  }

  getVisibleEntries(): LogEntry[] {
    return this.entries.slice(0, this.maxSize);
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
      removedEntry?.destroy();
    }
  }
}

class LogElementRenderer {
  constructor(
    private readonly elements: TextElement[],
    private readonly colorConfiguration: ColorConfiguration
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

class LogAnimation {
    constructor(
        private readonly getShadowElement: (id: string) => Element | null,
        /**
         * Duration (seconds) for slide-related animations. Fade-in durations are
         * controlled by the top-level constants to keep them independent.
         */
        private readonly slideDuration: number
    ) {}

    public fadeIn(
        timeline: gsap.core.Timeline,
        newElement: TextElement,
        newDomElement: Element,
        message: LogMessage,
        widgetConfig: LogWidgetConfig,
        requestUpdateCallback?: () => void
    ): void {
        const newEntryTemp = new LogEntry(
            message,
            LogEntryColorResolver.createConfiguration(widgetConfig.textColor),
            () => {}
        );

        newElement.props.text = newEntryTemp.message.text;
        newElement.props.fill = newEntryTemp.getCurrentColor();
        requestUpdateCallback?.();

        gsap.set(newDomElement, { opacity: 0 });

        // Single fade-in with customized bounce ease
        timeline.to(
            newDomElement,
            {
                opacity: 1,
                duration: FADE_IN_DURATION,
                ease: FADE_IN_EASE
            },
            '>' // start after previous tweens in the timeline
        );

        newEntryTemp.destroy();
    }

    public slideDown(
        timeline: gsap.core.Timeline,
        logLineElements: TextElement[],
        visibleEntries: LogEntry[],
        maxLines: number,
        lineSpacing: number
    ): void {
        for (let i = visibleEntries.length - 1; i >= 0; i--) {
            const currentElement = logLineElements[i];
            const targetElement = logLineElements[i + 1];

            if (targetElement && i < maxLines - 1) {
                const currentDomElement = this.getShadowElement(currentElement.id);
                const targetDomElement = this.getShadowElement(targetElement.id);
                
                if (currentDomElement && targetDomElement) {
                    const currentTextElement = currentDomElement.querySelector('text');
                    const targetTextElement = targetDomElement.querySelector('text');
                    
                    if (currentTextElement && targetTextElement) {
                        targetTextElement.textContent = currentTextElement.textContent || '';
                    }
                    
                    // Ensure SVG properties mirror as well (color / opacity)
                    targetDomElement.setAttribute('opacity', '1');
                    targetElement.props.fillOpacity = 1;

                    timeline.fromTo(targetDomElement,
                        { y: -lineSpacing, opacity: 1 },
                        {
                            y: 0,
                            opacity: 1,
                            duration: this.slideDuration,
                            ease: 'power2.out',
                        }, 0
                    );
                }
            }
        }
    }

    public fadeOut(
        timeline: gsap.core.Timeline,
        logLineElements: TextElement[],
        maxLines: number
    ): void {
        const lastElement = logLineElements[maxLines - 1];
        const lastDomElement = this.getShadowElement(lastElement.id);

        if (lastDomElement) {
            timeline.to(lastDomElement, {
                opacity: 0,
                duration: this.slideDuration,
                ease: 'power2.out',
            }, 0);
        }
    }
}

class LogAnimationCoordinator {
    private readonly timeline: gsap.core.Timeline;
    private readonly animation: LogAnimation;

    constructor(
        private readonly logLineElements: TextElement[],
        private readonly message: LogMessage,
        private readonly widgetConfig: LogWidgetConfig,
        private readonly entryCollection: LogEntryCollection,
        private readonly getShadowElement: (id: string) => Element | null,
        private readonly onAnimationComplete: () => void,
        private readonly lineSpacing: number,
        private readonly requestUpdateCallback?: () => void,
    ) {
        this.timeline = gsap.timeline({
            onComplete: () => {
                this.entryCollection.addEntries([this.message]);
                this.resetElementPositions();
                this.onAnimationComplete();
            }
        });
        this.animation = new LogAnimation(this.getShadowElement, SLIDE_ANIMATION_DURATION);
    }

    public async run(): Promise<void> {
        this.buildAnimation();
        await this.timeline;
    }

    private buildAnimation(): void {
        const visibleEntries = this.entryCollection.getVisibleEntries();
        const maxLines = this.widgetConfig.maxLines!;

        this.animation.slideDown(
            this.timeline,
            this.logLineElements,
            visibleEntries,
            maxLines,
            this.lineSpacing
        );

        if (visibleEntries.length >= maxLines) {
            this.animation.fadeOut(
                this.timeline,
                this.logLineElements,
                maxLines
            );
        }

        const newElement = this.logLineElements[0];
        const newDomElement = this.getShadowElement(newElement.id);

        if (newDomElement) {
            this.animation.fadeIn(
                this.timeline,
                newElement,
                newDomElement,
                this.message,
                this.widgetConfig,
                this.requestUpdateCallback
            );
        }
    }
    
    private resetElementPositions(): void {
        this.logLineElements.forEach(element => {
            const domElement = this.getShadowElement(element.id);
            if (domElement) {
                gsap.set(domElement, { y: 0, clearProps: 'transform' });
            }
        });
    }
}

export class LogWidget extends Widget {
  private static readonly DEFAULT_HEIGHT = 100;
  private static readonly DEFAULT_MAX_LINES = 5;
  private static readonly DEFAULT_FONT_SIZE = 14;

  private entryCollection?: LogEntryCollection;
  private elementRenderer?: LogElementRenderer;
  private previousHass?: HomeAssistant;
  private logLineElements: TextElement[] = [];
  private boundsElement?: RectangleElement;
  private widgetConfig?: LogWidgetConfig;
  private unsubscribeFromEvents?: () => void;
  private messageQueue: LogMessage[] = [];
  private isProcessingQueue = false;

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
    
    this.ensureInitialized();
    
    if (hass) {
      this.initializeLogging(hass);
    }
  }

  public expand(): LayoutElement[] {
    this.ensureInitialized();
    
    // Only refresh display if we have entries to show
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
      this.widgetConfig = this.getWidgetConfig();
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

  private getWidgetConfig(): LogWidgetConfig {
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
        fill: LogEntryColorResolver.DEFAULT_COLORS.bright,
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
    const colorConfiguration = LogEntryColorResolver.createConfiguration(config.textColor);
    
    this.entryCollection = new LogEntryCollection(
      config.maxLines!,
      colorConfiguration,
      () => this.refreshDisplay()
    );
    
    this.elementRenderer = new LogElementRenderer(
      this.logLineElements,
      colorConfiguration
    );
  }

  private detectStateChanges(oldHass: HomeAssistant, newHass: HomeAssistant): LogMessage[] {
    const changes: LogMessage[] = [];
    
    for (const entityId in newHass.states) {
      const newState = newHass.states[entityId];
      const oldState = oldHass.states[entityId];
      
      if (this.stateChanged(oldState, newState)) {
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

  private addLogMessages(newMessages: LogMessage[], animated = true): void {
    if (!this.entryCollection) return;

    const isDuplicate = (candidate: LogMessage): boolean => {
      const regexSafe = candidate.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${regexSafe}$`, 'i');

      // Check currently visible & stored entries
      for (const entry of this.entryCollection!.getVisibleEntries()) {
        if (pattern.test(entry.message.text)) return true;
      }

      // Check the entire message queue (already scheduled for animation)
      for (const queued of this.messageQueue) {
        if (pattern.test(queued.text)) return true;
      }

      return false;
    };

    const uniqueNewMessages: LogMessage[] = newMessages.filter(msg => !isDuplicate(msg));

    if (uniqueNewMessages.length === 0) return;

    if (animated) {
      this.messageQueue.push(...uniqueNewMessages);
      this.processMessageQueue();
    } else {
      this.entryCollection.addEntries(uniqueNewMessages);
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

    const coordinator = new LogAnimationCoordinator(
        this.logLineElements,
        message,
        this.widgetConfig!,
        this.entryCollection!,
        (id) => this.getShadowElement?.(id) ?? null,
        () => this.refreshDisplay(),
        lineSpacing,
        this.requestUpdateCallback
    );

    await coordinator.run();
  }

  private refreshDisplay(): void {
    if (this.entryCollection && this.elementRenderer) {
      const visibleEntries = this.entryCollection.getVisibleEntries();
      this.elementRenderer.updateElementsFromEntries(visibleEntries);
    }
    this.requestUpdateCallback?.();
  }

  private async initializeLogging(hass: HomeAssistant): Promise<void> {
    // Start listening for future state changes only; we intentionally skip initial log population
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

    const actualEntityId = newState.entity_id;
    const friendlyName = newState.attributes?.friendly_name || actualEntityId;
    const message: LogMessage = {
      id: `${actualEntityId}-${newState.last_changed}`,
      text: `${friendlyName}: ${newState.state}`,
      timestamp: new Date(newState.last_changed).getTime(),
    };
    
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