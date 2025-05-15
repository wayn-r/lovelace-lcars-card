import { html, TemplateResult } from 'lit';
import { EditorElement } from './elements/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext, Type, PropertyGroup, Layout, LcarsPropertyBase } from './properties/properties.js';
import { repeat } from 'lit/directives/repeat.js';

interface EditorContext {
  hass: any;
  cardConfig: any;
  handleFormValueChanged: (ev: CustomEvent, elementId: string) => void;
  getElementInstance: (elementId: string) => EditorElement | null;
  onDragStart: (ev: DragEvent, elementId: string) => void;
  onDragOver: (ev: DragEvent, elementId: string) => void;
  onDrop: (ev: DragEvent, elementId: string) => void;
  onDragEnd: (ev: DragEvent) => void;
  toggleElementCollapse: (elementId: string) => void;
  startEditElementId: (elementId: string) => void;
  handleDeleteElement: (elementId: string) => void;
  handleConfirmEditElementId: (elementInstance: EditorElement) => void;
  cancelEditElementId: () => void;
  updateElementIdInput: (value: string) => void;
  
  togglePropertyGroupCollapse: (elementId: string, groupKey: PropertyGroup) => void;
  collapsedPropertyGroups: { [elementId: string]: Record<PropertyGroup, boolean> };
  
  editingElementId: string | null;
  editingElementIdInput: string;
  elementIdWarning: string;
  collapsedElements: { [elementId: string]: boolean };
  draggedElementId: string | null;
  dragOverElementId: string | null;
}

interface GroupEditorContext {
  toggleGroupCollapse: (groupId: string) => void;
  startEditGroup: (groupId: string) => void;
  requestDeleteGroup: (groupId: string) => void;
  addElement: (groupId: string) => void;
  handleConfirmEditGroup: (groupId: string) => void;
  cancelEditGroup: () => void;
  handleConfirmDeleteGroup: (groupId: string) => void;
  cancelDeleteGroup: () => void;
  confirmAddElement: () => void;
  cancelAddElement: () => void;
  updateGroupNameInput: (value: string) => void;
  updateNewElementInput: (value: string) => void;
  confirmNewGroup: () => void;
  cancelNewGroup: () => void;
  addGroup: () => void;
  
  collapsedGroups: { [groupId: string]: boolean };
  editingGroup: string | null;
  editingGroupInput: string;
  groupIdWarning: string;
  deleteWarningGroup: string | null;
  addElementDraftGroup: string | null;
  addElementInput: string;
  addElementWarning: string;
  groupInstances: Map<string, LcarsGroup>;
  newGroupInput: string;
}

const PropertyGroupOrder: PropertyGroup[] = [
  PropertyGroup.TYPE,
  PropertyGroup.POSITIONING,
  PropertyGroup.DIMENSIONS,
  PropertyGroup.APPEARANCE,
  PropertyGroup.TEXT,
  PropertyGroup.ANCHOR,
  PropertyGroup.STRETCH,
  PropertyGroup.BUTTON,
];

function getPropertyGroupName(groupKey: PropertyGroup): string {
  switch (groupKey) {
    case PropertyGroup.TYPE: return "Element Type";
    case PropertyGroup.POSITIONING: return "Positioning";
    case PropertyGroup.DIMENSIONS: return "Dimensions";
    case PropertyGroup.APPEARANCE: return "Appearance";
    case PropertyGroup.TEXT: return "Text Styling";
    case PropertyGroup.ANCHOR: return "Anchoring";
    case PropertyGroup.STRETCH: return "Stretching";
    case PropertyGroup.BUTTON: return "Button Configuration";
    default:
      // if groupKey is not one of the expected enum values
      return String(groupKey).charAt(0).toUpperCase() + String(groupKey).slice(1);
  }
}

function renderPropertyGroupHeader(
  groupKey: PropertyGroup,
  isCollapsed: boolean,
  onToggle: () => void
): TemplateResult {
      return html`
    <div class="property-group-header" @click=${onToggle}>
                  <ha-icon class="collapse-icon" icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
      <span class="property-group-name">${getPropertyGroupName(groupKey)}</span>
          </div>
      `;
  }

