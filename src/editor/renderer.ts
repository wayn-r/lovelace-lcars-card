import { html, TemplateResult } from 'lit';
import { LcarsElementBase } from './properties/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext } from './properties/properties.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
interface EditorContext {
  hass: any;
  handleFormValueChanged: (ev: CustomEvent, elementId: string) => void;
  getElementInstance: (elementId: string) => LcarsElementBase | null;
  onDragStart: (ev: DragEvent, elementId: string) => void;
  onDragOver: (ev: DragEvent, elementId: string) => void;
  onDrop: (ev: DragEvent, elementId: string) => void;
  onDragEnd: (ev: DragEvent) => void;
  toggleElementCollapse: (elementId: string) => void;
  startEditElementId: (elementId: string) => void;
  handleDeleteElement: (elementId: string) => void;
  handleConfirmEditElementId: (elementInstance: LcarsElementBase) => void;
  cancelEditElementId: () => void;
  updateElementIdInput: (value: string) => void;
  
  // State variables
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
  
  // State variables
  collapsedGroups: { [groupId: string]: boolean };
  editingGroup: string | null;
  editingGroupInput: string;
  groupIdWarning: string;
  deleteWarningGroup: string | null;
  addElementDraftGroup: string | null;
  addElementInput: string;
  addElementWarning: string;
  groupInstances: Map<string, LcarsGroup>;
}

