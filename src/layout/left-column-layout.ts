import {
    ShipMapLeftCornerLayout,
    ShipMapMainHeaderLayout
} from '../types';
import {
    RectangleElement,
    ElbowElement
} from './layout-elements';
import { MIN_BAR_WIDTH_PX } from '../constants';

interface LeftColumnOptions {
    leftCornerLayout: ShipMapLeftCornerLayout;
    mainHeaderLayout: ShipMapMainHeaderLayout;
    targetX: number; // Reference X for main elbow start
    hGap: number;
    minBarWidth?: number; // Allow override, default from constants
    // Add overrides for fills if needed
    rect1Fill?: string;
    rect2Fill?: string;
    rect3Fill?: string;
    elbowFill?: string;
}

/**
 * Calculates the layout for the left column rectangles and the 
 * small left header elbow in the ShipMap view.
 */
export function calculateLeftColumnLayout(
    options: LeftColumnOptions
): {
    leftColumnRects: RectangleElement[];
    leftHeaderElbow: ElbowElement;
} | null {
    const {
        leftCornerLayout,
        mainHeaderLayout,
        targetX,
        hGap,
        minBarWidth = MIN_BAR_WIDTH_PX,
        rect1Fill = "#d34e03",
        rect2Fill = "#df8313",
        rect3Fill = "#ffec92",
        elbowFill = "#fff5c7"
    } = options;

    const rectY = mainHeaderLayout.y;
    const rectHeight = mainHeaderLayout.height;

    // --- Calculate positions of the first two fixed-width rectangles --- 
    const rect1X = leftCornerLayout.x + leftCornerLayout.width + hGap;
    const rect1Width = 5;
    const rect2X = rect1X + rect1Width + hGap;
    const rect2Width = 10;
    const rect2EndX = rect2X + rect2Width;

    // --- Calculate space available for rect3 and elbow --- 
    const availableSpaceStartX = rect2EndX + hGap;
    const mainElbowStartX = targetX; // Where the main header elbow visually starts
    const availableSpaceEndX = mainElbowStartX - hGap; // Leave gap before main elbow
    const totalAvailableWidth = Math.max(0, availableSpaceEndX - availableSpaceStartX);

    // --- Determine Elbow and Rect3 dimensions --- 
    // Desired elbow width (e.g., 1/3 of space up to targetX, or a fixed proportion)
    // Let's make it proportional to targetX for scalability.
    const desiredElbowWidth = Math.max(minBarWidth, targetX / 4); // Ensure minimum width
    
    // Calculate width needed for rect3 IF the elbow takes its desired width
    const widthNeededForRect3IfElbowIdeal = totalAvailableWidth - desiredElbowWidth - hGap; // Account for gap

    let finalRect3X: number;
    let finalRect3Width: number;
    let finalElbowX: number;
    let finalElbowWidth: number;

    if (widthNeededForRect3IfElbowIdeal >= minBarWidth) {
        // Ideal case: Elbow gets desired width, rect3 gets the rest (which is >= min)
        finalRect3Width = widthNeededForRect3IfElbowIdeal;
        finalElbowWidth = desiredElbowWidth; 
        finalRect3X = availableSpaceStartX;
        finalElbowX = finalRect3X + finalRect3Width + hGap; // Elbow starts after rect3 + gap
        // Ensure elbow doesn't exceed the available end boundary (respects gap)
        finalElbowWidth = Math.min(finalElbowWidth, availableSpaceEndX - finalElbowX);
        // Adjust rect3 width if elbow was capped
        finalRect3Width = Math.max(0, finalElbowX - hGap - finalRect3X);

    } else {
        // Rect3 would be too small (< minBarWidth) if elbow had desired width.
        // Give rect3 minimum width and let elbow take the rest.
        finalRect3Width = minBarWidth;
        finalRect3X = availableSpaceStartX;
        finalElbowX = finalRect3X + finalRect3Width + hGap;
        finalElbowWidth = Math.max(0, availableSpaceEndX - finalElbowX); 

        // If even giving rect3 minimum width makes the elbow too small (or zero), 
        // then remove rect3 entirely and let elbow fill the space.
        if (finalElbowWidth < minBarWidth) {
            finalRect3Width = 0;
            finalRect3X = availableSpaceStartX;
            finalElbowX = availableSpaceStartX;
            finalElbowWidth = totalAvailableWidth;
        }
    }

    // --- Create Rectangle Elements --- 
    const leftColumnRects = [
        new RectangleElement({ x: rect1X, y: rectY, width: rect1Width, height: rectHeight, fill: rect1Fill, cornerRadius: 0 }),
        new RectangleElement({ x: rect2X, y: rectY, width: rect2Width, height: rectHeight, fill: rect2Fill, cornerRadius: 0 }),
    ];
    // Only add rect3 if it has width
    if (finalRect3Width > 0) {
        leftColumnRects.push(
            new RectangleElement({ x: finalRect3X, y: rectY, width: finalRect3Width, height: rectHeight, fill: rect3Fill, cornerRadius: 0 })
        );
    }

    // --- Create Left Header Elbow Element --- 
    const leftHeaderElbowVerticalOpening = 15; 
    const leftHeaderElbowHeight = rectHeight; 
    const leftHeaderElbowTotalHeight = mainHeaderLayout.elbowTotalHeight; 
    let leftHeaderElbow: ElbowElement;

    if (finalElbowWidth > 0) {
        leftHeaderElbow = new ElbowElement({
            x: finalElbowX, 
            y: rectY, // Starts at the same Y as the column rects
            horizontalWidth: finalElbowWidth,
            verticalWidth: leftHeaderElbowVerticalOpening,
            headerHeight: leftHeaderElbowHeight, 
            totalElbowHeight: leftHeaderElbowTotalHeight, 
            orientation: 'top-right', // Connects to main header above
            fill: elbowFill 
        });
    } else {
        // Assign placeholder if width is zero (shouldn't happen with revised logic, but safe)
        console.warn("LCARS Card (LeftColumnLayout): Calculated zero width for left header elbow.");
        leftHeaderElbow = new ElbowElement({ fill: elbowFill }); 
    }

    return {
        leftColumnRects,
        leftHeaderElbow
    };
} 