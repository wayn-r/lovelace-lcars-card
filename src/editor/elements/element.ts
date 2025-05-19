import {
    Type,
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    StretchTarget, StretchDirection, StretchPadding,
    ButtonEnabled, 
    PropertySchemaContext, HaFormSchema, LcarsPropertyBase,
    PropertyGroup, Layout
} from '../properties/properties';
import { LcarsGroup } from '../group';

export type PropertyClass = new () => LcarsPropertyBase;
export type PropertyClassOrFactory = (new () => LcarsPropertyBase) | (() => LcarsPropertyBase);

const editorElementRegistry: Record<string, new (config: any) => EditorElement> = {};

// Define PropertyGroup enum for readability and type safety
export { PropertyGroup } from '../properties/properties';

// Helper interface for defining property group requirements
export interface PropertyGroupDefinition {
    properties: PropertyClassOrFactory[];
    // For conditional groups based on config values
    isEnabled?: (config: any) => boolean;
}

export abstract class EditorElement {
    id: string;
    type: string;
    config: any;

    isCollapsed: boolean = true;
    isEditingId: boolean = false;
    currentIdInput: string = '';
    idEditErrorMessage: string = '';

    constructor(config: any) {
        this.id = config.id;
        this.type = config.type;
        this.config = config;

        if (!this.config.layout) this.config.layout = {};
        if (!this.config.layout.stretch) this.config.layout.stretch = {};
        if (!this.config.button) this.config.button = {};

        this.currentIdInput = this.getBaseId();
    }

