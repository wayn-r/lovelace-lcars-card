import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    Direction, 
    Width, 
    Height,
    Fill,
    ButtonEnabled,
    ButtonCutoutText,
    ButtonTextColor,
    ButtonFontFamily,
    ButtonFontSize,
    ButtonFontWeight,
    ButtonLetterSpacing,
    ButtonTextTransform,
    ButtonTextAnchor,
    ButtonDominantBaseline,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    ButtonText,
    OffsetX,
    OffsetY
} from '../properties/properties';

export class ChiselEndcap extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.BUTTON]: {
                properties: [
                    ButtonEnabled, 
                    ButtonText, 
                    ButtonCutoutText, 
                    ButtonTextColor,
                    ButtonFontFamily, 
                    ButtonFontSize, 
                    ButtonFontWeight,
                    ButtonLetterSpacing,
                    ButtonTextTransform,
                    ButtonTextAnchor,
                    ButtonDominantBaseline,
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Direction]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('chisel-endcap', ChiselEndcap);