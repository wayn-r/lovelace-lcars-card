import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "../../utils/color-resolver.js";
import { AnimationContext } from "../../utils/animation.js";
import { Color, ColorStateContext } from "../../utils/color.js";
import { Action } from "../../types.js";
import { handleHassAction, isCustomAction, validateAction } from "../../utils/action-helpers.js";

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
                id=${this._id + "__shape"}
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
        
        // Button elements only include click handler for action execution
        // All hover/mouse state is handled by parent LayoutElement
        return svg`
            <g
                class="lcars-button-group"
                @click=${this.handleClick.bind(this)}
                style="cursor: pointer; outline: none;"
                role="button"
                aria-label=${elementId}
                tabindex="0"
                @keydown=${this.handleKeyDown.bind(this)}
            >
                ${elements}
            </g>
        `;
    }
    
    private handleClick(ev: Event): void {
        const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
        
        if (!this._hass || !buttonConfig?.action_config) {
            return; 
        }
        
        ev.stopPropagation();
    
        this.executeButtonAction(buttonConfig, ev.currentTarget as Element);
    }
    
    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ' ') {
            this.handleClick(e);
        }
    }
    
    private executeButtonAction(buttonConfig: LcarsButtonElementConfig, element?: Element): void {
        if (!buttonConfig.action_config) {
            return;
        }

        // Check if we have multiple actions or a single action
        if (buttonConfig.action_config.actions && Array.isArray(buttonConfig.action_config.actions)) {
            // Execute multiple actions - convert each action to unified format
            buttonConfig.action_config.actions.forEach(singleAction => {
                const unifiedAction: Action = this.convertToUnifiedAction(singleAction);
                this.executeUnifiedAction(unifiedAction, element);
            });
        } else {
            // Execute single action - convert from old format to unified Action
            const action: Action = this.convertLegacyActionToUnified(buttonConfig.action_config);

            // For toggle and more-info actions, use element ID as entity if not specified
            if ((action.action === 'toggle' || action.action === 'more-info') && !action.entity) {
                action.entity = this._id;
            }

            this.executeUnifiedAction(action, element);
        }
    }

    /**
     * Convert a SingleActionDefinition to the unified Action interface
     */
    private convertToUnifiedAction(singleAction: any): Action {
        // Handle action type conversion (set-state -> set_state)
        let actionType = singleAction.action;
        if (actionType === 'set-state') {
            actionType = 'set_state';
        }

        return {
            action: actionType,
            service: singleAction.service,
            service_data: singleAction.service_data,
            target: singleAction.target,
            navigation_path: singleAction.navigation_path,
            url_path: singleAction.url_path,
            entity: singleAction.entity,
            target_element_ref: singleAction.target_element_ref || singleAction.target_id,
            state: singleAction.state,
            states: singleAction.states,
            confirmation: singleAction.confirmation
        };
    }

    /**
     * Convert legacy LcarsButtonActionConfig to the unified Action interface
     */
    private convertLegacyActionToUnified(actionConfig: any): Action {
        return {
            action: actionConfig.type || 'none',
            service: actionConfig.service,
            service_data: actionConfig.service_data,
            target: actionConfig.target,
            navigation_path: actionConfig.navigation_path,
            url_path: actionConfig.url_path,
            entity: actionConfig.entity,
            target_element_ref: actionConfig.target_element_ref,
            state: actionConfig.state,
            states: actionConfig.states,
            confirmation: actionConfig.confirmation
        };
    }
    
    private executeUnifiedAction(action: Action, element?: Element): void {
        if (!this._hass) {
            console.error(`[${this._id}] No hass object available for action execution`);
            return;
        }

        // Validate the action
        const validationErrors = validateAction(action);
        if (validationErrors.length > 0) {
            console.warn(`[${this._id}] Action validation failed:`, validationErrors);
            return;
        }

        // Handle custom actions
        if (isCustomAction(action)) {
            this.executeCustomAction(action);
            return;
        }

        // Handle standard Home Assistant actions using the unified wrapper
        this.executeHassAction(action, element);
    }

    private executeCustomAction(action: Action): void {
        // Import stateManager dynamically to avoid circular dependencies
        import('../../utils/state-manager.js').then(({ stateManager }) => {
            try {
                switch (action.action) {
                    case 'set_state':
                        stateManager.executeSetStateAction(action);
                        break;
                    case 'toggle_state':
                        stateManager.executeToggleStateAction(action);
                        break;
                    default:
                        console.warn(`[${this._id}] Unknown custom action: ${action.action}`);
                }
                this._requestUpdateCallback?.();
            } catch (error) {
                console.error(`[${this._id}] Custom action execution failed:`, error);
                this._requestUpdateCallback?.();
            }
        }).catch(error => {
            console.error(`[${this._id}] Failed to import stateManager:`, error);
        });
    }

    private executeHassAction(action: Action, element?: Element): void {
        // Get target element for the action
        let targetElement: HTMLElement = element as HTMLElement;
        
        if (!targetElement) {
            const foundElement = document.getElementById(this._id);
            if (foundElement) {
                targetElement = foundElement;
            } else {
                // Create a fallback element with the correct ID
                targetElement = document.createElement('div');
                targetElement.id = this._id;
                console.warn(`[${this._id}] Could not find DOM element, using fallback`);
            }
        }

        // Use the unified action helper
        handleHassAction(action, targetElement, this._hass!)
            .then(() => {
                // Force immediate update for state-changing actions
                if (action.action === 'toggle' || action.action === 'call-service') {
                    // Use shorter timeout for immediate responsiveness to action feedback
                    setTimeout(() => {
                        this._requestUpdateCallback?.();
                    }, 25); // Quick feedback for user actions
                } else {
                    // Normal update callback for other actions
                    this._requestUpdateCallback?.();
                }
            })
            .catch(error => {
                console.error(`[${this._id}] handleHassAction failed:`, error);
                // Still trigger update even if action failed
                this._requestUpdateCallback?.();
            });
    }

    updateHass(hass?: HomeAssistant): void {
        this._hass = hass;
    }

    cleanup(): void {
        // No-op: State and timeouts are now managed by the parent LayoutElement
    }
} 