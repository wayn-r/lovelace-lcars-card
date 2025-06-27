import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { svg, SVGTemplateResult } from "lit";
import { TextMeasurement } from "../../utils/shapes.js";
import { FontManager } from "../../utils/font-manager.js";

const CAP_HEIGHT_RATIO = 0.66; 

export class TextElement extends LayoutElement {
    private _cachedMetrics: any = null;
    
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
        if (this.hasExplicitDimensions()) {
            this.setExplicitDimensions();
            return;
        }
        
        const text = this.props.text || '';
        const fontFamily = this.props.fontFamily || 'Arial';
        const fontWeight = this.props.fontWeight || 'normal';
        const fontSize = this.calculateOptimalFontSize(fontFamily, fontWeight);

        this.intrinsicSize.width = FontManager.measureTextWidth(text, {
            fontFamily,
            fontWeight,
            fontSize,
            letterSpacing: this.props.letterSpacing as any,
            textTransform: this.props.textTransform as any,
        });

        this.intrinsicSize.height = this.props.height || fontSize * 1.2;
        this.intrinsicSize.calculated = true;
    }

    private hasExplicitDimensions(): boolean {
        return Boolean(this.props.width && this.props.height && !this.props.fontSize);
    }

    private setExplicitDimensions(): void {
        this.intrinsicSize.width = this.props.width!;
        this.intrinsicSize.height = this.props.height!;
        this.intrinsicSize.calculated = true;
    }

    private calculateOptimalFontSize(fontFamily: string, fontWeight: string): number {
        let fontSize = this.props.fontSize || 16;

        if (this.props.height && !this.props.fontSize) {
            const metrics = FontManager.getFontMetrics(fontFamily, fontWeight as any);
            if (metrics) {
                const capHeightRatio = Math.abs(metrics.capHeight) || CAP_HEIGHT_RATIO;
                fontSize = this.props.height / capHeightRatio;
            } else {
                fontSize = this.props.height * 0.8;
            }
            this.props.fontSize = fontSize;
        }

        return fontSize;
    }
  
    renderShape(): SVGTemplateResult | null {
        if (!this.layout.calculated) {
            return null;
        }

        const { x, y, width, height } = this.layout;
        const textAnchor = this.props.textAnchor || 'start';
        const dominantBaseline = this.props.dominantBaseline || 'auto';

        const { textX, textY } = this.calculateTextPosition(x, y, width, height, textAnchor, dominantBaseline);
        const colors = this.resolveElementColors({ 
            fallbackFillColor: '#000000',
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
                style="${this.createTextTransformStyle()}"
            >
                ${this.props.text || ''}
            </text>
        `;
    }

    private calculateTextPosition(x: number, y: number, width: number, height: number, textAnchor: string, dominantBaseline: string): { textX: number, textY: number } {
        let textX = x;
        let textY = y;
        
        if (textAnchor === 'middle') {
            textX += width / 2;
        } else if (textAnchor === 'end') {
            textX += width;
        }
        
        const metrics = this.getCachedOrFreshMetrics();
        if (metrics) {
            textY = this.calculateMetricsBasedTextY(y, height, metrics, dominantBaseline);
        } else {
            textY = this.calculateFallbackTextY(y, height, dominantBaseline);
        }

        return { textX, textY };
    }

    private getCachedOrFreshMetrics(): any {
        let metrics = this._cachedMetrics || (this as any)._fontMetrics;
        if (!metrics && this.props.fontFamily) {
            metrics = FontManager.getFontMetrics(this.props.fontFamily, this.props.fontWeight as any);
            if (metrics) {
                this._cachedMetrics = metrics;
                (this as any)._fontMetrics = metrics;
            }
        }
        return metrics;
    }

    private calculateMetricsBasedTextY(y: number, height: number, metrics: any, dominantBaseline: string): number {
        const fontSize = this.props.fontSize || 16;
        
        if (dominantBaseline === 'middle') {
            const totalHeight = (metrics.bottom - metrics.top) * fontSize;
            return y + totalHeight / 2 + metrics.top * fontSize;
        } else if (dominantBaseline === 'hanging') {
            return y + metrics.top * fontSize;
        } else {
            return y + (-metrics.ascent * fontSize);
        }
    }

    private calculateFallbackTextY(y: number, height: number, dominantBaseline: string): number {
        if (dominantBaseline === 'middle') {
            return y + height / 2;
        } else if (dominantBaseline === 'hanging') {
            return y;
        } else {
            return y + height * 0.8;
        }
    }

    private createTextTransformStyle(): string {
        return this.props.textTransform ? `text-transform: ${this.props.textTransform};` : '';
    }

    render(): SVGTemplateResult | null {
        return this.renderShape();
    }
}