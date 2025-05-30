// src/editor/elements/text.spec.ts

// vi.mock must be before any imports
vi.mock('../element', () => {
    const registerSpy = vi.fn();
    
    const PGMock = {
        ANCHOR: 'ANCHOR',
        STRETCH: 'STRETCH',
        BUTTON: 'BUTTON',
        DIMENSIONS: 'DIMENSIONS',
        APPEARANCE: 'APPEARANCE',
        POSITIONING: 'POSITIONING',
        TYPE: 'TYPE',
        TEXT: 'TEXT' // Added TEXT group
    };

    return {
        PropertyGroup: PGMock,
        PropertyGroupDefinition: undefined, // Mock, not used by tests directly
        EditorElement: class MockEditorElement {
            static registerEditorElement = registerSpy;
            
            id: string;
            type: string;
            config: any;
            
            constructor(config: any) {
                this.id = config.id;
                this.type = config.type;
                this.config = config;
                
                // Base EditorElement constructor behavior
                if (!this.config.layout) this.config.layout = {};
                if (!this.config.layout.stretch) this.config.layout.stretch = {};
                if (!this.config.button) this.config.button = {};
                // props is only created if it's in the input config, or handled by specific element constructor
            }

            // Mocked getSchema to reflect base EditorElement behavior driven by getPropertyGroups
            getSchema() {
                const groups = this.getPropertyGroups(); // This will call Text's getPropertyGroups
                const schema: Array<{name: string, selector?: any, type?: string}> = [];
                
                let typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
                // Add more specific labels if needed, e.g. for 'text' it's just 'Text'

                // 1. Type property (always first)
                schema.push({ name: 'type', selector: { select: { options: [{ value: this.type, label: typeLabel }] } } });
                
                // 2. Anchor properties (if ANCHOR group is not null)
                if (groups[PGMock.ANCHOR] !== null && groups[PGMock.ANCHOR]) { // For Text, this is true
                    schema.push({ name: 'anchorTo' });
                    schema.push({ name: 'anchorPoint', type: 'custom' });
                    schema.push({ name: 'targetAnchorPoint', type: 'custom' });
                }
                
                // 3. Button properties (conditional)
                const buttonGroupDef = groups[PGMock.BUTTON];
                if (this.config.button?.enabled) {
                    if (buttonGroupDef?.properties) {
                        buttonGroupDef.properties.forEach((prop: any) => {
                            const instance = new (prop as any)();
                            schema.push({ name: instance.name });
                        });
                    }
                } else {
                     schema.push({ name: 'button.enabled' });
                }
                
                // 4. Dimension properties
                const dimensionGroup = groups[PGMock.DIMENSIONS];
                if (dimensionGroup?.properties) {
                    dimensionGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name }); // For Text: Height, Width
                    });
                }
                
                // 5. Appearance properties
                const appearanceGroup = groups[PGMock.APPEARANCE];
                if (appearanceGroup?.properties) {
                    appearanceGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name }); // For Text: Fill
                    });
                }

                // 6. TEXT properties
                const textGroup = groups[PGMock.TEXT];
                if (textGroup?.properties) {
                    textGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // 7. Positioning properties
                const positioningGroup = groups[PGMock.POSITIONING];
                if (positioningGroup?.properties) {
                    positioningGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name }); // For Text: OffsetX, OffsetY
                    });
                }
                
                // 8. Stretch properties (dynamic based on config, as in base EditorElement)
                const stretchGroupDef = groups[PGMock.STRETCH];
                if (stretchGroupDef !== null && stretchGroupDef) { // For Text, this is true
                    const stretch = this.config.layout.stretch || {};
                    schema.push({ name: 'stretchTo1' });
                    
                    if (stretch.stretchTo1) {
                        schema.push({ name: 'stretchDirection1', type: 'custom' });
                        schema.push({ name: 'stretchPadding1' });
                        schema.push({ name: 'stretchTo2' });
                        
                        if (stretch.stretchTo2) {
                            schema.push({ name: 'stretchDirection2', type: 'custom' });
                            schema.push({ name: 'stretchPadding2' });
                        }
                    }
                }
                
                return schema;
            }
            
            // Mocked getFormData
            getFormData() {
                const formData: Record<string, any> = {};
                formData.type = this.config.type;
                
                // Props (e.g., fill, text, fontSize for Text)
                if (this.config.props) {
                    Object.entries(this.config.props).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }
                
                // Layout (e.g., width, height, offsetX, offsetY for Text)
                if (this.config.layout) {
                    const { stretch, anchor, ...otherLayout } = this.config.layout;
                    Object.entries(otherLayout).forEach(([key, value]) => {
                        formData[key] = value;
                    });

                    // Anchor properties
                    if (anchor) {
                        if (anchor.anchorTo !== undefined) formData.anchorTo = anchor.anchorTo;
                        if (anchor.anchorPoint !== undefined) formData.anchorPoint = anchor.anchorPoint;
                        if (anchor.targetAnchorPoint !== undefined) formData.targetAnchorPoint = anchor.targetAnchorPoint;
                    } else {
                         formData.anchorTo = ''; // Default if anchor object is missing but expected
                    }
                    
                    // Stretch properties
                    if (stretch) {
                        if (stretch.stretchTo1 !== undefined) formData.stretchTo1 = stretch.stretchTo1;
                        if (stretch.targetStretchAnchorPoint1 !== undefined) formData.stretchDirection1 = stretch.targetStretchAnchorPoint1;
                        if (stretch.stretchPadding1 !== undefined) formData.stretchPadding1 = stretch.stretchPadding1;
                        
                        if (stretch.stretchTo2 !== undefined) {
                            formData.stretchTo2 = stretch.stretchTo2;
                            if (stretch.targetStretchAnchorPoint2 !== undefined) formData.stretchDirection2 = stretch.targetStretchAnchorPoint2;
                            if (stretch.stretchPadding2 !== undefined) formData.stretchPadding2 = stretch.stretchPadding2;
                        } else {
                            formData.stretchTo2 = ''; // Default if stretchTo2 is not set
                        }
                    } else {
                        // Defaults if stretch object is missing
                        formData.stretchTo1 = '';
                        formData.stretchTo2 = '';
                    }
                } else {
                    // Defaults if layout object itself is missing
                    formData.anchorTo = '';
                    formData.stretchTo1 = '';
                    formData.stretchTo2 = '';
                }
                
                // Button properties (prefixed)
                if (this.config.button) {
                    Object.entries(this.config.button).forEach(([key, value]) => {
                        if (key === 'action_config' && typeof value === 'object' && value !== null) {
                            Object.entries(value).forEach(([acKey, acValue]) => {
                                formData[`button.action_config.${acKey}`] = acValue;
                            });
                        } else {
                            formData[`button.${key}`] = value;
                        }
                    });
                }
                
                // Ensure defaults for potentially undefined properties that schema might expect
                if (formData.stretchTo1 === undefined) formData.stretchTo1 = '';
                if (formData.stretchTo2 === undefined) formData.stretchTo2 = '';
                if (formData.anchorTo === undefined) formData.anchorTo = '';

                return formData;
            }
            
            // Mocked processDataUpdate (simulates base class logic)
            processDataUpdate(newData: any) {
                const configDelta: any = {}; // This represents the *changes* to be applied to the config

                // Direct props (fill, text, fontSize, fontFamily, etc. for Text)
                if (newData.fill !== undefined) configDelta.fill = newData.fill; // Will be placed under 'props' by editor
                if (newData.text !== undefined) configDelta.text = newData.text;
                if (newData.fontSize !== undefined) configDelta.fontSize = newData.fontSize;
                if (newData.fontFamily !== undefined) configDelta.fontFamily = newData.fontFamily;
                if (newData.fontWeight !== undefined) configDelta.fontWeight = newData.fontWeight;
                if (newData.letterSpacing !== undefined) configDelta.letterSpacing = newData.letterSpacing;
                if (newData.textAnchor !== undefined) configDelta.textAnchor = newData.textAnchor;
                if (newData.dominantBaseline !== undefined) configDelta.dominantBaseline = newData.dominantBaseline;
                if (newData.textTransform !== undefined) configDelta.textTransform = newData.textTransform;


                // Layout properties (width, height, offsetX, offsetY for Text)
                if (newData.width !== undefined) configDelta.width = newData.width; // Will be placed under 'layout'
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.offsetX !== undefined) configDelta.offsetX = newData.offsetX;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;

                // Anchor properties (handled by base class logic)
                if (newData.anchorTo !== undefined) {
                    configDelta.anchorTo = newData.anchorTo;
                    
                    if (newData.anchorTo && newData.anchorTo !== '') {
                        configDelta.anchorPoint = newData.anchorPoint || 'center';
                        configDelta.targetAnchorPoint = newData.targetAnchorPoint || 'center';
                    }
                }
                else {
                    if (newData.anchorPoint !== undefined) configDelta.anchorPoint = newData.anchorPoint;
                    if (newData.targetAnchorPoint !== undefined) configDelta.targetAnchorPoint = newData.targetAnchorPoint;
                }

                // Stretch properties (handled by base class logic, nested into layout.stretch)
                configDelta.layout = { stretch: {} };
                
                const processStretch = (index: number, suffix: string) => {
                    const stretchToKey = `stretchTo${suffix}`;
                    const directionKey = `stretchDirection${suffix}`;
                    const paddingKey = `stretchPadding${suffix}`;

                    if (newData[stretchToKey] !== undefined && newData[stretchToKey]) {
                        configDelta.layout.stretch[stretchToKey] = newData[stretchToKey];
                        if (newData[directionKey]) {
                            configDelta.layout.stretch[`targetStretchAnchorPoint${suffix}`] = newData[directionKey];
                            const isHorizontal = ['left', 'right', 'center', 'centerLeft', 'centerRight'].includes(newData[directionKey]);
                            configDelta.layout.stretch[`stretchAxis${suffix}`] = isHorizontal ? 'X' : 'Y';
                        }
                        if (newData[paddingKey] !== undefined) {
                            configDelta.layout.stretch[`stretchPadding${suffix}`] = newData[paddingKey];
                        }
                    }
                };
                processStretch(0, '1');
                processStretch(1, '2');

                // Button properties (prefixed, base class handles nesting and clearing)
                for (const [key, value] of Object.entries(newData)) {
                    if (key.startsWith('button.')) {
                        configDelta[key] = value;
                    }
                }
                
                if (newData['button.enabled'] === false) {
                    for (const key in configDelta) {
                        if (key.startsWith('button.') && key !== 'button.enabled') {
                            delete configDelta[key];
                        }
                    }
                    const actionConfigPrefix = 'button.action_config.';
                    Object.keys(newData).forEach(key => { 
                        if (key.startsWith(actionConfigPrefix)) {
                           delete configDelta[key];
                        }
                    });
                } else if (newData['button.enabled'] === true) {
                    if (newData['button.hover_transform'] === undefined && this.config.button?.hover_transform) {
                        configDelta['button.hover_transform'] = this.config.button.hover_transform;
                    }
                    if (newData['button.active_transform'] === undefined && this.config.button?.active_transform) {
                        configDelta['button.active_transform'] = this.config.button.active_transform;
                    }
                    if (!newData['button.action_config.type'] || newData['button.action_config.type'] === 'none') {
                        delete configDelta['button.action_config.service'];
                        delete configDelta['button.action_config.service_data'];
                        delete configDelta['button.action_config.navigation_path'];
                        delete configDelta['button.action_config.url_path'];
                        delete configDelta['button.action_config.entity'];
                    }
                }
                
                return configDelta;
            }
            
            getPropertyGroups(): Record<string, any> {
                throw new Error("MockEditorElement.getPropertyGroups should not be called directly; Text element should override it.");
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from '../element'; // Mocked base class and real enum

import {
    TextContent, TextColor, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform, CutoutText, // Text specific
    Fill, // Appearance for Text
    Width, Height, // Dimensions for Text
    ButtonEnabled, ButtonHoverFill, ButtonActiveFill, ButtonHoverTransform, ButtonActiveTransform, ButtonActionType,
    OffsetX, OffsetY, Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint // Anchor properties are used by Text
} from '../../properties/properties';

import { Text } from '../text'; // The class under test

describe('Text EditorElement', () => {
    let textEditorElement: Text;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks();
        EditorElement.registerEditorElement('text', Text);

        config = {
            id: 'test-text',
            type: 'text',
        };
        textEditorElement = new Text(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('text', Text);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new Text({ id: 'txt1', type: 'text' });
            expect(el.config.layout).toEqual({ stretch: {} });
            expect(el.config.button).toEqual({});
            expect(el.config.props).toBeUndefined();
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'txt2',
                type: 'text',
                props: { text: 'Hello', fill: 'blue', fontSize: 20 },
                layout: { width: 100, offsetX: 5, anchor: { anchorTo: 'container' } },
                button: { enabled: true, text: 'Click Me' }
            };
            const el = new Text(initialConfig);
            expect(el.config.props).toEqual({ text: 'Hello', fill: 'blue', fontSize: 20 });
            expect(el.config.layout).toEqual({ width: 100, offsetX: 5, anchor: { anchorTo: 'container' }, stretch: {} });
            expect(el.config.button).toEqual({ enabled: true, text: 'Click Me' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("../element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = textEditorElement.getPropertyGroups();
        });

        it('should define ANCHOR group as enabled (not null)', () => {
            expect(groups[PropertyGroup.ANCHOR]).toBeDefined();
            expect(groups[PropertyGroup.ANCHOR]).not.toBeNull();
            expect(groups[PropertyGroup.ANCHOR]?.properties).toEqual([]);
        });

        it('should define STRETCH group with empty properties (relying on base class)', () => {
            expect(groups[PropertyGroup.STRETCH]).toBeDefined();
            expect(groups[PropertyGroup.STRETCH]?.properties).toEqual([]);
        });

        it('should define APPEARANCE group with Fill', () => {
            expect(groups[PropertyGroup.APPEARANCE]).toBeDefined();
            expect(groups[PropertyGroup.APPEARANCE]?.properties).toEqual([Fill]);
        });

        it('should define TEXT group with text-specific properties', () => {
            expect(groups[PropertyGroup.TEXT]).toBeDefined();
            const textProps = groups[PropertyGroup.TEXT]?.properties;
            const expectedTextProps = [
                TextContent, TextColor, FontSize, FontFamily, FontWeight, LetterSpacing,
                TextAnchor, DominantBaseline, TextTransform, CutoutText
            ];
            expect(textProps).toEqual(expectedTextProps);
        });

        it('should define BUTTON group with a comprehensive list of button properties', () => {
            expect(groups[PropertyGroup.BUTTON]).toBeDefined();
            const buttonProps = groups[PropertyGroup.BUTTON]?.properties;
            const expectedButtonProps = [
                ButtonEnabled, ButtonHoverFill, ButtonActiveFill,
                ButtonHoverTransform, ButtonActiveTransform, ButtonActionType
            ];
            expect(buttonProps).toEqual(expectedButtonProps);
        });

        it('should define DIMENSIONS group with Height and Width', () => {
            expect(groups[PropertyGroup.DIMENSIONS]).toBeDefined();
            expect(groups[PropertyGroup.DIMENSIONS]?.properties).toEqual([Height, Width]);
        });

        it('should define POSITIONING group with OffsetX and OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetX, OffsetY]);
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first with "Text" label', () => {
            const schema = textEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector.select.options).toEqual([{ value: 'text', label: 'Text' }]);
        });

        it('should include anchor properties in the schema', () => {
            const schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'anchorTo')).toBeDefined();
            expect(schema.find(s => s.name === 'anchorPoint' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'targetAnchorPoint' && s.type === 'custom')).toBeDefined();
        });

        it('should include stretch properties dynamically (base class behavior)', () => {
            let schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined();

            textEditorElement.config.layout.stretch = { stretchTo1: 'container' };
            schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchDirection1' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
        });

        it('should include only ButtonEnabled if button.enabled is false/undefined', () => {
            textEditorElement.config.button = { enabled: false };
            let schema = textEditorElement.getSchema();
            let buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');

            textEditorElement.config.button = {}; // enabled is implicitly false
            schema = textEditorElement.getSchema();
            buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');
        });

        it('should include all defined button properties if button.enabled is true', () => {
            textEditorElement.config.button = { enabled: true };
            const schema = textEditorElement.getSchema();
            
            const expectedButtonPropInstances = [
                new ButtonEnabled(), new ButtonHoverFill(), new ButtonActiveFill(),
                new ButtonHoverTransform(), new ButtonActiveTransform(), new ButtonActionType()
            ];
            expectedButtonPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include appearance property (Fill)', () => {
            const schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'fill')).toBeDefined();
        });

        it('should include text-specific properties', () => {
            const schema = textEditorElement.getSchema();
            const expectedTextPropInstances = [
                new TextContent(), new TextColor(), new FontSize(), new FontFamily(), 
                new FontWeight(), new LetterSpacing(), new TextAnchor(), new DominantBaseline(), new TextTransform()
            ];
            expectedTextPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include dimension properties (Height, Width)', () => {
            const schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
            expect(schema.find(s => s.name === 'width')).toBeDefined();
        });

        it('should include positioning properties (OffsetX, OffsetY)', () => {
            const schema = textEditorElement.getSchema();
            expect(schema.find(s => s.name === 'offsetX')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config for Text', () => {
            const testConfig = {
                id: 'txt-formdata', type: 'text',
                props: {
                    text: 'LCARS Test', fill: [255, 153, 0], fontSize: 24, fontFamily: 'Arial',
                    fontWeight: 'bold', letterSpacing: '1px', textAnchor: 'middle',
                    dominantBaseline: 'central', textTransform: 'uppercase'
                },
                layout: {
                    width: 200, height: 50, offsetX: 10, offsetY: -5,
                    anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' },
                    stretch: { stretchTo1: 'el-other', targetStretchAnchorPoint1: 'top', stretchPadding1: 5 }
                },
                button: { enabled: true, text: 'My Text Button', font_size: 12 }
            };
            const el = new Text(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('text');
            // Props
            expect(formData.text).toBe('LCARS Test');
            expect(formData.fill).toEqual([255, 153, 0]);
            expect(formData.fontSize).toBe(24);
            expect(formData.fontFamily).toBe('Arial');
            expect(formData.fontWeight).toBe('bold');
            expect(formData.letterSpacing).toBe('1px');
            expect(formData.textAnchor).toBe('middle');
            expect(formData.dominantBaseline).toBe('central');
            expect(formData.textTransform).toBe('uppercase');
            // Layout
            expect(formData.width).toBe(200);
            expect(formData.height).toBe(50);
            expect(formData.offsetX).toBe(10);
            expect(formData.offsetY).toBe(-5);
            // Anchor & Stretch
            expect(formData.anchorTo).toBe('container');
            expect(formData.stretchTo1).toBe('el-other');
            // Button
            expect(formData['button.enabled']).toBe(true);
            expect(formData['button.text']).toBe('My Text Button');
        });

        it('should handle missing optional Text-specific props', () => {
            const testConfig = {
                id: 'txt-formdata-min', type: 'text',
                props: { text: 'Minimal' }, // Only text in props
                layout: { width: 50 }
            };
            const el = new Text(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('text');
            expect(formData.text).toBe('Minimal');
            expect(formData.fill).toBeUndefined();
            expect(formData.fontSize).toBeUndefined();
            // ... other text props
            expect(formData.width).toBe(50);
            expect(formData.height).toBeUndefined();
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process full form data (including Text props) back to config delta', () => {
            const formDataFromUI = {
                type: 'text', 
                text: 'Updated LCARS', fill: [0, 255, 0], fontSize: 18, fontFamily: 'Verdana',
                fontWeight: 'normal', letterSpacing: 'normal', textAnchor: 'start',
                dominantBaseline: 'auto', textTransform: 'none',
                width: 250, height: 60, offsetX: 15, offsetY: 0,
                anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomRight',
                stretchTo1: 'container', stretchDirection1: 'left', stretchPadding1: 2,
                'button.enabled': true, 'button.text': 'New Text Button'
            };
            const el = new Text({ id: 'txt-update', type: 'text' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            // Props (top-level in delta, editor nests them into 'props')
            expect(configDelta.text).toBe('Updated LCARS');
            expect(configDelta.fill).toEqual([0, 255, 0]);
            expect(configDelta.fontSize).toBe(18);
            expect(configDelta.fontFamily).toBe('Verdana');
            // ... other text props

            // Layout (top-level in delta, editor nests them into 'layout')
            expect(configDelta.width).toBe(250);
            expect(configDelta.height).toBe(60);
            // ... other layout, anchor, stretch, button props (tested in other specs, assume base handles them)
        });

        // Other tests like clearing anchor, disabling button, etc., are assumed to be
        // covered by the base EditorElement mock's behavior, similar to chisel_endcap.spec.ts.
    });
});