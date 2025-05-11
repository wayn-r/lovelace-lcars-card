export interface HaFormSchema {
    name: string;
    label?: string;
    selector: any;
    type?: 'string' | 'integer' | 'float' | 'boolean' | 'grid' | 'custom';
    required?: boolean;
    default?: any;
    context?: Record<string, any>;
    options?: { value: string; label: string }[] | Record<string, string>;
    column_min_width?: string;
    schema?: HaFormSchema[];
    element?: string; 
    config?: Record<string, any>;
    grid_columns?: number;
    grid_column_span?: number;
    grid_column_start?: number;
}

export interface PropertySchemaContext {
    otherElementIds?: { value: string; label: string }[];
    layoutData?: any;
}

export interface LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string; 
    getSchema(context?: PropertySchemaContext): HaFormSchema;
    formatValueForForm?(value: any): any;
}

// --- UNIFIED STRETCH CLASSES ---

export class StretchTarget implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchTo${suffix}`;
        this.label = index === 0 ? 'Stretch To' : `Stretch To ${suffix}`;
        this.configPath = `layout.stretch.stretchTo${suffix}`;
    }

    getSchema(context?: PropertySchemaContext): HaFormSchema {
        const options = [
            { value: '', label: '' }, 
            { value: 'container', label: 'Container' },
            ...(context?.otherElementIds || [])
        ];

        const currentValue = context?.layoutData?.stretch?.[`stretchTo${this.index === 0 ? '1' : '2'}`];

        return {
            name: this.name,
            label: this.label,
            column_min_width: '100px',
            grid_column_span: 2,
            selector: { select: { options: options, mode: 'dropdown' } },
            required: false,
            default: ''
        };
    }
}
export class StretchDirection implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchDirection${suffix}`;
        this.label = 'Direction';
        this.configPath = `layout.stretch.targetStretchAnchorPoint${suffix}`;
    }

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            column_min_width: '100px',
            grid_column_start: 2, 
            grid_column_span: 1, 
            grid_columns: 2, 
            selector: { 
                lcars_grid: { 
                    labelCenter: true,
                    clearable: true,
                    required: false,
                    disableCorners: true, 
                    disableCenter: true,
                    onlyCardinalDirections: true,
                    stretchMode: true
                } 
            }
        };
    }
}
export class StretchPadding implements LcarsPropertyBase {
    name: string;
    label: string;
    configPath: string;
    index: number;

    constructor(index: number = 0) {
        this.index = index;
        const suffix = index === 0 ? '1' : '2';
        
        this.name = `stretchPadding${suffix}`;
        this.label = 'Padding (px)';
        this.configPath = `layout.stretch.stretchPadding${suffix}`;
    }

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            column_min_width: '100px',
            grid_column_start: 1, 
            grid_column_span: 1, 
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

// --- Common Layout Property Classes ---

export class Width implements LcarsPropertyBase {
    name = 'width';
    label = 'Width (px or %)';
    configPath = 'layout.width';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class Height implements LcarsPropertyBase {
    name = 'height';
    label = 'Height (px or %)';
    configPath = 'layout.height';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class OffsetX implements LcarsPropertyBase {
    name = 'offsetX';
    label = 'Offset X (px)';
    configPath = 'layout.offsetX';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class OffsetY implements LcarsPropertyBase {
    name = 'offsetY';
    label = 'Offset Y (px)';
    configPath = 'layout.offsetY';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

// --- Anchor/Stretch Layout Properties ---

export class AnchorTo implements LcarsPropertyBase {
    name = 'anchorTo';
    label = 'Anchor To';
    configPath = 'layout.anchor.anchorTo';

    getSchema(context?: PropertySchemaContext): HaFormSchema {
        const options = [
            { value: '', label: '' },
            { value: 'container', label: 'Container' },
            ...(context?.otherElementIds || [])
        ];
        return {
            name: this.name,
            label: this.label,
            selector: { select: { options: options, mode: 'dropdown' } }
        };
    }
}
export class AnchorPoint implements LcarsPropertyBase {
    name = 'anchorPoint';
    label = 'Anchor Point';
    configPath = 'layout.anchor.anchorPoint';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true } }
        };
    }
}
export class TargetAnchorPoint implements LcarsPropertyBase {
    name = 'targetAnchorPoint';
    label = 'Target Point';
    configPath = 'layout.anchor.targetAnchorPoint';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true } }
        };
    }
}

// --- Common Props Property Classes ---

export class Fill implements LcarsPropertyBase {
    name = 'fill';
    label = 'Fill Color';
    configPath = 'props.fill';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { color_rgb: {} }
        };
    }
    
    formatValueForForm(value: any): any {
        if (Array.isArray(value) && value.length === 3) {
            return value;
        }
        
        if (typeof value === 'string' && value.startsWith('#')) {
            return this.hexToRgb(value);
        }
        
        return value;
    }
    
    private hexToRgb(hex: string): number[] {
        hex = hex.replace(/^#/, '');
        
        if (hex.length === 3) {
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16)
            ];
        } else if (hex.length === 6) {
            return [
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16)
            ];
        }
        
        return [0, 0, 0];
    }
}

