// Import necessary property classes and types
import {
    // Core Props
    Width, Height, OffsetX, OffsetY, 
    // Anchor Props
    AnchorTo, AnchorPoint, TargetAnchorPoint,
    // New Stretch Props - using the proper consolidated classes
    StretchTarget, StretchDirection, StretchPadding,
    // Text Props
    TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform,
    // Elbow Props
    Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, TotalElbowHeight, OuterCornerRadius,
    // Endcap Props
    Direction, Side,
    // Props - Type
    Type,
    // Standard Props 
    Fill,
    // Property Schema Context
    PropertySchemaContext,
    // Schema type
    HaFormSchema,
    // Base interface
    LcarsPropertyBase
} from './properties.js';

// Type for property classes
export type PropertyClass = new () => LcarsPropertyBase;

// Base Element Interface/Class
export abstract class LcarsElementBase {
    id: string;
    type: string;
    config: any; // Store the raw element config

    // --- UI State Properties --- 
    isCollapsed: boolean = true;
    isEditingId: boolean = false;
    currentIdInput: string = ''; // Stores only the base part of the ID during edit
    idEditErrorMessage: string = '';

    constructor(config: any) {
        this.id = config.id;
        this.type = config.type;
        this.config = config; 
        
        // Ensure layout and stretch objects are initialized
        if (!this.config.layout) {
            this.config.layout = {};
        }
        if (!this.config.layout.stretch) {
            this.config.layout.stretch = {};
        }
        
        // Initialize input based on current ID (extract base part)
        this.currentIdInput = this.getBaseId(); 
    }

