import FontMetrics from 'fontmetrics';

export const EPSILON = 0.0001;
export const CAP_HEIGHT_RATIO = 0.66;

export type Orientation = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type Direction = 'left' | 'right';

export class ShapeGenerator {
    static buildPath(points: [number, number, number][]): string {
        if (!points || points.length < 3) {
            console.warn("LCARS Card: buildPath requires at least 3 points.");
            return "";
        }
        
        let pathData = "";
        const len = points.length;
        
        for (let i = 0; i < len; i++) {
            const p1 = points[i];
            const p0 = points[(i - 1 + len) % len];
            const p2 = points[(i + 1) % len];

            const [x, y, r] = p1;
            const [x0, y0] = p0;
            const [x2, y2] = p2;

            const v1x = x0 - x, v1y = y0 - y;
            const v2x = x2 - x, v2y = y2 - y;
            
            const magV1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const magV2 = Math.sqrt(v2x * v2x + v2y * v2y);
            
            let cornerRadius = r;
            let dist = 0;
            
            if (cornerRadius > EPSILON && magV1 > EPSILON && magV2 > EPSILON) {
                const dotProduct = v1x * v2x + v1y * v2y;
                const clampedDot = Math.max(-1 + EPSILON, Math.min(1 - EPSILON, dotProduct / (magV1 * magV2)));
                const angle = Math.acos(clampedDot);
                
                if (Math.abs(Math.sin(angle / 2)) > EPSILON && Math.abs(Math.tan(angle / 2)) > EPSILON) {
                    dist = Math.abs(cornerRadius / Math.tan(angle / 2));
                    dist = Math.min(dist, magV1, magV2);
                    cornerRadius = dist * Math.abs(Math.tan(angle / 2));
                } else { 
                    cornerRadius = 0;
                    dist = 0; 
                }
            } else { 
                cornerRadius = 0;
                dist = 0; 
            }
            
            const normV1x = magV1 > EPSILON ? v1x / magV1 : 0;
            const normV1y = magV1 > EPSILON ? v1y / magV1 : 0;
            const normV2x = magV2 > EPSILON ? v2x / magV2 : 0;
            const normV2y = magV2 > EPSILON ? v2y / magV2 : 0;
            
            const arcStartX = x + normV1x * dist;
            const arcStartY = y + normV1y * dist;
            const arcEndX = x + normV2x * dist;
            const arcEndY = y + normV2y * dist;
            
            if (i === 0) { 
                pathData += `M ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
            } else { 
                pathData += `L ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
            }
            
            if (cornerRadius > EPSILON && dist > EPSILON) {
                const crossProductZ = v1x * v2y - v1y * v2x;
                const sweepFlag = crossProductZ > 0 ? 0 : 1;
                pathData += `A ${cornerRadius.toFixed(3)},${cornerRadius.toFixed(3)} 0 0,${sweepFlag} ${arcEndX.toFixed(3)},${arcEndY.toFixed(3)} `;
            }
        }
        
        pathData += "Z";
        return pathData;
    }

    private static dimensionsAreValid(width: number, height: number, functionName: string): boolean {
        if (width <= 0 || height <= 0) {
            console.warn(`LCARS Card: ${functionName} requires positive width and height.`);
            return false;
        }
        return true;
    }

