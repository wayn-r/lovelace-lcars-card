import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "../../utils/color-resolver.js";
import { AnimationContext } from "../../utils/animation.js";
import { Color, ColorStateContext } from "../../utils/color.js";

export type ButtonPropertyName = 'fill' | 'stroke' | 'strokeWidth';

export class Button {
    private _props: any;
    private _hass?: HomeAssistant;
    private _requestUpdateCallback?: () => void;
    private _id: string;
    private _getShadowElement?: (id: string) => Element | null;

    constructor(id: string, props: any, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        this._id = id;
        this._props = props;
        this._hass = hass;
        this._requestUpdateCallback = requestUpdateCallback;
        this._getShadowElement = getShadowElement;
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
     * Get resolved colors for the button using the new color resolver
     */
    private getResolvedColors(stateContext: ColorStateContext) {
        const context = this.getAnimationContext();
        
        return colorResolver.resolveAllElementColors(
            this._id,
            this._props,
            context,
            {},
            stateContext
        );
    }

    createButton(
        pathData: string,
        x: number,
        y: number,
        width: number,
        height: number,
        options: {
            rx: number
        },
        stateContext: ColorStateContext
    ): SVGTemplateResult {
        // Use the new color resolver to get colors with hover/active state support
        const resolvedColors = this.getResolvedColors(stateContext);
        
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
            isButton: this._props.button?.enabled === true,
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
                // No-op: Timeouts are now managed by the parent LayoutElement
            },
            
            handleMouseLeave: (): void => {
                // No-op: Timeouts are now managed by the parent LayoutElement
            },
            
            handleMouseDown: (): void => {
                // No-op: Timeouts are now managed by the parent LayoutElement
            },
            
            handleMouseUp: (): void => {
                // No-op: Timeouts are now managed by the parent LayoutElement
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

    cleanup(): void {
        // No-op: State and timeouts are now managed by the parent LayoutElement
    }
} 