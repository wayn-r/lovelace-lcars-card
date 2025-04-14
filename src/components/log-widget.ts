import { html, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LogMessage, LogAreaLayout } from '../types';
import { LOG_LINE_HEIGHT_PX, LOG_FADE_MEDIUM_MS, LOG_FADE_OUT_MS } from '../constants';

// Function component for rendering the log widget
export function renderLogWidget(
    layout: LogAreaLayout,
    logMessages: LogMessage[],
    error: string | null,
    newlyAddedIds: Set<string>
) {
    if (!layout) return html``;

    // Do NOT reverse logMessages - newest should be at index 0
    const displayedLogs = logMessages;
    const now = Date.now();

    const getLogColor = (index: number, message: LogMessage): string => {
        const age = now - message.timestamp;
        // Keep newest message bright (index 0 is newest)
        if (index === 0) return "#ffc96f"; // Brightest for newest
        if (age > LOG_FADE_MEDIUM_MS) return "#864f0b"; // Faded color
        return "#dd8213"; // Default color
    };

    return svg`
        <g id="log-widget" transform="translate(0, ${layout.y})">
            ${error
                ? svg`<text class="log-text error-text" x="${layout.x}" y="0" text-anchor="${layout.textAnchor}" dominant-baseline="hanging">${error}</text>`
                : repeat(displayedLogs, (message) => message.id, (message, index) => {
                    const isNew = newlyAddedIds.has(message.id);
                    const age = now - message.timestamp;
                    // Opacity: Fade out old messages unless they are brand new
                    const targetOpacity = (age > LOG_FADE_OUT_MS && !isNew) ? 0 : 1;
                    // Color: Fade color based on age, but flash new ones (index 0 is newest)
                    const targetFill = getLogColor(index, message);
                    // Apply bright color immediately if new, otherwise use age-based color
                    const currentFill = isNew ? '#ffc96f' : targetFill;
                    // Apply target opacity unless it's new (animation handles initial state)
                    const currentStyle = `opacity: ${isNew ? 1 : targetOpacity};`; // Start visible if new for animation

                    // Y position: index * height. Newest (index 0) is at the top (y=0)
                    const yPosition = index * LOG_LINE_HEIGHT_PX;

                    return svg`
                        <text
                            class="log-text ${isNew ? 'log-text-new' : ''}"
                            x="${layout.x}"
                            y="${yPosition}" 
                            text-anchor="${layout.textAnchor}"
                            dominant-baseline="hanging"
                            fill="${currentFill}"
                            style="${currentStyle}"
                        >
                            ${message.text}
                        </text>
                    `;
                })
            }
        </g>
    `;
} 