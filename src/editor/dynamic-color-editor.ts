import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import { DynamicColorConfig, isDynamicColorConfig } from '../types';

@customElement('dynamic-color-editor')
export class DynamicColorEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ type: Object }) public value: any = {};
  @property({ type: String }) public label = '';
  @property({ type: String }) public name = '';

  @state() private _colorMode: 'static' | 'dynamic' = 'static';
  @state() private _staticColor: number[] = [0, 102, 255];
  @state() private _dynamicConfig: Partial<DynamicColorConfig> = {
    entity: '',
    attribute: 'state',
    mapping: {},
    default: [102, 102, 102],
    interpolate: false
  };

  static styles = css`
    .dynamic-color-editor {
      padding: 16px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
      background: var(--card-background-color, #fff);
    }

    .mode-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .mode-button {
      padding: 8px 16px;
      border: 1px solid var(--primary-color, #03a9f4);
      border-radius: 4px;
      background: transparent;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      transition: all 0.2s;
    }

    .mode-button.active {
      background: var(--primary-color, #03a9f4);
      color: white;
    }

    .config-section {
      margin-bottom: 16px;
    }

    .config-section label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }

    .config-section input,
    .config-section select {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
    }

    .mapping-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    .mapping-table th,
    .mapping-table td {
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      text-align: left;
    }

    .mapping-table th {
      background: var(--table-header-background-color, #f5f5f5);
    }

    .add-mapping-button {
      margin-top: 8px;
      padding: 8px 16px;
      background: var(--primary-color, #03a9f4);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .remove-mapping-button {
      padding: 4px 8px;
      background: var(--error-color, #f44336);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .checkbox-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._initializeFromValue();
  }

  private _initializeFromValue() {
    if (this.value?.type === 'dynamic') {
      this._colorMode = 'dynamic';
      this._dynamicConfig = {
        entity: this.value.entity || '',
        attribute: this.value.attribute || 'state',
        mapping: this.value.mapping || {},
        default: this.value.default || [102, 102, 102],
        interpolate: this.value.interpolate || false
      };
    } else {
      this._colorMode = 'static';
      this._staticColor = this.value?.color || [0, 102, 255];
    }
  }

  private _setColorMode(mode: 'static' | 'dynamic') {
    this._colorMode = mode;
    this._fireChange();
  }

  private _handleStaticColorChange(event: Event) {
    const target = event.target as any;
    if (target.value) {
      this._staticColor = target.value;
      this._fireChange();
    }
  }

  private _handleEntityChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this._dynamicConfig = {
      ...this._dynamicConfig,
      entity: target.value
    };
    this._fireChange();
  }

  private _handleAttributeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this._dynamicConfig = {
      ...this._dynamicConfig,
      attribute: target.value
    };
    this._fireChange();
  }

  private _handleDefaultColorChange(event: Event) {
    const target = event.target as any;
    if (target.value) {
      this._dynamicConfig = {
        ...this._dynamicConfig,
        default: target.value
      };
      this._fireChange();
    }
  }

  private _handleInterpolateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this._dynamicConfig = {
      ...this._dynamicConfig,
      interpolate: target.checked
    };
    this._fireChange();
  }

  private _addMapping() {
    const newMapping = { ...this._dynamicConfig.mapping };
    newMapping['new_state'] = [128, 128, 128];
    this._dynamicConfig = {
      ...this._dynamicConfig,
      mapping: newMapping
    };
    this._fireChange();
  }

  private _removeMapping(key: string) {
    const newMapping = { ...this._dynamicConfig.mapping };
    delete newMapping[key];
    this._dynamicConfig = {
      ...this._dynamicConfig,
      mapping: newMapping
    };
    this._fireChange();
  }

  private _handleMappingKeyChange(oldKey: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const newKey = target.value;
    if (newKey !== oldKey) {
      const newMapping = { ...this._dynamicConfig.mapping };
      newMapping[newKey] = newMapping[oldKey];
      delete newMapping[oldKey];
      this._dynamicConfig = {
        ...this._dynamicConfig,
        mapping: newMapping
      };
      this._fireChange();
    }
  }

  private _handleMappingColorChange(key: string, event: Event) {
    const target = event.target as any;
    if (target.value) {
      const newMapping = { ...this._dynamicConfig.mapping };
      newMapping[key] = target.value;
      this._dynamicConfig = {
        ...this._dynamicConfig,
        mapping: newMapping
      };
      this._fireChange();
    }
  }

  private _fireChange() {
    let newValue;
    
    if (this._colorMode === 'static') {
      newValue = this._staticColor;
    } else {
      newValue = {
        entity: this._dynamicConfig.entity,
        attribute: this._dynamicConfig.attribute,
        mapping: this._dynamicConfig.mapping,
        default: this._dynamicConfig.default,
        interpolate: this._dynamicConfig.interpolate
      } as DynamicColorConfig;
    }

    this.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: newValue },
      bubbles: true,
      composed: true
    }));
  }

  private _getEntityOptions(): { value: string; label: string }[] {
    if (!this.hass) return [];
    
    return Object.keys(this.hass.states).map(entityId => ({
      value: entityId,
      label: `${entityId} (${this.hass!.states[entityId].attributes.friendly_name || entityId})`
    }));
  }

  protected render(): TemplateResult {
    return html`
      <div class="dynamic-color-editor">
        <div class="mode-selector">
          <button 
            class="mode-button ${this._colorMode === 'static' ? 'active' : ''}"
            @click=${() => this._setColorMode('static')}
          >
            Static Color
          </button>
          <button 
            class="mode-button ${this._colorMode === 'dynamic' ? 'active' : ''}"
            @click=${() => this._setColorMode('dynamic')}
          >
            Dynamic Color
          </button>
        </div>

        ${this._colorMode === 'static' ? this._renderStaticMode() : this._renderDynamicMode()}
      </div>
    `;
  }

  private _renderStaticMode(): TemplateResult {
    return html`
      <div class="config-section">
        <label>Color</label>
        <ha-color-picker
          .value=${this._staticColor}
          @value-changed=${this._handleStaticColorChange}
        ></ha-color-picker>
      </div>
    `;
  }

  private _renderDynamicMode(): TemplateResult {
    return html`
      <div class="config-section">
        <label>Entity</label>
        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._dynamicConfig.entity}
          @value-changed=${this._handleEntityChange}
        ></ha-entity-picker>
      </div>

      <div class="config-section">
        <label>Attribute (leave empty for state)</label>
        <input
          type="text"
          .value=${this._dynamicConfig.attribute || 'state'}
          @input=${this._handleAttributeChange}
          placeholder="state"
        />
      </div>

      <div class="config-section">
        <label>Default Color</label>
        <ha-color-picker
          .value=${this._dynamicConfig.default}
          @value-changed=${this._handleDefaultColorChange}
        ></ha-color-picker>
      </div>

      <div class="config-section">
        <label>State → Color Mapping</label>
        <table class="mapping-table">
          <thead>
            <tr>
              <th>Entity Value</th>
              <th>Color</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(this._dynamicConfig.mapping || {}).map(([key, color]) => html`
              <tr>
                <td>
                  <input
                    type="text"
                    .value=${key}
                    @input=${(e: Event) => this._handleMappingKeyChange(key, e)}
                    placeholder="e.g., on, off, 25"
                  />
                </td>
                <td>
                  <ha-color-picker
                    .value=${color}
                    @value-changed=${(e: Event) => this._handleMappingColorChange(key, e)}
                  ></ha-color-picker>
                </td>
                <td>
                  <button 
                    class="remove-mapping-button"
                    @click=${() => this._removeMapping(key)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
        <button class="add-mapping-button" @click=${this._addMapping}>
          Add Mapping
        </button>
      </div>

      <div class="checkbox-container">
        <input
          type="checkbox"
          id="interpolate"
          .checked=${this._dynamicConfig.interpolate || false}
          @change=${this._handleInterpolateChange}
        />
        <label for="interpolate">Enable interpolation for numeric values</label>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dynamic-color-editor': DynamicColorEditor;
  }
} 