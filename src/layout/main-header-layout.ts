import {
    MainHeaderLayout,
    ShipMapMainHeaderLayout,
    LcarsLayout, // Keep for Home view calculation
    HomeLayoutContextForShipMap // Import the new context type
} from '../types';
import {
    MAIN_HEADER_FONT_SIZE_PX,
    ELBOW_HORIZONTAL_WIDTH_PX,
    ELBOW_VERTICAL_WIDTH_PX,
} from '../constants';
import { calculateDynamicBarHeight } from '../utils/shapes';
import { abbreviateText } from '../utils/text-format';

// --- Import Element Classes ---
import {
    RectangleElement,
    TextElement,
    ElbowElement,
    EndcapElement,
    ChiselEndcapElement
} from './layout-elements';

// --- Unified Options Interface ---
interface BaseMainHeaderOptions {
    containerWidth: number;
    hGap: number;
    minBarWidth: number;
}

interface HomeMainHeaderOptions extends BaseMainHeaderOptions {
    topHeaderAreaHeight: number; // Y position depends on top header
    measuredMainTextDims: { width: number; height: number };
    mainText: string;
    // fontsLoaded: boolean; // Likely not needed if relying on measured dims
}

interface ShipMapMainHeaderOptions extends BaseMainHeaderOptions {
    homeContext: HomeLayoutContextForShipMap; // Use the new context type
    measuredMapTextWidth: number;
    measuredMapTextHeight: number;
    targetX: number; // Reference X point
    verticalElementWidth: number; // Calculated outside, passed in
    mainElbowHorizontalWidth: number; // Calculated outside
    finalLeftElbowVerticalWidth: number; // Calculated outside
    mapElbowHorizontalWidth: number; // Calculated outside
    mapElbowVerticalWidth: number; // Calculated outside
    mapOverlayRectWidth: number; // Calculated outside
    vGap: number;
    topHeaderAreaHeight: number; // Needed for absolute Y positioning
}

// Type definition for the factory function options
type CalculateMainHeaderOptions =
    | ({ view: 'home' } & HomeMainHeaderOptions)
    | ({ view: 'shipMap' } & ShipMapMainHeaderOptions);

// --- Helper Function for Text Layout within a Bar ---
interface AlignedTextLayout {
    textX: number; // Final X position (anchor depends on usage)
    textWidth: number; // Final text width (0 if hidden)
    textContent: string; // Final text content
    useAbbreviatedText: boolean;
    bar1Width: number; // Width of the bar segment BEFORE text
    bar2X: number; // Start X of the bar segment AFTER text
    bar2Width: number; // Width of the bar segment AFTER text
    textFits: boolean; // Whether any text could be displayed
}

