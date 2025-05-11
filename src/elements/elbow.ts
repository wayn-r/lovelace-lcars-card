import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../layout/engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateElbowPath } from "../utils/shapes.js";

export class ElbowElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.horizontalWidth || this.layoutConfig.horizontalWidth || 100;
      this.intrinsicSize.height = this.props.totalElbowHeight || this.layoutConfig.totalElbowHeight || 100;
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
      const horizontalWidth = this.props.horizontalWidth || width;
      const verticalWidth = this.props.verticalWidth || 30;
      const headerHeight = this.props.headerHeight || 30;
      const totalElbowHeight = this.props.totalElbowHeight || height;
      const outerCornerRadius = this.props.outerCornerRadius || headerHeight;
      const pathData = generateElbowPath(
        x,
        horizontalWidth,
        verticalWidth,
        headerHeight,
        totalElbowHeight,
        orientation,
        y,
        outerCornerRadius
      );
      if (!pathData) return null;
      
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      if (isButton && this.button) {
        return this.button.createButton(
          pathData,
          x,
          y,
          width,
          height,
          {
            hasText,
            isCutout,
            rx: 0
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