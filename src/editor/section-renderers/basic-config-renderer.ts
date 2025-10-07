import { html, TemplateResult } from 'lit';
import { ElementMetadata } from '../element-metadata.js';

export class BasicConfigRenderer {
  static render(element: any, basePath: string, onValueChanged: (ev: CustomEvent) => void): TemplateResult {
    const elementTypes = ElementMetadata.getAllElementTypes();

    return html`
      <div class="config-row">
        <ha-textfield
          label="Element ID"
          .value=${element.id || ''}
          .configValue=${`${basePath}.id`}
          @input=${onValueChanged}
        ></ha-textfield>
        <div class="helper-text">Unique identifier for this element</div>
      </div>

      <div class="config-row">
        <ha-select
          label="Element Type"
          .value=${element.type || 'rectangle'}
          .configValue=${`${basePath}.type`}
          @selected=${onValueChanged}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          ${elementTypes.map(type => html`
            <mwc-list-item .value=${type}>${type}</mwc-list-item>
          `)}
        </ha-select>
        <div class="helper-text">Type of LCARS element</div>
      </div>

      ${this._renderAttributeField(element, basePath, onValueChanged)}
    `;
  }

  private static _renderAttributeField(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (!element.attribute && !ElementMetadata.supportsAttribute(element.type)) {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-textfield
          label="Attribute"
          .value=${element.attribute || ''}
          .configValue=${`${basePath}.attribute`}
          @input=${onValueChanged}
          .placeholder=${'state'}
        ></ha-textfield>
        <div class="helper-text">Entity attribute to use (default: state)</div>
      </div>
    `;
  }
}

