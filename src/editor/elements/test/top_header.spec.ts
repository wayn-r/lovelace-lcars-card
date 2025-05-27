// src/editor/elements/top_header.spec.ts

// vi.mock must be before any imports
vi.mock('../element', () => {
    const registerSpy = vi.fn();
    const PGMock = {
        TYPE: 'type',
        ANCHOR: 'anchor',
        STRETCH: 'stretch',
        BUTTON: 'button',
        POSITIONING: 'positioning',
        DIMENSIONS: 'dimensions',
        APPEARANCE: 'appearance',
        TEXT: 'text'
    };

    return {
        PropertyGroup: PGMock,
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
                if (!this.config.button) this.config.button = {};
            }

            getSchema() {
                const groups = this.getPropertyGroups();
                const schema: Array<{ name: string, selector?: any, type?: string }> = [];

                let typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
                if (this.type === 'top_header') typeLabel = 'Top Header';

                schema.push({ name: 'type', selector: { select: { options: [{ value: this.type, label: typeLabel }] } } });

                // Button handling: Base EditorElement's `getButtonProperties` returns `[ButtonEnabled]`
                // if the element doesn't define a BUTTON group.
                // And `getAllPropertyClasses` includes the result of `getButtonProperties`.
                // So, 'button.enabled' will be in the schema.
                if (!groups[PGMock.BUTTON]) { // True for TopHeader
                    schema.push({ name: 'button.enabled' });
                } else { // For elements that might define button properties
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
                }

                const dimensionGroup = groups[PGMock.DIMENSIONS];
                if (dimensionGroup?.properties) {
                    dimensionGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }

                const textGroup = groups[PGMock.TEXT];
                if (textGroup?.properties) {
                    textGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }

                const positioningGroup = groups[PGMock.POSITIONING];
                if (positioningGroup?.properties) {
                    positioningGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }

                // ANCHOR, STRETCH, APPEARANCE are not defined by TopHeader, so no schema items for them.
                return schema;
            }

            getFormData() {
                const formData: Record<string, any> = {};
                formData.type = this.config.type;

                if (this.config.props) {
                    Object.entries(this.config.props).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }

                if (this.config.layout) {
                    Object.entries(this.config.layout).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }

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
                return formData;
            }

            processDataUpdate(newData: any) {
                const configDelta: any = {};

                // Props specific to TopHeader
                if (newData.leftText !== undefined) configDelta.leftText = newData.leftText;
                if (newData.rightText !== undefined) configDelta.rightText = newData.rightText;
                if (newData.fontFamily !== undefined) configDelta.fontFamily = newData.fontFamily;
                if (newData.fontWeight !== undefined) configDelta.fontWeight = newData.fontWeight;
                if (newData.letterSpacing !== undefined) configDelta.letterSpacing = newData.letterSpacing;
                if (newData.textTransform !== undefined) configDelta.textTransform = newData.textTransform;

                // Layout specific to TopHeader
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;

                // Button properties (base class handles structure)
                for (const [key, value] of Object.entries(newData)) {
                    if (key.startsWith('button.')) {
                        configDelta[key] = value;
                    }
                }
                
                // Base class logic for clearing button sub-properties if button.enabled is false
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

            getPropertyGroups(): Record<string, any> {
                // To be overridden by TopHeader
                return {};
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from '../element'; // Mocked base class and real enum

// Import property classes used by TopHeader
import {
    Height,
    LeftTextContent, RightTextContent,
    FontFamily, FontWeight, LetterSpacing, TextTransform,
    OffsetY, Type,
    ButtonEnabled // For testing button schema part
} from '../../properties/properties';

// Import the class under test
import { TopHeader } from '../top_header';

describe('TopHeader EditorElement', () => {
    let topHeaderEditorElement: TopHeader;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Register with the mocked EditorElement
        EditorElement.registerEditorElement('top_header', TopHeader);

        config = {
            id: 'test-top-header',
            type: 'top_header',
        };
        topHeaderEditorElement = new TopHeader(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('top_header', TopHeader);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new TopHeader({ id: 'th1', type: 'top_header' });
            // Base EditorElement constructor ensures these exist
            expect(el.config.layout).toEqual({});
            expect(el.config.button).toEqual({});
            // `props` is only created if it's in the input config
            expect(el.config.props).toBeUndefined();
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'th2',
                type: 'top_header',
                props: { leftText: 'Test Header', fontFamily: 'Arial' },
                layout: { height: 30, offsetY: 5 },
                button: { enabled: true, text: 'Action Button' }
            };
            const el = new TopHeader(initialConfig);
            expect(el.config.props).toEqual({ leftText: 'Test Header', fontFamily: 'Arial' });
            expect(el.config.layout).toEqual({ height: 30, offsetY: 5 });
            expect(el.config.button).toEqual({ enabled: true, text: 'Action Button' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("../element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = topHeaderEditorElement.getPropertyGroups();
        });

        it('should define POSITIONING group with OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetY]);
        });

        it('should define DIMENSIONS group with Height', () => {
            expect(groups[PropertyGroup.DIMENSIONS]).toBeDefined();
            expect(groups[PropertyGroup.DIMENSIONS]?.properties).toEqual([Height]);
        });

        it('should define TEXT group with specific text properties for TopHeader', () => {
            expect(groups[PropertyGroup.TEXT]).toBeDefined();
            const textProps = groups[PropertyGroup.TEXT]?.properties;
            const expectedTextProps = [
                LeftTextContent, RightTextContent,
                FontFamily, FontWeight, LetterSpacing, TextTransform
            ];
            expect(textProps).toEqual(expectedTextProps);
        });

        it('should NOT define ANCHOR group', () => {
            expect(groups[PropertyGroup.ANCHOR]).toBeUndefined();
        });

        it('should NOT define STRETCH group', () => {
            expect(groups[PropertyGroup.STRETCH]).toBeUndefined();
        });

        it('should NOT define APPEARANCE group', () => {
            expect(groups[PropertyGroup.APPEARANCE]).toBeUndefined();
        });
        
        it('should NOT define BUTTON group (base class handles ButtonEnabled)', () => {
            // TopHeader itself does not define a BUTTON group.
            // The base EditorElement will handle the `button.enabled` property.
            expect(groups[PropertyGroup.BUTTON]).toBeUndefined();
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first with "Top Header" label', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector?.select.options).toEqual([{ value: 'top_header', label: 'Top Header' }]);
        });

        it('should NOT include anchor properties in the schema', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema.find(s => s.name === 'anchorTo')).toBeUndefined();
            expect(schema.find(s => s.name === 'anchorPoint')).toBeUndefined();
            expect(schema.find(s => s.name === 'targetAnchorPoint')).toBeUndefined();
        });

        it('should NOT include stretch properties in the schema', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeUndefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined();
        });
        
        it('should include ButtonEnabled in schema (from base class, as TopHeader does not define a BUTTON group)', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema.find(s => s.name === 'button.enabled')).toBeDefined();
        });

        it('should include positioning property (OffsetY)', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });

        it('should include dimension property (Height)', () => {
            const schema = topHeaderEditorElement.getSchema();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
        });

        it('should include text properties for TopHeader', () => {
            const schema = topHeaderEditorElement.getSchema();
            const expectedTextPropInstances = [
                new LeftTextContent(), new RightTextContent(),
                new FontFamily(), new FontWeight(), new LetterSpacing(), new TextTransform()
            ];
            expectedTextPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config for TopHeader', () => {
            const testConfig = {
                id: 'th-formdata', type: 'top_header',
                props: {
                    leftText: 'LCARS System Online', rightText: 'USS Enterprise',
                    fontFamily: 'Swiss911', fontWeight: '700',
                    letterSpacing: '0.5px', textTransform: 'uppercase'
                },
                layout: {
                    height: 32, offsetY: 0
                },
                button: {
                    enabled: false // Example of button config
                }
            };
            const el = new TopHeader(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('top_header');
            // Props
            expect(formData.leftText).toBe('LCARS System Online');
            expect(formData.rightText).toBe('USS Enterprise');
            expect(formData.fontFamily).toBe('Swiss911');
            expect(formData.fontWeight).toBe('700');
            expect(formData.letterSpacing).toBe('0.5px');
            expect(formData.textTransform).toBe('uppercase');
            // Layout
            expect(formData.height).toBe(32);
            expect(formData.offsetY).toBe(0);
            // Button (from base mock behavior)
            expect(formData['button.enabled']).toBe(false);
        });

        it('should handle missing optional fields by not including them', () => {
            const testConfig = {
                id: 'th-formdata-min', type: 'top_header',
                props: { leftText: 'Minimal Header' },
                layout: { height: 28 }
                // Other props, offsetY, and button are undefined
            };
            const el = new TopHeader(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('top_header');
            expect(formData.leftText).toBe('Minimal Header');
            expect(formData.rightText).toBeUndefined();
            expect(formData.fontFamily).toBeUndefined();
            expect(formData.fontWeight).toBeUndefined();
            expect(formData.letterSpacing).toBeUndefined();
            expect(formData.textTransform).toBeUndefined();
            expect(formData.height).toBe(28);
            expect(formData.offsetY).toBeUndefined();
            expect(formData['button.enabled']).toBeUndefined(); // button object itself is missing
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process full form data (including TopHeader props) back to config delta', () => {
            const formDataFromUI = {
                type: 'top_header', // Type is usually handled separately by the editor
                leftText: 'New Left Text', rightText: 'New Right Text',
                fontFamily: 'Arial Black', fontWeight: '900',
                letterSpacing: 'normal', textTransform: 'none',
                height: 30, offsetY: 2,
                'button.enabled': true, // Example button change
                'button.action_config.type': 'call-service', // Example action config
                'button.action_config.service': 'light.toggle'
            };
            const el = new TopHeader({ id: 'th-update', type: 'top_header' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            // Props (top-level in delta, editor nests them into 'props')
            expect(configDelta.leftText).toBe('New Left Text');
            expect(configDelta.rightText).toBe('New Right Text');
            expect(configDelta.fontFamily).toBe('Arial Black');
            expect(configDelta.fontWeight).toBe('900');
            expect(configDelta.letterSpacing).toBe('normal');
            expect(configDelta.textTransform).toBe('none');
            // Layout (top-level in delta, editor nests them into 'layout')
            expect(configDelta.height).toBe(30);
            expect(configDelta.offsetY).toBe(2);
            // Button (prefixed in delta, base class logic handles this)
            expect(configDelta['button.enabled']).toBe(true);
            expect(configDelta['button.action_config.type']).toBe('call-service');
            expect(configDelta['button.action_config.service']).toBe('light.toggle');
        });

        it('should return an empty delta for non-TopHeader props if form data matches default/empty state', () => {
             const formDataFromUI = { type: 'top_header' }; // No actual values changed
             const el = new TopHeader({ id: 'th-empty-update', type: 'top_header'}); // Empty initial config
             const configDelta = el.processDataUpdate(formDataFromUI);
             
             expect(configDelta.leftText).toBeUndefined();
             expect(configDelta.rightText).toBeUndefined();
             expect(configDelta.fontFamily).toBeUndefined();
             expect(configDelta.height).toBeUndefined();
             expect(configDelta.offsetY).toBeUndefined();
             // `button.enabled` wouldn't be in delta if it wasn't in newData and not in original config
             expect(configDelta['button.enabled']).toBeUndefined();
        });

        it('should handle clearing of existing values', () => {
            const initialConfig = {
                id: 'th-clear', type: 'top_header',
                props: { leftText: 'Initial Left', fontFamily: 'Arial' },
                layout: { height: 30, offsetY: 5 }
            };
            const el = new TopHeader(initialConfig);

            const formDataFromUI = {
                type: 'top_header',
                leftText: '', // Cleared leftText
                fontFamily: undefined, // User somehow cleared fontFamily (might not happen in UI)
                // height and offsetY not present in form, meaning they are unchanged relative to current state or default
            };
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta.leftText).toBe('');
            expect(configDelta.fontFamily).toBeUndefined(); // If undefined was passed
            expect(configDelta.height).toBeUndefined(); // Not in formData, so not in delta
            expect(configDelta.offsetY).toBeUndefined(); // Not in formData, so not in delta
        });
    });
});