function renderPropertiesInRows(
  properties: HaFormSchema[],
  context: EditorContext,
  elementId: string,
  formData: any,
  propertiesMap: Map<string, LcarsPropertyBase>,
  isButtonContext: boolean = false
): TemplateResult {
  let renderedItems: TemplateResult[] = [];
  let halfWidthBuffer: { schema: HaFormSchema, layout: Layout } | null = null;

  for (const schema of properties) {
    if (isButtonContext) {
      if (schema.name === 'button.action_config.service' || schema.name === 'button.action_config.service_data') {
        if (formData['button.action_config.type'] !== 'call-service') continue;
      } else if (schema.name === 'button.action_config.navigation_path') {
        if (formData['button.action_config.type'] !== 'navigate') continue;
      } else if (schema.name === 'button.action_config.url_path') {
        if (formData['button.action_config.type'] !== 'url') continue;
      } else if (schema.name === 'button.action_config.entity') {
        if (formData['button.action_config.type'] !== 'toggle' && formData['button.action_config.type'] !== 'more-info') continue;
      } else if (schema.name === 'button.action_config.confirmation') {
        if (!formData['button.action_config.type'] || formData['button.action_config.type'] === 'none') continue;
      }
    }

    const propMeta = propertiesMap.get(schema.name);
    const layout = propMeta?.layout || Layout.FULL;

    if (layout === Layout.FULL) {
      if (halfWidthBuffer) {
        // If a half-width property is pending, render it with an empty right side before a full-width item
        renderedItems.push(html`
          <div class="property-row">
            ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
            <div class="property-right"></div>
          </div>
        `);
        halfWidthBuffer = null;
      }
      renderedItems.push(renderFullWidthPropertyForm(context, elementId, formData, schema));
    } else if (layout === Layout.HALF || layout === Layout.HALF_LEFT || layout === Layout.HALF_RIGHT) {
      if (!halfWidthBuffer) {
        // Start a new pair with the current half-width property
        halfWidthBuffer = { schema, layout };
      } else {
        renderedItems.push(html`
          <div class="property-row">
            ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
            ${renderHalfWidthPropertyForm(context, elementId, formData, schema, 'property-right')}
          </div>
        `);
        halfWidthBuffer = null;
      }
    }
  }

  if (halfWidthBuffer) {
    renderedItems.push(html`
      <div class="property-row">
        ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
        <div class="property-right"></div>
      </div>
    `);
  }

  return html`${renderedItems}`;
}

function renderStretchRow(
  context: EditorContext,
  elementId: string,
  formData: any,
  stretchToSchema: HaFormSchema | undefined,
  stretchDirectionSchema: HaFormSchema | undefined,
  stretchPaddingSchema: HaFormSchema | undefined,
  showDetails: boolean
): TemplateResult {
  if (!stretchToSchema) return html``;

  if (!showDetails) {
    return renderFullWidthPropertyForm(context, elementId, formData, stretchToSchema);
  } else {
    return html`
      <div class="property-row stretch-layout"> <!-- Use a specific class for stretch if needed for styling -->
        <div class="property-left stretch-column-left">
          ${renderFullWidthPropertyForm(context, elementId, formData, stretchToSchema)} <!-- StretchTo takes full width of this column -->
          ${stretchPaddingSchema ? renderFullWidthPropertyForm(context, elementId, formData, stretchPaddingSchema) : ''} <!-- Padding below it -->
        </div>
        <div class="property-right stretch-column-right">
          ${stretchDirectionSchema ? renderHalfWidthPropertyForm(context, elementId, formData, stretchDirectionSchema, "", true) : ''} <!-- Direction custom selector -->
        </div>
      </div>
    `;
  }
}

