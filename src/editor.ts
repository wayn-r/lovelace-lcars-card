import { LitElement, html, TemplateResult, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';
import { LcarsCardConfig } from './types';
import { editorStyles } from './styles/styles';

@customElement('lovelace-lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: LcarsCardConfig;
  @state() private _helpers?: any;

  public setConfig(config: LcarsCardConfig): void {
    this._config = config;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;
    const value = target.value;

    if (!configValue) {
      return;
    }

    // Create a new config object with the updated value
    const newConfig = { ...this._config };
    
    // Handle nested properties (e.g., "title")
    if (configValue.includes('.')) {
      const keys = configValue.split('.');
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
    } else {
      (newConfig as any)[configValue] = value;
    }

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html`<div>Loading...</div>`;
    }

    return html`
      <div class="card-config">
        <div class="header">
          <div class="title">LCARS Card Configuration</div>
          <div class="subtitle">Configure your LCARS-themed dashboard card</div>
        </div>

        <div class="option">
          <ha-textfield
            label="Card Title"
            .value=${this._config.title || ''}
            .configValue=${'title'}
            @input=${this._valueChanged}
          ></ha-textfield>
          <div class="helper-text">Optional title for the card</div>
        </div>

        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:view-grid-outline"></ha-icon>
            <span>Groups</span>
          </div>
          
          ${this._renderGroups()}
        </div>

        <div class="info-box">
          <ha-icon icon="mdi:information-outline"></ha-icon>
          <div class="info-content">
            <strong>Visual Editor - Beta</strong>
            <p>This is a simplified visual editor. For advanced configuration options, please use the YAML editor.</p>
            <p>Groups: ${this._config.groups?.length || 0} | 
               Elements: ${this._config.groups?.reduce((acc, g) => acc + (g.elements?.length || 0), 0) || 0}</p>
          </div>
        </div>

        <div class="yaml-section">
          <div class="section-header">
            <ha-icon icon="mdi:code-braces"></ha-icon>
            <span>Current Configuration</span>
          </div>
          <pre class="yaml-preview">${this._getYamlPreview()}</pre>
        </div>
      </div>
    `;
  }

  private _renderGroups(): TemplateResult {
    if (!this._config?.groups || this._config.groups.length === 0) {
      return html`
        <div class="empty-state">
          <ha-icon icon="mdi:folder-outline"></ha-icon>
          <p>No groups configured</p>
          <p class="helper-text">Add groups in YAML mode to see them here</p>
        </div>
      `;
    }

    return html`
      <div class="groups-list">
        ${this._config.groups.map((group, index) => html`
          <div class="group-card">
            <div class="group-header">
              <ha-icon icon="mdi:folder"></ha-icon>
              <div class="group-info">
                <div class="group-name">${group.group_id}</div>
                <div class="group-meta">
                  ${group.elements?.length || 0} element${group.elements?.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            ${group.elements && group.elements.length > 0 ? html`
              <div class="elements-list">
                ${group.elements.map((element) => html`
                  <div class="element-item">
                    <ha-icon icon=${this._getElementIcon(element.type)}></ha-icon>
                    <span class="element-id">${element.id}</span>
                    <span class="element-type">${element.type}</span>
                  </div>
                `)}
              </div>
            ` : ''}
          </div>
        `)}
      </div>
    `;
  }

  private _getElementIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'rectangle': 'mdi:rectangle-outline',
      'text': 'mdi:format-text',
      'endcap': 'mdi:arrow-right-bold',
      'elbow': 'mdi:arrow-top-right',
      'top_header': 'mdi:page-layout-header',
      'graph-widget': 'mdi:chart-line',
      'entity-text-widget': 'mdi:text-box',
      'entity-metric-widget': 'mdi:counter',
      'vertical-slider': 'mdi:tune-vertical',
      'weather-icon': 'mdi:weather-partly-cloudy',
    };
    return iconMap[type] || 'mdi:shape';
  }

  private _getYamlPreview(): string {
    if (!this._config) return '';
    
    // Create a simplified preview of the config
    const preview = {
      type: this._config.type,
      ...(this._config.title && { title: this._config.title }),
      groups: this._config.groups?.map(g => ({
        group_id: g.group_id,
        elements: `${g.elements?.length || 0} elements`
      }))
    };
    
    return JSON.stringify(preview, null, 2);
  }

  static get styles(): CSSResultGroup {
    return editorStyles;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lovelace-lcars-card-editor': LcarsCardEditor;
  }
}

