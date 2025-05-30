import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { generateElbowPath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class ElbowElement extends LayoutElement {
    button?: Button;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
        this.resetLayout();
        this.intrinsicSize = { width: 0, height: 0, calculated: false };
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 100;
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 100;
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      return super.canCalculateLayout(elementsMap);
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      super.calculateLayout(elementsMap, containerRect);
    }

    /**
     * Override text position calculation for elbow-specific positioning
     */
    protected _getTextPosition(): { x: number, y: number } {
        const { x, y, width, height } = this.layout;
        const orientation = this.props.orientation || 'top-left';
        const bodyWidth = this.props.bodyWidth || 30;
        const armHeight = this.props.armHeight || 30;
        const elbowTextPosition = this.props.elbowTextPosition;
        
        // Use calculated layout width if stretching is applied, otherwise use configured width
        const hasStretchConfig = Boolean(this.layoutConfig.stretch?.stretchTo1 || this.layoutConfig.stretch?.stretchTo2);
        const configuredWidth = this.props.width || this.layoutConfig.width || 100;
        const elbowWidth = hasStretchConfig ? width : configuredWidth;
        
        if (elbowTextPosition === 'arm') {
            // Position text in the arm (horizontal) part of the elbow
            // For top orientations, arm is at the top; for bottom orientations, arm is at the bottom
            const armCenterY = orientation.startsWith('top') 
                ? y + armHeight / 2 
                : y + height - armHeight / 2;
            
            // Position X based on orientation - arm extends from the body
            let armCenterX: number;
            if (orientation === 'top-left' || orientation === 'bottom-left') {
                // Arm extends from left body to the right
                armCenterX = x + bodyWidth + (elbowWidth - bodyWidth) / 2;
            } else {
                // top-right or bottom-right: Arm extends from right body to the left
                armCenterX = x + (elbowWidth - bodyWidth) / 2;
            }
            
            return {
                x: armCenterX,
                y: armCenterY
            };
        } else if (elbowTextPosition === 'body') {
            // Position text in the body (vertical) part of the elbow based on orientation
            if (orientation === 'top-left') {
                return {
                    x: x + bodyWidth / 2,
                    y: y + armHeight + (height - armHeight) / 2
                };
            } else if (orientation === 'top-right') {
                return {
                    x: x + elbowWidth - bodyWidth / 2,
                    y: y + armHeight + (height - armHeight) / 2
                };
            } else if (orientation === 'bottom-left') {
                return {
                    x: x + bodyWidth / 2,
                    y: y + (height - armHeight) / 2
                };
            } else { // bottom-right
                return {
                    x: x + elbowWidth - bodyWidth / 2,
                    y: y + (height - armHeight) / 2
                };
            }
        } else {
            // Default to arm positioning if not specified
            const armCenterY = orientation.startsWith('top') 
                ? y + armHeight / 2 
                : y + height - armHeight / 2;
            
            // Position X based on orientation - arm extends from the body
            let armCenterX: number;
            if (orientation === 'top-left' || orientation === 'bottom-left') {
                // Arm extends from left body to the right
                armCenterX = x + bodyWidth + (elbowWidth - bodyWidth) / 2;
            } else {
                // top-right or bottom-right: Arm extends from right body to the left
                armCenterX = x + (elbowWidth - bodyWidth) / 2;
            }
            
            return {
                x: armCenterX,
                y: armCenterY
            };
        }
    }

    renderShape(): SVGTemplateResult | null {
      if (!this.layout.calculated) {
        return null;
      }

      const { x, y, width, height } = this.layout;
      
      // Return null for invalid dimensions
      if (width <= 0 || height <= 0) {
        return null;
      }
      
      const orientation = this.props.orientation || 'top-left';
      const bodyWidth = this.props.bodyWidth || 30;
      const armHeight = this.props.armHeight || 30;
      
      // Use calculated layout width if stretching is applied, otherwise use configured width
      const hasStretchConfig = Boolean(this.layoutConfig.stretch?.stretchTo1 || this.layoutConfig.stretch?.stretchTo2);
      const configuredWidth = this.props.width || this.layoutConfig.width || 100;
      const elbowWidth = hasStretchConfig ? width : configuredWidth;
      
      const pathData = generateElbowPath(x, elbowWidth, bodyWidth, armHeight, height, orientation, y, armHeight);
      
      // Return null if path generation fails
      if (pathData === null) {
        return null;
      }
      
      // Check for button rendering
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      
      if (isButton && this.button) {
        // Let the button handle its own color resolution with current state
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            rx: 0
          }
        );
      } else {
        // Use centralized color resolution for non-button elements
        const colors = this._resolveElementColors();
        
        // Create and return just the path element - text handled by base class
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${colors.fillColor}
            stroke=${colors.strokeColor}
            stroke-width=${colors.strokeWidth}
          />
        `;
      }
    }
}