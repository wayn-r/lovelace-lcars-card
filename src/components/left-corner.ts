import { html, svg } from 'lit';
import { ShipMapLeftCornerLayout } from '../types';

/**
 * Renders the left corner element with an equilateral triangle for the Ship Map view
 * @param layout The layout data for the left corner element
 * @returns SVG template result
 */
export function renderLeftCorner(layout: ShipMapLeftCornerLayout) {
    if (!layout || !layout.cornerTriangle) return html``;

    const trianglePathD = layout.cornerTriangle.getPathD();

    return svg`
        <rect
            class="left-corner-rect"
            x="${layout.x}"
            y="${layout.y}"
            width="${layout.width}"
            height="${layout.height}"
            fill="${layout.fill}"
        />
        <path
            class="left-corner-triangle"
            d="${trianglePathD}" 
            fill="${layout.cornerTriangle.fill}"
        />
    `;
} 