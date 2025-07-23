import { TextElement } from '../elements/text.js';
import { RectangleElement } from '../elements/rectangle.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';
import { LogMessage, TextConfig } from '../../types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElementProps, LayoutConfigOptions } from '../engine.js';
import { loggerService } from '../../utils/logger-service.js';
import { DistanceParser } from '../../utils/animation.js';
import { animationManager, AnimationContext, AnimationConfig } from '../../utils/animation.js';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { FontManager } from '../../utils/font-manager.js';

gsap.registerPlugin(CustomEase);

// ease customizer at https://gsap.com/docs/v3/Eases/CustomEase/
const customBounce = CustomEase.create("custom", "M0,0 C0.71,-0.314 0.719,0.494 0.719,0.494 0.719,0.494 0.8,-0.002 0.848,-0.002 0.903,-0.002 1,0.98 1,0.98 ");

interface ColorPhaseConfig {
  color: string;
  duration: number;
}

class LogEntryAnimator {
  constructor(
    private readonly elementId: string,
    private readonly context: AnimationContext
  ) {}
  
  static createContext(
    widgetId: string,
    getShadowElement?: (id: string) => Element | null,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void
  ): AnimationContext {
    return {
      elementId: widgetId,
      getShadowElement,
      hass,
      requestUpdateCallback
    };
  }

  public reset(): void {
    const element = this.context.getShadowElement?.(this.elementId);
    if (element) {
      gsap.killTweensOf(element);
    }
  }

  public fade(startOpacity: number, endOpacity: number, ease?: string): Promise<void> {
    const element = this.context.getShadowElement?.(this.elementId);
    if (!element) return Promise.resolve();

    return new Promise<void>(resolve => {
      gsap.fromTo(element, 
        { opacity: startOpacity },
        {
          opacity: endOpacity,
          duration: 0.5,
          ease: ease || customBounce,
          onComplete: resolve
        }
      );
    });
  }

  public changeColor(startColor: string, endColor: string): Promise<void> {
    const element = this.context.getShadowElement?.(this.elementId);
    if (!element) return Promise.resolve();

    return new Promise<void>(resolve => {
      gsap.to(element, {
        fill: endColor,
        duration: 0.5,
        ease: 'power1.inOut',
        onComplete: resolve
      });
    });
  }

  public resetColor(color: string): void {
    const element = this.context.getShadowElement?.(this.elementId);
    if (element) {
      gsap.set(element, { fill: color });
    }
  }

  static resetTransform(elementId: string, getShadowElement?: (id: string) => Element | null): void {
    const elementDom = getShadowElement?.(elementId);
    if (elementDom) {
      gsap.set(elementDom, { y: 0 });
    }
  }

  public fadeOut(): Promise<void> {
    return this.fade(1, 0, 'power4.out');
  }

  public fadeIn(): Promise<void> {
    return this.fade(0, 1, customBounce).then(() => {
      const element = this.context.getShadowElement?.(this.elementId);
      if (element) {

      }
    });
  }

  public slideDown(lineSpacing: number): Promise<void> {
    const elementDom = this.context.getShadowElement?.(this.elementId);
    if (!elementDom) return Promise.resolve();

    const startY = gsap.getProperty(elementDom, 'y');

    return new Promise<void>((resolve) => {
      gsap.to(elementDom, {
        y: `+=${lineSpacing}`,
        duration: 0.5,
        ease: 'power4.out',
        onComplete: () => {
          resolve();
        }
      });
    });
  }
}

class ColorStateManager {
  private static readonly DEFAULT_COLOR_CYCLE: ColorPhaseConfig[] = [
    { color: '#86c8ff', duration: 5000 },
    { color: '#12a4e3', duration: 5000 },
    { color: '#0b6288', duration: 3000 },
  ];

  private timer: NodeJS.Timeout | undefined;
  private currentPhaseIndex: number = 0;
  private colorCycle: ColorPhaseConfig[];

  constructor(
    private readonly entry: LogEntry,
    private readonly animator: LogEntryAnimator,
    private readonly onFadeOut: () => void,
    colorCycle?: ColorPhaseConfig[]
  ) {
    this.colorCycle = (colorCycle && colorCycle.length > 0)
      ? colorCycle
      : ColorStateManager.DEFAULT_COLOR_CYCLE;
  }

  public start(): void {
    if (this.colorCycle.length > 0) {
      this.scheduleNextPhase(this.colorCycle[0].duration);
    }
  }

  public advance(): void {
    if (this.currentPhaseIndex === 0) {
      clearTimeout(this.timer);
      this.transitionToPhase(1);
    }
  }

