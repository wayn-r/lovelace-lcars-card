import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateElbowPath } from "../../utils/shapes.js";

export class ElbowElement extends LayoutElement {
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
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
      const { x, y, width, height } = this.layout;
      const fill = this.props.fill || 'none';
      const stroke = this.props.stroke || 'none';
      const strokeWidth = this.props.strokeWidth || '0';
      const orientation = this.props.orientation || 'top-left';
      const elbowWidth = this.props.width || width;
      const bodyWidth = this.props.bodyWidth || 30;
      const armHeight = this.props.armHeight || 30;
      const outerCornerRadius = armHeight;
      const pathData = generateElbowPath(
        x,
        elbowWidth,
        bodyWidth,
        armHeight,
        height,
        orientation,
        y,
        outerCornerRadius
      );
      if (!pathData) return null;
      
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      const textPosition = this.props.elbow_text_position || 'top';
      
      if (isButton && this.button) {
        // Calculate text position based on the elbow_text_position property
        let textX: number, textY: number;
        
        if (textPosition === 'top') {
          // Center text in the horizontal header section
          textX = x + elbowWidth / 2;
          textY = y + armHeight / 2;
        } else { // 'side'
          // Center text in the vertical section
          // Position depends on orientation
          if (orientation === 'top-left') {
            textX = x + bodyWidth / 2;
            textY = y + armHeight + (height - armHeight) / 2;
          } else if (orientation === 'top-right') {
            textX = x + elbowWidth - bodyWidth / 2;
            textY = y + armHeight + (height - armHeight) / 2;
          } else if (orientation === 'bottom-left') {
            textX = x + bodyWidth / 2;
            textY = y + (height - armHeight) / 2;
          } else { // 'bottom-right'
            textX = x + elbowWidth - bodyWidth / 2;
            textY = y + (height - armHeight) / 2;
          }
        }
        
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
            customTextPosition: {
              x: textX,
              y: textY
            }
          }
        );
      } else {
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