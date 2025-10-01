import { html, TemplateResult } from 'lit';
import { ColorFormatter } from '../color-formatter.js';
import { ElementMetadata } from '../element-metadata.js';

export class AppearanceConfigRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult {
    const appearance = element.appearance || {};
    const appearancePath = `${basePath}.appearance`;

    return html`
      <div class="config-section">
        <div class="config-section-header">Appearance Properties</div>
        
        ${this._renderStandardFields(appearance, appearancePath, onValueChanged)}
        ${this._renderRectangleFields(element, appearance, appearancePath, onValueChanged)}
        ${this._renderEndcapFields(element, appearance, appearancePath, onValueChanged, onCheckboxChanged)}
        ${this._renderElbowFields(element, appearance, appearancePath, onValueChanged)}
        ${this._renderGraphWidgetFields(element, appearance, appearancePath, onValueChanged)}
        ${this._renderSliderWidgetFields(element, appearance, appearancePath, onValueChanged, onCheckboxChanged)}
      </div>
    `;
  }

  private static _renderStandardFields(
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    return html`
      <div class="config-row">
        <ha-textfield
          label="Fill Color"
          .value=${ColorFormatter.toString(appearance.fill) || ''}
          .configValue=${`${appearancePath}.fill`}
          @input=${onValueChanged}
          .placeholder=${'#ff9900'}
        ></ha-textfield>
        <div class="helper-text">Fill color (e.g., #ff9900 or orange)</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Stroke Color"
          .value=${ColorFormatter.toString(appearance.stroke) || ''}
          .configValue=${`${appearancePath}.stroke`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Border color</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Stroke Width"
          type="number"
          .value=${appearance.strokeWidth?.toString() || ''}
          .configValue=${`${appearancePath}.strokeWidth`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Border width in pixels</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Corner Radius"
          type="number"
          .value=${appearance.cornerRadius?.toString() || ''}
          .configValue=${`${appearancePath}.cornerRadius`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Corner radius in pixels</div>
      </div>
    `;
  }

  private static _renderRectangleFields(
    element: any,
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'rectangle') {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-select
          label="Rounded Corners"
          .value=${appearance.rounded || ''}
          .configValue=${`${appearancePath}.rounded`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="">None</mwc-list-item>
          <mwc-list-item value="left">Left</mwc-list-item>
          <mwc-list-item value="right">Right</mwc-list-item>
          <mwc-list-item value="both">Both</mwc-list-item>
        </ha-select>
        <div class="helper-text">Which corners to round</div>
      </div>
    `;
  }

  private static _renderEndcapFields(
    element: any,
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    if (element.type !== 'endcap') {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-select
          label="Direction"
          .value=${appearance.direction || 'right'}
          .configValue=${`${appearancePath}.direction`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="left">Left</mwc-list-item>
          <mwc-list-item value="right">Right</mwc-list-item>
        </ha-select>
        <div class="helper-text">Endcap direction</div>
      </div>

      <div class="config-row">
        <ha-formfield label="Chisel">
          <ha-checkbox
            .checked=${appearance.chisel || false}
            .configValue=${`${appearancePath}.chisel`}
            @change=${onCheckboxChanged}
          ></ha-checkbox>
        </ha-formfield>
        <div class="helper-text">Enable chisel effect</div>
      </div>
    `;
  }

  private static _renderElbowFields(
    element: any,
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'elbow') {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-select
          label="Orientation"
          .value=${appearance.orientation || 'top-left'}
          .configValue=${`${appearancePath}.orientation`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="top-left">Top Left</mwc-list-item>
          <mwc-list-item value="top-right">Top Right</mwc-list-item>
          <mwc-list-item value="bottom-left">Bottom Left</mwc-list-item>
          <mwc-list-item value="bottom-right">Bottom Right</mwc-list-item>
        </ha-select>
        <div class="helper-text">Elbow orientation</div>
      </div>
    `;
  }

  private static _renderGraphWidgetFields(
    element: any,
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (!ElementMetadata.isGraphWidget(element.type)) {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-textfield
          label="Min Value"
          type="number"
          .value=${appearance.min?.toString() || ''}
          .configValue=${`${appearancePath}.min`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Minimum value for graph scale</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Max Value"
          type="number"
          .value=${appearance.max?.toString() || ''}
          .configValue=${`${appearancePath}.max`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Maximum value for graph scale</div>
      </div>
    `;
  }

  private static _renderSliderWidgetFields(
    element: any,
    appearance: any,
    appearancePath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    if (!ElementMetadata.isSliderWidget(element.type)) {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-textfield
          label="Spacing"
          type="number"
          .value=${appearance.spacing?.toString() || ''}
          .configValue=${`${appearancePath}.spacing`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Spacing between slider elements</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Top Padding"
          type="number"
          .value=${appearance.top_padding?.toString() || ''}
          .configValue=${`${appearancePath}.top_padding`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Padding at the top</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Label Height"
          type="number"
          .value=${appearance.label_height?.toString() || ''}
          .configValue=${`${appearancePath}.label_height`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Height of the label area</div>
      </div>

      <div class="config-row">
        <ha-formfield label="Use Floats">
          <ha-checkbox
            .checked=${appearance.use_floats || false}
            .configValue=${`${appearancePath}.use_floats`}
            @change=${onCheckboxChanged}
          ></ha-checkbox>
        </ha-formfield>
        <div class="helper-text">Show decimal values</div>
      </div>
    `;
  }
}

