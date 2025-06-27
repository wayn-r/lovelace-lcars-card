import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { ShapeGenerator } from "../../utils/shapes.js";
import { Button } from "../../utils/button.js";

export class ElbowElement extends LayoutElement {
    button?: Button;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
        this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 100;
        this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 100;
        this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
      return super.canCalculateLayout(elementsMap, dependencies);
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      super.calculateLayout(elementsMap, containerRect);
    }

    /**
     * Override text position calculation for elbow-specific positioning
     * Considers textAnchor to position text relative to the arm or body subsection edges
     */
    protected getTextPosition(): { x: number, y: number } {
        const { x, y, width, height } = this.layout;
        const orientation = this.props.orientation || 'top-left';
        const bodyWidth = this.props.bodyWidth || 30;
        const armHeight = this.props.armHeight || 30;
        const elbowTextPosition = this.props.elbowTextPosition;
        const textAnchor = this.props.textAnchor || 'middle';
        
        const elbowWidth = this.calculateEffectiveElbowWidth(width);
        
        if (elbowTextPosition === 'arm') {
            return this.calculateArmTextPosition(x, y, height, orientation, bodyWidth, armHeight, elbowWidth, textAnchor);
        } else if (elbowTextPosition === 'body') {
            return this.calculateBodyTextPosition(x, y, height, orientation, bodyWidth, armHeight, elbowWidth, textAnchor);
        } else {
            return this.calculateArmTextPosition(x, y, height, orientation, bodyWidth, armHeight, elbowWidth, textAnchor);
        }
    }

    private calculateEffectiveElbowWidth(layoutWidth: number): number {
        const hasStretchConfig = Boolean(this.layoutConfig.stretch?.stretchTo1 || this.layoutConfig.stretch?.stretchTo2);
        const configuredWidth = this.props.width || this.layoutConfig.width || 100;
        return hasStretchConfig ? layoutWidth : configuredWidth;
    }

    private calculateArmTextPosition(x: number, y: number, height: number, orientation: string, bodyWidth: number, armHeight: number, elbowWidth: number, textAnchor: string): { x: number, y: number } {
        const armCenterY = orientation.startsWith('top') 
            ? y + armHeight / 2 
            : y + height - armHeight / 2;
        
        const { armLeftX, armRightX } = this.calculateArmBoundaries(x, orientation, bodyWidth, elbowWidth);
        const armTextX = this.calculateTextXPosition(armLeftX, armRightX, textAnchor);
        
        return { x: armTextX, y: armCenterY };
    }

    private calculateBodyTextPosition(x: number, y: number, height: number, orientation: string, bodyWidth: number, armHeight: number, elbowWidth: number, textAnchor: string): { x: number, y: number } {
        let bodyCenterY: number;
        let bodyLeftX: number, bodyRightX: number;
        
        if (orientation === 'top-left') {
            bodyCenterY = y + armHeight + (height - armHeight) / 2;
            bodyLeftX = x;
            bodyRightX = x + bodyWidth;
        } else if (orientation === 'top-right') {
            bodyCenterY = y + armHeight + (height - armHeight) / 2;
            bodyLeftX = x + elbowWidth - bodyWidth;
            bodyRightX = x + elbowWidth;
        } else if (orientation === 'bottom-left') {
            bodyCenterY = y + (height - armHeight) / 2;
            bodyLeftX = x;
            bodyRightX = x + bodyWidth;
        } else {
            bodyCenterY = y + (height - armHeight) / 2;
            bodyLeftX = x + elbowWidth - bodyWidth;
            bodyRightX = x + elbowWidth;
        }
        
        const bodyCenterX = this.calculateTextXPosition(bodyLeftX, bodyRightX, textAnchor);
        return { x: bodyCenterX, y: bodyCenterY };
    }

    private calculateArmBoundaries(x: number, orientation: string, bodyWidth: number, elbowWidth: number): { armLeftX: number, armRightX: number } {
        if (orientation === 'top-left' || orientation === 'bottom-left') {
            return {
                armLeftX: x + bodyWidth,
                armRightX: x + elbowWidth
            };
        } else {
            return {
                armLeftX: x,
                armRightX: x + (elbowWidth - bodyWidth)
            };
        }
    }

    private calculateTextXPosition(leftBoundary: number, rightBoundary: number, textAnchor: string): number {
        switch (textAnchor) {
            case 'start':
                return leftBoundary;
            case 'end':
                return rightBoundary;
            case 'middle':
            default:
                return leftBoundary + (rightBoundary - leftBoundary) / 2;
        }
    }

    renderShape(): SVGTemplateResult | null {
        if (!this.layout.calculated || !this.dimensionsAreValid()) {
            return null;
        }

        const { x, y, width, height } = this.layout;
        const orientation = this.props.orientation || 'top-left';
        const bodyWidth = this.props.bodyWidth || 30;
        const armHeight = this.props.armHeight || 30;
        
        const elbowWidth = this.calculateEffectiveElbowWidth(width);
        const pathData = ShapeGenerator.generateElbow(x, elbowWidth, bodyWidth, armHeight, height, orientation, y, armHeight);
        
        if (pathData === null) {
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