  public reset(): void {
    clearTimeout(this.timer);
    this.currentPhaseIndex = 0;

    if (this.colorCycle.length > 0) {
      const brightColor = this.colorCycle[0].color;
      this.entry.setColor(brightColor);
      this.animator.resetColor(brightColor);
    }
    this.animator.reset();
  }

  private scheduleNextPhase(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.transitionToPhase(this.currentPhaseIndex + 1);
    }, delay);
  }

  private async transitionToPhase(newPhaseIndex: number): Promise<void> {
    if (newPhaseIndex >= this.colorCycle.length) {
      this.onFadeOut();
      return;
    }

    const startColor = this.colorCycle[this.currentPhaseIndex].color;
    const endColor = this.colorCycle[newPhaseIndex].color;

    this.currentPhaseIndex = newPhaseIndex;

    await this.animator.changeColor(startColor, endColor);

    if (this.currentPhaseIndex < this.colorCycle.length) {
      this.scheduleNextPhase(this.colorCycle[this.currentPhaseIndex].duration);
    }
  }
}

class LogEntry {
  public readonly textElement: TextElement;
  public isMoving: boolean = false;
  private colorManager?: ColorStateManager;
  public animator?: LogEntryAnimator;

  constructor(
    private readonly elementId: string,
    private readonly boundsElementId: string,
    private readonly textColor: string,
    private readonly fontSize: number,
    private readonly fontFamily: string,
    private readonly fontWeight: string,
    private readonly textAnchor: string,
    private readonly hass?: HomeAssistant,
    private readonly requestUpdateCallback?: () => void,
    private readonly getShadowElement?: (id: string) => Element | null,
    private readonly colorCycle?: ColorPhaseConfig[]
  ) {
    this.textElement = this.createTextElement();
  }

  private createTextElement(): TextElement {
    const isEndAnchor = this.textAnchor === 'end';
    
    return new TextElement(
      this.elementId,
      {
        text: '',
        fill: this.textColor,
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight,
        textAnchor: this.textAnchor,
        dominantBaseline: 'auto',
        fillOpacity: 0
      },
      {
        anchor: {
          anchorTo: this.boundsElementId,
          anchorPoint: isEndAnchor ? 'topRight' : 'topLeft',
          targetAnchorPoint: isEndAnchor ? 'topRight' : 'topLeft'
        },
        offsetY: 0
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );
  }

  show(text: string): void {
    this.setText(text);
    this.setVisible(true);
  }

  hide(): void {
    this.setText('');
    this.setVisible(false);
  }

  setPosition(index: number, lineSpacing: number): void {
    this.setOffsetY(index * lineSpacing);
  }

  setColor(color: string): void {
    this.textElement.props.fill = color;
    this.requestUpdateCallback?.();
  }

  setText(text: string): void {
    this.textElement.props.text = text.toUpperCase();
    this.requestUpdateCallback?.();
  }

  setVisible(visible: boolean): void {
    this.textElement.props.fillOpacity = visible ? 1 : 0;
    this.requestUpdateCallback?.();
  }

  getText(): string {
    return this.textElement.props.text || '';
  }

  isVisible(): boolean {
    return this.textElement.props.fillOpacity === 1;
  }

  setOffsetY(offset: number): void {
    this.textElement.layoutConfig.offsetY = offset;
    this.requestUpdateCallback?.();
  }

  public initializeAnimation(animationContext: AnimationContext, onFadeOut: () => void): void {
    this.animator = new LogEntryAnimator(this.textElement.id, animationContext);
    this.colorManager = new ColorStateManager(this, this.animator, onFadeOut, this.colorCycle);
  }

  public startColorCycling(): void {
    this.colorManager?.start();
  }

  public advanceColorState(): void {
    this.colorManager?.advance();
  }

  public reset(): void {
    this.hide();
    this.colorManager?.reset();
    this.animator?.reset();
    this.isMoving = false;
    LogEntryAnimator.resetTransform(this.textElement.id, this.getShadowElement);
  }
}

class MessageProcessor {
  private isProcessing: boolean = false;

  constructor(
    private readonly queue: LogMessage[],
    private readonly processMessage: (message: LogMessage) => Promise<void>
  ) {}

  enqueue(message: LogMessage): void {
    this.queue.push(message);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      await this.processMessage(message);
    }

    this.isProcessing = false;
  }
}

