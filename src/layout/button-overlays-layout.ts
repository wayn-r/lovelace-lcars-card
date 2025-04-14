import {
    ShipMapButtonOverlaysLayout,
    MapRectLayout,
    HomeLayoutContextForShipMap, // Import new context type
    ShipMapMainHeaderLayout // ShipMap Main header
} from '../types';
import {
    VERTICAL_GAP_PX
} from '../constants';

interface ButtonOverlaysOptions {
    homeContext: HomeLayoutContextForShipMap; // Use context type
    mainHeaderLayout: ShipMapMainHeaderLayout;
    verticalElementWidth: number; // Width of the overlay bars
    targetX: number; // Reference X for positioning
    vGap?: number; // Allow override
}

/**
 * Calculates the layout for the Button Overlay rectangles in the ShipMap view.
 */
export function calculateButtonOverlaysLayout(
    options: ButtonOverlaysOptions
): ShipMapButtonOverlaysLayout | null {
    const {
        homeContext, // Use context
        mainHeaderLayout,
        verticalElementWidth,
        targetX,
        vGap = VERTICAL_GAP_PX
    } = options;

    // Need buttons from home layout for height calculations
    // Need button geometry from home context for height calculations
    if (!homeContext.buttonGeometry || homeContext.buttonGeometry.length < 7 ||
        !homeContext.buttonGeometry[0] || !homeContext.buttonGeometry[2] ||
        !homeContext.buttonGeometry[3] || !homeContext.buttonGeometry[4] ||
        !homeContext.buttonGeometry[5] || !homeContext.buttonGeometry[6]) {
        console.warn("LCARS Card (ButtonOverlaysLayout): Invalid or incomplete homeContext buttonGeometry provided.");
        return null;
    }
    // Use buttonGeometry directly, adding non-null assertions based on the check above

    // Base layout definitions from original calculation
    const baseLayout = [
        { height: (homeContext.buttonGeometry[2]!.y + homeContext.buttonGeometry[2]!.height) - homeContext.buttonGeometry[0]!.y, fill: '#7e7961' },
        { height: (homeContext.buttonGeometry[4]!.y + homeContext.buttonGeometry[4]!.height) - homeContext.buttonGeometry[3]!.y, fill: '#312f27' },
        { height: (homeContext.buttonGeometry[6]!.y + homeContext.buttonGeometry[6]!.height) - homeContext.buttonGeometry[5]!.y, fill: '#ffec93' } // Note: Only need fill from last one
    ];
    const lastBaseFill = baseLayout[2].fill;

    // Calculate dimensions based on verticalElementWidth and button heights
    const newWidth = verticalElementWidth;
    const topHeightReductionPercent = 0.4;
    const topHeightReduction = baseLayout[0].height * topHeightReductionPercent;
    const newTopHeight = baseLayout[0].height - topHeightReduction;
    const newMidHeight = baseLayout[1].height + topHeightReduction;
    // Bottom two rects are half the height of the 6th button
    const newBottomHeight = homeContext.buttonGeometry[5]!.height / 2;

    // Calculate Y positions relative to the main header elbow + gap
    // Use mainHeaderLayout.elbowTotalHeight which includes the vertical extension
    const newTopY = mainHeaderLayout.elbowTotalHeight + vGap; 
    const newMidY = newTopY + newTopHeight + vGap;
    const newBottomY = newMidY + newMidHeight + vGap;

    // Create the final rectangle layout objects
    const finalRects: MapRectLayout[] = [
        { x: 0, y: newTopY, width: newWidth, height: newTopHeight, fill: baseLayout[0].fill },
        { x: 0, y: newMidY, width: newWidth, height: newMidHeight, fill: baseLayout[1].fill },
        // Bottom two rects use the same fill
        { x: 0, y: newBottomY, width: newWidth, height: newBottomHeight, fill: lastBaseFill },
        { x: 0, y: newBottomY + newBottomHeight + vGap, width: newWidth, height: newBottomHeight, fill: lastBaseFill }
    ];

    // Assemble the layout object
    const buttonOverlaysLayout: ShipMapButtonOverlaysLayout = {
        // Group is transformed to the targetX and main header Y
        groupTransform: `translate(${targetX}, ${mainHeaderLayout.y})`,
        overlayRects: finalRects,
        lastOverlayFill: lastBaseFill,
        overlayWidth: newWidth
    };

    return buttonOverlaysLayout;
} 