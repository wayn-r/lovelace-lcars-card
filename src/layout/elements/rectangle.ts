import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateRectanglePath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class RectangleElement extends LayoutElement {
  button?: Button;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
    super(id, props, layoutConfig, hass, requestUpdateCallback);
    this.resetLayout();
    
    // Initialize button if needed
    const buttonConfig = this.props.button as LcarsButtonElementConfig | undefined;
    if (buttonConfig?.enabled) {
      this.button = new Button(id, props, hass, requestUpdateCallback);
    }
  }

  /**
   * Renders the rectangle as an SVG path element.
   * @returns The SVG path element.
   */
  render(): SVGTemplateResult | null {
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
    const hasText = isButton && Boolean(buttonConfig?.text);
    const isCutout = hasText && Boolean(buttonConfig?.cutout_text);
    
    const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
    const pathData = generateRectanglePath(x, y, width, height, rx);
    
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
          rx
        }
      );
    } else {
      const fill = this.props.fill ?? 'none';
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