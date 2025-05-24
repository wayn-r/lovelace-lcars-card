import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import { 
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
    OffsetY,
    ButtonActionService,
    ButtonActionServiceData,
    ButtonActionNavigationPath,
    ButtonActionUrlPath,
    ButtonActionEntity,
    ButtonActionConfirmation
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
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetX, OffsetY]
            },
        };
    }
}

EditorElement.registerEditorElement('rectangle', Rectangle); 