import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';
// Make sure these components are loaded if not already globally available
// import '@material/mwc-select';
// import '@material/mwc-list/mwc-list-item';
// import '@material/mwc-textfield';
// import '@material/mwc-checkbox';
// import '@material/mwc-formfield';
// import '@material/mwc-icon-button';
// import '@polymer/paper-input/paper-input'; // For color picker potentially

import { LcarsCardConfig } from './lovelace-lcars-card.js';
import { DEFAULT_FONT_SIZE, DEFAULT_TITLE, DEFAULT_TEXT } from './constants';

// Available element types
const ELEMENT_TYPES = ['rectangle', 'text', 'endcap', 'elbow', 'chisel-endcap'];
const ANCHOR_POINTS = [
    'topLeft', 'topCenter', 'topRight',
    'centerLeft', 'center', 'centerRight',
    'bottomLeft', 'bottomCenter', 'bottomRight'
];

@customElement('lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) private _config?: LcarsCardConfig;
  @state() private _collapsedElements: boolean[] = [];
  @state() private _collapsedSections: { [key: number]: { props: boolean; layout: boolean } } = {};
  @state() private _advancedTextOptions: { [key: number]: boolean } = {}; // Track advanced text options per element
  // --- Drag and Drop for Reordering Elements ---
  private _draggedIndex: number | null = null;
  private _dragOverIndex: number | null = null;
  @state() private _groups: string[] = [];
  @state() private _collapsedGroups: { [groupId: string]: boolean } = {};
  @state() private _newGroupDraft: string | null = null;
  @state() private _newGroupInput: string = '';
  @state() private _editingGroup: string | null = null;
  @state() private _editingGroupInput: string = '';
  @state() private _deleteWarningGroup: string | null = null;
  @state() private _groupIdWarning: string = '';
  @state() private _addElementDraftGroup: string | null = null;
  @state() private _addElementInput: string = '';
  @state() private _addElementWarning: string = '';
  @state() private _editingElementId: number | null = null;
  @state() private _editingElementIdInput: string = '';
  @state() private _elementIdWarning: string = '';

  static styles = css`
    /* Basic styles */
    .form-container { padding: 8px; }
    .form-field { display: flex; flex-direction: column; margin-bottom: 12px; }
    .form-field label, .section-label { margin-bottom: 4px; font-weight: bold; }
    .elements-section { margin-top: 20px; padding-top: 10px; border-top: 1px solid var(--divider-color); }
    .add-element { margin-top: 16px; text-align: right; }

    /* Element editor card */
    .element-editor {
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
      background-color: var(--secondary-background-color);
    }
    .element-header {
      display: flex;
      align-items: center;
      margin-bottom: 0;
      min-height: 40px;
    }
    .element-header .element-header-summary {
      font-weight: bold;
      display: flex;
      align-items: center;
      margin: 0;
      padding: 0;
    }
    .element-header .element-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }

    /* Grid layout for fields */
    .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* Wider columns */
        gap: 12px;
        margin-bottom: 10px; /* Space below grid */
    }
    .section-label { /* Label for Props/Layout sections */
        grid-column: 1 / -1; /* Span full width */
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px dashed var(--divider-color);
    }

    /* Inputs */
    ha-select, ha-textfield, ha-color-picker { display: block; width: 100%; box-sizing: border-box; }
    ha-formfield { display: block; margin-top: 8px;} /* Better checkbox spacing */
    ha-color-picker { margin-bottom: 8px;}

    /* Anchor grid styles */
    .anchor-grid-label {
      font-weight: bold;
      margin-bottom: 4px;
      display: block;
    }
    .anchor-grid {
      display: grid;
      grid-template-columns: repeat(3, 28px);
      grid-template-rows: repeat(3, 28px);
      gap: 4px;
      margin-bottom: 8px;
      justify-content: center;
    }
    .anchor-grid-btn {
      width: 28px;
      height: 28px;
      border: 1.5px solid var(--divider-color, #888);
      background: var(--card-background-color, #222);
      border-radius: 6px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .anchor-grid-btn.selected {
      border-color: var(--primary-color, #ff9800);
      background: var(--primary-color, #ff9800);
      color: #fff;
    }
    .drag-handle-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
      cursor: grab;
      /* No background, no border, no highlight */
    }
    .drag-handle-container:active {
      cursor: grabbing;
    }
    .drag-handle-container ha-icon {
      opacity: 0.7;
      transition: opacity 0.2s;
      color: var(--secondary-text-color, #bbb);
    }
    .drag-handle-container:active ha-icon {
      opacity: 1;
    }
    /* Remove previous drag-handle button styles */
    ha-icon-button.drag-handle,
    ha-icon-button.drag-handle:focus,
    ha-icon-button.drag-handle:active,
    ha-icon-button.drag-handle[active],
    ha-icon-button.drag-handle[focused],
    ha-icon-button.drag-handle:hover {
      background: none !important;
      box-shadow: none !important;
      color: inherit !important;
    }
    .element-editor[draggable="true"] {
      user-select: none;
    }
  `;

  public setConfig(config: LcarsCardConfig): void {
    this._config = { ...config, elements: config.elements || [] };
    // --- Group extraction (only on initial load) ---
    if (!this._groups || this._groups.length === 0) {
      const groupSet = new Set<string>();
      (config.elements || []).forEach(el => {
        if (el.id && typeof el.id === 'string' && el.id.includes('.')) {
          groupSet.add(el.id.split('.')[0]);
        }
      });
      this._groups = Array.from(groupSet);
    }
    // --- Collapse state for groups ---
    const prevCollapsedGroups = this._collapsedGroups || {};
    this._collapsedGroups = {};
    this._groups.forEach(gid => {
      this._collapsedGroups[gid] = prevCollapsedGroups[gid] ?? true;
    });
    // --- Elements collapse ---
    const numElements = config.elements?.length || 0;
    if (this._collapsedElements.length !== numElements) {
      this._collapsedElements = Array(numElements).fill(true);
    }
    if (Object.keys(this._collapsedSections).length !== numElements) {
      const prevSections = this._collapsedSections || {};
      this._collapsedSections = {};
      for (let i = 0; i < numElements; i++) {
        this._collapsedSections[i] = prevSections[i] || { props: false, layout: false };
      }
    }
  }

  // --- Event Handlers --- 

  // Handle changes in basic fields (Title, Text, Font Size)
  private _handleBasicChange(ev: CustomEvent): void {
    if (!this._config) return;
    const target = ev.target as HTMLInputElement;
    const key = target.name as keyof LcarsCardConfig;
    let value: string | number = target.value;

    if (key === 'fontSize') {
      value = Number(value);
    }

    this._config = { ...this._config, [key]: value };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Handle changes within an element's configuration
  private _handleElementChange(ev: Event, index: number, key: string, section?: 'props' | 'layout'): void {
    if (!this._config || !this._config.elements) return;

    const target = ev.target as any; // Use any for simplicity with different component types
    let value: string | number | boolean;

    // Extract value based on target type
    if (target.tagName === 'HA-COLOR-PICKER') {
        value = target.value || ''; // Assuming .value holds the color string
    } else if (target.tagName === 'HA-CHECKBOX') {
        value = target.checked;
    } else { // Textfield, Select, etc.
        value = target.value;
        // Attempt number conversion only if target.type suggests it
        if (target.type === 'number' && value !== '') {
             try {
                 value = Number(value);
                 if (isNaN(value)) { // Handle case where input is not a valid number
                     value = target.value; // Keep original string if conversion fails
                 }
             } catch { value = target.value; }
        }
    }

    console.log(`Handling change: Index=${index}, Section=${section}, Key=${key}, Value=${value} (Type: ${typeof value})`);

    const newElements = this._config.elements.map((el, i) => {
      if (i === index) {
        const updatedElement = { ...el };
        if (section) { // Update nested 'props' or 'layout'
          // Ensure the section object exists
          const currentSection = { ...updatedElement[section] };
          // Special case: if changing anchorTo in layout and value is empty, remove anchorPoint/targetAnchorPoint
          if (section === 'layout' && key === 'anchorTo') {
            if (!value || value === '') {
              const { anchorPoint, targetAnchorPoint, ...rest } = currentSection;
              delete rest[key];
              updatedElement[section] = rest;
            } else {
              // If anchorTo is set, remove containerAnchorPoint
              const { containerAnchorPoint, ...rest } = currentSection;
              rest[key] = value;
              updatedElement[section] = rest;
            }
          } else {
            if (value === '' || value === undefined || value === null) {
              // Remove the key if value is empty
              const { [key]: _removed, ...rest } = currentSection;
              updatedElement[section] = rest;
            } else {
              updatedElement[section] = { ...currentSection, [key]: value };
            }
          }
        } else if (key === 'id') {
          // Only allow editing the base id
          const group = el.id.split('.')[0];
          let baseId = value as string;
          if (!/^[a-zA-Z0-9_-]+$/.test(baseId)) {
            alert('Element ID can only contain letters, numbers, underscores (_), or hyphens (-).');
            return el;
          }
          const fullId = `${group}.${baseId}`;
          if (this._config && this._config.elements && this._config.elements.some((e, idx) => e.id === fullId && idx !== index)) {
            alert('An element with this id already exists in this group.');
            return el;
          }
          updatedElement.id = fullId;
        } else {
          (updatedElement as any)[key] = value;
        }
        return updatedElement;
      }
      return el;
    });

    // Only include type if it is defined
    const { type, ...restConfig } = this._config || {};
    const configToUpdate = { ...restConfig, type: typeof type === 'string' ? type : '', elements: newElements };
    this._config = configToUpdate;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Add a new, default element placeholder
  private async _addElement(groupId?: string): Promise<void> {
    if (this._addElementDraftGroup) return; // Only one at a time
    this._addElementDraftGroup = groupId || (this._groups[0] || 'default');
    this._addElementInput = '';
    this._addElementWarning = '';
    await this.requestUpdate();
    const input = this.renderRoot.querySelector('ha-textfield[label="New Element ID"] input') as HTMLInputElement;
    if (input) input.select();
  }

  private _confirmAddElement(): void {
    const group = this._addElementDraftGroup;
    let baseId = this._addElementInput.trim();
    if (!group || !baseId) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(baseId)) {
      this._addElementWarning = 'Element ID can only contain letters, numbers, underscores (_), or hyphens (-).';
      this.requestUpdate();
      return;
    }
    const fullId = `${group}.${baseId}`;
    if (this._config && this._config.elements && this._config.elements.some(el => el.id === fullId)) {
      this._addElementWarning = 'An element with this id already exists in this group.';
      this.requestUpdate();
      return;
    }
    const newElement = {
      id: fullId,
      type: 'rectangle',
      props: { fill: '#FF9900' },
      layout: { width: 100, height: 30 }
    };
    const elements = [...(this._config?.elements || []), newElement];
    // Only include type if it is defined
    const { type: type2, ...restConfig2 } = this._config || {};
    const configToUpdate2 = { ...restConfig2, type: typeof type2 === 'string' ? type2 : '', elements };
    this._config = configToUpdate2;
    this._collapsedElements = Array(elements.length - 1).fill(true).concat(false);
    this._addElementDraftGroup = null;
    this._addElementInput = '';
    this._addElementWarning = '';
    fireEvent(this, 'config-changed', { config: this._config });
    this.requestUpdate();
  }

  private _cancelAddElement(): void {
    this._addElementDraftGroup = null;
    this._addElementInput = '';
    this._addElementWarning = '';
    this.requestUpdate();
  }

  // Remove an element at a given index
  private _removeElement(index: number): void {
    if (!this._config || !this._config.elements) return;

    const elements = this._config.elements.filter((_, i) => i !== index);
    this._config = { ...this._config, elements };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Add a new group
  private async _addGroup(): Promise<void> {
    if (this._newGroupDraft) return; // Only one at a time
    this._newGroupDraft = '__new__';
    this._newGroupInput = '';
    this._collapsedGroups = { ...this._collapsedGroups, ['__new__']: false };
    this._groupIdWarning = '';
    await this.requestUpdate();
    const input = this.renderRoot.querySelector('ha-textfield[label="New Group Name"] input') as HTMLInputElement;
    if (input) input.select();
  }

  // Toggle group collapse
  private _toggleGroupCollapse(groupId: string): void {
    this._collapsedGroups = { ...this._collapsedGroups, [groupId]: !this._collapsedGroups[groupId] };
  }

  // Confirm new group
  private _confirmNewGroup(): void {
    const name = this._newGroupInput.trim();
    if (!name) return;
    if (this._groups.includes(name)) {
      alert('Group already exists. Please choose a different name.');
      return;
    }
    // Replace the draft group with the real one
    this._groups = [...this._groups, name];
    const { ['__new__']: _removed, ...rest } = this._collapsedGroups;
    this._collapsedGroups = { ...rest, [name]: false };
    this._newGroupDraft = null;
    this._newGroupInput = '';
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  // Cancel new group
  private _cancelNewGroup(): void {
    const { ['__new__']: _removed, ...rest } = this._collapsedGroups;
    this._collapsedGroups = rest;
    this._newGroupDraft = null;
    this._newGroupInput = '';
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  // Start editing a group
  private _startEditGroup(groupId: string): void {
    this._editingGroup = groupId;
    this._editingGroupInput = groupId;
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  // Confirm editing a group
  private _confirmEditGroup(): void {
    const oldName = this._editingGroup;
    const newName = this._editingGroupInput.trim();
    if (!oldName || !newName) return;
    if (this._groups.includes(newName) && newName !== oldName) {
      alert('Group already exists. Please choose a different name.');
      return;
    }
    // Update group name in _groups
    this._groups = this._groups.map(g => g === oldName ? newName : g).filter((g, i, arr) => arr.indexOf(g) === i);
    // Update collapse state
    const { [oldName]: oldVal, ...rest } = this._collapsedGroups;
    this._collapsedGroups = { ...rest, [newName]: oldVal };
    // Update all elements in this group
    if (this._config && this._config.elements) {
      const elements = this._config.elements.map(el => {
        const [group, ...baseIdParts] = el.id.split('.');
        if (group === oldName) {
          return { ...el, id: `${newName}.${baseIdParts.join('.')}` };
        }
        return el;
      });
      this._config = { ...this._config, elements };
      fireEvent(this, 'config-changed', { config: this._config });
    }
    this._editingGroup = null;
    this._editingGroupInput = '';
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  // Cancel editing a group
  private _cancelEditGroup(): void {
    this._editingGroup = null;
    this._editingGroupInput = '';
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  // Delete a group
  private _deleteGroup(groupId: string): void {
    // If group has elements, show warning
    const hasElements = (this._config?.elements || []).some(el => el.id.split('.')[0] === groupId);
    if (hasElements) {
      this._deleteWarningGroup = groupId;
      this.requestUpdate();
      return;
    }
    // If no elements, delete immediately
    this._doDeleteGroup(groupId);
  }

  private _doDeleteGroup(groupId: string): void {
    // Remove group from _groups
    this._groups = this._groups.filter(g => g !== groupId);
    // Remove collapse state
    const { [groupId]: _removed, ...rest } = this._collapsedGroups;
    this._collapsedGroups = rest;
    // Remove all elements in this group
    if (this._config && this._config.elements) {
      const elements = this._config.elements.filter(el => el.id.split('.')[0] !== groupId);
      this._config = { ...this._config, elements };
      fireEvent(this, 'config-changed', { config: this._config });
    }
    // Cancel edit if editing this group
    if (this._editingGroup === groupId) {
      this._editingGroup = null;
      this._editingGroupInput = '';
    }
    if (this._deleteWarningGroup === groupId) {
      this._deleteWarningGroup = null;
    }
    this._groupIdWarning = '';
    this.requestUpdate();
  }

  private _cancelDeleteGroup(): void {
    this._deleteWarningGroup = null;
    this.requestUpdate();
  }

  // --- Render Helpers --- 

  // Helper to render required labels
  private _renderLabel(label: string, required: boolean, valid: boolean): TemplateResult {
    return html`<span style="color:${required && !valid ? 'red' : 'inherit'};">${label}${required ? html`<span style="color:red;">*</span>` : ''}</span>`;
  }

  // Helper to render a 3x3 anchor grid for single selection
  private _renderAnchorGrid({
    label,
    value,
    onSelect,
    disabled = false,
    labelCenter = false
  }: {
    label: string;
    value: string;
    onSelect: (val: string) => void;
    disabled?: boolean;
    labelCenter?: boolean;
  }) {
    const points = [
      ['topLeft', 'topCenter', 'topRight'],
      ['centerLeft', 'center', 'centerRight'],
      ['bottomLeft', 'bottomCenter', 'bottomRight']
    ];
    return html`
      <span class="anchor-grid-label" style="${labelCenter ? 'text-align:center;display:block;width:100%;' : ''}">${label}</span>
      <div class="anchor-grid">
        ${(() => {
          const iconMap: Record<string, string> = {
            topLeft: 'mdi:arrow-top-left',
            topCenter: 'mdi:arrow-up',
            topRight: 'mdi:arrow-top-right',
            centerLeft: 'mdi:arrow-left',
            center: 'mdi:circle-small',
            centerRight: 'mdi:arrow-right',
            bottomLeft: 'mdi:arrow-bottom-left',
            bottomCenter: 'mdi:arrow-down',
            bottomRight: 'mdi:arrow-bottom-right',
          };
          return points.flat().map((pt, i) => html`
            <button
              class="anchor-grid-btn${value === pt ? ' selected' : ''}"
              title=${pt}
              ?disabled=${disabled}
              @click=${() => {
                if (disabled) return;
                if (value === pt) {
                  onSelect('');
                } else {
                  onSelect(pt);
                }
              }}
              type="button"
            >
              <ha-icon
                icon="${iconMap[pt]}"
                style="
                  font-size: 18px;
                  ${pt === 'center' ? 'opacity:0.7;' : ''}
                  color: ${value === pt ? '#fff' : 'var(--secondary-text-color, #bbb)'};
                "
              ></ha-icon>
              ${value === pt && pt === 'center' ? html`<ha-icon icon="mdi:circle" style="font-size:18px;position:absolute;"></ha-icon>` : ''}
            </button>
          `);
        })()}
      </div>
    `;
  }

  // Helper to render a 3x3 anchor grid for multi-selection (for anchorTop, anchorBottom, anchorLeft, anchorRight)
  private _renderAnchorMultiGrid({
    label,
    anchorTop,
    anchorBottom,
    anchorLeft,
    anchorRight,
    onToggle
  }: {
    label: string;
    anchorTop: boolean;
    anchorBottom: boolean;
    anchorLeft: boolean;
    anchorRight: boolean;
    onToggle: (anchor: 'anchorTop' | 'anchorBottom' | 'anchorLeft' | 'anchorRight') => void;
  }) {
    // Map grid positions to anchor names
    const grid = [
      ['anchorTopLeft', 'anchorTop', 'anchorTopRight'],
      ['anchorLeft', 'center', 'anchorRight'],
      ['anchorBottomLeft', 'anchorBottom', 'anchorBottomRight']
    ];
    // Only the four edge/corner cells are interactive
    const isActive = (cell: string) => {
      switch (cell) {
        case 'anchorTop': return anchorTop;
        case 'anchorBottom': return anchorBottom;
        case 'anchorLeft': return anchorLeft;
        case 'anchorRight': return anchorRight;
        default: return false;
      }
    };
    const isToggleCell = (cell: string) => ['anchorTop', 'anchorBottom', 'anchorLeft', 'anchorRight'].includes(cell);
    const anchorLabel = {
      anchorTop: 'Top',
      anchorBottom: 'Bottom',
      anchorLeft: 'Left',
      anchorRight: 'Right'
    };
    return html`
      <span class="anchor-grid-label">${label}</span>
      <div class="anchor-grid">
        ${grid.flat().map((cell, i) => isToggleCell(cell)
          ? html`<button
              class="anchor-grid-btn${isActive(cell) ? ' selected' : ''}"
              title=${anchorLabel[cell as keyof typeof anchorLabel]}
              @click=${() => onToggle(cell as any)}
              type="button"
            >
              ${isActive(cell) ? html`<ha-icon icon="mdi:circle" style="font-size:18px;"></ha-icon>` : ''}
            </button>`
          : html`<button class="anchor-grid-btn" disabled style="opacity:0.3;"></button>`
        )}
      </div>
    `;
  }

  // Renders the editor for a single element
  private _renderElementEditor(element: any, index: number): TemplateResult {
    const collapsed = this._collapsedElements[index];
    const isDragging = this._draggedIndex === index;
    const isDragOver = this._dragOverIndex === index;
    const [group, ...baseIdParts] = element.id.split('.');
    const baseId = baseIdParts.join('.') || '';
    return html`
      <div class="element-editor"
        @dragover=${(e: DragEvent) => this._onDragOver(index, e)}
        @drop=${() => this._onDrop(index)}
        @dragend=${() => this._onDragEnd()}
        style="${isDragging ? 'opacity:0.5;' : isDragOver ? 'border:2px dashed var(--primary-color); background:rgba(255,152,0,0.08);' : ''}"
      >
        <div class="element-header">
          <div class="element-header-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer;" @click=${(e: Event) => { if (this._editingElementId === index) { e.stopPropagation(); return; } this._toggleElementCollapse(index); }}>
            <ha-icon
              icon="mdi:${collapsed ? 'chevron-right' : 'chevron-down'}"
              style="margin-right:8px;"
              title="${collapsed ? 'Expand' : 'Collapse'} Element"
            ></ha-icon>
            ${collapsed
              ? html`<span class="element-header-summary" style="display:flex; align-items:center;">${(baseId || element.id) ?? '(no id)'} <span style="color:var(--secondary-text-color); margin-left: 6px;">(${element.type ?? 'unknown'})</span></span>`
              : html`<div style="display: flex; align-items: center; gap: 8px;">
                  ${this._editingElementId === index
                    ? html`
                        <ha-textfield
                          label="Edit Element ID"
                          .value=${this._editingElementIdInput}
                          @input=${(e: Event) => {
                            this._editingElementIdInput = (e.target as HTMLInputElement).value;
                            this._elementIdWarning = '';
                            this.requestUpdate();
                          }}
                          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); this._confirmEditElementId(index, group); } }}
                          autofocus
                          style="flex: 1; min-width: 80px; cursor: auto;"
                          @click=${(e: Event) => e.stopPropagation()}
                        ></ha-textfield>
                      `
                    : html`
                        <span class="element-header-summary">
                          ${baseId || '(no id)'}
                        </span>
                        <ha-icon-button
                          style="margin-left: 4px; cursor: pointer;"
                          @click=${(e: Event) => { e.stopPropagation(); this._startEditElementId(index, baseId); }}
                          title="Edit Element ID"
                        >
                          <ha-icon icon="mdi:pencil"></ha-icon>
                        </ha-icon-button>
                      `
                  }
                </div>`}
          </div>
          <span class="element-header-actions" style="margin-left:auto;" @click=${(e: Event) => e.stopPropagation()}>
            ${this._editingElementId === index
              ? html`
                  ${this._elementIdWarning ? html`<div style="color: var(--error-color, #c00); font-size: 0.95em; margin-right: 8px;">${this._elementIdWarning}</div>` : ''}
                  <ha-icon-button
                    style="color: var(--primary-color);"
                    @click=${() => this._confirmEditElementId(index, group)}
                    title="Rename Element ID"
                    .disabled=${!this._editingElementIdInput.trim() || !!this._elementIdWarning}
                  >
                    <ha-icon icon="mdi:check"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    style="color: var(--error-color);"
                    @click=${() => this._cancelEditElementId()}
                    title="Cancel"
                  >
                    <ha-icon icon="mdi:close"></ha-icon>
                  </ha-icon-button>
                `
              : html`
                  <span class="drag-handle-container" draggable="true"
                    @dragstart=${(e: DragEvent) => this._onDragStart(index, e)}
                    style="display: inline-flex; align-items: center; justify-content: center;">
                    <ha-icon icon="mdi:drag-vertical"></ha-icon>
                  </span>
                  <ha-icon-button @click=${() => this._removeElement(index)} title="Delete Element">
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                `}
          </span>
        </div>
        ${collapsed
          ? html``
          : html`
              <div class="grid-container">
                <ha-select
                  label="Element Type"
                  .value=${element.type ?? ''}
                  @selected=${(e: Event) => this._handleElementChange(e, index, 'type')}
                  @closed=${(ev: Event) => ev.stopPropagation()}
                  style="grid-column: 1 / -1;"
                >
                  ${ELEMENT_TYPES.map(type => html`<ha-list-item .value=${type}>${type}</ha-list-item>`)}
                </ha-select>
                <div style="grid-column: 1 / -1; height: 8px;"></div>
                ${this._renderPropsFields(element, index)}
                <div style="grid-column: 1 / -1; height: 8px;"></div>
                ${this._renderLayoutFields(element, index)}
              </div>
            `}
      </div>
    `;
  }

  // Renders specific prop fields based on element type
  private _renderPropsFields(element: any, index: number): TemplateResult | TemplateResult[] {
    const props = element.props || {};
    const fillValue = props.fill ?? '';
    const fontSizeValue = props.fontSize ?? '';
    const fontWeightValue = props.fontWeight ?? '';
    const letterSpacingValue = props.letterSpacing ?? '';
    const textAnchorValue = props.textAnchor ?? '';
    const dominantBaselineValue = props.dominantBaseline ?? '';
    const textTransformValue = props.textTransform ?? '';
    const fontFamilyValue = props.fontFamily ?? '';
    const textValue = props.text ?? '';
    const rxValue = props.rx ?? '';
    const ryValue = props.ry ?? '';
    const directionValue = props.direction ?? '';
    // For advanced text options
    const isAdvancedOpen = !!this._advancedTextOptions[index];
    const toggleAdvanced = () => {
      this._advancedTextOptions = { ...this._advancedTextOptions, [index]: !isAdvancedOpen };
    };

    switch (element.type) {
      case 'rectangle':
        return html`
          <!-- Fill color group -->
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Fill Color" name="fill" .value=${fillValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fill', 'props')}></ha-textfield>
          <ha-textfield label="Width (px)" name="width" type="number" step="1" .value=${element.layout?.width ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'width', 'layout')}></ha-textfield>
          <ha-textfield label="Height (px)" name="height" type="number" step="1" .value=${element.layout?.height ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'height', 'layout')}></ha-textfield>
        `;
      case 'elbow':
        return html`
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Fill Color" name="fill" .value=${fillValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fill', 'props')}></ha-textfield>
          <ha-select label="Orientation" name="orientation" .value=${props.orientation ?? 'top-left'} @selected=${(e: Event) => this._handleElementChange(e, index, 'orientation', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
            <ha-list-item value="top-left">Top Left</ha-list-item>
            <ha-list-item value="top-right">Top Right</ha-list-item>
            <ha-list-item value="bottom-left">Bottom Left</ha-list-item>
            <ha-list-item value="bottom-right">Bottom Right</ha-list-item>
          </ha-select>
          <ha-textfield label="Horizontal Width (px)" name="horizontalWidth" type="number" step="1" .value=${props.horizontalWidth ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'horizontalWidth', 'props')}></ha-textfield>
          <ha-textfield label="Vertical Width (px)" name="verticalWidth" type="number" step="1" .value=${props.verticalWidth ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'verticalWidth', 'props')}></ha-textfield>
          <ha-textfield label="Header Height (px)" name="headerHeight" type="number" step="1" .value=${props.headerHeight ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'headerHeight', 'props')}></ha-textfield>
          <ha-textfield label="Total Elbow Height (px)" name="totalElbowHeight" type="number" step="1" .value=${props.totalElbowHeight ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'totalElbowHeight', 'props')}></ha-textfield>
          <ha-textfield label="Outer Corner Radius (px)" name="outerCornerRadius" type="number" step="1" .value=${props.outerCornerRadius ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'outerCornerRadius', 'props')}></ha-textfield>
        `;
      case 'text':
        return html`
          <!-- Text content and font size group -->
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Text Content" name="text" .value=${textValue} @input=${(e: Event) => this._handleElementChange(e, index, 'text', 'props')}></ha-textfield>
          <ha-textfield label="Font Size (px)" name="fontSize" type="number" step="1" .value=${fontSizeValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fontSize', 'props')}></ha-textfield>
          <!-- Advanced text options -->
          <div style="grid-column: 1 / -1; display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 4px;" @click=${toggleAdvanced}>
            <span style="font-weight: bold;">Advanced Text Options</span>
            <ha-icon icon="mdi:${isAdvancedOpen ? 'chevron-up' : 'chevron-down'}" style="margin-left: 4px;"></ha-icon>
          </div>
          ${isAdvancedOpen ? html`
            <ha-textfield label="Font Family" name="fontFamily" .value=${fontFamilyValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fontFamily', 'props')}></ha-textfield>
            <ha-select label="Font Weight" name="fontWeight" .value=${fontWeightValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'fontWeight', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
              <ha-list-item value=""></ha-list-item>
              <ha-list-item value="normal">Normal</ha-list-item>
              <ha-list-item value="bold">Bold</ha-list-item>
              <ha-list-item value="bolder">Bolder</ha-list-item>
              <ha-list-item value="lighter">Lighter</ha-list-item>
              <ha-list-item value="100">100</ha-list-item>
              <ha-list-item value="200">200</ha-list-item>
              <ha-list-item value="300">300</ha-list-item>
              <ha-list-item value="400">400</ha-list-item>
              <ha-list-item value="500">500</ha-list-item>
              <ha-list-item value="600">600</ha-list-item>
              <ha-list-item value="700">700</ha-list-item>
              <ha-list-item value="800">800</ha-list-item>
              <ha-list-item value="900">900</ha-list-item>
            </ha-select>
            <ha-textfield label="Letter Spacing" name="letterSpacing" .value=${letterSpacingValue} @input=${(e: Event) => this._handleElementChange(e, index, 'letterSpacing', 'props')}></ha-textfield>
            <ha-select label="Anchor Point" name="textAnchor" .value=${textAnchorValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'textAnchor', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
              <ha-list-item value=""></ha-list-item>
              <ha-list-item value="start">Start</ha-list-item>
              <ha-list-item value="middle">Middle</ha-list-item>
              <ha-list-item value="end">End</ha-list-item>
            </ha-select>
            <ha-select label="Dominant Baseline" name="dominantBaseline" .value=${dominantBaselineValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'dominantBaseline', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
              <ha-list-item value=""></ha-list-item>
              <ha-list-item value="auto">Auto</ha-list-item>
              <ha-list-item value="middle">Middle</ha-list-item>
              <ha-list-item value="central">Central</ha-list-item>
              <ha-list-item value="hanging">Hanging</ha-list-item>
            </ha-select>
            <ha-textfield label="Text Transform" name="textTransform" .value=${textTransformValue} @input=${(e: Event) => this._handleElementChange(e, index, 'textTransform', 'props')}></ha-textfield>
            <!-- Width/Height in advanced for text -->
            <ha-textfield label="Width (px or %)" name="width" type="number" step="1" .value=${element.layout?.width ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'width', 'layout')}></ha-textfield>
            <ha-textfield label="Height (px or %)" name="height" type="number" step="1" .value=${element.layout?.height ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'height', 'layout')}></ha-textfield>
          ` : ''}
          <!-- Fill color group -->
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Fill Color" name="fill" .value=${fillValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fill', 'props')}></ha-textfield>
        `;
      case 'chisel-endcap':
        return html`
          <!-- Fill and basic layout for chisel endcap -->
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Fill Color" name="fill" .value=${fillValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fill', 'props')}></ha-textfield>
          <ha-select label="Direction" name="direction" .value=${directionValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'direction', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
            <ha-list-item .value="left">Left</ha-list-item>
            <ha-list-item .value="right">Right</ha-list-item>
          </ha-select>
          <ha-textfield label="Width (px)" name="width" type="number" step="1" .value=${element.layout?.width ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'width', 'layout')}></ha-textfield>
          <ha-textfield label="Height (px)" name="height" type="number" step="1" .value=${element.layout?.height ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'height', 'layout')}></ha-textfield>
        `;
      case 'endcap':
        return html`
          <!-- Fill color group -->
          <div style="grid-column: 1 / -1; height: 8px;"></div>
          <ha-textfield label="Fill Color" name="fill" .value=${fillValue} @input=${(e: Event) => this._handleElementChange(e, index, 'fill', 'props')}></ha-textfield>
          <ha-select label="Direction" name="direction" .value=${directionValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'direction', 'props')} @closed=${(ev: Event) => ev.stopPropagation()}>
            <ha-list-item value=""></ha-list-item>
            <ha-list-item value="left">Left</ha-list-item>
            <ha-list-item value="right">Right</ha-list-item>
          </ha-select>
          <ha-textfield label="Width (px)" name="width" type="number" step="1" .value=${element.layout?.width ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'width', 'layout')}></ha-textfield>
          <ha-textfield label="Height (px)" name="height" type="number" step="1" .value=${element.layout?.height ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'height', 'layout')}></ha-textfield>
        `;
      default:
        return html`<span>Unknown element type: ${element.type}</span>`;
    }
  }

  // Renders common layout fields 
  private _renderLayoutFields(element: any, index: number): TemplateResult {
      const layout = element.layout || {};
      const containerAnchorPoint = layout.containerAnchorPoint ?? '';
      const anchorToValue = layout.anchorTo ?? '';
      const anchorPointValue = layout.anchorPoint ?? '';
      const targetAnchorPointValue = layout.targetAnchorPoint ?? '';
      const stretchToValue = layout.stretchTo ?? '';
      const offsetXValue = layout.offsetX ?? '';
      const offsetYValue = layout.offsetY ?? '';
      const otherElementIds = (this._config?.elements || [])
                                .map(el => el.id)
                                .filter(id => id && id !== element.id); 
      return html`
        <div style="grid-column: 1 / -1; height: 8px;"></div>
        <!-- Container Anchor Point and Dropdowns -->
        ${!anchorToValue ? html`
          <div style="min-width: 200px;">
            ${this._renderAnchorGrid({
              label: 'Container Anchors',
              value: containerAnchorPoint,
              onSelect: (val: string) => {
                const event = { target: { value: val, type: 'text' } } as unknown as Event;
                this._handleElementChange(event, index, 'containerAnchorPoint', 'layout');
              },
              labelCenter: true
            })}
          </div>
          <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 8px; min-width: 200px;">
            <ha-select label="Anchor To Element" name="anchorTo" .value=${anchorToValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'anchorTo', 'layout')} @closed=${(ev: Event) => ev.stopPropagation()}>
              <ha-list-item value=""></ha-list-item>
              ${otherElementIds.map(id => html`<ha-list-item .value=${id}>${id}</ha-list-item>`)}
            </ha-select>
            <ha-select label="Stretch To Element" name="stretchTo" .value=${stretchToValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'stretchTo', 'layout')} @closed=${(ev: Event) => ev.stopPropagation()}>
              <ha-list-item value=""></ha-list-item>
              ${otherElementIds.map(id => html`<ha-list-item .value=${id}>${id}</ha-list-item>`)}
            </ha-select>
          </div>
        ` : html`
          <div style="display: flex; flex-direction: column; gap: 16px; min-width: 320px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%;">
              <div style="display: flex; flex-direction: column; align-items: center; min-width: 200px;">
                ${this._renderAnchorGrid({
                  label: 'Anchor Point',
                  value: anchorPointValue,
                  onSelect: (val: string) => {
                    const event = { target: { value: val, type: 'text' } } as unknown as Event;
                    this._handleElementChange(event, index, 'anchorPoint', 'layout');
                  },
                  labelCenter: true
                })}
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; min-width: 200px;">
                ${this._renderAnchorGrid({
                  label: 'Target Anchor Point',
                  value: targetAnchorPointValue,
                  onSelect: (val: string) => {
                    const event = { target: { value: val, type: 'text' } } as unknown as Event;
                    this._handleElementChange(event, index, 'targetAnchorPoint', 'layout');
                  },
                  labelCenter: true
                })}
              </div>
            </div>
            <div style="display: flex; flex-direction: row; gap: 32px; align-items: flex-end; justify-content: flex-start; margin-top: 8px;">
              <div style="min-width: 200px;">
                <ha-select label="Anchor To Element" name="anchorTo" .value=${anchorToValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'anchorTo', 'layout')} @closed=${(ev: Event) => ev.stopPropagation()}>
                  <ha-list-item value=""></ha-list-item>
                  ${otherElementIds.map(id => html`<ha-list-item .value=${id}>${id}</ha-list-item>`)}
                </ha-select>
              </div>
              <div style="min-width: 200px;">
                <ha-select label="Stretch To Element" name="stretchTo" .value=${stretchToValue} @selected=${(e: Event) => this._handleElementChange(e, index, 'stretchTo', 'layout')} @closed=${(ev: Event) => ev.stopPropagation()}>
                  <ha-list-item value=""></ha-list-item>
                  ${otherElementIds.map(id => html`<ha-list-item .value=${id}>${id}</ha-list-item>`)}
                </ha-select>
              </div>
            </div>
          </div>
        `}
        <div style="grid-column: 1 / -1; height: 8px;"></div>
        <!-- Offsets group -->
        <ha-textfield label="Offset X" name="offsetX" type="number" step="1" .value=${offsetXValue} @input=${(e: Event) => this._handleElementChange(e, index, 'offsetX', 'layout')}></ha-textfield>
        <ha-textfield label="Offset Y" name="offsetY" type="number" step="1" .value=${offsetYValue} @input=${(e: Event) => this._handleElementChange(e, index, 'offsetY', 'layout')}></ha-textfield>
        <!-- Stretch Gap group -->
        <ha-textfield label="Stretch Gap" name="stretchPaddingX" type="number" step="1" .value=${layout.stretchPaddingX ?? ''} @input=${(e: Event) => this._handleElementChange(e, index, 'stretchPaddingX', 'layout')}></ha-textfield>
        </div>
      `;
  }

  private _toggleElementCollapse(index: number): void {
    this._collapsedElements = this._collapsedElements.map((c, i) => i === index ? !c : c);
  }
  private _toggleSectionCollapse(index: number, section: 'props' | 'layout'): void {
    this._collapsedSections = {
      ...this._collapsedSections,
      [index]: {
        ...this._collapsedSections[index],
        [section]: !this._collapsedSections[index][section]
      }
    };
  }

  // --- Drag and Drop for Reordering Elements ---
  private _onDragStart(index: number, ev: DragEvent) {
    this._draggedIndex = index;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      // Find the .element-editor for this index
      const editors = this.renderRoot.querySelectorAll('.element-editor');
      const editor = editors[index] as HTMLElement | undefined;
      if (editor) {
        // Clone the node
        const ghost = editor.cloneNode(true) as HTMLElement;
        // Style the ghost
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        ghost.style.width = `${editor.offsetWidth}px`;
        ghost.style.height = `${editor.offsetHeight}px`;
        ghost.style.opacity = '0.8';
        ghost.style.pointerEvents = 'none';
        ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        ghost.style.background = getComputedStyle(editor).background;
        document.body.appendChild(ghost);
        // Offset: center the drag image on the mouse
        const rect = editor.getBoundingClientRect();
        const offsetX = ev.clientX - rect.left;
        const offsetY = ev.clientY - rect.top;
        ev.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        // Remove the ghost after a tick (let the browser use it for drag image)
        setTimeout(() => document.body.removeChild(ghost), 0);
      }
    }
  }
  private _onDragOver(index: number, ev: DragEvent) {
    ev.preventDefault();
    this._dragOverIndex = index;
  }
  private _onDrop(index: number) {
    if (this._draggedIndex === null || this._draggedIndex === index) return;
    if (!this._config || !this._config.elements) return;
    const elements = [...this._config.elements];
    const [moved] = elements.splice(this._draggedIndex, 1);
    elements.splice(index, 0, moved);
    this._config = { ...this._config, elements };
    this._draggedIndex = null;
    this._dragOverIndex = null;
    fireEvent(this, 'config-changed', { config: this._config });
  }
  private _onDragEnd() {
    this._draggedIndex = null;
    this._dragOverIndex = null;
  }

  // --- Main Render --- 

  protected render() {
    if (!this.hass || !this._config) {
      return html``;
    }
    // Group elements by group id
    const groupMap: { [groupId: string]: any[] } = {};
    (this._config.elements || []).forEach((el, idx) => {
      const gid = el.id.split('.')[0];
      if (!groupMap[gid]) groupMap[gid] = [];
      groupMap[gid].push({ el, idx });
    });
    // Only include groups that are explicitly created or present in element ids
    const allGroupNames = Array.from(new Set([
      ...this._groups,
      ...((this._config?.elements || []).map(el => el.id.split('.')[0]))
    ])).filter(name => name && (this._groups.includes(name) || (this._config?.elements || []).some(el => el.id.startsWith(name + '.'))));
    return html`
      <div class="form-container">
        <div class="elements-section">
          <h3>LCARS Groups (${this._groups.length + (this._newGroupDraft ? 1 : 0)})</h3>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <ha-button outlined @click=${() => this._addGroup()}>Add New Group</ha-button>
          </div>
          ${allGroupNames.map(groupId => html`
            <div style="margin-bottom: 24px; border: 1.5px solid var(--divider-color); border-radius: 6px; background: var(--secondary-background-color, #222);">
              <div style="display: flex; align-items: center; padding: 8px 12px; cursor: pointer; user-select: none;" @click=${() => this._toggleGroupCollapse(groupId)}>
                <ha-icon icon="mdi:${this._collapsedGroups[groupId] ? 'chevron-right' : 'chevron-down'}"></ha-icon>
                ${this._editingGroup === groupId
                  ? html`
                      <div style="display: flex; flex-direction: row; align-items: flex-start; width: 100%; margin-left: 8px;">
                        <div style="flex: 1; display: flex; flex-direction: column; min-width: 150px;">
                          <ha-textfield
                            label="Edit Group Name"
                            .value=${this._editingGroupInput}
                            @input=${(e: Event) => {
                              this._editingGroupInput = (e.target as HTMLInputElement).value;
                              this._groupIdWarning = this._validateGroupIdInput(this._editingGroupInput);
                              this.requestUpdate();
                            }}
                            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); this._confirmEditGroup(); } }}
                            autofocus
                          ></ha-textfield>
                          ${this._groupIdWarning ? html`<div style="color: var(--error-color, #c00); font-size: 0.95em; margin-top: 2px;">${this._groupIdWarning}</div>` : ''}
                        </div>
                        <ha-icon-button
                          style="margin-left: 8px; color: var(--primary-color); flex-shrink: 0;"
                          @click=${(e: Event) => { e.stopPropagation(); this._confirmEditGroup(); }}
                          title="Rename Group"
                          .disabled=${!this._editingGroupInput.trim() || (this._groups.includes(this._editingGroupInput.trim()) && this._editingGroupInput.trim() !== groupId) || !!this._groupIdWarning}
                        >
                          <ha-icon icon="mdi:check"></ha-icon>
                        </ha-icon-button>
                        <ha-icon-button
                          style="margin-left: 2px; color: var(--error-color);"
                          @click=${(e: Event) => { e.stopPropagation(); this._cancelEditGroup(); }}
                          title="Cancel"
                        >
                          <ha-icon icon="mdi:close"></ha-icon>
                        </ha-icon-button>
                      </div>
                    `
                  : html`
                      <span style="font-weight: bold; margin-left: 8px;">${groupId}</span>
                      <span style="color: var(--secondary-text-color); margin-left: 12px; font-size: 0.95em;">(${(groupMap[groupId]?.length || 0)} element${(groupMap[groupId]?.length || 0) === 1 ? '' : 's'})</span>
                    `}
                <span style="flex: 1 1 auto;"></span>
                ${!this._collapsedGroups[groupId] && this._editingGroup !== groupId ? html`
                  <ha-icon-button
                    style="margin-left: 2px;"
                    @click=${(e: Event) => { e.stopPropagation(); this._startEditGroup(groupId); }}
                    title="Edit Group Name"
                  >
                    <ha-icon icon="mdi:pencil"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    style="margin-left: 2px; color: var(--error-color);"
                    @click=${(e: Event) => { e.stopPropagation(); this._deleteGroup(groupId); }}
                    title="Delete Group"
                  >
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                ` : ''}
              </div>
              ${this._deleteWarningGroup === groupId ? html`
                <div style="background: var(--error-color, #c00); color: #fff; border-radius: 4px; margin: 8px 16px 0 16px; padding: 12px 16px; display: flex; align-items: center; gap: 16px;">
                  <ha-icon icon="mdi:alert" style="margin-right: 8px;"></ha-icon>
                  <span style="flex:1;">Are you sure you want to delete group <b>${groupId}</b> and all its elements?</span>
                  <ha-button style="background: #fff; color: var(--error-color, #c00);" @click=${() => this._doDeleteGroup(groupId)}>Delete</ha-button>
                  <ha-button outlined style="margin-left: 4px;" @click=${() => this._cancelDeleteGroup()}>Cancel</ha-button>
                </div>
              ` : ''}
              ${this._collapsedGroups[groupId] ? html`` : html`
                <div style="padding: 8px 16px 16px 16px;">
                  ${(groupMap[groupId] || []).map(({ el, idx }) => this._renderElementEditor(el, idx))}
                  <div style="text-align: right; margin-top: 8px;">
                    ${this._addElementDraftGroup === groupId ? html`
                      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <ha-textfield
                          style="min-width: 120px;"
                          label="New Element ID"
                          .value=${this._addElementInput}
                          @input=${(e: Event) => {
                            this._addElementInput = (e.target as HTMLInputElement).value;
                            this._addElementWarning = '';
                            this.requestUpdate();
                          }}
                          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); this._confirmAddElement(); } }}
                          autofocus
                        ></ha-textfield>
                        ${this._addElementWarning ? html`<div style="color: var(--error-color, #c00); font-size: 0.95em; margin-top: 2px; align-self: flex-start;">${this._addElementWarning}</div>` : ''}
                        <div style="display: flex; gap: 4px; margin-top: 2px;">
                          <ha-icon-button
                            style="color: var(--primary-color);"
                            @click=${() => this._confirmAddElement()}
                            title="Add Element"
                            .disabled=${!this._addElementInput.trim()}
                          >
                            <ha-icon icon="mdi:check"></ha-icon>
                          </ha-icon-button>
                          <ha-icon-button
                            style="color: var(--error-color);"
                            @click=${() => this._cancelAddElement()}
                            title="Cancel"
                          >
                            <ha-icon icon="mdi:close"></ha-icon>
                          </ha-icon-button>
                        </div>
                      </div>
                    ` : html`
                      <ha-button small outlined @click=${() => this._addElement(groupId)}>Add Element to Group</ha-button>
                    `}
                  </div>
                </div>
              `}
            </div>
          `)}
          ${this._newGroupDraft ? html`
            <div style="margin-bottom: 24px; border: 1.5px solid var(--primary-color); border-radius: 6px; background: var(--secondary-background-color, #222);">
              <div style="display: flex; align-items: center; padding: 8px 12px;">
                <ha-icon icon="mdi:chevron-down"></ha-icon>
                <div style="display: flex; flex-direction: column; margin-left: 8px; min-width: 120px; flex: 1;">
                  <ha-textfield
                    label="New Group Name"
                    .value=${this._newGroupInput}
                    @input=${(e: Event) => {
                      this._newGroupInput = (e.target as HTMLInputElement).value;
                      this._groupIdWarning = this._validateGroupIdInput(this._newGroupInput);
                      this.requestUpdate();
                    }}
                    @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); this._confirmNewGroup(); } }}
                    autofocus
                  ></ha-textfield>
                  ${this._groupIdWarning ? html`<div style="color: var(--error-color, #c00); font-size: 0.95em; margin-top: 2px;">${this._groupIdWarning}</div>` : ''}
                </div>
                <ha-icon-button
                  style="margin-left: 8px; color: var(--primary-color);"
                  @click=${() => this._confirmNewGroup()}
                  title="Create Group"
                  .disabled=${!this._newGroupInput.trim() || this._groups.includes(this._newGroupInput.trim()) || !!this._groupIdWarning}
                >
                  <ha-icon icon="mdi:check"></ha-icon>
                </ha-icon-button>
                <ha-icon-button
                  style="margin-left: 2px; color: var(--error-color);"
                  @click=${() => this._cancelNewGroup()}
                  title="Cancel"
                >
                  <ha-icon icon="mdi:close"></ha-icon>
                </ha-icon-button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private _validateGroupIdInput(input: string): string {
    if (!input) return '';
    // Only allow a-z, A-Z, 0-9, _, -
    return /^[a-zA-Z0-9_-]+$/.test(input)
      ? ''
      : 'Group ID can only contain letters, numbers, underscores (_), or hyphens (-).';
  }

  private _startEditElementId(index: number, baseId: string) {
    this._editingElementId = index;
    this._editingElementIdInput = baseId;
    this._elementIdWarning = '';
    this.requestUpdate();
  }

  private _confirmEditElementId(index: number, group: string) {
    const baseId = this._editingElementIdInput.trim();
    if (!baseId) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(baseId)) {
      this._elementIdWarning = 'Element ID can only contain letters, numbers, underscores (_), or hyphens (-).';
      this.requestUpdate();
      return;
    }
    if (!this._config || !this._config.elements) return;
    const fullId = `${group}.${baseId}`;
    if (this._config.elements.some((el, idx) => el.id === fullId && idx !== index)) {
      this._elementIdWarning = 'An element with this id already exists in this group.';
      this.requestUpdate();
      return;
    }
    // Actually update the element id
    const newElements = this._config.elements.map((el, i) => {
      if (i === index) {
        return { ...el, id: fullId };
      }
      return el;
    });
    // Only include type if it is defined
    const { type, ...restConfig } = this._config;
    const configToUpdate = { ...restConfig, type: typeof type === 'string' ? type : '', elements: newElements };
    this._config = configToUpdate;
    this._editingElementId = null;
    this._editingElementIdInput = '';
    this._elementIdWarning = '';
    fireEvent(this, 'config-changed', { config: this._config });
    this.requestUpdate();
  }

  private _cancelEditElementId() {
    this._editingElementId = null;
    this._editingElementIdInput = '';
    this._elementIdWarning = '';
    this.requestUpdate();
  }
} 