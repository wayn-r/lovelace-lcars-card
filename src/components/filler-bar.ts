import { html, svg } from 'lit';
import { FillerBarLayout } from '../types';
import { DEFAULT_FILLER_BAR_HEIGHT_PX } from '../constants';

// Function component for rendering the filler bar
export function renderFillerBar(layout: FillerBarLayout) {
    if (!layout) return html``;

    // Use calculated height from layout, fallback to constant if needed
    const fillerHeight = layout.height >= 0 ? layout.height : DEFAULT_FILLER_BAR_HEIGHT_PX;

    return svg`
        <g id="filler-bar-group">
            <rect
                id="filler-bar"
                x="${layout.x}" y="${layout.y}"
                width="${layout.width}" height="${fillerHeight}"
                fill="var(--secondary)"
            />
        </g>
    `;
} 