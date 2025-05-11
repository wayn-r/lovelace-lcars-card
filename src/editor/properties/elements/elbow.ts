import { EditorElement, PropertyClass } from './element';
import {
    Orientation, 
    HorizontalWidth, 
    VerticalWidth, 
    HeaderHeight, 
    TotalElbowHeight, 
    OuterCornerRadius,    
    Width, 
    Height,
    ElbowTextPosition
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
            OuterCornerRadius,
            ElbowTextPosition
        ];
    }
}
EditorElement.registerEditorElement('elbow', Elbow); 