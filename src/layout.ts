import {
    LcarsLayout,
    LcarsButtonConfig,
    TopHeaderLayout,
    MainHeaderLayout,
    ButtonLayout,
    FillerBarLayout,
    LogAreaLayout,
    ClockAreaLayout
} from './types';
import {
    DEFAULT_FILLER_BAR_HEIGHT_PX,
    BUTTON_HEIGHT_PX,
    VERTICAL_GAP_PX,
    TOP_HEADER_FONT_SIZE_PX,
    MAIN_HEADER_FONT_SIZE_PX,
    HORIZONTAL_GAP_PX,
    ELBOW_HORIZONTAL_WIDTH_PX,
    ELBOW_VERTICAL_WIDTH_PX,
    MAIN_HEADER_BUTTON_GAP_PX,
    CLOCK_AREA_LINE_HEIGHT_PX,
    LOG_AREA_TOP_MARGIN_PX,
    MAX_LOG_MESSAGES,
    LOG_LINE_HEIGHT_PX,
    SVG_HEIGHT_BUFFER_PX,
    DEFAULT_BUTTONS,
    MIN_BAR_WIDTH_PX
} from './constants';
import {
    calculateDynamicBarHeight
} from './utils/shapes';
import { calculateMainHeaderLayout } from './layout/main-header-layout';
import { calculateTopHeaderLayout } from './layout/top-header-layout';
import { calculateVerticalButtonsLayout } from './layout/vertical-buttons-layout';
import { calculateFillerBarLayout } from './layout/filler-bar-layout';
import { calculateClockAreaLayout } from './layout/clock-area-layout';
import {
    RectangleElement,
    TextElement,
    EndcapElement
} from './layout/layout-elements';

/**
 * Calculates layout for headers, buttons, filler, log area, and clock based on measured text dimensions.
 */