function renderGroupContent(
  groupKey: PropertyGroup,
  propertiesInGroup: HaFormSchema[],
  context: EditorContext,
  elementId: string,
  formData: any,
  propertiesMap: Map<string, LcarsPropertyBase>
): TemplateResult {
  if (groupKey === PropertyGroup.ANCHOR) {
    const anchorToSchema = propertiesInGroup.find(s => s.name === 'anchorTo');
    const anchorPointSchema = propertiesInGroup.find(s => s.name === 'anchorPoint');
    const targetAnchorPointSchema = propertiesInGroup.find(s => s.name === 'targetAnchorPoint');

    const showAnchorPoints = formData.anchorTo && formData.anchorTo !== '';

    return html`
      ${anchorToSchema ? renderFullWidthPropertyForm(context, elementId, formData, anchorToSchema) : ''}
      ${showAnchorPoints && anchorPointSchema && targetAnchorPointSchema ? html`
        <div class="property-row">
          ${renderHalfWidthPropertyForm(context, elementId, formData, anchorPointSchema, 'property-left', true)}
          ${renderHalfWidthPropertyForm(context, elementId, formData, targetAnchorPointSchema, 'property-right', true)}
        </div>
      ` : ''}
    `;
  }

  if (groupKey === PropertyGroup.STRETCH) {
    const stretchTo1Schema = propertiesInGroup.find(s => s.name === 'stretchTo1');
    const stretchDirection1Schema = propertiesInGroup.find(s => s.name === 'stretchDirection1');
    const stretchPadding1Schema = propertiesInGroup.find(s => s.name === 'stretchPadding1');

    const stretchTo2Schema = propertiesInGroup.find(s => s.name === 'stretchTo2');
    const stretchDirection2Schema = propertiesInGroup.find(s => s.name === 'stretchDirection2');
    const stretchPadding2Schema = propertiesInGroup.find(s => s.name === 'stretchPadding2');

    const showStretch1Details = formData.stretchTo1 && formData.stretchTo1 !== '';
    const showStretch2Details = formData.stretchTo2 && formData.stretchTo2 !== '';

    return html`
      ${stretchTo1Schema ? renderStretchRow(context, elementId, formData, stretchTo1Schema, stretchDirection1Schema, stretchPadding1Schema, showStretch1Details) : ''}
      ${showStretch1Details && stretchTo2Schema ? renderStretchRow(context, elementId, formData, stretchTo2Schema, stretchDirection2Schema, stretchPadding2Schema, showStretch2Details) : ''}
    `;
  }

  if (groupKey === PropertyGroup.BUTTON) {
    const buttonEnabledSchema = propertiesInGroup.find(s => s.name === 'button.enabled');
    const otherButtonProps = propertiesInGroup.filter(s => s.name !== 'button.enabled');

    return html`
      ${buttonEnabledSchema ? renderFullWidthPropertyForm(context, elementId, formData, buttonEnabledSchema) : ''}
      ${formData['button.enabled'] ?
        renderPropertiesInRows(otherButtonProps, context, elementId, formData, propertiesMap, true)
        : ''}
    `;
  }

  return renderPropertiesInRows(propertiesInGroup, context, elementId, formData, propertiesMap);
}

