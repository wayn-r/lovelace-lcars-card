import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "./color-resolver.js";
import { AnimationContext } from "./animation.js";
import { ColorStateContext } from "./color.js";
import { Action } from "../types.js";
import { handleHassAction, isCustomAction, validateAction } from "./action-helpers.js";
import { stateManager } from "./state-manager.js";

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

    private getAnimationContext(): AnimationContext {
        return {
            elementId: this._id,
            getShadowElement: this._getShadowElement,
            hass: this._hass,
            requestUpdateCallback: this._requestUpdateCallback
        };
    }

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
        options: { rx: number },
        stateContext: ColorStateContext
    ): SVGTemplateResult {
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
        config: { isButton: boolean; elementId: string }
    ): SVGTemplateResult {
        const { isButton, elementId } = config;
        if (!isButton) {
            return svg`<g>${elements}</g>`;
        }
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
        const buttonConfig = this._props.button as any;
        if (!this._hass || !buttonConfig?.enabled) {
            return;
        }
        ev.stopPropagation();
        if (buttonConfig.actions?.tap) {
            this.executeActionDefinition(buttonConfig.actions.tap, ev.currentTarget as Element);
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ' ') {
            this.handleClick(e);
        }
    }

    private executeUnifiedAction(action: Action, element?: Element): void {
        if (!this._hass) {
            console.error(`[${this._id}] No hass object available for action execution`);
            return;
        }
        const validationErrors = validateAction(action);
        if (validationErrors.length > 0) {
            console.warn(`[${this._id}] Action validation failed:`, validationErrors);
            return;
        }
        if (isCustomAction(action)) {
            this.executeCustomAction(action);
            return;
        }
        this.executeHassAction(action, element);
    }

    private executeCustomAction(action: Action): void {
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
    }

    private executeHassAction(action: Action, element?: Element): void {
        let targetElement: HTMLElement = element as HTMLElement;
        if (!targetElement) {
            const foundElement = document.getElementById(this._id);
            if (foundElement) {
                targetElement = foundElement as HTMLElement;
            } else {
                targetElement = document.createElement('div');
                targetElement.id = this._id;
                console.warn(`[${this._id}] Could not find DOM element, using fallback`);
            }
        }
        handleHassAction(action, targetElement, this._hass!)
            .then(() => {
                if (action.action === 'toggle' || action.action === 'call-service') {
                    setTimeout(() => {
                        this._requestUpdateCallback?.();
                    }, 25);
                } else {
                    this._requestUpdateCallback?.();
                }
            })
            .catch(error => {
                console.error(`[${this._id}] handleHassAction failed:`, error);
                this._requestUpdateCallback?.();
            });
    }

    private executeActionDefinition(actionDef: any, element?: Element): void {
        if (!this._hass) {
            console.error(`[${this._id}] No hass object available for action execution`);
            return;
        }
        if (actionDef.actions && Array.isArray(actionDef.actions)) {
            actionDef.actions.forEach((singleAction: any) => {
                const unified = this.convertToUnifiedAction(singleAction);
                this.executeUnifiedAction(unified, element);
            });
            return;
        }
        let actionType = actionDef.action || actionDef.type || 'none';
        if (actionType === 'set-state') actionType = 'set_state';
        const unifiedAction: Action = {
            action: actionType,
            service: actionDef.service,
            service_data: actionDef.service_data,
            target: actionDef.target,
            navigation_path: actionDef.navigation_path,
            url_path: actionDef.url_path,
            entity: actionDef.entity,
            target_element_ref: actionDef.target_element_ref || actionDef.target_id,
            state: actionDef.state,
            states: actionDef.states,
            confirmation: actionDef.confirmation
        };
        if ((unifiedAction.action === 'toggle' || unifiedAction.action === 'more-info') && !unifiedAction.entity) {
            unifiedAction.entity = this._id;
        }
        this.executeUnifiedAction(unifiedAction, element);
    }

    private convertToUnifiedAction(singleAction: any): Action {
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

    updateHass(hass?: HomeAssistant): void {
        this._hass = hass;
    }

    cleanup(): void {
        // No-op for now
    }
} 