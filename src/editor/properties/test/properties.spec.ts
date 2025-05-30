// src/editor/properties/properties.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    // Enums
    PropertyGroup,
    Layout,
    // Interfaces
    HaFormSchema,
    PropertySchemaContext,
    LcarsPropertyBase,
    // All property classes
    StretchTarget, StretchDirection, StretchPadding,
    Width, Height, OffsetX, OffsetY,
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    Fill,
    LeftTextContent, RightTextContent,
    TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform,
    Orientation, BodyWidth, ArmHeight,
    Type,
    Direction,
    ButtonEnabled, ButtonHoverFill,
    ButtonActiveFill, ButtonHoverTransform, ButtonActiveTransform, ElbowTextPosition,
    ButtonActionType, ButtonActionService, ButtonActionServiceData,
    ButtonActionNavigationPath, ButtonActionUrlPath, ButtonActionEntity, ButtonActionConfirmation,
    TextColor, CutoutText
} from '../properties';

// Helper for context
const emptyContext: PropertySchemaContext = {};
const contextWithElements: PropertySchemaContext = {
    otherElementIds: [
        { value: 'el-1', label: 'Element 1' },
        { value: 'el-2', label: 'Element 2' },
    ]
};
const contextWithLayoutData: PropertySchemaContext = {
    layoutData: {
        stretch: {
            stretchTo1: 'container',
            stretchTo2: 'el-1'
        }
    }
};
const fullContext: PropertySchemaContext = {
    ...contextWithElements,
    ...contextWithLayoutData
};

// Generic test for common properties
function testCommonProperties(
    propInstance: LcarsPropertyBase,
    expectedName: string,
    expectedLabel: string,
    expectedConfigPath: string,
    expectedPropertyGroup: PropertyGroup,
    expectedLayout: Layout
) {
    it('should have correct common properties', () => {
        expect(propInstance.name).toBe(expectedName);
        expect(propInstance.label).toBe(expectedLabel);
        expect(propInstance.configPath).toBe(expectedConfigPath);
        expect(propInstance.propertyGroup).toBe(expectedPropertyGroup);
        expect(propInstance.layout).toBe(expectedLayout);
    });
}

describe('StretchTarget Property', () => {
    testCommonProperties(new StretchTarget(0), 'stretchTo1', 'Stretch To', 'layout.stretch.stretchTo1', PropertyGroup.STRETCH, Layout.CUSTOM);
    testCommonProperties(new StretchTarget(1), 'stretchTo2', 'Stretch To 2', 'layout.stretch.stretchTo2', PropertyGroup.STRETCH, Layout.CUSTOM);

    it('should return correct schema without context', () => {
        const prop = new StretchTarget(0);
        const schema = prop.getSchema();
        expect(schema).toEqual({
            name: 'stretchTo1',
            label: 'Stretch To',
            column_min_width: '100px',
            grid_column_span: 2,
            selector: { select: { options: [{ value: '', label: '' }, { value: 'container', label: 'Container' }], mode: 'dropdown' } },
            required: false,
            default: ''
        });
    });

    it('should return schema with options from context', () => {
        const prop0 = new StretchTarget(0);
        const schema0 = prop0.getSchema(contextWithElements);
        expect(schema0.selector.select.options).toEqual([
            { value: '', label: '' },
            { value: 'container', label: 'Container' },
            { value: 'el-1', label: 'Element 1' },
            { value: 'el-2', label: 'Element 2' },
        ]);

        const prop1 = new StretchTarget(1);
        const schema1 = prop1.getSchema(fullContext); // context includes layoutData
        expect(schema1.name).toBe('stretchTo2');
        expect(schema1.label).toBe('Stretch To 2');
        // currentValue in context.layoutData.stretch is not directly used by StretchTarget's schema creation
        // but it's good to pass it to ensure no errors
    });
});

describe('StretchDirection Property', () => {
    testCommonProperties(new StretchDirection(0), 'stretchDirection1', 'Direction', 'layout.stretch.targetStretchAnchorPoint1', PropertyGroup.STRETCH, Layout.CUSTOM);
    testCommonProperties(new StretchDirection(1), 'stretchDirection2', 'Direction', 'layout.stretch.targetStretchAnchorPoint2', PropertyGroup.STRETCH, Layout.CUSTOM);

    it('should return correct schema for lcars_grid selector', () => {
        const prop = new StretchDirection(0);
        const schema = prop.getSchema();
        expect(schema).toEqual({
            name: 'stretchDirection1',
            label: 'Direction',
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
        });
    });
});