function calculateAlignedTextInBar(
    availableSpaceStartX: number,
    availableSpaceEndX: number,
    fullText: string,
    measuredTextWidth: number,
    minBarWidth: number,
    hGap: number,
    allowAbbreviation: boolean = true // Default to allowing abbreviation
): AlignedTextLayout {

    const availableMainTextSpace = Math.max(0, availableSpaceEndX - availableSpaceStartX);
    const result: AlignedTextLayout = {
        textX: 0,
        textWidth: 0,
        textContent: '',
        useAbbreviatedText: false,
        bar1Width: 0,
        bar2X: 0,
        bar2Width: 0,
        textFits: false
    };

    // Calculate space available purely for text (subtracting gaps and min bar widths)
    const textAreaWidth = availableMainTextSpace - (2 * minBarWidth) - (2 * hGap);

    let textToUse = fullText;
    let widthToUse = measuredTextWidth;
    let useAbbreviation = false;

    if (textAreaWidth < widthToUse) {
        // Text doesn't fit, try abbreviating (if allowed)
        if (allowAbbreviation) {
            const abbreviatedText = abbreviateText(textToUse);
            if (abbreviatedText !== textToUse) {
                const abbreviatedRatio = abbreviatedText.length / textToUse.length;
                const estimatedAbbreviatedWidth = widthToUse * abbreviatedRatio;
                if (textAreaWidth >= estimatedAbbreviatedWidth) {
                    // Abbreviated fits
                    textToUse = abbreviatedText;
                    widthToUse = estimatedAbbreviatedWidth;
                    useAbbreviation = true;
                    result.textFits = true;
                } else {
                    // Even abbreviated doesn't fit
                    textToUse = '';
                    widthToUse = 0;
                    useAbbreviation = true; // Mark as 'abbreviated' (hidden)
                    result.textFits = false;
                }
            } else {
                 // Could not abbreviate, but still doesn't fit
                 textToUse = '';
                 widthToUse = 0;
                 useAbbreviation = true; // Mark as 'abbreviated' (hidden)
                 result.textFits = false;
            }
        } else {
            // Abbreviation not allowed, and text doesn't fit
            textToUse = '';
            widthToUse = 0;
            useAbbreviation = false; // Not technically abbreviated, just hidden
            result.textFits = false;
        }
    } else {
        // Full text fits
        result.textFits = true;
    }

    result.textContent = textToUse;
    result.textWidth = widthToUse;
    result.useAbbreviatedText = useAbbreviation;

    // Calculate positions based on the final text width
    if (result.textFits) {
        // Calculate text position (centered within the space remaining AFTER min bars)
        const centerSpaceStartX = availableSpaceStartX + minBarWidth + hGap;
        const centerSpaceEndX = availableSpaceEndX - minBarWidth - hGap;
        const centerAvailableSpace = Math.max(0, centerSpaceEndX - centerSpaceStartX);
        const textCenterPointX = centerSpaceStartX + centerAvailableSpace / 2;
        
        // NOTE: Returning CENTER X. Caller must adjust for text-anchor: end if needed.
        result.textX = textCenterPointX; 

        const textActualStartX = textCenterPointX - widthToUse / 2;
        const textActualEndX = textCenterPointX + widthToUse / 2;

        // Calculate actual bar widths
        result.bar1Width = Math.max(0, textActualStartX - hGap - availableSpaceStartX);
        result.bar2X = textActualEndX + hGap;
        result.bar2Width = Math.max(0, availableSpaceEndX - result.bar2X);

        // Final check: If calculated bars are too small, hide text and make bar1 fill space
        if (result.bar1Width < minBarWidth || result.bar2Width < minBarWidth) {
            result.textContent = '';
            result.textWidth = 0;
            result.useAbbreviatedText = true; // Mark as 'abbreviated' (hidden)
            result.textFits = false;
            result.bar1Width = availableMainTextSpace; // Bar1 fills entire space
            result.bar2Width = 0;
            result.bar2X = availableSpaceEndX; // Bar2 starts at the end
        }

    } else {
        // Text does not fit at all, make bar1 fill the entire available space
        result.bar1Width = availableMainTextSpace;
        result.bar2Width = 0;
        result.bar2X = availableSpaceEndX; // Bar2 starts at the end (effectively non-existent)
    }

    return result;
}

// --- Base Calculator Class ---
abstract class MainHeaderLayoutCalculator {
    protected containerWidth: number;
    protected hGap: number;
    protected minBarWidth: number;

    // TODO: Define fill constants/source properly within subclasses or pass them in
    protected homeLeftElbowFill = 'var(--primary)';
    protected homeMiddleRect1Fill = 'var(--secondaryBright)';
    protected homeRightEndcapFill = 'var(--secondaryBright)';
    protected homeTextFill = 'var(--primaryBright)';

    protected shipMapLeftElbowFill = '#ffec93';
    protected shipMapMiddleRect1Fill = '#fee457';
    protected shipMapRightEndcapFill = '#ffec93';
    protected shipMapMapRightElbowFill = 'var(--secondaryBrighter)';
    protected shipMapMapLeftRectFill = this.shipMapMapRightElbowFill; // Use same fill
    protected shipMapMapTextFill = '#da9a4d'; // Updated color from #000
    protected shipMapMiddleRect2Fill = '#fee457';

