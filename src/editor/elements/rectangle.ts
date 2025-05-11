import { EditorElement, PropertyClass } from './element';
import { 
    Width, 
    Height 
} from '../properties/properties';

export class Rectangle extends EditorElement {
    get specificProperties(): PropertyClass[] {
        return [
            Width, 
            Height
        ];
    }
}

EditorElement.registerEditorElement('rectangle', Rectangle); 