    /** Helper to get the base part of the ID (after the first dot) */
    getBaseId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[1] : this.id || '';
    }
    /** Helper to get the group part of the ID */
    getGroupId(): string {
        const parts = this.id.split('.');
        return parts.length > 1 ? parts[0] : '__ungrouped__'; // Or handle ungrouped differently
    }

    // --- Abstract methods/properties to be implemented by subclasses --- 

    /** Defines ALL property classes used by this element type */
    abstract get requiredProperties(): (new () => LcarsPropertyBase)[];

    // --- Schema Generation Method --- 

    /** 
     * Generates the full schema for the element's editor form.
     * Incorporates logic for conditional fields based on current config.
     */
    getSchema(context?: PropertySchemaContext): HaFormSchema[] {
        const layoutData = this.config.layout || {};
        const propsData = this.config.props || {}; // Also get props data if needed for conditions
        const fullContext = { ...context, layoutData, propsData }; 

        const allRequiredPropTypes = this.requiredProperties;
        let applicablePropTypes: Array<(new () => LcarsPropertyBase) | (() => LcarsPropertyBase)> = [];

        // --- Filter logic based on type and config ---
        
        // Always add Type if it's in required properties
        const typeProperty = allRequiredPropTypes.find(cls => cls === Type);
        if (typeProperty) applicablePropTypes.push(typeProperty);

        // Add basic layout properties
        const basicLayoutPropTypes = allRequiredPropTypes.filter(cls =>
            [Width, Height, OffsetX, OffsetY].some(commonCls => cls === commonCls)
        );
        applicablePropTypes.push(...basicLayoutPropTypes);
        
        // Add common properties
        const commonPropTypes = allRequiredPropTypes.filter(cls =>
            [Fill].some(commonCls => cls === commonCls)
        );
        applicablePropTypes.push(...commonPropTypes);

        // Anchor properties
        const anchorToType = allRequiredPropTypes.find(cls => cls === AnchorTo);
        const anchorPointType = allRequiredPropTypes.find(cls => cls === AnchorPoint);
        const targetAnchorPointType = allRequiredPropTypes.find(cls => cls === TargetAnchorPoint);

        if (anchorToType) applicablePropTypes.push(anchorToType);
        
        // Only include anchor points if anchoring to something
        if (layoutData.anchor?.anchorTo && layoutData.anchor.anchorTo !== '') {
            if (anchorPointType) applicablePropTypes.push(anchorPointType);
            if (targetAnchorPointType) applicablePropTypes.push(targetAnchorPointType);
        }

        // --- Stretch Properties Logic ---
        
        // Helper to get stretch value
        const getStretchValue = (index: number): string | undefined => {
            const suffix = index === 0 ? '1' : '2';
            // Check for the stretch value in the layout data
            const stretchValue = layoutData?.stretch?.[`stretchTo${suffix}`];
            return stretchValue;
        };
        
        // Always add the first stretch target dropdown
        const firstStretchTarget = new StretchTarget(0);
        applicablePropTypes.push(() => firstStretchTarget);
        
        // Check if first stretch target has been selected
        const firstStretchValue = getStretchValue(0);
        
        // Check if second stretch has a value even if first doesn't
        // This handles the case where stretchTo2 might exist but stretchTo1 doesn't
        const secondStretchValue = getStretchValue(1);
        const secondHasValue = secondStretchValue && secondStretchValue !== '';
        
        if ((firstStretchValue && firstStretchValue !== '') || secondHasValue) {
            // Add direction select and padding controls when a target is chosen
            if (firstStretchValue && firstStretchValue !== '') {
                applicablePropTypes.push(() => new StretchDirection(0));
                applicablePropTypes.push(() => new StretchPadding(0));
            }
            
            // Always add second stretch target dropdown when first has a value or second already has a value
            const secondStretchTarget = new StretchTarget(1);
            applicablePropTypes.push(() => secondStretchTarget);
            
            if (secondHasValue) {
                // Add second direction and padding controls
                applicablePropTypes.push(() => new StretchDirection(1));
                applicablePropTypes.push(() => new StretchPadding(1));
            }
        }
        
        // Add Text properties if required by element type
        const textPropTypes = allRequiredPropTypes.filter(cls => 
            [TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform].some(textCls => cls === textCls)
        );
        applicablePropTypes.push(...textPropTypes);

        // Add Elbow properties if required by element type
        const elbowPropTypes = allRequiredPropTypes.filter(cls => 
            [Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, TotalElbowHeight, OuterCornerRadius].some(elbowCls => cls === elbowCls)
        );
        applicablePropTypes.push(...elbowPropTypes);
        
        // Add Endcap/Chisel properties if required by element type
        const endcapPropTypes = allRequiredPropTypes.filter(cls => 
            [Direction, Side].some(endcapCls => cls === endcapCls)
        );
        applicablePropTypes.push(...endcapPropTypes);
        
        // --- Instantiate and get schema ---
        const uniquePropTypes = Array.from(new Set(applicablePropTypes));
        const schema = uniquePropTypes.map(PropClass => {
             try {
                 const instance = typeof PropClass === 'function' ? 
                     (PropClass.prototype ? new (PropClass as new () => LcarsPropertyBase)() : (PropClass as () => LcarsPropertyBase)()) : 
                     PropClass;
                 return instance.getSchema(fullContext);
             } catch (e) {
                 console.error(`Error instantiating or getting schema for ${PropClass.name}`, e);
                 return null;
             }
        }).filter((item): item is HaFormSchema => item !== null);

        return schema;
    }

    /** Helper method to get a map of property names to their class instances */
    getPropertiesMap(): Map<string, LcarsPropertyBase> {
        const map = new Map<string, LcarsPropertyBase>();
        this.requiredProperties.forEach(PropClass => {
            // Skip stretch classes here, handle them explicitly below
            if ([StretchTarget, StretchDirection, StretchPadding].includes(PropClass as any)) {
                return;
            }
            try {
                const instance = new PropClass();
                map.set(instance.name, instance);
            } catch (e) {
                console.error(`Error instantiating property ${PropClass.name}`, e);
            }
        });

        // Explicitly add both sets of stretch properties
        [0, 1].forEach(index => {
            const target = new StretchTarget(index);
            const direction = new StretchDirection(index);
            const padding = new StretchPadding(index);
            map.set(target.name, target);
            map.set(direction.name, direction);
            map.set(padding.name, padding);
        });

        return map;
    }

    /** 
     * Gets a flattened data object suitable for ha-form's data property.
     * Reads values from the nested config using configPath and keys by property name.
     */
    getFormData(): Record<string, any> {
        const formData: Record<string, any> = {};
        const propertiesMap = this.getPropertiesMap(); // Now includes both stretch sets
        const layoutData = this.config.layout || {};
        
        // Helper function to get nested property value
        const getDeepValue = (obj: any, parts: string[]): any => {
            let current = obj;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        };

        // First collect property values
        propertiesMap.forEach((propInstance, propName) => {
            let value: any;

            // Use the standard path for all properties, including stretch now
            const pathParts = propInstance.configPath.split('.');
            value = getDeepValue(this.config, pathParts);

            // Apply formatting if needed
            if (propInstance.formatValueForForm) {
                value = propInstance.formatValueForForm(value);
            }

            // Special default for stretchTo targets if value is undefined
            if (propInstance instanceof StretchTarget && value === undefined) {
                value = '';
            }

            // For other properties, only add if value is not undefined
            if (value !== undefined) {
                formData[propInstance.name] = value;
            }
        });
        
        return formData;
    }

    /** 
     * Process data updates for an element. 
     * Handles special cases for anchor properties and cleanup.
     */
    processDataUpdate(newData: any): any {
        let data = { ...newData }; // Work on a copy

        // --- 1. Handle Anchor Cleanup ---
        if (!data.anchorTo || data.anchorTo === '') {
            delete data.anchorPoint;
            delete data.targetAnchorPoint;
        } else {
            // Set defaults if needed when anchorTo is present
            if (!data.anchorPoint) data.anchorPoint = 'center';
            if (!data.targetAnchorPoint) data.targetAnchorPoint = 'center';
        }

        // --- 2. Initialize layout structure if needed ---
        if (!data.layout) data.layout = {};
        if (!data.layout.stretch) data.layout.stretch = {};

        // --- 3. Handle Stretch Properties ---
        const processStretchGroup = (index: number) => {
            const suffix = index === 0 ? '1' : '2';
            const stretchToName = `stretchTo${suffix}`;
            const directionName = `stretchDirection${suffix}`;
            const paddingName = `stretchPadding${suffix}`;

            // Get values from form data
            const stretchToValue = data[stretchToName];
            const directionValue = data[directionName];
            const paddingValue = data[paddingName];

            // If stretch target is cleared or missing, remove related config properties
            if (!stretchToValue || stretchToValue === '') {
                // Clear configuration
                delete data.layout.stretch[`stretchTo${suffix}`];
                delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                delete data.layout.stretch[`stretchAxis${suffix}`];
                delete data.layout.stretch[`stretchPadding${suffix}`];
                
                // Also ensure related form fields are explicitly cleared if target is gone
                delete data[directionName];
                delete data[paddingName];

            } else {
                // Update configuration according to the specified structure
                data.layout.stretch[`stretchTo${suffix}`] = stretchToValue;
                
                if (directionValue) {
                    data.layout.stretch[`targetStretchAnchorPoint${suffix}`] = directionValue;
                    const isHorizontal = this._isHorizontalDirection(directionValue);
                    data.layout.stretch[`stretchAxis${suffix}`] = isHorizontal ? 'X' : 'Y';
                    
                    // Handle padding
                    data.layout.stretch[`stretchPadding${suffix}`] = paddingValue ?? 0; // Use nullish coalescing

                } else {
                    // If direction is cleared but target exists, clear related config properties
                    delete data.layout.stretch[`targetStretchAnchorPoint${suffix}`];
                    delete data.layout.stretch[`stretchAxis${suffix}`];
                    delete data.layout.stretch[`stretchPadding${suffix}`];
                    
                    // Explicitly clear related form fields as well
                    delete data[directionName];
                    delete data[paddingName];
                }
            }
        };

        // Check directly for stretchTo2 in the form data and ensure it's processed
        if ('stretchTo2' in data && data.stretchTo2 !== '') {
            // Make sure it's set in the layout.stretch object
            data.layout.stretch.stretchTo2 = data.stretchTo2;
        }

        processStretchGroup(0); // Process first stretch group
        processStretchGroup(1); // Process second stretch group

        return data;
    }

    // --- UI State Management Methods ---
    toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;
        // Note: Trigger re-render in main editor
    }

    startEditingId(): void {
        this.isEditingId = true;
        this.currentIdInput = this.getBaseId(); // Reset to current base ID
        this.idEditErrorMessage = '';
        // Note: Trigger re-render & potentially focus
    }

    cancelEditingId(): void {
        this.isEditingId = false;
        this.idEditErrorMessage = '';
        // Note: Trigger re-render
    }

    updateIdInput(value: string): void {
        this.currentIdInput = value;
        this.validateIdInput(); // Validate on change
        // Note: Trigger re-render
    }

    validateIdInput(): boolean {
        // Check for empty string after trimming
        const trimmed = this.currentIdInput.trim();
        if (!trimmed) {
            this.idEditErrorMessage = 'Element ID cannot be empty.';
            return false;
        }
        
        // Check if the original input contains spaces (different from trimmed length)
        if (this.currentIdInput !== trimmed) {
            this.idEditErrorMessage = 'Element ID cannot contain spaces.';
            return false;
        }
        
        // Check for valid characters
        if (!/^[a-zA-Z0-9_-]+$/.test(this.currentIdInput)) {
            this.idEditErrorMessage = 'Element ID must be letters, numbers, _, -.';
            return false;
        }
        
        // Duplicate check needs context (all elements in the group) - best handled by main editor
        this.idEditErrorMessage = '';
        return true;
    }

    // --- Methods Requiring Interaction with Main Editor --- 

    /** Placeholder: Signals intent to finalize ID change */
    confirmEditId(): { oldId: string, newId: string } | null {
        if (!this.isEditingId || !this.validateIdInput()) {
            return null; 
        }
        // Use the current input without trimming since validateIdInput already checks for spaces
        const newBaseId = this.currentIdInput;
        const oldBaseId = this.getBaseId();

        if (newBaseId === oldBaseId) { // No change
            this.cancelEditingId();
            return null;
        }

        const groupId = this.getGroupId();
        const oldFullId = this.id; // Preserve the full original ID
        const newFullId = `${groupId}.${newBaseId}`;
        
        // Return info for main editor to handle update & check for conflicts
        const result = { oldId: oldFullId, newId: newFullId };
        
        // Update instance state
        this.isEditingId = false; // Reset state locally
        // Don't update this.id here - let the editor handle that after checking for conflicts
        this.idEditErrorMessage = '';
        
        return result;
    }

    /** Placeholder: Signals intent to delete the element */
    requestDelete(): { elementId: string } {
        // Just return the ID to be deleted
        return { elementId: this.id };
        // Main editor handles config update & re-render
    }

    /**
     * Helper to determine if a direction is horizontal or vertical
     */
    private _isHorizontalDirection(targetAnchorPoint: string): boolean {
        return targetAnchorPoint === 'left' || 
               targetAnchorPoint === 'right' || 
               targetAnchorPoint === 'center' ||
               targetAnchorPoint.includes('Left') || 
               targetAnchorPoint.includes('Right') ||
               targetAnchorPoint.includes('Center');
    }
}

