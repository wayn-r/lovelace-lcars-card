import { html, TemplateResult } from 'lit';
import { LcarsElementBase } from './properties/element.js';
import { LcarsGroup } from './group.js';
import { HaFormSchema, PropertySchemaContext, Type } from './properties/properties.js';
import { repeat } from 'lit/directives/repeat.js';

// Types
interface EditorContext {
  hass: any;
  cardConfig: any;
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
  newGroupInput: string;
}

// Function to render a single element
export function renderElement(
  element: any, 
  context: EditorContext
): TemplateResult {
  if (!element || !element.id) return html``; 

  const elementId = element.id;
  const elementInstance = context.getElementInstance(elementId);
  
  // Declare variables needed in both paths *before* the check
  const isCollapsed = context.collapsedElements[elementId];
  const isEditingId = context.editingElementId === elementId;
  const baseId = elementId.substring(elementId.indexOf('.') + 1);
  const isDragging = context.draggedElementId === elementId;
  const isDragOver = context.dragOverElementId === elementId;

  // --- Handle case where element instance couldn't be created (invalid type) ---
  if (!elementInstance) {
      // Get schema for Type selector independently
      const typeProperty = new Type();
      const typeSchema = typeProperty.getSchema();
      // Prepare minimal form data just for the type selector
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
                                    context.cancelEditElementId(); // Cancel on editor
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

  // --- Original rendering logic for valid element instances ---
  // These variables are only needed if elementInstance is valid
  const otherElementIds = Array.isArray(context.cardConfig?.elements) 
      ? context.cardConfig.elements
          .filter((el: any) => el.id && el.id !== elementId)  // Exclude the current element
          .map((el: any) => ({ value: el.id, label: el.id }))
      : [];
  
  const schemaContext: PropertySchemaContext = { otherElementIds };

  // Get the unified schema dynamically
  const schema = elementInstance.getSchema(schemaContext);

  // Prepare data for the form using the new helper method
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
  
  // Find all stretch schemas - we may have multiple due to the second stretch option
  const stretchToSchemas = standardSchema.filter(s => s.name === 'stretchTo');
  const primaryStretchSchema = stretchToSchemas[0];
  const secondaryStretchSchema = standardSchema.find(s => s.name === 'stretchTo2');
  
  const stretchPaddingXSchema = standardSchema.find(s => s.name === 'stretchPaddingX');
  
  // Remove all handled schemas from the standardSchema to avoid duplication
  const filteredStandardSchema = standardSchema.filter(s => 
    !['type', 'fill', 'direction', 'orientation', 'side',
    'width', 'height', 'offsetX', 'offsetY', 
    'text', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 
    'textAnchor', 'dominantBaseline', 'textTransform',
    'horizontalWidth', 'verticalWidth', 'headerHeight', 'totalElbowHeight', 'outerCornerRadius',
    'anchorTo', 'stretchTo', 'stretchTo2', 'stretchPaddingX', 'stretchPaddingY'].includes(s.name)
  );
  
  // Extract custom grid selectors
  const containerAnchorPointSchema = customSchema.find(s => s.name === 'containerAnchorPoint');
  const anchorPointSchema = customSchema.find(s => s.name === 'anchorPoint');
  const targetAnchorPointSchema = customSchema.find(s => s.name === 'targetAnchorPoint');
  const targetStretchAnchorPointSchema = customSchema.find(s => s.name === 'targetStretchAnchorPoint');
  const targetStretchAnchorPoint2Schema = customSchema.find(s => s.name === 'targetStretchAnchorPoint2');
  
  // Create schema arrays for ha-form based on which properties exist
  const widthHeightSchema = [widthSchema, heightSchema].filter(Boolean);
  const offsetSchema = [offsetXSchema, offsetYSchema].filter(Boolean);
  
  // Use these variables for the existing anchor/stretch logic
  const anchorSchema = [anchorToSchema].filter(Boolean);
  const stretchSchema = [primaryStretchSchema].filter(Boolean);
  const secondStretchSchema = secondaryStretchSchema ? [secondaryStretchSchema] : [];
  const stretchPaddingSchema = [stretchPaddingXSchema].filter(Boolean);
  
  // Determine if we need to show anchor point selectors
  const showAnchorPoints = formData.anchorTo && formData.anchorTo !== '';
  
  // Determine if we need to show stretch target selector
  const showStretchTarget = formData.stretchTo && formData.stretchTo !== '';
  const showSecondStretchTarget = formData.stretchTo2 && formData.stretchTo2 !== '';

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
                  ${typeSchema ? html`
                     <div class="property-full-width">
                       <ha-form
                         .hass=${context.hass}
                         .data=${formData} 
                         .schema=${[typeSchema]} 
                         .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                         @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                       ></ha-form>
                     </div>
                  ` : ''}
                  
                  <!-- Properties based on element type -->
                  ${(() => {
                    // Layout for rectangle elements
                    if (element.type === 'rectangle') {
                      return html`
                        <!-- Fill Color -->
                        ${fillSchema ? html`
                          <div class="property-full-width">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fillSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                        
                        <!-- Width and Height -->
                        ${widthHeightSchema.length > 0 ? html`
                          <div class="property-left">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[widthSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                          <div class="property-right">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[heightSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                      `;
                    }
                    // Layout for endcap elements (both endcap and chisel-endcap)
                    else if (element.type === 'endcap' || element.type === 'chisel-endcap') {
                      return html`
                        <!-- Fill Color and Direction -->
                        <div class="property-left">
                          ${fillSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fillSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${directionSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[directionSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Width and Height -->
                        ${widthHeightSchema.length > 0 ? html`
                          <div class="property-left">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[widthSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                          <div class="property-right">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[heightSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                      `;
                    }
                    // Layout for text elements
                    else if (element.type === 'text') {
                      return html`
                        <!-- Text Content and Fill Color -->
                        <div class="property-left">
                          ${textContentSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[textContentSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${fillSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fillSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Font Family and Font Size -->
                        <div class="property-left">
                          ${fontFamilySchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fontFamilySchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${fontSizeSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fontSizeSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Font Weight and Letter Spacing -->
                        <div class="property-left">
                          ${fontWeightSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fontWeightSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${letterSpacingSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[letterSpacingSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Text Anchor and Dominant Baseline -->
                        <div class="property-left">
                          ${textAnchorSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[textAnchorSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${dominantBaselineSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[dominantBaselineSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Text Transform -->
                        <div class="property-left">
                          ${textTransformSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[textTransformSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right"></div>
                      `;
                    }
                    // Layout for elbow elements
                    else if (element.type === 'elbow') {
                      return html`
                        <!-- Fill Color and Orientation -->
                        <div class="property-left">
                          ${fillSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fillSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${orientationSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[orientationSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Side property -->
                        ${sideSchema ? html`
                          <div class="property-full-width">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[sideSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                        
                        <!-- Horizontal Width and Vertical Width -->
                        <div class="property-left">
                          ${horizontalWidthSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[horizontalWidthSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${verticalWidthSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[verticalWidthSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Header Height and Total Height -->
                        <div class="property-left">
                          ${headerHeightSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[headerHeightSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right">
                          ${totalElbowHeightSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[totalElbowHeightSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Outer Corner Radius -->
                        <div class="property-left">
                          ${outerCornerRadiusSchema ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[outerCornerRadiusSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        <div class="property-right"></div>
                      `;
                    }
                    // Default case for any other element types
                    else {
                      return html`
                        <!-- Fill Color -->
                        ${fillSchema ? html`
                          <div class="property-full-width">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[fillSchema]} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                        
                        <!-- Width and Height -->
                        ${widthHeightSchema.length > 0 ? html`
                          <div class="property-left">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[widthSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                          <div class="property-right">
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${[heightSchema].filter(Boolean)} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          </div>
                        ` : ''}
                      `;
                    }
                  })()}
                  
                  <!-- Anchor To Row -->
                  ${anchorSchema.length > 0 ? html`
                     <div class="property-full-width">
                       <ha-form
                         .hass=${context.hass}
                         .data=${formData} 
                         .schema=${anchorSchema} 
                         .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                         @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                       ></ha-form>
                     </div>
                  ` : ''}
                  
                  <!-- Container Anchor Point Selector (show when no specific anchor is selected) -->
                  ${!showAnchorPoints && containerAnchorPointSchema ? html`
                     <div class="property-full-width">
                       ${renderCustomSelector(containerAnchorPointSchema, formData[containerAnchorPointSchema.name], 
                          (value: string) => {
                            const detail = { value: { ...formData, [containerAnchorPointSchema.name]: value } };
                            const customEvent = new CustomEvent('value-changed', { detail });
                            context.handleFormValueChanged(customEvent, elementId);
                          })}
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
                          })}
                     </div>
                     <div class="property-right">
                       ${renderCustomSelector(targetAnchorPointSchema, formData[targetAnchorPointSchema.name], 
                          (value: string) => {
                            const detail = { value: { ...formData, [targetAnchorPointSchema.name]: value } };
                            const customEvent = new CustomEvent('value-changed', { detail });
                            context.handleFormValueChanged(customEvent, elementId);
                          })}
                     </div>
                  ` : ''}
                  
                  <!-- Primary Stretch To Row - Single row when no stretch target, otherwise multi-row layout -->
                  ${stretchSchema.length > 0 ? html`
                     ${!showStretchTarget ? html`
                        <!-- No stretch target selected: single row full-width -->
                        <div class="property-full-width">
                          <ha-form
                            .hass=${context.hass}
                            .data=${formData} 
                            .schema=${stretchSchema} 
                            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                          ></ha-form>
                        </div>
                     ` : html`
                        <!-- Stretch target selected: two columns -->
                        <div class="property-left">
                          <!-- First column, first row: Stretch To -->
                          <ha-form
                            .hass=${context.hass}
                            .data=${formData} 
                            .schema=${stretchSchema} 
                            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                          ></ha-form>
                          
                          <!-- First column, second row: Stretch Gap -->
                          ${stretchPaddingSchema.length > 0 ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${stretchPaddingSchema} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Second column: Target Side grid -->
                        <div class="property-right">
                          ${targetStretchAnchorPointSchema ? html`
                            ${renderCustomSelector(targetStretchAnchorPointSchema, formData[targetStretchAnchorPointSchema.name], 
                              (value: string) => {
                                const detail = { value: { ...formData, [targetStretchAnchorPointSchema.name]: value } };
                                const customEvent = new CustomEvent('value-changed', { detail });
                                context.handleFormValueChanged(customEvent, elementId);
                              })}
                          ` : ''}
                        </div>
                     `}
                  ` : ''}
                  
                  <!-- Second Stretch Target Dropdown (only shown if primary is selected) -->
                  ${showStretchTarget && secondStretchSchema ? html`
                     ${!showSecondStretchTarget ? html`
                        <!-- No second stretch target selected: single row full-width -->
                        <div class="property-full-width">
                          <ha-form
                            .hass=${context.hass}
                            .data=${formData} 
                            .schema=${secondStretchSchema} 
                            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                          ></ha-form>
                        </div>
                     ` : html`
                        <!-- Second stretch target selected: two columns -->
                        <div class="property-left">
                          <!-- First column, first row: Second Stretch To -->
                          <ha-form
                            .hass=${context.hass}
                            .data=${formData} 
                            .schema=${secondStretchSchema} 
                            .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                            @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                          ></ha-form>
                          
                          <!-- First column, second row: Stretch Gap for second stretch -->
                          ${stretchPaddingSchema.length > 0 ? html`
                            <ha-form
                              .hass=${context.hass}
                              .data=${formData} 
                              .schema=${stretchPaddingSchema} 
                              .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                              @value-changed=${(ev: CustomEvent) => {
                                // For the second stretch, we also need to update stretchPaddingY
                                const newValue = ev.detail.value.stretchPaddingX;
                                const detail = { 
                                  value: { 
                                    ...formData, 
                                    stretchPaddingX: newValue,
                                    stretchPaddingY: newValue 
                                  } 
                                };
                                const customEvent = new CustomEvent('value-changed', { detail });
                                context.handleFormValueChanged(customEvent, elementId);
                              }}
                            ></ha-form>
                          ` : ''}
                        </div>
                        
                        <!-- Second column: Second Target Side grid -->
                        <div class="property-right">
                          ${targetStretchAnchorPoint2Schema ? html`
                            ${renderCustomSelector(targetStretchAnchorPoint2Schema, formData[targetStretchAnchorPoint2Schema.name], 
                              (value: string) => {
                                const detail = { value: { ...formData, [targetStretchAnchorPoint2Schema.name]: value } };
                                const customEvent = new CustomEvent('value-changed', { detail });
                                context.handleFormValueChanged(customEvent, elementId);
                              })}
                          ` : ''}
                        </div>
                     `}
                  ` : ''}
                  
                  <!-- Offset X and Y Row -->
                  ${offsetSchema.length > 0 ? html`
                     <div class="property-left">
                       <ha-form
                         .hass=${context.hass}
                         .data=${formData} 
                         .schema=${[offsetXSchema].filter(Boolean)} 
                         .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                         @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                       ></ha-form>
                     </div>
                     <div class="property-right">
                       <ha-form
                         .hass=${context.hass}
                         .data=${formData} 
                         .schema=${[offsetYSchema].filter(Boolean)} 
                         .computeLabel=${(s: HaFormSchema) => s.label || s.name}
                         @value-changed=${(ev: CustomEvent) => context.handleFormValueChanged(ev, elementId)}
                       ></ha-form>
                     </div>
                  ` : ''}
                  
                  <!-- Remaining properties -->
                  ${filteredStandardSchema.length > 0 ? html`
                     <div class="property-full-width">
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

// Helper function to render custom selectors like grid selectors
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
        @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}
      ></lcars-grid-selector>
    `;
  }
  return html``; // Handle other custom types if needed
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
      <div class="editing-actions">
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
      </div>
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

// Renders the form for adding a new group
export function renderNewGroupForm(groupContext: GroupEditorContext): TemplateResult {
    const currentInput = groupContext.newGroupInput;
    const warningMessage = groupContext.groupIdWarning;

    return html`
      <div class="group-editor new-group">
          <div class="group-header editing">
              <ha-icon icon="mdi:chevron-down"></ha-icon>
              <div class="group-name-input">
                  <ha-textfield
                      label="New Group Name"
                      .value=${currentInput}
                      @input=${(e: Event) => {
                          const newValue = (e.target as HTMLInputElement).value;
                          groupContext.updateGroupNameInput(newValue);
                      }}
                      @keydown=${(e: KeyboardEvent) => { 
                          if (e.key === 'Enter') { 
                              e.stopPropagation(); 
                              groupContext.handleConfirmEditGroup('__new__'); 
                          } 
                      }}
                      autofocus
                      .invalid=${!!warningMessage}
                  ></ha-textfield>
                  ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
              </div>
              <div class="editing-actions">
                  <ha-icon-button
                      class="confirm-button"
                      @click=${(e: Event) => { 
                          e.stopPropagation(); 
                          groupContext.handleConfirmEditGroup('__new__');
                      }}
                      title="Create Group"
                      .disabled=${!currentInput.trim() || !!warningMessage}
                  >
                      <ha-icon icon="mdi:check"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                      class="cancel-button"
                      @click=${(e: Event) => { 
                          e.stopPropagation(); 
                          groupContext.cancelEditGroup(); 
                      }}
                      title="Cancel"
                  >
                      <ha-icon icon="mdi:close"></ha-icon>
                  </ha-icon-button>
              </div>
          </div>
      </div>
    `;
}

// Renders the input fields when editing a group name
export function renderGroupEditForm(
  groupId: string,
  groupContext: GroupEditorContext
): TemplateResult {
    // Get current input value from editor state
    const currentInput = groupContext.editingGroupInput;
    const warningMessage = groupContext.groupIdWarning;
    const groupInstance = groupContext.groupInstances.get(groupId);
    // Simple validation - name is not empty and no warning message
    const isValid = !!currentInput.trim() && !warningMessage;

    return html`
      <div class="group-name-input">
          <ha-textfield
              label="Edit Group Name"
              .value=${currentInput}
              @input=${(e: Event) => {
                  const newValue = (e.target as HTMLInputElement).value;
                  if (groupInstance) {
                      groupInstance.updateNameInput(newValue);
                  }
                  groupContext.updateGroupNameInput(newValue);
              }}
              @keydown=${(e: KeyboardEvent) => { 
                  if (e.key === 'Enter') { 
                      e.stopPropagation(); 
                      groupContext.handleConfirmEditGroup(groupId); 
                  } 
              }}
              autofocus
              .invalid=${!!warningMessage}
          ></ha-textfield>
          ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
      </div>
      <div class="editing-actions">
          <ha-icon-button
              class="confirm-button"
              @click=${(e: Event) => { 
                  e.stopPropagation(); 
                  groupContext.handleConfirmEditGroup(groupId); 
              }}
              title="Rename Group"
              .disabled=${!currentInput.trim() || !isValid || !!warningMessage}
          >
              <ha-icon icon="mdi:check"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
              class="cancel-button"
              @click=${(e: Event) => { 
                  e.stopPropagation(); 
                  groupContext.cancelEditGroup(); 
              }}
              title="Cancel"
          >
              <ha-icon icon="mdi:close"></ha-icon>
          </ha-icon-button>
      </div>
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
    const groupId = groupContext.addElementDraftGroup;
    if (!groupId) return html``;
    
    const currentInput = groupContext.addElementInput;
    const warningMessage = groupContext.addElementWarning;
    
    return html`
        <div class="add-element-form">
            <div class="element-name-input">
                <ha-textfield
                    label="New Element ID"
                    .value=${currentInput}
                    @input=${(e: Event) => {
                        const newValue = (e.target as HTMLInputElement).value;
                        groupContext.updateNewElementInput(newValue);
                    }}
                    @keydown=${(e: KeyboardEvent) => { 
                        if (e.key === 'Enter') { 
                            e.stopPropagation(); 
                            groupContext.confirmAddElement(); 
                        } 
                    }}
                    autofocus
                    .invalid=${!!warningMessage}
                ></ha-textfield>
                ${warningMessage ? html`<div class="warning-text">${warningMessage}</div>` : ''}
            </div>
            <div class="editing-actions">
                <ha-icon-button
                    class="confirm-button"
                    @click=${() => groupContext.confirmAddElement()}
                    title="Add Element"
                    .disabled=${!currentInput.trim()}
                >
                    <ha-icon icon="mdi:check"></ha-icon>
                </ha-icon-button>
                <ha-icon-button
                    class="cancel-button"
                    @click=${() => groupContext.cancelAddElement()}
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