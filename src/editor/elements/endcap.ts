import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    ButtonActiveTransform,
    ButtonCutoutText,
    ButtonEnabled,
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
    ButtonActionType,
    ButtonTextColor,
    ButtonText,
    Direction, 
    Width, 
    Height,
    Fill,
    OffsetX,
    OffsetY
} from '../properties/properties';

export class Endcap extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Direction]
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
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('endcap', Endcap);