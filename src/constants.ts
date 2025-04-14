import { LcarsButtonConfig } from "./types";

// --- Constants for Layout ---
export const MAIN_HEADER_FONT_SIZE_PX = 49;
export const TOP_HEADER_FONT_SIZE_PX = 23;
export const BUTTON_FONT_SIZE_PX = 18;
export const LOG_FONT_SIZE_PX = 16;
export const LOG_LINE_HEIGHT_PX = 22;
export const AVG_CHAR_WIDTH_PX = LOG_FONT_SIZE_PX * 0.75; // Adjusted estimate
export const MAX_LOG_CHARS = 34; // Fixed character limit for log truncation
export const CLOCK_TIME_FONT_SIZE_PX = 22;
export const CLOCK_DATE_FONT_SIZE_PX = 22;
export const CLOCK_AREA_LINE_HEIGHT_PX = 26;
export const LOG_AREA_TOP_MARGIN_PX = 20;
export const MAX_LOG_MESSAGES = 15;
export const HEADER_SPACING_PX = 11;
export const HORIZONTAL_GAP_PX = 5;
export const VERTICAL_GAP_PX = 5;
export const MAIN_HEADER_BUTTON_GAP_PX = 5;
export const ELBOW_HORIZONTAL_WIDTH_PX = 200;
export const ELBOW_VERTICAL_WIDTH_PX = 150;
export const BUTTON_HEIGHT_PX = 60;
export const DEFAULT_FILLER_BAR_HEIGHT_PX = 150;
export const OVERLAY_RECT_WIDTH_REDUCTION_PX = 20;
// Minimum width for the bar segments next to text/clock
export const MIN_BAR_WIDTH_PX = 5;
// Animation constants for log messages
export const ANIMATION_FLASH_TOTAL_DURATION_S = 0.5;
export const ANIMATION_FADE_DURATION_S = 0.2;
export const ANIMATION_SLIDE_DURATION_MS = 300; // Needed for log animation
export const ANIMATION_FLASH_WAIT_PERCENT = Math.round((ANIMATION_SLIDE_DURATION_MS / (ANIMATION_FLASH_TOTAL_DURATION_S * 1000)) * 100);
export const LOG_FADE_MEDIUM_MS = 15000;
export const LOG_FADE_OUT_MS = 30000;
export const UPDATE_INTERVAL_MS = 100;
export const SVG_HEIGHT_BUFFER_PX = 5;

// --- Button Data ---
export const DEFAULT_BUTTONS: LcarsButtonConfig[] = [
    { text: "SHIP MAP", colorVar: "--primary", action: "nav_ship_map" }, // Index 0
    { text: "JWST IMAGES", colorVar: "--secondaryBright" },             // Index 1
    { text: "SICKBAY", colorVar: "--secondaryBright" },                 // Index 2
    { text: "BUFFER TIME", colorVar: "--secondaryBrighter" },           // Index 3
    { text: "RED ALERT", colorVar: "--primarySat" },                    // Index 4
    { text: "AUTO MODE", colorVar: "--secondaryBrightest" },            // Index 5
    { text: "ABOUT", colorVar: "--secondaryBright" },                   // Index 6
];

// --- Calculate SVG height parts ---
// REMOVED: export const TOP_HEADER_AREA_HEIGHT = TARGET_TOP_HEIGHT_PX + HEADER_SPACING_PX; 