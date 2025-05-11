import { EditorElement, PropertyClass } from './element';
import { 
    Direction, 
    Width, 
    Height 
} from '../properties/properties';

export class Endcap extends EditorElement {
    get specificProperties(): PropertyClass[] {
        return [
            Width, 
            Height, 
            Direction
        ];
    }
}
EditorElement.registerEditorElement('endcap', Endcap);