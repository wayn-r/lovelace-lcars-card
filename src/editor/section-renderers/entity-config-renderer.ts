import { html, TemplateResult } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { ElementMetadata } from '../element-metadata.js';

export class EntityConfigRenderer {
  static render(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    onEntityChanged: (ev: CustomEvent) => void,
    onEntityArrayItemChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    if (!ElementMetadata.requiresEntity(element.type)) {
      return '';
    }

    const entity = element.entity;

    return html`
      <div class="config-section">
        <div class="config-section-header">Entity Configuration</div>
        
        <div class="config-row">
          <ha-entity-picker
            .hass=${hass}
            .value=${Array.isArray(entity) ? entity[0] : entity}
            .configValue=${`${basePath}.entity`}
            @value-changed=${onEntityChanged}
            allow-custom-entity
          ></ha-entity-picker>
          <div class="helper-text">
            ${ElementMetadata.getEntityHelpText(element.type)}
          </div>
        </div>

        ${this._renderSecondaryEntityPicker(element, entity, basePath, hass, onEntityArrayItemChanged)}
      </div>
    `;
  }

  private static _renderSecondaryEntityPicker(
    element: any,
    entity: any,
    basePath: string,
    hass: HomeAssistant,
    onEntityArrayItemChanged: (ev: CustomEvent) => void
  ): TemplateResult | string {
    const supportsSecondaryEntity = element.type === 'entity-text-widget' || 
                                    element.type === 'entity-metric-widget';
    const hasSecondaryEntity = Array.isArray(entity) && entity.length > 1;

    if (!supportsSecondaryEntity || !hasSecondaryEntity) {
      return '';
    }

    return html`
      <div class="config-row">
        <ha-entity-picker
          .hass=${hass}
          .value=${entity[1]}
          .configValue=${`${basePath}.entity.1`}
          @value-changed=${onEntityArrayItemChanged}
          allow-custom-entity
          label="Secondary Entity (optional)"
        ></ha-entity-picker>
        <div class="helper-text">Optional secondary entity (shown in parentheses)</div>
      </div>
    `;
  }
}

