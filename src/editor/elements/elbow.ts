import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    Orientation, 
    Width, 
    Height,
    BodyWidth, 
    ArmHeight, 
    ElbowTextPosition,
    Fill,
    ButtonEnabled,
    OffsetX,
    OffsetY,
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
    ButtonText
} from '../properties/properties';

export class Elbow extends EditorElement {
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
                    ButtonActionType,
                    ElbowTextPosition
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height, BodyWidth, ArmHeight]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Orientation]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            }
        };
    }
}
EditorElement.registerEditorElement('elbow', Elbow); 