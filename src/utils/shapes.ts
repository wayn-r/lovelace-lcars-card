/**
 * SVG Path Generation Utilities
 * 
 * Provides functions for generating SVG path data (`d` attribute) and point strings (`points` attribute)
 * for various shapes used in the LCARS interface, supporting rounded corners.
 *
 * Core Logic:
 * 1. `generate*Path()` Functions: Generate SVG path `d` strings with rounded corners.
 *    They calculate shape vertices internally and use `buildShape` for path creation.
 * 2. `buildShape()`: Takes a point array `[x, y, cornerRadius]` and generates the path string.
 * 3. `generateEquilateralTrianglePoints()`: Special case generating a `points` string for SVG `<polygon>`.
 */

import FontMetrics from 'fontmetrics';

// === Constants ===

export const EPSILON = 0.0001; // Numerical precision for path calculations
// Estimated ratio of font visual cap height to getBBox height (e.g., for 'Antonio' font)
export const CAP_HEIGHT_RATIO = 0.66;

// === Public Types === 
export type Orientation = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type Direction = 'left' | 'right';

// === Internal Types for Vector Math ===
interface Point { x: number; y: number; }
interface Vector { x: number; y: number; }

// === Internal Vector Math Helpers ===
const VectorMath = {
    subtract: (p1: Point, p2: Point): Vector => ({ x: p1.x - p2.x, y: p1.y - p2.y }),
    add: (p: Point, v: Vector): Point => ({ x: p.x + v.x, y: p.y + v.y }),
    scale: (v: Vector, scalar: number): Vector => ({ x: v.x * scalar, y: v.y * scalar }),
    magnitude: (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: Vector, epsilon = EPSILON): Vector | null => {
        const mag = VectorMath.magnitude(v);
        if (mag < epsilon) return null; // Avoid division by zero/near-zero
        return VectorMath.scale(v, 1 / mag);
    },
    dot: (v1: Vector, v2: Vector): number => v1.x * v2.x + v1.y * v2.y,
};


// === Core Shape Building Function ===

/**
 * Generates the SVG path 'd' attribute string for a shape defined by points,
 * applying rounded corners based on the radius specified at each point.
 * Uses an arc (`A` command) for rounded corners.
 * @param points - Array of points `[x, y, cornerRadius]` defining the shape polygon vertices.
 * @returns The SVG path data string (`d` attribute) or an empty string if input is invalid.
 */
