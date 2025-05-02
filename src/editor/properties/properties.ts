// Define HaFormSchema locally for now
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
}

// import { HaFormSchema } from '../types'; // Assuming types are defined or will be defined

// Context type for dynamic schemas
export interface PropertySchemaContext {
    otherElementIds?: { value: string; label: string }[];
    layoutData?: any; // Add layoutData here for conditional schema
}

// Export the base interface
export interface LcarsPropertyBase {
    name: string;
    label: string;
    // Path in the element config object (e.g., 'props.fill', 'layout.width')
    configPath: string; 
    // Ensure context is optional in the base interface signature
    getSchema(context?: PropertySchemaContext): HaFormSchema;
    // Optional method to format a value from the config for the form UI
    formatValueForForm?(value: any): any;
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

export class StretchTo implements LcarsPropertyBase {
    name = 'stretchTo';
    label = 'Stretch To';
    configPath = 'layout.stretchTo';

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

export class TargetStretchAnchorPoint implements LcarsPropertyBase {
    name = 'targetStretchAnchorPoint';
    label = 'Target Side';
    configPath = 'layout.targetStretchAnchorPoint';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true, disableCorners: true } }
        };
    }
}

export class StretchPaddingX implements LcarsPropertyBase {
    name = 'stretchPaddingX';
    label = 'Stretch Gap';
    configPath = 'layout.stretchPaddingX';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

export class StretchPaddingY implements LcarsPropertyBase {
    name = 'stretchPaddingY';
    label = 'Stretch Gap Y (px)';
    configPath = 'layout.stretchPaddingY';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { number: { mode: 'box', step: 1 } }
        };
    }
}

export class StretchTo2 implements LcarsPropertyBase {
    name = 'stretchTo2';
    label = 'Stretch To';
    configPath = 'layout.stretchTo2';

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

export class TargetStretchAnchorPoint2 implements LcarsPropertyBase {
    name = 'targetStretchAnchorPoint2';
    label = 'Target Side';
    configPath = 'layout.targetStretchAnchorPoint2';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom',
            selector: { lcars_grid: { labelCenter: true, disableCorners: true } }
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
    
    // Convert hex value from config to RGB array for the color picker
    formatValueForForm(value: any): any {
        // If the value is already an RGB array, just return it
        if (Array.isArray(value) && value.length === 3) {
            return value;
        }
        
        // If the value is a hex string, convert it to RGB array
        if (typeof value === 'string' && value.startsWith('#')) {
            return this.hexToRgb(value);
        }
        
        return value;
    }
    
    // Convert hex color to RGB array
    private hexToRgb(hex: string): number[] {
        // Remove the # if present
        hex = hex.replace(/^#/, '');
        
        // Parse the hex values to RGB
        if (hex.length === 3) {
            // Handle shorthand hex (#RGB)
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16)
            ];
        } else if (hex.length === 6) {
            // Handle full hex (#RRGGBB)
            return [
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16)
            ];
        }
        
        // Default to black if invalid hex
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
            // Potentially use selector: { font: {} } if available/suitable
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
            selector: { number: { mode: 'box', step: 1 } } // e.g., '1px', 'normal'
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
            selector: { text: {} } // e.g., 'uppercase', 'lowercase', 'capitalize', 'none'
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

export class Side implements LcarsPropertyBase {
    name = 'side';
    label = 'Side';
    configPath = 'props.side';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: {
                select: {
                    options: [
                        { value: 'top', label: 'Top' },
                        { value: 'bottom', label: 'Bottom' },
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' },
                    ],
                    mode: 'dropdown'
                },
            },
        };
    }
} 