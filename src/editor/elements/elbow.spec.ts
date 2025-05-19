// src/editor/elements/elbow.spec.ts

// vi.mock must be before any imports
vi.mock('./element', () => {
    const registerSpy = vi.fn();
    
    const PGMock = {
        ANCHOR: 'ANCHOR',
        STRETCH: 'STRETCH',
        BUTTON: 'BUTTON',
        DIMENSIONS: 'DIMENSIONS',
        APPEARANCE: 'APPEARANCE',
        POSITIONING: 'POSITIONING',
        TYPE: 'TYPE',
        TEXT: 'TEXT' // Though not used by Elbow directly (except via button), keep for mock consistency
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
                const groups = this.getPropertyGroups(); // This will call Elbow's getPropertyGroups
                const schema: Array<{name: string, selector?: any, type?: string}> = [];
                
                let typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
                if (this.type === 'elbow') typeLabel = 'Elbow';
                // Add more specific labels if needed

                // 1. Type property (always first)
                schema.push({ name: 'type', selector: { select: { options: [{ value: this.type, label: typeLabel }] } } });
                
                // 2. Anchor properties (if ANCHOR group is not null)
                if (groups[PGMock.ANCHOR] !== null && groups[PGMock.ANCHOR]) { // For Elbow, this is true
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
                if (stretchGroupDef !== null && stretchGroupDef) { // For Elbow, this is true
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
                        formData[key] = value; // fill, orientation, bodyWidth, armHeight, elbow_text_position
                    });
                }
                
                if (this.config.layout) {
                    const { stretch, anchor, ...otherLayout } = this.config.layout;
                    Object.entries(otherLayout).forEach(([key, value]) => {
                        formData[key] = value; // width, height, offsetX, offsetY
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

                // Props for Elbow
                if (newData.fill !== undefined) configDelta.fill = newData.fill;
                if (newData.orientation !== undefined) configDelta.orientation = newData.orientation;
                if (newData.bodyWidth !== undefined) configDelta.bodyWidth = newData.bodyWidth;
                if (newData.armHeight !== undefined) configDelta.armHeight = newData.armHeight;
                if (newData.elbow_text_position !== undefined) configDelta.elbow_text_position = newData.elbow_text_position;

                // Layout properties
                if (newData.width !== undefined) configDelta.width = newData.width;
                if (newData.height !== undefined) configDelta.height = newData.height;
                if (newData.offsetX !== undefined) configDelta.offsetX = newData.offsetX;
                if (newData.offsetY !== undefined) configDelta.offsetY = newData.offsetY;

                // Anchor properties (base class logic)
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

                // Stretch properties (base class logic, nested into layout.stretch)
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
                throw new Error("MockEditorElement.getPropertyGroups should not be called directly; Elbow should override it.");
            }
        }
    };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorElement, PropertyGroup } from './element'; // Mocked base class and real enum

import {
    Orientation, Width, Height, BodyWidth, ArmHeight, ElbowTextPosition, Fill,
    ButtonEnabled, ButtonText, ButtonCutoutText, ButtonTextColor,
    ButtonFontFamily, ButtonFontSize, ButtonFontWeight, ButtonLetterSpacing,
    ButtonTextTransform, ButtonTextAnchor, ButtonDominantBaseline, ButtonHoverFill,
    ButtonActiveFill, ButtonHoverTransform, ButtonActiveTransform, ButtonActionType,
    OffsetX, OffsetY, Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint // Anchor properties are used by Elbow
} from '../properties/properties';

import { Elbow } from './elbow'; // The class under test

describe('Elbow EditorElement', () => {
    let elbowEditorElement: Elbow;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks();
        EditorElement.registerEditorElement('elbow', Elbow);

        config = {
            id: 'test-elbow',
            type: 'elbow',
        };
        elbowEditorElement = new Elbow(config);
    });

    it('should be registered with EditorElement upon module import', () => {
        expect(EditorElement.registerEditorElement).toHaveBeenCalledWith('elbow', Elbow);
    });

    describe('constructor', () => {
        it('should initialize with default config structure if parts are missing', () => {
            const el = new Elbow({ id: 'el1', type: 'elbow' });
            expect(el.config.layout).toEqual({ stretch: {} });
            expect(el.config.button).toEqual({});
            expect(el.config.props).toBeUndefined();
        });

        it('should preserve existing props, layout, and button configs', () => {
            const initialConfig = {
                id: 'el2',
                type: 'elbow',
                props: { fill: 'green', orientation: 'top-right', bodyWidth: 20 },
                layout: { width: 120, offsetX: 2, anchor: { anchorTo: 'el1' } },
                button: { enabled: true, text: 'Elbow Action', elbow_text_position: 'side' }
            };
            const el = new Elbow(initialConfig);
            expect(el.config.props).toEqual({ fill: 'green', orientation: 'top-right', bodyWidth: 20 });
            expect(el.config.layout).toEqual({ width: 120, offsetX: 2, anchor: { anchorTo: 'el1' }, stretch: {} });
            expect(el.config.button).toEqual({ enabled: true, text: 'Elbow Action', elbow_text_position: 'side' });
        });
    });

    describe('getPropertyGroups', () => {
        let groups: Partial<Record<PropertyGroup, import("./element").PropertyGroupDefinition | null>>;

        beforeEach(() => {
            groups = elbowEditorElement.getPropertyGroups();
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

        it('should define APPEARANCE group with Fill and Orientation', () => {
            expect(groups[PropertyGroup.APPEARANCE]).toBeDefined();
            expect(groups[PropertyGroup.APPEARANCE]?.properties).toEqual([Fill, Orientation]);
        });

        it('should define BUTTON group with standard button properties and ElbowTextPosition', () => {
            expect(groups[PropertyGroup.BUTTON]).toBeDefined();
            const buttonProps = groups[PropertyGroup.BUTTON]?.properties;
            const expectedButtonProps = [
                ButtonEnabled, ButtonText, ButtonCutoutText, ButtonTextColor,
                ButtonFontFamily, ButtonFontSize, ButtonFontWeight,
                ButtonLetterSpacing, ButtonTextTransform, ButtonTextAnchor,
                ButtonDominantBaseline, ButtonHoverFill, ButtonActiveFill,
                ButtonHoverTransform, ButtonActiveTransform, ButtonActionType,
                ElbowTextPosition // Specific to Elbow's button group
            ];
            expect(buttonProps).toEqual(expectedButtonProps);
        });

        it('should define DIMENSIONS group with Width, Height, BodyWidth, and ArmHeight', () => {
            expect(groups[PropertyGroup.DIMENSIONS]).toBeDefined();
            expect(groups[PropertyGroup.DIMENSIONS]?.properties).toEqual([Width, Height, BodyWidth, ArmHeight]);
        });

        it('should define POSITIONING group with OffsetX and OffsetY', () => {
            expect(groups[PropertyGroup.POSITIONING]).toBeDefined();
            expect(groups[PropertyGroup.POSITIONING]?.properties).toEqual([OffsetX, OffsetY]);
        });
    });

    describe('getSchema (behavior inherited from EditorElement, driven by getPropertyGroups)', () => {
        it('should include the Type property first with "Elbow" label', () => {
            const schema = elbowEditorElement.getSchema();
            expect(schema[0].name).toBe('type');
            expect(schema[0].selector?.select.options).toEqual([{ value: 'elbow', label: 'Elbow' }]);
        });

        it('should include anchor properties (AnchorTo, AnchorPoint, TargetAnchorPoint) in the schema', () => {
            const schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'anchorTo')).toBeDefined();
            expect(schema.find(s => s.name === 'anchorPoint' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'targetAnchorPoint' && s.type === 'custom')).toBeDefined();
        });

        it('should include stretch properties dynamically (base class behavior)', () => {
            let schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined();

            elbowEditorElement.config.layout.stretch = { stretchTo1: 'container' };
            schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'stretchDirection1' && s.type === 'custom')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
            expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
        });

        it('should include only ButtonEnabled if button.enabled is false/undefined', () => {
            elbowEditorElement.config.button = { enabled: false };
            let schema = elbowEditorElement.getSchema();
            let buttonSchemaItems = schema.filter(s => s.name.startsWith('button.') || s.name === 'elbow_text_position');
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');

            elbowEditorElement.config.button = {}; // enabled is implicitly false
            schema = elbowEditorElement.getSchema();
            buttonSchemaItems = schema.filter(s => s.name.startsWith('button.') || s.name === 'elbow_text_position');
            expect(buttonSchemaItems.length).toBe(1);
            expect(buttonSchemaItems[0].name).toBe('button.enabled');
        });

        it('should include all defined button properties (including ElbowTextPosition) if button.enabled is true', () => {
            elbowEditorElement.config.button = { enabled: true };
            const schema = elbowEditorElement.getSchema();
            
            const expectedButtonPropInstances = [
                new ButtonEnabled(), new ButtonText(), new ButtonCutoutText(), new ButtonTextColor(),
                new ButtonFontFamily(), new ButtonFontSize(), new ButtonFontWeight(),
                new ButtonLetterSpacing(), new ButtonTextTransform(), new ButtonTextAnchor(),
                new ButtonDominantBaseline(), new ButtonHoverFill(), new ButtonActiveFill(),
                new ButtonHoverTransform(), new ButtonActiveTransform(), new ButtonActionType(),
                new ElbowTextPosition() // Ensure ElbowTextPosition is checked
            ];
            expectedButtonPropInstances.forEach(instance => {
                expect(schema.find(s => s.name === instance.name)).toBeDefined();
            });
        });

        it('should include appearance properties (Fill, Orientation)', () => {
            const schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'fill')).toBeDefined();
            expect(schema.find(s => s.name === 'orientation')).toBeDefined();
        });

        it('should include dimension properties (Width, Height, BodyWidth, ArmHeight)', () => {
            const schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'width')).toBeDefined();
            expect(schema.find(s => s.name === 'height')).toBeDefined();
            expect(schema.find(s => s.name === 'bodyWidth')).toBeDefined();
            expect(schema.find(s => s.name === 'armHeight')).toBeDefined();
        });

        it('should include positioning properties (OffsetX, OffsetY)', () => {
            const schema = elbowEditorElement.getSchema();
            expect(schema.find(s => s.name === 'offsetX')).toBeDefined();
            expect(schema.find(s => s.name === 'offsetY')).toBeDefined();
        });
    });

    describe('getFormData (inherited from EditorElement)', () => {
        it('should correctly extract data from a full config for Elbow', () => {
            const testConfig = {
                id: 'el-formdata', type: 'elbow',
                props: {
                    fill: [0, 0, 255], // Blue
                    orientation: 'bottom-left',
                    bodyWidth: 25,
                    armHeight: 35,
                    elbow_text_position: 'side'
                },
                layout: {
                    width: 180, height: 90, offsetX: -8, offsetY: 12,
                    anchor: { anchorTo: 'el-target', anchorPoint: 'bottomLeft', targetAnchorPoint: 'topRight' },
                    stretch: { stretchTo1: 'container', targetStretchAnchorPoint1: 'left', stretchPadding1: 3 }
                },
                button: { enabled: true, text: 'Elbow Button', font_size: 10 }
            };
            const el = new Elbow(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('elbow');
            // Props
            expect(formData.fill).toEqual([0, 0, 255]);
            expect(formData.orientation).toBe('bottom-left');
            expect(formData.bodyWidth).toBe(25);
            expect(formData.armHeight).toBe(35);
            expect(formData.elbow_text_position).toBe('side');
            // Layout
            expect(formData.width).toBe(180);
            expect(formData.height).toBe(90);
            expect(formData.offsetX).toBe(-8);
            expect(formData.offsetY).toBe(12);
            // Anchor
            expect(formData.anchorTo).toBe('el-target');
            expect(formData.anchorPoint).toBe('bottomLeft');
            expect(formData.targetAnchorPoint).toBe('topRight');
            // Stretch
            expect(formData.stretchTo1).toBe('container');
            expect(formData.stretchDirection1).toBe('left');
            expect(formData.stretchPadding1).toBe(3);
            expect(formData.stretchTo2).toBe('');
            // Button
            expect(formData['button.enabled']).toBe(true);
            expect(formData['button.text']).toBe('Elbow Button');
            expect(formData['button.font_size']).toBe(10);
        });

        it('should handle missing optional Elbow-specific props', () => {
            const testConfig = {
                id: 'el-formdata-min', type: 'elbow',
                props: { fill: [100,100,100] }, // Only fill in props
                layout: { width: 50 }
            };
            const el = new Elbow(testConfig);
            const formData = el.getFormData();

            expect(formData.type).toBe('elbow');
            expect(formData.fill).toEqual([100,100,100]);
            expect(formData.orientation).toBeUndefined();
            expect(formData.bodyWidth).toBeUndefined();
            expect(formData.armHeight).toBeUndefined();
            expect(formData.elbow_text_position).toBeUndefined();
            expect(formData.width).toBe(50);
            expect(formData.height).toBeUndefined();
        });
    });

    describe('processDataUpdate (inherited from EditorElement)', () => {
        it('should correctly process full form data (including Elbow props) back to config delta', () => {
            const formDataFromUI = {
                type: 'elbow', 
                fill: [0, 128, 0], orientation: 'top-left', bodyWidth: 30, armHeight: 40, elbow_text_position: 'top',
                width: 210, height: 110, offsetX: 22, offsetY: 33,
                anchorTo: 'el3', anchorPoint: 'center', targetAnchorPoint: 'center',
                stretchTo1: 'container', stretchDirection1: 'top', stretchPadding1: 7,
                'button.enabled': true, 'button.text': 'New Elbow Text'
            };
            const el = new Elbow({ id: 'el-update', type: 'elbow' });
            const configDelta = el.processDataUpdate(formDataFromUI);

            // Props (top-level in delta, editor nests them into 'props')
            expect(configDelta.fill).toEqual([0, 128, 0]);
            expect(configDelta.orientation).toBe('top-left');
            expect(configDelta.bodyWidth).toBe(30);
            expect(configDelta.armHeight).toBe(40);
            expect(configDelta.elbow_text_position).toBe('top');
            // Layout (top-level in delta, editor nests them into 'layout')
            expect(configDelta.width).toBe(210);
            expect(configDelta.height).toBe(110);
            expect(configDelta.offsetX).toBe(22);
            expect(configDelta.offsetY).toBe(33);
            // Anchor (top-level in delta)
            expect(configDelta.anchorTo).toBe('el3');
            expect(configDelta.anchorPoint).toBe('center');
            expect(configDelta.targetAnchorPoint).toBe('center');
            // Stretch (nested by processDataUpdate into delta.layout.stretch)
            expect(configDelta.layout.stretch.stretchTo1).toBe('container');
            expect(configDelta.layout.stretch.targetStretchAnchorPoint1).toBe('top');
            expect(configDelta.layout.stretch.stretchAxis1).toBe('Y'); // Derived by base
            expect(configDelta.layout.stretch.stretchPadding1).toBe(7);
            // Button (prefixed in delta)
            expect(configDelta['button.enabled']).toBe(true);
            expect(configDelta['button.text']).toBe('New Elbow Text');
        });

        // Other tests (clearing anchor, defaulting anchor, disabling button, clearing stretch)
        // are largely testing base EditorElement behavior, which is assumed to be consistent
        // as per the chisel_endcap.spec.ts structure.
        // If specific interactions with Elbow props are needed for these cases, add them.
        // For now, let's assume the base mock covers these scenarios adequately.
        it('should clear anchorPoint and targetAnchorPoint if anchorTo is emptied', () => {
            const formDataFromUI = { anchorTo: '' };
            const el = new Elbow({
                id: 'el-anchor-clear', type: 'elbow',
                layout: { anchor: { anchorTo: 'prevContainer', anchorPoint: 'center', targetAnchorPoint: 'center' } }
            });
            const configDelta = el.processDataUpdate(formDataFromUI);
            
            expect(configDelta.anchorTo).toBe('');
            expect(configDelta.anchorPoint).toBeUndefined();
            expect(configDelta.targetAnchorPoint).toBeUndefined();
        });
    });
});