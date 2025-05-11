import { LcarsButtonElementConfig } from "../lovelace-lcars-card.js";
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
            rx: number
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
            
            if (options.isCutout && maskId) {
                elements.push(this.createTextMask(
                    maskId,
                    x,
                    y,
                    width,
                    height,
                    pathData,
                    buttonConfig.text as string,
                    textConfig
                ));
            } else {
                const currentTextColor = this.getButtonProperty('text_color', 'white');
                elements.push(this.createText(
                    x + width / 2,
                    y + height / 2,
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
        }
    ): SVGTemplateResult {
        return svg`
            <mask id=${id}>
                <path d=${pathData} fill="white" />
                ${this.createText(
                    x + width / 2,
                    y + height / 2,
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
                style="cursor: pointer;"
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
                if (!this._hass || !buttonConfig?.action_config) {
                    console.log(`[${this._id}] handleClick: Aborting (no hass or no action_config)`);
                    return; 
                }
                
                ev.stopPropagation();
            
                const actionConfig = this.createActionConfig(buttonConfig);
                this.executeAction(actionConfig);
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
        return {
            tap_action: { 
                action: buttonConfig.action_config?.type,
                service: buttonConfig.action_config?.service,
                service_data: buttonConfig.action_config?.service_data,
                navigation_path: buttonConfig.action_config?.navigation_path,
                url_path: buttonConfig.action_config?.url_path,
                entity: buttonConfig.action_config?.entity,
            },
            confirmation: buttonConfig.action_config?.confirmation,
        };
    }
    
    private executeAction(actionConfig: any): void {
        const hass = this._hass;
        if (hass) {
            import("custom-card-helpers").then(({ handleAction }) => {
                handleAction({ id: this._id } as any, hass, actionConfig as any, "tap");
                this._requestUpdateCallback?.();
            });
        }
    }
} 