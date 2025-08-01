import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { svg, SVGTemplateResult } from "lit";
import { ShapeGenerator } from "../../utils/shapes.js";
import { Button } from "../../utils/button.js";

export class EndcapElement extends LayoutElement {
    button?: Button;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
        this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
        this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0; 
        this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        if (this.heightRequiresAnchoredCalculation() && this.layoutConfig.anchor?.anchorTo) {
            const anchorElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
            if (!anchorElement || !anchorElement.layout.calculated) {
                super.canCalculateLayout(elementsMap, dependencies);
                return false;
            }
        }
        return super.canCalculateLayout(elementsMap, dependencies); 
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
        if (this.heightRequiresAnchoredCalculation() && this.layoutConfig.anchor?.anchorTo) {
            const anchorElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
            if (anchorElement?.layout.calculated) { 
                this.calculateLayoutWithAnchoredHeight(anchorElement, elementsMap, containerRect);
                return;
            }
        }
        
        super.calculateLayout(elementsMap, containerRect);
    }

    private heightRequiresAnchoredCalculation(): boolean {
        return this.intrinsicSize.height === 0;
    }

    private calculateLayoutWithAnchoredHeight(anchorElement: LayoutElement, elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
        const originalLayoutHeight = this.layoutConfig.height;
        this.layoutConfig.height = anchorElement.layout.height;
        super.calculateLayout(elementsMap, containerRect);
        this.layoutConfig.height = originalLayoutHeight;
    }
  
    renderShape(): SVGTemplateResult | null {
        if (!this.layout.calculated || !this.dimensionsAreValid()) {
            return null;
        }

        const { x, y, width, height } = this.layout;
        const direction = (this.props.direction || 'left') as 'left' | 'right';
        const pathData = ShapeGenerator.generateEndcap(width, height, direction, x, y);

        if (!pathData) {
            return null;
        }
        
        return this.renderPathWithButtonSupport(pathData, x, y, width, height);
    }

    private dimensionsAreValid(): boolean {
        return this.layout.width > 0 && this.layout.height > 0;
    }

    private renderPathWithButtonSupport(pathData: string, x: number, y: number, width: number, height: number): SVGTemplateResult {
        if (this.button) {
            const stateContext = this.getStateContext();
            return this.button.createButton(pathData, x, y, width, height, { rx: 0 }, stateContext);
        }

        const colors = this.resolveElementColors();
        return svg`
            <path
                id="${this.id}__shape"
                d=${pathData}
                fill=${colors.fillColor}
                stroke=${colors.strokeColor}
                stroke-width=${colors.strokeWidth}
            />
        `;
    }
}