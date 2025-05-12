import { EditorElement, PropertyClass } from './element';
import {
    Orientation, 
    Width, 
    Height,
    BodyWidth, 
    ArmHeight, 
    ElbowTextPosition
} from '../properties/properties';

export class Elbow extends EditorElement {
     get specificProperties(): PropertyClass[] {
        return [
            Width, 
            Height, 
            Orientation, 
            BodyWidth, 
            ArmHeight, 
            ElbowTextPosition
        ];
    }
}
EditorElement.registerEditorElement('elbow', Elbow); 