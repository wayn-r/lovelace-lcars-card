import {
    LcarsCardConfig,
    LcarsView,
    LogMessage,
    LcarsButtonConfig
} from "../types";
import { LitElement, PropertyValues } from 'lit';

// Define the structure for transition state updates
interface TransitionUpdate {
    isTransitioning?: boolean;
    mainHeaderDimmed?: boolean;
    mainHeaderShifted?: boolean;
    clockVisible?: boolean;
    dateVisible?: boolean;
    buttonsVisible?: boolean;
    overlayRectsVisible?: boolean;
    elementsShiftedRight?: boolean;
    currentView?: LcarsView;
}

// Define the interface for the card element that manages state
interface TransitionManagerHost extends LitElement {
    _isTransitioning: boolean;
    _mainHeaderDimmed: boolean;
    _mainHeaderShifted: boolean;
    _clockVisible: boolean;
    _dateVisible: boolean;
    _buttonsVisible: boolean;
    _overlayRectsVisible: boolean;
    _elementsShiftedRight: boolean;
    _currentView: LcarsView;
    _transitionTimeouts: number[];
    requestUpdate(name?: PropertyKey | undefined, oldValue?: unknown): void;
    clearTimeouts(): void;
}

export class TransitionManager {
    private host: TransitionManagerHost;

    constructor(host: TransitionManagerHost) {
        this.host = host;
    }

    // Centralized state update method
    private updateState(updates: TransitionUpdate) {
        let changed = false;
        for (const key in updates) {
            const stateKey = `_${key}` as keyof TransitionManagerHost;
            if (updates.hasOwnProperty(key) && this.host[stateKey] !== updates[key as keyof TransitionUpdate]) {
                (this.host[stateKey] as any) = updates[key as keyof TransitionUpdate];
                changed = true;
            }
        }
        if (changed) {
            this.host.requestUpdate();
        }
    }

    // Handler for Ship Map transition - simplified without animations
    public handleShipMapClick(): void {
        if (this.host._isTransitioning) return;
        
        console.log("LCARS Card: Starting Ship Map transition...");
        this.host.clearTimeouts();
        
        // Update all states at once to switch to ship map view
        this.updateState({
            isTransitioning: true,
            mainHeaderDimmed: true,
            mainHeaderShifted: true,
            clockVisible: false,
            dateVisible: false,
            buttonsVisible: false,
            overlayRectsVisible: true,
            elementsShiftedRight: true,
            currentView: 'shipMap'
        });
        
        // Set transition to complete immediately
        this.updateState({ isTransitioning: false });
    }
} 