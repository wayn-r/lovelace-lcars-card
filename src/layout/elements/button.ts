import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "../../utils/color.js";
import { AnimationContext } from "../../utils/animation.js";
import { Color, ColorStateContext } from "../../utils/color.js";

export type ButtonPropertyName = 'fill' | 'stroke' | 'strokeWidth';

export class Button {
    private _isHovering = false;
    private _isActive = false;
    private _props: any;
    private _hass?: HomeAssistant;
    private _requestUpdateCallback?: () => void;
    private _id: string;
    private _getShadowElement?: (id: string) => Element | null;
    private _hoverTimeout?: ReturnType<typeof setTimeout>;
    private _lastHoverState = false;
    private _activeTimeout?: ReturnType<typeof setTimeout>;
    private _lastActiveState = false;

    constructor(id: string, props: any, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        this._id = id;
        this._props = props;
        this._hass = hass;
        this._requestUpdateCallback = requestUpdateCallback;
        this._getShadowElement = getShadowElement;
    }

    get isHovering(): boolean {
        return this._isHovering;
    }

    set isHovering(value: boolean) {
        if (this._isHovering === value) return;
        
        this._isHovering = value;
        
        // Clear any existing timeout
        if (this._hoverTimeout) {
            clearTimeout(this._hoverTimeout);
        }
        
        // Debounce hover state changes to prevent flickering
        this._hoverTimeout = setTimeout(() => {
            if (this._lastHoverState !== this._isHovering) {
                this._lastHoverState = this._isHovering;
                
                // Instead of triggering a global re-render, try to update just this button's appearance
                this._updateButtonAppearanceDirectly();
            }
            this._hoverTimeout = undefined;
        }, 10); // Reduced from 50ms to 10ms for better responsiveness
    }

    get isActive(): boolean {
        return this._isActive;
    }

    set isActive(value: boolean) {
        if (this._isActive === value) return;
        
        this._isActive = value;
        
        // Clear any existing timeout
        if (this._activeTimeout) {
            clearTimeout(this._activeTimeout);
        }
        
        // Debounce active state changes to prevent flickering
        this._activeTimeout = setTimeout(() => {
            if (this._lastActiveState !== this._isActive) {
                this._lastActiveState = this._isActive;
                
                // Instead of triggering a global re-render, try to update just this button's appearance
                this._updateButtonAppearanceDirectly();
            }
            this._activeTimeout = undefined;
        }, 10); // Reduced from 50ms to 10ms for better responsiveness
    }

    /**
     * Get the current animation context for this button
     */
    private getAnimationContext(): AnimationContext {
        return {
            elementId: this._id,
            getShadowElement: this._getShadowElement,
            hass: this._hass,
            requestUpdateCallback: this._requestUpdateCallback
        };
    }

    /**
     * Get the current state context for this button
     */
    private getStateContext(): ColorStateContext {
        return {
            isCurrentlyHovering: this._isHovering,
            isCurrentlyActive: this._isActive
        };
    }

    /**
     * Get resolved colors for the button using the new color resolver
     */
    private getResolvedColors() {
        const context = this.getAnimationContext();
        const stateContext = this.getStateContext();
        
        return colorResolver.resolveAllElementColors(
            this._id,
            this._props,
            context,
            {},
            stateContext
        );
    }

    getButtonProperty<T>(propName: ButtonPropertyName, defaultValue?: T): T | string | undefined {
        const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
        
        if (!buttonConfig?.enabled) {
            return this._props[propName] ?? defaultValue;
        }
        
        return this.resolveStateBasedProperty(buttonConfig, propName, defaultValue);
    }
    
    private resolveStateBasedProperty<T>(
        buttonConfig: LcarsButtonElementConfig, 
        propName: ButtonPropertyName, 
        defaultValue?: T
    ): T | string | undefined {
        if (this._isActive) {
            const activeProp = `active_${propName}` as keyof LcarsButtonElementConfig;
            const activeValue = buttonConfig[activeProp];
            if (activeValue !== undefined) {
                return this.formatValueForProperty(propName, activeValue);
            }
        }
        
        if (this._isHovering) {
            const hoverProp = `hover_${propName}` as keyof LcarsButtonElementConfig;
            const hoverValue = buttonConfig[hoverProp];
            if (hoverValue !== undefined) {
                return this.formatValueForProperty(propName, hoverValue);
            }
        }
        
        const directProp = propName as keyof LcarsButtonElementConfig;
        if (buttonConfig[directProp] !== undefined) {
            return this.formatValueForProperty(propName, buttonConfig[directProp]);
        }
        
        return this.formatValueForProperty(propName, this._props[propName] ?? defaultValue);
    }
    
    private formatValueForProperty<T>(propName: ButtonPropertyName, value: any): T | string | undefined {
        if ((propName === 'fill' || propName === 'stroke') && value !== undefined) {
            // Use the new Color class for color formatting
            const color = Color.fromValue(value, 'transparent');
            return color.toStaticString();
        }
        
        return value;
    }

