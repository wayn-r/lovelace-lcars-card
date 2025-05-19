import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { svg, SVGTemplateResult } from "lit";
import { EndcapElement } from "./endcap.js";
import { TextElement } from "./text.js";
import { RectangleElement } from "./rectangle.js";
import { getFontMetrics, getSvgTextWidth } from "../../utils/shapes.js";

interface FontConfig {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  letterSpacing: string;
  textTransform: string;
}

export class TopHeaderElement extends LayoutElement {
  private _cachedMetrics: any = null;
  private leftEndcap: EndcapElement;
  private rightEndcap: EndcapElement;
  private leftText: TextElement;
  private rightText: TextElement;
  private headerBar: RectangleElement;
  
  private readonly textGap: number = 5;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
    super(id, props, layoutConfig, hass, requestUpdateCallback);
    
    const defaultColor = props.fill || '#99CCFF';
    
    this.leftEndcap = this.createLeftEndcap(id, defaultColor, hass, requestUpdateCallback);
    this.rightEndcap = this.createRightEndcap(id, defaultColor, hass, requestUpdateCallback);
    this.leftText = this.createTextElement(id, 'left', props, hass, requestUpdateCallback);
    this.rightText = this.createTextElement(id, 'right', props, hass, requestUpdateCallback);
    this.headerBar = this.createHeaderBar(id, defaultColor, hass, requestUpdateCallback);
    