export class LoggerWidget extends Widget {
  public static readonly DEFAULTS = {
    HEIGHT: 100,
    MAX_LINES: 5,
    FONT_SIZE: 14,
    FONT_FAMILY: 'Antonio',
    FONT_WEIGHT: 'normal',
    TEXT_ANCHOR: 'start' as const,
    TEXT_COLOR: '#86c8ff'
  };

  private entries: LogEntry[] = [];
  private queue: LogMessage[] = [];
  private entryCounter: number = 0;
  private maxLines: number = LoggerWidget.DEFAULTS.MAX_LINES;
  private lineSpacing: number = 0;
  private unsubscribe?: () => void;
  private boundsElement?: RectangleElement;
  private processor?: MessageProcessor;

  private trimTextToWidth(
    text: string,
    maxWidth: number,
    config: Omit<TextConfig, 'content'>
  ): string {
    const ellipsis = '…';
    const ellipsisWidth = FontManager.measureTextWidth(ellipsis, config);

    let currentWidth = FontManager.measureTextWidth(text, config);

    if (currentWidth <= maxWidth) {
      return text;
    }

    let trimmedText = text;
    while (currentWidth + ellipsisWidth > maxWidth && trimmedText.length > 0) {
      trimmedText = trimmedText.slice(0, -1);
      currentWidth = FontManager.measureTextWidth(trimmedText, config);
    }

    return trimmedText + ellipsis;
  }

  constructor(
    id: string,
    props: LayoutElementProps = {},
    layoutConfig: LayoutConfigOptions = {},
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    
    this.initialize();
    
    if (hass) {
      loggerService.updateHass(hass);
    }
  }
  
  updateHass(hass?: HomeAssistant): void {
    if (!hass || this.hass === hass) return;
    
    loggerService.updateHass(hass);
    this.hass = hass;
  }

  updateLogMessages(messages: LogMessage[]): void {
    loggerService.clearMessages();
    loggerService.addMessagesInOrder(messages);
    this.entries.forEach(entry => entry.hide());
    this.populateFromExisting();
    this.requestUpdateCallback?.();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.entries.forEach(entry => entry.hide());
    this.entries = [];
    this.queue = [];
    this.unsubscribe = undefined;
  }

  private updateHeight(): void {
    this.layoutConfig.height = this.maxLines * this.lineSpacing;
  }

  private initialize(): void {
    this.boundsElement ??= this.createBounds();
    this.maxLines = this.props.maxLines || LoggerWidget.DEFAULTS.MAX_LINES;
    this.lineSpacing = this.calculateSpacing();
    this.updateHeight();
    
    if (this.entries.length === 0) {
      this.entries = Array.from({ length: this.maxLines + 1 }, () => this.createEntry());
      
      this.entries.forEach(entry => {
        const animationContext = this.createAnimationContext(entry.textElement.id);
        entry.initializeAnimation(animationContext, () => {
          entry.animator?.fadeOut().then(() => {
            entry.hide();
            
            const index = this.entries.findIndex(e => e === entry);
            if (index !== -1) {
              this.entries.splice(index, 1);
              this.entries.push(entry);
            }
          });
        });
      });
      
      this.populateFromExisting();
    }
    
    this.unsubscribe ??= loggerService.registerWidget(
      this.maxLines,
      (message) => this.enqueueMessage(message)
    );
    this.processor ??= new MessageProcessor(
      this.queue,
      (message) => this.displayMessage(message)
    );
  }

