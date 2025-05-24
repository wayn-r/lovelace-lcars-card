import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { HomeAssistant } from "custom-card-helpers";

export type ButtonPropertyName = 'fill' | 'stroke' | 'text_color' | 'strokeWidth' | 
                        'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 
                        'textAnchor' | 'dominantBaseline';

export class Button {
    private _isHovering = false;
    private _isActive = false;
    private _props: any;
    private _hass?: HomeAssistant;
    private _requestUpdateCallback?: () => void;
    private _id: string;

    constructor(id: string, props: any, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
        this._id = id;
        this._props = props;
        this._hass = hass;
        this._requestUpdateCallback = requestUpdateCallback;
    }

    get isHovering(): boolean {
        return this._isHovering;
    }

    set isHovering(value: boolean) {
        this._isHovering = value;
        this._requestUpdateCallback?.();
    }

    get isActive(): boolean {
        return this._isActive;
    }

    set isActive(value: boolean) {
        this._isActive = value;
        this._requestUpdateCallback?.();
    }

    formatColorValue(color: any): string | undefined {
        if (typeof color === 'string') {
            return color;
        }
        if (Array.isArray(color) && color.length === 3 && color.every(num => typeof num === 'number')) {
            return `rgb(${color[0]},${color[1]},${color[2]})`;
        }
        return undefined;
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
        if ((propName === 'fill' || propName === 'stroke' || propName === 'text_color') && value !== undefined) {
            return this.formatColorValue(value);
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
        
        const currentFill = this.getButtonProperty('fill', 'none');
        const currentStroke = this.getButtonProperty('stroke', 'none');
        const strokeWidth = this.getButtonProperty('strokeWidth', '0');
        
        const maskId = options.isCutout ? `mask-text-${this._id}` : null;
        
        elements.push(svg`
            <path
                id=${this._id}
                d=${pathData}
                fill=${currentFill}
                stroke=${currentStroke}
                stroke-width=${strokeWidth}
                mask=${maskId ? `url(#${maskId})` : 'none'}
            />
        `);
        
        if (options.hasText && buttonConfig.text) {
            const textConfig = this.getTextConfig(buttonConfig);
            
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
                    buttonConfig.text as string,
                    textConfig,
                    textX,
                    textY
                ));
            } else {
                const currentTextColor = this.getButtonProperty('text_color', 'white');
                elements.push(this.createText(
                    textX,
                    textY,
                    buttonConfig.text as string,
                    {
                        ...textConfig,
                        fill: currentTextColor as string,
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
                console.log(`[${this._id}] handleClick:`, { props: this._props });
                
                const buttonConfig = this._props.button as LcarsButtonElementConfig | undefined;
                console.log(`[${this._id}] Button config:`, JSON.stringify(buttonConfig, null, 2));
                
                if (!this._hass || !buttonConfig?.action_config) {
                    console.log(`[${this._id}] handleClick: Aborting (no hass or no action_config)`);
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
        console.log(`[${this._id}] Action config created:`, JSON.stringify(actionConfig, null, 2));

        return actionConfig;
    }
    
    private executeAction(actionConfig: any, element?: Element): void {
        const hass = this._hass;
        if (hass) {
            console.log(`[${this._id}] Executing action:`, JSON.stringify(actionConfig, null, 2));
            
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
                
                console.log(`[${this._id}] Calling handleAction with element:`, targetElement);
                console.log(`[${this._id}] Calling handleAction with actionConfig:`, JSON.stringify(actionConfig, null, 2));
                console.log(`[${this._id}] Calling handleAction with hass available:`, !!hass);
                
                try {
                    handleAction(targetElement, hass, actionConfig as any, "tap");
                    console.log(`[${this._id}] handleAction completed successfully`);
                } catch (error) {
                    console.error(`[${this._id}] handleAction failed:`, error);
                }
                
                this._requestUpdateCallback?.();
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
} 