export function renderElement(
  element: any,
  context: EditorContext
): TemplateResult {
  if (!element || !element.id) return html``;

  const elementId = element.id;
  const elementInstance = context.getElementInstance(elementId);
  
  const isCollapsed = context.collapsedElements[elementId];
  const isEditingId = context.editingElementId === elementId;
  const baseId = elementId.substring(elementId.indexOf('.') + 1);
  const isDragging = context.draggedElementId === elementId;
  const isDragOver = context.dragOverElementId === elementId;

  if (!elementInstance) {
      const typeProperty = new Type();
      const typeSchema = typeProperty.getSchema();
      const minimalFormData = { type: element.type || '' };

        return html`
          <div class="element-editor error" data-element-id=${elementId}>
              <div class="element-header ${isEditingId ? 'editing' : ''}" @click=${() => !isEditingId && context.toggleElementCollapse(elementId)}>
                  <ha-icon class="collapse-icon" icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
                  ${isEditingId
                      ? renderElementIdEditForm(elementId, null as any, context)
                      : html`
                         <span class="element-name">${baseId || '(no base id)'}</span>
                         <span class="element-type" style="color: var(--error-color);">(invalid type: "${element.type || ''}")</span>
                      `
                  }
                  <span class="spacer"></span>
                   ${!isEditingId ? html`
                        <div class="edit-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID">
                            <ha-icon icon="mdi:pencil"></ha-icon>
                        </div>
                        <div class="delete-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element">
                            <ha-icon icon="mdi:delete"></ha-icon>
                        </div>
                   `: ''}
              </div>

              ${!isCollapsed ? html`
                  <div class="element-body">
                      <div class="property-container-groups">
                          <div class="property-group">
                              <div class="property-group-content">
                                  <p style="color: var(--error-color); margin-bottom: 8px;">Please select a valid element type:</p>
                                  ${renderFullWidthPropertyForm(context, elementId, minimalFormData, typeSchema)}
                              </div>
                          </div>
                      </div>
                  </div>
              ` : ''}
            </div>
        `;
    }

  const otherElementIds = Array.isArray(context.cardConfig?.elements) 
      ? context.cardConfig.elements
          .filter((el: any) => el.id && el.id !== elementId)  
          .map((el: any) => ({ value: el.id, label: el.id }))
      : [];
  
  const schemaContext: PropertySchemaContext = { otherElementIds };
  const allSchemas = elementInstance.getSchema(schemaContext);
  const propertiesMap = elementInstance.getPropertiesMap();
  const formData = elementInstance.getFormData();
  
  const collapsedPropertyGroupsForElement = context.collapsedPropertyGroups[elementId] || {};

  const typeSchema = allSchemas.find(
    s => propertiesMap.get(s.name)?.propertyGroup === PropertyGroup.TYPE
  );

  return html`
    <div class="element-editor ${isDragOver ? 'drag-over' : ''}"
         data-element-id=${elementId}
         draggable="true"
         @dragstart=${(e: DragEvent) => context.onDragStart(e, elementId)}
         @dragover=${(e: DragEvent) => context.onDragOver(e, elementId)}
         @drop=${(e: DragEvent) => context.onDrop(e, elementId)}
         @dragend=${context.onDragEnd}
         style=${isDragging ? 'opacity: 0.4;' : ''}
    >
      <div class="element-header ${isEditingId ? 'editing' : ''}" @click=${() => !isEditingId && context.toggleElementCollapse(elementId)}>
          <ha-icon class="collapse-icon" icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
          ${isEditingId
              ? renderElementIdEditForm(elementId, elementInstance, context)
              : html`
                  <span class="element-name">${baseId || '(no base id)'}</span>
                  <span class="element-type">(${element.type || 'unknown'})</span>
                `
          }
          <span class="spacer"></span>
          ${!isEditingId ? html`
               <div 
                   class="drag-handle" 
                   title="Drag to reorder" 
                   draggable="true" 
                   @dragstart=${(e: DragEvent) => context.onDragStart(e, elementId)}
                   @mousedown=${(e: MouseEvent) => e.stopPropagation()} /* Prevent text selection */
               >
                   <ha-icon icon="mdi:drag-vertical"></ha-icon>
               </div>
               <div class="edit-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID">
                   <ha-icon icon="mdi:pencil"></ha-icon>
               </div>
               <div class="delete-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element">
                   <ha-icon icon="mdi:delete"></ha-icon>
               </div>
          ` : ''}
      </div>

      ${!isCollapsed ? html`
          <div class="element-body">
               <div class="property-container-groups">
                    ${
                    typeSchema ? html`
                      <div class="property-group type-property-group">
                        <div class="property-group-content">
                          ${renderFullWidthPropertyForm(context, elementId, formData, typeSchema)}
                        </div>
                      </div>
                    ` : ''}
                    
                    ${
                    PropertyGroupOrder.filter(groupKey => groupKey !== PropertyGroup.TYPE).map(groupKey => {
                        const propertiesForThisGroup = allSchemas.filter(
                            s => propertiesMap.get(s.name)?.propertyGroup === groupKey
                        );

                        if (propertiesForThisGroup.length === 0) {
                            return html``;
                        }

                        const isGroupCurrentlyCollapsed = collapsedPropertyGroupsForElement[groupKey] ?? true;

                        return html`
                            <div class="property-group">
                                ${renderPropertyGroupHeader(
                                    groupKey,
                                    isGroupCurrentlyCollapsed,
                                    () => context.togglePropertyGroupCollapse(elementId, groupKey)
                                )}
                                ${!isGroupCurrentlyCollapsed ? html`
                                    <div class="property-group-content">
                                        ${renderGroupContent(groupKey, propertiesForThisGroup, context, elementId, formData, propertiesMap)}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    })}
               </div>
               ${allSchemas.length === 0 ? html`<p>No configurable properties for this element type.</p>` : ''} 
          </div>
      ` : ''}
    </div>
  `;
}