    getBaseId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[1] : this.id || '';
    }

    getGroupId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[0] : '__ungrouped__';
    }

    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {};
    }

    /**
     * Stretch properties need special handling due to their indexed nature (StretchTarget(0), StretchTarget(1)).
     * This method provides the factory functions for them.
     */
    get stretchPropertyFactories(): (() => LcarsPropertyBase)[] {
        return [
            () => new StretchTarget(0),
            () => new StretchDirection(0),
            () => new StretchPadding(0),
            () => new StretchTarget(1),
            () => new StretchDirection(1),
            () => new StretchPadding(1),
        ];
    }

    private getButtonProperties(groupDef: PropertyGroupDefinition | null): PropertyClassOrFactory[] {
        if (!this.config.button?.enabled) {
            return [ButtonEnabled];
        }
        
        // If custom properties are defined, use those
        if (groupDef && groupDef.properties && groupDef.properties.length > 0) {
            // Make sure ButtonEnabled is included
            if (!groupDef.properties.includes(ButtonEnabled)) {
                return [ButtonEnabled, ...groupDef.properties];
            }
            return groupDef.properties;
        }

        // Otherwise return only ButtonEnabled (no default button properties)
        return [ButtonEnabled];
    }

    /**
     * Helper to get stretch-related properties based on the element's config
     */
    private getStretchProperties(): PropertyClassOrFactory[] {
        const stretchProps: PropertyClassOrFactory[] = [];
        const layoutData = this.config.layout || {};
        const stretch = layoutData.stretch || {};
        const factories = this.stretchPropertyFactories;

        // Always add the first stretch target to allow setting it
        stretchProps.push(factories[0]); // StretchTarget(0)
        
        // Add first stretch direction and padding if target is set
        if (stretch.stretchTo1) {
            stretchProps.push(factories[1]); // StretchDirection(0)
            stretchProps.push(factories[2]); // StretchPadding(0)
            
            // Add second stretch target if first one is configured
            stretchProps.push(factories[3]); // StretchTarget(1)
            
            // Add second stretch direction and padding if second target is set
            if (stretch.stretchTo2) {
                stretchProps.push(factories[4]); // StretchDirection(1)
                stretchProps.push(factories[5]); // StretchPadding(1)
            }
        }

        return stretchProps;
    }

    /**
     * Collects all property classes from the enabled property groups
     */
    private getAllPropertyClasses(): PropertyClassOrFactory[] {
        // Always include Type property at the beginning
        let allProperties: PropertyClassOrFactory[] = [Type];
        
        // Get property groups as defined by the element
        const groups = this.getPropertyGroups();
        
        // Add properties from each group
        for (const [groupKey, groupDef] of Object.entries(groups)) {
            const propertyGroup = groupKey as PropertyGroup;

            if (propertyGroup === PropertyGroup.ANCHOR) {
                if (groupDef !== null) {
                    allProperties.push(AnchorTo, AnchorPoint, TargetAnchorPoint);
                }
                continue;
            }
            if (propertyGroup === PropertyGroup.STRETCH) {
                if (groupDef === null || groupDef) {
                    allProperties.push(...this.getStretchProperties());
                }
                continue;
            }
            // Handle BUTTON group
            if (propertyGroup === PropertyGroup.BUTTON) {
                allProperties.push(...this.getButtonProperties(groupDef));
                continue;
            }
            
            // Handle all other groups - only include if defined with properties
            if (groupDef && groupDef.properties.length > 0) {
                // Check custom isEnabled condition if provided
                if (groupDef.isEnabled && !groupDef.isEnabled(this.config)) {
                    continue;
                }
                
                allProperties.push(...groupDef.properties);
            }
        }
        
        // Ensure uniqueness
        return Array.from(new Set(allProperties));
    }

    getSchema(context?: PropertySchemaContext): HaFormSchema[] {
        const layoutData = this.config.layout || {};
        const propsData = this.config.props || {};
        const buttonData = this.config.button || {};
        const fullContext = { ...context, layoutData, propsData, buttonData };
        
        // Get all property classes from enabled groups
        const propertyClasses = this.getAllPropertyClasses();
        
        // Generate schema from property instances
        const schema = propertyClasses.map(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                // Check if it's a class constructor or a factory function
                if (typeof PropClassOrFactory === 'function' && PropClassOrFactory.prototype && 
                    typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    // It's a class constructor
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
                    // It's a factory function
                    instance = (PropClassOrFactory as () => LcarsPropertyBase)();
                }
                return instance.getSchema(fullContext);
            } catch (e) {
                console.error(`Error instantiating or getting schema for ${ (PropClassOrFactory as any).name || 'Unknown Property Class'}`, e);
                return null;
            }
        }).filter((item): item is HaFormSchema => item !== null);
        
        return schema;
    }

    getPropertiesMap(): Map<string, LcarsPropertyBase> {
        const map = new Map<string, LcarsPropertyBase>();
        
        // Get all property classes from enabled groups
        const propertyClasses = this.getAllPropertyClasses();

        propertyClasses.forEach(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                if (typeof PropClassOrFactory === 'function' && PropClassOrFactory.prototype && 
                    typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    // It's a class constructor
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
                    // It's a factory function
                    instance = (PropClassOrFactory as () => LcarsPropertyBase)();
                }
                map.set(instance.name, instance);
            } catch (e) {
                console.error(`Error instantiating property from ${ (PropClassOrFactory as any).name || 'factory' }`, e);
            }
        });
        return map;
    }

    getFormData(): Record<string, any> {
        const formData: Record<string, any> = {};
        const propertiesMap = this.getPropertiesMap();
        
        const getDeepValue = (obj: any, parts: string[]): any => {
            let current = obj;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        };

        propertiesMap.forEach((propInstance, propName) => {
            const pathParts = propInstance.configPath.split('.');
            let value = getDeepValue(this.config, pathParts);

            if (propInstance.formatValueForForm) {
                value = propInstance.formatValueForForm(value);
            }
            if (propInstance instanceof StretchTarget && value === undefined) {
                value = '';
            }
            if (value !== undefined) {
                formData[propInstance.name] = value;
            }
        });
        return formData;
    }

    processDataUpdate(newData: any): any {
        let data = { ...newData };

        if (!data.anchorTo || data.anchorTo === '') {
            delete data.anchorPoint;
            delete data.targetAnchorPoint;
        } else {
            if (!data.anchorPoint) data.anchorPoint = 'center';
            if (!data.targetAnchorPoint) data.targetAnchorPoint = 'center';
        }

        if (!data.layout) data.layout = {};
        if (!data.layout.stretch) data.layout.stretch = {};

        const processStretchGroup = (index: number) => {
            const suffix = index === 0 ? '1' : '2';
            const stretchToName = `stretchTo${suffix}`;
            const directionName = `stretchDirection${suffix}`;
            const paddingName = `stretchPadding${suffix}`;

            const stretchToValue = data[stretchToName];
            const directionValue = data[directionName];
            const paddingValue = data[paddingName];

            if (!stretchToValue || stretchToValue === '') {
                delete data.layout.stretch[`stretchTo${suffix}`];
                delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                delete data.layout.stretch[`stretchAxis${suffix}`];
                delete data.layout.stretch[`stretchPadding${suffix}`];
                delete data[directionName];
                delete data[paddingName];
            } else {
                data.layout.stretch[`stretchTo${suffix}`] = stretchToValue;
                if (directionValue) {
                    data.layout.stretch[`targetStretchAnchorPoint${suffix}`] = directionValue;
                    data.layout.stretch[`stretchAxis${suffix}`] = this._isHorizontalDirection(directionValue) ? 'X' : 'Y';
                    data.layout.stretch[`stretchPadding${suffix}`] = paddingValue ?? 0;
                } else {
                    delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                    delete data.layout.stretch[`stretchAxis${suffix}`];
                    delete data.layout.stretch[`stretchPadding${suffix}`];
                    delete data[directionName];
                    delete data[paddingName];
                }
            }
        };

        if ('stretchTo2' in data && data.stretchTo2 !== '') {
            data.layout.stretch.stretchTo2 = data.stretchTo2;
        }
        processStretchGroup(0);
        processStretchGroup(1);

        if (data['button.enabled'] === false) {
            Object.keys(data).forEach(key => {
                if (key.startsWith('button.') && key !== 'button.enabled') {
                    delete data[key];
                }
            });
            // Explicitly clear action_config sub-properties from data being prepared for setDeep
            const actionConfigPrefix = 'button.action_config.';
            Object.keys(data).forEach(key => {
                if (key.startsWith(actionConfigPrefix)) {
                    delete data[key];
                }
            });
        } else if (data['button.enabled'] === true) {
            // Ensure transform properties are preserved if they exist, or initialized
            if (data['button.hover_transform'] === undefined) data['button.hover_transform'] = this.config.button?.hover_transform || '';
            if (data['button.active_transform'] === undefined) data['button.active_transform'] = this.config.button?.active_transform || '';

            if (!data['button.action_config.type'] || data['button.action_config.type'] === 'none') {
                delete data['button.action_config.service'];
                delete data['button.action_config.service_data'];
                delete data['button.action_config.navigation_path'];
                delete data['button.action_config.url_path'];
                delete data['button.action_config.entity'];
            }
        }
        return data;
    }


    toggleCollapse(): void { this.isCollapsed = !this.isCollapsed; }
    startEditingId(): void {
        this.isEditingId = true;
        this.currentIdInput = this.getBaseId();
        this.idEditErrorMessage = '';
    }
    cancelEditingId(): void {
        this.isEditingId = false;
        this.idEditErrorMessage = '';
    }
    updateIdInput(value: string): void {
        this.currentIdInput = value;
        this.validateIdInput();
    }

    validateIdInput(): boolean {
        const validationResult = LcarsGroup.validateIdentifier(this.currentIdInput, "Element base ID");
        if (!validationResult.isValid) {
            this.idEditErrorMessage = validationResult.error || 'Invalid Element base ID.';
            return false;
        }
        this.idEditErrorMessage = '';
        return true;
    }

    confirmEditId(): { oldId: string, newId: string } | null {
        if (!this.isEditingId || !this.validateIdInput()) return null;
        const newBaseId = this.currentIdInput;
        const oldBaseId = this.getBaseId();
        if (newBaseId === oldBaseId) {
            this.cancelEditingId();
            return null;
        }
        const groupId = this.getGroupId();
        const oldFullId = this.id;
        const newFullId = `${groupId}.${newBaseId}`;
        const result = { oldId: oldFullId, newId: newFullId };
        this.isEditingId = false;
        this.idEditErrorMessage = '';
        return result;
    }

    requestDelete(): { elementId: string } { return { elementId: this.id }; }

    private _isHorizontalDirection(targetAnchorPoint: string): boolean {
        // Check for vertical directions first - if a name contains 'top' or 'bottom', consider it vertical
        if (targetAnchorPoint.includes('top') || targetAnchorPoint.includes('bottom')) {
            return false; // Vertical direction
        }
        
        // Otherwise check for horizontal directions
        return targetAnchorPoint === 'left' || targetAnchorPoint === 'right' || targetAnchorPoint === 'center' ||
               targetAnchorPoint.includes('Left') || targetAnchorPoint.includes('Right') || targetAnchorPoint.includes('Center');
    }

    // --- Static Factory & Registry ---
    public static registerEditorElement(type: string, elementClass: new (config: any) => EditorElement) {
        if (editorElementRegistry[type]) {
            console.warn(`EditorElement type "${type}" is being overwritten.`);
        }
        editorElementRegistry[type] = elementClass;
    }

    public static create(config: any): EditorElement | null {
        const ElementClass = editorElementRegistry[config?.type];
        if (ElementClass) {
            return new ElementClass(config);
        }
        console.warn(`Unknown element type for editor: ${config?.type}`);
        return null;
    }
} 