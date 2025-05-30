import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    Direction, 
    Width, 
    Height,
    Fill,
    ButtonEnabled,
    OffsetX,
    OffsetY,
    ButtonHoverFill,
    ButtonActiveFill,
    ButtonHoverTransform,
    ButtonActiveTransform,
    ButtonActionType,
    TextContent,
    TextColor,
    FontFamily,
    FontSize,
    FontWeight,
    LetterSpacing,
    TextTransform,
    TextAnchor,
    DominantBaseline,
    CutoutText,
    Layout
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
EditorElement.registerEditorElement('chisel-endcap', ChiselEndcap);