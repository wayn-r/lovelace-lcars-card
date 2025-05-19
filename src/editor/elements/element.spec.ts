// src/editor/elements/element.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// --- Mocks ---
// Mock LcarsGroup.validateIdentifier
vi.mock('../group', () => ({
    LcarsGroup: {
        validateIdentifier: vi.fn()
    }
}));

// --- Imports ---
import { EditorElement, PropertyGroup, PropertyGroupDefinition, PropertyClassOrFactory } from './element';
import {
    LcarsPropertyBase, HaFormSchema, Layout, PropertySchemaContext,
    Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    StretchTarget, StretchDirection, StretchPadding,
    ButtonEnabled,
    // Import specific button properties if they are used as defaults by the base class.
    // For now, ButtonEnabled is enough for getButtonProperties testing.
} from '../properties/properties';
import { LcarsGroup } from '../group'; // Mocked LcarsGroup

// --- Test Helper: Dummy Property Classes ---
class MockAppearanceProp implements LcarsPropertyBase {
    name = 'mockFill';
    label = 'Mock Fill';
    configPath = 'props.mockFill';
    propertyGroup = PropertyGroup.APPEARANCE;
    layout = Layout.HALF;
    getSchema = vi.fn(() => ({ name: this.name, label: this.label, selector: { text: {} } }));
    formatValueForForm = vi.fn(value => value); // Identity by default
}

class MockDimensionProp implements LcarsPropertyBase {
    name = 'mockWidth';
    label = 'Mock Width';
    configPath = 'layout.mockWidth';
    propertyGroup = PropertyGroup.DIMENSIONS;
    layout = Layout.HALF;
    getSchema = vi.fn(() => ({ name: this.name, label: this.label, selector: { number: {} } }));
}

class MockButtonProp implements LcarsPropertyBase {
    name = 'button.customBtnProp';
    label = 'Custom Button Prop';
    configPath = 'button.customBtnProp';
    propertyGroup = PropertyGroup.BUTTON;
    layout = Layout.FULL;
    getSchema = vi.fn(() => ({ name: this.name, label: this.label, selector: { text: {} } }));
}

class MockTextProp implements LcarsPropertyBase {
    name = 'mockTextContent';
    label = 'Mock Text Content';
    configPath = 'props.mockTextContent';
    propertyGroup = PropertyGroup.TEXT;
    layout = Layout.FULL;
    getSchema = vi.fn(() => ({ name: this.name, label: this.label, selector: { text: {} } }));
}

// --- Test Helper: Concrete EditorElement for Testing ---
class ConcreteTestEditorElement extends EditorElement {
    public propertyGroupsConfig: Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> = {};

    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return this.propertyGroupsConfig;
    }
}

