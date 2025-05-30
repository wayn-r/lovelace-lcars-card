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

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    
    const fillColor = this._resolveDynamicColor(props.fill) || '#99CCFF';
    
    this.leftEndcap = this.createLeftEndcap(id, fillColor, hass, requestUpdateCallback, getShadowElement);
    this.rightEndcap = this.createRightEndcap(id, fillColor, hass, requestUpdateCallback, getShadowElement);
    this.leftText = this.createTextElement(id, 'left', props, hass, requestUpdateCallback, getShadowElement);
    this.rightText = this.createTextElement(id, 'right', props, hass, requestUpdateCallback, getShadowElement);
    this.headerBar = this.createHeaderBar(id, fillColor, hass, requestUpdateCallback, getShadowElement);
    
    this.resetLayout();
    this.intrinsicSize = { width: 0, height: 0, calculated: false };
  }
  
  private createLeftEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): EndcapElement {
    return new EndcapElement(`${id}_left_endcap`, {
      width: 15,
      direction: 'left',
      fill
    }, {
      // No anchor - we'll position this manually in layoutEndcaps
    }, hass, requestUpdateCallback, getShadowElement);
  }
  
  private createRightEndcap(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): EndcapElement {
    return new EndcapElement(`${id}_right_endcap`, {
      width: 15,
      direction: 'right',
      fill
    }, {
      // No anchor - we'll position this manually in layoutEndcaps
    }, hass, requestUpdateCallback, getShadowElement);
  }
  
  private createTextElement(id: string, position: 'left' | 'right', props: LayoutElementProps, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): TextElement {
    const isLeft = position === 'left';
    const textContent = isLeft ? (props.leftContent || 'LEFT') : (props.rightContent || 'RIGHT');
    
    return new TextElement(`${id}_${position}_text`, {
      text: textContent,
      fontFamily: props.fontFamily || 'Antonio',
      fontWeight: props.fontWeight || 'normal',
      letterSpacing: props.letterSpacing || 'normal',
      textTransform: props.textTransform || 'uppercase',
      fontSize: props.fontSize || 16,
      fill: props.textColor || props.fill || '#FFFFFF'
    }, {
      // No anchor - we'll position this manually in layoutTextElements
    }, hass, requestUpdateCallback, getShadowElement);
  }
  
  private createHeaderBar(id: string, fill: string, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): RectangleElement {
    return new RectangleElement(`${id}_header_bar`, {
      fill,
      width: 1  // Will be calculated in layoutHeaderBar
    }, {
      // No anchor or stretch - we'll position this manually in layoutHeaderBar
    }, hass, requestUpdateCallback, getShadowElement);
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
      const cap = Math.abs(metrics.capHeight) || 1; // prevent div-by-0
      return height / cap;
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
    const { x, y, width } = this.layout;
    
    // Configure and layout left endcap
    this.configureEndcap(this.leftEndcap, height, endcapWidth, fill);
    this.leftEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    
    // Position left endcap manually at the start of the top_header
    this.leftEndcap.layout.x = x;
    this.leftEndcap.layout.y = y;
    this.leftEndcap.layout.width = endcapWidth;
    this.leftEndcap.layout.height = height;
    this.leftEndcap.layout.calculated = true;
    
    // Configure and layout right endcap
    this.configureEndcap(this.rightEndcap, height, endcapWidth, fill);
    this.rightEndcap.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    
    // Position right endcap manually at the end of the top_header
    this.rightEndcap.layout.x = x + width - endcapWidth;
    this.rightEndcap.layout.y = y;
    this.rightEndcap.layout.width = endcapWidth;
    this.rightEndcap.layout.height = height;
    this.rightEndcap.layout.calculated = true;
  }
  
  private configureEndcap(endcap: EndcapElement, height: number, width: number, fill: string): void {
    endcap.props.height = height;
    endcap.props.width = width;
    endcap.props.fill = fill;
  }
  
  private layoutTextElements(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const height = this.layout.height;
    const fontString = `${fontConfig.fontWeight} ${fontSize}px ${fontConfig.fontFamily}`;
    const leftTextContent = this.props.leftContent || 'LEFT';
    const rightTextContent = this.props.rightContent || 'RIGHT';
    
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
    const leftTextContent = this.props.leftContent || 'LEFT';
    const rightTextContent = this.props.rightContent || 'RIGHT';
    
    // Configure text elements
    this.configureTextElement(this.leftText, fontSize, fontConfig, leftTextContent, leftTextWidth);
    this.configureTextElement(this.rightText, fontSize, fontConfig, rightTextContent, rightTextWidth);
    
    // Calculate intrinsic sizes
    this.leftText.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.rightText.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    
    // Position left text next to left endcap
    this.leftText.layout.x = this.leftEndcap.layout.x + this.leftEndcap.layout.width + this.textGap;
    this.leftText.layout.y = y + offsetY;
    this.leftText.layout.width = leftTextWidth;
    this.leftText.layout.height = fontSize;
    this.leftText.layout.calculated = true;
    
    // Position right text next to right endcap (aligned to left edge of text area)
    this.rightText.layout.x = this.rightEndcap.layout.x - rightTextWidth - this.textGap;
    this.rightText.layout.y = y + offsetY;
    this.rightText.layout.width = rightTextWidth;
    this.rightText.layout.height = fontSize;
    this.rightText.layout.calculated = true;
  }
  
  private layoutTextWithoutMetrics(fontSize: number, fontConfig: FontConfig, x: number, y: number, offsetY: number, height: number, leftTextWidth: number, rightTextWidth: number, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const leftTextContent = this.props.leftContent || 'LEFT';
    const rightTextContent = this.props.rightContent || 'RIGHT';
    
    // Configure text elements
    this.configureTextElement(this.leftText, fontSize, fontConfig, leftTextContent, leftTextWidth);
    this.configureTextElement(this.rightText, fontSize, fontConfig, rightTextContent, rightTextWidth);
    
    // Calculate intrinsic sizes
    this.leftText.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    this.rightText.calculateIntrinsicSize(containerRect as unknown as SVGElement);
    
    // Position left text next to left endcap
    this.leftText.layout.x = this.leftEndcap.layout.x + this.leftEndcap.layout.width + this.textGap;
    this.leftText.layout.y = y + offsetY;
    this.leftText.layout.width = leftTextWidth;
    this.leftText.layout.height = fontSize;
    this.leftText.layout.calculated = true;
    
    // Position right text next to right endcap (aligned to left edge of text area)
    this.rightText.layout.x = this.rightEndcap.layout.x - rightTextWidth - this.textGap;
    this.rightText.layout.y = y + offsetY;
    this.rightText.layout.width = rightTextWidth;
    this.rightText.layout.height = fontSize;
    this.rightText.layout.calculated = true;
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

  renderShape(): SVGTemplateResult | null {
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