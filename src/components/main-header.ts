import { html, svg } from 'lit';
import { MainHeaderLayout, ShipMapMainHeaderLayout, ButtonLayout } from '../types';
// Import base element classes for type checking access
import {
    RectangleElement,
    TextElement,
    ElbowElement,
    EndcapElement,
    ChiselEndcapElement,
    TriangleElement
} from '../layout/layout-elements';
import {
    HORIZONTAL_GAP_PX,
    ELBOW_HORIZONTAL_WIDTH_PX,
    ELBOW_VERTICAL_WIDTH_PX,
    OVERLAY_RECT_WIDTH_REDUCTION_PX,
    VERTICAL_GAP_PX
} from '../constants';

const mainDy = -4; // Restore local offset

// Function component for rendering the main header
export function renderMainHeader(
    headerLayout: MainHeaderLayout | ShipMapMainHeaderLayout,
    text: string,
    isDimmed: boolean,
    isShifted: boolean,
    elementsShiftedRight: boolean,
    containerWidth: number,
    buttons: ButtonLayout[],
    isStaticShipMap: boolean = false
) {
    if (!headerLayout) {
        return html``;
    }
    if (isStaticShipMap && 'mapRightElbow' in headerLayout) {
        const mapLayout = headerLayout as ShipMapMainHeaderLayout;
        const mapTextDy = -4.5;

        // Generate paths for static map view USING element methods
        const leftElbowPath = mapLayout.leftElbow.getPathD();
        const rightEndcapPath = mapLayout.rightEndcap.getPathD();
        const mapRightElbowPath = mapLayout.mapRightElbow.getPathD();

        return svg`
        <g
            id="main-header"
            class="static-ship-map" 
            transform="translate(0, ${mapLayout.y})" 
            style="--container-width: ${containerWidth}px" 
        >
            {/* Access properties from base element instances */}
            <path id="main-header-path-left" d="${leftElbowPath}" fill="${mapLayout.leftElbow.fill}"/>
            <rect
                id="main-header-rect-middle1"
                x="${mapLayout.middleRect1.x}"
                y="${mapLayout.middleRect1.y}"
                width="${mapLayout.middleRect1.width}"
                height="${mapLayout.height}" 
                fill="${mapLayout.middleRect1.fill}"
                rx="${mapLayout.middleRect1.cornerRadius}" 
                ry="${mapLayout.middleRect1.cornerRadius}" 
            />
            <path id="main-header-path-right" d="${rightEndcapPath}" fill="${mapLayout.rightEndcap.fill}"/>

            <path 
                id="main-header-path-map-right-elbow"
                d="${mapRightElbowPath}"
                fill="${mapLayout.mapRightElbow.fill}"
                opacity="1" 
            />
            ${mapLayout.mapOverlayRects && mapLayout.mapOverlayRects.map((rect, i) => svg`
                <rect
                    id="main-header-map-overlay-rect-${i + 1}"
                    x="${rect.x}"
                    y="${rect.y}"
                    width="${rect.width}"
                    height="${rect.height}"
                    fill="${rect.fill}"
                    rx="${rect.cornerRadius}" 
                    ry="${rect.cornerRadius}" 
                    opacity="1"
                />
            `)}
            ${mapLayout.mapLeftRects && mapLayout.mapLeftRects.map((rect, i) => svg`
                <rect
                    id="main-header-map-left-rect-${mapLayout.mapLeftRects.length - i}" 
                    x="${rect.x}"
                    y="${rect.y}"
                    width="${rect.width}"
                    height="${rect.height}"
                    fill="${rect.fill}"
                    rx="${rect.cornerRadius}" 
                    ry="${rect.cornerRadius}" 
                    opacity="1"
                />
            `)}
            
            {/* Render MAP Text */}
            <text 
                id="main-header-map-text"
                class="header-text map-header-text" 
                x="${mapLayout.mapText.x}" 
                y="${mapLayout.mapText.y}" 
                dominant-baseline="${mapLayout.mapText.dominantBaseline}" 
                text-anchor="${mapLayout.mapText.textAnchor}" 
                fill="${mapLayout.mapText.fill}"
                style="font-size: ${mapLayout.mapText.fontSize}px;" 
            >
                <tspan dy="${mapTextDy}">${mapLayout.mapText.text}</tspan>
            </text>

            {/* Render Middle Rect 2 */}
            <rect
                id="main-header-rect-middle2"
                x="${mapLayout.middleRect2.x}"
                y="${mapLayout.middleRect2.y}"
                width="${mapLayout.middleRect2.width}"
                height="${mapLayout.height}" 
                fill="${mapLayout.middleRect2.fill}"
                rx="${mapLayout.middleRect2.cornerRadius}" 
                ry="${mapLayout.middleRect2.cornerRadius}" 
            />
        </g>
        `;
    } else if ('leftElbow' in headerLayout) {
        if (!isStaticShipMap && (!buttons || buttons.length < 7)) {
            return html``;
        }

        // --- Home View / Animated Transition Logic --- 
        const homeLayout = headerLayout as MainHeaderLayout;
        const targetX = containerWidth / 3;

        // Access properties via base element instances & direct metadata
        let middleRect1Width = homeLayout.middleRect1.width;
        // Get initial paths using element methods
        let leftElbowPathD = homeLayout.leftElbow.getPathD();
        let rightEndcapPathD = homeLayout.rightEndcap.getPathD();
        const leftElbowTotalHeight = homeLayout.elbowTotalHeight; // Use direct metadata
        const rightEndcapX = homeLayout.rightEndcapX;             // Use direct metadata
        const rightEndcapWidth = homeLayout.rightEndcapWidth;     // Use direct metadata
        const middleRect1X = homeLayout.middleRect1.x;
        const textObj = homeLayout.text; // Reference text element instance

        let headerClasses = `${isDimmed ? 'dimmed' : ''} ${isShifted ? 'shifted' : ''}`.trim();
        let headerStyle = `--container-width: ${containerWidth}px`;

        // Animation calculations - RECALCULATE paths if needed
        if (elementsShiftedRight && containerWidth > 0) {
            headerClasses += ` elements-shifted slid-right`;
            middleRect1Width = Math.max(0, rightEndcapX - HORIZONTAL_GAP_PX - middleRect1X - targetX);
            const newVerticalWidth = Math.max(10, ELBOW_VERTICAL_WIDTH_PX - OVERLAY_RECT_WIDTH_REDUCTION_PX);
            // Create temporary element for shifted path OR update original (if safe)
            // For now, just regenerate path string directly (simpler for animation state)
            // TODO: Consider if updating the element instance is better
            const shiftedLeftElbow = new ElbowElement({ ...homeLayout.leftElbow, verticalWidth: newVerticalWidth, orientation: 'top-right' });
            leftElbowPathD = shiftedLeftElbow.getPathD();
            const shiftedMiddleRect1EndX = middleRect1X + targetX + middleRect1Width;
            const newRightEndcapX = shiftedMiddleRect1EndX + HORIZONTAL_GAP_PX;
            // Reset paths to original using element methods
            rightEndcapPathD = homeLayout.rightEndcap.getPathD();
        } else {
            headerClasses = headerClasses.replace('elements-shifted', '').replace('slid-right', '').trim();
            // Reset paths to original using element methods
            leftElbowPathD = homeLayout.leftElbow.getPathD();
            rightEndcapPathD = homeLayout.rightEndcap.getPathD();
            middleRect1Width = homeLayout.middleRect1.width;
        }

        headerClasses = headerClasses.trim();

        // Ship Map Elements for transition (Calculations should still be valid)
        // ... (Calculations for mapRightElbowPathD, mapOverlayRects, mapLeftRects etc.) ...
        let mapRightElbowPathD = '';
        let mapRightElbowX = 0;
        let mapRightElbowFill = 'var(--secondaryBrighter)';
        let mapOverlayRectWidth = 0;
        let mapOverlayRectHeight1 = 0, mapOverlayRectHeight2 = 0;
        let mapOverlayRectX = 0, mapOverlayRectY1 = 0, mapOverlayRectY2 = 0;
        let mapOverlayRectFill1 = '', mapOverlayRectFill2 = '';
        let mapLeftRectHeight = 0, mapLeftRectFill = '';
        let mapLeftRect1X = 0, mapLeftRect1Width = 0;
        let mapLeftRect2X = 0, mapLeftRect2Width = 8;
        let mapLeftRect3X = 0, mapLeftRect3Width = 5;
        let mapLeftRect4X = 0, mapLeftRect4Width = 0;
        let mapBackTrianglePoints = '';
        const mapBackTriangleFill = '#000000';

        if (elementsShiftedRight && buttons && buttons.length >= 7) {
            const mapElbowHorizontalWidth = Math.round(ELBOW_VERTICAL_WIDTH_PX * (2/3));
            const mapElbowVerticalWidth = 12;
            const elbowRightEdge = targetX - HORIZONTAL_GAP_PX;
            mapRightElbowX = elbowRightEdge - mapElbowHorizontalWidth;
            // Create temporary element for transition state
            const transitionMapRightElbow = new ElbowElement({
                x: mapRightElbowX, y: 0, 
                horizontalWidth: mapElbowHorizontalWidth, verticalWidth: mapElbowVerticalWidth, 
                headerHeight: homeLayout.height, totalElbowHeight: leftElbowTotalHeight,
                orientation: 'top-left' 
            });
            mapRightElbowPathD = transitionMapRightElbow.getPathD();
            const baseOverlayLayout = [
                { y: buttons[0].y, height: (buttons[2].y + buttons[2].height) - buttons[0].y, fill: '#7e7961' },
                { y: buttons[3].y, height: (buttons[4].y + buttons[4].height) - buttons[3].y, fill: '#312f27' }
            ];
            const topHeightReductionPercent = 0.4;
            const topHeightReduction = baseOverlayLayout[0].height * topHeightReductionPercent;
            mapOverlayRectWidth = 12;
            mapOverlayRectHeight1 = baseOverlayLayout[0].height - topHeightReduction;
            mapOverlayRectFill1 = baseOverlayLayout[0].fill;
            mapOverlayRectHeight2 = baseOverlayLayout[1].height + topHeightReduction;
            mapOverlayRectFill2 = baseOverlayLayout[1].fill;
            mapOverlayRectX = mapRightElbowX + mapElbowHorizontalWidth - mapOverlayRectWidth;
            const vGap = VERTICAL_GAP_PX;
            mapOverlayRectY1 = leftElbowTotalHeight + vGap;
            mapOverlayRectY2 = mapOverlayRectY1 + mapOverlayRectHeight1 + vGap;
            mapLeftRectHeight = homeLayout.height;
            mapLeftRectFill = mapRightElbowFill;
            mapLeftRect4X = 0;
            mapLeftRect4Width = mapLeftRectHeight;
            mapLeftRect3X = mapLeftRect4X + mapLeftRect4Width + HORIZONTAL_GAP_PX;
            mapLeftRect2X = mapLeftRect3X + mapLeftRect3Width + HORIZONTAL_GAP_PX;
            mapLeftRect1X = mapLeftRect2X + mapLeftRect2Width + HORIZONTAL_GAP_PX;
            const mapLeftRect1RightEdge = mapRightElbowX - HORIZONTAL_GAP_PX;
            mapLeftRect1Width = Math.max(0, mapLeftRect1RightEdge - mapLeftRect1X);
            mapBackTrianglePoints = ''; 
        }

        // Render using base element instances and direct metadata
        return svg`
            <g
                id="main-header"
                class="${headerClasses}" 
                transform="translate(0, ${homeLayout.y})" 
                style="${headerStyle}" 
            >
                {/* Home View Elements */}
                <text 
                    class="header-text main-header-text" 
                    x="${textObj.x}" 
                    y="${textObj.y}" 
                    dominant-baseline="${textObj.dominantBaseline}" 
                    text-anchor="${textObj.textAnchor}" 
                    fill="${textObj.fill}"
                    style="font-size: ${textObj.fontSize}px;" 
                >
                  <tspan id="main-header-text-tspan" dy="${mainDy}">${textObj.text}</tspan>
                </text>
                <path id="main-header-path-left" d="${leftElbowPathD}" fill="${homeLayout.leftElbow.fill}" />
                <rect
                    id="main-header-rect-middle1"
                    x="${homeLayout.middleRect1.x}"
                    y="${homeLayout.middleRect1.y}"
                    width="${middleRect1Width}"
                    height="${homeLayout.height}"
                    fill="${homeLayout.middleRect1.fill}"
                    rx="${homeLayout.middleRect1.cornerRadius}" 
                    ry="${homeLayout.middleRect1.cornerRadius}" 
                />
                <path id="main-header-path-right" d="${rightEndcapPathD}" fill="${homeLayout.rightEndcap.fill}" />
                
                {/* Elements for ShipMap Transition (Rendered with opacity 0) */}
                <path 
                    id="main-header-path-map-right-elbow"
                    d="${mapRightElbowPathD}"
                    fill="${mapRightElbowFill}"
                    opacity="0" 
                />
                {/* Render transition rects using calculated values */}
                <rect id="main-header-map-overlay-rect-1" x="${mapOverlayRectX}" y="${mapOverlayRectY1}" width="${mapOverlayRectWidth}" height="${mapOverlayRectHeight1}" fill="${mapOverlayRectFill1}" opacity="0" rx="0" ry="0" />
                <rect id="main-header-map-overlay-rect-2" x="${mapOverlayRectX}" y="${mapOverlayRectY2}" width="${mapOverlayRectWidth}" height="${mapOverlayRectHeight2}" fill="${mapOverlayRectFill2}" opacity="0" rx="0" ry="0" />
                <rect id="main-header-map-left-rect-1" x="${mapLeftRect1X}" y="0" width="${mapLeftRect1Width}" height="${mapLeftRectHeight}" fill="${mapLeftRectFill}" opacity="0" rx="0" ry="0" />
                <rect id="main-header-map-left-rect-2" x="${mapLeftRect2X}" y="0" width="${mapLeftRect2Width}" height="${mapLeftRectHeight}" fill="${mapLeftRectFill}" opacity="0" rx="0" ry="0" />
                <rect id="main-header-map-left-rect-3" x="${mapLeftRect3X}" y="0" width="${mapLeftRect3Width}" height="${mapLeftRectHeight}" fill="${mapLeftRectFill}" opacity="0" rx="0" ry="0" />
                <rect id="main-header-map-left-rect-4" x="${mapLeftRect4X}" y="0" width="${mapLeftRect4Width}" height="${mapLeftRectHeight}" fill="${mapLeftRectFill}" opacity="0" rx="0" ry="0" />
            </g>
        `;
    } else {
        // Fallback or error case if headerLayout type is unexpected
        console.warn("LCARS Card: Unexpected headerLayout type in renderMainHeader.");
        return html``;
    }
}