import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    Orientation, 
    Width, 
    Height,
    BodyWidth, 
    ArmHeight, 
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
    ElbowTextPosition
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
                    ButtonHoverFill,
                    ButtonActiveFill,
                    ButtonHoverTransform,
                    ButtonActiveTransform,
                    ButtonActionType
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height, BodyWidth, ArmHeight]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill, Orientation]
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
                    CutoutText,
                    ElbowTextPosition
                ]
            },
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            }
        };
    }
}
EditorElement.registerEditorElement('elbow', Elbow); 