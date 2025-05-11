import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../layout/engine.js";
import { HomeAssistant, handleAction } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { getTextWidth, measureTextBBox, getFontMetrics } from "../utils/shapes.js";

export class TextElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    /**
     * Calculates the intrinsic size of the text based on its content.
     * @param container - The SVG container element.
     */
    calculateIntrinsicSize(container: SVGElement): void {
      if (this.props.width && this.props.height) {
        this.intrinsicSize.width = this.props.width;
        this.intrinsicSize.height = this.props.height;
        this.intrinsicSize.calculated = true;
        return;
      }
      
      const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tempText.textContent = this.props.text || '';
      tempText.setAttribute('font-family', this.props.fontFamily || 'sans-serif');
      tempText.setAttribute('font-size', `${this.props.fontSize || 16}px`);
      tempText.setAttribute('font-weight', this.props.fontWeight || 'normal');
      if (this.props.letterSpacing) {
        tempText.setAttribute('letter-spacing', this.props.letterSpacing);
      }
      if (this.props.textTransform) {
        tempText.setAttribute('text-transform', this.props.textTransform);
      }
      
      container.appendChild(tempText);
      
      const bbox = measureTextBBox(tempText);
      
      container.removeChild(tempText);
      
      if (bbox) {
        this.intrinsicSize.width = bbox.width;
        const metrics = getFontMetrics({
          fontFamily: this.props.fontFamily || 'Arial',
          fontWeight: this.props.fontWeight || 'normal',
          fontSize: this.props.fontSize || 16,
          origin: 'baseline',
        });
        if (metrics) {
          const normalizedHeight = (metrics.bottom - metrics.top) * (this.props.fontSize || 16);
          this.intrinsicSize.height = normalizedHeight;
          (this as any)._fontMetrics = metrics;
        } else {
          this.intrinsicSize.height = bbox.height;
        }
      } else {
        this.intrinsicSize.width = getTextWidth(this.props.text || '', 
          `${this.props.fontWeight || ''} ${this.props.fontSize || 16}px ${this.props.fontFamily || 'Arial'}`);
        this.intrinsicSize.height = this.props.fontSize ? parseInt(this.props.fontSize.toString()) * 1.2 : 20;
      }
      
      this.intrinsicSize.calculated = true;
    }
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated) return null;
  
      const { x, y, width, height } = this.layout;
      
      const textAnchor = this.props.textAnchor || 'start';
      const dominantBaseline = this.props.dominantBaseline || 'auto';
  
      let textX = x;
      let textY = y;
      
      if (textAnchor === 'middle') {
        textX += width / 2;
      } else if (textAnchor === 'end') {
        textX += width;
      }
      
      let metrics: any = (this as any)._fontMetrics;
      if (!metrics && this.props.fontFamily) {
        metrics = getFontMetrics({
          fontFamily: this.props.fontFamily,
          fontWeight: this.props.fontWeight || 'normal',
          fontSize: this.props.fontSize || 16,
          origin: 'baseline',
        });
      }
      if (metrics) {
        textY += -metrics.ascent * (this.props.fontSize || 16);
        if (dominantBaseline === 'middle') {
          const totalHeight = (metrics.bottom - metrics.top) * (this.props.fontSize || 16);
          textY = y + totalHeight / 2 + metrics.top * (this.props.fontSize || 16);
        }
        if (dominantBaseline === 'hanging') {
          textY = y + metrics.top * (this.props.fontSize || 16);
        }
      } else {
        if (dominantBaseline === 'middle') {
          textY += height / 2;
        } else if (dominantBaseline === 'hanging') {
        } else {
          textY += height * 0.8;
        }
      }
      
      const styles = this.props.textTransform ? `text-transform: ${this.props.textTransform};` : '';
  
      return svg`
        <text
          id=${this.id}
          x=${textX}
          y=${textY}
          fill=${this.props.fill || '#000000'}
          font-family=${this.props.fontFamily || 'sans-serif'}
          font-size=${`${this.props.fontSize || 16}px`}
          font-weight=${this.props.fontWeight || 'normal'}
          letter-spacing=${this.props.letterSpacing || 'normal'}
          text-anchor=${textAnchor}
          dominant-baseline=${dominantBaseline}
          style=${styles}
        >
          ${this.props.text || ''}
        </text>
      `;
    }
  }