    private static createFallbackPoints(x: number, y: number): [number, number, number][] {
        return [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
    }

    static generateChiselEndcap(
        width: number,
        height: number,
        side: 'left' | 'right',
        x: number = 0,
        y: number = 0,
        topCornerRadius: number = height / 8,
        bottomCornerRadius: number = height / 4
    ): string {
        if (!this.dimensionsAreValid(width, height, 'generateChiselEndcap')) {
            return this.buildPath(this.createFallbackPoints(x, y));
        }

        let points: [number, number, number][];
        if (side === 'right') {
            const upperWidth = width;
            const lowerWidth = width - height / 2;
            points = [
                [x, y, 0],
                [x + upperWidth, y, topCornerRadius],
                [x + lowerWidth, y + height, bottomCornerRadius],
                [x, y + height, 0]
            ];
        } else if (side === 'left') {
            const lowerOffset = height / 2;
            points = [
                [x, y, topCornerRadius],
                [x + width, y, 0],
                [x + width, y + height, 0],
                [x + lowerOffset, y + height, bottomCornerRadius]
            ];
        } else {
            console.warn("LCARS Card: generateChiselEndcap only supports side='left' or 'right'. Falling back to rectangle.");
            points = [
                [x, y, 0],
                [x + width, y, 0],
                [x + width, y + height, 0],
                [x, y + height, 0]
            ];
        }
        return this.buildPath(points);
    }

    static generateElbow(
        x: number,
        width: number,
        bodyWidth: number,
        armHeight: number,
        height: number,
        orientation: Orientation,
        y: number = 0,
        outerCornerRadius: number = armHeight
    ): string {
        if (armHeight <= 0 || width <= 0 || bodyWidth <= 0 || height <= armHeight) {
            console.warn("LCARS Card: Invalid dimensions provided to generateElbow.");
            return this.buildPath([[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]]);
        }

        const h = armHeight;
        const wH = width;
        const wV = bodyWidth;
        const totalH = height;
        const innerRadius = Math.min(h / 2, wV);
        const maxOuterRadius = Math.min(wH, totalH);
        const safeOuterCornerRadius = Math.min(outerCornerRadius, maxOuterRadius);

        let points: [number, number, number][];
        switch (orientation) {
            case 'top-left':
                points = [
                    [x + wH, y, 0], [x, y, safeOuterCornerRadius],
                    [x, y + totalH, 0], [x + wV, y + totalH, 0],
                    [x + wV, y + h, innerRadius], [x + wH, y + h, 0]
                ];
                break;
            case 'top-right':
                points = [
                    [x, y, 0], [x + wH, y, safeOuterCornerRadius],
                    [x + wH, y + totalH, 0], [x + wH - wV, y + totalH, 0],
                    [x + wH - wV, y + h, innerRadius], [x, y + h, 0]
                ];
                break;
            case 'bottom-right':
                points = [
                    [x, y + totalH - h, 0], [x + wH - wV, y + totalH - h, innerRadius],
                    [x + wH - wV, y, 0], [x + wH, y, 0],
                    [x + wH, y + totalH, safeOuterCornerRadius], [x, y + totalH, 0]
                ];
                break;
            case 'bottom-left':
                points = [
                    [x + wH, y + totalH - h, 0], [x + wV, y + totalH - h, innerRadius],
                    [x + wV, y, 0], [x, y, 0],
                    [x, y + totalH, safeOuterCornerRadius], [x + wH, y + totalH, 0]
                ];
                break;
            default:
                console.error(`LCARS Card: Invalid orientation "${orientation}" provided to generateElbow.`);
                return this.buildPath(this.createFallbackPoints(x, y));
        }
        return this.buildPath(points);
    }

    static generateEndcap(
        width: number,
        height: number,
        direction: Direction,
        x: number = 0,
        y: number = 0
    ): string {
        if (!this.dimensionsAreValid(width, height, 'generateEndcap')) {
            return this.buildPath([[x, y, 0], [x, y, 0], [x, y, 0]]);
        }

        const cornerRadius = width >= height/2 ? height/2 : width;
        
        let points: [number, number, number][];
        if (direction === 'left') {
            points = [
                [x, y, cornerRadius],
                [x + width, y, 0],
                [x + width, y + height, 0],
                [x, y + height, cornerRadius]
            ];
        } else {
            points = [
                [x, y, 0],
                [x + width, y, cornerRadius],
                [x + width, y + height, cornerRadius],
                [x, y + height, 0]
            ];
        }
        
        return this.buildPath(points);
    }

    static generateRectangle(
        x: number,
        y: number,
        width: number,
        height: number,
        cornerRadius: number = 0
    ): string {
        if (!this.dimensionsAreValid(width, height, 'generateRectangle')) {
            return this.buildPath(this.createFallbackPoints(x, y));
        }

        const points: [number, number, number][] = [
            [x, y, cornerRadius], [x + width, y, cornerRadius],
            [x + width, y + height, cornerRadius], [x, y + height, cornerRadius]
        ];
        return this.buildPath(points);
    }

    static generateTriangle(
        sideLength: number,
        direction: Direction,
        centerX: number = 0,
        centerY: number = 0,
        cornerRadius: number = 0
    ): string {
        if (sideLength <= 0) {
            console.warn("LCARS Card: generateTriangle requires positive sideLength.");
            return this.buildPath([[centerX, centerY, 0], [centerX, centerY, 0], [centerX, centerY, 0]]);
        }

        const h = (Math.sqrt(3) / 2) * sideLength;
        const distCenterToVertex = h * (2 / 3);
        const distCenterToBaseMidpoint = h / 3;

        let points: [number, number, number][];
        if (direction === 'right') {
            const p1x = centerX + distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX - distCenterToBaseMidpoint;
            const p2y = centerY - sideLength / 2;
            const p3x = centerX - distCenterToBaseMidpoint;
            const p3y = centerY + sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        } else {
            const p1x = centerX - distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX + distCenterToBaseMidpoint;
            const p2y = centerY + sideLength / 2;
            const p3x = centerX + distCenterToBaseMidpoint;
            const p3y = centerY - sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        }
        return this.buildPath(points);
    }
}

export class TextMeasurement {
    private static canvasContext: CanvasRenderingContext2D | null = null;

