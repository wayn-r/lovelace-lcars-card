import { html, TemplateResult } from 'lit';
import { EditorElement } from './elements/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext, Type, PropertyGroup, Layout } from './properties/properties.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
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
  confirmNewGroup: () => void;
  cancelNewGroup: () => void;
  addGroup: () => void;
  
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
  newGroupInput: string;
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
                      ? html`<!-- ID Editing might be problematic without instance, handle carefully or disable -->
                         <span class="element-name">Editing ID: ${baseId || '(no base id)'}</span> 
                         <span class="element-type" style="color: var(--error-color);">(invalid type)</span>
                         <!-- Disable confirm/cancel or show simplified form without instance dependency? -->
                         <!-- For now, let's just show text and rely on cancel -->
                         <span class="spacer"></span>
                         <div class="editing-actions">
                            <ha-icon-button
                                class="cancel-button"
                                @click=${(e: Event) => { 
                                    e.stopPropagation(); 
                                    context.cancelEditElementId(); 
                                }}
                                title="Cancel"
                            >
                                <ha-icon icon="mdi:close"></ha-icon>
                            </ha-icon-button>
                         </div>
                      `
                      : html`
                         <span class="element-name">${baseId || '(no base id)'}</span>
                         <span class="element-type" style="color: var(--error-color);">(invalid type: "${element.type || ''}")</span>
                         <span class="spacer"></span>
                         <!-- Allow editing ID even in error state -->
                         <div class="edit-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.startEditElementId(elementId); }} title="Edit Element ID">
                            <ha-icon icon="mdi:pencil"></ha-icon>
                         </div>
                         <!-- Allow deletion -->
                         <div class="delete-button icon-button" @click=${(e: Event) => { e.stopPropagation(); context.handleDeleteElement(elementId); }} title="Delete Element">
                            <ha-icon icon="mdi:delete"></ha-icon>
                         </div>
                      `
                  }
              </div>

              ${!isCollapsed ? html`
                  <div class="element-body">
                      <div class="property-container">
                          <div class="property-full-width">
                               <p style="color: var(--error-color);">Please select a valid element type:</p>
                               <ha-form
                                 .hass=${context.hass}
                                 .data=${minimalFormData} 
                                 .schema=${[typeSchema]} 
                                 .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                                 @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                               ></ha-form>
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
  
  const renderedPropertyNames = new Set<string>();

  const getSchemaByName = (name: string): HaFormSchema | undefined => allSchemas.find(s => s.name === name);

  // --- Render Type Property (Always First) ---
  const typeSchema = getSchemaByName('type');
  if (typeSchema) {
    renderedPropertyNames.add('type');
  }

  // --- Prepare Anchor Properties (Rendered Conditionally Later) ---
  const anchorToSchema = getSchemaByName('anchorTo');
  const containerAnchorPointSchema = getSchemaByName('containerAnchorPoint'); // This name needs to be consistent with properties.ts
  const anchorPointSchema = getSchemaByName('anchorPoint');
  const targetAnchorPointSchema = getSchemaByName('targetAnchorPoint');

  if (anchorToSchema) renderedPropertyNames.add(anchorToSchema.name);
  if (containerAnchorPointSchema) renderedPropertyNames.add(containerAnchorPointSchema.name);
  if (anchorPointSchema) renderedPropertyNames.add(anchorPointSchema.name);
  if (targetAnchorPointSchema) renderedPropertyNames.add(targetAnchorPointSchema.name);
  
  // --- Prepare Stretch Properties (Rendered Conditionally Later) ---
  const primaryStretchSchema = getSchemaByName('stretchTo1');
  const stretchPadding1Schema = getSchemaByName('stretchPadding1');
  const targetStretchAnchorPoint1Schema = getSchemaByName('stretchDirection1'); // Or targetStretchAnchorPoint1

  const secondaryStretchSchema = getSchemaByName('stretchTo2');
  const stretchPadding2Schema = getSchemaByName('stretchPadding2');
  const targetStretchAnchorPoint2Schema = getSchemaByName('stretchDirection2'); // Or targetStretchAnchorPoint2

  if (primaryStretchSchema) renderedPropertyNames.add(primaryStretchSchema.name);
  if (stretchPadding1Schema) renderedPropertyNames.add(stretchPadding1Schema.name);
  if (targetStretchAnchorPoint1Schema) renderedPropertyNames.add(targetStretchAnchorPoint1Schema.name);
  if (secondaryStretchSchema) renderedPropertyNames.add(secondaryStretchSchema.name);
  if (stretchPadding2Schema) renderedPropertyNames.add(stretchPadding2Schema.name);
  if (targetStretchAnchorPoint2Schema) renderedPropertyNames.add(targetStretchAnchorPoint2Schema.name);

  // --- Prepare Button Properties (Rendered Conditionally Later) ---
  const buttonEnabledSchema = getSchemaByName('button.enabled');
  if (buttonEnabledSchema) renderedPropertyNames.add(buttonEnabledSchema.name);

  const showAnchorPoints = formData.anchorTo && formData.anchorTo !== '';
  const showStretchTarget = formData.stretchTo1 && formData.stretchTo1 !== '';
  const showSecondStretchTarget = formData.stretchTo2 && formData.stretchTo2 !== '';
  
  // Note: The renderProp function has been replaced by renderHalfWidthPropertyForm for more consistent rendering
  
  const renderStandardPropertyGroups = () => {
    const groupOrder = [
        PropertyGroup.APPEARANCE,
        PropertyGroup.DIMENSIONS,
        PropertyGroup.TEXT, // For general text properties, not button text
        PropertyGroup.POSITIONING,
    ];
    
    let propertiesToRender: {schema: HaFormSchema, layout: Layout}[] = [];

    for (const schema of allSchemas) {
        if (renderedPropertyNames.has(schema.name)) continue;
        const propMeta = propertiesMap.get(schema.name);
        if (propMeta && groupOrder.includes(propMeta.propertyGroup)) {
            propertiesToRender.push({schema, layout: propMeta.layout});
        }
    }
    
    // Sort by group order, then by original schema order (implicit)
    propertiesToRender.sort((a, b) => {
        const groupA = propertiesMap.get(a.schema.name)?.propertyGroup;
        const groupB = propertiesMap.get(b.schema.name)?.propertyGroup;
        if (groupA && groupB) {
            const indexA = groupOrder.indexOf(groupA);
            const indexB = groupOrder.indexOf(groupB);
            if (indexA !== indexB) return indexA - indexB;
        }
        return 0; 
    });

    // Create pairs of properties for half-width rendering
    let pairs: TemplateResult[] = [];
    let fullWidthItems: TemplateResult[] = [];
    let halfWidthBuffer: {schema: HaFormSchema, layout: Layout} | null = null;

    for (const item of propertiesToRender) {
        const { schema, layout } = item;
        if (renderedPropertyNames.has(schema.name)) continue; // Double check

        renderedPropertyNames.add(schema.name);

        console.log(`Property ${schema.name} - layout: ${layout}, Layout.FULL: ${Layout.FULL}, Layout.HALF: ${Layout.HALF}, isEqual: ${layout === Layout.HALF}`);

        if (layout === Layout.FULL) {
            if (halfWidthBuffer) { // Render pending half-width if any
                // Create a pair with an empty right side
                pairs.push(html`
                    ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
                    <div class="property-right"></div>
                `);
                halfWidthBuffer = null;
            }
            fullWidthItems.push(renderFullWidthPropertyForm(context, elementId, formData, schema));
        } else if (layout === Layout.HALF || layout === Layout.HALF_LEFT || layout === Layout.HALF_RIGHT) {
            if (!halfWidthBuffer) {
                halfWidthBuffer = item;
            } else {
                // We have a pair - create a row with both properties
                pairs.push(html`
                    ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
                    ${renderHalfWidthPropertyForm(context, elementId, formData, schema, 'property-right')}
                `);
                halfWidthBuffer = null;
            }
        }
    }
    
    // Handle any remaining half-width property
    if (halfWidthBuffer) {
        pairs.push(html`
            ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer.schema, 'property-left')}
            <div class="property-right"></div>
        `);
    }
    
    // Combine all items
    return html`
        ${fullWidthItems}
        ${pairs}
    `;
  };


  const renderButtonProperties = () => {
    if (!formData['button.enabled']) return html``;

    const buttonProperties = allSchemas.filter(s => {
        const propMeta = propertiesMap.get(s.name);
        return propMeta?.propertyGroup === PropertyGroup.BUTTON && s.name !== 'button.enabled' && !renderedPropertyNames.has(s.name);
    });

    // Define sub-sections for buttons
    const appearancePropsNames = ['button.text', 'button.cutout_text', 'button.text_color', 'button.font_family', 'button.font_size', 'button.font_weight', 'button.letter_spacing', 'button.text_transform', 'button.text_anchor', 'button.dominant_baseline', 'elbow_text_position'];
    const stateStylePropsNames = ['button.hover_fill', 'button.active_fill', 'button.hover_transform', 'button.active_transform'];
    const actionPropsNames = ['button.action_config.type', 'button.action_config.service', 'button.action_config.service_data', 'button.action_config.navigation_path', 'button.action_config.url_path', 'button.action_config.entity', 'button.action_config.confirmation'];

    const renderSubGroup = (title: string, propNames: string[]) => {
        // Create pairs of properties for half-width rendering
        let pairs: TemplateResult[] = [];
        let fullWidthItems: TemplateResult[] = [];
        let halfWidthBuffer: HaFormSchema | null = null;
        
        const relevantProps = buttonProperties.filter(s => propNames.includes(s.name));

        for (const schema of relevantProps) {
            if (renderedPropertyNames.has(schema.name)) continue;
            
            // Conditional rendering for action_config
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

            renderedPropertyNames.add(schema.name);
            const propMeta = propertiesMap.get(schema.name);

            if (propMeta?.layout === Layout.FULL) {
                if (halfWidthBuffer) {
                    // Create a pair with an empty right side
                    pairs.push(html`
                        ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                        <div class="property-right"></div>
                    `);
                    halfWidthBuffer = null;
                }
                fullWidthItems.push(renderFullWidthPropertyForm(context, elementId, formData, schema));
            } else if (propMeta?.layout === Layout.HALF || propMeta?.layout === Layout.HALF_LEFT || propMeta?.layout === Layout.HALF_RIGHT) {
                if (!halfWidthBuffer) {
                    halfWidthBuffer = schema;
                } else {
                    // We have a pair - create a row with both properties
                    pairs.push(html`
                        ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                        ${renderHalfWidthPropertyForm(context, elementId, formData, schema, 'property-right')}
                    `);
                    halfWidthBuffer = null;
                }
            }
        }
        
        // Handle any remaining half-width property
        if (halfWidthBuffer) {
            pairs.push(html`
                ${renderHalfWidthPropertyForm(context, elementId, formData, halfWidthBuffer, 'property-left')}
                <div class="property-right"></div>
            `);
        }
        
        if (fullWidthItems.length > 0 || pairs.length > 0) {
            return html`
                <div class="property-full-width section-header" style="font-weight: bold; margin-top: 16px; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;">${title}</div>
                ${fullWidthItems}
                ${pairs}
            `;
        }
        return html``;
    };

    const appearanceSection = renderSubGroup('Button Appearance', appearancePropsNames);
    const styleSection = renderSubGroup('Button State Styles', stateStylePropsNames);
    const actionSection = renderSubGroup('Button Action', actionPropsNames);
    
    return html`${appearanceSection}${styleSection}${actionSection}`;
  };

  const renderOtherProperties = () => {
    const otherPropsSchemas = allSchemas.filter(s => !renderedPropertyNames.has(s.name));
    if (otherPropsSchemas.length > 0) {
        return html`
            <div class="property-full-width" style="margin-top:16px;">
                <div style="font-weight: bold; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px; margin-bottom: 8px;">Other Properties</div>
                <ha-form
                    .hass=${context.hass}
                    .data=${formData}
                    .schema=${otherPropsSchemas}
                    .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                    @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                ></ha-form>
            </div>
        `;
    }
    return html``;
  };


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
               <div class="property-container">
                  <!-- Type Property (Always show first) -->
                  ${typeSchema ? renderFullWidthPropertyForm(context, elementId, formData, typeSchema) : ''}
                  
                  <!-- Standard Property Groups -->
                  ${renderStandardPropertyGroups()}
                  
                  <!-- Anchor To Row -->
                  ${anchorToSchema ? renderFullWidthPropertyForm(context, elementId, formData, anchorToSchema) : ''}
                  
                  <!-- Container Anchor Point Selector (show when no specific anchor is selected) -->
                  ${!showAnchorPoints && containerAnchorPointSchema ? html`
                    <div class="property-full-width">
                      ${renderCustomSelector(containerAnchorPointSchema, formData[containerAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [containerAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                  ` : ''}
                  
                  <!-- Anchor Point Selectors (always show when anchor is selected) -->
                  ${showAnchorPoints && anchorPointSchema && targetAnchorPointSchema ? html`
                    <div class="property-left">
                      ${renderCustomSelector(anchorPointSchema, formData[anchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [anchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                    <div class="property-right">
                      ${renderCustomSelector(targetAnchorPointSchema, formData[targetAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [targetAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }
                      )}
                    </div>
                  ` : ''}
                  
                  <!-- Primary Stretch To Row -->
                  ${primaryStretchSchema ? renderStretchSection(
                    context,
                    elementId,
                    formData,
                    primaryStretchSchema,
                    stretchPadding1Schema,
                    targetStretchAnchorPoint1Schema, // This is StretchDirection schema
                    showStretchTarget
                  ) : ''}

                  <!-- Second Stretch Target Dropdown (only shown if a primary target is selected) -->
                  ${showStretchTarget && secondaryStretchSchema ? renderStretchSection(
                    context,
                    elementId,
                    formData,
                    secondaryStretchSchema,
                    stretchPadding2Schema,
                    targetStretchAnchorPoint2Schema, // This is StretchDirection schema
                    showSecondStretchTarget
                  ) : ''}
                  
                  <!-- === BUTTON CONFIGURATION SECTION === -->
                  ${buttonEnabledSchema ? renderFullWidthPropertyForm(context, elementId, formData, buttonEnabledSchema) : ''}
                  ${renderButtonProperties()}
                  <!-- === END BUTTON CONFIGURATION SECTION === -->

                  <!-- Other Unrendered Properties -->
                  ${renderOtherProperties()}
                  
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
  if (schema.selector.lcars_grid) {
    
    return html`
      <lcars-grid-selector
        .label=${schema.label || schema.name}
        .value=${value || ''}
        ?labelCenter=${schema.selector.lcars_grid.labelCenter}
        ?disableCorners=${schema.selector.lcars_grid.disableCorners}
        ?disableCenter=${schema.selector.lcars_grid.disableCenter}
        ?onlyCardinalDirections=${schema.selector.lcars_grid.onlyCardinalDirections}
        ?stretchMode=${schema.selector.lcars_grid.stretchMode}
        ?clearable=${schema.selector.lcars_grid.clearable}
        ?required=${schema.selector.lcars_grid.required}
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
  sideClass: "property-left" | "property-right"
): TemplateResult {
  if (!schema) return html``;
  
  return html`
    <div class="${sideClass}">
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

function renderStretchSection(
  context: EditorContext,
  elementId: string,
  formData: any,
  stretchToSchema: HaFormSchema | undefined,
  stretchPaddingSchema: HaFormSchema | undefined,
  targetAnchorPointSchema: HaFormSchema | undefined,
  showTarget: boolean
): TemplateResult {
  if (!stretchToSchema) return html``;

  const targetKey = targetAnchorPointSchema?.name;
  const targetValue = targetKey ? formData[targetKey] : '';
  const paddingValue = stretchPaddingSchema ? formData[stretchPaddingSchema.name] : '';
  const stretchToValue = formData[stretchToSchema.name];

  if (!showTarget) {
    return renderFullWidthPropertyForm(context, elementId, formData, stretchToSchema);
  } else {
    return html`
      <div class="property-left stretch-column-left">
        <!-- Stretch To Dropdown -->
        <ha-form
          .hass=${context.hass}
          .data=${formData}
          .schema=${[stretchToSchema]} /* Pass schema as array */
          .computeLabel=${(s: HaFormSchema) => s.label || s.name}
          @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
        ></ha-form>

        <!-- Stretch Padding Input -->
        ${stretchPaddingSchema ? html`
          <ha-form
            .hass=${context.hass}
            .data=${formData}
            .schema=${[stretchPaddingSchema]} /* Pass schema as array */
            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
          ></ha-form>
        ` : ''}
      </div>

      <div class="property-right stretch-column-right">
        <!-- Direction Selector Grid -->
        ${targetAnchorPointSchema ? html`
          ${renderCustomSelector(targetAnchorPointSchema, targetValue,
            (value: string) => {
              if (targetKey) {
                const detail = { value: { ...formData, [targetKey]: value } };
                const customEvent = new CustomEvent('value-changed', { detail });
                context.handleFormValueChanged(customEvent, elementId);
              }
            }
          )}
        ` : ''}
      </div>
    `;
  }
}