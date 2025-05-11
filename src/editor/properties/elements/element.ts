import {
    Type, Fill, OffsetX, OffsetY,
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    StretchTarget, StretchDirection, StretchPadding,
    ButtonEnabled, ButtonText, ButtonCutoutText,
    ButtonTextColor, ButtonFontFamily, ButtonFontSize, ButtonFontWeight, ButtonLetterSpacing, ButtonTextTransform,
    ButtonTextAnchor, ButtonDominantBaseline,
    ButtonHoverFill, ButtonActiveFill,
    ButtonHoverTransform, ButtonActiveTransform,
    ButtonActionType, ButtonActionService, ButtonActionServiceData,
    ButtonActionNavigationPath, ButtonActionUrlPath, ButtonActionEntity, ButtonActionConfirmation,
    PropertySchemaContext, HaFormSchema, LcarsPropertyBase
} from '../properties';
import { LcarsGroup } from '../../group';

export type PropertyClass = new () => LcarsPropertyBase;
export type PropertyClassOrFactory = (new () => LcarsPropertyBase) | (() => LcarsPropertyBase);

const editorElementRegistry: Record<string, new (config: any) => EditorElement> = {};

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

    /**
     * Properties common to ALL elements, managed by the base class.
     * Includes essential identification, basic layout, and all potential button properties.
     */
    get commonProperties(): PropertyClass[] {
        return [
            Type, Fill, OffsetX, OffsetY,
            ButtonEnabled, ButtonText, ButtonCutoutText,
            ButtonTextColor, ButtonFontFamily, ButtonFontSize, ButtonFontWeight,
            ButtonLetterSpacing, ButtonTextTransform, ButtonTextAnchor, ButtonDominantBaseline,
            ButtonHoverFill, ButtonActiveFill,
            ButtonHoverTransform, ButtonActiveTransform,
            ButtonActionType, ButtonActionService, ButtonActionServiceData,
            ButtonActionNavigationPath, ButtonActionUrlPath, ButtonActionEntity, ButtonActionConfirmation,
            AnchorTo, AnchorPoint, TargetAnchorPoint,
        ];
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


    /**
     * Defines property classes specific to THIS element type (e.g., Width/Height for Rectangle, TextContent for Text).
     * To be implemented by subclasses.
     */
    abstract get specificProperties(): PropertyClass[];


    getSchema(context?: PropertySchemaContext): HaFormSchema[] {
        const layoutData = this.config.layout || {};
        const propsData = this.config.props || {};
        const buttonData = this.config.button || {};
        const fullContext = { ...context, layoutData, propsData, buttonData };

        const allPropTypes: PropertyClassOrFactory[] = [
            ...this.commonProperties,
            ...this.specificProperties,
            ...this.stretchPropertyFactories
        ];

        let applicablePropTypes: PropertyClassOrFactory[] = [];

        const typeProperty = allPropTypes.find(clsOrFactory => {
            const name = (typeof clsOrFactory === 'function' && clsOrFactory.prototype) ? (clsOrFactory as any).name : 'factory';
            return name === Type.name || (clsOrFactory instanceof Function && new (clsOrFactory as any)() instanceof Type);
        });

        if (typeProperty) applicablePropTypes.push(typeProperty);

        applicablePropTypes.push(...this.commonProperties.filter(cls =>
            [Fill, OffsetX, OffsetY, AnchorTo].some(commonCls => cls === commonCls)
        ));
        
        applicablePropTypes.push(...this.specificProperties);

        if (layoutData.anchor?.anchorTo && layoutData.anchor.anchorTo !== '') {
            const anchorPointProp = this.commonProperties.find(cls => cls === AnchorPoint);
            const targetAnchorPointProp = this.commonProperties.find(cls => cls === TargetAnchorPoint);
            if (anchorPointProp) applicablePropTypes.push(anchorPointProp);
            if (targetAnchorPointProp) applicablePropTypes.push(targetAnchorPointProp);
        }
        
        const stretchFactories = this.stretchPropertyFactories;
        applicablePropTypes.push(stretchFactories[0]);

        const firstStretchValue = layoutData?.stretch?.stretchTo1;
        const secondStretchValue = layoutData?.stretch?.stretchTo2;

        if ((firstStretchValue && firstStretchValue !== '') || (secondStretchValue && secondStretchValue !== '')) {
            if (firstStretchValue && firstStretchValue !== '') {
                applicablePropTypes.push(stretchFactories[1]);
                applicablePropTypes.push(stretchFactories[2]);
            }
            applicablePropTypes.push(stretchFactories[3]);
            if (secondStretchValue && secondStretchValue !== '') {
                applicablePropTypes.push(stretchFactories[4]);
                applicablePropTypes.push(stretchFactories[5]);
            }
        }

        const buttonEnabledProp = this.commonProperties.find(cls => cls === ButtonEnabled);
        if (buttonEnabledProp) {
            applicablePropTypes.push(buttonEnabledProp);
        }

        if (this.config.button?.enabled) {
            const buttonDetailPropTypes = this.commonProperties.filter(cls =>
                [
                    ButtonText, ButtonCutoutText, ButtonTextColor, ButtonFontFamily, ButtonFontSize, ButtonFontWeight,
                    ButtonLetterSpacing, ButtonTextTransform, ButtonTextAnchor, ButtonDominantBaseline,
                    ButtonHoverFill, ButtonActiveFill, ButtonActionType,
                    ButtonHoverTransform, ButtonActiveTransform
                ].some(btnCls => cls === btnCls)
            );
            applicablePropTypes.push(...buttonDetailPropTypes);

            const actionType = this.config.button?.action_config?.type;
            if (actionType) {
                const actionServiceProp = this.commonProperties.find(cls => cls === ButtonActionService);
                const actionServiceDataProp = this.commonProperties.find(cls => cls === ButtonActionServiceData);
                const actionNavPathProp = this.commonProperties.find(cls => cls === ButtonActionNavigationPath);
                const actionUrlPathProp = this.commonProperties.find(cls => cls === ButtonActionUrlPath);
                const actionEntityProp = this.commonProperties.find(cls => cls === ButtonActionEntity);
                const actionConfirmProp = this.commonProperties.find(cls => cls === ButtonActionConfirmation);

                if (actionType === 'call-service') {
                    if (actionServiceProp) applicablePropTypes.push(actionServiceProp);
                    if (actionServiceDataProp) applicablePropTypes.push(actionServiceDataProp);
                } else if (actionType === 'navigate') {
                    if (actionNavPathProp) applicablePropTypes.push(actionNavPathProp);
                } else if (actionType === 'url') {
                    if (actionUrlPathProp) applicablePropTypes.push(actionUrlPathProp);
                } else if (actionType === 'toggle' || actionType === 'more-info') {
                    if (actionEntityProp) applicablePropTypes.push(actionEntityProp);
                }
                if (actionType !== 'none' && actionConfirmProp) {
                    applicablePropTypes.push(actionConfirmProp);
                }
            }
        }
        // --- End Conditional Button Properties ---

        const uniquePropTypes = Array.from(new Set(applicablePropTypes)); // Ensure uniqueness

        const schema = uniquePropTypes.map(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                // Check if it's a class constructor or a factory function
                if (PropClassOrFactory.prototype && typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
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
        const allPropTypes: PropertyClassOrFactory[] = [
            ...this.commonProperties,
            ...this.specificProperties,
            ...this.stretchPropertyFactories,
        ];

        allPropTypes.forEach(PropClassOrFactory => {
            try {
                let instance: LcarsPropertyBase;
                if (PropClassOrFactory.prototype && typeof PropClassOrFactory.prototype.getSchema === 'function') {
                    instance = new (PropClassOrFactory as new () => LcarsPropertyBase)();
                } else {
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