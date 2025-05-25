import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateChiselEndcapPath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class ChiselEndcapElement extends LayoutElement {
    button?: Button;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
      super(id, props, layoutConfig, hass, requestUpdateCallback);
      this.resetLayout();
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0;
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (!anchorElement || !anchorElement.layout.calculated) return false;
      }
      return super.canCalculateLayout(elementsMap);
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (anchorElement) {
          const adoptedHeight = anchorElement.layout.height;
          const originalLayoutHeight = this.layoutConfig.height;
          this.layoutConfig.height = adoptedHeight;
          super.calculateLayout(elementsMap, containerRect);
          this.layoutConfig.height = originalLayoutHeight;
          return;
        }
      }
      super.calculateLayout(elementsMap, containerRect);
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
      
      const side = this.props.direction === 'left' ? 'left' : 'right';
      
      const pathData = generateChiselEndcapPath(width, height, side, x, y);
      
      // Check if pathData is null (edge case)
      if (pathData === null) {
        return null;
      }
      
      // Check for button rendering
      const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
      const isButton = Boolean(buttonConfig?.enabled);
      const hasText = isButton && Boolean(buttonConfig?.text);
      const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
      
      if (isButton && this.button) {
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
            rx: 0
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