// --- Test Suite ---
describe('EditorElement', () => {
    let element: ConcreteTestEditorElement;
    let config: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock behavior for LcarsGroup.validateIdentifier
        (LcarsGroup.validateIdentifier as Mock).mockReturnValue({ isValid: true, error: '' });

        config = { id: 'group1.el1', type: 'concrete-test-element' };
        element = new ConcreteTestEditorElement(config);
    });

    describe('Static Methods: registerEditorElement and create', () => {
        let originalRegistry: Record<string, any>;

        beforeEach(() => {
            // Save and clear the registry for isolated tests
            originalRegistry = { ...(EditorElement as any).editorElementRegistry };
            for (const key in (EditorElement as any).editorElementRegistry) {
                delete (EditorElement as any).editorElementRegistry[key];
            }
        });

        afterEach(() => {
            // Restore original registry
            (EditorElement as any).editorElementRegistry = originalRegistry;
        });

        it('should register an element class and allow creation', () => {
            EditorElement.registerEditorElement('test-type', ConcreteTestEditorElement);
            const instance = EditorElement.create({ type: 'test-type', id: 'test-id' });
            expect(instance).toBeInstanceOf(ConcreteTestEditorElement);
            expect(instance?.id).toBe('test-id');
        });

        it('should warn if overwriting an existing registration', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            EditorElement.registerEditorElement('test-type', ConcreteTestEditorElement);
            EditorElement.registerEditorElement('test-type', ConcreteTestEditorElement); // Register again
            expect(consoleWarnSpy).toHaveBeenCalledWith('EditorElement type "test-type" is being overwritten.');
            consoleWarnSpy.mockRestore();
        });

        it('should return null and warn if creating an unknown element type', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const instance = EditorElement.create({ type: 'unknown-type', id: 'test-id' });
            expect(instance).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown element type for editor: unknown-type');
            consoleWarnSpy.mockRestore();
        });

        it('should return null if config is null or type is missing', () => {
            expect(EditorElement.create(null)).toBeNull();
            expect(EditorElement.create({ id: 'no-type' })).toBeNull();
        });
    });

    describe('Constructor', () => {
        it('should initialize id, type, and config', () => {
            expect(element.id).toBe('group1.el1');
            expect(element.type).toBe('concrete-test-element');
            expect(element.config).toBe(config);
        });

        it('should initialize layout.stretch as an empty object if layout is missing', () => {
            const el = new ConcreteTestEditorElement({ id: 'test', type: 'test' });
            expect(el.config.layout).toEqual({ stretch: {} });
        });

        it('should initialize layout.stretch if layout exists but stretch is missing', () => {
            const el = new ConcreteTestEditorElement({ id: 'test', type: 'test', layout: { width: 100 } });
            expect(el.config.layout.stretch).toEqual({});
            expect(el.config.layout.width).toBe(100);
        });

        it('should preserve existing layout.stretch', () => {
            const stretchConfig = { stretchTo1: 'container' };
            const el = new ConcreteTestEditorElement({ id: 'test', type: 'test', layout: { stretch: stretchConfig } });
            expect(el.config.layout.stretch).toBe(stretchConfig);
        });

        it('should initialize button as an empty object if missing', () => {
            const el = new ConcreteTestEditorElement({ id: 'test', type: 'test' });
            expect(el.config.button).toEqual({});
        });

        it('should preserve existing button config', () => {
            const buttonConfig = { enabled: true };
            const el = new ConcreteTestEditorElement({ id: 'test', type: 'test', button: buttonConfig });
            expect(el.config.button).toBe(buttonConfig);
        });

        it('should initialize currentIdInput with the base ID', () => {
            expect(element.currentIdInput).toBe('el1');
            const elNoGroup = new ConcreteTestEditorElement({ id: 'simpleId', type: 't' });
            expect(elNoGroup.currentIdInput).toBe('simpleId');
            const elEmptyId = new ConcreteTestEditorElement({ id: '', type: 't' });
            expect(elEmptyId.currentIdInput).toBe('');
        });
    });

    describe('ID Helper Methods', () => {
        it('getBaseId should return base part of ID', () => {
            expect(element.getBaseId()).toBe('el1');
            element.id = 'simple';
            expect(element.getBaseId()).toBe('simple');
        });

        it('getGroupId should return group part of ID or __ungrouped__', () => {
            expect(element.getGroupId()).toBe('group1');
            element.id = 'simple';
            expect(element.getGroupId()).toBe('__ungrouped__');
        });
    });

    describe('UI State Methods (collapse, ID editing)', () => {
        it('toggleCollapse should flip isCollapsed state', () => {
            expect(element.isCollapsed).toBe(true);
            element.toggleCollapse();
            expect(element.isCollapsed).toBe(false);
            element.toggleCollapse();
            expect(element.isCollapsed).toBe(true);
        });

        it('startEditingId should set editing state', () => {
            element.startEditingId();
            expect(element.isEditingId).toBe(true);
            expect(element.currentIdInput).toBe('el1'); // Base ID
            expect(element.idEditErrorMessage).toBe('');
        });

        it('cancelEditingId should reset editing state', () => {
            element.startEditingId();
            element.currentIdInput = 'new-id';
            element.idEditErrorMessage = 'Error!';
            element.cancelEditingId();
            expect(element.isEditingId).toBe(false);
            expect(element.idEditErrorMessage).toBe('');
            // currentIdInput is not reset by cancelEditingId, it remains the last input value
            expect(element.currentIdInput).toBe('new-id');
        });

        it('updateIdInput should update currentIdInput and call validateIdInput', () => {
            const validateSpy = vi.spyOn(element, 'validateIdInput');
            element.updateIdInput('new-val');
            expect(element.currentIdInput).toBe('new-val');
            expect(validateSpy).toHaveBeenCalled();
        });

        describe('validateIdInput', () => {
            it('should return true and clear error if LcarsGroup.validateIdentifier is valid', () => {
                (LcarsGroup.validateIdentifier as Mock).mockReturnValue({ isValid: true, error: '' });
                element.currentIdInput = 'valid-id';
                expect(element.validateIdInput()).toBe(true);
                expect(element.idEditErrorMessage).toBe('');
            });

            it('should return false and set error if LcarsGroup.validateIdentifier is invalid', () => {
                (LcarsGroup.validateIdentifier as Mock).mockReturnValue({ isValid: false, error: 'Invalid format' });
                element.currentIdInput = 'invalid id';
                expect(element.validateIdInput()).toBe(false);
                expect(element.idEditErrorMessage).toBe('Invalid format');
            });

            it('should default error message if LcarsGroup.validateIdentifier returns no error string', () => {
                (LcarsGroup.validateIdentifier as Mock).mockReturnValue({ isValid: false });
                element.currentIdInput = 'invalid id';
                expect(element.validateIdInput()).toBe(false);
                expect(element.idEditErrorMessage).toBe('Invalid Element base ID.');
            });
        });

        describe('confirmEditId', () => {
            beforeEach(() => {
                element.startEditingId(); // Ensure isEditingId is true
            });

            it('should return null if not in editing mode (isEditingId is false)', () => {
                element.isEditingId = false;
                element.currentIdInput = 'new-id';
                expect(element.confirmEditId()).toBeNull();
            });

            it('should return null if ID is invalid', () => {
                (LcarsGroup.validateIdentifier as Mock).mockReturnValue({ isValid: false, error: 'Invalid' });
                element.currentIdInput = 'invalid id';
                expect(element.confirmEditId()).toBeNull();
                expect(element.isEditingId).toBe(true); // Should remain in editing mode
            });

            it('should return null if ID is unchanged and reset editing state', () => {
                element.currentIdInput = 'el1'; // Same as base ID
                expect(element.confirmEditId()).toBeNull();
                expect(element.isEditingId).toBe(false); // Editing should be cancelled
            });

            it('should return new and old full IDs and reset state on successful change', () => {
                element.currentIdInput = 'el2';
                const result = element.confirmEditId();
                expect(result).toEqual({ oldId: 'group1.el1', newId: 'group1.el2' });
                expect(element.isEditingId).toBe(false);
                expect(element.idEditErrorMessage).toBe('');
            });

            it('should handle ungrouped elements correctly', () => {
                element.id = 'el1'; // Ungrouped
                element.startEditingId();
                element.currentIdInput = 'el2';
                const result = element.confirmEditId();
                expect(result).toEqual({ oldId: 'el1', newId: '__ungrouped__.el2' });
            });
        });
    });

    describe('requestDelete', () => {
        it('should return an object with the elementId', () => {
            expect(element.requestDelete()).toEqual({ elementId: 'group1.el1' });
        });
    });

    describe('stretchPropertyFactories', () => {
        it('should return an array of 6 factory functions', () => {
            const factories = element.stretchPropertyFactories;
            expect(factories).toBeInstanceOf(Array);
            expect(factories.length).toBe(6);
            factories.forEach(factory => expect(factory).toBeInstanceOf(Function));
        });

        it('factory functions should create correct StretchProperty instances', () => {
            const factories = element.stretchPropertyFactories;
            expect(factories[0]()).toBeInstanceOf(StretchTarget);
            expect((factories[0]() as StretchTarget).index).toBe(0);
            expect(factories[1]()).toBeInstanceOf(StretchDirection);
            expect((factories[1]() as StretchDirection).index).toBe(0);
            expect(factories[2]()).toBeInstanceOf(StretchPadding);
            expect((factories[2]() as StretchPadding).index).toBe(0);
            expect(factories[3]()).toBeInstanceOf(StretchTarget);
            expect((factories[3]() as StretchTarget).index).toBe(1);
            expect(factories[4]()).toBeInstanceOf(StretchDirection);
            expect((factories[4]() as StretchDirection).index).toBe(1);
            expect(factories[5]()).toBeInstanceOf(StretchPadding);
            expect((factories[5]() as StretchPadding).index).toBe(1);
        });
    });

    // --- More complex methods relying on getPropertyGroups ---
    describe('getSchema, getPropertiesMap, getFormData, processDataUpdate', () => {
        let mockAppearanceProp: MockAppearanceProp;
        let mockDimensionProp: MockDimensionProp;
        let mockButtonProp: MockButtonProp;
        let mockTextProp: MockTextProp;

        beforeEach(() => {
            mockAppearanceProp = new MockAppearanceProp();
            mockDimensionProp = new MockDimensionProp();
            mockButtonProp = new MockButtonProp();
            mockTextProp = new MockTextProp();
        });

        describe('getSchema', () => {
            it('should always include Type property first', () => {
                element.propertyGroupsConfig = {}; // No other groups
                const schema = element.getSchema();
                expect(schema.length).toBeGreaterThanOrEqual(1);
                expect(schema[0].name).toBe('type');
                expect(schema[0]).toBeInstanceOf(Object); // Check it's a schema object
            });

            it('should include Anchor properties if ANCHOR group is defined (even if empty)', () => {
                element.propertyGroupsConfig = { [PropertyGroup.ANCHOR]: { properties: [] } };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === 'anchorTo')).toBeDefined();
                expect(schema.find(s => s.name === 'anchorPoint')).toBeDefined();
                expect(schema.find(s => s.name === 'targetAnchorPoint')).toBeDefined();
            });

            it('should NOT include Anchor properties if ANCHOR group is null', () => {
                element.propertyGroupsConfig = { [PropertyGroup.ANCHOR]: null };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === 'anchorTo')).toBeUndefined();
            });

            it('should include Stretch properties dynamically', () => {
                element.propertyGroupsConfig = { [PropertyGroup.STRETCH]: { properties: [] } };
                // Scenario 1: No stretch config
                let schema = element.getSchema();
                expect(schema.find(s => s.name === 'stretchTo1')).toBeDefined();
                expect(schema.find(s => s.name === 'stretchDirection1')).toBeUndefined();

                // Scenario 2: stretchTo1 defined
                element.config.layout.stretch = { stretchTo1: 'container' };
                schema = element.getSchema();
                expect(schema.find(s => s.name === 'stretchDirection1')).toBeDefined();
                expect(schema.find(s => s.name === 'stretchPadding1')).toBeDefined();
                expect(schema.find(s => s.name === 'stretchTo2')).toBeDefined();
                expect(schema.find(s => s.name === 'stretchDirection2')).toBeUndefined();

                // Scenario 3: stretchTo1 and stretchTo2 defined
                element.config.layout.stretch.stretchTo2 = 'other-el';
                schema = element.getSchema();
                expect(schema.find(s => s.name === 'stretchDirection2')).toBeDefined();
                expect(schema.find(s => s.name === 'stretchPadding2')).toBeDefined();
            });

            it('should handle Button properties: only ButtonEnabled if button disabled', () => {
                element.config.button = { enabled: false };
                element.propertyGroupsConfig = { [PropertyGroup.BUTTON]: { properties: [MockButtonProp] } };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === 'button.enabled')).toBeDefined();
                expect(schema.find(s => s.name === 'button.customBtnProp')).toBeUndefined();
            });

            it('should handle Button properties: ButtonEnabled and custom if button enabled and group has props', () => {
                element.config.button = { enabled: true };
                element.propertyGroupsConfig = { [PropertyGroup.BUTTON]: { properties: [() => new MockButtonProp()] } };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === 'button.enabled')).toBeDefined();
                expect(schema.find(s => s.name === 'button.customBtnProp')).toBeDefined();
            });

            it('should handle Button properties: ensure ButtonEnabled is included even if not in custom props list', () => {
                element.config.button = { enabled: true };
                // MockButtonProp is already a button prop, so this tests if ButtonEnabled is added if missing
                element.propertyGroupsConfig = { [PropertyGroup.BUTTON]: { properties: [() => new MockButtonProp()] } };
                const schema = element.getSchema();
                const buttonEnabledSchema = schema.find(s => s.name === 'button.enabled');
                expect(buttonEnabledSchema).toBeDefined();
                // Ensure custom prop is also there
                expect(schema.find(s => s.name === 'button.customBtnProp')).toBeDefined();
            });


            it('should include properties from other defined groups like APPEARANCE, DIMENSIONS, TEXT', () => {
                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [() => new MockAppearanceProp()] },
                    [PropertyGroup.DIMENSIONS]: { properties: [() => new MockDimensionProp()] },
                    [PropertyGroup.TEXT]: { properties: [() => new MockTextProp()] },
                };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === 'mockFill')).toBeDefined();
                expect(schema.find(s => s.name === 'mockWidth')).toBeDefined();
                expect(schema.find(s => s.name === 'mockTextContent')).toBeDefined();
            });

            it('should respect isEnabled condition on property groups', () => {
                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: {
                        properties: [() => new MockAppearanceProp()],
                        isEnabled: (config) => config.showAppearance === true
                    }
                };
                // Condition not met
                element.config.showAppearance = false;
                let schema = element.getSchema();
                expect(schema.find(s => s.name === 'mockFill')).toBeUndefined();

                // Condition met
                element.config.showAppearance = true;
                schema = element.getSchema();
                expect(schema.find(s => s.name === 'mockFill')).toBeDefined();
            });

            it('should handle property factory functions in group definitions', () => {
                const factoryPropName = 'factoryProp';
                const factoryPropGetSchema = vi.fn(() => ({ name: factoryPropName, selector: {} }));
                const propFactory = () => ({
                    name: factoryPropName, label: 'Factory Prop', configPath: 'props.factory',
                    propertyGroup: PropertyGroup.APPEARANCE, layout: Layout.FULL,
                    getSchema: factoryPropGetSchema
                }) as LcarsPropertyBase;

                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [propFactory] }
                };
                const schema = element.getSchema();
                expect(schema.find(s => s.name === factoryPropName)).toBeDefined();
                expect(factoryPropGetSchema).toHaveBeenCalled();
            });

            it('should gracefully handle errors when instantiating property classes or factories', () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                const badPropClass = (() => { throw new Error("Bad prop"); }) as unknown as PropertyClassOrFactory;
                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [badPropClass] }
                };
                const schema = element.getSchema();
                // Should not throw, should skip the bad property
                expect(schema.find(s => s.name === (badPropClass as any).name)).toBeUndefined();
                expect(consoleErrorSpy).toHaveBeenCalled();
                consoleErrorSpy.mockRestore();
            });

        });

        describe('getPropertiesMap', () => {
            it('should return a map of property instances by name', () => {
                 element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [() => new MockAppearanceProp()] },
                    [PropertyGroup.DIMENSIONS]: { properties: [() => new MockDimensionProp()] }, // Test factory
                };
                const map = element.getPropertiesMap();
                expect(map.has('type')).toBe(true); // Type is always there
                expect(map.get('type')).toBeInstanceOf(Type);
                expect(map.has('mockFill')).toBe(true);
                expect(map.get('mockFill')).toBeInstanceOf(MockAppearanceProp);
                expect(map.has('mockWidth')).toBe(true);
                expect(map.get('mockWidth')).toBeInstanceOf(MockDimensionProp);
            });

            it('should gracefully handle errors when instantiating properties for map', () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                const badPropClass = (() => { throw new Error("Bad prop for map"); }) as unknown as PropertyClassOrFactory;
                 element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [badPropClass] }
                };
                const map = element.getPropertiesMap();
                expect(map.has((badPropClass as any).name)).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalled();
                consoleErrorSpy.mockRestore();
            });
        });

        describe('getFormData', () => {
            it('should extract data from config based on property configPaths', () => {
                element.config.props = { mockFill: 'red' };
                element.config.layout = { mockWidth: 100 };
                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [() => new MockAppearanceProp()] },
                    [PropertyGroup.DIMENSIONS]: { properties: [() => new MockDimensionProp()] },
                };
                const formData = element.getFormData();
                expect(formData.type).toBe('concrete-test-element');
                expect(formData.mockFill).toBe('red');
                expect(formData.mockWidth).toBe(100);
            });

            it('should use formatValueForForm if defined on property', () => {
                const mockFillFormatted = 'mock-fill-formatted';
                const mockProp = new MockAppearanceProp();
                vi.spyOn(mockProp, 'formatValueForForm').mockReturnValue(mockFillFormatted);
                element.config.props = { mockFill: 'original-fill' };
                element.propertyGroupsConfig = {
                    [PropertyGroup.APPEARANCE]: { properties: [() => mockProp] }
                };
                const formData = element.getFormData();
                expect(formData.mockFill).toBe(mockFillFormatted);
                expect(mockProp.formatValueForForm).toHaveBeenCalledWith('original-fill');
            });

            it('should set StretchTarget value to empty string if undefined in config', () => {
                element.propertyGroupsConfig = { [PropertyGroup.STRETCH]: { properties: [] } };
                // No stretch config initially
                let formData = element.getFormData();
                expect(formData.stretchTo1).toBe('');
                expect(formData.stretchTo2).toBeUndefined(); // Only stretchTo1 has this default

                element.config.layout.stretch = { stretchTo1: 'container' }; // stretchTo2 still undefined
                formData = element.getFormData();
                expect(formData.stretchTo1).toBe('container');
                expect(formData.stretchTo2).toBe('');
            });

            it('should correctly map stretch target/direction from config to form data names', () => {
                 element.propertyGroupsConfig = { [PropertyGroup.STRETCH]: { properties: [] } };
                 element.config.layout.stretch = {
                    stretchTo1: 'el-A',
                    targetStretchAnchorPoint1: 'left', // Becomes stretchDirection1 in form
                    stretchPadding1: 5,
                    stretchTo2: 'el-B',
                    targetStretchAnchorPoint2: 'top',  // Becomes stretchDirection2 in form
                    stretchPadding2: 10,
                 };
                 const formData = element.getFormData();
                 expect(formData.stretchTo1).toBe('el-A');
                 expect(formData.stretchDirection1).toBe('left');
                 expect(formData.stretchPadding1).toBe(5);
                 expect(formData.stretchTo2).toBe('el-B');
                 expect(formData.stretchDirection2).toBe('top');
                 expect(formData.stretchPadding2).toBe(10);
            });
        });

        describe('processDataUpdate', () => {
            it('Anchor: should clear anchorPoint and targetAnchorPoint if anchorTo is emptied', () => {
                const delta = element.processDataUpdate({ anchorTo: '' });
                expect(delta.anchorPoint).toBeUndefined();
                expect(delta.targetAnchorPoint).toBeUndefined();
            });

            it('Anchor: should default anchorPoint and targetAnchorPoint to "center" if anchorTo is set but points are not', () => {
                const delta = element.processDataUpdate({ anchorTo: 'container' });
                expect(delta.anchorPoint).toBe('center');
                expect(delta.targetAnchorPoint).toBe('center');
            });

            it('Stretch: should create layout.stretch and populate from form data', () => {
                const formData = {
                    stretchTo1: 'container', stretchDirection1: 'left', stretchPadding1: 10,
                    stretchTo2: 'el-A', stretchDirection2: 'top', stretchPadding2: 5,
                };
                const delta = element.processDataUpdate(formData);
                expect(delta.layout.stretch.stretchTo1).toBe('container');
                expect(delta.layout.stretch.targetStretchAnchorPoint1).toBe('left');
                expect(delta.layout.stretch.stretchAxis1).toBe('X'); // Derived
                expect(delta.layout.stretch.stretchPadding1).toBe(10);
                expect(delta.layout.stretch.stretchTo2).toBe('el-A');
                expect(delta.layout.stretch.targetStretchAnchorPoint2).toBe('top');
                expect(delta.layout.stretch.stretchAxis2).toBe('Y'); // Derived
                expect(delta.layout.stretch.stretchPadding2).toBe(5);
            });

            it('Stretch: should clear stretch group if stretchTo is emptied', () => {
                const delta = element.processDataUpdate({ stretchTo1: '', stretchDirection1: 'left' });
                expect(delta.layout.stretch.stretchTo1).toBeUndefined();
                expect(delta.layout.stretch.targetStretchAnchorPoint1).toBeUndefined();
                expect(delta.layout.stretch.stretchAxis1).toBeUndefined();
                expect(delta.layout.stretch.stretchPadding1).toBeUndefined();
                expect(delta.stretchDirection1).toBeUndefined(); // Cleared from top level delta
            });

            it('Stretch: should default stretchPadding to 0 if not provided but stretchTo and direction are', () => {
                const delta = element.processDataUpdate({ stretchTo1: 'container', stretchDirection1: 'left' });
                expect(delta.layout.stretch.stretchPadding1).toBe(0);
            });


            it('Button: should clear other button properties if button.enabled is false', () => {
                const formData = {
                    'button.enabled': false,
                    'button.text': 'Some Text',
                    'button.action_config.type': 'call-service' // An action_config sub-property
                };
                const delta = element.processDataUpdate(formData);
                expect(delta['button.enabled']).toBe(false);
                expect(delta['button.text']).toBeUndefined();
                expect(delta['button.action_config.type']).toBeUndefined();
            });

            it('Button: should preserve hover/active transforms from original config if button.enabled is true and transforms not in form data', () => {
                element.config.button = { hover_transform: 'scale(1.1)', active_transform: 'scale(0.9)' };
                const formData = { 'button.enabled': true, 'button.text': 'Test' }; // No transforms in form
                const delta = element.processDataUpdate(formData);
                expect(delta['button.hover_transform']).toBe('scale(1.1)');
                expect(delta['button.active_transform']).toBe('scale(0.9)');
            });

            it('Button: should initialize hover/active transforms to empty string if not in original config or form data', () => {
                // element.config.button is {} (no transforms)
                const formData = { 'button.enabled': true, 'button.text': 'Test' };
                const delta = element.processDataUpdate(formData);
                expect(delta['button.hover_transform']).toBe('');
                expect(delta['button.active_transform']).toBe('');
            });

            it('Button: should clear action_config sub-properties if action_config.type is "none" or missing', () => {
                let formData: any = {
                    'button.enabled': true,
                    'button.action_config.type': 'none',
                    'button.action_config.service': 'light.turn_on'
                };
                let delta = element.processDataUpdate(formData);
                expect(delta['button.action_config.service']).toBeUndefined();

                formData = {
                    'button.enabled': true,
                    // 'button.action_config.type' is missing
                    'button.action_config.service': 'light.turn_on'
                };
                delta = element.processDataUpdate(formData);
                expect(delta['button.action_config.service']).toBeUndefined();
            });
        });
    });

    describe('_isHorizontalDirection (via processDataUpdate stretchAxis derivation)', () => {
        const testDirection = (direction: string, expectedAxis: 'X' | 'Y') => {
            it(`should derive stretchAxis as '${expectedAxis}' for direction '${direction}'`, () => {
                const delta = element.processDataUpdate({ stretchTo1: 'container', stretchDirection1: direction });
                expect(delta.layout.stretch.stretchAxis1).toBe(expectedAxis);
            });
        };

        // Horizontal directions
        testDirection('left', 'X');
        testDirection('right', 'X');
        testDirection('center', 'X');
        testDirection('centerLeft', 'X'); // Assuming names like this might be used
        testDirection('centerRight', 'X');

        // Vertical directions
        testDirection('top', 'Y');
        testDirection('bottom', 'Y');
        testDirection('topCenter', 'Y'); // Assuming names like this might be used
        testDirection('bottomCenter', 'Y');

        // Mixed/Default cases (current implementation defaults to 'Y' if not explicitly horizontal)
        testDirection('topLeft', 'Y'); // Technically contains 'Left', but 'top' might take precedence or it defaults. Current impl: Y
        testDirection('somethingElse', 'Y'); // Unknown defaults to Y
    });
});