    this.resetLayout();
  }
  
  private createLeftEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): EndcapElement {
    return new EndcapElement(`${id}_left_endcap`, {
      width: 15,
      direction: 'left',
      fill
    }, {
      anchor: {
        anchorTo: 'container',
        anchorPoint: 'topLeft',
        targetAnchorPoint: 'topLeft'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createRightEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): EndcapElement {
    return new EndcapElement(`${id}_right_endcap`, {
      width: 15,
      direction: 'right',
      fill
    }, {
      anchor: {
        anchorTo: 'container',
        anchorPoint: 'topRight',
        targetAnchorPoint: 'topRight'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createTextElement(id: string, position: 'left' | 'right', props: LayoutElementProps, hass?: HomeAssistant, requestUpdateCallback?: () => void): TextElement {
    const isLeft = position === 'left';
    const textKey = isLeft ? 'leftText' : 'rightText';
    const defaultText = isLeft ? 'LEFT' : 'RIGHT';
    const anchorTo = `${id}_${position}_endcap`;
    
    return new TextElement(`${id}_${position}_text`, {
      text: props[textKey] || defaultText,
      fontFamily: props.fontFamily || 'Antonio',
      fontWeight: props.fontWeight || 'normal',
      letterSpacing: props.letterSpacing || 'normal',
      textTransform: props.textTransform || 'uppercase',
      fill: '#FFFFFF'
    }, {
      anchor: {
        anchorTo,
        anchorPoint: isLeft ? 'topLeft' : 'topRight',
        targetAnchorPoint: isLeft ? 'topRight' : 'topLeft'
      }
    }, hass, requestUpdateCallback);
  }
  
  private createHeaderBar(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void): RectangleElement {
    return new RectangleElement(`${id}_header_bar`, {
      fill,
      width: 1  // Will be calculated in layoutHeaderBar
    }, {
      // No anchor or stretch - we'll position this manually in layoutHeaderBar
    }, hass, requestUpdateCallback);
  }

  calculateIntrinsicSize(container: SVGElement): void {
    this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 300;
    this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 30;
    this.intrinsicSize.calculated = true;
  }

  calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    
    try {
      // First register all child elements
      this.registerChildElements(elementsMap);
      
      // Calculate our own layout first
      super.calculateLayout(elementsMap, containerRect);
      
      if (!this.layout.calculated) {
        return;
      }
      
      const { x, y, width, height } = this.layout;
      const offsetY = this.props.offsetY || 0;
      const fontConfig = this.getFontConfiguration();
      const fontSize = this.calculateFontSize(height, fontConfig);
      
      
      this.layoutEndcaps(height, elementsMap, containerRect);
      
      this.layoutTextElements(fontSize, fontConfig, x, y, offsetY, elementsMap, containerRect);
      
      const leftTextReady = this.leftText?.layout?.calculated;
      const rightTextReady = this.rightText?.layout?.calculated;
      
      if (leftTextReady && rightTextReady) {
        this.layoutHeaderBar(height, offsetY, elementsMap, containerRect);
      } else {
        if (!leftTextReady) console.warn(`  - Left text not ready: ${this.leftText.id}`);
        if (!rightTextReady) console.warn(`  - Right text not ready: ${this.rightText.id}`);
      }
      
    } catch (error) {
      console.error('❌ Error in TopHeader layout:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  }
  
  private registerChildElements(elementsMap: Map<string, LayoutElement>): void {
    elementsMap.set(this.leftEndcap.id, this.leftEndcap);
    elementsMap.set(this.rightEndcap.id, this.rightEndcap);
    elementsMap.set(this.leftText.id, this.leftText);
    elementsMap.set(this.rightText.id, this.rightText);
    elementsMap.set(this.headerBar.id, this.headerBar);
  }
  
  private getFontConfiguration(): FontConfig {
    return {
      fontFamily: this.props.fontFamily || 'Antonio',
      fontWeight: this.props.fontWeight || 'normal',
      fontSize: 0, // Will be calculated later
      letterSpacing: this.props.letterSpacing || 'normal',
      textTransform: this.props.textTransform || 'uppercase'
    };
  }
  
  private calculateFontSize(height: number, fontConfig: FontConfig): number {
    const metrics = this.getFontMetrics(fontConfig);
    
    if (metrics) {
      return height / (metrics.capHeight * -1);
    }
    
    return height;
  }
  
  private getFontMetrics(fontConfig: FontConfig): any {
    if (!this._cachedMetrics) {
      const metrics = getFontMetrics({
        fontFamily: fontConfig.fontFamily,
        fontWeight: fontConfig.fontWeight,
        fontSize: 200, // Reference size recommended by the library
        origin: 'baseline'
      });
      
      if (metrics) {
        this._cachedMetrics = metrics;
      }
    }
    
    return this._cachedMetrics;
  }
  
  private layoutEndcaps(height: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const fill = this.props.fill || '#99CCFF';
    const endcapWidth = height * 0.75;
    
    // Configure and layout left endcap
    this.configureEndcap(this.leftEndcap, height, endcapWidth, fill);
    this.leftEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.leftEndcap.calculateLayout(elementsMap, containerRect);
    
    // Configure and layout right endcap
    this.configureEndcap(this.rightEndcap, height, endcapWidth, fill);
    this.rightEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.rightEndcap.calculateLayout(elementsMap, containerRect);
  }
  
  private configureEndcap(endcap: EndcapElement, height: number, width: number, fill: string): void {
    endcap.props.height = height;
    endcap.props.width = width;
    endcap.props.fill = fill;
  }
  
  private layoutTextElements(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const height = this.layout.height;
    const fontString = `${fontConfig.fontWeight} ${fontSize}px ${fontConfig.fontFamily}`;
    const leftTextContent = this.props.leftText || 'LEFT';
    const rightTextContent = this.props.rightText || 'RIGHT';
    
    const leftTextWidth = getSvgTextWidth(
      leftTextContent, 
      fontString,
      fontConfig.letterSpacing,
      fontConfig.textTransform
    );
    
    const rightTextWidth = getSvgTextWidth(
      rightTextContent, 
      fontString,
      fontConfig.letterSpacing,
      fontConfig.textTransform
    );
    
    const metrics = this._cachedMetrics;
    if (metrics) {
      this.layoutTextWithMetrics(fontSize, fontConfig, y, offsetY, leftTextWidth, rightTextWidth, elementsMap, containerRect);
    } else {
      this.layoutTextWithoutMetrics(fontSize, fontConfig, x, y, offsetY, height, leftTextWidth, rightTextWidth, elementsMap, containerRect);
    }
  }
  
  private layoutTextWithMetrics(fontSize: number, fontConfig: FontConfig, y: number, offsetY: number, leftTextWidth: number, rightTextWidth: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const baselineY = y + offsetY;
    
    // Configure and layout left text
    this.configureTextElement(this.leftText, fontSize, fontConfig, this.props.leftText || 'LEFT', leftTextWidth);
    this.leftText.calculateLayout(elementsMap, containerRect);
    this.leftText.layout.y = baselineY;
    this.leftText.layout.x += this.textGap;
    
    // Configure and layout right text
    this.configureTextElement(this.rightText, fontSize, fontConfig, this.props.rightText || 'RIGHT', rightTextWidth);
    this.rightText.calculateLayout(elementsMap, containerRect);
    this.rightText.layout.y = baselineY;
    this.rightText.layout.x -= this.textGap;
  }
  
  private layoutTextWithoutMetrics(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, height: number, leftTextWidth: number, rightTextWidth: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const bottomY = y + offsetY + height;
    
    // Configure and layout left text
    this.configureTextElement(this.leftText, fontSize, fontConfig, this.props.leftText || 'LEFT', leftTextWidth);
    this.leftText.calculateLayout(elementsMap, containerRect);
    this.leftText.layout.y = bottomY;
    this.leftText.layout.x += this.textGap;
    
    // Configure and layout right text
    this.configureTextElement(this.rightText, fontSize, fontConfig, this.props.rightText || 'RIGHT', rightTextWidth);
    this.rightText.calculateLayout(elementsMap, containerRect);
    this.rightText.layout.y = bottomY;
    this.rightText.layout.x -= this.textGap;
  }
  
  private configureTextElement(textElement: TextElement, fontSize: number, fontConfig: FontConfig, text: string, textWidth: number): void {
    textElement.props.fontSize = fontSize;
    textElement.props.fontFamily = fontConfig.fontFamily;
    textElement.props.fontWeight = fontConfig.fontWeight;
    textElement.props.letterSpacing = fontConfig.letterSpacing;
    textElement.props.textTransform = fontConfig.textTransform;
    textElement.props.text = text;
    textElement.intrinsicSize = {
      width: textWidth,
      height: fontSize,
      calculated: true
    };
  }
  
  private layoutHeaderBar(height: number, offsetY: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    
    try {
      const fill = this.props.fill || '#99CCFF';
      
      // Get the right edge of the left text
      const leftTextRightEdge = this.leftText.layout.x + this.leftText.layout.width;
      
      // Get the left edge of the right text
      const rightTextLeftEdge = this.rightText.layout.x;
      
      // Calculate the width of the header bar (space between text elements minus gaps)
      const headerBarWidth = Math.max(0, rightTextLeftEdge - leftTextRightEdge - (this.textGap * 2));
      
      this.headerBar.props.fill = fill;
      this.headerBar.props.height = height;
      
      // Set the header bar's position and size
      const headerBarX = leftTextRightEdge + this.textGap;
      const headerBarY = this.layout.y + offsetY;
      
      this.headerBar.layout.x = headerBarX;
      this.headerBar.layout.y = headerBarY;
      this.headerBar.layout.width = headerBarWidth;
      this.headerBar.layout.height = height;
      this.headerBar.layout.calculated = true;
      
      // Update intrinsic size for rendering
      this.headerBar.intrinsicSize = {
        width: headerBarWidth,
        height: height,
        calculated: true
      };
    } catch (error) {
      console.error('❌ Error in header bar layout:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  }

  render(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;
    
    return svg`
      ${this.leftEndcap.render()}
      ${this.rightEndcap.render()}
      ${this.headerBar.render()}
      ${this.leftText.render()}
      ${this.rightText.render()}
    `;
  }
} 