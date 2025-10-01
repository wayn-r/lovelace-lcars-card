import { LitElement, html, TemplateResult, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { LcarsCardConfig } from './types';
import { editorStyles } from './styles/styles';
import { ConfigUpdater } from './editor/config-updater.js';
import { ElementMetadata } from './editor/element-metadata.js';
import { BasicConfigRenderer } from './editor/section-renderers/basic-config-renderer.js';
import { LayoutConfigRenderer } from './editor/section-renderers/layout-config-renderer.js';
import { AppearanceConfigRenderer } from './editor/section-renderers/appearance-config-renderer.js';
import { TextConfigRenderer } from './editor/section-renderers/text-config-renderer.js';
import { EntityConfigRenderer } from './editor/section-renderers/entity-config-renderer.js';
import { ButtonConfigRenderer } from './editor/section-renderers/button-config-renderer.js';
import { WidgetConfigRenderer } from './editor/section-renderers/widget-config-renderer.js';
import { AdvancedLayoutRenderer } from './editor/section-renderers/advanced-layout-renderer.js';

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
    const value = target.value;

    if (!configValue) {
      return;
    }

    ConfigUpdater.updateNestedPath(this._config, configValue, value, this);
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

    const basePath = `groups.${groupIndex}.elements.${elementIndex}`;

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

          ${this._renderBasicConfig(element, basePath)}
          ${this._renderLayoutConfig(element, basePath)}
          ${this._renderAdvancedLayoutConfig(element, basePath)}
          ${this._renderAppearanceConfig(element, basePath)}
          ${this._renderTextConfig(element, basePath)}
          ${this._renderEntityConfig(element, basePath)}
          ${this._renderWidgetConfig(element, basePath)}
          ${this._renderButtonConfig(element, basePath)}
        </div>
      </div>
    `;
  }

  private _renderBasicConfig(element: any, basePath: string): TemplateResult {
    return BasicConfigRenderer.render(element, basePath, this._valueChanged.bind(this));
  }

  private _renderLayoutConfig(element: any, basePath: string): TemplateResult {
    return LayoutConfigRenderer.render(element, basePath, this._valueChanged.bind(this));
  }

  private _renderAppearanceConfig(element: any, basePath: string): TemplateResult {
    return AppearanceConfigRenderer.render(
      element,
      basePath,
      this._valueChanged.bind(this),
      this._checkboxChanged.bind(this)
    );
  }

  private _renderTextConfig(element: any, basePath: string): TemplateResult {
    return TextConfigRenderer.render(
      element,
      basePath,
      this._valueChanged.bind(this),
      this._checkboxChanged.bind(this)
    );
  }

  private _renderEntityConfig(element: any, basePath: string): TemplateResult | string {
    return EntityConfigRenderer.render(
      element,
      basePath,
      this.hass,
      this._entityPickerChanged.bind(this),
      this._entityArrayItemChanged.bind(this)
    );
  }

  private _renderWidgetConfig(element: any, basePath: string): TemplateResult | string {
    return WidgetConfigRenderer.render(element, basePath, this._valueChanged.bind(this));
  }

  private _renderAdvancedLayoutConfig(element: any, basePath: string): TemplateResult {
    return AdvancedLayoutRenderer.render(element, basePath, this._valueChanged.bind(this));
  }

  private _renderButtonConfig(element: any, basePath: string): TemplateResult {
    return ButtonConfigRenderer.render(element, basePath, this._checkboxChanged.bind(this));
  }

  private _checkboxChanged(ev: Event): void {
    const target = ev.target as any;
    const configValue = target.configValue;
    const checked = target.checked;

    if (!configValue || !this._config) {
      return;
    }

    ConfigUpdater.updateBoolean(this._config, configValue, checked, this);
  }

  private _entityPickerChanged(ev: CustomEvent): void {
    if (!this._config || !this._selectedElement) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;
    const value = ev.detail.value;

    if (!configValue) {
      return;
    }

    ConfigUpdater.updateEntity(this._config, configValue, value, this);
  }

  private _entityArrayItemChanged(ev: CustomEvent): void {
    if (!this._config || !this._selectedElement) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;
    const value = ev.detail.value;

    if (!configValue) {
      return;
    }

    const pathParts = configValue.split('.');
    const index = Number(pathParts[pathParts.length - 1]);
    const basePath = pathParts.slice(0, -1).join('.');

    ConfigUpdater.updateEntityArrayItem(this._config, basePath, index, value, this);
  }

  private _getElementIcon(type: string): string {
    return ElementMetadata.getIconForType(type);
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