export function buildShape(points: [number, number, number][]): string {
    if (!points || points.length < 3) {
        console.warn("LCARS Card: buildShape requires at least 3 points.");
        return "";
    }
    
    let pathData = "";
    const len = points.length;
    
    for (let i = 0; i < len; i++) {
        const p1 = points[i]; // Current point
        const p0 = points[(i - 1 + len) % len]; // Previous point
        const p2 = points[(i + 1) % len]; // Next point

        const [x, y, r] = p1; // Coordinates and requested radius of the current corner
        const [x0, y0] = p0; // Coordinates of the previous point
        const [x2, y2] = p2; // Coordinates of the next point

        // Vectors from the current point to the previous and next points
        const v1x = x0 - x, v1y = y0 - y;
        const v2x = x2 - x, v2y = y2 - y;
        
        const magV1 = Math.sqrt(v1x * v1x + v1y * v1y); // Length of the segment to the previous point
        const magV2 = Math.sqrt(v2x * v2x + v2y * v2y); // Length of the segment to the next point
        
        let cornerRadius = r; // Start with the requested radius
        let dist = 0;         // Distance from the corner along each edge to the arc start/end points
        
        // Calculate the actual possible corner radius based on geometry
        if (cornerRadius > EPSILON && magV1 > EPSILON && magV2 > EPSILON) {
            const dotProduct = v1x * v2x + v1y * v2y;
            // Clamp dot product to avoid Math.acos domain errors due to floating point inaccuracies
            const clampedDot = Math.max(-1 + EPSILON, Math.min(1 - EPSILON, dotProduct / (magV1 * magV2)));
            const angle = Math.acos(clampedDot); // Angle between the two vectors at the corner
            
            // Check for near-collinear points (angle close to 0 or PI) where rounding isn't well-defined
            if (Math.abs(Math.sin(angle / 2)) > EPSILON && Math.abs(Math.tan(angle / 2)) > EPSILON) {
                // Formula relating radius and distance: dist = radius / tan(angle/2)
                dist = Math.abs(cornerRadius / Math.tan(angle / 2));
            
                // Limit the distance to half the length of the shorter adjacent segment
                // This prevents the rounded corner from overlapping itself or extending past the midpoint
            dist = Math.min(dist, magV1, magV2);
            
                // Recalculate the actual radius that can be applied based on the limited distance
                cornerRadius = dist * Math.abs(Math.tan(angle / 2));

            } else { 
                cornerRadius = 0; // Cannot apply radius (collinear or zero requested radius)
                dist = 0; 
            }
        } else { 
            cornerRadius = 0; // Cannot apply radius if a segment has zero length or radius is zero
            dist = 0; 
        }
        
        // Normalized direction vectors (or zero vectors if magnitude is too small)
        const normV1x = magV1 > EPSILON ? v1x / magV1 : 0;
        const normV1y = magV1 > EPSILON ? v1y / magV1 : 0;
        const normV2x = magV2 > EPSILON ? v2x / magV2 : 0;
        const normV2y = magV2 > EPSILON ? v2y / magV2 : 0;
        
        // Calculate arc start and end points relative to the corner point (x, y)
        // Arc starts 'dist' units along the vector towards the previous point (v1)
        const arcStartX = x + normV1x * dist;
        const arcStartY = y + normV1y * dist;
        // Arc ends 'dist' units along the vector towards the next point (v2)
        const arcEndX = x + normV2x * dist;
        const arcEndY = y + normV2y * dist;
        
        // Build the path string segment by segment
        if (i === 0) { 
            // First point: Move to the starting point of the shape
            // If rounded, start at the beginning of the arc, otherwise start at the corner itself.
            pathData += `M ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
        } else { 
            // Subsequent points: Draw a line to the start of the arc (or the corner if no arc)
            pathData += `L ${cornerRadius > EPSILON ? arcStartX.toFixed(3) : x.toFixed(3)},${cornerRadius > EPSILON ? arcStartY.toFixed(3) : y.toFixed(3)} `;
        }
        
        // Add the arc command if a valid radius is applied
        if (cornerRadius > EPSILON && dist > EPSILON) {
            // Determine the sweep flag based on the sign of the Z component of the cross product (v1 x v2)
            // This ensures the arc bends in the correct direction (inside or outside the corner angle).
            const crossProductZ = v1x * v2y - v1y * v2x;
            // SVG sweep flag: 1 for clockwise, 0 for counter-clockwise.
            // Assuming standard SVG coords (y down), positive Z means counter-clockwise bend (sweep 0).
            const sweepFlag = crossProductZ > 0 ? 0 : 1;
            // A command: rx, ry, x-axis-rotation, large-arc-flag (0), sweep-flag, endX, endY
            pathData += `A ${cornerRadius.toFixed(3)},${cornerRadius.toFixed(3)} 0 0,${sweepFlag} ${arcEndX.toFixed(3)},${arcEndY.toFixed(3)} `;
        }
    }
    
    pathData += "Z"; // Close the path to form a closed shape
    return pathData;
}


// === SVG Path (`d`) Generation Functions (using `buildShape`) ===

/**
 * Generates the SVG path data (`d` attribute) for a "chisel" style endcap using `buildShape`.
 * @param width The total width of the shape's bounding box.
 * @param height The total height of the shape's bounding box.
 * @param side Which side the angled part is on (currently only 'right' supported).
 * @param x The starting x coordinate (top-left). Default 0.
 * @param y The starting y coordinate (top-left). Default 0.
 * @param topCornerRadius Radius for the top-right corner. Default 0.
 * @param bottomCornerRadius Radius for the bottom-right corner. Default 0.
 * @returns The SVG path data string (`d` attribute).
 */
export function generateChiselEndcapPath(
    width: number,
    height: number,
    side: 'right',
    x: number = 0,
    y: number = 0,
    topCornerRadius: number = height / 8,
    bottomCornerRadius: number = height / 4
): string {
    let points: [number, number, number][];
    if (width <= 0 || height <= 0) {
        console.warn("LCARS Card: generateChiselEndcapPath requires positive width and height.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0]];
    }
    else if (side !== 'right') {
        console.warn("LCARS Card: generateChiselEndcapPath currently only supports side='right'. Falling back to rectangle.");
        // Inlined rectToPoints logic as fallback
        if (width <= 0 || height <= 0) {
            points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
        } else {
            points = [
                [x, y, 0],                 // Top left
                [x + width, y, 0],         // Top right
                [x + width, y + height, 0], // Bottom right
                [x, y + height, 0]        // Bottom left
            ];
        }
    } else {
        const upperWidth = width;
        const lowerWidth = width - height / 2;
        points = [
            [x, y, 0], // Top left
            [x + upperWidth, y, topCornerRadius], // Top right
            [x + lowerWidth, y + height, bottomCornerRadius], // Bottom right
            [x, y + height, 0] // Bottom left
        ];
    }
    return buildShape(points);
}

/**
 * Generates the SVG path data (`d` attribute) for an elbow shape using `buildShape`.
 * @param x The starting X coordinate.
 * @param horizontalWidth Width of the horizontal leg.
 * @param verticalWidth Width (thickness) of the vertical leg.
 * @param headerHeight Height (thickness) of the horizontal leg.
 * @param totalElbowHeight Total height spanned by the vertical leg.
 * @param orientation Location of the inner curved corner ('top-right', 'top-left', 'bottom-right', 'bottom-left').
 * @param y The starting Y coordinate. Default 0.
 * @param outerCornerRadius Optional radius for the *outer* sharp corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateElbowPath(
    x: number,
    horizontalWidth: number,
    verticalWidth: number,
    headerHeight: number,
    totalElbowHeight: number,
    orientation: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
    y: number = 0,
    outerCornerRadius: number = headerHeight
): string {
    let points: [number, number, number][];
    if (headerHeight <= 0 || horizontalWidth <= 0 || verticalWidth <= 0 || totalElbowHeight <= headerHeight) {
        console.warn("LCARS Card: Invalid dimensions provided to generateElbowPath.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
    const h = headerHeight;
    const wH = horizontalWidth;
    const wV = verticalWidth;
    const totalH = totalElbowHeight;
    const innerRadius = Math.min(h / 2, wV);
    // Limit outerCornerRadius to the lesser of horizontalWidth and totalElbowHeight
    const maxOuterRadius = Math.min(wH, totalH);
    const safeOuterCornerRadius = Math.min(outerCornerRadius, maxOuterRadius);
    switch (orientation) {
        case 'top-left':
                points = [
                    [x + wH, y, 0], [x, y, safeOuterCornerRadius],
                    [x, y + totalH, 0], [x + wV, y + totalH, 0],
                    [x + wV, y + h, innerRadius], [x + wH, y + h, 0]
                ]; break;
        case 'top-right':
                points = [
                    [x, y, 0], [x + wH, y, safeOuterCornerRadius],
                    [x + wH, y + totalH, 0], [x + wH - wV, y + totalH, 0],
                    [x + wH - wV, y + h, innerRadius], [x, y + h, 0]
                ]; break;
            case 'bottom-right':
                points = [
                    [x, y + totalH - h, 0], [x + wH - wV, y + totalH - h, innerRadius],
                    [x + wH - wV, y, 0], [x + wH, y, 0],
                    [x + wH, y + totalH, safeOuterCornerRadius], [x, y + totalH, 0]
                ]; break;
            case 'bottom-left':
                points = [
                    [x + wH, y + totalH - h, 0], [x + wV, y + totalH - h, innerRadius],
                    [x + wV, y, 0], [x, y, 0],
                    [x, y + totalH, safeOuterCornerRadius], [x + wH, y + totalH, 0]
                ]; break;
            default:
                 console.error(`LCARS Card: Invalid orientation "${orientation}" provided to generateElbowPath.`);
                 points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
        }
    }
    return buildShape(points);
}

/**
 * Generates SVG path data (`d` attribute) for a rounded endcap using `buildShape`.
 * @param width The total width of the shape. Must be >= height/2.
 * @param height The height of the shape.
 * @param direction The side where the rounded part is ('left' or 'right').
 * @param x The starting X coordinate (top-left corner). Default 0.
 * @param y The starting Y coordinate (top-left corner). Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateEndcapPath(
    width: number,
    height: number,
    direction: 'left' | 'right',
    x: number = 0,
    y: number = 0
): string {
    
    let points: [number, number, number][];
     if (height <= 0 || width <= 0) {
         console.warn("[generateEndcapPath] Requires positive width and height.");
         points = [[x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
        const cornerRadius = width >= height/2 ? height/2 : width;
        
        if (direction === 'left') {
            points = [
                [x, y, cornerRadius], // Top Left (Rounded)
                [x + width, y, 0],    // Top Right (Sharp)
                [x + width, y + height, 0], // Bottom Right (Sharp)
                [x, y + height, cornerRadius] // Bottom Left (Rounded)
            ];
        } else { // direction === 'right'
            points = [
                [x, y, 0],                 // Top Left (Sharp)
                [x + width, y, cornerRadius], // Top Right (Rounded)
                [x + width, y + height, cornerRadius], // Bottom Right (Rounded)
                [x, y + height, 0]        // Bottom Left (Sharp)
            ];
        }
        
    }
    const pathD = buildShape(points);
    
    return pathD;
}

/**
 * Generates SVG path data (`d` attribute) for a simple rectangle using `buildShape`.
 * @param x The starting X coordinate (top-left corner).
 * @param y The starting Y coordinate (top-left corner).
 * @param width The width of the rectangle.
 * @param height The height of the rectangle.
 * @param cornerRadius Optional uniform radius for all corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateRectanglePath(
    x: number,
    y: number,
    width: number,
    height: number,
    cornerRadius: number = 0
): string {
    let points: [number, number, number][];
    if (width <= 0 || height <= 0) {
        console.warn("LCARS Card: generateRectanglePath requires positive width and height.");
        points = [[x, y, 0], [x, y, 0], [x, y, 0], [x, y, 0]];
    } else {
        points = [
            [x, y, cornerRadius], [x + width, y, cornerRadius],
            [x + width, y + height, cornerRadius], [x, y + height, cornerRadius]
        ];
    }
    return buildShape(points);
}

/**
 * Generates SVG path data (`d` attribute) for an equilateral triangle using `buildShape`.
 * Allows for rounded corners.
 * @param sideLength The length of each side of the triangle.
 * @param direction Orientation: 'left' (points right) or 'right' (points left).
 * @param centerX The X coordinate of the center. Default 0.
 * @param centerY The Y coordinate of the center. Default 0.
 * @param cornerRadius Optional radius for all corners. Default 0.
 * @returns SVG path data string (`d` attribute).
 */
export function generateTrianglePath(
    sideLength: number,
    direction: 'left' | 'right',
    centerX: number = 0,
    centerY: number = 0,
    cornerRadius: number = 0
): string {
    // --- Triangle Point Calculation Logic ---
    let points: [number, number, number][];
    if (sideLength <= 0) {
        console.warn("LCARS Card: generateTrianglePath requires positive sideLength.");
        points = [[centerX, centerY, 0], [centerX, centerY, 0], [centerX, centerY, 0]];
    } else {
        const h = (Math.sqrt(3) / 2) * sideLength;
        const distCenterToVertex = h * (2 / 3);
        const distCenterToBaseMidpoint = h / 3;

        if (direction === 'right') { // Points right
            const p1x = centerX + distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX - distCenterToBaseMidpoint;
            const p2y = centerY - sideLength / 2;
            const p3x = centerX - distCenterToBaseMidpoint;
            const p3y = centerY + sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        } else { // direction === 'right' (Points left)
            const p1x = centerX - distCenterToVertex;
            const p1y = centerY;
            const p2x = centerX + distCenterToBaseMidpoint;
            const p2y = centerY + sideLength / 2;
            const p3x = centerX + distCenterToBaseMidpoint;
            const p3y = centerY - sideLength / 2;
            points = [[p1x, p1y, cornerRadius], [p2x, p2y, cornerRadius], [p3x, p3y, cornerRadius]];
        }
    }
    // --- End Point Calculation ---
    return buildShape(points);
}


// === Text Measurement Utilities ===

let canvasContext: CanvasRenderingContext2D | null = null;
/**
 * Measures the width of a text string using the 2D Canvas API.
 * Caches the canvas context for efficiency. Provides a rough fallback if canvas is unavailable.
 * @param text The text string to measure.
 * @param font The CSS font string (e.g., "bold 16px Arial").
 * @returns The measured width in pixels, or a fallback estimate if canvas fails.
 */
export function getTextWidth(text: string, font: string): number {
    // Initialize canvas context if not already done
    if (!canvasContext) {
        // Try-catch block for environments where canvas might not be available (e.g., server-side rendering)
        try {
            // Feature detection: Check if document exists before creating canvas
            if (typeof document !== 'undefined' && document.createElement) {
                const canvas = document.createElement('canvas');
                canvasContext = canvas.getContext('2d');
                if (!canvasContext) {
                     console.warn("LCARS Card: Failed to get 2D context for text measurement. Using fallback.");
                }
            } else {
                 console.warn("LCARS Card: Cannot create canvas for text measurement (document not available). Using fallback.");
                 canvasContext = null; // Explicitly set to null
            }
        } catch (e) {
            console.error("LCARS Card: Error creating canvas context for text measurement.", e);
            canvasContext = null; // Ensure it's null if creation fails
        }
    }

    // Attempt measurement if context is available
    if (canvasContext) {
        canvasContext.font = font;
        try {
            const metrics = canvasContext.measureText(text);
            return metrics.width;
        } catch (e) {
             console.error(`LCARS Card: Error measuring text width for font "${font}".`, e);
             // Fall through to fallback if measureText fails
        }
    }

    // Fallback estimation if canvas context is unavailable or measurement failed
    console.warn(`LCARS Card: Using fallback text width estimation for font "${font}".`);
    // Basic fallback: estimate width based on character count and font size (assumes ~0.6 width-to-height ratio)
    const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)(?:px|pt|em|rem)/); // Try to extract font size
    const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16; // Default to 16px if size not found/parsed
    return text.length * fontSize * 0.6;
}

/**
 * Measures the bounding box of a rendered SVG text element using `getBBox()`.
 * @param element The SVGTextElement to measure.
 * @returns An object with `width` and `height`, or `null` if measurement fails, element is invalid, or not rendered.
 */
export function measureTextBBox(element: SVGTextElement | null): { width: number; height: number } | null {
    if (!element) {
        // console.warn("LCARS Card: measureTextBBox called with null element.");
        return null;
    }
    // Ensure the element is capable of BBox calculation and likely rendered
    if (typeof element.getBBox !== 'function' || !element.isConnected) {
         // console.warn("LCARS Card: Cannot measure BBox. Element is invalid or not connected:", element);
         return null;
    }

    try {
        const bbox = element.getBBox();
        // Basic validation: width and height should be non-negative numbers.
        // BBox might have 0 width/height for empty strings or sometimes when not fully rendered.
        if (bbox && typeof bbox.width === 'number' && typeof bbox.height === 'number' && bbox.width >= 0 && bbox.height >= 0) {
            return { width: bbox.width, height: bbox.height };
        } else {
            // console.warn("LCARS Card: getBBox returned invalid dimensions:", bbox, "for element:", element);
            return null; // Return null for invalid BBox results
        }
    } catch (e) {
        // Errors commonly occur if the element is not rendered (e.g., display: none) or in certain browser states.
        // console.error("LCARS Card: Error calling getBBox for text element:", element, e);
        return null;
    }
}

/**
 * Calculates a target bar height likely to visually align with the cap height of adjacent text,
 * based on the text's measured BBox height and the estimated CAP_HEIGHT_RATIO.
 * @param measuredTextHeight The height returned by `measureTextBBox`.
 * @returns The calculated height for an associated bar element, or 0 if input is invalid.
 */
export function calculateDynamicBarHeight(measuredTextHeight: number): number {
    if (measuredTextHeight <= 0) {
        // console.warn("LCARS Card: calculateDynamicBarHeight called with invalid height:", measuredTextHeight);
        return 0; // Handle invalid or zero height input
    }
    return measuredTextHeight * CAP_HEIGHT_RATIO;
}

/**
 * Gets detailed font metrics (ascent, descent, cap height, x-height, baseline, etc.) for a given font.
 * @param fontFamily The font family to measure (e.g., 'Roboto').
 * @param fontWeight The font weight (e.g., 'normal', 'bold', 400, 700).
 * @param fontSize The font size in px (number or string, e.g., 16 or '16px').
 * @param origin The origin for normalization (default: 'baseline').
 * @returns The normalized font metrics object, or null if measurement fails.
 */
export function getFontMetrics({
  fontFamily,
  fontWeight = 'normal',
  fontSize = 200,
  origin = 'baseline',
}: {
  fontFamily: string;
  fontWeight?: string | number;
  fontSize?: number | string;
  origin?: string;
}): ReturnType<typeof FontMetrics> | null {
  try {
    // FontMetrics expects fontSize as a number (px)
    let size = typeof fontSize === 'string' ? parseFloat(fontSize) : fontSize;
    if (!size || isNaN(size)) size = 200;
    return FontMetrics({
      fontFamily,
      fontWeight: fontWeight as any,
      fontSize: size,
      origin,
    });
  } catch (e) {
    console.warn('LCARS Card: Failed to get font metrics for', fontFamily, e);
    return null;
  }
} 