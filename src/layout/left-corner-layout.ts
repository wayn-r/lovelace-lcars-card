import {
    ShipMapLeftCornerLayout,
    ShipMapMainHeaderLayout // Needed for Y and height reference
} from '../types';
import {
    TriangleElement
} from './layout-elements';

interface LeftCornerOptions {
    mainHeaderLayout: ShipMapMainHeaderLayout;
    // Add overrides if needed, e.g., for fills
    cornerFill?: string;
    triangleFill?: string;
}

/**
 * Calculates the layout for the Left Corner element in the ShipMap view 
 * (square with inner triangle).
 */
export function calculateLeftCornerLayout(
    options: LeftCornerOptions
): ShipMapLeftCornerLayout {
    const { 
        mainHeaderLayout,
        cornerFill = "#ffd300", // Default color
        triangleFill = "#000000" // Default color
    } = options;

    const mainHeaderY = mainHeaderLayout.y;
    const mainHeaderBaseHeight = mainHeaderLayout.height;

    // Corner is a square based on main header height
    const leftCornerHeight = mainHeaderBaseHeight;
    const leftCornerWidth = leftCornerHeight; 
    const rectX = 0;
    const rectY = mainHeaderY;

    // Calculate equilateral triangle within the square
    const trianglePadding = leftCornerWidth * 0.2; // 20% padding
    const triangleAvailableSize = Math.min(leftCornerWidth, leftCornerHeight) - (2 * trianglePadding);
    const triangleSide = triangleAvailableSize;
    const triangleCornerRadius = 2; // Define corner radius

    // Calculate center point of the square for translation
    const triangleCenterX = rectX + leftCornerWidth / 2;
    const triangleCenterY = rectY + leftCornerHeight / 2;

    // Create the triangle element
    const cornerTriangle = new TriangleElement({
        centerX: triangleCenterX,
        centerY: triangleCenterY,
        sideLength: triangleSide,
        direction: 'left', // Point left
        cornerRadius: triangleCornerRadius,
        fill: triangleFill
    });

    // Assemble the layout object
    const leftCornerLayout: ShipMapLeftCornerLayout = {
        x: rectX,
        y: rectY,
        width: leftCornerWidth,
        height: leftCornerHeight,
        fill: cornerFill,
        cornerTriangle: cornerTriangle
    };

    return leftCornerLayout;
} 