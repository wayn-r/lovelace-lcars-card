import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
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
  
    render(): SVGTemplateResult | null {
      if (!this.layout.calculated) return null;

      const { x, y, width, height } = this.layout;
      
      // Return null for invalid dimensions
      if (width <= 0 || height <= 0) {
        return null;
      }
      
      const orientation = this.props.orientation || 'top-left';
      const bodyWidth = this.props.bodyWidth || 30;
      const armHeight = this.props.armHeight || 30;
      
      // Use calculated layout width if stretching is applied, otherwise use configured width
      // This allows stretching to affect the elbow shape while preserving original behavior for non-stretched elements
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
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      if (isButton && this.button) {
        // Calculate custom text position for elbow elements
        let customTextPosition;
        const elbowTextPosition = this.props.elbow_text_position;
        
        if (elbowTextPosition && hasText) {
          // Use same width logic as for path generation for consistent text positioning
          const elbowWidth = hasStretchConfig ? width : configuredWidth;
          
          if (elbowTextPosition === 'top') {
            // Position text at top center
            customTextPosition = {
              x: x + elbowWidth / 2,
              y: y + armHeight / 2
            };
          } else if (elbowTextPosition === 'side') {
            // Position text based on orientation
            if (orientation === 'top-left') {
              customTextPosition = {
                x: x + bodyWidth / 2,
                y: y + armHeight + (height - armHeight) / 2
              };
            } else if (orientation === 'top-right') {
              customTextPosition = {
                x: x + elbowWidth - bodyWidth / 2,
                y: y + armHeight + (height - armHeight) / 2
              };
            } else if (orientation === 'bottom-left') {
              customTextPosition = {
                x: x + bodyWidth / 2,
                y: y + (height - armHeight) / 2
              };
            } else if (orientation === 'bottom-right') {
              customTextPosition = {
                x: x + elbowWidth - bodyWidth / 2,
                y: y + (height - armHeight) / 2
              };
            }
          }
        }
        
        // Let the button handle its own color resolution with current state
        
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx: 0,
            ...(customTextPosition && { customTextPosition })
          }
        );
      } else {
        // Use centralized color resolution for non-button elements
        const colors = this._resolveElementColors();
        
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