import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant, handleAction } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { measureTextBBox } from "../../utils/shapes.js";
import { FontManager } from "../../utils/font-manager.js";

// Add CAP_HEIGHT_RATIO fallback from shapes.ts if it's not already accessible
const CAP_HEIGHT_RATIO = 0.66; 

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
      // If explicit width/height are provided, use them.
      if (this.props.width && this.props.height && !this.props.fontSize) {
        this.intrinsicSize.width = this.props.width;
        this.intrinsicSize.height = this.props.height;
        this.intrinsicSize.calculated = true;
        return;
      }
      
      const text = this.props.text || '';
      const fontFamily = this.props.fontFamily || 'Arial';
      const fontWeight = this.props.fontWeight || 'normal';
      let fontSize = this.props.fontSize || 16;

      if (this.props.height && !this.props.fontSize) {
          const metrics = FontManager.getFontMetrics(fontFamily, fontWeight as any);
          if (metrics) {
              // Use the font's actual capHeight for precision
              const capHeightRatio = Math.abs(metrics.capHeight) || CAP_HEIGHT_RATIO;
              fontSize = this.props.height / capHeightRatio;
              this.props.fontSize = fontSize; // Persist for rendering
        // Removed debug trace logs
          } else {
              // Fallback if metrics are not available
              fontSize = this.props.height * 0.8; // A reasonable guess
              this.props.fontSize = fontSize;
        // Removed debug trace logs
          }
      }

      // Now, measure width using the determined font size.
      this.intrinsicSize.width = FontManager.measureTextWidth(text, {
        fontFamily,
        fontWeight,
        fontSize,
        letterSpacing: this.props.letterSpacing as any,
        textTransform: this.props.textTransform as any,
      });

      // Height is now based on the prop, not re-measured.
      this.intrinsicSize.height = this.props.height || fontSize * 1.2;
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
        metrics = FontManager.getFontMetrics(this.props.fontFamily, this.props.fontWeight as any);
        
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