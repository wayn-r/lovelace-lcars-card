import { html, TemplateResult } from 'lit';

export class ButtonConfigRenderer {
  static render(
    element: any,
    basePath: string,
    onCheckboxChanged: (ev: Event) => void
  ): TemplateResult {
    const button = element.button || {};
    const buttonPath = `${basePath}.button`;

    return html`
      <div class="config-row">
        <ha-formfield label="Enable Button">
          <ha-checkbox
            .checked=${button.enabled || false}
            .configValue=${`${buttonPath}.enabled`}
            @change=${onCheckboxChanged}
          ></ha-checkbox>
        </ha-formfield>
        <div class="helper-text">Make this element clickable</div>
      </div>

      ${this._renderActionsInfoBox(button)}
    `;
  }

  private static _renderActionsInfoBox(button: any): TemplateResult | string {
    if (!button.enabled) {
      return '';
    }

    return html`
      <div class="info-box">
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <div class="info-content">
          <p>Action configuration is not yet supported in the visual editor. Please use YAML mode to configure tap, hold, and double-tap actions.</p>
        </div>
      </div>
    `;
  }
}

