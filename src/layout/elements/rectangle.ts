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
      // This path won't be seen, ID is not critical, but avoid using this.id
      return svg`
          <path
            id="${this.id}__shape_placeholder"
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
      // Button rendering: this.button.createButton returns the <g id="${this.id}">...</g>
      // This is the final SVG for a button element, handled by LayoutElement.render() correctly.
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
      // Non-button rendering: return just the path. 
      // LayoutElement.render() will wrap this path and any text in a <g id="${this.id}">.
      // The <path> itself should NOT have id="${this.id}".
      const colors = this._resolveElementColors();
      const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
      const pathData = generateRectanglePath(x, y, width, height, rx);
      
      return svg`
        <path
          id="${this.id}__shape" // Derived ID for the path itself, not the main element ID
          d=${pathData}
          fill=${colors.fillColor}
          stroke=${colors.strokeColor}
          stroke-width=${colors.strokeWidth}
        />
      `;
    }
  }
}