import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    TextContent, 
    FontSize, 
    FontFamily, 
    FontWeight, 
    LetterSpacing, 
    TextAnchor, 
    DominantBaseline, 
    TextTransform,
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
    OffsetY,
    Height,
    Width
} from '../properties/properties';

export class Text extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.ANCHOR]: {
                properties: []
            },
            [PropertyGroup.STRETCH]: {
                properties: []
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Height, Width]
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
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill]
            },
            [PropertyGroup.TEXT]: {
                properties: [
                    TextContent,
                    FontSize, 
                    FontFamily, 
                    FontWeight, 
                    LetterSpacing, 
                    TextAnchor, 
                    DominantBaseline, 
                    TextTransform
                ]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('text', Text); 