    createButton(
        pathData: string,
        x: number,
        y: number,
        width: number,
        height: number,
        options: {
            rx: number
        }
    ): SVGTemplateResult {
        // Use the new color resolver to get colors with hover/active state support
        const resolvedColors = this.getResolvedColors();
        
        const pathElement = svg`
            <path
                id=${this._id}
                d=${pathData}
                fill=${resolvedColors.fillColor}
                stroke=${resolvedColors.strokeColor}
                stroke-width=${resolvedColors.strokeWidth}
            />
        `;
        
        return this.createButtonGroup([pathElement], {
            isButton: true,
            elementId: this._id
        });
    }

    createButtonGroup(
        elements: SVGTemplateResult[],
        config: {
            isButton: boolean,
            elementId: string
        }
    ): SVGTemplateResult {
        const { isButton, elementId } = config;
        
        if (!isButton) {
            return svg`<g>${elements}</g>`;
        }
        
        const buttonHandlers = this.createEventHandlers();
        
        return svg`
            <g
                class="lcars-button-group"
                @click=${buttonHandlers.handleClick}
                @mouseenter=${buttonHandlers.handleMouseEnter}
                @mouseleave=${buttonHandlers.handleMouseLeave}
                @mousedown=${buttonHandlers.handleMouseDown}
                @mouseup=${buttonHandlers.handleMouseUp}
                style="cursor: pointer; outline: none;"
                role="button"
                aria-label=${elementId}
                tabindex="0"
                @keydown=${buttonHandlers.handleKeyDown}
            >
                ${elements}
            </g>
        `;
    }
    
    createEventHandlers() {
        return {
            handleClick: (ev: Event): void => {
                
                const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
                
                if (!this._hass || !buttonConfig?.action_config) {
                    return; 
                }
                
                ev.stopPropagation();
            
                const actionConfig = this.createActionConfig(buttonConfig);
                this.executeAction(actionConfig, ev.currentTarget as Element);
            },
            
            handleMouseEnter: (): void => {
                this.isHovering = true;
            },
            
            handleMouseLeave: (): void => {
                this.isHovering = false;
                this.isActive = false;
            },
            
            handleMouseDown: (): void => {
                this.isActive = true;
            },
            
            handleMouseUp: (): void => {
                this.isActive = false;
            },
            
            handleKeyDown: (e: KeyboardEvent): void => {
                if (e.key === 'Enter' || e.key === ' ') {
                    this.createEventHandlers().handleClick(e);
                }
            }
        };
    }
    
    private createActionConfig(buttonConfig: LcarsButtonElementConfig) {
        const actionConfig: any = {
            tap_action: { 
                action: buttonConfig.action_config?.type,
                service: buttonConfig.action_config?.service,
                service_data: buttonConfig.action_config?.service_data,
                navigation_path: buttonConfig.action_config?.navigation_path,
                url: buttonConfig.action_config?.url_path,
                entity: buttonConfig.action_config?.entity,
                // Custom action properties
                target_element_ref: buttonConfig.action_config?.target_element_ref,
                state: buttonConfig.action_config?.state,
                states: buttonConfig.action_config?.states,
                actions: buttonConfig.action_config?.actions,
            },
            confirmation: buttonConfig.action_config?.confirmation,
        };

        // For toggle and more-info actions, we need to provide the entity if not explicitly set
        if (buttonConfig.action_config?.type === 'toggle' || buttonConfig.action_config?.type === 'more-info') {
            if (!actionConfig.tap_action.entity) {
                // Use the element ID as the entity ID (this assumes the element ID is an entity ID like "light.living_room")
                actionConfig.tap_action.entity = this._id;
            }
        }

        // Add entity at root level for toggle actions (required by custom-card-helpers)
        if (buttonConfig.action_config?.type === 'toggle' || buttonConfig.action_config?.type === 'more-info') {
            actionConfig.entity = actionConfig.tap_action.entity;
        }

        // Debug logging

        return actionConfig;
    }
    
