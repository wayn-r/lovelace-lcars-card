import { html, TemplateResult } from 'lit';
import { EditorElement } from './elements/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext, Type } from './properties/properties.js';
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

  const schema = elementInstance.getSchema(schemaContext);

  const formData = elementInstance.getFormData();
  
  // Filter schema to separate standard fields from custom ones (like grid selector)
  const standardSchema = schema.filter(s => s.type !== 'custom');
  const customSchema = schema.filter(s => s.type === 'custom');

  // Extract properties for specific elements
  const typeSchema = standardSchema.find(s => s.name === 'type');
  const fillSchema = standardSchema.find(s => s.name === 'fill');
  const directionSchema = standardSchema.find(s => s.name === 'direction');
  const orientationSchema = standardSchema.find(s => s.name === 'orientation');
  const sideSchema = standardSchema.find(s => s.name === 'side');
  
  // Text element specific properties
  const textContentSchema = standardSchema.find(s => s.name === 'text');
  const fontFamilySchema = standardSchema.find(s => s.name === 'fontFamily');
  const fontSizeSchema = standardSchema.find(s => s.name === 'fontSize');
  const fontWeightSchema = standardSchema.find(s => s.name === 'fontWeight');
  const letterSpacingSchema = standardSchema.find(s => s.name === 'letterSpacing');
  const textAnchorSchema = standardSchema.find(s => s.name === 'textAnchor');
  const dominantBaselineSchema = standardSchema.find(s => s.name === 'dominantBaseline');
  const textTransformSchema = standardSchema.find(s => s.name === 'textTransform');
  
  // Elbow element specific properties
  const horizontalWidthSchema = standardSchema.find(s => s.name === 'horizontalWidth');
  const verticalWidthSchema = standardSchema.find(s => s.name === 'verticalWidth');
  const headerHeightSchema = standardSchema.find(s => s.name === 'headerHeight');
  const totalElbowHeightSchema = standardSchema.find(s => s.name === 'totalElbowHeight');
  const outerCornerRadiusSchema = standardSchema.find(s => s.name === 'outerCornerRadius');
  
  // Width/Height/Offset properties (shared by many elements)
  const widthSchema = standardSchema.find(s => s.name === 'width');
  const heightSchema = standardSchema.find(s => s.name === 'height');
  const offsetXSchema = standardSchema.find(s => s.name === 'offsetX');
  const offsetYSchema = standardSchema.find(s => s.name === 'offsetY');
  
  // Find all anchor and stretch related schemas (preserve these for the existing logic)
  const anchorToSchema = standardSchema.find(s => s.name === 'anchorTo');
  
  // Extract the first and second stretch schemas
  const primaryStretchSchema = standardSchema.find(s => s.name === 'stretchTo1');
  const secondaryStretchSchema = standardSchema.find(s => s.name === 'stretchTo2');
  
  // Get the right padding schemas, prioritizing the indexed ones first
  const stretchPadding1Schema = standardSchema.find(s => s.name === 'stretchPadding1');
  const stretchPadding2Schema = standardSchema.find(s => s.name === 'stretchPadding2');

  // Find direction/target anchor point schemas
  const targetStretchAnchorPoint1Schema = customSchema.find(s => s.name === 'targetStretchAnchorPoint1' || s.name === 'stretchDirection1');
  const targetStretchAnchorPoint2Schema = customSchema.find(s => s.name === 'targetStretchAnchorPoint2' || s.name === 'stretchDirection2');
  
  // Extract custom grid selectors
  const containerAnchorPointSchema = customSchema.find(s => s.name === 'containerAnchorPoint');
  const anchorPointSchema = customSchema.find(s => s.name === 'anchorPoint');
  const targetAnchorPointSchema = customSchema.find(s => s.name === 'targetAnchorPoint');

  // --- Extract Button Property Schemas ---
  const buttonEnabledSchema = standardSchema.find(s => s.name === 'button.enabled');
  const buttonTextSchema = standardSchema.find(s => s.name === 'button.text');
  const buttonCutoutTextSchema = standardSchema.find(s => s.name === 'button.cutout_text');

  const buttonTextColorSchema = standardSchema.find(s => s.name === 'button.text_color');
  const buttonFontFamilySchema = standardSchema.find(s => s.name === 'button.font_family');
  const buttonFontSizeSchema = standardSchema.find(s => s.name === 'button.font_size');
  const buttonFontWeightSchema = standardSchema.find(s => s.name === 'button.font_weight');
  const buttonLetterSpacingSchema = standardSchema.find(s => s.name === 'button.letter_spacing');
  const buttonTextTransformSchema = standardSchema.find(s => s.name === 'button.text_transform');
  const buttonTextAnchorSchema = standardSchema.find(s => s.name === 'button.text_anchor');
  const buttonDominantBaselineSchema = standardSchema.find(s => s.name === 'button.dominant_baseline');

  const buttonHoverFillSchema = standardSchema.find(s => s.name === 'button.hover_fill');
  const buttonActiveFillSchema = standardSchema.find(s => s.name === 'button.active_fill');

  const buttonHoverTransformSchema = standardSchema.find(s => s.name === 'button.hover_transform');
  const buttonActiveTransformSchema = standardSchema.find(s => s.name === 'button.active_transform');

  const buttonActionTypeSchema = standardSchema.find(s => s.name === 'button.action_config.type');
  const buttonActionServiceSchema = standardSchema.find(s => s.name === 'button.action_config.service');
  const buttonActionServiceDataSchema = standardSchema.find(s => s.name === 'button.action_config.service_data');
  const buttonActionNavPathSchema = standardSchema.find(s => s.name === 'button.action_config.navigation_path');
  const buttonActionUrlPathSchema = standardSchema.find(s => s.name === 'button.action_config.url_path');
  const buttonActionEntitySchema = standardSchema.find(s => s.name === 'button.action_config.entity');
  const buttonActionConfirmSchema = standardSchema.find(s => s.name === 'button.action_config.confirmation');
  
  // Create schema arrays for ha-form based on which properties exist
  const widthHeightSchema = [widthSchema, heightSchema].filter(Boolean);
  const offsetSchema = [offsetXSchema, offsetYSchema].filter(Boolean);
  
  // Use these variables for the existing anchor/stretch logic
  const showAnchorPoints = formData.anchorTo && formData.anchorTo !== '';
  
  // Determine if we need to show stretch target selectors
  const showStretchTarget = formData.stretchTo1 && formData.stretchTo1 !== '';
  const showSecondStretchTarget = formData.stretchTo2 && formData.stretchTo2 !== '';

  // Remove all handled schemas (including new button ones) from filteredStandardSchema
  const filteredStandardSchema = standardSchema.filter(s => 
    !['type', 'fill', 'direction', 'orientation', 'side',
    'width', 'height', 'offsetX', 'offsetY', 
    'text', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 
    'textAnchor', 'dominantBaseline', 'textTransform',
    'horizontalWidth', 'verticalWidth', 'headerHeight', 'totalElbowHeight', 'outerCornerRadius',
    'anchorTo', 'stretchTo1', 'stretchTo2', 'stretchPadding1', 'stretchPadding2',
    'targetStretchAnchorPoint1', 'targetStretchAnchorPoint2', 'stretchDirection1', 'stretchDirection2',
    'button.enabled', 'button.text', 'button.cutout_text',
    'button.text_color', 'button.font_family', 'button.font_size', 'button.font_weight',
    'button.letter_spacing', 'button.text_transform', 'button.text_anchor', 'button.dominant_baseline',
    'button.hover_fill', 'button.active_fill',
    'button.hover_transform', 'button.active_transform',
    'button.action_config.type', 'button.action_config.service', 'button.action_config.service_data',
    'button.action_config.navigation_path', 'button.action_config.url_path', 'button.action_config.entity',
    'button.action_config.confirmation'
    ].includes(s.name)
  );
  
  function renderProp(
    schema: HaFormSchema | undefined,
    sideClass: string
  ): TemplateResult {
    if (!schema) return html``;

    const value = formData[schema.name];

    return html`
      <div class=${sideClass}>
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
               <!-- Property Container with 2-column layout -->
               <div class="property-container">
                  <!-- Type Property (Always show first) -->
                  ${renderFullWidthPropertyForm(context, elementId, formData, typeSchema)}
                  
                  <!-- Properties based on element type -->
                  ${(() => {
                    if (element.type === 'rectangle') {
                      return html`
                        <!-- Fill Color -->
                        ${renderFullWidthPropertyForm(context, elementId, formData, fillSchema)}

                        <!-- Width and Height -->
                        ${renderProp(widthSchema, 'property-left')}
                        ${renderProp(heightSchema, 'property-right')}
                      `;
                    }
                    else if (element.type === 'endcap' || element.type === 'chisel-endcap') {
                      return html`
                        <!-- Fill Color and Direction -->
                        ${renderProp(fillSchema, 'property-left')}
                        ${renderProp(directionSchema, 'property-right')}

                        <!-- Width and Height -->
                        ${renderProp(widthSchema, 'property-left')}
                        ${renderProp(heightSchema, 'property-right')}
                      `;
                    }
                    else if (element.type === 'text') {
                      return html`
                        <!-- Text Content and Fill Color -->
                        ${renderProp(textContentSchema, 'property-left')}
                        ${renderProp(fillSchema, 'property-right')}

                        <!-- Font Family and Font Size -->
                        ${renderProp(fontFamilySchema, 'property-left')}
                        ${renderProp(fontSizeSchema, 'property-right')}

                        <!-- Font Weight and Letter Spacing -->
                        ${renderProp(fontWeightSchema, 'property-left')}
                        ${renderProp(letterSpacingSchema, 'property-right')}

                        <!-- Text Anchor and Dominant Baseline -->
                        ${renderProp(textAnchorSchema, 'property-left')}
                        ${renderProp(dominantBaselineSchema, 'property-right')}

                        <!-- Text Transform -->
                        ${renderProp(textTransformSchema, 'property-left')}
                        <div class="property-right"></div>
                      `;
                    }
                    else if (element.type === 'elbow') {
                      return html`
                        <!-- Fill Color and Orientation -->
                        ${renderProp(fillSchema, 'property-left')}
                        ${renderProp(orientationSchema, 'property-right')}

                        <!-- Side property -->
                        ${renderFullWidthPropertyForm(context, elementId, formData, sideSchema)}

                        <!-- Horizontal Width and Vertical Width -->
                        ${renderProp(horizontalWidthSchema, 'property-left')}
                        ${renderProp(verticalWidthSchema, 'property-right')}

                        <!-- Header Height and Total Height -->
                        ${renderProp(headerHeightSchema, 'property-left')}
                        ${renderProp(totalElbowHeightSchema, 'property-right')}

                        <!-- Outer Corner Radius -->
                        ${renderProp(outerCornerRadiusSchema, 'property-left')}
                        <div class="property-right"></div>
                      `;
                    }
                    else {
                      return html`
                        <!-- Fill Color -->
                        ${renderFullWidthPropertyForm(context, elementId, formData, fillSchema)}

                        <!-- Width and Height -->
                        ${renderProp(widthSchema, 'property-left')}
                        ${renderProp(heightSchema, 'property-right')}
                      `;
                    }
                  })()}
                  
                  <!-- Anchor To Row -->
                  ${renderFullWidthPropertyForm(context, elementId, formData, anchorToSchema)}
                  
                  <!-- Container Anchor Point Selector (show when no specific anchor is selected) -->
                  ${!showAnchorPoints && containerAnchorPointSchema ? html`
                     ${renderCustomSelectorWrapper(containerAnchorPointSchema, formData[containerAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [containerAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }, 'property-full-width')}
                  ` : ''}
                  
                  <!-- Anchor Point Selectors (always show when anchor is selected) -->
                  ${showAnchorPoints && anchorPointSchema && targetAnchorPointSchema ? html`
                     ${renderCustomSelectorWrapper(anchorPointSchema, formData[anchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [anchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }, 'property-left')}
                     ${renderCustomSelectorWrapper(targetAnchorPointSchema, formData[targetAnchorPointSchema.name],
                        (value: string) => {
                          const detail = { value: { ...formData, [targetAnchorPointSchema.name]: value } };
                          const customEvent = new CustomEvent('value-changed', { detail });
                          context.handleFormValueChanged(customEvent, elementId);
                        }, 'property-right')}
                  ` : ''}
                  
                  <!-- Primary Stretch To Row -->
                  ${renderStretchSection(
                    context,
                    elementId,
                    formData,
                    primaryStretchSchema,
                    stretchPadding1Schema,
                    targetStretchAnchorPoint1Schema,
                    showStretchTarget
                  )}

                  <!-- Second Stretch Target Dropdown (only shown if a primary target is selected) -->
                  ${showStretchTarget ? renderStretchSection(
                    context,
                    elementId,
                    formData,
                    secondaryStretchSchema,
                    stretchPadding2Schema,
                    targetStretchAnchorPoint2Schema,
                    showSecondStretchTarget
                  ) : ''}
                  
                  <!-- Offset X and Y Row -->
                  ${offsetSchema.length > 0 ? html`
                    ${renderProp(offsetXSchema, 'property-left')}
                    ${renderProp(offsetYSchema, 'property-right')}
                  ` : ''}
                  
                  <!-- === BUTTON CONFIGURATION SECTION === -->
                  ${renderFullWidthPropertyForm(context, elementId, formData, buttonEnabledSchema)}

                  ${formData['button.enabled'] ? html`
                    <div class="property-full-width section-header" style="font-weight: bold; margin-top: 16px; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;">Button Appearance</div>
                    ${renderProp(buttonTextSchema, 'property-left')}
                    ${renderProp(buttonCutoutTextSchema, 'property-right')}

                    ${renderProp(buttonTextColorSchema, 'property-left')}
                    ${renderProp(buttonFontFamilySchema, 'property-right')}
                    
                    ${renderProp(buttonFontSizeSchema, 'property-left')}
                    ${renderProp(buttonFontWeightSchema, 'property-right')}

                    ${renderProp(buttonLetterSpacingSchema, 'property-left')}
                    ${renderProp(buttonTextTransformSchema, 'property-right')}
                    ${renderProp(buttonTextAnchorSchema, 'property-left')}
                    ${renderProp(buttonDominantBaselineSchema, 'property-right')}


                    <div class="property-full-width section-header" style="font-weight: bold; margin-top: 16px; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;">Button State Styles</div>
                    ${renderProp(buttonHoverFillSchema, 'property-left')}
                    ${renderProp(buttonActiveFillSchema, 'property-right')}
                    
                    ${renderProp(buttonHoverTransformSchema, 'property-left')}
                    ${renderProp(buttonActiveTransformSchema, 'property-right')}

                    <div class="property-full-width section-header" style="font-weight: bold; margin-top: 16px; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;">Button Action</div>
                    ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionTypeSchema)}

                    ${formData['button.action_config.type'] === 'call-service' ? html`
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionServiceSchema)}
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionServiceDataSchema)}
                    ` : ''}
                    ${formData['button.action_config.type'] === 'navigate' ? html`
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionNavPathSchema)}
                    ` : ''}
                    ${formData['button.action_config.type'] === 'url' ? html`
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionUrlPathSchema)}
                    ` : ''}
                    ${formData['button.action_config.type'] === 'toggle' || formData['button.action_config.type'] === 'more-info' ? html`
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionEntitySchema)}
                    ` : ''}
                    ${formData['button.action_config.type'] && formData['button.action_config.type'] !== 'none' ? html`
                      ${renderFullWidthPropertyForm(context, elementId, formData, buttonActionConfirmSchema)}
                    ` : ''}
                  ` : ''}
                  <!-- === END BUTTON CONFIGURATION SECTION === -->


                  ${filteredStandardSchema.length > 0 ? html`
                    <div class="property-full-width" style="margin-top:16px;">
                      <div style="font-weight: bold; border-bottom: 1px solid var(--divider-color); padding-bottom: 4px; margin-bottom: 8px;">Other Properties</div>
                      <ha-form
                        .hass=${context.hass}
                        .data=${formData}
                        .schema=${filteredStandardSchema}
                        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                      ></ha-form>
                    </div>
                  ` : ''}
               </div>
               ${schema.length === 0 ? html`<p>No configurable properties for this element type.</p>` : ''} 
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

function renderCustomSelectorWrapper(
  schema: HaFormSchema | undefined,
  value: string,
  onChange: (value: string) => void,
  sideClass: string
): TemplateResult {
  if (!schema) return html``;

  return html`
    <div class="${sideClass}">
      ${renderCustomSelector(schema, value, onChange)}
    </div>
  `;
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
  
  const value = formData[schema.name];
  
  const refreshKey = `${schema.name}:${value}:${Date.now()}`;
  
  return html`
    <div class="property-full-width">
      <ha-form
        .hass=${context.hass}
        .data=${formData}
        .schema=${[schema]}
        .computeLabel=${(s: HaFormSchema) => s.label || s.name}
        @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
        .key=${refreshKey}
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