    constructor(options: BaseMainHeaderOptions) {
        this.containerWidth = options.containerWidth;
        this.hGap = options.hGap;
        this.minBarWidth = options.minBarWidth;
    }

    abstract calculate(): MainHeaderLayout | ShipMapMainHeaderLayout | null;
}

// --- Home View Calculator ---
class HomeMainHeaderLayoutCalculator extends MainHeaderLayoutCalculator {
    private topHeaderAreaHeight: number;
    private measuredMainTextDims: { width: number; height: number };
    private mainText: string;

    constructor(options: HomeMainHeaderOptions) {
        super(options); // Call base constructor
        this.topHeaderAreaHeight = options.topHeaderAreaHeight;
        this.measuredMainTextDims = options.measuredMainTextDims;
        this.mainText = options.mainText;
    }

    calculate(): MainHeaderLayout | null {
        // Basic dimensions
        const mainHeaderHeight = calculateDynamicBarHeight(this.measuredMainTextDims.height);
        const elbowExtensionHeight = mainHeaderHeight;
        const mainHeaderElbowTotalHeight = mainHeaderHeight + elbowExtensionHeight;
        const mainWidth = this.measuredMainTextDims.width;

        // Calculate text and bar layout using helper
        const mainTextSpaceStartX = ELBOW_HORIZONTAL_WIDTH_PX + this.hGap;
        const initialEndcapWidth = mainHeaderHeight; // Minimum width for the endcap
        const mainTextSpaceEndX = this.containerWidth - initialEndcapWidth - this.hGap;

        const textLayoutResult = calculateAlignedTextInBar(
            mainTextSpaceStartX,
            mainTextSpaceEndX,
            this.mainText,
            mainWidth,
            this.minBarWidth,
            this.hGap,
            true // Allow abbreviation
        );

        // Determine middleRect1 width and final endcap position
        let middleRect1Width: number;
        let endcapStartX: number;
        let finalEndcapX: number; // Use let for later assignment
        let finalEndcapWidth: number; // Use let for later assignment

        if (textLayoutResult.textFits) {
            // Text fits. middleRect1 takes width before text.
            middleRect1Width = textLayoutResult.bar1Width;
            // Endcap starts where bar2 would have started.
            endcapStartX = textLayoutResult.bar2X;
        } else {
            // Text doesn't fit (or bars were too small). 
            // middleRect1 fills the entire available space.
            middleRect1Width = textLayoutResult.bar1Width; // bar1Width is the full available space here
            // Endcap starts after middleRect1 + gap.
            const bar1EndX = mainTextSpaceStartX + middleRect1Width;
            endcapStartX = bar1EndX + this.hGap;
        }

        // Calculate final endcap width and X position
        // Ensure minimum width for the endcap
        finalEndcapWidth = Math.max(initialEndcapWidth, this.containerWidth - endcapStartX);
        finalEndcapX = this.containerWidth - finalEndcapWidth;
        
        // Optional Safeguard: Ensure endcap doesn't start before middleRect1 ends + gap
        // This might be needed if container is extremely narrow
        // endcapStartX = Math.max(endcapStartX, mainTextSpaceStartX + middleRect1Width + this.hGap);
        // finalEndcapX = Math.max(finalEndcapX, endcapStartX);
        // finalEndcapWidth = this.containerWidth - finalEndcapX;

        // Create instances of the specific element classes
        const leftElbow = new ElbowElement({
            x: 0,
            y: 0, // Relative Y
            horizontalWidth: ELBOW_HORIZONTAL_WIDTH_PX,
            verticalWidth: ELBOW_VERTICAL_WIDTH_PX,
            headerHeight: mainHeaderHeight,
            totalElbowHeight: mainHeaderElbowTotalHeight,
            orientation: 'top-left',
            fill: this.homeLeftElbowFill
        });

        const middleRect1 = new RectangleElement({
            x: mainTextSpaceStartX,
            y: 0, // Relative Y
            width: middleRect1Width, // Use calculated width
            height: mainHeaderHeight,
            cornerRadius: 0,
            fill: this.homeMiddleRect1Fill
        });

        // Text Element (created whether it fits or not, content might be empty)
        const text = new TextElement({
            x: textLayoutResult.textX, // Center X from helper
            y: mainHeaderHeight / 2, // Relative Y
            text: textLayoutResult.textContent,
            fontSize: MAIN_HEADER_FONT_SIZE_PX,
            calculatedWidth: textLayoutResult.textWidth,
            textAnchor: 'middle',
            dominantBaseline: 'central',
            fill: this.homeTextFill
        });

        // Right Endcap Element
        const rightEndcap = new EndcapElement({
            x: finalEndcapX,
            y: 0, // Relative Y
            width: finalEndcapWidth,
            height: mainHeaderHeight,
            direction: 'right',
            fill: this.homeRightEndcapFill
        });

        // Construct the final layout object using element instances & metadata
        const mainHeaderLayout: MainHeaderLayout = {
            y: this.topHeaderAreaHeight, // Absolute Y position
            height: mainHeaderHeight,
            elbowTotalHeight: mainHeaderElbowTotalHeight,
            leftElbow: leftElbow,
            middleRect1: middleRect1,
            rightEndcap: rightEndcap, // Add the endcap object
            rightEndcapX: finalEndcapX, // Add position metadata
            rightEndcapWidth: finalEndcapWidth, // Add width metadata
            text: text,
            useAbbreviatedText: textLayoutResult.useAbbreviatedText
        };

        return mainHeaderLayout;
    }
}

