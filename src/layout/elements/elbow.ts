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
        
        if (elbowTextPosition === 'top') {
            // Position text at top center
            return {
                x: x + elbowWidth / 2,
                y: y + armHeight / 2
            };
        } else if (elbowTextPosition === 'side') {
            // Position text based on orientation
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
            // Default to center positioning
            return {
                x: x + elbowWidth / 2,
                y: y + height / 2
            };
        }
    }

    render(): SVGTemplateResult | null {
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
        // Calculate custom text position for elbow elements if button has text
        let customTextPosition;
        const elbowTextPosition = this.props.elbowTextPosition;
        
        if (elbowTextPosition && this._hasButtonText()) {
          customTextPosition = this._getTextPosition();
        }
        
        // Let the button handle its own color resolution with current state
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText: this._hasButtonText(),
            isCutout: this._isCutoutText(),
            rx: 0,
            ...(customTextPosition && { customTextPosition })
          }
        );
      } else {
        // Use centralized color resolution for non-button elements
        const colors = this._resolveElementColors();
        
        // Create the path element
        const pathElement = svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${colors.fillColor}
            stroke=${colors.strokeColor}
            stroke-width=${colors.strokeWidth}
          />
        `;
        
        // Get text position and render text if present
        const textPosition = this._getTextPosition();
        const textElement = this._renderNonButtonText(textPosition.x, textPosition.y, colors);
        
        // Return element with optional text wrapping
        return this._renderWithOptionalText(pathElement, textElement);
      }
    }
}