describe('StretchPadding Property', () => {
    testCommonProperties(new StretchPadding(0), 'stretchPadding1', 'Padding (px)', 'layout.stretch.stretchPadding1', PropertyGroup.STRETCH, Layout.CUSTOM);
    testCommonProperties(new StretchPadding(1), 'stretchPadding2', 'Padding (px)', 'layout.stretch.stretchPadding2', PropertyGroup.STRETCH, Layout.CUSTOM);

    it('should return correct schema for number selector', () => {
        const prop = new StretchPadding(0);
        const schema = prop.getSchema();
        expect(schema).toEqual({
            name: 'stretchPadding1',
            label: 'Padding (px)',
            column_min_width: '100px',
            grid_column_start: 1,
            grid_column_span: 1,
            selector: { number: { mode: 'box', step: 1 } }
        });
    });
});

describe('Width Property', () => {
    const prop = new Width();
    testCommonProperties(prop, 'width', 'Width (px)', 'layout.width', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'width', label: 'Width (px)', selector: { number: { mode: 'box', step: 1 } } });
    });
});

describe('Height Property', () => {
    const prop = new Height();
    testCommonProperties(prop, 'height', 'Height (px)', 'layout.height', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'height', label: 'Height (px)', selector: { number: { mode: 'box', step: 1 } } });
    });
});

describe('OffsetX Property', () => {
    const prop = new OffsetX();
    testCommonProperties(prop, 'offsetX', 'Offset X (px)', 'layout.offsetX', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'offsetX', label: 'Offset X (px)', selector: { number: { mode: 'box', step: 1 } } });
    });
});

describe('OffsetY Property', () => {
    const prop = new OffsetY();
    testCommonProperties(prop, 'offsetY', 'Offset Y (px)', 'layout.offsetY', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'offsetY', label: 'Offset Y (px)', selector: { number: { mode: 'box', step: 1 } } });
    });
});

describe('AnchorTo Property', () => {
    const prop = new AnchorTo();
    testCommonProperties(prop, 'anchorTo', 'Anchor To', 'layout.anchor.anchorTo', PropertyGroup.ANCHOR, Layout.CUSTOM);

    it('should return schema with default and context options', () => {
        const schemaNoContext = prop.getSchema(emptyContext);
        expect(schemaNoContext.selector.select.options).toEqual([
            { value: '', label: '' },
            { value: 'container', label: 'Container' },
        ]);

        const schemaWithContext = prop.getSchema(contextWithElements);
        expect(schemaWithContext.selector.select.options).toEqual([
            { value: '', label: '' },
            { value: 'container', label: 'Container' },
            { value: 'el-1', label: 'Element 1' },
            { value: 'el-2', label: 'Element 2' },
        ]);
    });
});

describe('AnchorPoint Property', () => {
    const prop = new AnchorPoint();
    testCommonProperties(prop, 'anchorPoint', 'Anchor Point', 'layout.anchor.anchorPoint', PropertyGroup.ANCHOR, Layout.CUSTOM);
    it('should return correct schema for lcars_grid selector', () => {
        expect(prop.getSchema()).toEqual({
            name: 'anchorPoint', label: 'Anchor Point', type: 'custom', selector: { lcars_grid: { labelCenter: true } }
        });
    });
});

describe('TargetAnchorPoint Property', () => {
    const prop = new TargetAnchorPoint();
    testCommonProperties(prop, 'targetAnchorPoint', 'Target Point', 'layout.anchor.targetAnchorPoint', PropertyGroup.ANCHOR, Layout.CUSTOM);
    it('should return correct schema for lcars_grid selector', () => {
        expect(prop.getSchema()).toEqual({
            name: 'targetAnchorPoint', label: 'Target Point', type: 'custom', selector: { lcars_grid: { labelCenter: true } }
        });
    });
});

