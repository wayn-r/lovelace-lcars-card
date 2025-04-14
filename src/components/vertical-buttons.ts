import { html, svg } from 'lit';
import { ButtonLayout } from '../types';
import { BUTTON_FONT_SIZE_PX } from '../constants';

// Function component for rendering the vertical buttons
export function renderVerticalButtons(
    buttons: ButtonLayout[],
    isHidden: boolean,
    clickHandler: (action?: string, index?: number) => void // Add index parameter
) {
    if (!buttons || buttons.length === 0) return html``;

    const buttonDy = -2; // Adjustment for text vertical alignment
    const classes = isHidden ? 'buttons-hidden' : '';

    return svg`
        <g id="vertical-buttons" class="${classes}">
          ${buttons.map((button, index) => svg`
            <rect
              class="button-shape"
              x="${button.x}" y="${button.y}"
              width="${button.width}" height="${button.height}"
              fill="var(${button.colorVar})"
              rx="0" ry="0"
              @click=${() => clickHandler(button.action, index)} // Pass index
              style="cursor: ${button.action ? 'pointer' : 'default'};"
            />
            <text
              class="button-text"
              x="${button.textX}" y="${button.textY}"
              dominant-baseline="central" text-anchor="end"
              fill="black"
              style="font-size: ${BUTTON_FONT_SIZE_PX}px;"
            >
              <tspan dy="${buttonDy}">${button.text}</tspan>
            </text>
          `)}
        </g>
    `;
}

// Removed class definition and custom element registration 