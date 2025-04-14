import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';
import { LcarsCardConfig } from './lovelace-lcars-card';
import { DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';

@customElement('lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) private _config?: LcarsCardConfig;
  @property({ attribute: false }) private _showAdvanced: boolean = false;

  // Define the styles for the editor
  static styles = css`
    .form-container {
      padding: 8px;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 12px;
    }
    .form-field label {
      margin-bottom: 4px;
    }
    .advanced-section {
      border-top: 1px solid #ccc;
      margin-top: 12px;
      padding-top: 12px;
    }
    .advanced-toggle {
      cursor: pointer;
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .advanced-toggle ha-icon {
      margin-right: 8px;
    }
    .yaml-editor {
      font-family: monospace;
      height: 300px;
    }
  `;

  public setConfig(config: LcarsCardConfig): void {
    this._config = config;
  }

  // Handle changes to the configuration
  private _valueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target as HTMLInputElement;
    const value = target.value;
    const configValue = target.configValue as keyof LcarsCardConfig;
    
    // Convert fontSize to number
    if (configValue === 'fontSize' && value !== '') {
      this._config = {
        ...this._config,
        [configValue]: parseInt(value, 10),
      };
    } else {
      this._config = {
        ...this._config,
        [configValue]: value,
      };
    }

    // Fire the config-changed event
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Toggle the advanced section
  private _toggleAdvanced(): void {
    this._showAdvanced = !this._showAdvanced;
  }

  // Handle YAML input changes
  private _yamlChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target as HTMLTextAreaElement;
    const value = target.value;
    
    try {
      // Parse YAML to get elements array
      const elements = JSON.parse(value);
      
      this._config = {
        ...this._config,
        elements,
      };
      
      // Fire the config-changed event
      fireEvent(this, 'config-changed', { config: this._config });
    } catch (e) {
      console.error('Error parsing YAML:', e);
    }
  }

  // Render the editor form
  protected render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const elementsJson = this._config.elements ? JSON.stringify(this._config.elements, null, 2) : '[]';

    return html`
      <div class="form-container">
        <div class="form-field">
          <label for="title">Title</label>
          <input
            id="title"
            type="text"
            .value="${this._config.title || DEFAULT_TITLE}"
            .configValue=${'title'}
            @input=${this._valueChanged}
          />
        </div>

        <div class="form-field">
          <label for="text">Text</label>
          <input
            id="text"
            type="text"
            .value="${this._config.text || DEFAULT_TEXT}"
            .configValue=${'text'}
            @input=${this._valueChanged}
          />
        </div>

        <div class="form-field">
          <label for="fontSize">Font Size (px)</label>
          <input
            id="fontSize"
            type="number"
            min="8"
            max="72"
            .value="${this._config.fontSize || DEFAULT_FONT_SIZE}"
            .configValue=${'fontSize'}
            @input=${this._valueChanged}
          />
        </div>

        <div class="advanced-toggle" @click=${this._toggleAdvanced}>
          <ha-icon .icon=${this._showAdvanced ? 'mdi:chevron-down' : 'mdi:chevron-right'}></ha-icon>
          <span>Advanced Configuration</span>
        </div>

        ${this._showAdvanced ? html`
          <div class="advanced-section">
            <div class="form-field">
              <label for="elementsConfig">Elements Configuration (JSON)</label>
              <textarea
                id="elementsConfig"
                class="yaml-editor"
                .value=${elementsJson}
                @change=${this._yamlChanged}
              ></textarea>
              <small>Configure LCARS elements using JSON format. See documentation for examples.</small>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
} 