function renderCustomSelector(
  schema: HaFormSchema, 
  value: string, 
  onChange: (value: string) => void
): TemplateResult {
  if (schema.selector && (schema.selector as any).lcars_grid) {
    const lcarsGridSelector = schema.selector as any;
    
    return html`
      <lcars-grid-selector
        .label=${schema.label || schema.name}
        .value=${value || ''}
        ?labelCenter=${lcarsGridSelector.lcars_grid.labelCenter}
        ?disableCorners=${lcarsGridSelector.lcars_grid.disableCorners}
        ?disableCenter=${lcarsGridSelector.lcars_grid.disableCenter}
        ?onlyCardinalDirections=${lcarsGridSelector.lcars_grid.onlyCardinalDirections}
        ?stretchMode=${lcarsGridSelector.lcars_grid.stretchMode}
        ?clearable=${lcarsGridSelector.lcars_grid.clearable}
        ?required=${lcarsGridSelector.lcars_grid.required}
        @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}
      ></lcars-grid-selector>
    `;
  }
  return html``;
}

function renderActionButtons(
  isValid: boolean,
  onConfirm: (e: Event) => void,
  onCancel: (e: Event) => void,
  confirmTitle: string = "Confirm",
  cancelTitle: string = "Cancel"
): TemplateResult {
  return html`
    <div class="editing-actions">
      <ha-icon-button
        class="confirm-button ${isValid ? 'valid' : ''}"
        @click=${(e: Event) => { 
            e.stopPropagation(); 
            if (isValid) { onConfirm(e); }
        }}
        title=${confirmTitle}
        .disabled=${!isValid}
      >
        <ha-icon icon="mdi:check"></ha-icon>
      </ha-icon-button>
      <ha-icon-button
        class="cancel-button"
        @click=${(e: Event) => { 
            e.stopPropagation(); 
            onCancel(e);
        }}
        title=${cancelTitle}
      >
        <ha-icon icon="mdi:close"></ha-icon>
      </ha-icon-button>
    </div>
  `;
}

export function renderElementIdEditForm(
  elementId: string, 
  elementInstance: EditorElement,
  context: EditorContext
): TemplateResult {
    const currentInput = context.editingElementIdInput;
    const warningMessage = context.elementIdWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return renderInputForm(
      "Edit Element ID (base)",
      currentInput,
      warningMessage,
      isValid,
      (newValue) => {
        elementInstance.updateIdInput(newValue);
        context.updateElementIdInput(newValue);
      },
      (e) => {
        if (e.key === 'Enter' && isValid) {
          e.stopPropagation();
          context.handleConfirmEditElementId(elementInstance);
        }
      },
      () => context.handleConfirmEditElementId(elementInstance),
      () => {
        elementInstance.cancelEditingId();
        context.cancelEditElementId();
      },
      "Rename Element ID",
      "Cancel"
    );
}

