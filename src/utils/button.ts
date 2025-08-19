import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "./color-resolver.js";
import { AnimationContext } from "./animation.js";
import { ColorStateContext } from "../types.js";
import { Action } from "../types.js";
import { ActionProcessor } from "./action-helpers.js";
import { CardRuntime } from "../core/runtime.js";

export type ButtonProperty = 'fill' | 'stroke' | 'strokeWidth';

export class Button {
    private _props: any;
    private _hass?: HomeAssistant;
    private _requestUpdateCallback?: () => void;
    private _id: string;
    private _getShadowElement?: (id: string) => Element | null;
    private _runtime?: CardRuntime;

    constructor(
        id: string, 
        props: any, 
        hass?: HomeAssistant, 
        requestUpdateCallback?: () => void, 
        getShadowElement?: (id: string) => Element | null,
        runtime?: CardRuntime
    ) {
        this._id = id;
        this._props = props;
        this._hass = hass;
        this._requestUpdateCallback = requestUpdateCallback;
        this._getShadowElement = getShadowElement;
        this._runtime = runtime;
    }

    private buildAnimationContext(): AnimationContext {
        return {
            elementId: this._id,
            getShadowElement: this._getShadowElement,
            hass: this._hass,
            requestUpdateCallback: this._requestUpdateCallback
        };
    }

    private resolveElementColors(stateContext: ColorStateContext) {
        const context = this.buildAnimationContext();
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
        const resolvedColors = this.resolveElementColors(stateContext);
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

        const tapConfig = buttonConfig.actions?.tap;
        if (!tapConfig) return;

        if (Array.isArray(tapConfig)) {
            tapConfig.forEach((actionObj: Action) => {
                this.executeAction(actionObj, ev.currentTarget as Element);
            });
        } else {
            const unifiedAction = this.normalizeActionFormat(tapConfig);
            this.executeAction(unifiedAction, ev.currentTarget as Element);
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ' ') {
            this.handleClick(e);
        }
    }

    private normalizeActionFormat(actionConfig: any): Action {
        let actionType = actionConfig.action || actionConfig.type || 'none';
        if (actionType === 'set-state') actionType = 'set_state';

        const normalizedAction: Action = {
            action: actionType,
            service: actionConfig.service,
            service_data: actionConfig.service_data,
            target: actionConfig.target,
            navigation_path: actionConfig.navigation_path,
            url_path: actionConfig.url_path,
            entity: actionConfig.entity,
            target_element_ref: actionConfig.target_element_ref || actionConfig.target_id,
            state: actionConfig.state,
            states: actionConfig.states,
            confirmation: actionConfig.confirmation
        };

        if ((normalizedAction.action === 'toggle' || normalizedAction.action === 'more-info') && !normalizedAction.entity) {
            normalizedAction.entity = this._id;
        }

        return normalizedAction;
    }

    private executeAction(action: Action, element?: Element): void {
        if (!this._hass) {
            console.error(`[${this._id}] No hass object available for action execution`);
            return;
        }

        const validationErrors = ActionProcessor.validateAction(action);
        if (validationErrors.length > 0) {
            console.warn(`[${this._id}] Action validation failed:`, validationErrors);
            return;
        }

        if (ActionProcessor.actionIsCustom(action)) {
            this.executeCustomAction(action);
            return;
        }

        this.executeHassAction(action, element);
    }

    private executeCustomAction(action: Action): void {
        try {
            const sm = this._runtime?.state;
            switch (action.action) {
                case 'set_state':
                    sm?.executeSetStateAction(action);
                    break;
                case 'toggle_state':
                    sm?.executeToggleStateAction(action);
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

        ActionProcessor.processHassAction(action, targetElement, this._hass!)
            .then(() => {
                if (action.action === 'toggle' || action.action === 'call-service') {
                    setTimeout(() => {
                        this._requestUpdateCallback?.();
                    }, 25);
                } else {
                    this._requestUpdateCallback?.();
                }
            })
            .catch((error: Error) => {
                console.error(`[${this._id}] ActionProcessor.processHassAction failed:`, error);
                this._requestUpdateCallback?.();
            });
    }

    updateHass(hass?: HomeAssistant): void {
        this._hass = hass;
    }

    cleanup(): void {
        // No-op for now
    }
} 