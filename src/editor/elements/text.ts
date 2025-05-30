import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    TextContent, 
    TextColor,
    FontSize, 
    FontFamily, 
    FontWeight, 
    LetterSpacing, 
    TextAnchor, 
    DominantBaseline, 
    TextTransform,
    CutoutText,
    Fill,
    ButtonEnabled,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
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
                    TextColor,
                    FontSize, 
                    FontFamily, 
                    FontWeight, 
                    LetterSpacing, 
                    TextAnchor, 
                    DominantBaseline, 
                    TextTransform,
                    CutoutText
                ]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('text', Text); 