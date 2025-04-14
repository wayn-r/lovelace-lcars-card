import { html, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { TopHeaderLayout } from '../types';

const topDy = -2; // Restore local offset

// Define a simple function component or a LitElement class
// Using a function here for simplicity as it's just rendering SVG
export function renderTopHeader(layout: TopHeaderLayout, leftText: string, rightText: string) {
    if (!layout || !layout.leftEndcap || !layout.middleRect || !layout.rightEndcap) return html``; // Add checks for elements

    // Generate paths from element properties USING getPathD()
    const leftEndcapPathD = layout.leftEndcap.getPathD();
    const rightEndcapPathD = layout.rightEndcap.getPathD();

    return svg`
        <g id="top-header" transform="translate(0, ${layout.y})">
            <path id="top-header-path-left" d="${leftEndcapPathD}" fill="${layout.leftEndcap.fill}"/>
            <rect 
                id="top-header-rect-middle" 
                x="${layout.middleRect.x}" 
                y="${layout.middleRect.y}" 
                width="${layout.middleRect.width}" 
                height="${layout.middleRect.height}" 
                fill="${layout.middleRect.fill}"
                rx="${layout.middleRect.cornerRadius}" 
                ry="${layout.middleRect.cornerRadius}" 
            />
            <path id="top-header-path-right" d="${rightEndcapPathD}" fill="${layout.rightEndcap.fill}"/>
            <text class="header-text" x="${layout.textLeftX}" y="${layout.textLeftY}" dominant-baseline="central" text-anchor="start" fill="var(--secondaryBrighter)" style="font-size: ${layout.fontSize}px;">
                <tspan id="top-header-text-left-tspan" dy="${topDy}">${leftText}</tspan>
            </text>
            <text class="header-text" x="${layout.textRightX}" y="${layout.textRightY}" dominant-baseline="central" text-anchor="end" fill="var(--secondaryBrighter)" style="font-size: ${layout.fontSize}px;">
                <tspan id="top-header-text-right-tspan" dy="${topDy}">${rightText}</tspan>
            </text>
        </g>
    `;
} 