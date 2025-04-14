import { HassEntity } from "home-assistant-js-websocket";

// --- Type for different views ---
export type LcarsView = 'home' | 'shipMap'; // Add other views later

// --- Interfaces ---
export interface StateChangedEvent {
    event_type: string;
    data: {
        entity_id: string;
        old_state: HassEntity | null;
        new_state: HassEntity | null;
    };
    origin: string;
    time_fired: string;
}

// Structure for storing log messages in state
export interface LogMessage {
    id: string; // Unique identifier
    text: string; // Formatted message text (UPPERCASE, potentially truncated)
    timestamp: number; // Arrival time ms
}

export interface LcarsCardConfig {
  entity: string;
  header_text?: string;
  top_header_left_text?: string;
  top_header_right_text?: string;
  buttons?: LcarsButtonConfig[];
  ship_map_bottom_header_text?: string;
}

export interface LcarsButtonConfig {
    text: string;
    colorVar?: string;
    action?: string; // Optional action identifier
}

// --- HOME VIEW LAYOUT --- //
// Interface for the structure returned by calculateLayout (Home View)
export interface LcarsLayout {
    containerWidth: number;
    totalSvgHeight: number;
    topHeader: TopHeaderLayout;
    mainHeader: MainHeaderLayout;
    buttons: ButtonLayout[];
    fillerBar: FillerBarLayout;
    logArea: LogAreaLayout;
    clockArea: ClockAreaLayout;
}

// --- SHIP MAP VIEW LAYOUT --- //
// Interface for the structure returned by calculateShipMapLayout
export interface LcarsShipMapLayout {
    containerWidth: number;
    totalSvgHeight: number;
    topHeader: TopHeaderLayout;
    mainHeader: ShipMapMainHeaderLayout;
    buttonOverlays: ShipMapButtonOverlaysLayout;
    bottomHeader: BottomHeaderLayout;
    logArea: LogAreaLayout;
    clock: ShipMapClockLayout;
    // Left side elements
    leftCorner: ShipMapLeftCornerLayout;
    leftColumnRects: RectangleElement[]; // Updated type
    leftHeaderElbow: ElbowElement; // Updated type
    // State flags
    displayClockFormat: 'full' | 'short' | 'none';
    useAbbreviatedText: boolean;
}


// --- Minimal Context for ShipMap Layout Calculation ---
// Contains only the necessary geometric data derived from the Home Layout
export interface HomeLayoutContextForShipMap {
    mainHeaderHeight: number;
    mainHeaderElbowTotalHeight: number;
    // Array containing only the y and height of relevant buttons
    // Indices correspond to the original homeLayout.buttons array
    buttonGeometry: Array<{ y: number; height: number } | undefined>; 
}

// --- SHARED / COMMON LAYOUT COMPONENTS --- //
export interface TopHeaderLayout {
    y: number;
    height: number;
    fontSize: number;
    textLeftX: number;
    textLeftY: number;
    textLeftWidth: number;
    textRightX: number;
    textRightY: number;
    textRightWidth: number;
    leftEndcap: EndcapElement;
    middleRect: RectangleElement;
    rightEndcap: EndcapElement;
}

export interface FillerBarLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    bottomY: number;
}

export interface LogAreaLayout {
    x: number;
    y: number;
    bottomY: number;
    textAnchor: 'start' | 'middle' | 'end';
}

export interface ClockAreaLayout {
    x: number; // For group transform in Home view
    y: number; // Anchor Y / group transform Y
    timeY_abs: number;
    dateY_abs: number;
    timeX_abs?: number; // Optional absolute X for time (ShipMap)
    // Optional style overrides
    timeFontSize?: number;
    timeFillColor?: string;
}

export interface ButtonLayout { // For Home View Vertical Buttons
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    textX: number;
    textY: number;
    colorVar: string;
    action?: string;
}

// --- Import Element Classes ---
import {
    RectangleElement,
    TextElement,
    ChiselEndcapElement,
    ElbowElement,
    EndcapElement,
    TriangleElement
} from './layout/layout-elements';

// --- HOME VIEW SPECIFIC LAYOUTS --- //
export interface MainHeaderLayout { // Home View Main Header
    y: number;
    height: number;
    elbowTotalHeight: number; // Add back needed metadata
    leftElbow: ElbowElement;
    middleRect1: RectangleElement;
    rightEndcap: EndcapElement;
    rightEndcapX: number;
    rightEndcapWidth: number;
    text: TextElement;
    useAbbreviatedText: boolean; // Add back needed metadata
}

// --- SHIP MAP VIEW SPECIFIC LAYOUTS --- //
// Interface for MapRectLayout used within ShipMap layouts
// Still used by ShipMapButtonOverlaysLayout, keep it.
export interface MapRectLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
}

export interface ShipMapMainHeaderLayout {
    y: number;
    height: number;
    elbowTotalHeight: number; // Add back
    leftElbow: ElbowElement;
    middleRect1: RectangleElement;
    rightEndcap: ChiselEndcapElement;
    rightEndcapX: number;
    rightEndcapWidth: number;
    mapRightElbow: ElbowElement;
    mapRightElbowX: number; // Keep X separate
    mapOverlayRects: RectangleElement[];
    mapLeftRects: RectangleElement[];
    mapText: TextElement;
    middleRect2: RectangleElement;
    useAbbreviatedText: boolean; // Add back needed metadata
}

export interface ShipMapButtonOverlaysLayout {
    groupTransform: string; // Final transform for the overlay group
    overlayRects: MapRectLayout[]; // Final state of the 4 overlay rects
    lastOverlayFill: string; // Add the fill of the last rect (used by bottom header)
    overlayWidth: number; // Add the width of the overlay rects
}

export interface BottomHeaderLayout {
    barLeftX: number;
    barLeftWidth: number;
    barRightX: number;
    barRightWidth: number;
    barY: number;
    barHeight: number;
    fillColor: string;
    endcap: EndcapElement;
    textX: number;
    textY: number;
    textContent: string;
    textWidth: number;
    textHeight: number;
    bottomElbow: ElbowElement;
}

// Add layout for the clock in ShipMap view
export interface ShipMapClockLayout {
    timeX: number; 
    timeY: number;
}

// Add interfaces for new left-side elements
export interface ShipMapLeftCornerLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    cornerTriangle: TriangleElement;
} 