// --- Specific Element Implementations ---

export class RectangleElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Core properties
            Type, Width, Height, OffsetX, OffsetY, Fill,
            // Anchor properties
            AnchorTo, AnchorPoint, TargetAnchorPoint,
            // Stretch properties - using new consolidated classes
            StretchTarget, StretchDirection, StretchPadding,
        ];
    }
}

export class TextElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Core properties
            Type, Width, Height, OffsetX, OffsetY, Fill,
            // Anchor properties
            AnchorTo, AnchorPoint, TargetAnchorPoint,
            // Stretch properties - using new consolidated classes
            StretchTarget, StretchDirection, StretchPadding,
            // Text properties
            TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform
        ];
    }
}

export class ElbowElement extends LcarsElementBase {
     get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Core properties
            Type, Width, Height, OffsetX, OffsetY, Fill,
            // Anchor properties
            AnchorTo, AnchorPoint, TargetAnchorPoint,
            // Stretch properties - using new consolidated classes
            StretchTarget, StretchDirection, StretchPadding,
            // Elbow-specific properties
            Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, TotalElbowHeight, OuterCornerRadius
        ];
    }
}

export class EndcapElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Core properties
            Type, Width, Height, OffsetX, OffsetY, Fill,
            // Anchor properties
            AnchorTo, AnchorPoint, TargetAnchorPoint,
            // Stretch properties - using new consolidated classes
            StretchTarget, StretchDirection, StretchPadding,
            // Endcap-specific properties
            Direction
        ];
    }
}

export class ChiselEndcapElement extends LcarsElementBase { 
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Core properties
            Type, Width, Height, OffsetX, OffsetY, Fill,
            // Anchor properties
            AnchorTo, AnchorPoint, TargetAnchorPoint,
            // Stretch properties - using new consolidated classes
            StretchTarget, StretchDirection, StretchPadding,
            // Chisel-specific properties
            Direction, Side
        ];
    }
}

// --- Factory Function (Example) ---

// Map element type strings to class constructors
const elementRegistry: Record<string, new (config: any) => LcarsElementBase> = {
    rectangle: RectangleElement,
    text: TextElement, 
    elbow: ElbowElement,
    endcap: EndcapElement,
    'chisel-endcap': ChiselEndcapElement, // Use quotes for hyphenated name
};

/**
 * Creates an instance of the appropriate LcarsElementBase subclass based on the config type.
 */
export function createElementInstance(config: any): LcarsElementBase | null {
    const ElementClass = elementRegistry[config?.type];
    if (ElementClass) {
        return new ElementClass(config);
    }
    console.warn(`Unknown element type: ${config?.type}`);
    return null;
} 