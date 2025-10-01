import { html, TemplateResult } from 'lit';
import { ElementMetadata } from '../element-metadata.js';

export class WidgetConfigRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (!this._isWidget(element.type)) {
      return '';
    }

    const text = element.text || {};
    const textPath = `${basePath}.text`;

    return html`
      <div class="config-section">
        <div class="config-section-header">Widget-Specific Properties</div>
        
        ${this._renderEntityTextWidgetConfig(element, text, textPath, onValueChanged)}
        ${this._renderEntityMetricWidgetConfig(element, text, textPath, onValueChanged)}
      </div>
    `;
  }

  private static _isWidget(type: string): boolean {
    return ['entity-text-widget', 'entity-metric-widget', 'graph-widget', 'vertical-slider'].includes(type);
  }

  private static _renderEntityTextWidgetConfig(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'entity-text-widget') {
      return '';
    }

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Label Configuration</div>
        
        <div class="config-row">
          <ha-textfield
            label="Label Content"
            .value=${text.label?.content || ''}
            .configValue=${`${textPath}.label.content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Custom label text</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Label Width"
            type="number"
            .value=${text.label?.width?.toString() || ''}
            .configValue=${`${textPath}.label.width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Label width in pixels</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Label Font Family"
            .value=${text.label?.font_family || ''}
            .configValue=${`${textPath}.label.font_family`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font family for label</div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Value Configuration</div>
        
        <div class="config-row">
          <ha-textfield
            label="Value Width"
            type="number"
            .value=${text.value?.width?.toString() || ''}
            .configValue=${`${textPath}.value.width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Value width in pixels</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Value Font Family"
            .value=${text.value?.font_family || ''}
            .configValue=${`${textPath}.value.font_family`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font family for value</div>
        </div>
      </div>
    `;
  }

  private static _renderEntityMetricWidgetConfig(
    element: any,
    text: any,
    textPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (element.type !== 'entity-metric-widget') {
      return '';
    }

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Label Configuration</div>
        
        <div class="config-row">
          <ha-textfield
            label="Label Content"
            .value=${text.label?.content || ''}
            .configValue=${`${textPath}.label.content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Custom label text</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Label Width"
            type="number"
            .value=${text.label?.width?.toString() || ''}
            .configValue=${`${textPath}.label.width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Label width in pixels</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Label Font Family"
            .value=${text.label?.font_family || ''}
            .configValue=${`${textPath}.label.font_family`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font family for label</div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Value Configuration</div>
        
        <div class="config-row">
          <ha-textfield
            label="Value Width"
            type="number"
            .value=${text.value?.width?.toString() || ''}
            .configValue=${`${textPath}.value.width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Value width in pixels</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Value Font Family"
            .value=${text.value?.font_family || ''}
            .configValue=${`${textPath}.value.font_family`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font family for value</div>
        </div>
      </div>

      <div class="config-subsection">
        <div class="config-subsection-header">Unit Configuration</div>
        
        <div class="config-row">
          <ha-textfield
            label="Unit Content"
            .value=${text.unit?.content || ''}
            .configValue=${`${textPath}.unit.content`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Custom unit text (e.g., "°F", "kWh")</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Unit Width"
            type="number"
            .value=${text.unit?.width?.toString() || ''}
            .configValue=${`${textPath}.unit.width`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Unit width in pixels</div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Unit Font Family"
            .value=${text.unit?.font_family || ''}
            .configValue=${`${textPath}.unit.font_family`}
            @input=${onValueChanged}
          ></ha-textfield>
          <div class="helper-text">Font family for unit</div>
        </div>
      </div>
    `;
  }
}

