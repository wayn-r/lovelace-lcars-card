// src/editor/elements/endcap.spec.ts

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
        TEXT: 'TEXT'
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
                if (!this.config.layout.stretch) this.config.layout.stretch = {};
                if (!this.config.button) this.config.button = {};
            }

            getSchema() {
                const groups = this.getPropertyGroups();
                const schema: Array<{name: string, selector?: any, type?: string}> = [];
                
                let typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
                if (this.type === 'chisel-endcap') typeLabel = 'Chisel Endcap';
                else if (this.type === 'top_header') typeLabel = 'Top Header';
                // Add more specific labels if needed, e.g., for 'endcap' it's just 'Endcap'

                schema.push({ name: 'type', selector: { select: { options: [{ value: this.type, label: typeLabel }] } } });
                
                if (groups[PGMock.ANCHOR] !== null && groups[PGMock.ANCHOR]) {
                    schema.push({ name: 'anchorTo' });
                    schema.push({ name: 'anchorPoint', type: 'custom' });
                    schema.push({ name: 'targetAnchorPoint', type: 'custom' });
                }
                
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
                
                const dimensionGroup = groups[PGMock.DIMENSIONS];
                if (dimensionGroup?.properties) {
                    dimensionGroup.properties.forEach((prop: any) => {
                        const instance = new (prop as any)();
                        schema.push({ name: instance.name });
                    });
                }
                
                const appearanceGroup = groups[PGMock.APPEARANCE];
                if (appearanceGroup?.properties) {
                    appearanceGroup.properties.forEach((prop: any) => {
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
                
                const stretchGroupDef = groups[PGMock.STRETCH];
                if (stretchGroupDef !== null && stretchGroupDef) {
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
            
            getFormData() {
                const formData: Record<string, any> = {};
                formData.type = this.config.type;
                
                if (this.config.props) {
                    Object.entries(this.config.props).forEach(([key, value]) => {
                        formData[key] = value;
                    });
                }
                
                if (this.config.layout) {
                    const { stretch, anchor, ...otherLayout } = this.config.layout;
                    Object.entries(otherLayout).forEach(([key, value]) => {
                        formData[key] = value;
                    });

                    if (anchor) {
                        if (anchor.anchorTo !== undefined) formData.anchorTo = anchor.anchorTo;
                        if (anchor.anchorPoint !== undefined) formData.anchorPoint = anchor.anchorPoint;
                        if (anchor.targetAnchorPoint !== undefined) formData.targetAnchorPoint = anchor.targetAnchorPoint;
                    } else {
                         formData.anchorTo = '';
                    }
                    
                    if (stretch) {
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
                        formData.stretchTo2 = '';
                    }
                } else {
                    formData.anchorTo = '';
                    formData.stretchTo1 = '';
                    formData.stretchTo2 = '';
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
                
                if (formData.stretchTo1 === undefined) formData.stretchTo1 = '';
                if (formData.stretchTo2 === undefined) formData.stretchTo2 = '';
                if (formData.anchorTo === undefined) formData.anchorTo = '';

                return formData;
            }
            
            processDataUpdate(newData: any) {
                const configDelta: any = {};

                if (newData.fill !== undefined) configDelta.fill = newData.fill;
                if (newData.direction !== undefined) configDelta.direction = newData.direction;

                if (newData.width !== undefined) configDelta.width = newData.width;
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.offsetX !== undefined) configDelta.offsetX = newData.offsetX;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;

                // Handle anchor properties with proper defaults
                if (newData.anchorTo !== undefined) {
                    configDelta.anchorTo = newData.anchorTo;
                    
                    if (newData.anchorTo && newData.anchorTo !== '') {
                        // Set defaults for anchor points if they're not provided
                        configDelta.anchorPoint = newData.anchorPoint || 'center';
                        configDelta.targetAnchorPoint = newData.targetAnchorPoint || 'center';
                    }
                    // If anchorTo is empty, we don't set the defaults
                }
                else {
                    if (newData.anchorPoint !== undefined) configDelta.anchorPoint = newData.anchorPoint;
                    if (newData.targetAnchorPoint !== undefined) configDelta.targetAnchorPoint = newData.targetAnchorPoint;
                }

                configDelta.layout = { stretch: {} };
                if (newData.stretchTo1 !== undefined && newData.stretchTo1) {
                    configDelta.layout.stretch.stretchTo1 = newData.stretchTo1;
                    if (newData.stretchDirection1) {
                        configDelta.layout.stretch.targetStretchAnchorPoint1 = newData.stretchDirection1;
                        const isHorizontal1 = ['left', 'right', 'center', 'centerLeft', 'centerRight'].includes(newData.stretchDirection1);
                        configDelta.layout.stretch.stretchAxis1 = isHorizontal1 ? 'X' : 'Y';
                    }
                    if (newData.stretchPadding1 !== undefined) configDelta.layout.stretch.stretchPadding1 = newData.stretchPadding1;
                }
                if (newData.stretchTo2 !== undefined && newData.stretchTo2) {
                    configDelta.layout.stretch.stretchTo2 = newData.stretchTo2;
                    if (newData.stretchDirection2) {
                        configDelta.layout.stretch.targetStretchAnchorPoint2 = newData.stretchDirection2;
                        const isHorizontal2 = ['left', 'right', 'center', 'centerLeft', 'centerRight'].includes(newData.stretchDirection2);
                        configDelta.layout.stretch.stretchAxis2 = isHorizontal2 ? 'X' : 'Y';
                    }
                    if (newData.stretchPadding2 !== undefined) configDelta.layout.stretch.stretchPadding2 = newData.stretchPadding2;
                }
                
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
                    Object.keys(newData).forEach(key => { // Check original newData for potential keys to remove
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
                throw new Error("MockEditorElement.getPropertyGroups should not be called directly; Endcap should override it.");
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from '../element';

import {
    Width, Height, Fill, Direction, // Endcap specific appearance
    ButtonEnabled, ButtonText, ButtonCutoutText, ButtonTextColor,
    ButtonFontFamily, ButtonFontSize, ButtonFontWeight, ButtonLetterSpacing,
    ButtonTextTransform, ButtonTextAnchor, ButtonDominantBaseline, ButtonHoverFill,
    ButtonActiveFill, ButtonHoverTransform, ButtonActiveTransform, ButtonActionType,
    OffsetX, OffsetY, Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint // Anchor properties are used by Endcap
} from '../../properties/properties';

import { Endcap } from '../endcap';

describe('Endcap EditorElement', () => {
    let endcapEditorElement: Endcap;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks();
        EditorElement.registerEditorElement('endcap', Endcap);

        config = {
            id: 'test-endcap',
            type: 'endcap',
        };
        endcapEditorElement = new Endcap(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('endcap', Endcap);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new Endcap({ id: 'ec1', type: 'endcap' });
            expect(el.config.layout).toEqual({ stretch: {} });
            expect(el.config.button).toEqual({});
            expect(el.config.props).toBeUndefined();
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'ec2',
                type: 'endcap',
                props: { fill: 'blue', direction: 'right' },
                layout: { width: 80, offsetX: -3, anchor: { anchorTo: 'container' } },
                button: { enabled: true, text: 'Endcap Btn' }
            };
            const el = new Endcap(initialConfig);
            expect(el.config.props).toEqual({ fill: 'blue', direction: 'right' });
            expect(el.config.layout).toEqual({ width: 80, offsetX: -3, anchor: { anchorTo: 'container' }, stretch: {} });
            expect(el.config.button).toEqual({ enabled: true, text: 'Endcap Btn' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("../element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = endcapEditorElement.getPropertyGroups();
        });

        it('should define ANCHOR group as enabled (not null)', () => {
            expect(groups[PropertyGroup.ANCHOR]).toBeDefined();
            expect(groups[PropertyGroup.ANCHOR]).not.toBeNull();
            expect(groups[PropertyGroup.ANCHOR]?.properties).toEqual([]); // Base class handles actual properties
        });

        it('should define STRETCH group with empty properties (relying on base class)', () => {
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

        it('should define POSITIONING group with OffsetX and OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetX, OffsetY]);
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first with "Endcap" label', () => {
            const schema = endcapEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector.select.options).toEqual([{ value: 'endcap', label: 'Endcap' }]);
        });

        it('should include anchor properties (AnchorTo, AnchorPoint, TargetAnchorPoint) in the schema', () => {
            const schema = endcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'anchorTo')).toBeDefined();
            expect(schema.find(s => s.name === 'anchorPoint' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'targetAnchorPoint' && s.type === 'custom')).toBeDefined();
        });

        it('should include stretch properties dynamically (base class behavior)', () => {
            let schema = endcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined(); // Not shown if stretchTo1 not set

            endcapEditorElement.config.layout.stretch = { stretchTo1: 'container' };
            schema = endcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchDirection1' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
        });

        it('should include only ButtonEnabled if button.enabled is false/undefined', () => {
            endcapEditorElement.config.button = { enabled: false };
            let schema = endcapEditorElement.getSchema();
            let buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');

            endcapEditorElement.config.button = {}; // enabled is implicitly false
            schema = endcapEditorElement.getSchema();
            buttonSchemaItems = schema.filter(s => s.name.startsWith('button.'));
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');
        });

        it('should include all defined button properties if button.enabled is true', () => {
            endcapEditorElement.config.button = { enabled: true };
            const schema = endcapEditorElement.getSchema();
            
            const expectedButtonPropInstances = [
                new ButtonEnabled(), new ButtonText(), new ButtonCutoutText(), new ButtonTextColor(),
                new ButtonFontFamily(), new ButtonFontSize(), new ButtonFontWeight(),
                new ButtonLetterSpacing(), new ButtonTextTransform(), new ButtonTextAnchor(),
                new ButtonDominantBaseline(), new ButtonHoverFill(), new ButtonActiveFill(),
                new ButtonHoverTransform(), new ButtonActiveTransform(), new ButtonActionType()
            ];
            expectedButtonPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include appearance properties (Fill, Direction)', () => {
            const schema = endcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'fill')).toBeDefined();
            expect(schema.find(s => s.name === 'direction')).toBeDefined();
        });

        it('should include dimension and positioning properties', () => {
            const schema = endcapEditorElement.getSchema();
            expect(schema.find(s => s.name === 'width')).toBeDefined();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetX')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config', () => {
            const testConfig = {
                id: 'ec-formdata', type: 'endcap',
                props: { fill: [100, 100, 100], direction: 'left' },
                layout: {
                    width: 70, height: 30, offsetX: 5,
                    anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' },
                    stretch: { stretchTo1: 'el-other', targetStretchAnchorPoint1: 'top', stretchPadding1: 2 }
                },
                button: { enabled: true, text: 'EC Button' }
            };
            const el = new Endcap(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('endcap');
            expect(formData.fill).toEqual([100, 100, 100]);
            expect(formData.direction).toBe('left');
            expect(formData.width).toBe(70);
            expect(formData.height).toBe(30);
            expect(formData.offsetX).toBe(5);
            expect(formData.anchorTo).toBe('container');
            expect(formData.anchorPoint).toBe('center');
            expect(formData.targetAnchorPoint).toBe('center');
            expect(formData.stretchTo1).toBe('el-other');
            expect(formData.stretchDirection1).toBe('top');
            expect(formData.stretchPadding1).toBe(2);
            expect(formData['button.enabled']).toBe(true);
            expect(formData['button.text']).toBe('EC Button');
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process form data back to config delta structure', () => {
            const formDataFromUI = {
                type: 'endcap',
                fill: [0, 255, 0], direction: 'right',
                width: 75, height: 35, offsetX: 7,
                anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomRight',
                stretchTo1: 'container', stretchDirection1: 'left', stretchPadding1: 3,
                'button.enabled': true, 'button.text': 'New Text'
            };
            const el = new Endcap({ id: 'ec-update', type: 'endcap' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta.fill).toEqual([0, 255, 0]);
            expect(configDelta.direction).toBe('right');
            expect(configDelta.width).toBe(75);
            expect(configDelta.height).toBe(35);
            expect(configDelta.offsetX).toBe(7);
            // Anchor properties are top-level in delta, editor nests them
            expect(configDelta.anchorTo).toBe('el2');
            expect(configDelta.anchorPoint).toBe('topLeft');
            expect(configDelta.targetAnchorPoint).toBe('bottomRight');
            // Stretch properties are nested by processDataUpdate
            expect(configDelta.layout.stretch.stretchTo1).toBe('container');
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBe('left');
            expect(configDelta.layout.stretch.stretchAxis1).toBe('X');
            expect(configDelta.layout.stretch.stretchPadding1).toBe(3);
            // Button properties are prefixed
            expect(configDelta['button.enabled']).toBe(true);
            expect(configDelta['button.text']).toBe('New Text');
        });

        it('should clear anchorPoint and targetAnchorPoint if anchorTo is emptied', () => {
            const formDataFromUI = { anchorTo: '' };
            const el = new Endcap({
                id: 'ec-anchor-clear', type: 'endcap',
                layout: { anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' } }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);
            
            expect(configDelta.anchorTo).toBe(''); // Or undefined, depending on how processDataUpdate handles it
            expect(configDelta.anchorPoint).toBeUndefined();
            expect(configDelta.targetAnchorPoint).toBeUndefined();
        });

        it('should default anchorPoint and targetAnchorPoint if anchorTo is set but points are not', () => {
            const formDataFromUI = { anchorTo: 'something' }; // anchorPoint/targetAnchorPoint missing
             const el = new Endcap({ id: 'ec-anchor-default', type: 'endcap' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            expect(configDelta.anchorTo).toBe('something');
            expect(configDelta.anchorPoint).toBe('center'); // Default from processDataUpdate
            expect(configDelta.targetAnchorPoint).toBe('center'); // Default
        });
    });
});