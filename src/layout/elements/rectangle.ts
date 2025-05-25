import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../lovelace-lcars-card.js";
import { svg, SVGTemplateResult } from "lit";
import { generateRectanglePath } from "../../utils/shapes.js";
import { Button } from "./button.js";

export class RectangleElement extends LayoutElement {
  button?: Button;
  private _lastFillColor?: string;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void) {
    super(id, props, layoutConfig, hass, requestUpdateCallback);
    this.resetLayout();
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
    
    // Resolve fill color (dynamic or static)
    let fillColor;
    if (this.props.fill !== undefined) {
      // Try dynamic color resolution first, then fallback to static
      fillColor = this._resolveDynamicColor(this.props.fill) || this.props.fill;
    } else {
      // Default fill when no fill is specified
      fillColor = 'none';
    }
    
    // Check if color changed and apply fade transition (only for dynamic colors)
    if (this._lastFillColor && this._lastFillColor !== fillColor && this._resolveDynamicColor(this.props.fill)) {
      // Schedule animation after render
      setTimeout(() => {
        const element = document.getElementById(this.id);
        if (element) {
          element.style.transition = 'fill 0.3s ease-in-out';
          element.style.fill = fillColor;
        }
      }, 0);
    }
    this._lastFillColor = fillColor;

    if (isButton && this.button) {
      // Create a modified props object with resolved dynamic colors for the button
      const resolvedProps = { ...this.props };
      
      // Resolve dynamic fill color for button
      if (this.props.fill !== undefined) {
        resolvedProps.fill = fillColor;
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
          rx
        }
      );
    } else {
      const stroke = this.props.stroke ?? 'none';
      const strokeWidth = this.props.strokeWidth ?? '0';
      
      return svg`
        <path
          id=${this.id}
          d=${pathData}
          fill=${fillColor}
          stroke=${stroke}
          stroke-width=${strokeWidth}
        />
      `;
    }
  }
}