import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";
import { colorResolver } from "../../utils/color-resolver.js";
import { AnimationContext } from "../../utils/animation.js";
import { Color, ColorStateContext } from "../../utils/color.js";

export type ButtonPropertyName = 'fill' | 'stroke' | 'textColor' | 'strokeWidth' | 
                        'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 
                        'textAnchor' | 'dominantBaseline';

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
            { fallbackTextColor: 'white' },
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
        if ((propName === 'fill' || propName === 'stroke' || propName === 'textColor') && value !== undefined) {
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
            hasText: boolean,
            isCutout: boolean,
            rx: number,
            customTextPosition?: {
                x: number,
                y: number
            }
        }
    ): SVGTemplateResult {
        const buttonConfig = this._props.button as LcarsButtonElementConfig;
        const elements: SVGTemplateResult[] = [];
        
        // Use the new color resolver to get colors with hover/active state support
        const resolvedColors = this.getResolvedColors();
        
        const maskId = options.isCutout ? `mask-text-${this._id}` : null;
        
        elements.push(svg`
            <path
                id=${this._id}
                d=${pathData}
                fill=${resolvedColors.fillColor}
                stroke=${resolvedColors.strokeColor}
                stroke-width=${resolvedColors.strokeWidth}
                mask=${maskId ? `url(#${maskId})` : 'none'}
            />
        `);
        
        if (options.hasText) {
            const textConfig = this.getTextConfig(buttonConfig);
            
            // Get text content from multiple possible locations for backward compatibility
            const buttonText = buttonConfig?.text;
            const mainText = this._props.text;
            const textContent = buttonText || mainText || '';
            
            let textX: number;
            let textY: number;
            
            if (options.customTextPosition) {
                // Use custom text position if provided
                textX = options.customTextPosition.x;
                textY = options.customTextPosition.y;
            } else {
                // Calculate text position based on text anchor
                const textAnchor = textConfig.textAnchor;
                const textPadding = this._props.textPadding || 2; // Default padding of 8px
                
                if (textAnchor === 'start') {
                    textX = x + textPadding; // Left edge with padding
                } else if (textAnchor === 'end') {
                    textX = x + width - textPadding; // Right edge with padding
                } else {
                    textX = x + width / 2; // Center (default for 'middle')
                }
                textY = y + height / 2; // Always center vertically
            }
            
            if (options.isCutout && maskId) {
                elements.push(this.createTextMask(
                    maskId,
                    x,
                    y,
                    width,
                    height,
                    pathData,
                    textContent,
                    textConfig,
                    textX,
                    textY
                ));
            } else {
                elements.push(this.createText(
                    textX,
                    textY,
                    textContent,
                    {
                        ...textConfig,
                        fill: resolvedColors.textColor,
                        pointerEvents: 'none'
                    }
                ));
            }
        }
        
        return this.createButtonGroup(elements, {
            isButton: true,
            buttonText: buttonConfig.text,
            elementId: this._id
        });
    }

    createText(
        x: number, 
        y: number, 
        text: string, 
        config: {
            fontFamily: string,
            fontSize: number,
            fontWeight: string,
            letterSpacing: string | number,
            textAnchor: string,
            dominantBaseline: string,
            textTransform: string,
            fill?: string,
            pointerEvents?: string
        }
    ): SVGTemplateResult {
        return svg`
            <text
                x=${x}
                y=${y}
                fill=${config.fill || 'currentColor'}
                font-family=${config.fontFamily}
                font-size=${`${config.fontSize}px`}
                font-weight=${config.fontWeight}
                letter-spacing=${config.letterSpacing}
                text-anchor=${config.textAnchor}
                dominant-baseline=${config.dominantBaseline}
                style="pointer-events: ${config.pointerEvents || 'auto'}; text-transform: ${config.textTransform};"
            >
                ${text}
            </text>
        `;
    }

    createTextMask(
        id: string,
        x: number,
        y: number,
        width: number,
        height: number,
        pathData: string,
        text: string,
        textConfig: {
            fontFamily: string,
            fontSize: number,
            fontWeight: string,
            letterSpacing: string | number,
            textAnchor: string,
            dominantBaseline: string,
            textTransform: string
        },
        textX: number,
        textY: number
    ): SVGTemplateResult {
        return svg`
            <mask id=${id}>
                <path d=${pathData} fill="white" />
                ${this.createText(
                    textX,
                    textY,
                    text,
                    {
                        ...textConfig,
                        fill: 'black'
                    }
                )}
            </mask>
        `;
    }

    createButtonGroup(
        elements: SVGTemplateResult[],
        config: {
            isButton: boolean,
            buttonText?: string,
            elementId: string
        }
    ): SVGTemplateResult {
        const { isButton, buttonText, elementId } = config;
        
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
                aria-label=${buttonText || elementId}
                tabindex="0"
                @keydown=${buttonHandlers.handleKeyDown}
            >
                ${elements}
            </g>
        `;
    }
    
    getTextConfig(buttonConfig: LcarsButtonElementConfig): {
        fontFamily: string,
        fontSize: number,
        fontWeight: string,
        letterSpacing: string | number,
        textAnchor: string,
        dominantBaseline: string,
        textTransform: string
    } {
        return {
            fontFamily: buttonConfig.font_family || this._props.fontFamily || 'sans-serif',
            fontSize: buttonConfig.font_size || this._props.fontSize || 16,
            fontWeight: buttonConfig.font_weight || this._props.fontWeight || 'normal',
            letterSpacing: buttonConfig.letter_spacing || this._props.letterSpacing || 'normal',
            textAnchor: buttonConfig.text_anchor || this._props.textAnchor || 'middle',
            dominantBaseline: buttonConfig.dominant_baseline || this._props.dominantBaseline || 'middle',
            textTransform: buttonConfig.text_transform || 'none'
        };
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
                    const actionType = actionConfig?.tap_action?.action;
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
            
            // For button groups, we may need to update text color too
            const textElements = buttonElement.querySelectorAll('text');
            textElements.forEach(textElement => {
                if (resolvedColors.textColor) {
                    textElement.setAttribute('fill', resolvedColors.textColor);
                }
            });
            
        } catch (error) {
            console.warn(`[${this._id}] Direct appearance update failed, falling back to global update:`, error);
            // Fall back to global update if direct update fails
            this._requestUpdateCallback?.();
        }
    }
} 