    static measureSvgTextWidth(text: string, font: string, letterSpacing?: string, textTransform?: string): number {
        const transformedText = this.applyTextTransform(text, textTransform);

        try {
            if (typeof document !== 'undefined' && document.createElementNS) {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", "0");
                svg.setAttribute("height", "0");
                svg.style.position = "absolute";
                svg.style.visibility = "hidden";
                document.body.appendChild(svg);
                
                const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                textElement.textContent = transformedText;
                
                const fontWeight = font.match(/^(bold|normal|[1-9]00)\s+/) ? 
                    font.match(/^(bold|normal|[1-9]00)\s+/)?.[1] || 'normal' : 'normal';
                const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)(?:px|pt|em|rem)/);
                const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
                const fontFamily = font.includes(' ') ? 
                    font.substring(font.lastIndexOf(' ') + 1) : font;
                
                textElement.setAttribute("font-family", fontFamily);
                textElement.setAttribute("font-size", `${fontSize}px`);
                textElement.setAttribute("font-weight", fontWeight);
                
                if (letterSpacing) {
                    textElement.setAttribute("letter-spacing", letterSpacing);
                }
                
                svg.appendChild(textElement);
                const textWidth = textElement.getComputedTextLength();
                document.body.removeChild(svg);
                
                if (isNaN(textWidth)) {
                    throw new Error("Invalid text width measurement");
                }
                
                return textWidth;
            }
        } catch (e) {
            console.warn("LCARS Card: SVG text measurement failed, falling back to canvas:", e);
        }
        
        return this.measureCanvasTextWidth(transformedText, font);
    }

    static measureCanvasTextWidth(text: string, font: string): number {
        if (!this.canvasContext) {
            try {
                if (typeof document !== 'undefined' && document.createElement) {
                    const canvas = document.createElement('canvas');
                    this.canvasContext = canvas.getContext('2d', { willReadFrequently: true });
                    if (!this.canvasContext) {
                        console.warn("LCARS Card: Failed to get 2D context for text measurement. Using fallback.");
                    }
                } else {
                    console.warn("LCARS Card: Cannot create canvas for text measurement (document not available). Using fallback.");
                    this.canvasContext = null;
                }
            } catch (e) {
                console.error("LCARS Card: Error creating canvas context for text measurement.", e);
                this.canvasContext = null;
            }
        }

        if (this.canvasContext) {
            this.canvasContext.font = font;
            try {
                const metrics = this.canvasContext.measureText(text);
                return metrics.width;
            } catch (e) {
                console.error(`LCARS Card: Error measuring text width for font "${font}".`, e);
            }
        }

        return this.getFallbackTextWidth(text, font);
    }

    static measureTextBoundingBox(element: SVGTextElement | null): { width: number; height: number } | null {
        if (!element || typeof element.getBBox !== 'function' || !element.isConnected) {
            return null;
        }

        try {
            const bbox = element.getBBox();
            if (bbox && typeof bbox.width === 'number' && typeof bbox.height === 'number' && bbox.width >= 0 && bbox.height >= 0) {
                return { width: bbox.width, height: bbox.height };
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    static calculateBarHeight(measuredTextHeight: number): number {
        if (measuredTextHeight <= 0) {
            return 0;
        }
        return measuredTextHeight * CAP_HEIGHT_RATIO;
    }

    private static applyTextTransform(text: string, textTransform?: string): string {
        if (!textTransform) return text;
        
        switch (textTransform.toLowerCase()) {
            case 'uppercase': return text.toUpperCase();
            case 'lowercase': return text.toLowerCase();
            case 'capitalize': return text.replace(/\b\w/g, c => c.toUpperCase());
            default: return text;
        }
    }

    private static getFallbackTextWidth(text: string, font: string): number {
        console.warn(`LCARS Card: Using fallback text width estimation for font "${font}".`);
        const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)(?:px|pt|em|rem)/);
        const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
        return text.length * fontSize * 0.6;
    }
} 