function renderInputForm(
  label: string,
  currentInput: string,
  warningMessage: string | null | undefined,
  isValid: boolean,
  onInput: (newValue: string) => void,
  onKeydown: (e: KeyboardEvent) => void,
  onConfirm: (e: Event) => void,
  onCancel: (e: Event) => void,
  confirmTitle: string,
  cancelTitle: string
): TemplateResult {
  return html`
    <div class="element-name-input">
      <ha-textfield
        .label=${label}
        .value=${currentInput}
        @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
        @keydown=${onKeydown}
        autofocus
        required
        .invalid=${!!warningMessage}
      ></ha-textfield>
      ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
    </div>
    ${renderActionButtons(isValid, onConfirm, onCancel, confirmTitle, cancelTitle)}
  `;
}

export function renderGroup(
  groupId: string, 
  elementsInGroup: any[],
  editorContext: EditorContext,
  groupContext: GroupEditorContext
): TemplateResult {
    const isUngrouped = groupId === '__ungrouped__';
    const isCollapsed = groupContext.collapsedGroups[groupId];
    const isEditing = groupContext.editingGroup === groupId;

    return html`
      <div class="group-editor ${isUngrouped ? 'ungrouped' : ''}">
          <div class="group-header ${isEditing ? 'editing' : ''}" @click=${() => !isEditing && groupContext.toggleGroupCollapse(groupId)}>
               <ha-icon icon="mdi:${isCollapsed ? 'chevron-right' : 'chevron-down'}"></ha-icon>
               ${isEditing
                  ? renderGroupEditForm(groupId, groupContext)
                  : html`
                      <span class="group-name">${isUngrouped ? 'Ungrouped Elements' : groupId}</span>
                      <span class="group-count">(${elementsInGroup.length})</span>
                    `
               }
               <span class="spacer"></span>
               ${!isUngrouped && !isEditing && !isCollapsed ? html`
                  <div
                      class="edit-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.startEditGroup(groupId); }}
                      title="Edit Group Name"
                  >
                      <ha-icon icon="mdi:pencil"></ha-icon>
                  </div>
                  <div
                      class="delete-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.requestDeleteGroup(groupId); }}
                      title="Delete Group"
                  >
                      <ha-icon icon="mdi:delete"></ha-icon>
                  </div>
               ` : ''}
          </div>

          ${groupContext.deleteWarningGroup === groupId ? renderGroupDeleteWarning(groupId, groupContext) : ''}

          ${!isCollapsed
              ? html`
                  <div class="element-list">
                      ${repeat(
                          elementsInGroup,
                          (element) => element.id,
                          (element) => renderElement(element, editorContext)
                      )}
                      ${!isUngrouped ? html`
                           <div class="add-element-section">
                              ${groupContext.addElementDraftGroup === groupId
                                  ? renderAddElementForm(groupContext)
                                  : html`<ha-button small outlined @click=${() => groupContext.addElement(groupId)}>Add Element to Group</ha-button>`
                              }
                           </div>
                      ` : ''}
                  </div>
                `
              : ''}
      </div>
    `;
}

export function renderNewGroupForm(groupContext: GroupEditorContext): TemplateResult {
    const currentInput = groupContext.newGroupInput;
    const warningMessage = groupContext.groupIdWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return html`
      <div class="group-editor new-group">
        <div class="group-header editing">
          <ha-icon icon="mdi:chevron-down"></ha-icon>
          ${renderInputForm(
            "New Group Name",
            currentInput,
            warningMessage,
            isValid,
            (newValue) => groupContext.updateGroupNameInput(newValue),
            (e) => {
              if (e.key === 'Enter' && isValid) {
                e.stopPropagation();
                groupContext.confirmNewGroup();
              }
            },
            () => groupContext.confirmNewGroup(),
            () => groupContext.cancelNewGroup(),
            "Create Group",
            "Cancel"
          )}
        </div>
      </div>
    `;
}

