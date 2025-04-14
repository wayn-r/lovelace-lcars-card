import {
    FillerBarLayout
} from '../types';
import {
    ELBOW_VERTICAL_WIDTH_PX,
    DEFAULT_FILLER_BAR_HEIGHT_PX,
    SVG_HEIGHT_BUFFER_PX
} from '../constants';

interface FillerBarOptions {
    startY: number; // Y position where the filler bar starts
    availableHeight: number | null; // Height constraint from container
    logAreaBottomY: number; // Bottom position of the log area
    containerWidth: number; // Needed?
    buttonColumnWidth?: number; // Width of the element it sits below (usually buttons)
}

/**
 * Calculates the final height and position of the filler bar based on available space 
 * and the position of other elements (like the log area).
 * Also determines the necessary total SVG height.
 */
export function calculateFillerBarLayout(
    options: FillerBarOptions
): {
    fillerBar: FillerBarLayout;
    totalSvgHeight: number;
} {
    const {
        startY,
        availableHeight,
        logAreaBottomY,
        buttonColumnWidth = ELBOW_VERTICAL_WIDTH_PX // Default to elbow width
    } = options;

    let finalFillerBarHeight: number;
    let finalTotalSvgHeight: number;

    const heightAboveFiller = startY;
    // Calculate the lowest point needed *below* the filler bar's top position.
    // This is primarily determined by the log area in the Home layout.
    const heightNeededForLogsBelowFillerTop = Math.max(0, logAreaBottomY - heightAboveFiller);
    
    const minimalFillerHeight = DEFAULT_FILLER_BAR_HEIGHT_PX; // Use default as minimum

    if (availableHeight && availableHeight > 0) {
        // Minimum height needs space above filler + logs below filler top + minimal filler + buffer
        const minimumContentHeight = heightAboveFiller + heightNeededForLogsBelowFillerTop + minimalFillerHeight + SVG_HEIGHT_BUFFER_PX;
        const spaceAvailableForFiller = availableHeight - heightAboveFiller - heightNeededForLogsBelowFillerTop - SVG_HEIGHT_BUFFER_PX;

        if (availableHeight >= minimumContentHeight) {
            // Use available space for filler, but not less than minimum
            finalFillerBarHeight = Math.max(minimalFillerHeight, spaceAvailableForFiller);
            finalTotalSvgHeight = availableHeight;
        } else {
            // Not enough space, use minimal filler and let content define height
            finalFillerBarHeight = minimalFillerHeight;
            finalTotalSvgHeight = heightAboveFiller + finalFillerBarHeight + heightNeededForLogsBelowFillerTop + SVG_HEIGHT_BUFFER_PX;
        }
    } else {
        // No available height provided, calculate based on content
        finalFillerBarHeight = minimalFillerHeight;
        finalTotalSvgHeight = heightAboveFiller + finalFillerBarHeight + heightNeededForLogsBelowFillerTop + SVG_HEIGHT_BUFFER_PX;
    }

    // Ensure total height covers the lowest point if logs push it down
    // (This check might be slightly redundant given the logic above, but safe)
    const lowestContentPoint = Math.max(logAreaBottomY, startY + finalFillerBarHeight);
    finalTotalSvgHeight = Math.max(finalTotalSvgHeight, lowestContentPoint + SVG_HEIGHT_BUFFER_PX);

    // Assemble the filler bar layout object
    const fillerBar: FillerBarLayout = {
        x: 0, // Filler bar always starts at x=0
        y: startY,
        width: buttonColumnWidth, // Use the width of the column above it
        height: finalFillerBarHeight,
        bottomY: startY + finalFillerBarHeight
    };

    return {
        fillerBar,
        totalSvgHeight: finalTotalSvgHeight
    };
} 