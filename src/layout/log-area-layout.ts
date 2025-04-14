import {
    LogAreaLayout,
    ShipMapMainHeaderLayout // For Y and height reference
} from '../types';
import {
    HORIZONTAL_GAP_PX,
    MAX_LOG_MESSAGES,
    LOG_LINE_HEIGHT_PX
} from '../constants';

interface LogAreaOptions {
    containerWidth: number;
    mainHeaderLayout: ShipMapMainHeaderLayout;
    hGap?: number;
    logAreaTopMargin?: number; // Optional override for gap below main header
}

/**
 * Calculates the layout for the Log Area in the ShipMap view.
 */
export function calculateLogAreaLayout(
    options: LogAreaOptions
): LogAreaLayout {
    const { 
        containerWidth, 
        mainHeaderLayout,
        hGap = HORIZONTAL_GAP_PX,
        logAreaTopMargin = 12 // Default margin from original layout
    } = options;

    const logAreaX = containerWidth - hGap; // Position X to the far right
    const logAreaY = mainHeaderLayout.y + mainHeaderLayout.height + logAreaTopMargin;
    const logAreaBottomY = logAreaY + MAX_LOG_MESSAGES * LOG_LINE_HEIGHT_PX;
    const textAnchor = 'end'; // Anchor text to the end (right)

    const logAreaLayout: LogAreaLayout = {
        x: logAreaX,
        y: logAreaY,
        bottomY: logAreaBottomY,
        textAnchor: textAnchor
    };

    return logAreaLayout;
} 