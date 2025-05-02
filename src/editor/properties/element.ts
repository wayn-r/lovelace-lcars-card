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
    StretchTo2,
    ContainerAnchorPoint,
    AnchorPoint, 
    TargetAnchorPoint, 
    TargetStretchAnchorPoint,
    TargetStretchAnchorPoint2,
    StretchPaddingX, 
    StretchPaddingY,
    // Props - Text
    TextContent, FontSize, FontFamily, FontWeight, LetterSpacing, TextAnchor, DominantBaseline, TextTransform,
    // Props - Elbow
    Orientation, HorizontalWidth, VerticalWidth, HeaderHeight, TotalElbowHeight, OuterCornerRadius,
    // Props - Endcap/Chisel
    Direction, Side,
    // Props - Type
    Type
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
        
        // Always add Type if it's in required properties
        const typeProperty = allRequiredPropTypes.find(cls => cls === Type);
        if (typeProperty) applicablePropTypes.push(typeProperty);

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

        // Conditional Anchor Logic - Always include AnchorTo if required
        const anchorToType = allRequiredPropTypes.find(cls => cls === AnchorTo);
        const containerAnchorType = allRequiredPropTypes.find(cls => cls === ContainerAnchorPoint);
        const anchorPointType = allRequiredPropTypes.find(cls => cls === AnchorPoint);
        const targetAnchorPointType = allRequiredPropTypes.find(cls => cls === TargetAnchorPoint);

        if (anchorToType) applicablePropTypes.push(anchorToType);
        
        // Only include anchor points if anchoring to something specific
        if (layoutData.anchorTo && layoutData.anchorTo !== '') {
            // Always use the same anchor points regardless of target type
            if (anchorPointType) applicablePropTypes.push(anchorPointType);
            if (targetAnchorPointType) applicablePropTypes.push(targetAnchorPointType);
        } else {
            // Include container anchor point when not anchoring to a specific element
            if (containerAnchorType) applicablePropTypes.push(containerAnchorType);
        }

        // Conditional Stretch Logic - Always include StretchTo if required
        const stretchToType = allRequiredPropTypes.find(cls => cls === StretchTo);
        const targetStretchType = allRequiredPropTypes.find(cls => cls === TargetStretchAnchorPoint);
        const stretchPadXType = allRequiredPropTypes.find(cls => cls === StretchPaddingX);
        const stretchTo2Type = allRequiredPropTypes.find(cls => cls === StretchTo2);
        const targetStretchType2 = allRequiredPropTypes.find(cls => cls === TargetStretchAnchorPoint2);

        if (stretchToType) applicablePropTypes.push(stretchToType);
        
        // Only include stretch target and padding if stretching to something
        if (layoutData.stretchTo && layoutData.stretchTo !== '') {
            // Include target stretch selector when stretching to something
            if (targetStretchType) applicablePropTypes.push(targetStretchType);
            
            // Include stretch padding when stretching to something 
            // We'll only use StretchPaddingX for the UI (as requested)
            if (stretchPadXType) applicablePropTypes.push(stretchPadXType);
            
            // Include a second stretch target option if the first is already selected
            if (stretchTo2Type) applicablePropTypes.push(stretchTo2Type);
            
            // If second stretch target is selected, include its target point selector
            if (layoutData.stretchTo2 && layoutData.stretchTo2 !== '' && targetStretchType2) {
                applicablePropTypes.push(targetStretchType2);
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

    /** 
     * Process data updates for an element. 
     * Handles special cases for stretch and anchor properties.
     */
    processDataUpdate(newData: any): any {
        let processedData = { ...newData };
        
        // Handle anchor points
        if (processedData.anchorTo && processedData.anchorTo !== '') {
            // If anchoring to something but no anchor points are specified, set defaults
            if (!processedData.anchorPoint) {
                processedData.anchorPoint = 'center';
            }
            if (!processedData.targetAnchorPoint) {
                processedData.targetAnchorPoint = 'center';
            }
            
            // Remove containerAnchorPoint since we're using regular anchor points
            if (processedData.containerAnchorPoint) {
                delete processedData.containerAnchorPoint;
            }
        } else {
            // If not anchoring to anything, remove all anchor points
            if (processedData.anchorPoint) delete processedData.anchorPoint;
            if (processedData.targetAnchorPoint) delete processedData.targetAnchorPoint;
            if (processedData.containerAnchorPoint) delete processedData.containerAnchorPoint;
        }
        
        // Handle stretching
        if (processedData.stretchTo && processedData.stretchTo !== '') {
            // If stretching to something but no target point is specified, set a default
            if (!processedData.targetStretchAnchorPoint) {
                processedData.targetStretchAnchorPoint = 'right';
            }
            
            // When stretchPaddingX is set, also apply to stretchPaddingY for consistency
            if ('stretchPaddingX' in processedData) {
                processedData.stretchPaddingY = processedData.stretchPaddingX;
            }
            
            // Handle the second stretch to option if present
            if (processedData.stretchTo2 && processedData.stretchTo2 !== '') {
                // If second stretch is set, ensure we have a default target point for it
                if (!processedData.targetStretchAnchorPoint2) {
                    processedData.targetStretchAnchorPoint2 = 'right';
                }
            } else {
                // Clean up second stretch properties if not used
                if (processedData.targetStretchAnchorPoint2) {
                    delete processedData.targetStretchAnchorPoint2;
                }
            }
        } else {
            // If not stretching to anything, clean up related properties
            if (processedData.targetStretchAnchorPoint) {
                delete processedData.targetStretchAnchorPoint;
            }
            if (processedData.stretchPaddingX) {
                delete processedData.stretchPaddingX;
            }
            if (processedData.stretchPaddingY) {
                delete processedData.stretchPaddingY;
            }
            // Also clean up second stretch properties
            if (processedData.stretchTo2) {
                delete processedData.stretchTo2;
            }
            if (processedData.targetStretchAnchorPoint2) {
                delete processedData.targetStretchAnchorPoint2;
            }
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
            // Props - in the order specified in TODO.md
            Type, // Add Type property
            Fill, 
            Width, Height,
            // Anchor options
            AnchorTo, AnchorPoint, TargetAnchorPoint, ContainerAnchorPoint,
            // Stretch options
            StretchTo, TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY,
            StretchTo2, TargetStretchAnchorPoint2,
            // Offset at the end as specified in TODO.md
            OffsetX, OffsetY
        ];
    }
}

export class TextElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props - in the order specified in TODO.md
            Type, // Add Type property
            TextContent, Fill,
            FontFamily, FontSize,
            FontWeight, LetterSpacing,
            TextAnchor, DominantBaseline,
            TextTransform,
            // Anchor options
            AnchorTo, AnchorPoint, TargetAnchorPoint, ContainerAnchorPoint,
            // Stretch options
            StretchTo, TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY,
            StretchTo2, TargetStretchAnchorPoint2,
            // Offset at the end as specified in TODO.md
            OffsetX, OffsetY
            // Removed Width, Height as per TODO requirements
        ];
    }
}