export function renderGroupEditForm(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
    const currentInput = groupContext.editingGroupInput;
    const warningMessage = groupContext.groupIdWarning;
    const groupInstance = groupContext.groupInstances.get(groupId);
    const isValid = !!currentInput.trim() && !warningMessage;

    return renderInputForm(
      "Edit Group Name",
      currentInput,
      warningMessage,
      isValid,
      (newValue) => {
        if (groupInstance) {
          groupInstance.updateNameInput(newValue);
        }
        groupContext.updateGroupNameInput(newValue);
      },
      (e) => {
        if (e.key === 'Enter' && isValid) {
          e.stopPropagation();
          groupContext.handleConfirmEditGroup(groupId);
        }
      },
      () => groupContext.handleConfirmEditGroup(groupId),
      () => groupContext.cancelEditGroup(),
      "Rename Group",
      "Cancel"
    );
}

export function renderGroupDeleteWarning(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
  return html`
      <div class="delete-warning">
          <ha-icon icon="mdi:alert"></ha-icon>
          <span>Delete group <b>${groupId}</b> and all its elements?</span>
          <ha-button class="warning-button" @click=${() => groupContext.handleConfirmDeleteGroup(groupId)}>Delete</ha-button>
          <ha-button @click=${groupContext.cancelDeleteGroup}>Cancel</ha-button>
      </div>
  `;
}

export function renderAddElementForm(groupContext: GroupEditorContext): TemplateResult {
    const groupId = groupContext.addElementDraftGroup;
    if (!groupId) return html``;

    const currentInput = groupContext.addElementInput;
    const warningMessage = groupContext.addElementWarning;
    const isValid = !!currentInput.trim() && !warningMessage;

    return html`
      <div class="add-element-form">
        ${renderInputForm(
          "New Element ID",
          currentInput,
          warningMessage,
          isValid,
          (newValue) => groupContext.updateNewElementInput(newValue),
          (e) => {
            if (e.key === 'Enter' && isValid) {
              e.stopPropagation();
              groupContext.confirmAddElement();
            }
          },
          () => groupContext.confirmAddElement(),
          () => groupContext.cancelAddElement(),
          "Add Element",
          "Cancel"
        )}
      </div>
    `;
}

export function renderGroupList(
  groupedElements: { [groupId: string]: any[] },
  editorContext: EditorContext,
  groupContext: GroupEditorContext
): TemplateResult {
    const groupIdsToRender = Object.keys(groupedElements).sort();

    return html`
      <div class="groups-container">
          <div class="add-group-section" style="margin-bottom: 16px;">
              <ha-button outlined @click=${() => groupContext.addGroup()}>Add New Group</ha-button>
          </div>

          ${Object.keys(groupedElements).sort().map(groupId => 
            renderGroup(groupId, groupedElements[groupId], editorContext, groupContext)
          )}

          ${groupedElements['__ungrouped__'] && groupedElements['__ungrouped__'].length > 0
              ? renderGroup('__ungrouped__', groupedElements['__ungrouped__'], editorContext, groupContext)
              : ''}
      </div>
    `;
}

function renderFullWidthPropertyForm(
  context: EditorContext,
  elementId: string,
  formData: any,
  schema: HaFormSchema | undefined
): TemplateResult {
  if (!schema) return html``;
  
  return html`
    <div class="property-full-width">
      <ha-form
        .hass=${context.hass}
        .data=${formData}
        .schema=${[schema]}
        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
      ></ha-form>
    </div>
  `;
}

function renderHalfWidthPropertyForm(
  context: EditorContext,
  elementId: string,
  formData: any,
  schema: HaFormSchema | undefined,
  sideClass: "property-left" | "property-right" | "",
  isCustom: boolean = false
): TemplateResult {
  if (!schema) return html``;
  
  const content = isCustom && schema.selector && (schema.selector as any).lcars_grid ?
    renderCustomSelector(schema, formData[schema.name], (value: string) => {
      const detail = { value: { ...formData, [schema.name]: value } };
      const customEvent = new CustomEvent('value-changed', { detail, bubbles: true, composed: true });
      context.handleFormValueChanged(customEvent, elementId);
    })
    :
    html`
      <ha-form
        .hass=${context.hass}
        .data=${formData}
        .schema=${[schema]}
        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
      ></ha-form>
    `;

  return sideClass ? html`<div class="${sideClass}">${content}</div>` : content;
}