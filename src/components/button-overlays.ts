import { html, svg } from 'lit';
import { ButtonLayout, ShipMapButtonOverlaysLayout } from '../types';
import {
    ELBOW_VERTICAL_WIDTH_PX,
    VERTICAL_GAP_PX,
    OVERLAY_RECT_WIDTH_REDUCTION_PX,
    ELBOW_HORIZONTAL_WIDTH_PX,
    HORIZONTAL_GAP_PX,
    MAIN_HEADER_FONT_SIZE_PX
} from '../constants';
import {
    generateElbowPath,
    measureTextBBox,
    calculateDynamicBarHeight
} from '../utils/shapes';

// Function component for rendering button overlays
export function renderButtonOverlays(
    // Use 'any' for now, refine with type guards later if needed
    layoutData: ShipMapButtonOverlaysLayout | ButtonLayout[], 
    isVisible: boolean, // Still needed for home animation
    elementsShiftedRight: boolean, // Still needed for home animation OR true for static map
    containerWidth: number,
    // Height can come from different sources depending on view
    measuredBottomBarTextHeight: number | null, 
    isStaticShipMap: boolean = false // Flag for static map view
) {
    
    // --- Render Static Ship Map View --- //
    if (isStaticShipMap) {
        const mapLayout = layoutData as ShipMapButtonOverlaysLayout;
        // Static view uses layout directly, no complex calculations here
        return svg`
        <g 
            id="button-overlays"
            class="static-ship-map" 
            transform="${mapLayout.groupTransform}"
        >
            ${mapLayout.overlayRects.map((rect, index) => svg`
                <rect
                    class="overlay-rect visible static-map-rect-${index}" 
                    x="${rect.x}"
                    y="${rect.y}"
                    width="${rect.width}"
                    height="${rect.height}"
                    fill="${rect.fill}"
                    rx="0" ry="0"
                    opacity="1" 
                />
            `)}
            
            <!-- Elbow rendering removed -->

        </g>
    `;
    }

    // --- Render Home View / Animation State --- //
    const buttons = layoutData as ButtonLayout[];
    if (!buttons || buttons.length < 7) return html``;

    const vGap = VERTICAL_GAP_PX;
    const hGap = HORIZONTAL_GAP_PX;

    // Calculate potential dynamic bar height (needed for elbow even if bar isn't rendered here)
    const bottomHeaderBarHeight = measuredBottomBarTextHeight ? calculateDynamicBarHeight(measuredBottomBarTextHeight) : 0;

    // Calculate base layout
    const baseLayout = [
        { y: buttons[0].y, height: (buttons[2].y + buttons[2].height) - buttons[0].y, fill: '#7e7961' },
        { y: buttons[3].y, height: (buttons[4].y + buttons[4].height) - buttons[3].y, fill: '#312f27' },
        { y: buttons[5].y, height: (buttons[6].y + buttons[6].height) - buttons[5].y, fill: '#ffec93' }
    ];

    // Variable initializations for animation
    let groupTransform = `translate(0, 0)`;
    let overlayRects = baseLayout.map(rect => ({ ...rect, x: 0, width: ELBOW_VERTICAL_WIDTH_PX })); // Added x:0
    let elbowPathD: string = '';
    let elbowFill: string = 'none';
    let calculatedBottomHeaderY = 0;
    let calculatedElbowTotalHeight = 0;

    if (elementsShiftedRight && containerWidth > 0 && measuredBottomBarTextHeight && bottomHeaderBarHeight > 0) {
        const targetX = containerWidth / 3;
        groupTransform = `translate(${targetX}, 0)`;

        const newWidth = Math.max(10, ELBOW_VERTICAL_WIDTH_PX - OVERLAY_RECT_WIDTH_REDUCTION_PX);
        const topHeightReductionPercent = 0.4;
        const topHeightReduction = baseLayout[0].height * topHeightReductionPercent;
        const newTopHeight = baseLayout[0].height - topHeightReduction;
        const newMidHeight = baseLayout[1].height + topHeightReduction;
        const newBottomHeight = buttons[5].height / 2;
        const newTopY = baseLayout[0].y;
        const newMidY = newTopY + newTopHeight + vGap;
        const newBottomY = newMidY + newMidHeight + vGap;
        overlayRects = [
            { ...baseLayout[0], x:0, y: newTopY, height: newTopHeight, width: newWidth },
            { ...baseLayout[1], x:0, y: newMidY, height: newMidHeight, width: newWidth },
            { ...baseLayout[2], x:0, y: newBottomY, height: newBottomHeight, width: newWidth }
        ];
        const bottomDuplicate1 = {
            x: 0, // Added x
            y: newBottomY + newBottomHeight + vGap,
            height: newBottomHeight,
            width: newWidth,
            fill: baseLayout[2].fill
        };
        overlayRects.push(bottomDuplicate1);
        elbowFill = baseLayout[2].fill;

        const elbowStartY = bottomDuplicate1.y + bottomDuplicate1.height + vGap;
        const targetElbowBottomY = buttons[6].y + buttons[6].height;
        const verticalWidth = newWidth;

        calculatedBottomHeaderY = targetElbowBottomY - bottomHeaderBarHeight;
        calculatedElbowTotalHeight = Math.max(0, calculatedBottomHeaderY - elbowStartY);

        if (calculatedElbowTotalHeight > 0) {
            elbowPathD = generateElbowPath(
                0, ELBOW_HORIZONTAL_WIDTH_PX, verticalWidth,
                bottomHeaderBarHeight, calculatedElbowTotalHeight,
                'bottom-left', elbowStartY
            );
        } else {
            console.warn(`LCARS Card: Button overlay elbow calculation resulted in invalid height.`);
            elbowPathD = '';
        }

    } else if (elementsShiftedRight) {
        console.warn("LCARS Card: Shifted right, but bottom text height not measured. Hiding dynamic elements.");
        elbowPathD = '';
    }

    const visibleClass = isVisible ? 'visible' : '';
    const transitionClass = elementsShiftedRight ? 'shifted' : '';

    // Render Home View / Animated State
    return svg`
        <g id="button-overlays" class="${transitionClass}" transform="${groupTransform}">
            ${overlayRects.map((rect, index) => {
                let additionalClass = '';
                if (elementsShiftedRight && overlayRects.length > 3) {
                    if (index === 2) additionalClass = 'bottom-original';
                    if (index === 3) additionalClass = 'bottom-duplicate-1';
                } else if (!elementsShiftedRight) {
                     if (index === 0) additionalClass = 'top';
                     if (index === 1) additionalClass = 'mid';
                     if (index === 2) additionalClass = 'bottom';
                }
                return svg`
                <rect
                    class="overlay-rect ${visibleClass} ${additionalClass}"
                    x="${rect.x}" 
                    y="${rect.y}"
                    width="${rect.width}"
                    height="${rect.height}"
                    fill="${rect.fill}"
                    rx="0" ry="0"
                />
            `})}

            ${elementsShiftedRight && elbowPathD ? svg`
                <path
                    class="bottom-elbow"
                    d="${elbowPathD}"
                    fill="${elbowFill}"
                />
            ` : ''}
        </g>
    `;
} 