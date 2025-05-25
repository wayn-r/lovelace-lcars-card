import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateElbowPath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class ElbowElement extends LayoutElement {
    button?: Button;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
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
      const elbowWidth = this.props.width || this.layoutConfig.width || 100;
      
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
          const elbowWidth = this.props.width || this.layoutConfig.width || 100;
          
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
        
        // Resolve dynamic fill color
        const fill = this._resolveDynamicColor(this.props.fill) || this.props.fill || 'none';
        
        // Create a modified props object with resolved dynamic colors for the button
        const resolvedProps = { ...this.props };
        
        // Resolve dynamic fill color for button
        if (this.props.fill !== undefined) {
          resolvedProps.fill = fill;
        }
        
        // Resolve dynamic stroke color for button
        if (this.props.stroke !== undefined) {
          resolvedProps.stroke = this._resolveDynamicColor(this.props.stroke) || this.props.stroke;
        }
        
        // Update button props with resolved colors
        (this.button as any)._props = resolvedProps;
        
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
        // Resolve dynamic fill color
        const fill = this._resolveDynamicColor(this.props.fill) || this.props.fill || 'none';
        const stroke = this.props.stroke ?? 'none';
        const strokeWidth = this.props.strokeWidth ?? '0';
        
        return svg`
          <path
            id=${this.id}
            d=${pathData}
            fill=${fill}
            stroke=${stroke}
            stroke-width=${strokeWidth}
          />
        `;
      }
    }
  }