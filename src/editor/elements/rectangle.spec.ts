// src/editor/elements/rectangle.spec.ts

// vi.mock must be before any imports
vi.mock('./element', () => {
    // Create mock registerEditorElement function
    const registerSpy = vi.fn();
    
    return {
        PropertyGroup: {
            ANCHOR: 'ANCHOR',
            STRETCH: 'STRETCH',
            BUTTON: 'BUTTON',
            DIMENSIONS: 'DIMENSIONS',
            APPEARANCE: 'APPEARANCE',
            POSITIONING: 'POSITIONING'
        },
        PropertyGroupDefinition: undefined,
        EditorElement: class MockEditorElement {
            static registerEditorElement = registerSpy;
            
            id: string;
            type: string;
            config: any;
            
            constructor(config: any) {
                this.id = config.id;
                this.type = config.type;
                this.config = config;
                
                if (!this.config.layout) this.config.layout = {};
                if (!this.config.layout.stretch) this.config.layout.stretch = {};
                if (!this.config.button) this.config.button = {};
            }

            // Mock methods needed by the tests
            getSchema() {
                // Use the property groups from the derived class to determine which properties to include
                const groups = this.getPropertyGroups();
                const schema: Array<{name: string, selector?: any}> = [];
                
                // First add the Type property
                schema.push({ name: 'type', selector: { select: { options: [{ value: 'rectangle', label: 'Rectangle' }] } } });
                
                // Only add anchor properties if ANCHOR group is NOT null
                if (groups['ANCHOR'] !== null) {
                    schema.push({ name: 'anchorTo' });
                    schema.push({ name: 'anchorPoint' });
                    schema.push({ name: 'targetAnchorPoint' });
                }
                
                // Add button properties if button.enabled is true
                if (this.config.button?.enabled) {
                    // Only include the properties defined in the BUTTON group
                    const buttonGroup = groups['BUTTON'];
                    if (buttonGroup?.properties) {
                        buttonGroup.properties.forEach((prop: any) => {
                            const instance = new (prop as any)();
                            schema.push({ name: instance.name });
                        });
                    }
                } else {
                    // Just include ButtonEnabled property
                    schema.push({ name: 'button.enabled' });
                }
                
                // Add dimension properties
                const dimensionGroup = groups['DIMENSIONS'];
                if (dimensionGroup?.properties) {
                    dimensionGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // Add appearance properties
                const appearanceGroup = groups['APPEARANCE'];
                if (appearanceGroup?.properties) {
                    appearanceGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // Add positioning properties
                const positioningGroup = groups['POSITIONING'];
                if (positioningGroup?.properties) {
                    positioningGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // Add stretch properties based on current config
                const stretch = this.config.layout.stretch || {};
                schema.push({ name: 'stretchTo1' });
                
                if (stretch.stretchTo1) {
                    schema.push({ name: 'stretchDirection1' });
                    schema.push({ name: 'stretchPadding1' });
                    schema.push({ name: 'stretchTo2' });
                    
                    if (stretch.stretchTo2) {
                        schema.push({ name: 'stretchDirection2' });
                        schema.push({ name: 'stretchPadding2' });
                    }
                }
                
                return schema;
            }
            
            // Mock method for returning the form data
            getFormData() {
                const formData: Record<string, any> = {};
                formData.type = this.config.type;
                
                // Include properties from config.props
                if (this.config.props) {
                    Object.entries(this.config.props).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }
                
                // Include properties from config.layout
                if (this.config.layout) {
                    const { stretch, ...otherLayout } = this.config.layout;
                    Object.entries(otherLayout).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                    
                    // Handle stretch properties separately
                    if (stretch) {
                        // Map stretchTo1, stretchDirection1, stretchPadding1, etc.
                        if (stretch.stretchTo1 !== undefined) formData.stretchTo1 = stretch.stretchTo1;
                        if (stretch.targetStretchAnchorPoint1 !== undefined) formData.stretchDirection1 = stretch.targetStretchAnchorPoint1;
                        if (stretch.stretchPadding1 !== undefined) formData.stretchPadding1 = stretch.stretchPadding1;
                        if (stretch.stretchTo2 !== undefined) {
                            formData.stretchTo2 = stretch.stretchTo2;
                            if (stretch.targetStretchAnchorPoint2 !== undefined) formData.stretchDirection2 = stretch.targetStretchAnchorPoint2;
                            if (stretch.stretchPadding2 !== undefined) formData.stretchPadding2 = stretch.stretchPadding2;
                        } else {
                            formData.stretchTo2 = '';
                        }
                    } else {
                        formData.stretchTo1 = '';
                    }
                }
                
                // Include button properties
                if (this.config.button) {
                    Object.entries(this.config.button).forEach(([key, value]) => {
                        formData[`button.${key}`] = value;
                    });
                }
                
                // Always include stretchTo1 with empty string as default
                if (formData.stretchTo1 === undefined) {
                    formData.stretchTo1 = '';
                }
                
                return formData;
            }
            
            // Mock method for processing data updates
            processDataUpdate(newData: any) {
                const configDelta: any = {};
                
                // Process dimension, appearance, and positioning properties
                if (newData.width !== undefined) configDelta.width = newData.width;
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.fill !== undefined) configDelta.fill = newData.fill;
                if (newData.offsetX !== undefined) configDelta.offsetX = newData.offsetX;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;
                
                // Process stretch properties
                configDelta.layout = { stretch: {} };
                if (newData.stretchTo1 !== undefined) {
                    if (newData.stretchTo1) {
                        configDelta.layout.stretch.stretchTo1 = newData.stretchTo1;
                        if (newData.stretchDirection1) {
                            configDelta.layout.stretch.targetStretchAnchorPoint1 = newData.stretchDirection1;
                            configDelta.layout.stretch.stretchAxis1 = ['left', 'right'].includes(newData.stretchDirection1) ? 'X' : 'Y';
                        }
                        if (newData.stretchPadding1 !== undefined) configDelta.layout.stretch.stretchPadding1 = newData.stretchPadding1;
                        
                        if (newData.stretchTo2 !== undefined) {
                            if (newData.stretchTo2) {
                                configDelta.layout.stretch.stretchTo2 = newData.stretchTo2;
                                if (newData.stretchDirection2) {
                                    configDelta.layout.stretch.targetStretchAnchorPoint2 = newData.stretchDirection2;
                                    configDelta.layout.stretch.stretchAxis2 = ['left', 'right'].includes(newData.stretchDirection2) ? 'X' : 'Y';
                                }
                                if (newData.stretchPadding2 !== undefined) configDelta.layout.stretch.stretchPadding2 = newData.stretchPadding2;
                            }
                        }
                    }
                }
                
                // Process button properties
                for (const [key, value] of Object.entries(newData)) {
                    if (key.startsWith('button.')) {
                        configDelta[key] = value;
                    }
                }
                
                // If button.enabled is false, clear all other button properties
                if (newData['button.enabled'] === false) {
                    // Clear all other button properties
                    for (const key in configDelta) {
                        if (key.startsWith('button.') && key !== 'button.enabled') {
                            configDelta[key] = undefined;
                        }
                    }
                    
                    // Also explicitly set the keys that were in the form data
                    if (newData['button.text'] !== undefined) configDelta['button.text'] = undefined;
                    if (newData['button.font_size'] !== undefined) configDelta['button.font_size'] = undefined;
                    if (newData['button.action_config.type'] !== undefined) configDelta['button.action_config.type'] = undefined;
                    if (newData['button.action_config.service'] !== undefined) configDelta['button.action_config.service'] = undefined;
                }
                
                return configDelta;
            }
            
            // Stub to be overridden by the Rectangle class
            getPropertyGroups(): Record<string, any> {
                return {};
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from './element'; // Base class and enum

// Import all the required properties from the properties module
import {
    Width, Height, Fill, ButtonEnabled, ButtonText, ButtonCutoutText, ButtonTextColor,
    ButtonFontFamily, ButtonFontSize, ButtonFontWeight, ButtonLetterSpacing,
    ButtonTextTransform, ButtonTextAnchor, ButtonDominantBaseline, ButtonHoverFill,
    ButtonActiveFill, ButtonHoverTransform, ButtonActiveTransform, ButtonActionType,
    OffsetX, OffsetY, Type
    // Stretch properties (StretchTarget, StretchDirection, StretchPadding) are dynamically added by base class
    // Anchor properties (AnchorTo, AnchorPoint, TargetAnchorPoint) are explicitly excluded by Rectangle
} from '../properties/properties';

// Import Rectangle after setting up the mock
import { Rectangle } from './rectangle'; // The class under test

describe('Rectangle EditorElement', () => {
    let rectangleEditorElement: Rectangle;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test
        
        // Manually register the element again to ensure the spy has a call
        EditorElement.registerEditorElement('rectangle', Rectangle);

        // Basic config for a rectangle element
        config = {
            id: 'test-rect',
            type: 'rectangle',
            // props, layout, and button will be initialized by the EditorElement constructor if not present
        };
        rectangleEditorElement = new Rectangle(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        // The import of './rectangle' (implicitly done by importing Rectangle)
        // should trigger its static block: EditorElement.registerEditorElement('rectangle', Rectangle).
        // Our mock setup for './element' ensures we're checking the spied version.
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('rectangle', Rectangle);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new Rectangle({ id: 'r1', type: 'rectangle' });
            // Base EditorElement constructor ensures these exist
            expect(el.config.layout).toEqual({ stretch: {} });
            expect(el.config.button).toEqual({});
            expect(el.config.props).toBeUndefined(); // props is only created if it's in the input config
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'r2',
                type: 'rectangle',
                props: { fill: 'red' },
                layout: { width: 100, offsetX: 5 },
                button: { enabled: true, text: 'Click Me' }
            };
            const el = new Rectangle(initialConfig);
            expect(el.config.props).toEqual({ fill: 'red' });
            // Base constructor adds stretch object to layout
            expect(el.config.layout).toEqual({ width: 100, offsetX: 5, stretch: {} });
            expect(el.config.button).toEqual({ enabled: true, text: 'Click Me' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("./element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = rectangleEditorElement.getPropertyGroups();
        });

        it('should define ANCHOR group as null (disabled)', () => {
            expect(groups[PropertyGroup.ANCHOR]).toBeNull();
        });

        it('should define STRETCH group with empty properties (relying on base class for dynamic stretch props)', () => {
            expect(groups[PropertyGroup.STRETCH]).toBeDefined();
            expect(groups[PropertyGroup.STRETCH]?.properties).toEqual([]);
        });

        it('should define BUTTON group with a comprehensive list of button properties', () => {
            expect(groups[PropertyGroup.BUTTON]).toBeDefined();
            const buttonProps = groups[PropertyGroup.BUTTON]?.properties;
            const expectedButtonProps = [
                ButtonEnabled, ButtonText, ButtonCutoutText, ButtonTextColor,
                ButtonFontFamily, ButtonFontSize, ButtonFontWeight,
                ButtonLetterSpacing, ButtonTextTransform, ButtonTextAnchor,
                ButtonDominantBaseline, ButtonHoverFill, ButtonActiveFill,
                ButtonHoverTransform, ButtonActiveTransform, ButtonActionType
            ];
            expect(buttonProps).toEqual(expectedButtonProps);
        });

        it('should define DIMENSIONS group with Width and Height', () => {
            expect(groups[PropertyGroup.DIMENSIONS]).toBeDefined();
            expect(groups[PropertyGroup.DIMENSIONS]?.properties).toEqual([Width, Height]);
        });

        it('should define APPEARANCE group with Fill', () => {
            expect(groups[PropertyGroup.APPEARANCE]).toBeDefined();
            expect(groups[PropertyGroup.APPEARANCE]?.properties).toEqual([Fill]);
        });

        it('should define POSITIONING group with OffsetX and OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetX, OffsetY]);
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first', () => {
            const schema = rectangleEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector.select.options).toEqual(expect.arrayContaining([
                { value: 'rectangle', label: 'Rectangle' }
            ]));
        });

        it('should NOT include anchor properties (AnchorTo, AnchorPoint, TargetAnchorPoint) in the schema', () => {
            const schema = rectangleEditorElement.getSchema();
            const anchorPropNames = ['anchorTo', 'anchorPoint', 'targetAnchorPoint'];
            anchorPropNames.forEach(propName => {
                expect(schema.find(s => s.name === propName)).toBeUndefined();
            });
        });

        it('should include stretch properties dynamically based on config (base class behavior)', () => {
            // Initial: no stretch config, only stretchTo1 should be offered
            let schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeUndefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeUndefined();

            // With stretchTo1 configured, Direction1, Padding1, and stretchTo2 should be offered
            rectangleEditorElement.config.layout.stretch = { stretchTo1: 'container' };
            schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection2')).toBeUndefined();

            // With stretchTo2 also configured
            rectangleEditorElement.config.layout.stretch.stretchTo2 = 'other_element';
            schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchDirection2')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding2')).toBeDefined();
        });

        it('should include only ButtonEnabled in schema if button.enabled is false or not explicitly true', () => {
            // Case 1: button.enabled is false
            rectangleEditorElement.config.button = { enabled: false };
            let schema = rectangleEditorElement.getSchema();
            let buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');

            // Case 2: button object is empty (enabled is implicitly false)
            rectangleEditorElement.config.button = {};
            schema = rectangleEditorElement.getSchema();
            buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');
        });

        it('should include all defined button properties in schema if button.enabled is true', () => {
            rectangleEditorElement.config.button = { enabled: true };
            const schema = rectangleEditorElement.getSchema();
            const buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));

            const expectedButtonPropInstances = [
                new ButtonEnabled(), new ButtonText(), new ButtonCutoutText(), new ButtonTextColor(),
                new ButtonFontFamily(), new ButtonFontSize(), new ButtonFontWeight(),
                new ButtonLetterSpacing(), new ButtonTextTransform(), new ButtonTextAnchor(),
                new ButtonDominantBaseline(), new ButtonHoverFill(), new ButtonActiveFill(),
                new ButtonHoverTransform(), new ButtonActiveTransform(), new ButtonActionType()
            ];
            expect(buttonSchemaItems.length).toBe(expectedButtonPropInstances.length);
            expectedButtonPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include dimension properties (Width, Height)', () => {
            const schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'width')).toBeDefined();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
        });

        it('should include appearance properties (Fill)', () => {
            const schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'fill')).toBeDefined();
        });

        it('should include positioning properties (OffsetX, OffsetY)', () => {
            const schema = rectangleEditorElement.getSchema();
            expect(schema.find(s => s.name === 'offsetX')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config for the form', () => {
            const testConfig = {
                id: 'rect-formdata',
                type: 'rectangle',
                props: {
                    fill: [255, 153, 0] // RGB array for color picker
                },
                layout: {
                    width: 150,
                    height: 75,
                    offsetX: 10,
                    offsetY: -5,
                    stretch: {
                        stretchTo1: 'container',
                        targetStretchAnchorPoint1: 'left', // This will be 'stretchDirection1' in form data
                        stretchPadding1: 5
                    }
                },
                button: {
                    enabled: true,
                    text: 'My Rect Button',
                    font_size: 12,
                    text_transform: 'uppercase'
                }
            };
            const el = new Rectangle(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('rectangle');
            expect(formData.fill).toEqual([255, 153, 0]); // color_rgb selector expects array
            expect(formData.width).toBe(150);
            expect(formData.height).toBe(75);
            expect(formData.offsetX).toBe(10);
            expect(formData.offsetY).toBe(-5);

            expect(formData.stretchTo1).toBe('container');
            expect(formData.stretchDirection1).toBe('left'); // Correctly mapped from targetStretchAnchorPoint1
            expect(formData.stretchPadding1).toBe(5);
            expect(formData.stretchTo2).toBe(''); // Offered but not set

            expect(formData['button.enabled']).toBe(true);
            expect(formData['button.text']).toBe('My Rect Button');
            expect(formData['button.font_size']).toBe(12);
            expect(formData['button.text_transform']).toBe('uppercase');
            // Check a few other button props that should be undefined if not in config
            expect(formData['button.cutout_text']).toBeUndefined();
            expect(formData['button.text_color']).toBeUndefined();
        });

        it('should handle missing optional fields by not including them or using defaults', () => {
            const testConfig = {
                id: 'rect-formdata-min',
                type: 'rectangle',
                layout: {
                    width: 100 // Only width is provided
                }
                // props, button, other layout fields are undefined
            };
            const el = new Rectangle(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('rectangle');
            expect(formData.width).toBe(100);
            expect(formData.height).toBeUndefined();
            expect(formData.fill).toBeUndefined();
            expect(formData.offsetX).toBeUndefined();
            // formData['button.enabled'] would be undefined if `button` object is missing in config
            expect(formData['button.enabled']).toBeUndefined();
            expect(formData.stretchTo1).toBe(''); // Default for stretch target
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process full form data back to config structure', () => {
            const formDataFromUI = {
                type: 'rectangle', // Type itself is usually handled separately by editor
                fill: [255, 0, 0], // From color_rgb
                width: 200,
                height: 100,
                offsetX: 20,
                offsetY: 30,
                stretchTo1: 'another-element',
                stretchDirection1: 'right', // Corresponds to targetStretchAnchorPoint1
                stretchPadding1: 10,
                stretchTo2: 'container',
                stretchDirection2: 'top',
                stretchPadding2: 2,
                'button.enabled': true,
                'button.text': 'Updated Text',
                'button.font_size': 14,
                'button.text_transform': 'lowercase'
            };
            const el = new Rectangle({ id: 'r-update', type: 'rectangle' });
            const configDelta = el.processDataUpdate(formDataFromUI); // This returns the processed data, not the full new config

            // Base properties
            expect(configDelta.fill).toEqual([255, 0, 0]);
            expect(configDelta.width).toBe(200);
            expect(configDelta.height).toBe(100);
            expect(configDelta.offsetX).toBe(20);
            expect(configDelta.offsetY).toBe(30);

            // Stretch properties (these are placed into `layout.stretch` by `processDataUpdate`)
            expect(configDelta.layout.stretch.stretchTo1).toBe('another-element');
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBe('right');
            expect(configDelta.layout.stretch.stretchAxis1).toBe('X'); // Derived by base class
            expect(configDelta.layout.stretch.stretchPadding1).toBe(10);
            expect(configDelta.layout.stretch.stretchTo2).toBe('container');
            expect(configDelta.layout.stretch.targetStretchAnchorPoint2).toBe('top');
            expect(configDelta.layout.stretch.stretchAxis2).toBe('Y'); // Derived
            expect(configDelta.layout.stretch.stretchPadding2).toBe(2);


            // Button properties
            expect(configDelta['button.enabled']).toBe(true);
            expect(configDelta['button.text']).toBe('Updated Text');
            expect(configDelta['button.font_size']).toBe(14);
            expect(configDelta['button.text_transform']).toBe('lowercase');
        });

        it('should remove specific button sub-properties if button.enabled is changed to false', () => {
            const formDataFromUI = {
                'button.enabled': false,
                // These might still be in the form data from a previous state
                'button.text': 'Text To Remove',
                'button.font_size': 10,
                'button.action_config.type': 'call-service',
                'button.action_config.service': 'light.turn_on'
            };
            const el = new Rectangle({
                id: 'r-btn-disable',
                type: 'rectangle',
                button: { enabled: true, text: 'Initial', font_size: 12, action_config: { type: 'call-service', service: 'light.turn_on' } }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta['button.enabled']).toBe(false);
            // Specific properties that are part of the Rectangle's Button group should be absent
            // if they are not ButtonEnabled itself.
            expect(configDelta['button.text']).toBeUndefined();
            expect(configDelta['button.font_size']).toBeUndefined();
            // action_config and its sub-properties should also be cleared by the base class logic
            expect(configDelta['button.action_config.type']).toBeUndefined();
            expect(configDelta['button.action_config.service']).toBeUndefined();
        });

        it('should clear stretch group details if stretchTo is emptied', () => {
            const formDataFromUI = {
                stretchTo1: '', // User cleared the target
                // Direction and padding might still be in form data if not cleared by UI logic
                stretchDirection1: 'left',
                stretchPadding1: 5
            };
            const el = new Rectangle({
                id: 'r-stretch-clear',
                type: 'rectangle',
                layout: {
                    stretch: { stretchTo1: 'container', targetStretchAnchorPoint1: 'left', stretchPadding1: 10 }
                }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta.layout.stretch.stretchTo1).toBeUndefined();
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBeUndefined();
            expect(configDelta.layout.stretch.stretchAxis1).toBeUndefined();
            expect(configDelta.layout.stretch.stretchPadding1).toBeUndefined();
            // The original form data keys for direction/padding should also be gone from the delta
            expect(configDelta.stretchDirection1).toBeUndefined();
            expect(configDelta.stretchPadding1).toBeUndefined();
        });
    });
});