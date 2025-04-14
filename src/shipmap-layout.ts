import {
    LcarsCardConfig,
    LcarsShipMapLayout,
    HomeLayoutContextForShipMap, // Import the new context type
    TopHeaderLayout,
    ShipMapMainHeaderLayout,
    ShipMapButtonOverlaysLayout,
    BottomHeaderLayout,
    LogAreaLayout,
    MapRectLayout,
    ShipMapClockLayout,
    ShipMapLeftCornerLayout
} from './types';
import * as C from './constants';
import { MIN_BAR_WIDTH_PX } from './constants'; // <-- Import MIN_BAR_WIDTH_PX
import { calculateDynamicBarHeight } from './utils/shapes';
import { abbreviateText } from './utils/text-format'; // Import abbreviateText
import { calculateMainHeaderLayout } from './layout/main-header-layout'; // <-- Import unified function
// Import the new top header calculator
import { calculateTopHeaderLayout } from './layout/top-header-layout';
// Import the new left corner calculator
import { calculateLeftCornerLayout } from './layout/left-corner-layout';
// Import the new left column calculator
import { calculateLeftColumnLayout } from './layout/left-column-layout';
// Import the new button overlays calculator
import { calculateButtonOverlaysLayout } from './layout/button-overlays-layout';
// Import the new bottom header calculator
import { calculateBottomHeaderLayout } from './layout/bottom-header-layout';
// Import the new log area calculator
import { calculateLogAreaLayout } from './layout/log-area-layout';
// --- Import Element Classes ---
import {
    RectangleElement,
    EndcapElement,
    ElbowElement,
    TriangleElement,
    TextElement // Needed for main header return type assertion
} from './layout/layout-elements';

/**
 * Calculates the static layout for the "shipMap" view.
 */
