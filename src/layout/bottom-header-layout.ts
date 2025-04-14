import {
    BottomHeaderLayout,
    ShipMapClockLayout,
    ShipMapMainHeaderLayout,
    ShipMapButtonOverlaysLayout,
    LcarsCardConfig // For text content
} from '../types';
import {
    calculateDynamicBarHeight
} from '../utils/shapes';
import {
    abbreviateText
} from '../utils/text-format';
import {
    ElbowElement,
    EndcapElement
} from './layout-elements';
import { MIN_BAR_WIDTH_PX } from '../constants';

interface BottomHeaderOptions {
    containerWidth: number;
    totalSvgHeight: number;
    config: LcarsCardConfig;
    targetX: number;
    verticalElementWidth: number;
    vGap: number;
    hGap: number;
    minBarWidth: number;
    mainHeaderLayout: ShipMapMainHeaderLayout;
    buttonOverlaysLayout: ShipMapButtonOverlaysLayout;
    measuredBottomTextHeight: number;
    measuredBottomTextWidth: number;
    measuredClockTimeWidth: number;
    measuredClockTimeShortWidth: number;
}

/**
 * Calculates the layout for the Bottom Header bar, bottom elbow, and associated clock
 * in the ShipMap view.
 */
export function calculateBottomHeaderLayout(
    options: BottomHeaderOptions
): {
    bottomHeader: BottomHeaderLayout;
    clock: ShipMapClockLayout;
    displayClockFormat: 'full' | 'short' | 'none';
    useAbbreviatedText: boolean;
} | null {

    const {
        containerWidth,
        totalSvgHeight,
        config,
        targetX,
        verticalElementWidth,
        vGap,
        hGap,
        minBarWidth,
        mainHeaderLayout,
        buttonOverlaysLayout,
        measuredBottomTextHeight,
        measuredBottomTextWidth,
        measuredClockTimeWidth,
        measuredClockTimeShortWidth
    } = options;

    // --- Calculate Bottom Elbow Dimensions --- 
    const bottomElbowX = targetX;
    const lastOverlayRect = buttonOverlaysLayout.overlayRects[3];
    const bottomElbowY = mainHeaderLayout.y + lastOverlayRect.y + lastOverlayRect.height + vGap;
    const bottomElbowVerticalWidth = verticalElementWidth; // Use proportional width
    const bottomElbowHorizontalWidth = verticalElementWidth + 30; // 30px wider
    const bottomElbowTotalHeight = Math.max(0, totalSvgHeight - bottomElbowY);
    const bottomElbowHeaderHeight = calculateDynamicBarHeight(measuredBottomTextHeight);
    const bottomElbowFill = "#ffec92"; // Elbow color
    let bottomElbow: ElbowElement;
    
    if (bottomElbowTotalHeight >= bottomElbowHeaderHeight && bottomElbowHorizontalWidth > 0 && bottomElbowVerticalWidth > 0) {
        bottomElbow = new ElbowElement({
            x: bottomElbowX,
            y: bottomElbowY,
            horizontalWidth: bottomElbowHorizontalWidth,
            verticalWidth: bottomElbowVerticalWidth,
            headerHeight: bottomElbowHeaderHeight,
            totalElbowHeight: bottomElbowTotalHeight,
            orientation: 'bottom-left',
            fill: bottomElbowFill
        });
    } else {
        // Create element even if dims invalid, but log warning
        bottomElbow = new ElbowElement({
            x: bottomElbowX,
            y: bottomElbowY,
            horizontalWidth: Math.max(0, bottomElbowHorizontalWidth),
            verticalWidth: Math.max(0, bottomElbowVerticalWidth),
            headerHeight: bottomElbowHeaderHeight,
            totalElbowHeight: bottomElbowTotalHeight,
            orientation: 'bottom-left',
            fill: bottomElbowFill
        });
        console.warn("LCARS Card (BottomHeaderLayout): Bottom elbow dimensions potentially invalid. H:", bottomElbowTotalHeight, "HeaderH:", bottomElbowHeaderHeight);
    }

    // --- Bottom Header Bar Calculation --- 
    const bottomHeaderBarHeight = bottomElbowHeaderHeight;
    const bottomHeaderBarY = totalSvgHeight - bottomHeaderBarHeight; // Anchor Y to bottom
    const bottomTextContentFull = config.ship_map_bottom_header_text || "MASTER SYSTEM DISPLAY";
    const bottomHeaderBarFill = "#ffe359"; // Bar color
    const bottomHeaderEndcapFill = buttonOverlaysLayout.lastOverlayFill; // Endcap uses overlay color

    const endcapWidth = bottomHeaderBarHeight; // Square endcap
    const endcapX = containerWidth - endcapWidth;
    const barAreaStartX = bottomElbowX + bottomElbowHorizontalWidth + hGap;

    // --- Define Helper Function for Bar/Text/Clock Fitting --- 
    const checkBars = (textWidth: number, clockWidth: number): { 
        fits: boolean, barL: number, barR: number, textEnd: number, textStart: number, centerX: number, barAreaEnd: number 
    } => {
        const clockAreaWidth = clockWidth > 0 ? clockWidth + hGap : 0;
        const barAreaEndX = endcapX - hGap - clockAreaWidth;
        const barAvailableSpace = Math.max(0, barAreaEndX - barAreaStartX);
        const centerPointX = barAreaStartX + barAvailableSpace / 2;
        const textStartX = centerPointX - textWidth / 2;
        const textEndX = centerPointX + textWidth / 2;
        const barL = Math.max(0, textStartX - hGap - barAreaStartX);
        const barR = Math.max(0, barAreaEndX - (textEndX + hGap));
        return { 
            fits: barL >= minBarWidth && barR >= minBarWidth,
            barL, 
            barR, 
            textEnd: textEndX,
            textStart: textStartX,
            centerX: centerPointX,
            barAreaEnd: barAreaEndX // Return end of bar area for positioning
        };
    };

    // --- Conditional Bottom Header & Clock Layout Logic --- 
    let finalBarLeftWidth = 0;
    let finalBarRightWidth = 0;
    let finalTextX = 0;
    let finalTextContent = bottomTextContentFull;
    let finalTextWidth = measuredBottomTextWidth;
    let finalClockX = 0;
    let finalClockY = bottomHeaderBarY + bottomHeaderBarHeight / 2;
    let clockWidthToUse = 0;
    let finalDisplayClockFormat: 'full' | 'short' | 'none' = 'none';
    let finalUseAbbreviatedText = false;

    // 1. Try Full Layout (Full Text, Full Clock)
    let result = checkBars(measuredBottomTextWidth, measuredClockTimeWidth);
    if (result.fits) {
        finalDisplayClockFormat = 'full';
        finalUseAbbreviatedText = false;
        finalBarLeftWidth = result.barL;
        finalBarRightWidth = result.barR;
        finalTextX = result.textEnd; // textEnd is anchor 'end'
        finalTextContent = bottomTextContentFull;
        finalTextWidth = measuredBottomTextWidth;
        clockWidthToUse = measuredClockTimeWidth;
        finalClockX = result.barAreaEnd + hGap; // Clock starts after bar area + gap
    } else {
        // 2. Try Short Clock (Full Text, Short Clock)
        result = checkBars(measuredBottomTextWidth, measuredClockTimeShortWidth);
        if (result.fits) {
            finalDisplayClockFormat = 'short';
            finalUseAbbreviatedText = false;
            finalBarLeftWidth = result.barL;
            finalBarRightWidth = result.barR;
            finalTextX = result.textEnd;
            finalTextContent = bottomTextContentFull;
            finalTextWidth = measuredBottomTextWidth;
            clockWidthToUse = measuredClockTimeShortWidth;
            finalClockX = result.barAreaEnd + hGap;
        } else {
            // 3. Try No Clock (Full Text, No Clock)
            result = checkBars(measuredBottomTextWidth, 0); // clockWidth = 0
            if (result.fits) {
                finalDisplayClockFormat = 'none';
                finalUseAbbreviatedText = false;
                finalBarLeftWidth = result.barL;
                finalBarRightWidth = result.barR;
                finalTextX = result.textEnd;
                finalTextContent = bottomTextContentFull;
                finalTextWidth = measuredBottomTextWidth;
                clockWidthToUse = 0;
                finalClockX = 0; // No clock X needed
            } else {
                // 4. Abbreviate Text (Abbreviated Text, No Clock)
                const abbreviatedText = abbreviateText(bottomTextContentFull);
                // Calculate abbreviated width based on ratio
                const abbreviatedRatio = abbreviatedText.length / bottomTextContentFull.length;
                const estimatedAbbreviatedWidth = measuredBottomTextWidth * abbreviatedRatio;
                
                result = checkBars(estimatedAbbreviatedWidth, 0);
                
                if (result.fits && abbreviatedText !== bottomTextContentFull) { // Check if abbreviation occurred
                    finalDisplayClockFormat = 'none';
                    finalUseAbbreviatedText = true;
                    finalTextContent = abbreviatedText;
                    finalTextWidth = estimatedAbbreviatedWidth;
                    finalBarLeftWidth = result.barL;
                    finalBarRightWidth = result.barR;
                    finalTextX = result.textEnd;
                    clockWidthToUse = 0;
                    finalClockX = 0;
                } else {
                    // Even abbreviated text doesn't fit OR text wasn't abbreviated
                    finalDisplayClockFormat = 'none';
                    finalUseAbbreviatedText = true; // Mark as abbreviated (hidden)
                    finalTextContent = ''; // Set empty text
                    finalTextWidth = 0; // Set zero width
                    clockWidthToUse = 0;
                    finalClockX = 0;
                    // Bars fill the whole space if no text and no clock
                    const barAreaEndX_noClock = endcapX - hGap; 
                    const barAvailableSpace_noClock = Math.max(0, barAreaEndX_noClock - barAreaStartX);
                    finalBarLeftWidth = barAvailableSpace_noClock;
                    finalBarRightWidth = 0; // No right bar needed
                }
            }
        }
    }

    // --- Assign Final Bottom Header & Clock Values --- 
    const finalBarLeftX = barAreaStartX;
    // Right bar starts after text + gap
    const finalBarRightX = finalTextX + hGap; 
    // Note: finalBarRightWidth was already correctly set by checkBars results in all fitting cases.
    // If text is empty, finalBarRightWidth was set to 0.

    // Create final Endcap
    const finalEndcap = new EndcapElement({
         x: endcapX, 
         y: bottomHeaderBarY,
         width: endcapWidth, 
         height: bottomHeaderBarHeight,
         direction: 'right', 
         fill: bottomHeaderEndcapFill 
    });

    // Assemble layout objects
    const bottomHeader: BottomHeaderLayout = {
        barLeftX: finalBarLeftX,
        barLeftWidth: finalBarLeftWidth,
        barRightX: finalBarRightX,
        barRightWidth: finalBarRightWidth,
        barY: bottomHeaderBarY,
        barHeight: bottomHeaderBarHeight,
        fillColor: bottomHeaderBarFill,
        endcap: finalEndcap,
        textX: finalTextX, // Anchor is 'end'
        textY: bottomHeaderBarY + bottomHeaderBarHeight / 2, // Vertically centered
        textContent: finalTextContent,
        textWidth: finalTextWidth,
        textHeight: measuredBottomTextHeight,
        bottomElbow: bottomElbow // Assign the calculated elbow
    };

    const clock: ShipMapClockLayout = { 
        // Position clock anchor 'end' at the finalClockX position
        timeX: finalClockX, 
        timeY: finalClockY
    };

    return {
        bottomHeader,
        clock,
        displayClockFormat: finalDisplayClockFormat,
        useAbbreviatedText: finalUseAbbreviatedText
    };
} 