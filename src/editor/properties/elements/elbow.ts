import { EditorElement, PropertyClass } from './element';
import {
    Orientation, 
    HorizontalWidth, 
    VerticalWidth, 
    HeaderHeight, 
    TotalElbowHeight, 
    OuterCornerRadius,    
    Width, 
    Height
} from '../properties';

export class Elbow extends EditorElement {
     get specificProperties(): PropertyClass[] {
        return [
            Width, 
            Height, 
            Orientation, 
            HorizontalWidth, 
            VerticalWidth, 
            HeaderHeight, 
            TotalElbowHeight, 
            OuterCornerRadius
        ];
    }
}
EditorElement.registerEditorElement('elbow', Elbow); 