export function calculateLayout(
    containerWidth: number,
    availableHeight: number | null,
    buttonsConfig: LcarsButtonConfig[] | undefined,
    // --- Text Content --- Required for width measurement
    topLeftText: string,
    topRightText: string,
    mainText: string,
    // --- Measured Dimensions --- Required from Pass 1
    measuredTopLeftTextDims: { width: number; height: number } | null,
    measuredTopRightTextDims: { width: number; height: number } | null,
    measuredMainTextDims: { width: number; height: number } | null,
    // --- Fallback/Styling Info ---
    fontsLoaded: boolean // Could potentially remove if measurements guarantee font load
): LcarsLayout | null { // Return null if critical measurements are missing
    const currentButtons = buttonsConfig || DEFAULT_BUTTONS;
    const vGap = VERTICAL_GAP_PX;
    const hGap = HORIZONTAL_GAP_PX;

    // --- Guard Clause: Check for missing measurements ---
    if (!measuredTopLeftTextDims || !measuredTopRightTextDims || !measuredMainTextDims || containerWidth <= 0) {
        return null; // Indicate layout failure
    }

    // --- Calculate Top Header FIRST --- 
    const calculatedTopHeader = calculateTopHeaderLayout({
        view: 'home',
        containerWidth: containerWidth,
        topLeftText: topLeftText,
        topRightText: topRightText,
        measuredTopLeftTextWidth: measuredTopLeftTextDims?.width ?? 0,
        measuredTopRightTextWidth: measuredTopRightTextDims?.width ?? 0,
        measuredTopLeftTextHeight: measuredTopLeftTextDims?.height ?? 0,
        measuredTopRightTextHeight: measuredTopRightTextDims?.height ?? 0,
    });

    // --- Guard Clause for Top Header Calculation Failure ---
    if (!calculatedTopHeader) {
        console.error("LCARS Card (Home Layout): Failed to calculate top header layout.");
        return null; // Propagate layout failure
    }
    const topHeaderLayout = calculatedTopHeader;
    const topHeaderAreaHeight = topHeaderLayout.height + vGap;

    // --- Calculate Main Header SECOND (depends on top header height) --- 
    const calculatedMainHeader = calculateMainHeaderLayout({
        view: 'home',
        containerWidth: containerWidth,
        hGap: hGap,
        minBarWidth: MIN_BAR_WIDTH_PX,
        topHeaderAreaHeight: topHeaderAreaHeight, // Pass calculated area height
        measuredMainTextDims: measuredMainTextDims, // Pass measured dims directly
        mainText: mainText
    });

    // --- Guard Clause for Main Header Calculation Failure ---
    if (!calculatedMainHeader) {
        console.error("LCARS Card (Home Layout): Failed to calculate main header layout.");
        return null; // Propagate layout failure
    }
    // Type assertion is safe here due to the check above and view type
    const mainHeaderLayout = calculatedMainHeader as MainHeaderLayout;

    // --- Initial Layout Structure ---
    // Create placeholder elements first
    const placeholderFill = 'var(--secondary)'; // Define fill color
    const placeholderEndcap = new EndcapElement({ height: topHeaderLayout.height, fill: placeholderFill }); // Use calculated height
    const placeholderRect = new RectangleElement({ height: topHeaderLayout.height, fill: placeholderFill }); // Use calculated height

    const layout: LcarsLayout = {
        containerWidth: containerWidth,
        totalSvgHeight: 500, // Recalculate later
        topHeader: topHeaderLayout,
        mainHeader: mainHeaderLayout,
        buttons: [] as ButtonLayout[],
        fillerBar: { x: 0, y: 0, width: ELBOW_VERTICAL_WIDTH_PX, height: DEFAULT_FILLER_BAR_HEIGHT_PX, bottomY: 0 },
        logArea: { x: 0, y: 0, bottomY: 0, textAnchor: 'end' as const },
        clockArea: { x: 0, y: 0, timeY_abs: 0, dateY_abs: 0 }
    };

    // --- Vertical Buttons Calculation ---
    const { buttons: calculatedButtons, nextAvailableY: fillerBarStartY } = 
        calculateVerticalButtonsLayout({
            mainHeaderLayout: mainHeaderLayout,
            buttonsConfig: buttonsConfig, // Pass original config
            // Pass other constants if needed, or rely on defaults in function
            vGap: vGap, 
            hGap: hGap
        });
    layout.buttons = calculatedButtons;

    // --- Filler Bar Calculation (Position Only Initially) ---
    layout.fillerBar.y = fillerBarStartY;
    // Height and bottomY calculated after total height determination

    // --- Log Area Calculation (Repositioned) ---
    layout.logArea.x = containerWidth - hGap; // Position X to the far right
    layout.logArea.textAnchor = 'end'; // Anchor text to the end (right)
    // Position Y below the main header bar + 12px gap
    layout.logArea.y = layout.mainHeader.y + layout.mainHeader.height + 12;
    layout.logArea.bottomY = layout.logArea.y + MAX_LOG_MESSAGES * LOG_LINE_HEIGHT_PX;

    // --- Clock Area Calculation (Placeholder X/Y initially) ---
    layout.clockArea.x = 0; // Calculated later
    layout.clockArea.y = 0; // Calculated later (represents bottom anchor)
    layout.clockArea.timeY_abs = 0; // Calculated later
    layout.clockArea.dateY_abs = 0; // Calculated later

    // --- Total Height and Filler Bar Height Calculation ---
    const heightAboveFiller = layout.fillerBar.y;
    // Calculate the lowest point needed *below* the filler bar's top position
    // This is now only determined by the log area, as clock moves to bottom
    const heightNeededForLogsBelowFillerTop = Math.max(0, layout.logArea.bottomY - heightAboveFiller);

    if (availableHeight && availableHeight > 0) {
        // Minimum height needs space above filler + logs below filler top + some minimal filler + buffer
        const minimumContentHeight = heightAboveFiller + heightNeededForLogsBelowFillerTop + 10 + SVG_HEIGHT_BUFFER_PX; // Added 10px minimal filler
        const availableForFiller = availableHeight - heightAboveFiller - heightNeededForLogsBelowFillerTop - SVG_HEIGHT_BUFFER_PX;

        if (availableHeight >= minimumContentHeight) {
            // Use available space for filler
            layout.fillerBar.height = Math.max(0, availableForFiller);
            layout.totalSvgHeight = availableHeight;
        } else {
            // Not enough space, use default filler and let content define height
            layout.fillerBar.height = DEFAULT_FILLER_BAR_HEIGHT_PX;
            layout.totalSvgHeight = heightAboveFiller + layout.fillerBar.height + heightNeededForLogsBelowFillerTop + SVG_HEIGHT_BUFFER_PX;
        }
    } else {
        // No available height provided, calculate based on content
        layout.fillerBar.height = DEFAULT_FILLER_BAR_HEIGHT_PX;
        layout.totalSvgHeight = heightAboveFiller + layout.fillerBar.height + heightNeededForLogsBelowFillerTop + SVG_HEIGHT_BUFFER_PX;
    }

    // --- Update filler bar bottom ---
    layout.fillerBar.bottomY = layout.fillerBar.y + layout.fillerBar.height;

    // --- Final Clock Area Calculation ---
    layout.clockArea = calculateClockAreaLayout({
        fillerBarLayout: layout.fillerBar,
        totalSvgHeight: layout.totalSvgHeight
    });

    // --- REMOVE OLD Clock Area Calculation Logic ---
    /*
    layout.clockArea.x = layout.fillerBar.x + layout.fillerBar.width + 12; // Right of filler bar + 12px gap
    layout.clockArea.y = layout.totalSvgHeight - SVG_HEIGHT_BUFFER_PX; // Bottom anchor Y
    // Calculate absolute Y positions for text baselines (bottom-aligned)
    layout.clockArea.timeY_abs = layout.clockArea.y - CLOCK_AREA_LINE_HEIGHT_PX; // Time is one line above date
    layout.clockArea.dateY_abs = layout.clockArea.y; // Date aligns with the bottom anchor Y

    // --- Final check on total height --- ensure it accommodates the lowest point
    // The lowest point is effectively determined by the clock's baseline Y position.
    // We already set totalSvgHeight considering this (or availableHeight).
    // We might need to ensure it *also* covers the log bottom, though unlikely to be lower now.
    const lowestContentPoint = Math.max(
        layout.logArea.bottomY, 
        layout.fillerBar.bottomY 
    );
    layout.totalSvgHeight = Math.max(layout.totalSvgHeight, lowestContentPoint + SVG_HEIGHT_BUFFER_PX);
    // Recalculate clock Y *after* final height determination.
    layout.clockArea.y = layout.totalSvgHeight - SVG_HEIGHT_BUFFER_PX; 
    layout.clockArea.timeY_abs = layout.clockArea.y - CLOCK_AREA_LINE_HEIGHT_PX;
    layout.clockArea.dateY_abs = layout.clockArea.y;
    */

    return layout;
} 