describe('Fill Property', () => {
    const prop = new Fill();
    testCommonProperties(prop, 'fill', 'Fill Color', 'props.fill', PropertyGroup.APPEARANCE, Layout.HALF);
    it('should return correct schema for color_rgb selector', () => {
        expect(prop.getSchema()).toEqual({ 
            name: 'fill', 
            label: 'Fill Color', 
            selector: { 
                color_rgb: {},
                __dynamic_color_support: true
            },
            type: 'custom'
        });
    });

    describe('formatValueForForm', () => {
        it('should convert 6-digit hex to RGB array', () => {
            expect(prop.formatValueForForm!('#FF00AA')).toEqual([255, 0, 170]);
        });
        it('should convert 3-digit hex to RGB array', () => {
            expect(prop.formatValueForForm!('#F0A')).toEqual([255, 0, 170]);
        });
        it('should return RGB array as is', () => {
            expect(prop.formatValueForForm!([10, 20, 30])).toEqual([10, 20, 30]);
        });
        it('should return [0,0,0] for invalid hex strings (wrong length or chars)', () => {
            expect(prop.formatValueForForm!('#FF00A')).toEqual([0,0,0]); // 5 chars
            expect(prop.formatValueForForm!('#GGHHII')).toEqual([0,0,0]); // invalid chars
        });
        it('should return original value if not a hex string or valid RGB array', () => {
            expect(prop.formatValueForForm!('red')).toBe('red');
            expect(prop.formatValueForForm!(null)).toBe(null);
            expect(prop.formatValueForForm!(undefined)).toBe(undefined);
            expect(prop.formatValueForForm!([10, 20])).toEqual([10, 20]); // invalid array
            expect(prop.formatValueForForm!(123)).toBe(123);
        });
    });
});

describe('LeftTextContent Property', () => {
    const prop = new LeftTextContent();
    testCommonProperties(prop, 'leftText', 'Left Text Content', 'props.leftText', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'leftText', label: 'Left Text Content', selector: { text: {} } });
    });
});

describe('RightTextContent Property', () => {
    const prop = new RightTextContent();
    testCommonProperties(prop, 'rightText', 'Right Text Content', 'props.rightText', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'rightText', label: 'Right Text Content', selector: { text: {} } });
    });
});

describe('TextContent Property', () => {
    const prop = new TextContent();
    testCommonProperties(prop, 'text', 'Text Content', 'props.text', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'text', label: 'Text Content', selector: { text: {} } });
    });
});

describe('FontSize Property', () => {
    const prop = new FontSize();
    testCommonProperties(prop, 'fontSize', 'Font Size (px)', 'props.fontSize', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'fontSize', label: 'Font Size (px)', selector: { number: { mode: 'box', step: 1, min: 1 } } });
    });
});

describe('FontFamily Property', () => {
    const prop = new FontFamily();
    testCommonProperties(prop, 'fontFamily', 'Font Family', 'props.fontFamily', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'fontFamily', label: 'Font Family', selector: { text: {} } });
    });
});

describe('FontWeight Property', () => {
    const prop = new FontWeight();
    testCommonProperties(prop, 'fontWeight', 'Font Weight', 'props.fontWeight', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema with select options', () => {
        const schema = prop.getSchema();
        expect(schema.name).toBe('fontWeight');
        expect(schema.selector.select.options).toBeInstanceOf(Array);
        expect(schema.selector.select.options.length).toBeGreaterThan(5); // Basic check
    });
});

describe('LetterSpacing Property', () => {
    const prop = new LetterSpacing();
    testCommonProperties(prop, 'letterSpacing', 'Letter Spacing', 'props.letterSpacing', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema for number selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'letterSpacing', label: 'Letter Spacing', selector: { number: { mode: 'box', step: 1 } } });
    });
});

describe('TextAnchor Property', () => {
    const prop = new TextAnchor();
    testCommonProperties(prop, 'textAnchor', 'Text Anchor', 'props.textAnchor', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema with select options', () => {
        const schema = prop.getSchema();
        expect(schema.name).toBe('textAnchor');
        expect(schema.selector.select.options).toEqual([
            { value: '', label: '' }, { value: 'start', label: 'Start' },
            { value: 'middle', label: 'Middle' }, { value: 'end', label: 'End' },
        ]);
    });
});

