import { EditorElement, PropertyClass } from './element';
import {
    TextContent, 
    FontSize, 
    FontFamily, 
    FontWeight, 
    LetterSpacing, 
    TextAnchor, 
    DominantBaseline, 
    TextTransform
} from '../properties/properties';

export class Text extends EditorElement {
    get specificProperties(): PropertyClass[] {
        return [
            TextContent, 
            FontSize, 
            FontFamily, 
            FontWeight, 
            LetterSpacing, 
            TextAnchor, 
            DominantBaseline, 
            TextTransform
        ];
    }
}
EditorElement.registerEditorElement('text', Text); 