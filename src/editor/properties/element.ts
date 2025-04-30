// Import necessary property classes and types
import {
    LcarsPropertyBase,
    PropertySchemaContext,
    // Import the shared schema type
    HaFormSchema, 
    Width,
    Height,
    OffsetX,
    OffsetY,
    Fill,
    AnchorTo, 
    StretchTo, 
    ContainerAnchorPoint,
    AnchorPoint, 
    TargetAnchorPoint, 
    TargetStretchAnchorPoint, 
    StretchPaddingX, 
    StretchPaddingY,
    // Props - Text
    TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform,
    // Props - Elbow
    Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, TotalElbowHeight, OuterCornerRadius,
    // Props - Endcap/Chisel
    Direction
} from './properties';

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
        // Initialize input based on current ID (extract base part)
        this.currentIdInput = this.getBaseId(); 
    }

    /** Helper to get the base part of the ID (after the first dot) */
    getBaseId(): string {
        return this.id?.includes('.') ? this.id.substring(this.id.indexOf('.') + 1) : this.id || '';
    }
    /** Helper to get the group part of the ID */
    getGroupId(): string {
        return this.id?.includes('.') ? this.id.split('.')[0] : '__ungrouped__'; // Or handle ungrouped differently
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
        let applicablePropTypes: (new () => LcarsPropertyBase)[] = [];

        // --- Filter logic based on type and config ---

        // Add properties based on the element's required list
        // Basic Layout (always check if required by element)
        const basicLayoutPropTypes = allRequiredPropTypes.filter(cls =>
            [Width, Height, OffsetX, OffsetY].some(commonCls => cls === commonCls)
        );
        applicablePropTypes.push(...basicLayoutPropTypes);
        
        // Common Props (always check if required by element)
        const commonPropTypes = allRequiredPropTypes.filter(cls =>
            [Fill].some(commonCls => cls === commonCls)
        );
        applicablePropTypes.push(...commonPropTypes);

        // Conditional Anchor Logic
        const anchorToType = allRequiredPropTypes.find(cls => cls === AnchorTo);
        const containerAnchorType = allRequiredPropTypes.find(cls => cls === ContainerAnchorPoint);
        const anchorPointType = allRequiredPropTypes.find(cls => cls === AnchorPoint);
        const targetAnchorPointType = allRequiredPropTypes.find(cls => cls === TargetAnchorPoint);

        if (anchorToType) applicablePropTypes.push(anchorToType);
        if (layoutData.anchorTo) {
            if (anchorPointType) applicablePropTypes.push(anchorPointType);
            if (targetAnchorPointType) applicablePropTypes.push(targetAnchorPointType);
        } else {
            if (containerAnchorType) applicablePropTypes.push(containerAnchorType);
        }

        // Conditional Stretch Logic
        const stretchToType = allRequiredPropTypes.find(cls => cls === StretchTo);
        const targetStretchType = allRequiredPropTypes.find(cls => cls === TargetStretchAnchorPoint);
        const stretchPadXType = allRequiredPropTypes.find(cls => cls === StretchPaddingX);
        const stretchPadYType = allRequiredPropTypes.find(cls => cls === StretchPaddingY);

        if (stretchToType) applicablePropTypes.push(stretchToType);
        if (layoutData.stretchTo && targetStretchType) {
            applicablePropTypes.push(targetStretchType);
        }
        if (stretchPadXType) applicablePropTypes.push(stretchPadXType);
        if (stretchPadYType) applicablePropTypes.push(stretchPadYType);

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
            [Direction].some(endcapCls => cls === endcapCls)
        );
        applicablePropTypes.push(...endcapPropTypes);

        // --- Instantiate and get schema ---
        const uniquePropTypes = Array.from(new Set(applicablePropTypes));
        const schema = uniquePropTypes.map(PropClass => {
             try {
                 const instance = new PropClass();
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
            try {
                const instance = new PropClass();
                map.set(instance.name, instance);
            } catch (e) {
                console.error(`Error instantiating property ${PropClass.name}`, e);
            }
        });
        return map;
    }

    // Optional: Method to process data updates (can reuse logic from old LcarsLayout)
    processDataUpdate(newData: any): any {
         let processedData = { ...newData };
        // Add cleanup logic here...
        // This logic depends on the final structure (props vs layout)
        // For now, assume a flat structure matching schema names
        if (processedData.anchorTo && processedData.containerAnchorPoint) {
            delete processedData.containerAnchorPoint;
        }
        if (!processedData.anchorTo && (processedData.anchorPoint || processedData.targetAnchorPoint)) {
            delete processedData.anchorPoint;
            delete processedData.targetAnchorPoint;
        }
        if (!processedData.stretchTo && processedData.targetStretchAnchorPoint) {
            delete processedData.targetStretchAnchorPoint;
        }
        
        // Remove empty/null/undefined values before updating config
        Object.keys(processedData).forEach(key => {
            if (processedData[key] === '' || processedData[key] === null || processedData[key] === undefined) {
                delete processedData[key];
            }
        });
        return processedData;
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
        const baseId = this.currentIdInput.trim();
        if (!baseId) {
            this.idEditErrorMessage = 'Element ID cannot be empty.';
            return false;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(baseId)) {
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
        const newBaseId = this.currentIdInput.trim();
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
}

// --- Specific Element Implementations ---

export class RectangleElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props
            Fill, 
            // Layout
            Width, Height, OffsetX, OffsetY, 
            AnchorTo, StretchTo, ContainerAnchorPoint, AnchorPoint, TargetAnchorPoint, 
            TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY
        ];
    }
}

export class TextElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props
            Fill, TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, 
            TextAnchor, DominantBaseline, TextTransform,
            // Layout (Text elements also need standard layout)
            Width, Height, OffsetX, OffsetY, 
            AnchorTo, StretchTo, ContainerAnchorPoint, AnchorPoint, TargetAnchorPoint, 
            TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY
        ];
    }
}

export class ElbowElement extends LcarsElementBase {
     get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props
            Fill, Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, 
            TotalElbowHeight, OuterCornerRadius,
             // Layout (Elbows generally don't use width/height directly, but need positioning)
            OffsetX, OffsetY, 
            AnchorTo, StretchTo, ContainerAnchorPoint, AnchorPoint, TargetAnchorPoint, 
            TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY
            // Note: Width/Height might be needed if we allow stretching elbows?
        ];
    }
}

export class EndcapElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props
            Fill, Direction,
            // Layout 
            Width, Height, OffsetX, OffsetY, 
            AnchorTo, StretchTo, ContainerAnchorPoint, AnchorPoint, TargetAnchorPoint, 
            TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY
        ];
    }
}

// Assuming ChiselEndcap is the same as Endcap for now regarding properties
// If it differs, create a separate class
export class ChiselEndcapElement extends EndcapElement { 
    // Inherits requiredProperties from EndcapElement
    // Override if needed
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