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
      <div class="config-section">
        <div class="config-section-header">Text Properties</div>
        
        ${this._renderContentFields(element, text, textPath, onValueChanged)}
        ${this._renderStandardTextFields(text, textPath, onValueChanged)}
        ${this._renderCutoutField(element, text, textPath, onCheckboxChanged)}
        ${this._renderElbowPositionField(element, text, textPath, onValueChanged)}
        ${this._renderOffsetAndSpacingFields(text, textPath, onValueChanged)}
      </div>
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
        <div class="config-row">
          <ha-textfield
            label="Left Content"
            .value=${text.left_content || ''}
            .configValue=${`${textPath}.left_content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Text to display on the left</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Right Content"
            .value=${text.right_content || ''}
            .configValue=${`${textPath}.right_content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Text to display on the right</div>
        </div>
      `;
    }

    return html`
      <div class="config-row">
        <ha-textfield
          label="Content"
          .value=${text.content || ''}
          .configValue=${`${textPath}.content`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Text content to display</div>
      </div>
    `;
  }

  private static _renderStandardTextFields(
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    return html`
      <div class="config-row">
        <ha-textfield
          label="Text Color"
          .value=${ColorFormatter.toString(text.fill || text.text_color) || ''}
          .configValue=${`${textPath}.fill`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Text color</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Font Family"
          .value=${text.font_family || ''}
          .configValue=${`${textPath}.font_family`}
          @input=${onValueChanged}
          .placeholder=${'Antonio'}
        ></ha-textfield>
        <div class="helper-text">Font family name</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Font Size"
          type="number"
          .value=${text.font_size?.toString() || ''}
          .configValue=${`${textPath}.font_size`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Font size in pixels</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Font Weight"
          .value=${text.font_weight?.toString() || ''}
          .configValue=${`${textPath}.font_weight`}
          @input=${onValueChanged}
          .placeholder=${'normal'}
        ></ha-textfield>
        <div class="helper-text">Font weight (e.g., bold, 600)</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Letter Spacing"
          .value=${text.letter_spacing?.toString() || ''}
          .configValue=${`${textPath}.letter_spacing`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Letter spacing (e.g., 2px or 0.1em)</div>
      </div>

      <div class="config-row">
        <ha-select
          label="Text Anchor"
          .value=${text.text_anchor || ''}
          .configValue=${`${textPath}.text_anchor`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="">Default</mwc-list-item>
          <mwc-list-item value="start">Start</mwc-list-item>
          <mwc-list-item value="middle">Middle</mwc-list-item>
          <mwc-list-item value="end">End</mwc-list-item>
        </ha-select>
        <div class="helper-text">Text alignment</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Text Transform"
          .value=${text.text_transform || ''}
          .configValue=${`${textPath}.text_transform`}
          @input=${onValueChanged}
          .placeholder=${'uppercase'}
        ></ha-textfield>
        <div class="helper-text">Text transformation (e.g., uppercase, lowercase)</div>
      </div>
    `;
  }

  private static _renderCutoutField(
    element: any,
    text: any,
    textPath: string,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult | string {
    if (element.type !== 'text' && element.type !== 'elbow') {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-formfield label="Cutout">
          <ha-checkbox
            .checked=${text.cutout || false}
            .configValue=${`${textPath}.cutout`}
            @change=${onCheckboxChanged}
          ></ha-checkbox>
        </ha-formfield>
        <div class="helper-text">Enable text cutout effect</div>
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
      <div class="config-row">
        <ha-select
          label="Elbow Text Position"
          .value=${text.elbow_text_position || ''}
          .configValue=${`${textPath}.elbow_text_position`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="">Default</mwc-list-item>
          <mwc-list-item value="arm">Arm</mwc-list-item>
          <mwc-list-item value="body">Body</mwc-list-item>
        </ha-select>
        <div class="helper-text">Position of text in elbow</div>
      </div>
    `;
  }

  private static _renderOffsetAndSpacingFields(
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    return html`
      <div class="config-row">
        <ha-textfield
          label="Text Offset X"
          .value=${text.offset_x?.toString() || ''}
          .configValue=${`${textPath}.offset_x`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Horizontal text offset</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Text Offset Y"
          .value=${text.offset_y?.toString() || ''}
          .configValue=${`${textPath}.offset_y`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Vertical text offset</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Max Lines"
          type="number"
          .value=${text.max_lines?.toString() || ''}
          .configValue=${`${textPath}.max_lines`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Maximum number of text lines</div>
      </div>

      <div class="config-row">
        <ha-textfield
          label="Line Spacing"
          .value=${text.line_spacing?.toString() || ''}
          .configValue=${`${textPath}.line_spacing`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Spacing between lines</div>
      </div>
    `;
  }
}

