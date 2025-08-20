import { LayoutElement } from "./element.js";
import { LayoutElementProps, LayoutConfigOptions } from "../engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { LcarsButtonElementConfig } from "../../types.js";
import { svg, SVGTemplateResult } from "lit";
import { ShapeGenerator } from "../../utils/shapes.js";
import { Button } from "../../utils/button.js";
import type { CardRuntime } from '../../core/runtime.js';

export class RectangleElement extends LayoutElement {
  button?: Button;

  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null, runtime?: CardRuntime) {
    super(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement, runtime);
  }

  /**
   * Renders the rectangle as an SVG path element.
   * @returns The SVG path element.
   */
  renderShape(): SVGTemplateResult | null {
    if (!this.layout.calculated) {
      return null;
    }

    const { x, y, width, height } = this.layout;
    
    if (!this.dimensionsAreValid()) {
      return this.createPlaceholderPath(x, y);
    }
    
    const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
    const pathData = this.props.cornerRadii
      ? ShapeGenerator.generateRectangleCorners(
          x,
          y,
          width,
          height,
          {
            topLeft: this.props.cornerRadii.topLeft,
            topRight: this.props.cornerRadii.topRight,
            bottomRight: this.props.cornerRadii.bottomRight,
            bottomLeft: this.props.cornerRadii.bottomLeft,
          }
        )
      : ShapeGenerator.generateRectangle(x, y, width, height, rx);
    
    return this.renderPathWithButtonSupport(pathData, x, y, width, height, rx);
  }

  private dimensionsAreValid(): boolean {
    return this.layout.width > 0 && this.layout.height > 0;
  }

  private createPlaceholderPath(x: number, y: number): SVGTemplateResult {
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

  private renderPathWithButtonSupport(pathData: string, x: number, y: number, width: number, height: number, rx: number): SVGTemplateResult {
    if (this.button) {
      const stateContext = this.getStateContext();
      return this.button.createButton(pathData, x, y, width, height, { rx }, stateContext);
    }

    const colors = this.resolveElementColors();
    return svg`
      <path
        id="${this.id}__shape"
        d=${pathData}
        fill=${colors.fillColor}
        stroke=${colors.strokeColor}
        stroke-width=${colors.strokeWidth}
      />
    `;
  }
}