describe('DominantBaseline Property', () => {
    const prop = new DominantBaseline();
    testCommonProperties(prop, 'dominantBaseline', 'Dominant Baseline', 'props.dominantBaseline', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema with select options', () => {
        const schema = prop.getSchema();
        expect(schema.name).toBe('dominantBaseline');
        expect(schema.selector.select.options).toEqual([
            { value: '', label: '' }, { value: 'auto', label: 'Auto' },
            { value: 'middle', label: 'Middle' }, { value: 'central', label: 'Central' },
            { value: 'hanging', label: 'Hanging' },
        ]);
    });
});

describe('TextTransform Property', () => {
    const prop = new TextTransform();
    testCommonProperties(prop, 'textTransform', 'Text Transform', 'props.textTransform', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'textTransform', label: 'Text Transform', selector: { text: {} } });
    });
});

describe('Orientation Property', () => {
    const prop = new Orientation();
    testCommonProperties(prop, 'orientation', 'Orientation', 'props.orientation', PropertyGroup.APPEARANCE, Layout.HALF);
    it('should return correct schema with select options', () => {
        const schema = prop.getSchema();
        expect(schema.name).toBe('orientation');
        expect(schema.selector.select.options).toEqual([
            { value: 'top-left', label: 'Top Left' }, { value: 'top-right', label: 'Top Right' },
            { value: 'bottom-left', label: 'Bottom Left' }, { value: 'bottom-right', label: 'Bottom Right' },
        ]);
        expect(schema.default).toBe('top-left');
    });
});

describe('BodyWidth Property', () => {
    const prop = new BodyWidth();
    testCommonProperties(prop, 'bodyWidth', 'Body Width (px)', 'props.bodyWidth', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'bodyWidth', label: 'Body Width (px)', selector: { number: { mode: 'box', step: 1, min: 0 } } });
    });
});

describe('ArmHeight Property', () => {
    const prop = new ArmHeight();
    testCommonProperties(prop, 'armHeight', 'Arm Height (px)', 'props.armHeight', PropertyGroup.DIMENSIONS, Layout.HALF);
    it('should return correct schema', () => {
        expect(prop.getSchema()).toEqual({ name: 'armHeight', label: 'Arm Height (px)', selector: { number: { mode: 'box', step: 1, min: 0 } } });
    });
});

describe('Type Property', () => {
    const prop = new Type();
    testCommonProperties(prop, 'type', 'Element Type', 'type', PropertyGroup.TYPE, Layout.FULL);
    it('should return correct schema with all element type options', () => {
        const schema = prop.getSchema();
        expect(schema.name).toBe('type');
        expect(schema.selector.select.options).toEqual(expect.arrayContaining([
            { value: 'rectangle', label: 'Rectangle' },
            { value: 'text', label: 'Text' },
            { value: 'endcap', label: 'Endcap' },
            { value: 'elbow', label: 'Elbow' },
            { value: 'chisel-endcap', label: 'Chisel Endcap' },
            { value: 'top_header', label: 'Top Header' },
        ]));
    });
});

describe('Direction Property', () => {
    const prop = new Direction();
    testCommonProperties(prop, 'direction', 'Direction', 'props.direction', PropertyGroup.APPEARANCE, Layout.HALF);
    it('should return correct schema with left/right options', () => {
        const schema = prop.getSchema();
        expect(schema.selector.select.options).toEqual([
            { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
        ]);
    });
});

// --- Button Properties ---
describe('ButtonEnabled Property', () => {
    const prop = new ButtonEnabled();
    testCommonProperties(prop, 'button.enabled', 'Enable Button', 'button.enabled', PropertyGroup.BUTTON, Layout.FULL);
    it('should return correct schema for boolean selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.enabled', label: 'Enable Button', selector: { boolean: {} }, default: false });
    });
});

describe('ButtonHoverFill Property', () => {
    const prop = new ButtonHoverFill();
    testCommonProperties(prop, 'button.hover_fill', 'Hover Fill Color', 'button.hover_fill', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for color_rgb selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.hover_fill', label: 'Hover Fill Color', selector: { color_rgb: {} } });
    });
    it('should use Fill.prototype.formatValueForForm', () => {
        expect(prop.formatValueForForm).toBe(Fill.prototype.formatValueForForm);
    });
});

describe('ButtonHoverTransform Property', () => {
    const prop = new ButtonHoverTransform();
    testCommonProperties(prop, 'button.hover_transform', 'Hover Transform (CSS)', 'button.hover_transform', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for text selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.hover_transform', label: 'Hover Transform (CSS)', selector: { text: {} } });
    });
});

