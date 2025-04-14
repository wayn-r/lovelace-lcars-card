import {
    TopHeaderLayout
} from '../types';
import {
    TOP_HEADER_FONT_SIZE_PX,
    HORIZONTAL_GAP_PX
} from '../constants';
import {
    calculateDynamicBarHeight
} from '../utils/shapes';
import {
    RectangleElement,
    EndcapElement
} from './layout-elements';

// --- Option Interfaces ---
interface HomeTopHeaderOptions {
    view: 'home';
    containerWidth: number;
    topLeftText: string; // Text content is needed for measurement
    topRightText: string;
    measuredTopLeftTextWidth: number;
    measuredTopRightTextWidth: number;
    measuredTopLeftTextHeight: number;
    measuredTopRightTextHeight: number;
}

interface ShipMapTopHeaderOptions {
    view: 'shipMap';
    containerWidth: number;
    // Pass the existing layout from which to derive dimensions
    existingTopHeader: TopHeaderLayout;
}

type CalculateTopHeaderOptions = HomeTopHeaderOptions | ShipMapTopHeaderOptions;

// --- Constants --- 
const hGap = HORIZONTAL_GAP_PX;
const topHeaderFill = 'var(--secondary)'; // Define fill color globally for this component

/**
 * Calculates the layout for the top header bar, adapting based on view type.
 */
export function calculateTopHeaderLayout(
    options: CalculateTopHeaderOptions
): TopHeaderLayout | null {
    let topHeaderHeight: number;
    let textLeftWidth: number;
    let textRightWidth: number;
    const containerWidth = options.containerWidth;

    // --- Determine Dimensions based on View ---
    if (options.view === 'home') {
        // --- Home View: Calculate from measurements --- 
        const { 
            measuredTopLeftTextWidth,
            measuredTopRightTextWidth,
            measuredTopLeftTextHeight,
            measuredTopRightTextHeight
        } = options;

        // Guard Clause
        if (!measuredTopLeftTextWidth || !measuredTopRightTextWidth || containerWidth <= 0 || measuredTopLeftTextHeight <= 0 || measuredTopRightTextHeight <= 0) {
            console.warn("LCARS Card (TopHeaderLayout - Home): Invalid dimensions provided.", options);
            return null; 
        }
        topHeaderHeight = calculateDynamicBarHeight(Math.max(measuredTopLeftTextHeight, measuredTopRightTextHeight));
        textLeftWidth = measuredTopLeftTextWidth;
        textRightWidth = measuredTopRightTextWidth;

    } else if (options.view === 'shipMap') {
        // --- ShipMap View: Use existing layout for height/text widths --- 
        const { existingTopHeader } = options;
        if (!existingTopHeader) {
            console.warn("LCARS Card (TopHeaderLayout - ShipMap): Existing top header layout is required but missing.");
            return null;
        }
        topHeaderHeight = existingTopHeader.height;
        // Use text widths stored in the existing layout object
        textLeftWidth = existingTopHeader.textLeftWidth;
        textRightWidth = existingTopHeader.textRightWidth;
        
        // Basic validation
        if (topHeaderHeight <= 0 || containerWidth <= 0) {
             console.warn("LCARS Card (TopHeaderLayout - ShipMap): Invalid dimensions derived from existing layout.", options);
             return null;
        }

    } else {
        // Should not happen with TypeScript
        console.error("LCARS Card (TopHeaderLayout): Invalid view type provided.");
        const _exhaustiveCheck: never = options;
        return null;
    }

    // --- Calculate Shared Geometry (using determined dimensions) --- 
    const leftEndcapWidth = topHeaderHeight; // Width matches height for square end
    const rightEndcapWidth = topHeaderHeight;
    const rightEndcapX = containerWidth - rightEndcapWidth;
    const textLeftX = leftEndcapWidth + hGap; // Anchor start
    const textRightX = rightEndcapX - hGap; // Anchor end
    const middleRectX = textLeftX + textLeftWidth + hGap; // Bar starts after text + gap
    const topMiddleEndX = textRightX - textRightWidth - hGap; // Bar ends before text + gap
    const middleRectWidth = Math.max(0, topMiddleEndX - middleRectX);

    // --- Create New Element Instances (always create new ones) --- 
    const leftEndcap = new EndcapElement({
        x: 0, y: 0, width: leftEndcapWidth, height: topHeaderHeight, direction: 'left', fill: topHeaderFill
    });
    const middleRect = new RectangleElement({
        x: middleRectX, y: 0, width: middleRectWidth, height: topHeaderHeight, cornerRadius: 0, fill: topHeaderFill
    });
    const rightEndcap = new EndcapElement({
        x: rightEndcapX, y: 0, width: rightEndcapWidth, height: topHeaderHeight, direction: 'right', fill: topHeaderFill
    });

    // --- Assemble Layout Object --- 
    const topHeaderLayout: TopHeaderLayout = {
        y: 0, // Top header is always at Y=0
        height: topHeaderHeight,
        fontSize: TOP_HEADER_FONT_SIZE_PX, // Keep for styling reference
        textLeftX: textLeftX,
        textLeftY: topHeaderHeight / 2, // Center in scaled height
        textLeftWidth: textLeftWidth, // Use determined width
        textRightX: textRightX,
        textRightY: topHeaderHeight / 2, // Center in scaled height
        textRightWidth: textRightWidth, // Use determined width
        leftEndcap: leftEndcap,
        middleRect: middleRect,
        rightEndcap: rightEndcap
    };

    return topHeaderLayout;
} 