  private createBounds(): RectangleElement {
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

  private calculateSpacing(): number {
    const fontSize = this.props.fontSize || LoggerWidget.DEFAULTS.FONT_SIZE;
    
    if (this.props.lineSpacing === undefined) {
      return fontSize * 1.4;
    }
    
    return DistanceParser.parse(
      this.props.lineSpacing.toString(), 
      { layout: { width: fontSize, height: fontSize } }
    );
  }

  private createEntry(): LogEntry {
    const elementId = `${this.id}_entry_${this.entryCounter++}`;
    const colorCycle = this.props.color_cycle;
    const initialColor = colorCycle?.[0]?.color || this.props.textColor || LoggerWidget.DEFAULTS.TEXT_COLOR;

    return new LogEntry(
      elementId,
      this.id,
      initialColor,
      this.props.fontSize || LoggerWidget.DEFAULTS.FONT_SIZE,
      this.props.fontFamily || LoggerWidget.DEFAULTS.FONT_FAMILY,
      this.props.fontWeight || LoggerWidget.DEFAULTS.FONT_WEIGHT,
      this.props.textAnchor || LoggerWidget.DEFAULTS.TEXT_ANCHOR,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement,
      colorCycle
    );
  }

  private populateFromExisting(): void {
    this.entries.forEach(entry => entry.hide());
    
    const widgetWidth = this.boundsElement?.layout.width || 0;
    const textConfig = {
      fontFamily: this.props.fontFamily || LoggerWidget.DEFAULTS.FONT_FAMILY,
      fontSize: this.props.fontSize || LoggerWidget.DEFAULTS.FONT_SIZE,
      fontWeight: this.props.fontWeight || LoggerWidget.DEFAULTS.FONT_WEIGHT,
    };

    loggerService.getMessages()
      .slice(0, this.maxLines)
      .forEach((message, messageIndex) => {
        const entry = this.entries.find(e => e.getText() === message.text);
        if (entry) {
          const trimmedText = this.trimTextToWidth(message.text, widgetWidth, textConfig);
          entry.show(trimmedText);
          entry.setPosition(messageIndex, this.lineSpacing);
        }
      });
  }

  private isDuplicate(messageText: string): boolean {
    const textLower = messageText.toLowerCase();
    
    const activeEntries = this.entries.filter(entry => 
      entry.isVisible() && entry.getText().trim() !== ''
    );
    
    const duplicateInActive = activeEntries.some(entry => 
      entry.getText().toLowerCase() === textLower
    );
    
    const duplicateInQueue = this.queue.some(message => 
      message.text.toLowerCase() === textLower
    );
    
    return duplicateInActive || duplicateInQueue;
  }

  private enqueueMessage(message: LogMessage): void {
    if (this.isDuplicate(message.text)) {
      return;
    }

    this.processor?.enqueue(message);
  }

  private createAnimationContext(elementId: string): AnimationContext {
    return {
      elementId,
      getShadowElement: this.getShadowElement,
      hass: this.hass,
      requestUpdateCallback: this.requestUpdateCallback
    };
  }

  private prepareForReuse(entry: LogEntry): void {
    entry.reset();
    entry.setOffsetY(0);
    this.requestUpdateCallback?.();
  }

  private async displayMessage(message: LogMessage): Promise<void> {
    const entryToFadeOut = this.entries[this.maxLines - 1];
    const fadeOutPromise = entryToFadeOut.isVisible()
      ? entryToFadeOut.animator?.fadeOut().then(() => {
          entryToFadeOut.reset();
        })
      : Promise.resolve();
      
    const entryToReuse = this.entries.pop()!;
    this.entries.unshift(entryToReuse);

    this.prepareForReuse(entryToReuse);

    const widgetWidth = this.boundsElement?.layout.width || 0;
    const textConfig = {
      fontFamily: this.props.fontFamily || LoggerWidget.DEFAULTS.FONT_FAMILY,
      fontSize: this.props.fontSize || LoggerWidget.DEFAULTS.FONT_SIZE,
      fontWeight: this.props.fontWeight || LoggerWidget.DEFAULTS.FONT_WEIGHT,
    };
    const trimmedText = this.trimTextToWidth(message.text, widgetWidth, textConfig);

    entryToReuse.show(trimmedText);
    entryToReuse.startColorCycling();

    const fadeInPromise = entryToReuse.animator?.fadeIn();
    const entriesToSlide = this.entries.slice(1, this.maxLines).filter(e => e.isVisible() && e !== entryToReuse);
    entriesToSlide.forEach(entry => entry.isMoving = true);
    
    const slideDownPromises = entriesToSlide.map(entry =>
      entry.animator?.slideDown(this.lineSpacing)
    ).filter(p => p) as Promise<void>[];
    
    const slideDownPromise = Promise.all(slideDownPromises);

    const entryThatMovedFromTop = this.entries.length > 1 ? this.entries[1] : undefined;

    if (entryThatMovedFromTop?.isMoving) {
      entryThatMovedFromTop.advanceColorState();
    }

    slideDownPromise.then(() => {
      entriesToSlide.forEach(entry => {
        entry.isMoving = false;
      });
    });

    await Promise.all([fadeOutPromise, fadeInPromise, slideDownPromise]);
  }

  public handleResize(): void {
    this.entries.forEach(entry => entry.reset());
    this.lineSpacing = this.calculateSpacing();
    this.updateHeight();
    this.populateFromExisting();
    this.requestUpdateCallback?.();
  }

  public expand(): LayoutElement[] {
    return [
      this.boundsElement!,
      ...this.entries.map(entry => entry.textElement)
    ];
  }
}

WidgetRegistry.registerWidget('logger-widget', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new LoggerWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  const elements = widget.expand();
  
  if (elements.length > 0) {
    (elements[0] as RectangleElement)._loggerWidget = widget;
  }
  
  return elements;
}); 