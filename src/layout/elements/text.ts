import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant, handleAction } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { getFontMetrics, measureTextBBox, getSvgTextWidth, getTextWidth } from "../../utils/shapes.js";

export class TextElement extends LayoutElement {
    // Cache font metrics to maintain consistency across renders
    private _cachedMetrics: any = null;
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
        this.resetLayout();
        this.intrinsicSize = { width: 0, height: 0, calculated: false };
    }
  
    /**
     * Calculates the intrinsic size of the text based on its content.
     * Uses fontmetrics for precise measurement without DOM dependency.
     */
    calculateIntrinsicSize(container: SVGElement): void {
      if (this.props.width && this.props.height) {
        this.intrinsicSize.width = this.props.width;
        this.intrinsicSize.height = this.props.height;
        this.intrinsicSize.calculated = true;
        return;
      }
      
      const text = this.props.text || '';
      const fontFamily = this.props.fontFamily || 'Arial';
      const fontSize = this.props.fontSize || 16;
      const fontWeight = this.props.fontWeight || 'normal';
      
      // Use fontmetrics for precise text measurement
      const metrics = getFontMetrics({
        fontFamily,
        fontWeight,
        fontSize,
        origin: 'baseline',
      });
      
      if (metrics) {
        // Calculate width using fontmetrics and text content
        this.intrinsicSize.width = getSvgTextWidth(
          text, 
          `${fontWeight} ${fontSize}px ${fontFamily}`,
          this.props.letterSpacing || undefined,
          this.props.textTransform || undefined
        );
        
        // Calculate height using fontmetrics (more accurate than DOM bbox)
        const normalizedHeight = (metrics.bottom - metrics.top) * fontSize;
        this.intrinsicSize.height = normalizedHeight;
        
        // Cache metrics for consistent rendering
        (this as any)._fontMetrics = metrics;
        this._cachedMetrics = metrics;
      } else {
        // Fallback calculation if fontmetrics fails
        console.warn(`FontMetrics failed for ${fontFamily}, using fallback calculation`);
        
        this.intrinsicSize.width = getSvgTextWidth(
          text,
          `${fontWeight} ${fontSize}px ${fontFamily}`,
          this.props.letterSpacing || undefined,
          this.props.textTransform || undefined
        );
        this.intrinsicSize.height = fontSize * 1.2; // Standard line height multiplier
      }
      
      this.intrinsicSize.calculated = true;
    }
  
    renderShape(): SVGTemplateResult | null {
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
      
      // Use cached metrics first, then fall back to _fontMetrics (set during calculateIntrinsicSize), then fetch new metrics if needed
      let metrics: any = this._cachedMetrics || (this as any)._fontMetrics;
      if (!metrics && this.props.fontFamily) {
        metrics = getFontMetrics({
          fontFamily: this.props.fontFamily,
          fontWeight: this.props.fontWeight || 'normal',
          fontSize: this.props.fontSize || 16,
          origin: 'baseline',
        });
        
        // Cache metrics for consistent rendering across lifecycle
        if (metrics) {
          this._cachedMetrics = metrics;
        }
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
  
      // Use centralized color resolution with text-specific defaults
      const colors = this._resolveElementColors({ 
        fallbackFillColor: '#000000', // Default text color
        fallbackStrokeColor: 'none', 
        fallbackStrokeWidth: '0' 
      });

      return svg`
        <text
          id=${this.id}
          x=${textX}
          y=${textY}
          fill=${colors.fillColor}
          font-family=${this.props.fontFamily || 'sans-serif'}
          font-size=${`${this.props.fontSize || 16}px`}
          font-weight=${this.props.fontWeight || 'normal'}
          letter-spacing=${this.props.letterSpacing || 'normal'}
          text-anchor=${textAnchor}
          dominant-baseline=${dominantBaseline}
          style="${styles}"
        >
          ${this.props.text || ''}
        </text>
      `;
    }

    /**
     * Override render() to bypass base class text management since TextElement IS the text
     */
    render(): SVGTemplateResult | null {
        return this.renderShape();
    }
  }