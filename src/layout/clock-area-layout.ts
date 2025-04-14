import {
    ClockAreaLayout,
    FillerBarLayout
} from '../types';
import {
    SVG_HEIGHT_BUFFER_PX,
    CLOCK_AREA_LINE_HEIGHT_PX
} from '../constants';

interface ClockAreaOptions {
    fillerBarLayout: FillerBarLayout;
    totalSvgHeight: number;
    gapAfterFiller?: number; // Optional override for gap
}

/**
 * Calculates the layout for the Clock Area (Time/Date) in the Home view.
 */
export function calculateClockAreaLayout(
    options: ClockAreaOptions
): ClockAreaLayout {
    const {
        fillerBarLayout,
        totalSvgHeight,
        gapAfterFiller = 12 // Default gap from original layout
    } = options;

    const clockAreaX = fillerBarLayout.x + fillerBarLayout.width + gapAfterFiller;
    const clockAreaBottomY = totalSvgHeight - SVG_HEIGHT_BUFFER_PX; // Bottom anchor Y

    // Calculate absolute Y positions for text baselines (bottom-aligned)
    const timeY_abs = clockAreaBottomY - CLOCK_AREA_LINE_HEIGHT_PX; // Time is one line above date
    const dateY_abs = clockAreaBottomY; // Date aligns with the bottom anchor Y

    const clockAreaLayout: ClockAreaLayout = {
        x: clockAreaX,
        y: clockAreaBottomY, // Use bottom Y for group vertical anchor
        timeY_abs: timeY_abs,
        dateY_abs: dateY_abs
        // Optional style properties can be added here if needed later
    };

    return clockAreaLayout;
} 