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
    configPath = 'layout.anchorTo';

    getSchema(context?: PropertySchemaContext): HaFormSchema {
        const options = [
            { value: '', label: 'None (Use Container Anchors)' },
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
            { value: '', label: 'None' }, 
            { value: 'container', label: 'Container' },
            { value: 'canvas', label: 'Canvas Edge' }, 
            ...(context?.otherElementIds || [])
        ];
        return {
            name: this.name,
            label: this.label,
            selector: { select: { options: options, mode: 'dropdown' } }
        };
    }
}

export class ContainerAnchorPoint implements LcarsPropertyBase {
    name = 'containerAnchorPoint';
    label = 'Container Anchor Point';
    configPath = 'layout.containerAnchorPoint';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            type: 'custom', // Use custom type
            selector: { lcars_grid: { labelCenter: true } } // Config for our custom element
        };
    }
}

export class AnchorPoint implements LcarsPropertyBase {
    name = 'anchorPoint';
    label = 'Anchor Point (Self)';
    configPath = 'layout.anchorPoint';

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
    label = 'Target Anchor Point (Other)';
    configPath = 'layout.targetAnchorPoint';

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
    label = 'Target Stretch Anchor Point';
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
    label = 'Stretch Gap X (px)';
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

// --- Common Props Property Classes ---

export class Fill implements LcarsPropertyBase {
    name = 'fill';
    label = 'Fill Color';
    configPath = 'props.fill';

    getSchema(): HaFormSchema {
        return {
            name: this.name,
            label: this.label,
            selector: { color: {} }
        };
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
                  { value: '', label: 'Default' },
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
            selector: { text: {} } // e.g., '1px', 'normal'
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
                  { value: '', label: 'Default (start)' },
                  { value: 'start', label: 'Start' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'end', label: 'End' },
                ],
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
                  { value: '', label: 'Default (auto)' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'central', label: 'Central' },
                  { value: 'hanging', label: 'Hanging' },
                ],
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
                },
            },
        };
    }
} 