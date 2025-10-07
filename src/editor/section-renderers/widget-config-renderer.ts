import { html, TemplateResult } from 'lit';
import { ElementMetadata } from '../element-metadata.js';

export class WidgetConfigRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void,
    onCheckboxChanged?: (ev: Event) => void
  ): TemplateResult | string {
    if (!this._isWidget(element.type)) {
      return '';
    }

    return html`
      ${this._renderGraphWidgetInfo(element)}
      ${this._renderVerticalSliderInfo(element)}
    `;
  }

  private static _isWidget(type: string): boolean {
    return ['entity-text-widget', 'entity-metric-widget', 'graph-widget', 'vertical-slider', 'weather-icon', 'logger-widget'].includes(type);
  }

  private static _renderGraphWidgetInfo(element: any): TemplateResult | string {
    if (element.type !== 'graph-widget') {
      return '';
    }

    return html`
      <div class="info-box">
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <div class="info-content">
          <p>Graph widget options are organized by their schema structure:</p>
          <ul>
            <li><strong>Appearance section:</strong> Min/max values, grid configuration (num_lines, fill, label_fill)</li>
            <li><strong>Entity section:</strong> Entity selection</li>
          </ul>
          <p>Advanced options like multi-entity configuration, entity colors, toggleable graphs, and animations are not yet supported in the visual editor. Please use YAML mode to configure these options.</p>
        </div>
      </div>
    `;
  }

  private static _renderVerticalSliderInfo(element: any): TemplateResult | string {
    if (element.type !== 'vertical-slider') {
      return '';
    }

    return html`
      <div class="info-box">
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <div class="info-content">
          <p>Vertical slider options are organized by their schema structure:</p>
          <ul>
            <li><strong>Appearance section:</strong> Min/max values, spacing, top_padding, label_height, use_floats</li>
            <li><strong>Entity section:</strong> Entity selection</li>
          </ul>
          <p>Advanced options like multi-entity configuration and entity-specific min/max values are not yet supported in the visual editor. Please use YAML mode to configure these options.</p>
        </div>
      </div>
    `;
  }
}