// --- ShipMap View Calculator ---
class ShipMapMainHeaderLayoutCalculator extends MainHeaderLayoutCalculator {
    private homeContext: HomeLayoutContextForShipMap; // Use context type
    private measuredMapTextWidth: number;
    private measuredMapTextHeight: number;
    private targetX: number;
    private verticalElementWidth: number;
    private mainElbowHorizontalWidth: number;
    private finalLeftElbowVerticalWidth: number;
    private mapElbowHorizontalWidth: number;
    private mapElbowVerticalWidth: number;
    private mapOverlayRectWidth: number;
    private vGap: number;
    private topHeaderAreaHeight: number; // Store top header height
    private mapTextContent: string; // Added to hold map text

    constructor(options: ShipMapMainHeaderOptions & { mapTextContent?: string }) { // Allow passing map text
        super(options);
        this.homeContext = options.homeContext; // Assign context
        this.measuredMapTextWidth = options.measuredMapTextWidth;
        this.measuredMapTextHeight = options.measuredMapTextHeight;
        this.targetX = options.targetX;
        this.verticalElementWidth = options.verticalElementWidth;
        this.mainElbowHorizontalWidth = options.mainElbowHorizontalWidth;
        this.finalLeftElbowVerticalWidth = options.finalLeftElbowVerticalWidth;
        this.mapElbowHorizontalWidth = options.mapElbowHorizontalWidth;
        this.mapElbowVerticalWidth = options.mapElbowVerticalWidth;
        this.mapOverlayRectWidth = options.mapOverlayRectWidth;
        this.vGap = options.vGap;
        this.topHeaderAreaHeight = options.topHeaderAreaHeight; // Assign top header height
        // TODO: Get map text from config or state properly
        this.mapTextContent = options.mapTextContent || "MAP"; 
    }