// --- Text Element Props ---

export class TextContent implements LcarsPropertyBase {
    name = 'text';
    label = 'Text Content';
    configPath = 'props.text';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}
export class FontSize implements LcarsPropertyBase {
    name = 'fontSize';
    label = 'Font Size (px)';
    configPath = 'props.fontSize';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 1 } }
        };
    }
}
export class FontFamily implements LcarsPropertyBase {
    name = 'fontFamily';
    label = 'Font Family';
    configPath = 'props.fontFamily';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}
export class FontWeight implements LcarsPropertyBase {
    name = 'fontWeight';
    label = 'Font Weight';
    configPath = 'props.fontWeight';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'bold', label: 'Bold' },
                  { value: 'bolder', label: 'Bolder' },
                  { value: 'lighter', label: 'Lighter' },
                  { value: '100', label: '100' }, { value: '200', label: '200' }, { value: '300', label: '300' },
                  { value: '400', label: '400' }, { value: '500', label: '500' }, { value: '600', label: '600' },
                  { value: '700', label: '700' }, { value: '800', label: '800' }, { value: '900', label: '900' },
                ],
              },
            }
        };
    }
}
export class LetterSpacing implements LcarsPropertyBase {
    name = 'letterSpacing';
    label = 'Letter Spacing';
    configPath = 'props.letterSpacing';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}
export class TextAnchor implements LcarsPropertyBase {
    name = 'textAnchor';
    label = 'Text Anchor';
    configPath = 'props.textAnchor';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'start', label: 'Start' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'end', label: 'End' },
                ],
                mode: 'dropdown'
              },
            }
        };
    }
}
export class DominantBaseline implements LcarsPropertyBase {
    name = 'dominantBaseline';
    label = 'Dominant Baseline';
    configPath = 'props.dominantBaseline';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: '', label: '' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'central', label: 'Central' },
                  { value: 'hanging', label: 'Hanging' },
                ],
                mode: 'dropdown'
              },
            }
        };
    }
}
export class TextTransform implements LcarsPropertyBase {
    name = 'textTransform';
    label = 'Text Transform';
    configPath = 'props.textTransform';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} }
        };
    }
}

// --- Elbow Element Props ---

export class Orientation implements LcarsPropertyBase {
    name = 'orientation';
    label = 'Orientation';
    configPath = 'props.orientation';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
              select: {
                options: [
                  { value: 'top-left', label: 'Top Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'bottom-right', label: 'Bottom Right' },
                ],
                mode: 'dropdown'
              },
            },
            default: 'top-left',
        };
    }
}
export class HorizontalWidth implements LcarsPropertyBase {
    name = 'horizontalWidth';
    label = 'Horizontal Width (px)';
    configPath = 'props.horizontalWidth';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}
export class VerticalWidth implements LcarsPropertyBase {
    name = 'verticalWidth';
    label = 'Vertical Width (px)';
    configPath = 'props.verticalWidth';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}
export class HeaderHeight implements LcarsPropertyBase {
    name = 'headerHeight';
    label = 'Header Height (px)';
    configPath = 'props.headerHeight';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}
export class TotalElbowHeight implements LcarsPropertyBase {
    name = 'totalElbowHeight';
    label = 'Total Elbow Height (px)';
    configPath = 'props.totalElbowHeight';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}
export class OuterCornerRadius implements LcarsPropertyBase {
    name = 'outerCornerRadius';
    label = 'Outer Corner Radius (px)';
    configPath = 'props.outerCornerRadius';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1, min: 0 } }
        };
    }
}

// --- Type Property ---
export class Type implements LcarsPropertyBase {
    name = 'type';
    label = 'Element Type';
    configPath = 'type';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'rectangle', label: 'Rectangle' },
                        { value: 'text', label: 'Text' },
                        { value: 'endcap', label: 'Endcap' },
                        { value: 'elbow', label: 'Elbow' },
                        { value: 'chisel-endcap', label: 'Chisel Endcap' },
                    ],
                    mode: 'dropdown'
                },
            },
        };
    }
}

// --- Endcap/Chisel Props ---
export class Direction implements LcarsPropertyBase {
    name = 'direction';
    label = 'Direction';
    configPath = 'props.direction';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' },
                    ],
                    mode: 'dropdown'
                },
            },
        };
    }
}

// --- Button Behavior Property Classes ---

export class ButtonEnabled implements LcarsPropertyBase {
    name = 'button.enabled';
    label = 'Enable Button Behavior';
    configPath = 'button.enabled';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
            default: false,
        };
    }
}
export class ButtonText implements LcarsPropertyBase {
    name = 'button.text';
    label = 'Button Text';
    configPath = 'button.text';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { text: {} },
        };
    }
}
export class ButtonCutoutText implements LcarsPropertyBase {
    name = 'button.cutout_text';
    label = 'Cutout Text (Mask Effect)';
    configPath = 'button.cutout_text';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
            default: false,
        };
    }
}

