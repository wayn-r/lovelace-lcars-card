import { html, TemplateResult } from 'lit';

export class LayoutConfigRenderer {
  static render(element: any, basePath: string, onValueChanged: (ev: CustomEvent) => void): TemplateResult {
    const layout = element.layout || {};
    const layoutPath = `${basePath}.layout`;

    return html`
      ${this._renderStandardFields(layout, layoutPath, onValueChanged)}
      ${this._renderElbowSpecificFields(element, layout, layoutPath, onValueChanged)}
    `;
  }

  private static _renderStandardFields(
    layout: any,
    layoutPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Width"
            .value=${layout.width?.toString() || ''}
            .configValue=${`${layoutPath}.width`}
            @input=${onValueChanged}
            .placeholder=${'auto'}
          ></ha-textfield>
          <div class="helper-text">Number (pixels) or percentage (e.g., "50%")</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Height"
            .value=${layout.height?.toString() || ''}
            .configValue=${`${layoutPath}.height`}
            @input=${onValueChanged}
            .placeholder=${'auto'}
          ></ha-textfield>
          <div class="helper-text">Number (pixels) or percentage (e.g., "25%")</div>
        </div>
      </div>

      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Offset X"
            .value=${layout.offset_x?.toString() || ''}
            .configValue=${`${layoutPath}.offset_x`}
            @input=${onValueChanged}
            .placeholder=${'0'}
          ></ha-textfield>
          <div class="helper-text">Horizontal offset in pixels</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Offset Y"
            .value=${layout.offset_y?.toString() || ''}
            .configValue=${`${layoutPath}.offset_y`}
            @input=${onValueChanged}
            .placeholder=${'0'}
          ></ha-textfield>
          <div class="helper-text">Vertical offset in pixels</div>
        </div>
      </div>
    `;
  }

  private static _renderElbowSpecificFields(
    element: any,
    layout: any,
    layoutPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'elbow') {
      return '';
    }

    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Body Width"
            .value=${layout.body_width?.toString() || ''}
            .configValue=${`${layoutPath}.body_width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Width of the elbow body</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Arm Height"
            .value=${layout.arm_height?.toString() || ''}
            .configValue=${`${layoutPath}.arm_height`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Height of the elbow arm</div>
        </div>
      </div>
    `;
  }
}