    calculate(): ShipMapMainHeaderLayout | null {
         // Context is already validated in the calling function (calculateShipMapLayout)
         // but we can add a basic check here too if desired.
         if (!this.homeContext) {
              console.error("LCARS Card (ShipMap Header Calc): Home context data is required but missing.");
              return null;
         }
         if (this.measuredMapTextWidth === null || this.measuredMapTextHeight === null) {
              console.error("LCARS Card (ShipMap Header Calc): Measured map text dimensions are required but missing.");
              return null;
         }

        // Basic dimensions from home layout or calculations
        const mainHeaderBaseHeight = this.homeContext.mainHeaderHeight; // Use context
        const mainHeaderElbowTotalHeight = this.homeContext.mainHeaderElbowTotalHeight; // Use context
        const mapElbowHeaderHeight = mainHeaderBaseHeight; // Assuming same height as main header bar
        // TODO: Define how mapElbowTotalHeight relates to other elements.
        // Using mainHeaderElbowTotalHeight as a placeholder assumption. Needs verification.
        const mapElbowTotalHeight = mainHeaderElbowTotalHeight; 


        // Calculate text layout for Map Text
        // Start after the main left elbow finishes horizontally
        const mainHeaderBarAreaStartX = this.targetX + this.mainElbowHorizontalWidth + this.hGap;
        const mainHeaderEndcapWidth = mainHeaderBaseHeight * 1.5; // Chisel endcap width
        const mainHeaderEndcapX = this.containerWidth - mainHeaderEndcapWidth;
        const mainHeaderBarAreaEndX = mainHeaderEndcapX - this.hGap;

        const textLayoutResult = calculateAlignedTextInBar(
            mainHeaderBarAreaStartX,
            mainHeaderBarAreaEndX,
            this.mapTextContent, // Use stored map text
            this.measuredMapTextWidth,
            this.minBarWidth,
            this.hGap,
            false // Don't allow abbreviation for map text
        );

        // Create Element Instances for ShipMap View
        const leftElbow = new ElbowElement({
            x: this.targetX, // Main elbow X position
            y: 0, // Relative Y
            horizontalWidth: this.mainElbowHorizontalWidth,
            verticalWidth: this.finalLeftElbowVerticalWidth, // Width coming from left column
            headerHeight: mainHeaderBaseHeight,
            totalElbowHeight: mainHeaderElbowTotalHeight,
            orientation: 'top-left', // Connects down/right visually
            fill: this.shipMapLeftElbowFill
        });

        const middleRect1 = new RectangleElement({
            x: mainHeaderBarAreaStartX,
            y: 0, // Relative Y
            width: textLayoutResult.bar1Width,
            height: mainHeaderBaseHeight,
            cornerRadius: 0,
            fill: this.shipMapMiddleRect1Fill
        });

        const mapText = new TextElement({
             // Adjust center X to end X for 'text-anchor: end'
            x: textLayoutResult.textX + textLayoutResult.textWidth / 2,
            y: mainHeaderBaseHeight / 2, // Relative Y
            text: textLayoutResult.textContent,
            fontSize: MAIN_HEADER_FONT_SIZE_PX,
            calculatedWidth: textLayoutResult.textWidth,
            textAnchor: 'end', // Anchor to the end (right)
            dominantBaseline: 'central',
            fill: this.shipMapMapTextFill
        });

        const middleRect2 = new RectangleElement({
            x: textLayoutResult.bar2X,
            y: 0, // Relative Y
            width: textLayoutResult.bar2Width,
            height: mainHeaderBaseHeight,
            cornerRadius: 0,
            fill: this.shipMapMiddleRect2Fill
        });

        const radius1 = mainHeaderBaseHeight * 0.15; // Top radius
        const radius2 = mainHeaderBaseHeight * 0.15; // Bottom radius

        // Ensure endcap doesn't overlap previous element if bars are small
        const actualEndcapX = Math.max(mainHeaderEndcapX, textLayoutResult.bar2X + textLayoutResult.bar2Width + this.hGap);
        const actualEndcapWidth = this.containerWidth - actualEndcapX;

        const rightEndcap = new ChiselEndcapElement({
            x: actualEndcapX,
            y: 0, // Relative Y
            width: actualEndcapWidth,
            height: mainHeaderBaseHeight,
            side: 'right',
            topCornerRadius: radius1,
            bottomCornerRadius: radius2,
            fill: this.shipMapRightEndcapFill
        });

        // Map Right Elbow (below main header, attached to main elbow visually)
        const finalMapRightElbowX = this.targetX; // Aligns with the main left elbow
        const mapRightElbow = new ElbowElement({
            x: finalMapRightElbowX,
            // Y starts below the main header bar + gap
            y: mainHeaderBaseHeight + this.vGap,
            horizontalWidth: this.mapElbowHorizontalWidth,
            verticalWidth: this.mapElbowVerticalWidth,
            headerHeight: mapElbowHeaderHeight, // Height of the horizontal part
            totalElbowHeight: mapElbowTotalHeight, // Total height including vertical extension
            orientation: 'bottom-right', // Connects up/left visually
            fill: this.shipMapMapRightElbowFill
        });

        // mapOverlayRects calculation (Rectangles aligned with mapRightElbow)
        // Base Y starts below the *entire* main header group (inc. elbow total height) + gap
        const mapOverlayBaseY = mainHeaderElbowTotalHeight + this.vGap;
        // X aligns with the *right* edge of the mapRightElbow's horizontal part
        const mapOverlayRectX = finalMapRightElbowX + this.mapElbowHorizontalWidth - this.mapOverlayRectWidth;
        // Check buttonGeometry from context
        if (!this.homeContext.buttonGeometry || this.homeContext.buttonGeometry.length < 5 ||
            !this.homeContext.buttonGeometry[0] || !this.homeContext.buttonGeometry[2] ||
            !this.homeContext.buttonGeometry[3] || !this.homeContext.buttonGeometry[4]) {
            console.warn("LCARS Card (ShipMap Header Calc): Insufficient button geometry data in context for map overlay.");
            return null;
        }
        // Use button dimensions from homeContext.buttonGeometry to determine overlay heights
        // Add non-null assertions (!) as we checked for existence above
        const mapOverlayBaseLayout = [
            { height: (this.homeContext.buttonGeometry[2]!.y + this.homeContext.buttonGeometry[2]!.height) - this.homeContext.buttonGeometry[0]!.y, fill: '#7e7961' },
            { height: (this.homeContext.buttonGeometry[4]!.y + this.homeContext.buttonGeometry[4]!.height) - this.homeContext.buttonGeometry[3]!.y, fill: '#312f27' }
        ];
        const mapOverlayTopHeightReductionPercent = 0.4;
        const mapOverlayTopHeightReduction = mapOverlayBaseLayout[0].height * mapOverlayTopHeightReductionPercent;
        const mapOverlayRectHeight1 = mapOverlayBaseLayout[0].height - mapOverlayTopHeightReduction;
        const mapOverlayRectHeight2 = mapOverlayBaseLayout[1].height + mapOverlayTopHeightReduction;

        const mapOverlayRects = [
            new RectangleElement({ x: mapOverlayRectX, y: mapOverlayBaseY, width: this.mapOverlayRectWidth, height: mapOverlayRectHeight1, fill: mapOverlayBaseLayout[0].fill, cornerRadius: 0 }),
            new RectangleElement({ x: mapOverlayRectX, y: mapOverlayBaseY + mapOverlayRectHeight1 + this.vGap, width: this.mapOverlayRectWidth, height: mapOverlayRectHeight2, fill: mapOverlayBaseLayout[1].fill, cornerRadius: 0 })
        ];

        // mapLeftRects calculation (Rectangles to the left of the main elbow)
        const mapLeftRectHeight = mainHeaderBaseHeight; // Same height as header bar
        const mapLeftRect4X = 0; // Furthest left rect starts at 0
        const mapLeftRect4Width = mapLeftRectHeight; // Square block
        const mapLeftRect3Width = 5; // Fixed width
        const mapLeftRect3X = mapLeftRect4X + mapLeftRect4Width + this.hGap;
        const mapLeftRect2Width = 8; // Fixed width
        const mapLeftRect2X = mapLeftRect3X + mapLeftRect3Width + this.hGap;
        // Rect 1 fills remaining space up to the main left elbow
        const mapLeftRect1X = mapLeftRect2X + mapLeftRect2Width + this.hGap;
        const mapLeftRect1RightEdge = this.targetX; // Rect 1 ends where the main elbow starts
        const mapLeftRect1Width = Math.max(0, mapLeftRect1RightEdge - this.hGap - mapLeftRect1X);

        const mapLeftRects = [
            new RectangleElement({ x: mapLeftRect1X, y: 0, width: mapLeftRect1Width, height: mapLeftRectHeight, fill: this.shipMapMapLeftRectFill, cornerRadius: 0 }),
            new RectangleElement({ x: mapLeftRect2X, y: 0, width: mapLeftRect2Width, height: mapLeftRectHeight, fill: this.shipMapMapLeftRectFill, cornerRadius: 0 }),
            new RectangleElement({ x: mapLeftRect3X, y: 0, width: mapLeftRect3Width, height: mapLeftRectHeight, fill: this.shipMapMapLeftRectFill, cornerRadius: 0 }),
            new RectangleElement({ x: mapLeftRect4X, y: 0, width: mapLeftRect4Width, height: mapLeftRectHeight, fill: this.shipMapMapLeftRectFill, cornerRadius: 0 }),
        ];

        // Construct the final layout object
        const mainHeaderLayout: ShipMapMainHeaderLayout = {
            y: this.topHeaderAreaHeight, // Use passed topHeaderAreaHeight for absolute Y
            height: mainHeaderBaseHeight,
            elbowTotalHeight: mainHeaderElbowTotalHeight,
            leftElbow: leftElbow,
            middleRect1: middleRect1,
            middleRect2: middleRect2,
            rightEndcap: rightEndcap,
            rightEndcapX: actualEndcapX,
            rightEndcapWidth: actualEndcapWidth,
            mapRightElbow: mapRightElbow,
            mapRightElbowX: finalMapRightElbowX,
            mapOverlayRects: mapOverlayRects,
            mapLeftRects: mapLeftRects,
            mapText: mapText,
            useAbbreviatedText: textLayoutResult.useAbbreviatedText // Store metadata
        };

        return mainHeaderLayout;
    }
}