export class ElbowElement extends LcarsElementBase {
     get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props - in the order specified in TODO.md
            Type, // Add Type property
            Fill, Orientation, Side, // Add Side property
            HorizontalWidth, VerticalWidth, 
            HeaderHeight, TotalElbowHeight,
            OuterCornerRadius,
            // Anchor options
            AnchorTo, AnchorPoint, TargetAnchorPoint, ContainerAnchorPoint,
            // Stretch options
            StretchTo, TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY,
            StretchTo2, TargetStretchAnchorPoint2,
            // Offset at the end as specified in TODO.md
            OffsetX, OffsetY
        ];
    }
}

export class EndcapElement extends LcarsElementBase {
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props - in the order specified in TODO.md
            Type, // Add Type property 
            Fill, Direction,
            // Layout 
            Width, Height,
            // Anchor options from base class
            AnchorTo, AnchorPoint, TargetAnchorPoint, ContainerAnchorPoint,
            // Stretch options from base class
            StretchTo, TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY,
            StretchTo2, TargetStretchAnchorPoint2,
            // Offset at the end as specified in TODO.md
            OffsetX, OffsetY
        ];
    }
}

export class ChiselEndcapElement extends LcarsElementBase { 
    get requiredProperties(): (new () => LcarsPropertyBase)[] {
        return [
            // Props - in the order specified in TODO.md
            Type, // Add Type property
            Fill, Direction,
            // Layout 
            Width, Height,
            // Anchor options
            AnchorTo, AnchorPoint, TargetAnchorPoint, ContainerAnchorPoint,
            // Stretch options
            StretchTo, TargetStretchAnchorPoint, StretchPaddingX, StretchPaddingY,
            StretchTo2, TargetStretchAnchorPoint2,
            // Offset at the end as specified in TODO.md
            OffsetX, OffsetY
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