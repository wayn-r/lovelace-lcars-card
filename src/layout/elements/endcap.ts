import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { generateEndcapPath } from "../../utils/shapes.js";

export class EndcapElement extends LayoutElement {
    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
        super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
        this.resetLayout();
        this.intrinsicSize = { width: 0, height: 0, calculated: false };
    }
  
    calculateIntrinsicSize(container: SVGElement): void {
      this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
      
      this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0; 
      
      this.intrinsicSize.calculated = true;
    }
  
    canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
      // Check if we have zero height and anchor configuration
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchor?.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
        // If anchor target doesn't exist or is not calculated, return false
        // and DON'T call super.canCalculateLayout
        if (!anchorElement || !anchorElement.layout.calculated) {
          return false;
        }
      }
      // Only call super if we passed the special checks
      return super.canCalculateLayout(elementsMap); 
    }
  
    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
      if (this.intrinsicSize.height === 0 && this.layoutConfig.anchor?.anchorTo) {
        const anchorElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
        if (anchorElement && anchorElement.layout.calculated) { 
          // IMPORTANT: Modify the height used for this specific layout calculation
          // Store the original height so we can restore it later
          const originalLayoutHeight = this.layoutConfig.height;
          
          // Set the layoutConfig height to match the anchor element height
          this.layoutConfig.height = anchorElement.layout.height;
          
          // Call super to do the actual layout calculation
          super.calculateLayout(elementsMap, containerRect);
          
          // Restore the original height
          this.layoutConfig.height = originalLayoutHeight;
          return;
        }
      }
      
      // If we didn't need to adjust height or couldn't find anchor, just call super
      super.calculateLayout(elementsMap, containerRect);
    }
  
    renderShape(): SVGTemplateResult | null {
      if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null;
  
      const { x, y, width, height } = this.layout;
      const direction = (this.props.direction || 'left') as 'left' | 'right';
  
      const pathData = generateEndcapPath(width, height, direction, x, y);
  
      if (!pathData) return null;
      
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