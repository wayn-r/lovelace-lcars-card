import { LitElement, html, TemplateResult, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';
import { LcarsCardConfig } from './types';
import { editorStyles } from './styles/styles';

interface SelectedElement {
  groupIndex: number;
  elementIndex: number;
}

@customElement('lovelace-lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: LcarsCardConfig;
  @state() private _helpers?: any;
  @state() private _selectedElement?: SelectedElement;
  @state() private _filterText: string = '';
  @state() private _collapsedGroups: Set<number> = new Set();
  @state() private _browserExpanded: boolean = true;

  public setConfig(config: LcarsCardConfig): void {
    this._config = config;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;
    let value = target.value;

    if (!configValue) {
      return;
    }

    // Convert to number if it's a numeric string (for width/height)
    if (value && !isNaN(value) && value.trim() !== '') {
      value = Number(value);
    }

    // Create a deep copy of the config
    const newConfig = JSON.parse(JSON.stringify(this._config));
    
    // Handle nested properties (e.g., "title" or element properties like "groups.0.elements.1.layout.width")
    if (configValue.includes('.')) {
      const keys = configValue.split('.');
      let obj: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        // Handle array indices
        if (!isNaN(Number(key))) {
          obj = obj[Number(key)];
        } else {
          if (!obj[key]) {
            obj[key] = {};
          }
          obj = obj[key];
        }
      }
      const lastKey = keys[keys.length - 1];
      obj[lastKey] = value;
    } else {
      (newConfig as any)[configValue] = value;
    }

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _selectElement(groupIndex: number, elementIndex: number): void {
    this._selectedElement = { groupIndex, elementIndex };
    this._browserExpanded = false; // Collapse browser when element is selected
  }

  private _toggleBrowser(): void {
    this._browserExpanded = !this._browserExpanded;
  }

  private _getSelectedElementPath(): string {
    if (!this._selectedElement || !this._config?.groups) return '';
    const { groupIndex, elementIndex } = this._selectedElement;
    const group = this._config.groups[groupIndex];
    const element = group?.elements?.[elementIndex];
    if (!group || !element) return '';
    return `${group.group_id}.${element.id}`;
  }

  private _toggleGroup(groupIndex: number): void {
    const newCollapsed = new Set(this._collapsedGroups);
    if (newCollapsed.has(groupIndex)) {
      newCollapsed.delete(groupIndex);
    } else {
      newCollapsed.add(groupIndex);
    }
    this._collapsedGroups = newCollapsed;
  }

  private _filterChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this._filterText = target.value.toLowerCase();
  }

  private _matchesFilter(elementId: string, elementType: string): boolean {
    if (!this._filterText) return true;
    const filter = this._filterText.toLowerCase();
    return elementId.toLowerCase().includes(filter) || 
           elementType.toLowerCase().includes(filter);
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

        ${this._renderElementBrowser()}
        ${this._renderElementConfig()}

        <div class="info-box">
          <ha-icon icon="mdi:information-outline"></ha-icon>
          <div class="info-content">
            <strong>Visual Editor - Beta</strong>
            <p>${this._selectedElement ? 'Configure the selected element below.' : 'Select an element from the browser to configure its properties.'}</p>
            <p>Groups: ${this._config.groups?.length || 0} | 
               Elements: ${this._config.groups?.reduce((acc, g) => acc + (g.elements?.length || 0), 0) || 0}</p>
          </div>
        </div>
      </div>
    `;
  }

  private _renderElementBrowser(): TemplateResult {
    // Show collapsed view when element is selected and browser is not expanded
    if (this._selectedElement && !this._browserExpanded) {
      const elementPath = this._getSelectedElementPath();
      
      return html`
        <div class="section">
          <div class="browser-collapsed" @click=${this._toggleBrowser}>
            <div class="collapsed-content">
              <ha-icon icon="mdi:file-tree"></ha-icon>
              <span class="element-path">${elementPath}</span>
            </div>
            <ha-icon icon="mdi:chevron-down" class="expand-icon"></ha-icon>
          </div>
        </div>
      `;
    }

    // Show full browser
    return html`
      <div class="section">
        <div class="section-header">
          <ha-icon icon="mdi:file-tree"></ha-icon>
          <span>Element Browser</span>
          ${this._selectedElement ? html`
            <ha-icon 
              icon="mdi:chevron-up" 
              class="collapse-browser-icon"
              @click=${this._toggleBrowser}
              title="Collapse browser"
            ></ha-icon>
          ` : ''}
        </div>
        
        <div class="filter-box">
          <ha-textfield
            label="Filter elements..."
            .value=${this._filterText}
            @input=${this._filterChanged}
            .placeholder=${'Search by ID or type'}
          >
            <ha-icon icon="mdi:magnify" slot="leadingIcon"></ha-icon>
          </ha-textfield>
        </div>

        ${this._renderGroups()}
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
      <div class="groups-tree">
        ${this._config.groups.map((group, groupIndex) => {
          const isCollapsed = this._collapsedGroups.has(groupIndex);
          const filteredElements = group.elements?.filter(
            (element, elementIndex) => this._matchesFilter(element.id, element.type)
          ) || [];
          
          // Hide group if no elements match filter
          if (this._filterText && filteredElements.length === 0) {
            return html``;
          }

          return html`
            <div class="group-item">
              <div 
                class="group-header clickable"
                @click=${() => this._toggleGroup(groupIndex)}
              >
                <ha-icon 
                  icon=${isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
                  class="collapse-icon"
                ></ha-icon>
                <ha-icon icon="mdi:folder"></ha-icon>
                <div class="group-info">
                  <span class="group-name">${group.group_id}</span>
                  <span class="group-meta">
                    (${filteredElements.length}${this._filterText ? ` of ${group.elements?.length || 0}` : ''})
                  </span>
                </div>
              </div>
              ${!isCollapsed && group.elements && group.elements.length > 0 ? html`
                <div class="elements-list">
                  ${group.elements.map((element, elementIndex) => {
                    if (!this._matchesFilter(element.id, element.type)) {
                      return html``;
                    }
                    const isSelected = this._selectedElement?.groupIndex === groupIndex && 
                                      this._selectedElement?.elementIndex === elementIndex;
                    return html`
                      <div 
                        class="element-item ${isSelected ? 'selected' : ''}"
                        @click=${() => this._selectElement(groupIndex, elementIndex)}
                      >
                        <ha-icon icon=${this._getElementIcon(element.type)}></ha-icon>
                        <span class="element-id">${element.id}</span>
                        <span class="element-type">${element.type}</span>
                      </div>
                    `;
                  })}
                </div>
              ` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderElementConfig(): TemplateResult {
    if (!this._selectedElement || !this._config?.groups) {
      return html``; // Don't show config section when nothing is selected
    }

    const { groupIndex, elementIndex } = this._selectedElement;
    const group = this._config.groups[groupIndex];
    const element = group?.elements?.[elementIndex];

    if (!element) {
      return html`
        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:cog"></ha-icon>
            <span>Element Configuration</span>
          </div>
          <div class="empty-state">
            <ha-icon icon="mdi:alert"></ha-icon>
            <p>Element not found</p>
          </div>
        </div>
      `;
    }

    const layout = element.layout || {};
    const configPath = `groups.${groupIndex}.elements.${elementIndex}.layout`;

    return html`
      <div class="section">
        <div class="section-header">
          <ha-icon icon="mdi:cog"></ha-icon>
          <span>Element Configuration</span>
        </div>

        <div class="config-panel">
          <div class="element-info-header">
            <ha-icon icon=${this._getElementIcon(element.type)}></ha-icon>
            <div>
              <div class="element-title">${element.id}</div>
              <div class="element-subtitle">${element.type}</div>
            </div>
          </div>

          <div class="config-section">
            <div class="config-section-header">Layout Properties</div>
            
            <div class="config-row">
              <ha-textfield
                label="Width"
                .value=${layout.width?.toString() || ''}
                .configValue=${`${configPath}.width`}
                @input=${this._valueChanged}
                .placeholder=${'auto'}
              ></ha-textfield>
              <div class="helper-text">Number (pixels) or percentage string (e.g., "50%")</div>
            </div>

            <div class="config-row">
              <ha-textfield
                label="Height"
                .value=${layout.height?.toString() || ''}
                .configValue=${`${configPath}.height`}
                @input=${this._valueChanged}
                .placeholder=${'auto'}
              ></ha-textfield>
              <div class="helper-text">Number (pixels) or percentage string (e.g., "25%")</div>
            </div>
          </div>

          <div class="config-footer">
            <ha-icon icon="mdi:information-outline"></ha-icon>
            <span>More configuration options coming soon</span>
          </div>
        </div>
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

  static get styles(): CSSResultGroup {
    return editorStyles;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lovelace-lcars-card-editor': LcarsCardEditor;
  }
}

