import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
    Width, 
    Height,
    Fill,
    ButtonEnabled,
    OffsetX,
    OffsetY,
    ButtonActionService,
    ButtonActionServiceData,
    ButtonActionNavigationPath,
    ButtonActionUrlPath,
    ButtonActionEntity,
    ButtonActionConfirmation,
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
    CutoutText
} from '../properties/properties';

export class Rectangle extends EditorElement {
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
                    ButtonActionType,
                    ButtonActionService,
                    ButtonActionServiceData,
                    ButtonActionNavigationPath,
                    ButtonActionUrlPath,
                    ButtonActionEntity,
                    ButtonActionConfirmation
                ]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Width, Height]
            },
            [PropertyGroup.APPEARANCE]: {
                properties: [Fill]
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

EditorElement.registerEditorElement('rectangle', Rectangle); 