    private executeAction(actionConfig: any, element?: Element): void {
        const hass = this._hass;
        const actionType = actionConfig?.tap_action?.action;
        
        // Handle custom actions
        if (this.isCustomAction(actionType)) {
            this.executeCustomAction(actionConfig);
            return;
        }
        
        // Handle standard Home Assistant actions
        if (hass) {
            import("custom-card-helpers").then(({ handleAction }) => {
                // Use the provided element from the event, or try to find it, or create a fallback
                let targetElement: HTMLElement = element as HTMLElement;
                
                // If no element provided, try to find it by ID
                if (!targetElement) {
                    const foundElement = document.getElementById(this._id);
                    if (foundElement) {
                        targetElement = foundElement;
                    }
                }
                
                // If still not found, create a fallback element with the correct ID
                if (!targetElement) {
                    targetElement = document.createElement('div');
                    targetElement.id = this._id;
                    console.warn(`[${this._id}] Could not find DOM element, using fallback`);
                }
                
                try {
                    handleAction(targetElement, hass, actionConfig as any, "tap");
                    
                    // Force immediate update for state-changing actions
                    if (actionType === 'toggle' || actionType === 'call-service') {
                        // Use shorter timeout for immediate responsiveness to action feedback
                        setTimeout(() => {
                            this._requestUpdateCallback?.();
                        }, 25); // Quick feedback for user actions
                    } else {
                        // Normal update callback for other actions
                        this._requestUpdateCallback?.();
                    }
                } catch (error) {
                    console.error(`[${this._id}] handleAction failed:`, error);
                    // Still trigger update even if action failed
                    this._requestUpdateCallback?.();
                }
            }).catch(error => {
                console.error(`[${this._id}] Failed to import handleAction:`, error);
            });
        } else {
            console.error(`[${this._id}] No hass object available for action execution`);
        }
    }

    private isCustomAction(actionType: string): boolean {
        return ['set_state', 'toggle_state', 'multi_action'].includes(actionType);
    }

    private executeCustomAction(actionConfig: any): void {
        const actionType = actionConfig?.tap_action?.action;
        
        // Import stateManager dynamically to avoid circular dependencies
        import('../../utils/state-manager.js').then(({ stateManager }) => {
            try {
                this._dispatchCustomAction(actionType, actionConfig, stateManager);
                this._requestUpdateCallback?.();
            } catch (error) {
                console.error(`[${this._id}] Custom action execution failed:`, error);
                this._requestUpdateCallback?.();
            }
        }).catch(error => {
            console.error(`[${this._id}] Failed to import stateManager:`, error);
        });
    }

    private _dispatchCustomAction(actionType: string, actionConfig: any, stateManager: any): void {
        switch (actionType) {
            case 'set_state':
                this._executeSetStateAction(actionConfig, stateManager);
                break;
            case 'toggle_state':
                this._executeToggleStateAction(actionConfig, stateManager);
                break;
            case 'multi_action':
                this._executeMultiAction(actionConfig.tap_action.actions);
                break;
            default:
                console.warn(`[${this._id}] Unknown custom action: ${actionType}`);
        }
    }

    private _executeSetStateAction(actionConfig: any, stateManager: any): void {
        const targetElementRef = actionConfig.tap_action.target_element_ref;
        const state = actionConfig.tap_action.state;
        
        if (!targetElementRef || !state) {
            console.warn(`[${this._id}] set_state action missing target_element_ref or state`);
            return;
        }
        
        stateManager.setState(targetElementRef, state);
    }

    private _executeToggleStateAction(actionConfig: any, stateManager: any): void {
        const targetElementRef = actionConfig.tap_action.target_element_ref;
        const states = actionConfig.tap_action.states;
        
        if (!targetElementRef || !states || !Array.isArray(states)) {
            console.warn(`[${this._id}] toggle_state action missing target_element_ref or states array`);
            return;
        }
        
        stateManager.toggleState(targetElementRef, states);
    }

    private _executeMultiAction(actions: any[]): void {
        actions.forEach(action => this.executeAction(action));
    }

    updateHass(hass?: HomeAssistant): void {
        this._hass = hass;
    }

    // Add cleanup method for timeouts
    cleanup(): void {
        if (this._hoverTimeout) {
            clearTimeout(this._hoverTimeout);
            this._hoverTimeout = undefined;
        }
        if (this._activeTimeout) {
            clearTimeout(this._activeTimeout);
            this._activeTimeout = undefined;
        }
    }

    private _updateButtonAppearanceDirectly(): void {
        // Try to update the button's appearance directly in the DOM to avoid global re-renders
        if (!this._getShadowElement) {
            // Fallback to global update if we can't target the specific element
            this._requestUpdateCallback?.();
            return;
        }
        
        // Find the button's DOM element
        const buttonElement = this._getShadowElement(this._id);
        if (!buttonElement) {
            // Element not found in DOM yet, fall back to global update
            this._requestUpdateCallback?.();
            return;
        }
        
        try {
            // Get the resolved colors with current interactive state
            const resolvedColors = this.getResolvedColors();
            
            // Update the fill color directly if it exists
            if (resolvedColors.fillColor) {
                buttonElement.setAttribute('fill', resolvedColors.fillColor);
            }
            
            // Update stroke color if it exists
            if (resolvedColors.strokeColor && resolvedColors.strokeColor !== 'none') {
                buttonElement.setAttribute('stroke', resolvedColors.strokeColor);
            }
            
            // Update stroke width if it exists
            if (resolvedColors.strokeWidth) {
                buttonElement.setAttribute('stroke-width', resolvedColors.strokeWidth);
            }
            
        } catch (error) {
            console.warn(`[${this._id}] Direct appearance update failed, falling back to global update:`, error);
            // Fall back to global update if direct update fails
            this._requestUpdateCallback?.();
        }
    }
} 