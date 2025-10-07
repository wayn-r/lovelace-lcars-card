import { html, TemplateResult } from 'lit';
import { ColorFormatter } from '../color-formatter.js';

export class TextConfigRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult {
    const text = element.text || {};
    const textPath = `${basePath}.text`;

    return html`
      ${this._renderContentFields(element, text, textPath, onValueChanged)}
      ${this._renderStandardTextFields(text, textPath, onValueChanged)}
      ${this._renderCutoutField(element, text, textPath, onCheckboxChanged)}
      ${this._renderElbowPositionField(element, text, textPath, onValueChanged)}
      ${this._renderOffsetAndSpacingFields(element, text, textPath, onValueChanged)}
      ${this._renderEntityTextWidgetFields(element, text, textPath, onValueChanged, onCheckboxChanged)}
      ${this._renderEntityMetricWidgetFields(element, text, textPath, onValueChanged, onCheckboxChanged)}
    `;
  }

  private static _renderContentFields(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    if (element.type === 'top_header') {
      return html`
        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Left Content"
              .value=${text.left_content || ''}
              .configValue=${`${textPath}.left_content`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text to display on the left</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Right Content"
              .value=${text.right_content || ''}
              .configValue=${`${textPath}.right_content`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text to display on the right</div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Content"
            .value=${text.content || ''}
            .configValue=${`${textPath}.content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Text content to display</div>
        </div>
      </div>
    `;
  }

  private static _renderStandardTextFields(
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Text Color"
            .value=${ColorFormatter.toString(text.fill || text.text_color) || ''}
            .configValue=${`${textPath}.fill`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Text color</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Font Family"
            .value=${text.font_family || ''}
            .configValue=${`${textPath}.font_family`}
            @input=${onValueChanged}
            .placeholder=${'Antonio'}
          ></ha-textfield>
          <div class="helper-text">Font family name</div>
        </div>
      </div>

      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Font Size"
            type="number"
            .value=${text.font_size?.toString() || ''}
            .configValue=${`${textPath}.font_size`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font size in pixels</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Font Weight"
            .value=${text.font_weight?.toString() || ''}
            .configValue=${`${textPath}.font_weight`}
            @input=${onValueChanged}
            .placeholder=${'normal'}
          ></ha-textfield>
          <div class="helper-text">Font weight (e.g., bold, 600)</div>
        </div>
      </div>

      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Letter Spacing"
            .value=${text.letter_spacing?.toString() || ''}
            .configValue=${`${textPath}.letter_spacing`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Letter spacing (e.g., 2px or 0.1em)</div>
        </div>
        <div class="property-right">
          <ha-select
            label="Text Anchor"
            .value=${text.text_anchor || undefined}
            .configValue=${`${textPath}.text_anchor`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="start">Start</mwc-list-item>
            <mwc-list-item value="middle">Middle</mwc-list-item>
            <mwc-list-item value="end">End</mwc-list-item>
          </ha-select>
          <div class="helper-text">Text alignment</div>
        </div>
      </div>

      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Text Transform"
            .value=${text.text_transform || ''}
            .configValue=${`${textPath}.text_transform`}
            @input=${onValueChanged}
            .placeholder=${'uppercase'}
          ></ha-textfield>
          <div class="helper-text">Text transformation (e.g., uppercase, lowercase)</div>
        </div>
      </div>
    `;
  }

  private static _renderCutoutField(
    element: any,
    text: any,
    textPath: string,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    // Cutout is available for all elements with text
    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-formfield label="Cutout">
            <ha-checkbox
              .checked=${text.cutout || false}
              .configValue=${`${textPath}.cutout`}
              @change=${onCheckboxChanged}
            ></ha-checkbox>
          </ha-formfield>
          <div class="helper-text">Enable text cutout effect</div>
        </div>
      </div>
    `;
  }

  private static _renderElbowPositionField(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'elbow') {
      return '';
    }

    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-select
            label="Elbow Text Position"
            .value=${text.elbow_text_position || undefined}
            .configValue=${`${textPath}.elbow_text_position`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="arm">Arm</mwc-list-item>
            <mwc-list-item value="body">Body</mwc-list-item>
          </ha-select>
          <div class="helper-text">Position of text in elbow</div>
        </div>
      </div>
    `;
  }

  private static _renderOffsetAndSpacingFields(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    // Hide max_lines for logger-widget as it's widget-specific
    const showMaxLines = element.type !== 'logger-widget';

    return html`
      <div class="property-row">
        <div class="property-left">
          <ha-textfield
            label="Text Offset X"
            .value=${text.offset_x?.toString() || ''}
            .configValue=${`${textPath}.offset_x`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Horizontal text offset</div>
        </div>
        <div class="property-right">
          <ha-textfield
            label="Text Offset Y"
            .value=${text.offset_y?.toString() || ''}
            .configValue=${`${textPath}.offset_y`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Vertical text offset</div>
        </div>
      </div>

      ${showMaxLines
        ? html`
            <div class="property-row">
              <div class="property-left">
                <ha-textfield
                  label="Max Lines"
                  type="number"
                  .value=${text.max_lines?.toString() || ''}
                  .configValue=${`${textPath}.max_lines`}
                  @input=${onValueChanged}
                ></ha-textfield>
                <div class="helper-text">Maximum number of text lines</div>
              </div>
              <div class="property-right">
                <ha-textfield
                  label="Line Spacing"
                  .value=${text.line_spacing?.toString() || ''}
                  .configValue=${`${textPath}.line_spacing`}
                  @input=${onValueChanged}
                ></ha-textfield>
                <div class="helper-text">Spacing between lines</div>
              </div>
            </div>
          `
        : html`
            <div class="property-row">
              <div class="property-left">
                <ha-textfield
                  label="Line Spacing"
                  .value=${text.line_spacing?.toString() || ''}
                  .configValue=${`${textPath}.line_spacing`}
                  @input=${onValueChanged}
                ></ha-textfield>
                <div class="helper-text">Spacing between lines</div>
              </div>
            </div>
          `}
    `;
  }

  private static _renderEntityTextWidgetFields(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    if (element.type !== 'entity-text-widget') {
      return '';
    }

    const label = text.label || {};
    const value = text.value || {};
    const labelPath = `${textPath}.label`;
    const valuePath = `${textPath}.value`;

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Label Configuration</div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Content"
              .value=${label.content || ''}
              .configValue=${`${labelPath}.content`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Custom label text</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Width"
              type="number"
              .value=${label.width?.toString() || ''}
              .configValue=${`${labelPath}.width`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Label width in pixels</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Font Family"
              .value=${label.font_family || ''}
              .configValue=${`${labelPath}.font_family`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font family for label</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Font Weight"
              .value=${label.font_weight?.toString() || ''}
              .configValue=${`${labelPath}.font_weight`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font weight for label</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Color"
              .value=${ColorFormatter.toString(label.fill) || ''}
              .configValue=${`${labelPath}.fill`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Color for label</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Offset X"
              type="number"
              .value=${label.offset_x?.toString() || ''}
              .configValue=${`${labelPath}.offset_x`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Horizontal offset for label</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Text Transform"
              .value=${label.text_transform || ''}
              .configValue=${`${labelPath}.text_transform`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text transformation for label (e.g., uppercase)</div>
          </div>
          <div class="property-right">
            <ha-formfield label="Label Cutout">
              <ha-checkbox
                .checked=${label.cutout || false}
                .configValue=${`${labelPath}.cutout`}
                @change=${onCheckboxChanged}
              ></ha-checkbox>
            </ha-formfield>
            <div class="helper-text">Enable cutout effect for label</div>
          </div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Value Configuration</div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Width"
              type="number"
              .value=${value.width?.toString() || ''}
              .configValue=${`${valuePath}.width`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Value width in pixels</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Font Family"
              .value=${value.font_family || ''}
              .configValue=${`${valuePath}.font_family`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font family for value</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Font Weight"
              .value=${value.font_weight?.toString() || ''}
              .configValue=${`${valuePath}.font_weight`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font weight for value</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Color"
              .value=${ColorFormatter.toString(value.fill) || ''}
              .configValue=${`${valuePath}.fill`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Color for value</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Offset X"
              type="number"
              .value=${value.offset_x?.toString() || ''}
              .configValue=${`${valuePath}.offset_x`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Horizontal offset for value</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Text Transform"
              .value=${value.text_transform || ''}
              .configValue=${`${valuePath}.text_transform`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text transformation for value (e.g., uppercase)</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-formfield label="Value Cutout">
              <ha-checkbox
                .checked=${value.cutout || false}
                .configValue=${`${valuePath}.cutout`}
                @change=${onCheckboxChanged}
              ></ha-checkbox>
            </ha-formfield>
            <div class="helper-text">Enable cutout effect for value</div>
          </div>
        </div>
      </div>
    `;
  }

  private static _renderEntityMetricWidgetFields(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    if (element.type !== 'entity-metric-widget') {
      return '';
    }

    const label = text.label || {};
    const value = text.value || {};
    const unit = text.unit || {};
    const labelPath = `${textPath}.label`;
    const valuePath = `${textPath}.value`;
    const unitPath = `${textPath}.unit`;

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Label Configuration</div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Content"
              .value=${label.content || ''}
              .configValue=${`${labelPath}.content`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Custom label text</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Width"
              type="number"
              .value=${label.width?.toString() || ''}
              .configValue=${`${labelPath}.width`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Label width in pixels</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Font Family"
              .value=${label.font_family || ''}
              .configValue=${`${labelPath}.font_family`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font family for label</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Font Weight"
              .value=${label.font_weight?.toString() || ''}
              .configValue=${`${labelPath}.font_weight`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font weight for label</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Color"
              .value=${ColorFormatter.toString(label.fill) || ''}
              .configValue=${`${labelPath}.fill`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Color for label</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Label Offset X"
              type="number"
              .value=${label.offset_x?.toString() || ''}
              .configValue=${`${labelPath}.offset_x`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Horizontal offset for label</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Label Text Transform"
              .value=${label.text_transform || ''}
              .configValue=${`${labelPath}.text_transform`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text transformation for label (e.g., uppercase)</div>
          </div>
          <div class="property-right">
            <ha-formfield label="Label Cutout">
              <ha-checkbox
                .checked=${label.cutout || false}
                .configValue=${`${labelPath}.cutout`}
                @change=${onCheckboxChanged}
              ></ha-checkbox>
            </ha-formfield>
            <div class="helper-text">Enable cutout effect for label</div>
          </div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Value Configuration</div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Width"
              type="number"
              .value=${value.width?.toString() || ''}
              .configValue=${`${valuePath}.width`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Value width in pixels</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Font Family"
              .value=${value.font_family || ''}
              .configValue=${`${valuePath}.font_family`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font family for value</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Font Weight"
              .value=${value.font_weight?.toString() || ''}
              .configValue=${`${valuePath}.font_weight`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font weight for value</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Color"
              .value=${ColorFormatter.toString(value.fill) || ''}
              .configValue=${`${valuePath}.fill`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Color for value</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Value Offset X"
              type="number"
              .value=${value.offset_x?.toString() || ''}
              .configValue=${`${valuePath}.offset_x`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Horizontal offset for value</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Value Text Transform"
              .value=${value.text_transform || ''}
              .configValue=${`${valuePath}.text_transform`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text transformation for value (e.g., uppercase)</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-formfield label="Value Cutout">
              <ha-checkbox
                .checked=${value.cutout || false}
                .configValue=${`${valuePath}.cutout`}
                @change=${onCheckboxChanged}
              ></ha-checkbox>
            </ha-formfield>
            <div class="helper-text">Enable cutout effect for value</div>
          </div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Unit Configuration</div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Unit Content"
              .value=${unit.content || ''}
              .configValue=${`${unitPath}.content`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Custom unit text (e.g., "°F", "kWh")</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Unit Width"
              type="number"
              .value=${unit.width?.toString() || ''}
              .configValue=${`${unitPath}.width`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Unit width in pixels</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Unit Font Family"
              .value=${unit.font_family || ''}
              .configValue=${`${unitPath}.font_family`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font family for unit</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Unit Font Weight"
              .value=${unit.font_weight?.toString() || ''}
              .configValue=${`${unitPath}.font_weight`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Font weight for unit</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Unit Color"
              .value=${ColorFormatter.toString(unit.fill) || ''}
              .configValue=${`${unitPath}.fill`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Color for unit</div>
          </div>
          <div class="property-right">
            <ha-textfield
              label="Unit Offset X"
              type="number"
              .value=${unit.offset_x?.toString() || ''}
              .configValue=${`${unitPath}.offset_x`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Horizontal offset for unit</div>
          </div>
        </div>

        <div class="property-row">
          <div class="property-left">
            <ha-textfield
              label="Unit Text Transform"
              .value=${unit.text_transform || ''}
              .configValue=${`${unitPath}.text_transform`}
              @input=${onValueChanged}
            ></ha-textfield>
            <div class="helper-text">Text transformation for unit (e.g., uppercase)</div>
          </div>
          <div class="property-right">
            <ha-formfield label="Unit Cutout">
              <ha-checkbox
                .checked=${unit.cutout || false}
                .configValue=${`${unitPath}.cutout`}
                @change=${onCheckboxChanged}
              ></ha-checkbox>
            </ha-formfield>
            <div class="helper-text">Enable cutout effect for unit</div>
          </div>
        </div>
      </div>
    `;
  }
}
