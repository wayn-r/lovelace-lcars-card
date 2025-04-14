import { Orientation, Direction } from '../utils/shapes'; // Added import
// Import necessary path generation functions
import {
    generateRectanglePath,
    generateElbowPath,
    generateEndcapPath,
    generateChiselEndcapPath,
    generateTrianglePath
} from '../utils/shapes';

/**
 * Abstract base class for all visual layout elements.
 */
export abstract class Shape {
    fill: string;
    // Could add stroke, strokeWidth etc. here if needed universally

    protected constructor(props: Partial<Shape> = {}) {
        // Default fill can be overridden by subclasses if needed
        this.fill = props.fill ?? '#000'; 
    }

    getPathD(): string {
        // This method should be implemented in subclasses
        throw new Error("getPathD() method not implemented in abstract Shape class");
    }
}

/**
 * Base class for layout elements that are simple rectangles.
 */
export class RectangleElement extends Shape {
    x: number;
    y: number;
    width: number;
    height: number;
    cornerRadius: number; // Added cornerRadius
    // fill is inherited from Shape

    constructor(props: Partial<RectangleElement> = {}) {
        super(props); // Call Shape constructor for fill
        this.x = props.x ?? 0;
        this.y = props.y ?? 0;
        this.width = props.width ?? 0;
        this.height = props.height ?? 0;
        this.cornerRadius = props.cornerRadius ?? 0; // Initialize cornerRadius
        // Allow overriding fill specifically for rectangles if needed
        if (props.fill !== undefined) this.fill = props.fill;
    }

    getPathD(): string {
        return generateRectanglePath(this.x, this.y, this.width, this.height, this.cornerRadius);
    }
}

/**
 * Base class for text elements.
 */
export class TextElement extends Shape { // Text can also be considered a shape with a fill
    x: number;
    y: number;
    text: string;
    fontSize: number;
    // fill is inherited from Shape
    textAnchor: string;
    dominantBaseline: string;
    calculatedWidth: number;

    constructor(props: Partial<TextElement> = {}) {
        super(props); // Call Shape constructor for fill (default white for text?)
        this.x = props.x ?? 0;
        this.y = props.y ?? 0;
        this.text = props.text ?? '';
        this.fontSize = props.fontSize ?? 16;
        this.textAnchor = props.textAnchor ?? 'middle';
        this.dominantBaseline = props.dominantBaseline ?? 'central';
        this.calculatedWidth = props.calculatedWidth ?? 0;
        // Override default Shape fill if needed, e.g., default to white for text
        this.fill = props.fill ?? '#fff'; 
    }

    // Note: Text elements don't typically have a pathD in the same way shapes do.
    // If a background path were needed, a method could be added here.
}

/**
 * Element for a chisel-style endcap shape.
 */
export class ChiselEndcapElement extends Shape {
    x: number;
    y: number;
    width: number;
    height: number;
    side: 'right'; // Currently only 'right' is supported by generator
    topCornerRadius: number;
    bottomCornerRadius: number;

    constructor(props: Partial<ChiselEndcapElement> = {}) {
        super(props);
        this.x = props.x ?? 0;
        this.y = props.y ?? 0;
        this.width = props.width ?? 0;
        this.height = props.height ?? 0;
        this.side = props.side ?? 'right';
        this.topCornerRadius = props.topCornerRadius ?? 0;
        this.bottomCornerRadius = props.bottomCornerRadius ?? 0;
        if (props.fill !== undefined) this.fill = props.fill;
    }

    getPathD(): string {
        return generateChiselEndcapPath(this.width, this.height, this.side, this.x, this.y, this.topCornerRadius, this.bottomCornerRadius);
    }
}

/**
 * Element for an elbow shape.
 */
export class ElbowElement extends Shape {
    x: number;
    y: number;
    horizontalWidth: number;
    verticalWidth: number;
    headerHeight: number;
    totalElbowHeight: number;
    orientation: Orientation;
    outerCornerRadius: number;

    constructor(props: Partial<ElbowElement> = {}) {
        super(props);
        this.x = props.x ?? 0;
        this.y = props.y ?? 0;
        this.horizontalWidth = props.horizontalWidth ?? 0;
        this.verticalWidth = props.verticalWidth ?? 0;
        this.headerHeight = props.headerHeight ?? 0;
        this.totalElbowHeight = props.totalElbowHeight ?? 0;
        this.orientation = props.orientation ?? 'top-right'; // Default orientation
        // Default outerCornerRadius to headerHeight as in generator, handle props override
        this.outerCornerRadius = props.outerCornerRadius ?? (props.headerHeight ?? 0); 
        if (props.fill !== undefined) this.fill = props.fill;
    }

    getPathD(): string {
        return generateElbowPath(this.x, this.horizontalWidth, this.verticalWidth, this.headerHeight, this.totalElbowHeight, this.orientation, this.y, this.outerCornerRadius);
    }
}

/**
 * Element for a rounded endcap shape.
 */
export class EndcapElement extends Shape {
    x: number;
    y: number;
    width: number;
    height: number;
    direction: Direction;

    constructor(props: Partial<EndcapElement> = {}) {
        super(props);
        this.x = props.x ?? 0;
        this.y = props.y ?? 0;
        this.width = props.width ?? 0;
        this.height = props.height ?? 0;
        this.direction = props.direction ?? 'right'; // Default direction
        if (props.fill !== undefined) this.fill = props.fill;
    }

    getPathD(): string {
        return generateEndcapPath(this.width, this.height, this.direction, this.x, this.y);
    }
}

/**
 * Element for an equilateral triangle shape.
 */
export class TriangleElement extends Shape {
    centerX: number;
    centerY: number;
    sideLength: number;
    direction: Direction;
    cornerRadius: number;

    constructor(props: Partial<TriangleElement> = {}) {
        super(props);
        this.centerX = props.centerX ?? 0;
        this.centerY = props.centerY ?? 0;
        this.sideLength = props.sideLength ?? 0;
        this.direction = props.direction ?? 'right'; // Default direction
        this.cornerRadius = props.cornerRadius ?? 0;
        if (props.fill !== undefined) this.fill = props.fill;
    }

    getPathD(): string {
        return generateTrianglePath(this.sideLength, this.direction, this.centerX, this.centerY, this.cornerRadius);
    }
}