describe('ElbowTextPosition Property', () => {
    const prop = new ElbowTextPosition();
    testCommonProperties(prop, 'elbowTextPosition', 'Text Position', 'props.elbow_text_position', PropertyGroup.TEXT, Layout.HALF);
    it('should return correct schema with select options', () => {
        expect(prop.getSchema()).toEqual({
            name: 'elbowTextPosition',
            label: 'Text Position', 
            selector: { select: { options: [
                { value: 'top', label: 'Top (Horizontal Section)' },
                { value: 'side', label: 'Side (Vertical Section)' }
            ], mode: 'dropdown' }},
            default: 'top'
        });
    });
});

// --- Button Action Properties ---
describe('ButtonActionType Property', () => {
    const prop = new ButtonActionType();
    testCommonProperties(prop, 'button.action_config.type', 'Action Type', 'button.action_config.type', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema with action type options', () => {
        const schema = prop.getSchema();
        expect(schema.selector.select.options).toEqual(expect.arrayContaining([
            { value: 'none', label: 'None' },
            { value: 'call-service', label: 'Call Service' },
        ])); // Check a few
        expect(schema.default).toBe('none');
    });
});

describe('ButtonActionService Property', () => {
    const prop = new ButtonActionService();
    testCommonProperties(prop, 'button.action_config.service', 'Service (e.g., light.turn_on)', 'button.action_config.service', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for text selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.service', label: 'Service (e.g., light.turn_on)', selector: { text: {} } });
    });
});

describe('ButtonActionServiceData Property', () => {
    const prop = new ButtonActionServiceData();
    testCommonProperties(prop, 'button.action_config.service_data', 'Service Data (YAML or JSON)', 'button.action_config.service_data', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for object selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.service_data', label: 'Service Data (YAML or JSON)', selector: { object: {} } });
    });
});

describe('ButtonActionNavigationPath Property', () => {
    const prop = new ButtonActionNavigationPath();
    testCommonProperties(prop, 'button.action_config.navigation_path', 'Navigation Path (e.g., /lovelace/main)', 'button.action_config.navigation_path', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for text selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.navigation_path', label: 'Navigation Path (e.g., /lovelace/main)', selector: { text: {} } });
    });
});

describe('ButtonActionUrlPath Property', () => {
    const prop = new ButtonActionUrlPath();
    testCommonProperties(prop, 'button.action_config.url_path', 'URL (e.g., https://example.com)', 'button.action_config.url_path', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for text selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.url_path', label: 'URL (e.g., https://example.com)', selector: { text: {} } });
    });
});

describe('ButtonActionEntity Property', () => {
    const prop = new ButtonActionEntity();
    testCommonProperties(prop, 'button.action_config.entity', 'Entity ID', 'button.action_config.entity', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for entity selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.entity', label: 'Entity ID', selector: { entity: {} } });
    });
});

describe('ButtonActionConfirmation Property', () => {
    const prop = new ButtonActionConfirmation();
    testCommonProperties(prop, 'button.action_config.confirmation', 'Require Confirmation', 'button.action_config.confirmation', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for boolean selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.action_config.confirmation', label: 'Require Confirmation', selector: { boolean: {} } });
    });
});

describe('ButtonActiveFill Property', () => {
    const prop = new ButtonActiveFill();
    testCommonProperties(prop, 'button.active_fill', 'Active/Pressed Fill Color', 'button.active_fill', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for color_rgb selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.active_fill', label: 'Active/Pressed Fill Color', selector: { color_rgb: {} } });
    });
    it('should use Fill.prototype.formatValueForForm', () => {
        expect(prop.formatValueForForm).toBe(Fill.prototype.formatValueForForm);
    });
});

describe('ButtonActiveTransform Property', () => {
    const prop = new ButtonActiveTransform();
    testCommonProperties(prop, 'button.active_transform', 'Active Transform (CSS)', 'button.active_transform', PropertyGroup.BUTTON, Layout.HALF);
    it('should return correct schema for text selector', () => {
        expect(prop.getSchema()).toEqual({ name: 'button.active_transform', label: 'Active Transform (CSS)', selector: { text: {} } });
    });
});