// src/editor/elements/chisel_endcap.spec.ts

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
        TEXT: 'TEXT' // Though not used by ChiselEndcap, keep for mock consistency
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
                const groups = this.getPropertyGroups(); // This will call ChiselEndcap's getPropertyGroups
                const schema: Array<{name: string, selector?: any, type?: string}> = [];
                
                // Determine type label based on this.type
                let typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
                if (this.type === 'chisel-endcap') typeLabel = 'Chisel Endcap';
                else if (this.type === 'top_header') typeLabel = 'Top Header';
                // Add more specific labels if needed

                // 1. Type property (always first)
                schema.push({ name: 'type', selector: { select: { options: [{ value: this.type, label: typeLabel }] } } });
                
                // 2. Anchor properties (if ANCHOR group is not null)
                if (groups[PGMock.ANCHOR] !== null && groups[PGMock.ANCHOR]) { // For ChiselEndcap, this is true
                    schema.push({ name: 'anchorTo' }); // Actual property classes would add more detail
                    schema.push({ name: 'anchorPoint', type: 'custom' }); // Mocking as custom based on properties.ts
                    schema.push({ name: 'targetAnchorPoint', type: 'custom' });
                }
                
                // 3. Button properties (conditional)
                const buttonGroupDef = groups[PGMock.BUTTON];
                if (this.config.button?.enabled) {
                    if (buttonGroupDef?.properties) {
                        buttonGroupDef.properties.forEach((prop: any) => {
                            const instance = new (prop as any)(); // Instantiate to get name
                            schema.push({ name: instance.name });
                        });
                    }
                    
                    // Include TEXT group properties when buttons are enabled
                    const textGroupDef = groups[PGMock.TEXT];
                    if (textGroupDef?.properties) {
                        textGroupDef.properties.forEach((prop: any) => {
                            const instance = new (prop as any)();
                            schema.push({ name: instance.name });
                        });
                    }
                } else {
                     schema.push({ name: 'button.enabled' }); // Only ButtonEnabled if not enabled
                }
                
                // 4. Dimension properties
                const dimensionGroup = groups[PGMock.DIMENSIONS];
                if (dimensionGroup?.properties) {
                    dimensionGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // 5. Appearance properties
                const appearanceGroup = groups[PGMock.APPEARANCE];
                if (appearanceGroup?.properties) {
                    appearanceGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // 6. Positioning properties
                const positioningGroup = groups[PGMock.POSITIONING];
                if (positioningGroup?.properties) {
                    positioningGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                // 7. Stretch properties (dynamic based on config, as in base EditorElement)
                const stretchGroupDef = groups[PGMock.STRETCH];
                if (stretchGroupDef !== null && stretchGroupDef) { // For ChiselEndcap, this is true
                    const stretch = this.config.layout.stretch || {};
                    schema.push({ name: 'stretchTo1' }); // StretchTarget(0)
                    
                    if (stretch.stretchTo1) {
                        schema.push({ name: 'stretchDirection1', type: 'custom' }); // StretchDirection(0)
                        schema.push({ name: 'stretchPadding1' });                 // StretchPadding(0)
                        schema.push({ name: 'stretchTo2' });                     // StretchTarget(1)
                        
                        if (stretch.stretchTo2) {
                            schema.push({ name: 'stretchDirection2', type: 'custom' }); // StretchDirection(1)
                            schema.push({ name: 'stretchPadding2' });                 // StretchPadding(1)
                        }
                    }
                }
                
                return schema;
            }
            
            // Mocked getFormData
            getFormData() {
                const formData: Record<string, any> = {};
                formData.type = this.config.type;
                
                // Props (e.g., fill, direction for ChiselEndcap)
                if (this.config.props) {
                    Object.entries(this.config.props).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }
                
                // Layout (e.g., width, height, offsetX, offsetY)
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
                            // Flatten action_config for form data
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

                // Direct props (fill, direction for ChiselEndcap)
                if (newData.fill !== undefined) configDelta.fill = newData.fill; // Will be placed under 'props' by editor
                if (newData.direction !== undefined) configDelta.direction = newData.direction; // Same

                // Layout properties (width, height, offsetX, offsetY)
                if (newData.width !== undefined) configDelta.width = newData.width; // Will be placed under 'layout'
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.offsetX !== undefined) configDelta.offsetX = newData.offsetX;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;

                // Anchor properties (handled by base class logic)
                if (newData.anchorTo !== undefined) { // If anchorTo is in the form data
                    configDelta.anchorTo = newData.anchorTo; // Top-level in delta
                    
                    if (newData.anchorTo && newData.anchorTo !== '') {
                        // Base class sets defaults if anchorTo is present and points are not
                        configDelta.anchorPoint = newData.anchorPoint || 'center';
                        configDelta.targetAnchorPoint = newData.targetAnchorPoint || 'center';
                    }
                    // If anchorTo is empty, base class logic will ensure anchorPoint/targetAnchorPoint are removed from final config
                }
                else { // If anchorTo is NOT in form data, but points might be (e.g. user cleared anchorTo)
                    // Base class would remove anchorPoint/targetAnchorPoint.
                    // The delta only contains what's *changed* or *new*. If anchorTo was removed,
                    // the main editor logic would handle removing the anchor sub-object.
                    // For this mock, we just reflect what's in newData.
                    if (newData.anchorPoint !== undefined) configDelta.anchorPoint = newData.anchorPoint;
                    if (newData.targetAnchorPoint !== undefined) configDelta.targetAnchorPoint = newData.targetAnchorPoint;
                }

                // Stretch properties (handled by base class logic, nested into layout.stretch)
                configDelta.layout = { stretch: {} }; // Initialize stretch object in delta's layout
                
                const processStretch = (index: number, suffix: string) => {
                    const stretchToKey = `stretchTo${suffix}`;
                    const directionKey = `stretchDirection${suffix}`;
                    const paddingKey = `stretchPadding${suffix}`;

                    if (newData[stretchToKey] !== undefined && newData[stretchToKey]) {
                        configDelta.layout.stretch[stretchToKey] = newData[stretchToKey];
                        if (newData[directionKey]) {
                            configDelta.layout.stretch[`targetStretchAnchorPoint${suffix}`] = newData[directionKey];
                            // Base class derives axis
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
                        configDelta[key] = value; // Keep prefixed for delta
                    }
                }
                
                // Base class logic for clearing button sub-properties if button.enabled is false
                if (newData['button.enabled'] === false) {
                    // Remove all other `button.*` properties from the delta
                    for (const key in configDelta) {
                        if (key.startsWith('button.') && key !== 'button.enabled') {
                            delete configDelta[key];
                        }
                    }
                    // Base class also clears action_config sub-properties if button disabled
                    const actionConfigPrefix = 'button.action_config.';
                    Object.keys(newData).forEach(key => { 
                        if (key.startsWith(actionConfigPrefix)) {
                           delete configDelta[key]; // Remove from delta
                        }
                    });
                } else if (newData['button.enabled'] === true) {
                    // Base class preserves transforms if they exist in original config but not form
                    if (newData['button.hover_transform'] === undefined && this.config.button?.hover_transform) {
                        configDelta['button.hover_transform'] = this.config.button.hover_transform;
                    }
                    if (newData['button.active_transform'] === undefined && this.config.button?.active_transform) {
                        configDelta['button.active_transform'] = this.config.button.active_transform;
                    }
                    // Base class clears action_config sub-properties if type is 'none'
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
            
            // This mock should be overridden by the ChiselEndcap class
            getPropertyGroups(): Record<string, any> {
                // This is crucial: it should throw or return a base set of groups
                // if ChiselEndcap fails to override it. For testing, ChiselEndcap *will* override it.
                throw new Error("MockEditorElement.getPropertyGroups should not be called directly; ChiselEndcap should override it.");
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from '../element'; // Mocked base class and real enum

// Import all the required properties from the properties module
import {
    Width, Height, Fill, Direction, // Appearance properties for ChiselEndcap
    ButtonEnabled, ButtonHoverFill, ButtonActiveFill, ButtonHoverTransform, 
    ButtonActiveTransform, ButtonActionType,
    OffsetX, OffsetY, Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint, // Anchor properties are used by ChiselEndcap
    TextContent, TextColor, FontFamily, FontSize, FontWeight,
    LetterSpacing, TextTransform, TextAnchor, DominantBaseline, CutoutText
} from '../../properties/properties';

// Import ChiselEndcap after setting up the mock
import { ChiselEndcap } from '../chisel_endcap'; // The class under test

describe('ChiselEndcap EditorElement', () => {
    let chiselEndcapEditorElement: ChiselEndcap;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test
        
        // Manually register the element again using the mocked EditorElement
        // This ensures the spy `EditorElement.registerEditorElement` has a call to check
        EditorElement.registerEditorElement('chisel-endcap', ChiselEndcap);

        // Basic config for a chisel-endcap element
        config = {
            id: 'test-chisel-endcap',
            type: 'chisel-endcap',
            // props, layout, and button will be initialized by the EditorElement constructor if not present
        };
        chiselEndcapEditorElement = new ChiselEndcap(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('chisel-endcap', ChiselEndcap);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new ChiselEndcap({ id: 'ce1', type: 'chisel-endcap' });
            // Base EditorElement constructor ensures these exist
            expect(el.config.layout).toEqual({ stretch: {} });
            expect(el.config.button).toEqual({});
            // `props` is only created if it's in the input config or by the specific element's constructor
            // ChiselEndcap constructor does not explicitly create `props`.
            expect(el.config.props).toBeUndefined(); 
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'ce2',
                type: 'chisel-endcap',
                props: { fill: 'red', direction: 'left' },
                layout: { width: 100, offsetX: 5, anchor: { anchorTo: 'container' } },
                button: { enabled: true, text: 'Click Me' }
            };
            const el = new ChiselEndcap(initialConfig);
            expect(el.config.props).toEqual({ fill: 'red', direction: 'left' });
            // Base constructor adds stretch object to layout
            expect(el.config.layout).toEqual({ width: 100, offsetX: 5, anchor: { anchorTo: 'container' }, stretch: {} });
            expect(el.config.button).toEqual({ enabled: true, text: 'Click Me' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("../element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = chiselEndcapEditorElement.getPropertyGroups();
        });

        it('should define ANCHOR group as enabled (not null) with empty properties (base handles)', () => {
            expect(groups[PropertyGroup.ANCHOR]).toBeDefined();
            expect(groups[PropertyGroup.ANCHOR]).not.toBeNull();
            // Base EditorElement adds AnchorTo, AnchorPoint, TargetAnchorPoint if this group is not null
            expect(groups[PropertyGroup.ANCHOR]?.properties).toEqual([]); 
        });

        it('should define STRETCH group with empty properties (relying on base class for dynamic stretch props)', () => {
            expect(groups[PropertyGroup.STRETCH]).toBeDefined();
            expect(groups[PropertyGroup.STRETCH]?.properties).toEqual([]);
        });

        it('should define APPEARANCE group with Fill and Direction', () => {
            expect(groups[PropertyGroup.APPEARANCE]).toBeDefined();
            expect(groups[PropertyGroup.APPEARANCE]?.properties).toEqual([Fill, Direction]);
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

        it('should define TEXT group with text properties', () => {
            expect(groups[PropertyGroup.TEXT]).toBeDefined();
            const textProps = groups[PropertyGroup.TEXT]?.properties;
            const expectedTextProps = [
                TextContent, TextColor, FontFamily, FontSize, FontWeight, 
                LetterSpacing, TextTransform, TextAnchor, DominantBaseline, CutoutText
            ];
            expect(textProps).toEqual(expectedTextProps);
        });

        it('should define DIMENSIONS group with Width and Height', () => {
            expect(groups[PropertyGroup.DIMENSIONS]).toBeDefined();
            expect(groups[PropertyGroup.DIMENSIONS]?.properties).toEqual([Width, Height]);
        });

        it('should define POSITIONING group with OffsetX and OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetX, OffsetY]);
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first with "Chisel Endcap" label', () => {
            const schema = chiselEndcapEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector?.select.options).toEqual([{ value: 'chisel-endcap', label: 'Chisel Endcap' }]);
        });

        it('should include anchor properties (AnchorTo, AnchorPoint, TargetAnchorPoint) in the schema', () => {
            const schema = chiselEndcapEditorElement.getSchema();
            // These checks are based on the names of properties defined in properties.ts
            expect(schema.find(s => s.name === 'anchorTo')).toBeDefined();
            expect(schema.find(s => s.name === 'anchorPoint' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'targetAnchorPoint' && s.type === 'custom')).toBeDefined();
        });

        it('should include stretch properties dynamically (base class behavior)', () => {
            // Initial: no stretch config, only stretchTo1 should be offered
            let schema = chiselEndcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined(); // Not shown if stretchTo1 not set

            // With stretchTo1 configured
            chiselEndcapEditorElement.config.layout.stretch = { stretchTo1: 'container' };
            schema = chiselEndcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchDirection1' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
        });

        it('should include only ButtonEnabled in schema if button.enabled is false or not explicitly true', () => {
            // Case 1: button.enabled is false
            chiselEndcapEditorElement.config.button = { enabled: false };
            let schema = chiselEndcapEditorElement.getSchema();
            let buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');

            // Case 2: button object is empty (enabled is implicitly false)
            chiselEndcapEditorElement.config.button = {};
            schema = chiselEndcapEditorElement.getSchema();
            buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');
        });

        it('should include all defined button properties in schema if button.enabled is true', () => {
            chiselEndcapEditorElement.config.button = { enabled: true };
            const schema = chiselEndcapEditorElement.getSchema();
            
            // Instantiate expected properties to get their names
            const expectedButtonPropInstances = [
                new ButtonEnabled(), new ButtonHoverFill(), new ButtonActiveFill(),
                new ButtonHoverTransform(), new ButtonActiveTransform(), new ButtonActionType()
            ];
            expectedButtonPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
            
            // Text properties should also be available when button is enabled
            const expectedTextPropInstances = [
                new TextContent(), new TextColor(), new FontFamily(), new FontSize(), new FontWeight(),
                new LetterSpacing(), new TextTransform(), new TextAnchor(), new DominantBaseline(), new CutoutText()
            ];
            expectedTextPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include appearance properties (Fill, Direction)', () => {
            const schema = chiselEndcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'fill')).toBeDefined();
            expect(schema.find(s => s.name === 'direction')).toBeDefined();
        });

        it('should include dimension and positioning properties', () => {
            const schema = chiselEndcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'width')).toBeDefined();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetX')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config for the form', () => {
            const testConfig = {
                id: 'ce-formdata', type: 'chisel-endcap',
                props: {
                    fill: [255, 153, 0], // RGB array for color picker
                    direction: 'left'
                },
                layout: {
                    width: 150, height: 75, offsetX: 10, offsetY: -5,
                    anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' },
                    stretch: {
                        stretchTo1: 'el-other',
                        targetStretchAnchorPoint1: 'top', // This will be 'stretchDirection1' in form data
                        stretchPadding1: 5
                    }
                },
                button: {
                    enabled: true, text: 'My CE Button', font_size: 12
                }
            };
            const el = new ChiselEndcap(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('chisel-endcap');
            // Props
            expect(formData.fill).toEqual([255, 153, 0]);
            expect(formData.direction).toBe('left');
            // Layout
            expect(formData.width).toBe(150);
            expect(formData.height).toBe(75);
            expect(formData.offsetX).toBe(10);
            expect(formData.offsetY).toBe(-5);
            // Anchor
            expect(formData.anchorTo).toBe('container');
            expect(formData.anchorPoint).toBe('center');
            expect(formData.targetAnchorPoint).toBe('center');
            // Stretch
            expect(formData.stretchTo1).toBe('el-other');
            expect(formData.stretchDirection1).toBe('top'); // Mapped from targetStretchAnchorPoint1
            expect(formData.stretchPadding1).toBe(5);
            expect(formData.stretchTo2).toBe(''); // Offered but not set
            // Button
            expect(formData['button.enabled']).toBe(true);
            expect(formData['button.text']).toBe('My CE Button');
            expect(formData['button.font_size']).toBe(12);
        });

        it('should handle missing optional fields by not including them or using defaults from base', () => {
            const testConfig = {
                id: 'ce-formdata-min', type: 'chisel-endcap',
                layout: { width: 100 } // Only width is provided
            };
            const el = new ChiselEndcap(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('chisel-endcap');
            expect(formData.width).toBe(100);
            // These should be undefined as they are not in config
            expect(formData.height).toBeUndefined();
            expect(formData.fill).toBeUndefined();
            expect(formData.direction).toBeUndefined();
            expect(formData['button.enabled']).toBeUndefined(); // `button` object missing in config
            // Defaults from base class logic for empty/missing parts
            expect(formData.anchorTo).toBe(''); 
            expect(formData.stretchTo1).toBe('');
            expect(formData.stretchTo2).toBe('');
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process full form data back to config delta structure', () => {
            const formDataFromUI = {
                type: 'chisel-endcap', 
                fill: [0, 255, 0], direction: 'right',
                width: 200, height: 100, offsetX: 20, offsetY: 30,
                anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomRight',
                stretchTo1: 'another-element', stretchDirection1: 'right', stretchPadding1: 10,
                'button.enabled': true, 'button.text': 'Updated Text'
            };
            const el = new ChiselEndcap({ id: 'ce-update', type: 'chisel-endcap' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            // Props (become top-level in delta, editor nests them into 'props')
            expect(configDelta.fill).toEqual([0, 255, 0]);
            expect(configDelta.direction).toBe('right');
            // Layout (become top-level in delta, editor nests them into 'layout')
            expect(configDelta.width).toBe(200);
            expect(configDelta.height).toBe(100);
            expect(configDelta.offsetX).toBe(20);
            expect(configDelta.offsetY).toBe(30);
            // Anchor (top-level in delta)
            expect(configDelta.anchorTo).toBe('el2');
            expect(configDelta.anchorPoint).toBe('topLeft');
            expect(configDelta.targetAnchorPoint).toBe('bottomRight');
            // Stretch (nested by processDataUpdate into delta.layout.stretch)
            expect(configDelta.layout.stretch.stretchTo1).toBe('another-element');
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBe('right');
            expect(configDelta.layout.stretch.stretchAxis1).toBe('X'); // Derived by base
            expect(configDelta.layout.stretch.stretchPadding1).toBe(10);
            // Button (prefixed in delta)
            expect(configDelta['button.enabled']).toBe(true);
            expect(configDelta['button.text']).toBe('Updated Text');
        });

        it('should clear anchorPoint and targetAnchorPoint if anchorTo is emptied', () => {
            const formDataFromUI = { anchorTo: '' }; // User cleared anchorTo
            const el = new ChiselEndcap({
                id: 'ce-anchor-clear', type: 'chisel-endcap',
                layout: { anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' } }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);
            
            expect(configDelta.anchorTo).toBe('');
            // Base EditorElement.processDataUpdate should ensure these are not in the delta if anchorTo is empty
            expect(configDelta.anchorPoint).toBeUndefined();
            expect(configDelta.targetAnchorPoint).toBeUndefined();
        });
        
        it('should default anchorPoint and targetAnchorPoint if anchorTo is set but points are not', () => {
            const formDataFromUI = { anchorTo: 'something' }; // anchorPoint/targetAnchorPoint missing
             const el = new ChiselEndcap({ id: 'ce-anchor-default', type: 'chisel-endcap' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta.anchorTo).toBe('something');
            expect(configDelta.anchorPoint).toBe('center'); // Default from processDataUpdate
            expect(configDelta.targetAnchorPoint).toBe('center'); // Default
        });

        it('should remove specific button sub-properties if button.enabled is changed to false', () => {
            const formDataFromUI = {
                'button.enabled': false,
                // These might still be in the form data from a previous state
                'button.text': 'Text To Remove',
                'button.font_size': 10,
            };
            const el = new ChiselEndcap({
                id: 'ce-btn-disable', type: 'chisel-endcap',
                button: { enabled: true, text: 'Initial', font_size: 12 }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta['button.enabled']).toBe(false);
            // Base class logic clears other button props from delta
            expect(configDelta['button.text']).toBeUndefined();
            expect(configDelta['button.font_size']).toBeUndefined();
        });

        it('should clear stretch group details if stretchTo is emptied', () => {
            const formDataFromUI = {
                stretchTo1: '', // User cleared the target
                stretchDirection1: 'left', stretchPadding1: 5 // Might still be in form data
            };
            const el = new ChiselEndcap({
                id: 'ce-stretch-clear', type: 'chisel-endcap',
                layout: { stretch: { stretchTo1: 'container', targetStretchAnchorPoint1: 'left', stretchPadding1: 10 }}
            });
            const configDelta = el.processDataUpdate(formDataFromUI);

            // Base class removes these from delta.layout.stretch if stretchTo is empty
            expect(configDelta.layout.stretch.stretchTo1).toBeUndefined();
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBeUndefined();
            expect(configDelta.layout.stretch.stretchAxis1).toBeUndefined();
            expect(configDelta.layout.stretch.stretchPadding1).toBeUndefined();
            // Form data keys should also be gone from top-level delta
            expect(configDelta.stretchDirection1).toBeUndefined();
            expect(configDelta.stretchPadding1).toBeUndefined();
        });
    });
});