// --- Unified Factory Function ---
export function calculateMainHeaderLayout(
    options: CalculateMainHeaderOptions
): MainHeaderLayout | ShipMapMainHeaderLayout | null {

    if (options.view === 'home') {
        // Destructure view prop, pass the rest
        const { view, ...homeOptions } = options;
        if (!homeOptions.measuredMainTextDims) {
             console.error("LCARS Card (MainHeader Factory): Missing measured text dimensions for home view.");
             return null;
        }
        const calculator = new HomeMainHeaderLayoutCalculator(homeOptions);
        return calculator.calculate();
    } else if (options.view === 'shipMap') {
         // Destructure view prop, pass the rest
        const { view, ...shipMapOptions } = options;
         // Check homeContext instead of homeLayout
         if (!shipMapOptions.homeContext) {
             console.error("LCARS Card (MainHeader Factory): Home layout context is required for shipMap view.");
             return null;
         }
         // Add validation for topHeaderAreaHeight
         if (typeof shipMapOptions.topHeaderAreaHeight !== 'number' || shipMapOptions.topHeaderAreaHeight <= 0) {
              console.error("LCARS Card (Main Header Factory): Valid topHeaderAreaHeight is required for shipMap view.");
              return null;
         }
         if (shipMapOptions.measuredMapTextWidth === null || shipMapOptions.measuredMapTextHeight === null) {
              console.error("LCARS Card (MainHeader Factory): Missing measured map text dimensions for shipMap view.");
              return null;
         }
        // TODO: How should mapTextContent be passed in? For now, using default in calculator.
        const calculator = new ShipMapMainHeaderLayoutCalculator(shipMapOptions);
        return calculator.calculate();
    } else {
        // Should not happen with TypeScript if options type is correct
        console.error("LCARS Card (MainHeader Factory): Invalid view type provided in options.");
        const _exhaustiveCheck: never = options; // Compile-time check
        return null;
    }
}

// --- REMOVE OLD CALCULATION FUNCTIONS ---
/*
export function calculateHomeMainHeaderLayout(...) { ... }
export function calculateShipMapMainHeaderLayout(...) { ... }
*/ 