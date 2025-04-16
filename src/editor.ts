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
const ELEMENT_TYPES = ['rectangle', 'text', 'endcap'];
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
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .element-header .element-header-summary {
      font-weight: bold;
      display: flex;
      align-items: center;
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
    .drag-handle {
      cursor: grab;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .drag-handle:active {
      cursor: grabbing;
      opacity: 1;
    }
    .element-editor[draggable="true"] {
      user-select: none;
    }
  `;

  public setConfig(config: LcarsCardConfig): void {
    this._config = { ...config, elements: config.elements || [] };
    // Only re-initialize collapse state arrays if the number of elements changes
    const numElements = config.elements?.length || 0;
    if (this._collapsedElements.length !== numElements) {
      // Default: all collapsed
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
        } else { // Update top-level key ('type', 'group', or 'id')
          if (value === '' || value === undefined || value === null) {
            const { [key]: _removed, ...rest } = updatedElement;
            return rest;
          } else {
            (updatedElement as any)[key] = value;
          }
        }
        return updatedElement;
      }
      return el;
    });

    this._config = { ...this._config, elements: newElements };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Add a new, default element placeholder
  private _addElement(): void {
    if (!this._config) return;

    const newElement = {
      id: `element-${Date.now()}`,
      type: 'rectangle', // Default to rectangle, user can change
      group: 'default',
      props: { fill: '#FF9900' }, // Add a default fill
      layout: { width: 100, height: 30 } // Add some default size
    };

    const elements = [...(this._config.elements || []), newElement];
    this._config = { ...this._config, elements };
    // Expand the new element, keep others collapsed
    this._collapsedElements = Array(elements.length - 1).fill(true).concat(false);
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Remove an element at a given index
  private _removeElement(index: number): void {
    if (!this._config || !this._config.elements) return;

    const elements = this._config.elements.filter((_, i) => i !== index);
    this._config = { ...this._config, elements };
    fireEvent(this, 'config-changed', { config: this._config });
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
    return html`
      <div class="element-editor"
        @dragover=${(e: DragEvent) => this._onDragOver(index, e)}
        @drop=${() => this._onDrop(index)}
        @dragend=${() => this._onDragEnd()}
        style="${isDragging ? 'opacity:0.5;' : isDragOver ? 'border:2px dashed var(--primary-color); background:rgba(255,152,0,0.08);' : ''}"
      >
        <div class="element-header">
          ${collapsed
            ? html`
                <span class="element-header-summary">
                  ${element.id ?? '(no id)'} <span style="color:var(--secondary-text-color); margin-left: 6px;">(${element.type ?? 'unknown'})</span>
                </span>
                <span class="element-header-actions">
                  <ha-icon-button @click=${() => this._toggleElementCollapse(index)} title="Expand">
                    <ha-icon icon="mdi:chevron-down"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button class="drag-handle" title="Drag to reorder" style="cursor:grab;" tabindex="0"
                    draggable="true"
                    @dragstart=${(e: DragEvent) => this._onDragStart(index, e)}
                  >
                    <ha-icon icon="mdi:drag-vertical"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button @click=${() => this._removeElement(index)} title="Delete Element">
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                </span>
              `
            : html`
                <ha-select
                  label="Element Type"
                  .value=${element.type ?? ''}
                  @selected=${(e: Event) => this._handleElementChange(e, index, 'type')}
                  @closed=${(ev: Event) => ev.stopPropagation()}
                >
                  ${ELEMENT_TYPES.map(type => html`<ha-list-item .value=${type}>${type}</ha-list-item>`)}
                </ha-select>
                <span class="element-header-actions">
                  <ha-icon-button @click=${() => this._toggleElementCollapse(index)} title="Collapse">
                    <ha-icon icon="mdi:chevron-up"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button class="drag-handle" title="Drag to reorder" style="cursor:grab;" tabindex="0"
                    draggable="true"
                    @dragstart=${(e: DragEvent) => this._onDragStart(index, e)}
                  >
                    <ha-icon icon="mdi:drag-vertical"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button @click=${() => this._removeElement(index)} title="Delete Element">
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                </span>
              `}
        </div>
        ${collapsed
          ? html``
          : html`
              <div class="grid-container">
                <!-- Top group: Element Type, ID, Group ID -->
                <ha-textfield
                  label="Element ID"
                  name="id"
                  required
                  .value=${element.id ?? ''}
                  @input=${(e: Event) => this._handleElementChange(e, index, 'id')}
                ></ha-textfield>
                <ha-textfield
                  label="Group ID"
                  name="group"
                  .value=${element.group ?? ''}
                  @input=${(e: Event) => this._handleElementChange(e, index, 'group')}
                ></ha-textfield>
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
    // Optionally, set drag image for better UX
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      // Optionally, set a transparent drag image to avoid default ghost
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
      ev.dataTransfer.setDragImage(img, 0, 0);
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

    return html`
      <div class="form-container">
        <div class="elements-section">
          <h3>LCARS Elements (${this._config.elements?.length || 0})</h3>
          ${this._config.elements?.map((el, index) => this._renderElementEditor(el, index))}
          <div class="add-element">
            <ha-button raised label="Add New Element" @click=${this._addElement}></ha-button>
          </div>
        </div>
      </div>
    `;
  }
} 