// --- Button Text Styling Properties ---
export class ButtonTextColor implements LcarsPropertyBase {
    name = 'button.text_color';
    label = 'Button Text Color';
    configPath = 'button.text_color';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm; // Reuse Fill's hexToRgb
}
export class ButtonFontFamily implements LcarsPropertyBase {
    name = 'button.font_family';
    label = 'Button Font Family';
    configPath = 'button.font_family';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonFontSize implements LcarsPropertyBase {
    name = 'button.font_size';
    label = 'Button Font Size (px)';
    configPath = 'button.font_size';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { number: { mode: 'box', step: 1, min: 1 } } }; }
}
export class ButtonFontWeight implements LcarsPropertyBase {
    name = 'button.font_weight';
    label = 'Button Font Weight';
    configPath = 'button.font_weight';
    getSchema(): HaFormSchema { return (new FontWeight()).getSchema(); }
}
export class ButtonLetterSpacing implements LcarsPropertyBase {
    name = 'button.letter_spacing';
    label = 'Button Letter Spacing';
    configPath = 'button.letter_spacing';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonTextTransform implements LcarsPropertyBase {
    name = 'button.text_transform';
    label = 'Button Text Transform';
    configPath = 'button.text_transform';
    getSchema(): HaFormSchema { return (new TextTransform()).getSchema(); }
}
export class ButtonTextAnchor implements LcarsPropertyBase {
    name = 'button.text_anchor';
    label = 'Button Text Anchor';
    configPath = 'button.text_anchor';
    getSchema(): HaFormSchema { return (new TextAnchor()).getSchema(); }
}
export class ButtonDominantBaseline implements LcarsPropertyBase {
    name = 'button.dominant_baseline';
    label = 'Button Dominant Baseline';
    configPath = 'button.dominant_baseline';
    getSchema(): HaFormSchema { return (new DominantBaseline()).getSchema(); }
}


// --- Button State Styling Properties ---
export class ButtonHoverFill implements LcarsPropertyBase {
    name = 'button.hover_fill';
    label = 'Hover Fill Color';
    configPath = 'button.hover_fill';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm;
}
export class ButtonActiveFill implements LcarsPropertyBase {
    name = 'button.active_fill';
    label = 'Active/Pressed Fill Color';
    configPath = 'button.active_fill';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { color_rgb: {} } }; }
    formatValueForForm = Fill.prototype.formatValueForForm;
}

export class ButtonHoverTransform implements LcarsPropertyBase {
    name = 'button.hover_transform';
    label = 'Hover Transform (CSS)';
    configPath = 'button.hover_transform';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}

export class ButtonActiveTransform implements LcarsPropertyBase {
    name = 'button.active_transform';
    label = 'Active Transform (CSS)';
    configPath = 'button.active_transform';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}

// --- Button Action Properties ---
export class ButtonActionType implements LcarsPropertyBase {
    name = 'button.action_config.type';
    label = 'Action Type';
    configPath = 'button.action_config.type';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { aselect: {
 mode: 'dropdown',
 options: [
                        { value: 'none', label: 'None' },
                        { value: 'call-service', label: 'Call Service' },
                        { value: 'navigate', label: 'Navigate' },
                        { value: 'url', label: 'URL' },
                        { value: 'toggle', label: 'Toggle' },
                        { value: 'more-info', label: 'More Info' },
                    ],
                },
            },
            default: 'none',
        };
    }
}
export class ButtonActionService implements LcarsPropertyBase {
    name = 'button.action_config.service';
    label = 'Service (e.g., light.turn_on)';
    configPath = 'button.action_config.service';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionServiceData implements LcarsPropertyBase {
    name = 'button.action_config.service_data';
    label = 'Service Data (YAML or JSON)';
    configPath = 'button.action_config.service_data';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { object: {} } }; }
}
export class ButtonActionNavigationPath implements LcarsPropertyBase {
    name = 'button.action_config.navigation_path';
    label = 'Navigation Path (e.g., /lovelace/main)';
    configPath = 'button.action_config.navigation_path';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionUrlPath implements LcarsPropertyBase {
    name = 'button.action_config.url_path';
    label = 'URL (e.g., https://example.com)';
    configPath = 'button.action_config.url_path';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { text: {} } }; }
}
export class ButtonActionEntity implements LcarsPropertyBase {
    name = 'button.action_config.entity';
    label = 'Entity ID';
    configPath = 'button.action_config.entity';
    getSchema(): HaFormSchema { return { name: this.name, label: this.label, selector: { entity: {} } }; }
}
export class ButtonActionConfirmation implements LcarsPropertyBase {
    name = 'button.action_config.confirmation';
    label = 'Require Confirmation';
    configPath = 'button.action_config.confirmation';
    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { boolean: {} },
        };
    }
}

export class ElbowTextPosition implements LcarsPropertyBase {
    name = 'elbow_text_position';
    label = 'Text Position';
    configPath = 'props.elbow_text_position';
    
    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'top', label: 'Top (Horizontal Section)' },
                        { value: 'side', label: 'Side (Vertical Section)' }
                    ],
                    mode: 'dropdown'
                }
            },
            default: 'top'
        };
    }
} 