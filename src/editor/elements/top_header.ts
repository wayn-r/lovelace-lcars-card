import { EditorElement, PropertyGroup, PropertyGroupDefinition } from './element';
import {
    Height,
    LeftTextContent,
    RightTextContent,
    FontFamily,
    FontWeight,
    LetterSpacing,
    TextTransform,
    OffsetY
} from '../properties/properties';

export class TopHeader extends EditorElement {
    getPropertyGroups(): Partial<Record<PropertyGroup, PropertyGroupDefinition | null>> {
        return {
            [PropertyGroup.POSITIONING]: {
                properties: [OffsetY]
            },
            [PropertyGroup.DIMENSIONS]: {
                properties: [Height]
            },
            [PropertyGroup.TEXT]: {
                properties: [
                    LeftTextContent,
                    RightTextContent,
                    FontFamily,
                    FontWeight,
                    LetterSpacing,
                    TextTransform
                ]
            }
        };
    }
}

EditorElement.registerEditorElement('top_header', TopHeader); 