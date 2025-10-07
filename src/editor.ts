import { LitElement, html, TemplateResult, CSSResultGroup, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
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
  @state() private _expandedConfigSections: Set<string> = new Set(['basic']);
  @state() private _editingGroupIndex?: number;
  @state() private _editingGroupName: string = '';
  @state() private _editingElementId?: { groupIndex: number; elementIndex: number };
  @state() private _editingElementIdValue: string = '';
  @state() private _editingElementType?: boolean;
  @state() private _editingElementTypeValue: string = '';

  protected async firstUpdated(changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(changedProperties);

    if (!this._helpers && typeof window.loadCardHelpers === 'function') {
      try {
        this._helpers = await window.loadCardHelpers();
      } catch (err) {
        console.warn('Failed to load card helpers', err);
      }
    }
  }

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
    // Reset to default expanded sections when selecting a new element
    this._expandedConfigSections = new Set(['basic']);
  }

  private _toggleConfigSection(sectionId: string): void {
    const newExpanded = new Set(this._expandedConfigSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    this._expandedConfigSections = newExpanded;
  }

  private _isSectionExpanded(sectionId: string): boolean {
    return this._expandedConfigSections.has(sectionId);
  }

  private _toggleBrowser(): void {
    this._browserExpanded = !this._browserExpanded;
    // Close element configuration when browser is opened
    if (this._browserExpanded) {
      this._selectedElement = undefined;
      this._expandedConfigSections = new Set(['basic']);
    }
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
          <p class="helper-text">Click "Add Group" below to create your first group</p>
        </div>
        <div class="add-group-button">
          <ha-button @click=${this._addGroup}>
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
            Add Group
          </ha-button>
        </div>
      `;
    }

    return html`
      <div class="groups-tree">
        ${this._config.groups.map((group, groupIndex) => {
          const isCollapsed = this._collapsedGroups.has(groupIndex);
          const isEditing = this._editingGroupIndex === groupIndex;
          const filteredElements = group.elements?.filter(
            (element, elementIndex) => this._matchesFilter(element.id, element.type)
          ) || [];
          
          // Hide group if no elements match filter
          if (this._filterText && filteredElements.length === 0) {
            return html``;
          }

          return html`
            <div class="group-item">
              <div class="group-header ${isEditing ? 'editing' : 'clickable'}">
                ${isEditing ? html`
                  <ha-icon icon="mdi:folder-edit"></ha-icon>
                  <ha-textfield
                    .value=${this._editingGroupName}
                    @input=${this._updateEditingGroupName}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter') this._saveGroupName();
                      if (e.key === 'Escape') this._cancelEditingGroupName();
                    }}
                    @click=${(e: Event) => e.stopPropagation()}
                  ></ha-textfield>
                  <ha-icon-button
                    @click=${(e: Event) => { e.stopPropagation(); this._saveGroupName(); }}
                    title="Save"
                  >
                    <ha-icon icon="mdi:check"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    @click=${(e: Event) => { e.stopPropagation(); this._cancelEditingGroupName(); }}
                    title="Cancel"
                  >
                    <ha-icon icon="mdi:close"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    @click=${(e: Event) => { e.stopPropagation(); this._deleteGroup(groupIndex); }}
                    title="Delete group"
                    class="delete-button"
                  >
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                ` : html`
                  <ha-icon 
                    icon=${isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
                    class="collapse-icon"
                    @click=${() => this._toggleGroup(groupIndex)}
                  ></ha-icon>
                  <ha-icon icon="mdi:folder" @click=${() => this._toggleGroup(groupIndex)}></ha-icon>
                  <div class="group-info" @click=${() => this._toggleGroup(groupIndex)}>
                    <span class="group-name">${group.group_id}</span>
                    <span class="group-meta">
                      (${filteredElements.length}${this._filterText ? ` of ${group.elements?.length || 0}` : ''})
                    </span>
                  </div>
                  <ha-icon-button
                    @click=${(e: Event) => { e.stopPropagation(); this._startEditingGroupName(groupIndex); }}
                    title="Edit group name"
                    class="icon-button-small"
                  >
                    <ha-icon icon="mdi:pencil"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    @click=${(e: Event) => { e.stopPropagation(); this._addElement(groupIndex); }}
                    title="Add element to this group"
                    class="icon-button-small"
                  >
                    <ha-icon icon="mdi:plus"></ha-icon>
                  </ha-icon-button>
                `}
              </div>
              ${!isCollapsed ? html`
                <div class="elements-list">
                  ${group.elements && group.elements.length > 0 ? group.elements.map((element, elementIndex) => {
                    if (!this._matchesFilter(element.id, element.type)) {
                      return html``;
                    }
                    const isSelected = this._selectedElement?.groupIndex === groupIndex && 
                                      this._selectedElement?.elementIndex === elementIndex;
                    const isEditingId = this._editingElementId?.groupIndex === groupIndex && 
                                       this._editingElementId?.elementIndex === elementIndex;
                    
                    return html`
                      <div
                        class="element-item ${isSelected ? 'selected' : ''}"
                        @click=${() => this._selectElement(groupIndex, elementIndex)}
                      >
                        ${isEditingId ? html`
                          <ha-icon icon=${this._getElementIcon(element.type)}></ha-icon>
                          <ha-textfield
                            class="element-id-input"
                            .value=${this._editingElementIdValue}
                            @input=${this._updateEditingElementId}
                            @keydown=${(e: KeyboardEvent) => {
                              if (e.key === 'Enter') this._saveElementId();
                              if (e.key === 'Escape') this._cancelEditingElementId();
                              e.stopPropagation();
                            }}
                            @click=${(e: Event) => e.stopPropagation()}
                          ></ha-textfield>
                          <ha-icon-button
                            @click=${(e: Event) => { e.stopPropagation(); this._saveElementId(); }}
                            title="Save"
                            class="icon-button-tiny"
                          >
                            <ha-icon icon="mdi:check"></ha-icon>
                          </ha-icon-button>
                          <ha-icon-button
                            @click=${(e: Event) => { e.stopPropagation(); this._cancelEditingElementId(); }}
                            title="Cancel"
                            class="icon-button-tiny"
                          >
                            <ha-icon icon="mdi:close"></ha-icon>
                          </ha-icon-button>
                          <ha-icon-button
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this._deleteElement(groupIndex, elementIndex);
                            }}
                            title="Delete element"
                            class="icon-button-tiny delete-button"
                          >
                            <ha-icon icon="mdi:delete"></ha-icon>
                          </ha-icon-button>
                        ` : html`
                          <ha-icon icon=${this._getElementIcon(element.type)}></ha-icon>
                          <span class="element-id">${element.id}</span>
                          <span class="element-type">${element.type}</span>
                        `}
                      </div>
                    `;
                  }) : html`
                    <div class="empty-state-small">No elements in this group</div>
                  `}
                </div>
              ` : ''}
            </div>
          `;
        })}
      </div>
      <div class="add-group-button">
        <ha-button @click=${this._addGroup}>
          <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
          Add Group
        </ha-button>
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
    const isEditingElementId = this._editingElementId?.groupIndex === groupIndex &&
      this._editingElementId?.elementIndex === elementIndex;
    const isEditingElementType = this._editingElementType === true;

    return html`
      <div class="section">
        <div class="section-header">
          <ha-icon icon="mdi:cog"></ha-icon>
          <span>Element Configuration</span>
        </div>

        <div class="config-panel">
          <div class="element-info-header">
            <div class="element-info-header-main">
              <ha-icon icon=${this._getElementIcon(element.type)} class="element-icon-large"></ha-icon>
              <div class="element-info-display">
                ${isEditingElementId ? html`
                  <div class="element-info-id-editing">
                    <ha-textfield
                      class="element-id-input element-info-id-input"
                      .value=${this._editingElementIdValue}
                      @input=${this._updateEditingElementId}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._saveElementId();
                        if (e.key === 'Escape') this._cancelEditingElementId();
                        e.stopPropagation();
                      }}
                      @click=${(e: Event) => e.stopPropagation()}
                    ></ha-textfield>
                    <div class="element-info-edit-actions">
                      <ha-icon-button
                        @click=${(e: Event) => { e.stopPropagation(); this._saveElementId(); }}
                        title="Confirm"
                        class="icon-button-tiny"
                      >
                        <ha-icon icon="mdi:check"></ha-icon>
                      </ha-icon-button>
                      <ha-icon-button
                        @click=${(e: Event) => { e.stopPropagation(); this._cancelEditingElementId(); }}
                        title="Cancel"
                        class="icon-button-tiny"
                      >
                        <ha-icon icon="mdi:close"></ha-icon>
                      </ha-icon-button>
                      <ha-icon-button
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this._deleteElement(groupIndex, elementIndex);
                        }}
                        title="Delete element"
                        class="icon-button-tiny delete-button"
                      >
                        <ha-icon icon="mdi:delete"></ha-icon>
                      </ha-icon-button>
                    </div>
                  </div>
                ` : isEditingElementType ? html`` : html`
                  <div
                    class="element-info-chip element-info-id-chip"
                    role="button"
                    tabindex="0"
                    @click=${() => this._startEditingElementId(groupIndex, elementIndex)}
                    @keydown=${(e: KeyboardEvent) => this._handleEditableKeypress(e, () => this._startEditingElementId(groupIndex, elementIndex))}
                  >
                    <span class="element-id">${element.id}</span>
                    <ha-icon icon="mdi:pencil" class="editable-icon element-info-id-icon"></ha-icon>
                  </div>
                `}
                ${isEditingElementId ? html`` : isEditingElementType ? html`
                  <div class="element-info-type-editing">
                    <ha-select
                      class="element-type-select"
                      .value=${this._editingElementTypeValue}
                      @selected=${this._updateEditingElementType}
                      @closed=${(e: Event) => e.stopPropagation()}
                    >
                      ${ElementMetadata.getAllElementTypes().map(type => html`
                        <mwc-list-item value="${type}">${type}</mwc-list-item>
                      `)}
                    </ha-select>
                    <div class="element-info-edit-actions">
                      <ha-icon-button
                        @click=${(e: Event) => { e.stopPropagation(); this._cancelEditingElementType(); }}
                        title="Cancel"
                        class="icon-button-tiny"
                      >
                        <ha-icon icon="mdi:close"></ha-icon>
                      </ha-icon-button>
                    </div>
                  </div>
                ` : html`
                  <div
                    class="element-info-chip element-info-type-chip"
                    role="button"
                    tabindex="0"
                    @click=${() => this._startEditingElementType()}
                    @keydown=${(e: KeyboardEvent) => this._handleEditableKeypress(e, () => this._startEditingElementType())}
                  >
                    <ha-icon icon="mdi:pencil" class="editable-icon element-info-type-icon"></ha-icon>
                    <span class="element-type">${element.type}</span>
                  </div>
                `}
              </div>
            </div>
          </div>

          ${this._renderCollapsibleSection('layout', 'Layout', 'mdi:page-layout-body', 
            () => this._renderLayoutConfig(element, basePath))}
          ${this._renderCollapsibleSection('advanced-layout', 'Advanced Layout', 'mdi:vector-arrange-below', 
            () => this._renderAdvancedLayoutConfig(element, basePath))}
          ${this._renderCollapsibleSection('appearance', 'Appearance', 'mdi:palette', 
            () => this._renderAppearanceConfig(element, basePath))}
          ${this._renderCollapsibleSection('text', 'Text', 'mdi:format-text', 
            () => this._renderTextConfig(element, basePath))}
          ${this._renderCollapsibleSection('entity', 'Entity', 'mdi:database', 
            () => this._renderEntityConfig(element, basePath))}
          ${this._renderCollapsibleSection('button', 'Button & Interaction', 'mdi:gesture-tap', 
            () => this._renderButtonConfig(element, basePath))}
        </div>
      </div>
    `;
  }

  private _renderCollapsibleSection(
    sectionId: string, 
    title: string, 
    icon: string, 
    contentRenderer: () => TemplateResult | string
  ): TemplateResult {
    const content = contentRenderer();
    
    // Don't render section if content is empty
    if (!content || content === '') {
      return html``;
    }

    const isExpanded = this._isSectionExpanded(sectionId);

    return html`
      <div class="collapsible-config-section ${isExpanded ? 'expanded' : ''}">
        <div 
          class="collapsible-section-header"
          @click=${() => this._toggleConfigSection(sectionId)}
        >
          <ha-icon 
            icon=${isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
            class="collapse-icon"
          ></ha-icon>
          <ha-icon icon=${icon} class="section-icon"></ha-icon>
          <span class="section-title">${title}</span>
        </div>
        ${isExpanded ? html`
          <div class="collapsible-section-content">
            ${content}
          </div>
        ` : ''}
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
      this._updateConfigValue.bind(this)
    );
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

  private _updateConfigValue(path: string, value: unknown): void {
    if (!this._config) {
      return;
    }

    ConfigUpdater.updateNestedPath(this._config, path, value, this);
  }

  private _getElementIcon(type: string): string {
    return ElementMetadata.getIconForType(type);
  }

  private _startEditingGroupName(groupIndex: number): void {
    if (!this._config?.groups) return;
    this._editingGroupIndex = groupIndex;
    this._editingGroupName = this._config.groups[groupIndex].group_id;
  }

  private _cancelEditingGroupName(): void {
    this._editingGroupIndex = undefined;
    this._editingGroupName = '';
  }

  private _saveGroupName(): void {
    if (!this._config?.groups || this._editingGroupIndex === undefined) return;
    
    const newName = this._editingGroupName.trim();
    if (!newName) {
      this._cancelEditingGroupName();
      return;
    }

    // Check for duplicate group names
    const isDuplicate = this._config.groups.some((g, i) => 
      i !== this._editingGroupIndex && g.group_id === newName
    );

    if (isDuplicate) {
      alert('A group with this name already exists');
      return;
    }

    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups[this._editingGroupIndex].group_id = newName;
    
    fireEvent(this, 'config-changed', { config: newConfig });
    this._cancelEditingGroupName();
  }

  private _updateEditingGroupName(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this._editingGroupName = target.value;
  }

  private _deleteGroup(groupIndex: number): void {
    if (!this._config?.groups) return;
    
    const group = this._config.groups[groupIndex];
    const elementCount = group.elements?.length || 0;
    
    const confirmMessage = elementCount > 0
      ? `Delete group "${group.group_id}" and its ${elementCount} element(s)?`
      : `Delete group "${group.group_id}"?`;
    
    if (!confirm(confirmMessage)) return;

    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups.splice(groupIndex, 1);
    
    // Clear selection if it was in the deleted group
    if (this._selectedElement?.groupIndex === groupIndex) {
      this._selectedElement = undefined;
    } else if (this._selectedElement && this._selectedElement.groupIndex > groupIndex) {
      // Adjust selection index if it was after the deleted group
      this._selectedElement = {
        ...this._selectedElement,
        groupIndex: this._selectedElement.groupIndex - 1
      };
    }

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _deleteElement(groupIndex: number, elementIndex: number): void {
    if (!this._config?.groups) return;
    
    const element = this._config.groups[groupIndex]?.elements?.[elementIndex];
    if (!element) return;
    
    if (!confirm(`Delete element "${element.id}"?`)) return;

    const wasEditingId = this._editingElementId?.groupIndex === groupIndex &&
      this._editingElementId?.elementIndex === elementIndex;
    const wasEditingType = this._editingElementType &&
      this._selectedElement?.groupIndex === groupIndex &&
      this._selectedElement?.elementIndex === elementIndex;

    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups[groupIndex].elements.splice(elementIndex, 1);
    
    // Clear selection if it was the deleted element
    if (this._selectedElement?.groupIndex === groupIndex && 
        this._selectedElement?.elementIndex === elementIndex) {
      this._selectedElement = undefined;
    } else if (this._selectedElement?.groupIndex === groupIndex && 
               this._selectedElement.elementIndex > elementIndex) {
      // Adjust selection index if it was after the deleted element
      this._selectedElement = {
        ...this._selectedElement,
        elementIndex: this._selectedElement.elementIndex - 1
      };
    }

    fireEvent(this, 'config-changed', { config: newConfig });

    if (wasEditingId) {
      this._cancelEditingElementId();
    }

    if (wasEditingType) {
      this._cancelEditingElementType();
    }
  }

  private _addGroup(): void {
    if (!this._config) return;

    const newConfig = JSON.parse(JSON.stringify(this._config));
    if (!newConfig.groups) {
      newConfig.groups = [];
    }

    // Generate unique group ID
    let counter = 1;
    let newGroupId = 'new_group';
    while (newConfig.groups.some((g: any) => g.group_id === newGroupId)) {
      newGroupId = `new_group_${counter}`;
      counter++;
    }

    newConfig.groups.push({
      group_id: newGroupId,
      elements: []
    });

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _addElement(groupIndex: number): void {
    if (!this._config?.groups) return;

    const newConfig = JSON.parse(JSON.stringify(this._config));
    const group = newConfig.groups[groupIndex];
    
    if (!group.elements) {
      group.elements = [];
    }

    // Generate unique element ID
    let counter = 1;
    let newElementId = 'new_element';
    const allElementIds = newConfig.groups.flatMap((g: any) => 
      (g.elements || []).map((e: any) => e.id)
    );
    
    while (allElementIds.includes(newElementId)) {
      newElementId = `new_element_${counter}`;
      counter++;
    }

    group.elements.push({
      id: newElementId,
      type: 'rectangle',
      layout: {
        width: 100,
        height: 50
      },
      appearance: {
        fill: '#ff9900'
      }
    });

    fireEvent(this, 'config-changed', { config: newConfig });
    
    // Select the newly added element
    this._selectedElement = {
      groupIndex,
      elementIndex: group.elements.length - 1
    };
    this._browserExpanded = false;
  }

  private _startEditingElementId(groupIndex: number, elementIndex: number): void {
    if (!this._config?.groups) return;
    this._editingElementId = { groupIndex, elementIndex };
    this._editingElementIdValue = this._config.groups[groupIndex].elements[elementIndex].id;
  }

  private _cancelEditingElementId(): void {
    this._editingElementId = undefined;
    this._editingElementIdValue = '';
  }

  private _saveElementId(): void {
    if (!this._config?.groups || !this._editingElementId) return;
    
    const newId = this._editingElementIdValue.trim();
    if (!newId) {
      this._cancelEditingElementId();
      return;
    }

    const { groupIndex, elementIndex } = this._editingElementId;
    
    // Check for duplicate element IDs
    const allElementIds = this._config.groups.flatMap((g, gi) => 
      (g.elements || []).map((e, ei) => ({
        id: e.id,
        isCurrentElement: gi === groupIndex && ei === elementIndex
      }))
    );

    const isDuplicate = allElementIds.some(item => 
      !item.isCurrentElement && item.id === newId
    );

    if (isDuplicate) {
      alert('An element with this ID already exists');
      return;
    }

    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups[groupIndex].elements[elementIndex].id = newId;
    
    fireEvent(this, 'config-changed', { config: newConfig });
    this._cancelEditingElementId();
  }

  private _updateEditingElementId(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this._editingElementIdValue = target.value;
  }

  private _startEditingElementType(): void {
    if (!this._config?.groups || !this._selectedElement) return;
    const { groupIndex, elementIndex } = this._selectedElement;
    this._editingElementType = true;
    this._editingElementTypeValue = this._config.groups[groupIndex].elements[elementIndex].type;
  }

  private _cancelEditingElementType(): void {
    this._editingElementType = false;
    this._editingElementTypeValue = '';
  }

  private _saveElementType(): void {
    if (!this._config?.groups || !this._selectedElement) return;

    const newType = this._editingElementTypeValue;
    if (!newType) {
      this._cancelEditingElementType();
      return;
    }

    const { groupIndex, elementIndex } = this._selectedElement;
    const currentElement = this._config.groups[groupIndex]?.elements?.[elementIndex];
    if (!currentElement) {
      this._cancelEditingElementType();
      return;
    }

    if (currentElement.type === newType) {
      this._cancelEditingElementType();
      return;
    }

    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups[groupIndex].elements[elementIndex].type = newType;

    fireEvent(this, 'config-changed', { config: newConfig });
    this._cancelEditingElementType();
  }

  private _updateEditingElementType(ev: CustomEvent): void {
    const newType = ev.detail.value || (ev.target as any).value;
    this._editingElementTypeValue = newType;

    if (!this._config?.groups || !this._selectedElement) {
      return;
    }

    const { groupIndex, elementIndex } = this._selectedElement;
    const currentType = this._config.groups[groupIndex]?.elements?.[elementIndex]?.type;

    if (!currentType || newType === currentType) {
      return;
    }

    this._saveElementType();
  }

  private _handleEditableKeypress(event: KeyboardEvent, callback: () => void): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      callback();
    }
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
