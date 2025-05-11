import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../layout/engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateEndcapPath } from "../utils/shapes.js";

export class EndcapElement extends LayoutElement {
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
          // IMPORTANT: Modify the height used for this specific layout calculation
          // We store the calculated dimensions in this.layout, not this.intrinsicSize here
          // Let the base calculateLayout use this adopted height
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
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
  
      const { x, y, width, height } = this.layout;
      const direction = (this.props.direction || 'left') as 'left' | 'right';
  
      const pathData = generateEndcapPath(width, height, direction, x, y);
  
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
            fill=${this.props.fill || 'none'}
            stroke=${this.props.stroke || 'none'}
            stroke-width=${this.props.strokeWidth || '0'}
          />
        `;
      }
    }
  }