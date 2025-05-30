import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    ButtonActiveTransform,
    ButtonEnabled,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActionType,
    Direction, 
    Width, 
    Height,
    Fill,
    OffsetX,
    OffsetY,
    TextContent,
    TextColor,
    FontFamily,
    FontSize,
    FontWeight,
    LetterSpacing,
    TextTransform,
    TextAnchor,
    DominantBaseline,
    CutoutText
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
            [PropertyGroup.TEXT]: {
                properties: [
                    TextContent,
                    TextColor,
                    FontFamily,
                    FontSize,
                    FontWeight,
                    LetterSpacing,
                    TextTransform,
                    TextAnchor,
                    DominantBaseline,
                    CutoutText
                ]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}
EditorElement.registerEditorElement('endcap', Endcap);