// Function to render a single element
export function renderElement(
  element: any, 
  context: EditorContext
): TemplateResult {
  if (!element || !element.id) return html``; 

  const elementId = element.id;
  const elementInstance = context.getElementInstance(elementId);
  if (!elementInstance) {
      return html`<div class="element-editor error">Error: Unknown element type '${element.type}' for ID ${elementId}</div>`;
  }

  const isCollapsed = context.collapsedElements[elementId];
  const isEditingId = context.editingElementId === elementId;
  const baseId = elementId.substring(elementId.indexOf('.') + 1);
  const isDragging = context.draggedElementId === elementId;
  const isDragOver = context.dragOverElementId === elementId;

  // Prepare context for schema generation
  const config = element;
  const otherElementIds = Array.isArray(config.elements) 
      ? config.elements
          .map((el: any) => ({ value: el.id, label: `${el.id || '(No ID)'}` }))
          .filter((el: any) => el.value && el.value !== elementId)
      : [];
  const schemaContext: PropertySchemaContext = { otherElementIds };

  // Get the unified schema dynamically
  const schema = elementInstance.getSchema(schemaContext);

  // Prepare data for the form (flattened based on schema)
  const propertiesMap = elementInstance.getPropertiesMap();
  const formData: Record<string, any> = {};
  propertiesMap.forEach((propInstance, key) => {
      const pathParts = propInstance.configPath.split('.');
      if (pathParts.length === 2) {
          const parentKey = pathParts[0] as 'props' | 'layout';
          const childKey = pathParts[1];
          // Get value from the actual config object
          if (element[parentKey] && childKey in element[parentKey]) {
               formData[key] = element[parentKey][childKey];
          }
      }
  });
  
  // Filter schema to separate standard fields from custom ones (like grid selector)
  const standardSchema = schema.filter(s => s.type !== 'custom');
  const customSchema = schema.filter(s => s.type === 'custom');

  return html`
    <div class="element-editor"
         data-element-id=${elementId}
         draggable="true"
         @dragstart=${(e: DragEvent) => context.onDragStart(e, elementId)}
         @dragover=${(e: DragEvent) => context.onDragOver(e, elementId)}
         @drop=${(e: DragEvent) => context.onDrop(e, elementId)}
         @dragend=${context.onDragEnd}
         style=${isDragging ? 'opacity: 0.5;' : ''}
         class=${isDragOver ? 'drag-over' : ''}
    >
      <div class="element-header" @click=${() => !isEditingId && context.toggleElementCollapse(elementId)}>
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
               <ha-icon-button class="drag-handle" title="Drag to reorder" @mousedown=${(e: Event) => { e.stopPropagation(); }}> <ha-icon icon="mdi:drag-vertical"></ha-icon> </ha-icon-button>
               <ha-icon-button class="edit-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID"> <ha-icon icon="mdi:pencil"></ha-icon> </ha-icon-button>
               <ha-icon-button class="delete-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element"> <ha-icon icon="mdi:delete"></ha-icon> </ha-icon-button>
          ` : ''}
      </div>

      ${!isCollapsed ? html`
          <div class="element-body">
               ${standardSchema.length > 0
                   ? html`<ha-form
                         .hass=${context.hass}
                         .data=${formData} 
                         .schema=${standardSchema} 
                         .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                         @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                     ></ha-form>`
                  : ''}
              
               ${customSchema.map(gridSchema => {
                   if (gridSchema.selector.lcars_grid) { // Check if it's our grid selector
                      return html`<lcars-grid-selector
                              .label=${gridSchema.label || gridSchema.name}
                              .value=${formData[gridSchema.name] || ''}
                              ?labelCenter=${gridSchema.selector.lcars_grid.labelCenter}
                              ?disableCorners=${gridSchema.selector.lcars_grid.disableCorners}
                              @value-changed=${(e: CustomEvent) => {
                                  // Manually trigger the main form handler with the updated value for this custom field
                                  const detail = { value: { ...formData, [gridSchema.name]: e.detail.value } };
                                  const customEvent = new CustomEvent('value-changed', { detail });
                                  context.handleFormValueChanged(customEvent, elementId);
                              }}
                          ></lcars-grid-selector>`;
                      }
                  return ''; // Handle other potential custom types if needed
               })}
               ${schema.length === 0 ? html`<p>No configurable properties for this element type.</p>` : ''} 
          </div>
          ` : ''}
    </div>
  `;
}

// Renders the input fields for editing an element's base ID
export function renderElementIdEditForm(
  elementId: string, 
  elementInstance: LcarsElementBase,
  context: EditorContext
): TemplateResult {
    // Use a placeholder or error message if instance somehow isn't found
    const currentInput = context.editingElementIdInput; 
    const warningMessage = context.elementIdWarning;

    return html`
      <div class="element-name-input">
          <ha-textfield
              label="Edit Element ID (base)"
              .value=${currentInput}
              @input=${(e: Event) => {
                  const newValue = (e.target as HTMLInputElement).value;
                  // Update both the element instance and the editor's state
                  elementInstance.updateIdInput(newValue);
                  context.updateElementIdInput(newValue);
                  // Error message will be synced by the updateElementIdInput method
              }}
              @keydown=${(e: KeyboardEvent) => { 
                  if (e.key === 'Enter') { 
                      e.stopPropagation(); 
                      context.handleConfirmEditElementId(elementInstance); 
                  } 
              }}
              autofocus
              required
              .invalid=${!!warningMessage}
          ></ha-textfield>
          ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
      </div>
       <ha-icon-button
          class="confirm-button"
          @click=${(e: Event) => { 
              e.stopPropagation(); 
              context.handleConfirmEditElementId(elementInstance); 
          }}
          title="Rename Element ID"
          .disabled=${!currentInput.trim() || !!warningMessage}
      >
          <ha-icon icon="mdi:check"></ha-icon>
      </ha-icon-button>
      <ha-icon-button
          class="cancel-button"
          @click=${(e: Event) => { 
              e.stopPropagation(); 
              elementInstance.cancelEditingId(); // Cancel on instance
              context.cancelEditElementId(); // Cancel on editor
          }}
          title="Cancel"
      >
          <ha-icon icon="mdi:close"></ha-icon>
      </ha-icon-button>
  `;
}

// Renders a single group container and its elements
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
          <div class="group-header" @click=${() => !isEditing && groupContext.toggleGroupCollapse(groupId)}>
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
                  <ha-icon-button
                      class="edit-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.startEditGroup(groupId); }}
                      title="Edit Group Name"
                  >
                      <ha-icon icon="mdi:pencil"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                      class="delete-button"
                      @click=${(e: Event) => { e.stopPropagation(); groupContext.requestDeleteGroup(groupId); }}
                      title="Delete Group"
                  >
                      <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
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

// Renders the form for adding a new group
export function renderNewGroupForm(groupContext: GroupEditorContext): TemplateResult {
  return html`
      <div class="group-editor new-group-draft">
          <div class="group-header">
              <ha-icon icon="mdi:chevron-down"></ha-icon>
              <div class="group-name-input">
                  <ha-textfield
                      label="New Group Name"
                      .value=${groupContext.editingGroupInput}
                      @input=${(e: Event) => {
                          const newValue = (e.target as HTMLInputElement).value;
                          // Update the editor state through the callback
                          groupContext.updateGroupNameInput(newValue);
                      }}
                      @keydown=${(e: KeyboardEvent) => { 
                          if (e.key === 'Enter') {
                              // Use the proper callback for confirming new group
                              groupContext.confirmAddElement();
                          }
                      }}
                      autofocus
                      required
                      error-message=${groupContext.groupIdWarning || "Invalid input"}
                      .invalid=${!!groupContext.groupIdWarning}
                  ></ha-textfield>
                  ${groupContext.groupIdWarning ? html`<div class="warning-text">${groupContext.groupIdWarning}</div>` : ''}
              </div>
               <ha-icon-button
                  class="confirm-button"
                  @click=${groupContext.confirmAddElement}
                  title="Create Group"
                  .disabled=${!groupContext.editingGroupInput.trim() || !!groupContext.groupIdWarning}
               >
                  <ha-icon icon="mdi:check"></ha-icon>
              </ha-icon-button>
              <ha-icon-button
                  class="cancel-button"
                  @click=${groupContext.cancelAddElement}
                  title="Cancel"
              >
                  <ha-icon icon="mdi:close"></ha-icon>
              </ha-icon-button>
          </div>
      </div>
    `;
}

// Renders the input fields when editing a group name
export function renderGroupEditForm(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
    // Get the actual instance to bind events and get state
    const groupInstance = groupContext.groupInstances.get(groupId);
    if (!groupInstance) {
        return html`<div class="error-message">Error: Group instance not found.</div>`;
    }

    return html`
      <div class="group-name-input">
          <ha-textfield
              label="Edit Group Name"
              .value=${groupContext.editingGroupInput}
              @input=${(e: Event) => {
                  const newValue = (e.target as HTMLInputElement).value;
                  // Update both the group instance and the editor's state
                  groupInstance.updateNameInput(newValue);
                  groupContext.updateGroupNameInput(newValue);
                  // Error message will be synced by the updateGroupNameInput method
              }}
              @keydown=${(e: KeyboardEvent) => { 
                  if (e.key === 'Enter') { 
                      e.stopPropagation(); 
                      groupContext.handleConfirmEditGroup(groupId);
                  } 
              }}
              autofocus
              required
              .invalid=${!!groupContext.groupIdWarning}
          ></ha-textfield>
          ${groupContext.groupIdWarning ? html`<div class="warning-text">${groupContext.groupIdWarning}</div>` : ''}
      </div>
      <ha-icon-button
          class="confirm-button"
          @click=${(e: Event) => { 
              e.stopPropagation(); 
              groupContext.handleConfirmEditGroup(groupId);
          }}
          title="Rename Group"
          .disabled=${!groupContext.editingGroupInput.trim() || !!groupContext.groupIdWarning}
      >
          <ha-icon icon="mdi:check"></ha-icon>
      </ha-icon-button>
      <ha-icon-button
          class="cancel-button"
          @click=${(e: Event) => { 
              e.stopPropagation(); 
              groupInstance.cancelEditingName(); // Cancel on instance 
              groupContext.cancelEditGroup(); // Cancel on editor 
          }}
          title="Cancel"
      >
          <ha-icon icon="mdi:close"></ha-icon>
      </ha-icon-button>
    `;
}

// Renders the confirmation dialog for deleting a group
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

// Renders the form for adding a new element within a group
export function renderAddElementForm(groupContext: GroupEditorContext): TemplateResult {
  return html`
      <div class="add-element-form">
          <ha-textfield
              label="New Element ID (base)"
              .value=${groupContext.addElementInput}
              @input=${(e: Event) => {
                  const newValue = (e.target as HTMLInputElement).value;
                  // Update the editor state through the callback
                  groupContext.updateNewElementInput(newValue);
              }}
              @keydown=${(e: KeyboardEvent) => { 
                  if (e.key === 'Enter') {
                      groupContext.confirmAddElement();
                  }
              }}
              autofocus
              required
              .invalid=${!!groupContext.addElementWarning}
          ></ha-textfield>
          ${groupContext.addElementWarning ? html`<div class="warning-text">${groupContext.addElementWarning}</div>` : ''}
          <div class="form-actions">
               <ha-icon-button
                  class="confirm-button"
                  @click=${groupContext.confirmAddElement}
                  title="Add Element"
                  .disabled=${!groupContext.addElementInput.trim() || !!groupContext.addElementWarning}
               >
                  <ha-icon icon="mdi:check"></ha-icon>
              </ha-icon-button>
              <ha-icon-button
                  class="cancel-button"
                  @click=${groupContext.cancelAddElement}
                  title="Cancel"
              >
                  <ha-icon icon="mdi:close"></ha-icon>
              </ha-icon-button>
          </div>
      </div>
    `;
}

// Main render function for group list
export function renderGroupList(
  groups: string[],
  groupedElements: { [groupId: string]: any[] },
  editorContext: EditorContext,
  groupContext: GroupEditorContext
): TemplateResult {
    // Get sorted list of group IDs to render
    const groupIdsToRender = Object.keys(groupedElements).sort();

    return html`
      <div class="groups-container" style="padding: 16px;">
          <div class="add-group-section" style="margin-bottom: 16px;">
              <ha-button outlined @click=${() => /*groupContext.addGroup()*/ null}>Add New Group</ha-button>
          </div>

          ${groupContext.editingGroup === '__new__' ? renderNewGroupForm(groupContext) : ''}

          ${groupIdsToRender.map(groupId => 
            renderGroup(groupId, groupedElements[groupId], editorContext, groupContext)
          )}

          ${groupedElements['__ungrouped__'] && groupedElements['__ungrouped__'].length > 0
              ? renderGroup('__ungrouped__', groupedElements['__ungrouped__'], editorContext, groupContext)
              : ''}
      </div>
    `;
} 