import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { generateRectanglePath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class RectangleElement extends LayoutElement {
  button?: Button;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    this.resetLayout();
  }

  /**
   * Renders the rectangle as an SVG path element.
   * @returns The SVG path element.
   */
  renderShape(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;

    const { x, y, width, height } = this.layout;
    
    // Check for zero dimensions and return a minimal path
    if (width <= 0 || height <= 0) {
      return svg`
          <path
            id=${this.id}
            d="M ${x.toFixed(3)},${y.toFixed(3)} L ${x.toFixed(3)},${y.toFixed(3)} L ${x.toFixed(3)},${y.toFixed(3)} L ${x.toFixed(3)},${y.toFixed(3)} Z"
            fill="none"
            stroke="none"
            stroke-width="0"
          />
        `;
    }
    
    const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
    const isButton = Boolean(buttonConfig?.enabled);
    
    if (isButton && this.button) {
      // Let the button handle its own color resolution
      const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
      const pathData = generateRectanglePath(x, y, width, height, rx);
      
      return this.button.createButton(
        pathData,
        x,
        y,
        width,
        height,
        {
          rx
        }
      );
    } else {
      // Use centralized color resolution for non-button elements
      const colors = this._resolveElementColors();
      const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
      const pathData = generateRectanglePath(x, y, width, height, rx);
      
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