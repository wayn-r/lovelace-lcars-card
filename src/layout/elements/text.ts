import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { svg, SVGTemplateResult } from "lit";
import { TextMeasurement, CAP_HEIGHT_RATIO } from "../../utils/shapes.js";
import { FontManager } from "../../utils/font-manager.js";

const MIN_LETTER_SPACING = -4;
const MAX_LETTER_SPACING = 20;

export class TextElement extends LayoutElement {
    private _cachedMetrics: any = null;
    
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
        if (this.dimensionsAreExplicit()) {
            this.applyExplicitDimensions();
            return;
        }
        
        const text = this.props.text || '';
        const fontFamily = this.props.fontFamily || 'Arial';
        const fontWeight = this.props.fontWeight || 'normal';
        
        const fontSize = this.resolveFontSize(fontFamily, fontWeight);
        const letterSpacing = this.resolveLetterSpacing(text, fontSize, fontFamily, fontWeight);
        
        this.intrinsicSize.width = FontManager.measureTextWidth(text, {
            fontFamily,
            fontWeight,
            fontSize,
            letterSpacing: letterSpacing as any,
            textTransform: this.props.textTransform as any,
        });

        const layoutHeight = this.extractNumericHeight();
        this.intrinsicSize.height = layoutHeight || fontSize * 1.2;
        this.intrinsicSize.calculated = true;
    }

    private dimensionsAreExplicit(): boolean {
        return Boolean(this.props.width && this.props.height && !this.props.fontSize);
    }

    private applyExplicitDimensions(): void {
        this.intrinsicSize.width = this.props.width!;
        this.intrinsicSize.height = this.props.height!;
        this.intrinsicSize.calculated = true;
    }

    private resolveFontSize(fontFamily: string, fontWeight: string): number {
        const layoutHeight = this.extractNumericHeight();
        
        if (layoutHeight) {
            const fontSize = this.calculateFontSizeFromHeight(layoutHeight, fontFamily, fontWeight);
            this.props.fontSize = fontSize;
            return fontSize;
        }
        
        if (this.props.height && !this.props.fontSize) {
            const fontSize = this.calculateFontSizeFromHeight(this.props.height, fontFamily, fontWeight);
            this.props.fontSize = fontSize;
            return fontSize;
        }
        
        const resolvedFontSize = this.props.fontSize || 16;
        return resolvedFontSize;
    }

    private resolveLetterSpacing(text: string, fontSize: number, fontFamily: string, fontWeight: string): string | number {
        const layoutWidth = this.extractNumericWidth();
        
        if (layoutWidth && text.length > 1) {
            const letterSpacing = this.calculateLetterSpacingForWidth(layoutWidth, fontSize, text, fontFamily, fontWeight);
            this.props.letterSpacing = letterSpacing;
            return letterSpacing;
        }
        
        const resolvedLetterSpacing = this.props.letterSpacing || 'normal';
        return resolvedLetterSpacing;
    }

    private extractNumericHeight(): number | null {
        return typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : null;
    }

    private extractNumericWidth(): number | null {
        return typeof this.layoutConfig.width === 'number' ? this.layoutConfig.width : null;
    }

    private calculateFontSizeFromHeight(heightPx: number, fontFamily: string, fontWeight: string): number {
        const metrics = FontManager.getFontMetrics(fontFamily, fontWeight as any);
        if (metrics) {
            const capHeightRatio = Math.abs(metrics.capHeight) || CAP_HEIGHT_RATIO;
            const calculatedFontSize = heightPx / capHeightRatio;
            return calculatedFontSize;
        } else {
            const fallbackFontSize = heightPx * 0.8;
            return fallbackFontSize;
        }
    }

    private calculateLetterSpacingForWidth(widthPx: number, fontSize: number, text: string, fontFamily: string, fontWeight: string): number {
        const baseWidth = FontManager.measureTextWidth(text, {
            fontFamily,
            fontWeight,
            fontSize,
            letterSpacing: 'normal',
            textTransform: this.props.textTransform as any,
        });
        
        const gapCount = Math.max(text.length - 1, 1);
        const totalGapAdjustment = widthPx - baseWidth;
        const spacingPx = totalGapAdjustment / gapCount;
        
        return Math.max(MIN_LETTER_SPACING, Math.min(MAX_LETTER_SPACING, spacingPx));
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

        const renderLetterSpacing = (ls: any) => {
            if (ls === undefined || ls === null) return 'normal';
            if (typeof ls === 'number') return `${ls}px`;
            return ls;
        };

        return svg`
            <text
                id=${this.id}
                x=${textX}
                y=${textY}
                fill=${colors.fillColor}
                font-family=${this.props.fontFamily || 'sans-serif'}
                font-size=${`${this.props.fontSize || 16}px`}
                font-weight=${this.props.fontWeight || 'normal'}
                letter-spacing=${renderLetterSpacing(this.props.letterSpacing)}
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

        const offsetPosition = this.applyTextOffsets({ x: textX, y: textY });
        return { textX: offsetPosition.x, textY: offsetPosition.y };
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
            const calculatedY = y + totalHeight / 2 + metrics.top * fontSize;
            return calculatedY;
        } else if (dominantBaseline === 'hanging') {
            const calculatedY = y + metrics.top * fontSize;
            return calculatedY;
        } else {
            const calculatedY = y + (-metrics.ascent * fontSize);
            return calculatedY;
        }
    }

    private calculateFallbackTextY(y: number, height: number, dominantBaseline: string): number {
        if (dominantBaseline === 'middle') {
            const calculatedY = y + height / 2;
            return calculatedY;
        } else if (dominantBaseline === 'hanging') {
            const calculatedY = y;
            return calculatedY;
        } else {
            const calculatedY = y + height * 0.8;
            return calculatedY;
        }
    }

    private createTextTransformStyle(): string {
        return this.props.textTransform ? `text-transform: ${this.props.textTransform};` : '';
    }

    render(): SVGTemplateResult | null {
        return this.renderShape();
    }
}