export function calculateShipMapLayout(
    containerWidth: number,
    availableHeight: number | null,
    config: LcarsCardConfig,
    homeContext: HomeLayoutContextForShipMap | null, // Use the new context type
    existingTopHeader: TopHeaderLayout | null, // Pass existing top header separately
    measuredBottomTextHeight: number | null,
    measuredBottomTextWidth: number | null,
    measuredClockTimeWidth: number | null,
    measuredClockTimeShortWidth: number | null,
    measuredMapTextWidth: number | null,
    measuredMapTextHeight: number | null
): LcarsShipMapLayout | null {

    // --- Guard Clauses ---
    if (containerWidth <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid containerWidth.");
        return null;
    }
    // Check the new context object and its properties
    if (!homeContext ||
        homeContext.mainHeaderHeight <= 0 ||
        homeContext.mainHeaderElbowTotalHeight <= 0 ||
        !homeContext.buttonGeometry ||
        homeContext.buttonGeometry.length < 7 || // Ensure enough button geometries exist
        !homeContext.buttonGeometry[0] || // Check specific required indices
        !homeContext.buttonGeometry[2] ||
        !homeContext.buttonGeometry[3] ||
        !homeContext.buttonGeometry[4] ||
        !homeContext.buttonGeometry[5] ||
        !homeContext.buttonGeometry[6])
    {
        console.warn("LCARS Card (ShipMap Layout): Invalid or incomplete homeContext provided.");
        return null;
    }
    if (!existingTopHeader) {
         console.warn("LCARS Card (ShipMap Layout): Existing top header layout is required.");
         return null;
    }
    if (!measuredBottomTextHeight || measuredBottomTextHeight <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredBottomTextHeight.");
        return null;
    }
    if (!measuredBottomTextWidth || measuredBottomTextWidth <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredBottomTextWidth.");
        return null;
    }
    if (!measuredClockTimeWidth || measuredClockTimeWidth <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredClockTimeWidth.");
        return null;
    }
    if (!measuredClockTimeShortWidth || measuredClockTimeShortWidth <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredClockTimeShortWidth.");
        return null;
    }
    if (!measuredMapTextWidth || measuredMapTextWidth <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredMapTextWidth.");
        return null;
    }
    if (!measuredMapTextHeight || measuredMapTextHeight <= 0) {
        console.warn("LCARS Card (ShipMap Layout): Invalid measuredMapTextHeight.");
        return null;
    }

    const vGap = C.VERTICAL_GAP_PX;
    const hGap = C.HORIZONTAL_GAP_PX;
    // Button geometry is now accessed via homeContext.buttonGeometry where needed
    const targetX = containerWidth / 3; // Reference point for main header elbow
    const mainHeaderBaseHeight = homeContext.mainHeaderHeight;
    // mainHeaderY is calculated within calculateMainHeaderLayout for shipMap view
    const mainHeaderElbowTotalHeight = homeContext.mainHeaderElbowTotalHeight; // Use context

    // --- Constants derived from animation/styles ---
    const mainHeaderAreaWidth = containerWidth - targetX;
    
    // Set vertical element widths to 1/4 of main header width
    const verticalElementWidth = Math.max(10, Math.round(mainHeaderAreaWidth / 4));
    const finalLeftElbowVerticalWidth = verticalElementWidth; // Use the same proportional width for consistency
    const mainElbowHorizontalWidth = verticalElementWidth + 30; // 30px wider than vertical opening
    const mapElbowHorizontalWidth = verticalElementWidth + 30; // 30px wider than vertical opening
    const mapElbowVerticalWidth = verticalElementWidth; // Use proportional width instead of fixed 12px
    const mapOverlayRectWidth = verticalElementWidth; // Use proportional width instead of fixed 12px

    // Total height will be calculated after main header and log area Y are determined
    let calculatedTotalSvgHeight = 500; // Initial default/fallback
    // --- Initial Layout Structure ---
    // Create placeholder elements
    const placeholderElbow = new ElbowElement({});
    const placeholderEndcap = new EndcapElement({});
    const layout: LcarsShipMapLayout = {
        containerWidth: containerWidth,
        totalSvgHeight: calculatedTotalSvgHeight, // Use calculated height
        topHeader: {} as TopHeaderLayout,
        mainHeader: {} as ShipMapMainHeaderLayout,
        buttonOverlays: {} as ShipMapButtonOverlaysLayout,
        bottomHeader: { // Initialize with placeholders
            bottomElbow: placeholderElbow,
            endcap: placeholderEndcap,
        } as BottomHeaderLayout,
        logArea: {} as LogAreaLayout,
        clock: {} as ShipMapClockLayout, // Initialize clock layout
        leftCorner: { // Initialize with placeholder
            cornerTriangle: new TriangleElement({})
        } as ShipMapLeftCornerLayout,
        leftColumnRects: [], // Initialize left column rects array
        leftHeaderElbow: placeholderElbow, // Initialize with placeholder
        displayClockFormat: 'none', // Default to none
        useAbbreviatedText: false // Default to false
    };

    // --- Top Header Calculation --- 
    const calculatedTopHeader = calculateTopHeaderLayout({
        view: 'shipMap',
        containerWidth: containerWidth,
        existingTopHeader: existingTopHeader // Use the passed parameter
    });
    if (!calculatedTopHeader) {
        console.error("LCARS Card (ShipMap Layout): Failed to calculate top header layout.");
        return null; 
    }
    layout.topHeader = calculatedTopHeader;

    // --- Main Header Calculation (MUST be before components depending on its Y/Height) ---
    const mainHeaderLayoutResult = calculateMainHeaderLayout({
        view: 'shipMap',
        containerWidth: containerWidth,
        hGap: hGap,
        minBarWidth: MIN_BAR_WIDTH_PX,
        homeContext: homeContext, // Pass the new context object
        measuredMapTextWidth: measuredMapTextWidth,
        measuredMapTextHeight: measuredMapTextHeight,
        targetX: targetX,
        verticalElementWidth: verticalElementWidth,
        mainElbowHorizontalWidth: mainElbowHorizontalWidth,
        finalLeftElbowVerticalWidth: finalLeftElbowVerticalWidth,
        mapElbowHorizontalWidth: mapElbowHorizontalWidth,
        mapElbowVerticalWidth: mapElbowVerticalWidth,
        mapOverlayRectWidth: mapOverlayRectWidth,
        vGap: vGap,
        topHeaderAreaHeight: existingTopHeader.y + existingTopHeader.height + vGap // Pass calculated top header area height
    });
    if (!mainHeaderLayoutResult) {
        console.error("LCARS Card (ShipMap Layout): Failed to calculate main header layout.");
        return null;
    }
    layout.mainHeader = mainHeaderLayoutResult as ShipMapMainHeaderLayout;

    // --- Calculate Log Area Y Position (Now that mainHeader.y is available) ---
    const logAreaY = layout.mainHeader.y + mainHeaderBaseHeight + 12;
    const logAreaBottomY = logAreaY + C.MAX_LOG_MESSAGES * C.LOG_LINE_HEIGHT_PX;

    // --- Determine/Update Total Height NOW ---
    // Needed for bottom anchor elements like Bottom Header
    if (availableHeight && availableHeight > 0) {
        // Ensure available height is enough for logs
        calculatedTotalSvgHeight = Math.max(availableHeight, logAreaBottomY + C.SVG_HEIGHT_BUFFER_PX);
    } else {
        // Base height on log area if no height constraint
        calculatedTotalSvgHeight = logAreaBottomY + C.SVG_HEIGHT_BUFFER_PX;
    }
    layout.totalSvgHeight = calculatedTotalSvgHeight; // Update layout height

    // --- Button Overlays Calculation --- 
    const calculatedButtonOverlays = calculateButtonOverlaysLayout({
        homeContext: homeContext, // Pass the new context object
        mainHeaderLayout: layout.mainHeader, // Now uses calculated main header
        verticalElementWidth: verticalElementWidth, 
        targetX: targetX,
        vGap: vGap
    });
    if (!calculatedButtonOverlays) {
        console.error("LCARS Card (ShipMap Layout): Failed to calculate button overlays layout.");
        return null; 
    }
    layout.buttonOverlays = calculatedButtonOverlays;

    // --- Bottom Header & Clock Calculation --- 
    const bottomResult = calculateBottomHeaderLayout({
        containerWidth: containerWidth,
        totalSvgHeight: layout.totalSvgHeight,
        config: config,
        targetX: targetX,
        verticalElementWidth: verticalElementWidth,
        vGap: vGap,
        hGap: hGap,
        minBarWidth: MIN_BAR_WIDTH_PX,
        mainHeaderLayout: layout.mainHeader, // Uses calculated main header
        buttonOverlaysLayout: layout.buttonOverlays,
        measuredBottomTextHeight: measuredBottomTextHeight,
        measuredBottomTextWidth: measuredBottomTextWidth,
        measuredClockTimeWidth: measuredClockTimeWidth,
        measuredClockTimeShortWidth: measuredClockTimeShortWidth
    });
    if (!bottomResult) {
        console.error("LCARS Card (ShipMap Layout): Failed to calculate bottom header layout.");
        return null; 
    }
    layout.bottomHeader = bottomResult.bottomHeader;
    layout.clock = bottomResult.clock;
    layout.displayClockFormat = bottomResult.displayClockFormat;
    layout.useAbbreviatedText = bottomResult.useAbbreviatedText;

    // --- Log Area Calculation --- 
    layout.logArea = calculateLogAreaLayout({
        containerWidth: containerWidth,
        mainHeaderLayout: layout.mainHeader, // Uses calculated main header
        hGap: hGap
    });

    // --- Left Corner Calculation --- 
    layout.leftCorner = calculateLeftCornerLayout({
        mainHeaderLayout: layout.mainHeader // Uses calculated main header
    });

    // --- Left Column Calculation --- 
    const leftColumnResult = calculateLeftColumnLayout({
        leftCornerLayout: layout.leftCorner,
        mainHeaderLayout: layout.mainHeader, // Uses calculated main header
        targetX: targetX,
        hGap: hGap,
        minBarWidth: MIN_BAR_WIDTH_PX
    });
    if (!leftColumnResult) {
        console.error("LCARS Card (ShipMap Layout): Failed to calculate left column layout.");
        return null; 
    }
    layout.leftColumnRects = leftColumnResult.leftColumnRects;
    layout.leftHeaderElbow = leftColumnResult.leftHeaderElbow;

    return layout;
} 