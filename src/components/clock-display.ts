import { html, svg } from 'lit';
import { ClockAreaLayout } from '../types';
import {
    CLOCK_TIME_FONT_SIZE_PX,
    CLOCK_DATE_FONT_SIZE_PX,
    CLOCK_AREA_LINE_HEIGHT_PX,
    MAIN_HEADER_FONT_SIZE_PX
} from '../constants';

// Function component for rendering the clock display
export function renderClockDisplay(
    layout: ClockAreaLayout,
    currentTimeStr: string,
    currentDateStr: string,
    clockVisible: boolean,
    dateVisible: boolean,
    displayFormat: 'full' | 'short' | 'none' = 'full'
) {
    if (!layout || (!clockVisible && !dateVisible)) return html``;

    // Determine time string based on format
    let timeToRender = currentTimeStr;
    if (displayFormat === 'short') {
        timeToRender = currentTimeStr.substring(0, 5);
    } else if (displayFormat === 'none') {
        return html``;
    }

    // Use absolute X if provided (for ShipMap), otherwise relative X=0 within transformed group (Home)
    const timeX = layout.timeX_abs ?? 0;
    // Date X remains relative for Home view (not used in ShipMap)
    const dateX = 0; 

    // Use layout overrides or defaults for style
    const timeFontSize = layout.timeFontSize ?? CLOCK_TIME_FONT_SIZE_PX;
    const timeFill = layout.timeFillColor ?? 'var(--primaryBrightest)';
    const dateFontSize = CLOCK_DATE_FONT_SIZE_PX; // Keep date default
    const dateFill = 'var(--primaryBright)'; // Keep date default

    // Vertical offset used by header text for central alignment
    const timeDy = -4.5; 

    return svg`
        <g id="clock-display" transform="translate(${layout.x}, ${layout.y})"> 
            ${clockVisible ? svg`
            <text
                class="clock-text"
                x="${timeX}" y="${layout.timeY_abs}" 
                dominant-baseline="central" // Use central baseline
                text-anchor="end" 
                fill="${timeFill}"
                style="font-size: ${timeFontSize}px;"
            >
                <tspan dy="${timeDy}">${timeToRender}</tspan>
            </text>` : null}
            ${dateVisible ? svg`
            <text
                class="clock-text"
                x="${dateX}" y="${layout.dateY_abs}" 
                dominant-baseline="alphabetic" 
                text-anchor="start"
                fill="${dateFill}"
                style="font-size: ${dateFontSize}px;"
            >
                <tspan dy="0">${currentDateStr}</tspan>
            </text>` : null}
        </g>
    `;
} 