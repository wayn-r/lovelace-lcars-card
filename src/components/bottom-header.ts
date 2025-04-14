import { html, svg } from 'lit';
import { MAIN_HEADER_FONT_SIZE_PX } from '../constants';
import { BottomHeaderLayout } from '../types'; // Import the full type
// Import path generation functions
// import { generateElbowPath, generateEndcapPath } from '../utils/shapes';

// Constant for vertical text offset (could be imported or defined locally)
const mainDy = -4.5;

// Interface for layout properties (optional but good practice)
// Consider defining this in types.ts and importing
// interface BottomHeaderLayout { // Type is now imported
//     barLeftX: number;
//     barLeftWidth: number;
//     barRightX: number;
//     barRightWidth: number;
//     barY: number;
//     barHeight: number;
//     fillColor: string;
//     endcapPathD: string;
//     endcapFillColor: string;
//     textX: number;
//     textY: number;
//     textContent: string;
//     // Add elbow properties
//     bottomElbowPathD: string;
//     bottomElbowFill: string;
// }

/**
 * Renders the bottom header bar associated with the button overlays transition.
 * For ShipMap view, it also renders the large bottom elbow.
 * @param layout Layout data calculated by the parent component.
 * @returns SVG TemplateResult
 */
export function renderBottomHeader(layout: BottomHeaderLayout) { // Use imported type
    if (!layout || layout.barHeight <= 0 || !layout.bottomElbow || !layout.endcap) return html``; // Add checks for elements

    // Generate paths using element methods
    const bottomElbowPathD = layout.bottomElbow.getPathD();
    const endcapPathD = layout.endcap.getPathD();

    return svg`
        ${bottomElbowPathD ? svg`
            <path 
                class="bottom-header-elbow" 
                d="${bottomElbowPathD}" 
                fill="${layout.bottomElbow.fill}"
            />
        ` : ''}
        <rect
            class="bottom-header-bar-left"
            x="${layout.barLeftX}"
            y="${layout.barY}"
            width="${layout.barLeftWidth}"
            height="${layout.barHeight}"
            fill="${layout.fillColor}"
        />
         <rect
            class="bottom-header-bar-right"
            x="${layout.barRightX}"
            y="${layout.barY}"
            width="${layout.barRightWidth}"
            height="${layout.barHeight}"
            fill="${layout.fillColor}"
        />
        <path
            class="bottom-header-endcap"
            d="${endcapPathD}"
            fill="${layout.endcap.fill}"
        />
        <text
            class="bottom-header-text header-text"
            x="${layout.textX}"
            y="${layout.textY}"
            dy="${mainDy}"
            dominant-baseline="central"
            text-anchor="end"
            fill="var(--primaryBright)"
            style="font-size: ${MAIN_HEADER_FONT_SIZE_PX}px;"
        >
            ${layout.textContent}
        </text>
    `;
} 