import { css } from 'lit';
import {
    LOG_FONT_SIZE_PX,
    ANIMATION_SLIDE_DURATION_MS,
    ANIMATION_FADE_DURATION_S,
    ANIMATION_FLASH_TOTAL_DURATION_S,
    ANIMATION_FLASH_WAIT_PERCENT
} from './constants';

export const styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      cursor: default;
      color-scheme: only light;
      /* LCARS Colors */
      --primaryDarker: #763806; --primaryDark: #864f0b; --primarySat: #d34e03;
      --primary: #df8313; --primaryBright: #da9a4d; --primaryBrighter: #ffc96f;
      --primaryBrightest: #f9e9da; --secondary: #ffd300; --secondaryBright: #ffe359;
      --secondaryBrighter: #ffec92; --secondaryBrightest: #fff5c7;
      --bgColor: var(--card-background-color, transparent);

      font-family: 'Antonio', Helvetica, sans-serif;
    }

    svg {
      display: block;
      width: 100%;
      overflow: hidden;
    }
    text, tspan {
        font-family: inherit;
        pointer-events: none;
        user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
    }
    .header-text { font-weight: 400; letter-spacing: -0.01em; }
    #main-header-text { letter-spacing: -0.02em; }
    .button-text { font-weight: 600; letter-spacing: 0.01em; }
    .button-shape { cursor: pointer; }
    .button-shape:hover { opacity: 0.85; }

    /* Dimmed style for main header text */
    #main-header.dimmed .main-header-text {
        fill: #563d1f;
    }

    /* Shifted colors for main header shapes */
    #main-header.shifted #main-header-path-left,
    #main-header.shifted #main-header-path-right {
        fill: #ffec93;
    }
    #main-header.shifted #main-header-rect-middle1,
    #main-header.shifted #main-header-rect-middle2 {
        fill: #fee457;
    }
    /* Keep text dimmed when shifted */
    #main-header.shifted .main-header-text {
         fill: #563d1f; /* Keep dimmed color */
    }

    /* Sliding elements state (uses elements-shifted class) */
    g#main-header.elements-shifted {
        /* Set CSS variable for slide distance */
        --slide-x-distance: calc(var(--container-width) / 3);
    }
    #main-header.elements-shifted #main-header-path-left,
    #main-header.elements-shifted #main-header-rect-middle1,
    #main-header.elements-shifted #main-header-rect-middle2 {
        transform: translateX(var(--slide-x-distance));
    }

    /* Slid Right state (for text opacity - uses slid-right class) */
    #main-header.slid-right .main-header-text {
        opacity: 0;
    }

    /* New Right Elbow */
    #main-header-path-map-right-elbow {
        opacity: 0;
    }
    /* Use a separate class for the delayed fade-in */
    #main-header-path-map-right-elbow.fade-in-after-slide {
        opacity: 1;
    }

    /* New Bottom Rectangles */
    #main-header-map-overlay-rect-1,
    #main-header-map-overlay-rect-2 {
        opacity: 0;
    }
    #main-header-map-overlay-rect-1.fade-in-after-slide,
    #main-header-map-overlay-rect-2.fade-in-after-slide {
        opacity: 1;
    }

    /* New Left Rectangles */
    #main-header-map-left-rect-1,
    #main-header-map-left-rect-2,
    #main-header-map-left-rect-3,
    #main-header-map-left-rect-4 {
        opacity: 0;
    }
    #main-header-map-left-rect-1.fade-in-after-slide,
    #main-header-map-left-rect-2.fade-in-after-slide,
    #main-header-map-left-rect-3.fade-in-after-slide,
    #main-header-map-left-rect-4.fade-in-after-slide {
        opacity: 1;
    }

    /* Styles for button hiding */
    #vertical-buttons.buttons-hidden .button-shape,
    #vertical-buttons.buttons-hidden .button-text {
        opacity: 0;
        pointer-events: none; /* Still useful to prevent interaction during fade */
    }

    /* Styles for overlay rectangles */
    .overlay-rect {
        opacity: 0; /* Hidden by default */
    }
    .overlay-rect.visible {
        opacity: 1; /* Visible state */
    }

    .clock-text {
        font-weight: 500;
        letter-spacing: 0.01em;
    }

    /* Log widget animations - restored */
    .log-text {
        font-size: ${LOG_FONT_SIZE_PX}px;
        font-weight: 500;
        transition: transform ${ANIMATION_SLIDE_DURATION_MS}ms ease-out,
                    opacity ${ANIMATION_FADE_DURATION_S}s linear,
                    fill ${ANIMATION_FADE_DURATION_S}s linear;
    }
    .log-text-new {
        opacity: 0;
        animation: log-enter-flash ${ANIMATION_FLASH_TOTAL_DURATION_S}s ease-out forwards;
        transition: none;
    }
    .error-text {
        fill: var(--error-color, #db4437);
        font-weight: bold;
        transition: none;
        animation: none;
        opacity: 1 !important;
    }

    @keyframes log-enter-flash {
      0%, ${ANIMATION_FLASH_WAIT_PERCENT}% { opacity: 0; }
      ${ANIMATION_FLASH_WAIT_PERCENT + 10}%, ${ANIMATION_FLASH_WAIT_PERCENT + 30}%, 100% { opacity: 1; }
      ${ANIMATION_FLASH_WAIT_PERCENT + 20}% { opacity: 0; }
    }

    /* Specific styles for shifted button overlays */
    g#button-overlays.shifted .overlay-rect.bottom-duplicate-1 {
        opacity: 0; /* Keep initial opacity 0 for delay */
        clip-path: inset(0 0 100% 0); /* Initial clipped state */
    }

    /* Style for the new elbow */
    g#button-overlays.shifted .bottom-elbow {
        opacity: 0; /* Start hidden */
        clip-path: inset(0 0 100% 0); /* Initial clipped state */
    }

    /* Style for the duplicate rectangles */
    g#button-overlays.shifted .overlay-rect.bottom-duplicate-2 {
        opacity: 0; /* Start hidden */
        clip-path: inset(0 0 100% 0); /* Initial clipped state */
    }

    /* Style for the back triangle/button */
    .back-triangle {
        opacity: 0; /* Start hidden */
    }
    .back-triangle.fade-in-after-slide {
        opacity: 1;
    }
`; 