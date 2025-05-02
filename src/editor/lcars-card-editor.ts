import { LitElement, html, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';
import { repeat } from 'lit/directives/repeat.js';

// Import modular components
import { editorStyles } from './editor-styles.js';
import { 
  renderElement, 
  renderGroup, 
  renderGroupList, 
  renderNewGroupForm
} from './renderer.js';

// Import the custom grid selector
import './grid-selector.js';
// Import the new element structure
import { createElementInstance, LcarsElementBase, RectangleElement } from './properties/element.js';
import { HaFormSchema, LcarsPropertyBase, PropertySchemaContext } from './properties/properties.js';
import { LcarsGroup } from './group.js';

// Helper function to set deep properties
function setDeep(obj: any, path: string | string[], value: any): void {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {};
        }
        current = current[key];
    }
    if (current && typeof current === 'object') {
       current[pathArray[pathArray.length - 1]] = value;
    } else {
        console.error("Error in setDeep: final path segment is not an object", obj, path, value);
    }
}
// Helper function to delete deep properties
function unsetDeep(obj: any, path: string | string[]): boolean {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
            return false;
        }
        current = current[key];
    }
    const finalKey = pathArray[pathArray.length - 1];
    if (current && typeof current === 'object' && finalKey in current) {
        delete current[finalKey];
        return true;
    }
    return false;
}

@customElement('lcars-card-editor')
export class LcarsCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: LcarsCardConfig;
  @state() private _selectedTabIndex: number = 0;

  // --- State for Group/Element Management ---
  @state() private _groups: string[] = [];
  @state() private _groupInstances: Map<string, LcarsGroup> = new Map();
  @state() private _collapsedGroups: { [groupId: string]: boolean } = {};
  @state() private _newGroupDraft: string | null = null;
  @state() private _newGroupInput: string = '';
  @state() private _editingGroup: string | null = null;
  @state() private _editingGroupInput: string = '';
  @state() private _deleteWarningGroup: string | null = null;
  @state() private _groupIdWarning: string = '';

  @state() private _collapsedElements: { [elementId: string]: boolean } = {}; // Use element ID as key
  @state() private _editingElementId: string | null = null; // Store full element ID (group.base)
  @state() private _editingElementIdInput: string = ''; // Stores only the base part
  @state() private _elementIdWarning: string = '';
  @state() private _addElementDraftGroup: string | null = null;
  @state() private _addElementInput: string = '';
  @state() private _addElementWarning: string = '';

  // --- Drag and Drop State ---
  private _draggedElementId: string | null = null;
  private _dragOverElementId: string | null = null;
  private _dragOverGroup: string | null = null; // Track group for potential cross-group drop (not implemented yet)

  public setConfig(config: LcarsCardConfig): void {
    const prevConfig = this._config;
    this._config = {
        ...config,
        elements: config.elements || []
    };
    // Always re-extract/update instances when config changes
    this._extractGroupsAndInitState(prevConfig?.elements);
  }

  private _extractGroupsAndInitState(prevElements?: any[]): void {
    if (!this._config?.elements) {
        this._groups = [];
        this._groupInstances.clear();
        this._collapsedGroups = {};
        this._collapsedElements = {};
        return;
    }

    const currentElements = this._config.elements;
    const currentGroupIds = new Set<string>();
    const currentElementMap = new Map<string, any>();

    currentElements.forEach(el => {
        if (el?.id) {
            currentElementMap.set(el.id, el);
            const groupId = el.id.split('.')[0];
            if (groupId) {
                currentGroupIds.add(groupId);
            }
        }
    });

    const newGroups = Array.from(currentGroupIds).sort();
    const newGroupInstances = new Map<string, LcarsGroup>();
    const newCollapsedGroups: { [groupId: string]: boolean } = {};
    const newCollapsedElements: { [elementId: string]: boolean } = {};

    // Create/update group instances
    newGroups.forEach(gid => {
        let instance = this._groupInstances.get(gid); // Try to reuse existing instance
        if (!instance) {
            instance = new LcarsGroup(gid);
        } else {
             // If instance exists, update its ID just in case (though rename should handle this)
             instance.id = gid;
        }
        newGroupInstances.set(gid, instance);
        // Preserve collapse state from old map if possible, else use instance default
        newCollapsedGroups[gid] = this._collapsedGroups[gid] ?? instance.isCollapsed; 
        // Sync instance state back from editor state (if it was preserved)
        instance.isCollapsed = newCollapsedGroups[gid];
    });

    // Preserve element collapse states
    currentElements.forEach(el => {
        if (el?.id) {
            newCollapsedElements[el.id] = this._collapsedElements[el.id] ?? true; // Default to collapsed
        }
    });

    // Update editor state
    this._groups = newGroups; // Keep sorted list for rendering order
    this._groupInstances = newGroupInstances;
    this._collapsedGroups = newCollapsedGroups;
    this._collapsedElements = newCollapsedElements;
    
    // Clean up state for groups/elements that no longer exist?
    // (Handled implicitly by rebuilding the maps/objects)
  }

  // --- Event Handlers ---
  // Helper to update config and fire event
  private _updateConfig(newElements: any[]): void {
      console.log(`Updating config with ${newElements.length} elements`);
      
      // Store a snapshot of the old elements IDs for logging
      const oldElementIds = this._config?.elements?.map(el => el.id) || [];
      
      // Update the config
      this._config = { ...(this._config || { type: 'lcars-card' }), elements: newElements };
      
      // Log any changed element IDs for debugging
      const newElementIds = newElements.map(el => el.id);
      const addedIds = newElementIds.filter(id => !oldElementIds.includes(id));
      const removedIds = oldElementIds.filter(id => !newElementIds.includes(id));
      
      if (addedIds.length > 0 || removedIds.length > 0) {
          console.log('Element ID changes:');
          if (addedIds.length > 0) console.log('- Added:', addedIds);
          if (removedIds.length > 0) console.log('- Removed:', removedIds);
      }
      
      this._extractGroupsAndInitState(); // Re-sync groups and collapse states
      fireEvent(this, 'config-changed', { config: this._config });
  }

  // Find element index by ID
  private _findElementIndex(elementId: string): number {
      return this._config?.elements?.findIndex(el => el.id === elementId) ?? -1;
  }

  // --- Group Management Handlers (Refactored) ---
  private _toggleGroupCollapse(groupId: string): void { 
      // Still manages editor's collapse state map
      this._collapsedGroups = { ...this._collapsedGroups, [groupId]: !this._collapsedGroups[groupId] };
      // If editing was active, cancel it upon collapse/expand
      if (this._editingGroup === groupId) {
           this._cancelEditGroup();
      }
      if (this._deleteWarningGroup === groupId) {
           this._cancelDeleteGroup();
      }
      this.requestUpdate(); // Trigger re-render
  }
  
  private async _addGroup(): Promise<void> { 
      // Manages the 'new group draft' state in the editor
       if (this._newGroupDraft) return;
      this._newGroupDraft = '__new__';
      this._newGroupInput = '';
      // Don't collapse the new group form immediately
      // this._collapsedGroups = { ...this._collapsedGroups, ['__new__']: false }; 
      this._groupIdWarning = '';
      await this.requestUpdate();
      // TODO: Focus input
  }

  private _confirmNewGroup(): void { 
      const name = this._newGroupInput.trim();
      // Use static validation method
      const validation = LcarsGroup.validateNewGroupName(name, new Set(this._groups));

      if (!validation.isValid) {
          this._groupIdWarning = validation.error || 'Invalid group name.';
          this.requestUpdate();
          return;
      }

      // Update editor state (add group ID, create instance, update collapse state)
      const newInstance = new LcarsGroup(name);
      this._groups = [...this._groups, name].sort();
      this._groupInstances.set(name, newInstance);
      this._collapsedGroups = { ...this._collapsedGroups, [name]: false }; // Expand new group
      
      // Reset draft state
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';

      this.requestUpdate(); 
  }

  private _cancelNewGroup(): void { 
      // Resets the 'new group draft' state
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }

  private _startEditGroup(groupId: string): void { 
      // Manages the 'editing group' state in the editor
      // Find the group instance
      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Cannot start editing non-existent group: ${groupId}`);
          return;
      }
      
      // Update the instance state
      groupInstance.startEditingName();
      
      // Sync with editor state
      this._editingGroup = groupId;
      this._editingGroupInput = groupId; // Prefill with current name
      this._groupIdWarning = groupInstance.editErrorMessage;
      this.requestUpdate();
  }

  // This method now orchestrates the name change using the ACTUAL LcarsGroup instance
  private _handleConfirmEditGroup(groupId: string): void { 
       if (!groupId) {
           console.error("Cannot confirm edit for null/empty group ID");
           this._cancelEditGroup();
           return;
       }

       const groupInstance = this._groupInstances.get(groupId);
       if (!groupInstance) {
           console.error(`Cannot confirm edit for non-existent group instance: ${groupId}`);
           this._cancelEditGroup(); // Reset editor state
           return;
       }

       // Update the instance's input with the latest value from the editor
       groupInstance.updateNameInput(this._editingGroupInput);

       const result = groupInstance.confirmEditName(); // Call confirm on the actual instance

       if (!result) { // Validation failed inside LcarsGroup or no change
            // Update editor state with error message from instance
            this._groupIdWarning = groupInstance.editErrorMessage;
            if (!groupInstance.isEditingName) { // If confirmEditName reset the state (no change)
                 this._cancelEditGroup(); 
            }
            this.requestUpdate();
            return;
       }

       const { oldId, newId } = result; // oldId should now be correct

       // Check for duplicate name in the main editor context
       if (this._groups.includes(newId)) {
           groupInstance.editErrorMessage = 'Group name already exists.'; // Set error on instance
           groupInstance.isEditingName = true; // Keep editing active on instance
           this._groupIdWarning = groupInstance.editErrorMessage; // Sync editor state
           this.requestUpdate();
           return; 
       }

       // --- Proceed with update --- 
       // 1. Update editor state (_groups, _collapsedGroups)
       this._groups = this._groups.map(g => g === oldId ? newId : g).sort();
       const { [oldId]: oldVal, ...rest } = this._collapsedGroups;
       this._collapsedGroups = { ...rest, [newId]: oldVal ?? false }; 
       
       // 2. Update group instances map
       this._groupInstances.delete(oldId); // Remove old instance
       groupInstance.id = newId; // Update the instance's internal ID
       this._groupInstances.set(newId, groupInstance); // Add instance with new key
       
       // 3. Update element IDs in the config
       const currentElements = this._config?.elements || [];
       const newElements = currentElements.map(el => {
           let updatedEl = { ...el };
           if (updatedEl.id?.startsWith(oldId + '.')) {
               const baseId = updatedEl.id.substring(oldId.length + 1);
               updatedEl.id = `${newId}.${baseId}`;
           }
           
           // Update any references to elements in this group
           if (updatedEl.layout?.anchorTo?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.anchorTo.substring(oldId.length + 1);
               updatedEl.layout.anchorTo = `${newId}.${targetBaseId}`;
           }
           if (updatedEl.layout?.stretchTo?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.stretchTo.substring(oldId.length + 1);
               updatedEl.layout.stretchTo = `${newId}.${targetBaseId}`;
           }
           return updatedEl;
       });

       // 4. Reset editor state
       this._editingGroup = null;
       this._editingGroupInput = '';
       this._groupIdWarning = '';
       
       // 5. Update config and trigger re-render
       this._updateConfig(newElements);
   }

  private _cancelEditGroup(): void { 
      // Resets the 'editing group' state
      this._editingGroup = null;
      this._editingGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }

  private _requestDeleteGroup(groupId: string): void { 
      // Manages the delete warning state
      // Check if group has elements (using current config)
      const hasElements = (this._config?.elements || []).some(el => el.id?.startsWith(groupId + '.'));
      if (hasElements) {
          this._deleteWarningGroup = groupId;
          this.requestUpdate();
      } else {
          // If no elements, bypass warning and delete immediately
          this._handleConfirmDeleteGroup(groupId); 
      }
  }

  // This method now orchestrates the deletion
  private _handleConfirmDeleteGroup(groupId: string): void {
       // 1. Update editor state (_groups, _collapsedGroups)
       this._groups = this._groups.filter(g => g !== groupId);
       const { [groupId]: _removed, ...rest } = this._collapsedGroups;
       this._collapsedGroups = rest;

       // 2. Update central config (_config.elements)
       const currentElements = this._config?.elements || [];
       const elementsToRemove = new Set(currentElements.filter(el => el.id?.startsWith(groupId + '.')).map(el => el.id));
       const newElements = currentElements.filter(el => 
           !el.id?.startsWith(groupId + '.') &&
           !(el.layout?.anchorTo && elementsToRemove.has(el.layout.anchorTo)) &&
           !(el.layout?.stretchTo && elementsToRemove.has(el.layout.stretchTo))
       );
       
       // 3. Reset editor state
       if (this._editingGroup === groupId) this._cancelEditGroup(); 
       this._deleteWarningGroup = null;

       // 4. Update config and trigger re-render
       this._updateConfig(newElements);
  }

  private _cancelDeleteGroup(): void { 
      // Resets the delete warning state
      this._deleteWarningGroup = null;
      this.requestUpdate();
  }

  // _validateGroupIdInput is used internally by _confirmNewGroup now, keep it private/local
  private _validateGroupIdInput(input: string): boolean { 
       if (!input) return false;
       return /^[a-zA-Z0-9_-]+$/.test(input);
  }

  // --- Element Management Handlers (Refactored) ---
  private _toggleElementCollapse(elementId: string): void { 
      // Manages editor's collapse state map
      this._collapsedElements = { ...this._collapsedElements, [elementId]: !this._collapsedElements[elementId] };
      // If editing was active, cancel it
      if (this._editingElementId === elementId) {
           this._cancelEditElementId();
      }
      this.requestUpdate();
  }
  
  private async _addElement(groupId: string): Promise<void> { 
      // Manages the 'add element draft' state in the editor
       if (this._addElementDraftGroup) return; // Only one draft at a time
      this._addElementDraftGroup = groupId;
      this._addElementInput = ''; // Reset input
      this._addElementWarning = '';
      await this.requestUpdate();
      // TODO: Focus input
  }

  private _confirmAddElement(): void {
      const groupId = this._addElementDraftGroup;
      const baseId = this._addElementInput.trim();
      if (!groupId) {
          console.error("Cannot add element without target group ID");
          this._cancelAddElement(); // Reset state
          return;
      }

      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Could not find group instance for ID: ${groupId}`);
          this._addElementWarning = `Error finding group ${groupId}`;
          this.requestUpdate();
          return;
      }

      // Get existing element IDs *within this group*
      const existingElementIdsInGroup = new Set(
          (this._config?.elements || [])
              .filter(el => el.id?.startsWith(groupId + '.'))
              .map(el => el.id)
      );

      // Call the group instance method
      const result = groupInstance.requestAddElement(baseId, existingElementIdsInGroup);

      if (result.error) {
          this._addElementWarning = result.error;
          this.requestUpdate();
          return; // Keep input active for user to correct
      }

      if (result.newElementConfig) {
          // Update central config
          const currentElements = this._config?.elements || [];
          const newElements = [...currentElements, result.newElementConfig];
          
          // Update editor state (expand new element)
          this._collapsedElements = { ...(this._collapsedElements || {}), [result.newElementConfig.id]: false }; 
          this._addElementDraftGroup = null;
          this._addElementInput = '';
          this._addElementWarning = '';
          
          this._updateConfig(newElements);
      } else {
           // Should not happen if error is handled, but defensively reset state
           console.warn("requestAddElement returned no config and no error");
           this._cancelAddElement(); 
      }
  }

  private _cancelAddElement(): void { 
      // Resets the 'add element draft' state
      this._addElementDraftGroup = null;
      this._addElementInput = '';
      this._addElementWarning = '';
      this.requestUpdate();
  }

   // Orchestrates element deletion
  private _handleDeleteElement(elementId: string): void {
      const currentElements = this._config?.elements || [];
      // Filter out the element itself AND any elements anchoring/stretching to it
      const newElements = currentElements.filter(el => 
           el.id !== elementId && 
           el.layout?.anchorTo !== elementId && 
           el.layout?.stretchTo !== elementId
      );

      // Update editor collapse state
      const { [elementId]: _r, ...restCol } = this._collapsedElements;
      this._collapsedElements = restCol;

      // Reset editing state if this element was being edited
      if (this._editingElementId === elementId) {
          this._cancelEditElementId();
      }

      this._updateConfig(newElements);
  }

  private _startEditElementId(elementId: string): void { 
      // Manages the 'editing element ID' state in the editor
      const elementInstance = this._getElementInstance(elementId); // Helper to get instance
      if (!elementInstance) {
          console.error(`Cannot start editing non-existent element: ${elementId}`);
          return;
      }
      
      // Initialize the element instance's editing state
      elementInstance.startEditingId();
      
      // Sync with editor state
      this._editingElementId = elementId;
      this._editingElementIdInput = elementInstance.getBaseId(); // Use instance method
      this._elementIdWarning = elementInstance.idEditErrorMessage;
      this.requestUpdate();
  }

  // Orchestrates the ID change using LcarsElementBase validation/confirmation
  private _handleConfirmEditElementId(elementInstance: LcarsElementBase): void { 
      // Get the current editing ID
      const elementId = this._editingElementId;
      if (!elementId) {
          console.error("Trying to confirm edit for null element ID");
          this._cancelEditElementId();
          return;
      }

      // Update element instance with latest input value
      elementInstance.updateIdInput(this._editingElementIdInput);
      
      // Force reset editing state on the element instance
      elementInstance.isEditingId = true;
      
      const result = elementInstance.confirmEditId();
      if (!result) { // Validation failed or no change
          this._elementIdWarning = elementInstance.idEditErrorMessage;
          if (elementInstance.idEditErrorMessage === '') { // No change or cancelled
              this._cancelEditElementId();
          }
          this.requestUpdate();
          return;
      }

      const { oldId, newId } = result;
      
      console.log(`Renaming element from ${oldId} to ${newId}`);

      // Check for duplicate ID in the main editor context
      if (this._config?.elements?.some(el => el.id === newId && el.id !== oldId)) {
          // Update warning and keep editing active
          this._elementIdWarning = 'ID already exists in this group.';
          this.requestUpdate();
          return;
      }

      // --- Proceed with update --- 
      const currentElements = this._config?.elements || [];
      
      // Find the element to modify
      const index = this._findElementIndex(oldId);
      if (index === -1) {
          console.error(`Could not find element with ID ${oldId} in config`);
          this._elementIdWarning = 'Element not found in config';
          this.requestUpdate();
          return;
      }
      
      // Create the updated elements array
      const newElements = [...currentElements];
      
      // Deep clone the element and update its ID
      const updatedElement = { ...newElements[index], id: newId };
      newElements[index] = updatedElement;
      
      // Update any references to this element in other elements
      for (let i = 0; i < newElements.length; i++) {
          if (i === index) continue; // Skip the element we just updated
          
          const el = newElements[i];
          let needsUpdate = false;
          
          // Create deep clones of layout objects only if needed
          let updatedLayout = el.layout;
          
          if (el.layout?.anchorTo === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  needsUpdate = true;
              }
              updatedLayout.anchorTo = newId;
          }
          
          if (el.layout?.stretchTo === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  needsUpdate = true;
              }
              updatedLayout.stretchTo = newId;
          }
          
          if (needsUpdate) {
              newElements[i] = { ...el, layout: updatedLayout };
          }
      }

      // Update editor collapse state key
      const { [oldId]: oldCollapseVal, ...restCol } = this._collapsedElements;
      this._collapsedElements = { ...restCol, [newId]: oldCollapseVal ?? false }; 
      
      // Reset editor state
      this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';

      // Update config and trigger re-render
      this._updateConfig(newElements);
  }

  private _cancelEditElementId(): void { 
      // Resets the 'editing element ID' state
       this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';
      this.requestUpdate();
  }

  // Helper to get element instance (avoids repeating createElementInstance)
  private _getElementInstance(elementId: string): LcarsElementBase | null {
      const index = this._findElementIndex(elementId);
      if (index === -1 || !this._config?.elements) {
          console.error(`Element with ID ${elementId} not found in config.`);
          return null;
      }
      const elementConfig = this._config.elements[index];
      const instance = createElementInstance(elementConfig);
      if (!instance) {
           console.error(`Could not create instance for element ID ${elementId} with type ${elementConfig?.type}`);
      }
      return instance;
  }

  // --- Drag & Drop Handlers --- (Keep existing)
  private _onDragStart(ev: DragEvent, elementId: string): void { 
       this._draggedElementId = elementId;
      if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          
          // Find the element being dragged
          const draggedEl = this.renderRoot.querySelector(`.element-editor[data-element-id="${elementId}"]`) as HTMLElement | null;
          if (draggedEl) {
              // Clone for drag image
              const ghost = draggedEl.cloneNode(true) as HTMLElement;
              ghost.style.position = 'absolute';
              ghost.style.top = '-9999px';
              ghost.style.left = '-9999px';
              ghost.style.width = `${draggedEl.offsetWidth}px`;
              ghost.style.height = 'auto';
              ghost.style.opacity = '0.7';
              ghost.style.pointerEvents = 'none';
              ghost.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              ghost.style.background = getComputedStyle(draggedEl).background;
              
              document.body.appendChild(ghost);
              
              // Center the drag image under the cursor
              const rect = draggedEl.getBoundingClientRect();
              const offsetX = ev.clientX - rect.left;
              const offsetY = ev.clientY - rect.top;
              
              ev.dataTransfer.setDragImage(ghost, offsetX, offsetY);
              
              // Remove ghost after drag image is captured
              setTimeout(() => {
                  document.body.removeChild(ghost);
              }, 0);
          }
      }
  }
  private _onDragOver(ev: DragEvent, targetElementId: string): void { 
       ev.preventDefault();
      if (this._draggedElementId === targetElementId) {
          this._dragOverElementId = null;
          return;
      }
      const draggedGroup = this._draggedElementId?.split('.')[0];
      const targetGroup = targetElementId.split('.')[0];
      if (draggedGroup === targetGroup) {
           this._dragOverElementId = targetElementId;
           if(ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      } else {
           this._dragOverElementId = null;
           if(ev.dataTransfer) ev.dataTransfer.dropEffect = 'none';
      }
      this.requestUpdate();
  }
  private _onDrop(ev: DragEvent, targetElementId: string): void { 
      ev.preventDefault();
      if (!this._draggedElementId || this._draggedElementId === targetElementId) {
          this._onDragEnd(ev);
          return;
      }
      const draggedGroup = this._draggedElementId.split('.')[0];
      const targetGroup = targetElementId.split('.')[0];
      if (draggedGroup !== targetGroup) {
          this._onDragEnd(ev);
          return;
      }
      const elements = [...(this._config?.elements || [])];
      const draggedIndex = elements.findIndex(el => el.id === this._draggedElementId);
      const targetIndex = elements.findIndex(el => el.id === targetElementId);
      if (draggedIndex === -1 || targetIndex === -1) {
          this._onDragEnd(ev);
          return;
      }
      
      // Fix: Simply splice out the dragged element and insert at target position
      // No adjustment needed as that was causing the incorrect movement
      const [movedElement] = elements.splice(draggedIndex, 1);
      elements.splice(targetIndex, 0, movedElement);
      
      this._draggedElementId = null;
      this._dragOverElementId = null;
      this._updateConfig(elements);
  }
  private _onDragEnd(ev: DragEvent): void { 
      // Reset drag related state
      this._draggedElementId = null;
      this._dragOverElementId = null;
      
      // Force re-render to ensure UI updates
      this.requestUpdate();
  }

  // --- Render Functions ---
  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="card-config">
        <ha-tabs
          scrollable
          .selected=${this._selectedTabIndex}
          @iron-select=${(ev: CustomEvent) => (this._selectedTabIndex = parseInt(ev.detail.item.getAttribute('data-tab-index'), 10))}
        >
            <paper-tab data-tab-index="0">
                LCARS Elements (${this._config.elements?.length || 0})
            </paper-tab>
            <paper-tab data-tab-index="1">
                Card Config (TBD)
            </paper-tab>
        </ha-tabs>

        ${this._selectedTabIndex === 0 ? this._renderGroupListUsingModules() : this._renderCardConfigEditor()}
      </div>
    `;
  }

  private _renderCardConfigEditor(): TemplateResult {
      // Placeholder for card-level config using ha-form later
      return html`<p style="padding: 16px;">Card configuration options will go here.</p>`;
  }

  // Uses the extracted render modules
  private _renderGroupListUsingModules(): TemplateResult {
    const elements = this._config?.elements || [];
    const groupedElements: { [groupId: string]: any[] } = {};

    // Group elements by their group ID
    elements.forEach(el => {
        const gid = el.id?.split('.')[0] || '__ungrouped__';
        if (!groupedElements[gid]) groupedElements[gid] = [];
        groupedElements[gid].push(el);
    });

    // Ensure all defined groups are shown, even if empty
    this._groups.forEach(gid => {
        if (!groupedElements[gid]) groupedElements[gid] = [];
    });

    // Create context objects for the renderers
    const editorContext = {
        hass: this.hass,
        cardConfig: this._config,
        handleFormValueChanged: this._handleFormValueChanged.bind(this),
        getElementInstance: this._getElementInstance.bind(this),
        onDragStart: this._onDragStart.bind(this),
        onDragOver: this._onDragOver.bind(this),
        onDrop: this._onDrop.bind(this),
        onDragEnd: this._onDragEnd.bind(this),
        toggleElementCollapse: this._toggleElementCollapse.bind(this),
        startEditElementId: this._startEditElementId.bind(this),
        handleDeleteElement: this._handleDeleteElement.bind(this),
        handleConfirmEditElementId: this._handleConfirmEditElementId.bind(this),
        cancelEditElementId: this._cancelEditElementId.bind(this),
        updateElementIdInput: this._updateElementIdInput.bind(this),
        
        // State variables
        editingElementId: this._editingElementId,
        editingElementIdInput: this._editingElementIdInput,
        elementIdWarning: this._elementIdWarning,
        collapsedElements: this._collapsedElements,
        draggedElementId: this._draggedElementId,
        dragOverElementId: this._dragOverElementId
    };

    const groupContext = {
        toggleGroupCollapse: this._toggleGroupCollapse.bind(this),
        startEditGroup: this._startEditGroup.bind(this),
        requestDeleteGroup: this._requestDeleteGroup.bind(this),
        addElement: this._addElement.bind(this),
        handleConfirmEditGroup: this._handleConfirmEditGroup.bind(this),
        cancelEditGroup: this._cancelEditGroup.bind(this),
        handleConfirmDeleteGroup: this._handleConfirmDeleteGroup.bind(this),
        cancelDeleteGroup: this._cancelDeleteGroup.bind(this),
        confirmAddElement: this._confirmAddElement.bind(this),
        cancelAddElement: this._cancelAddElement.bind(this),
        updateGroupNameInput: this._updateGroupNameInput.bind(this),
        updateNewElementInput: this._updateNewElementInput.bind(this),
        
        // State variables
        collapsedGroups: this._collapsedGroups,
        editingGroup: this._editingGroup,
        editingGroupInput: this._editingGroupInput,
        groupIdWarning: this._groupIdWarning,
        deleteWarningGroup: this._deleteWarningGroup,
        addElementDraftGroup: this._addElementDraftGroup,
        addElementInput: this._addElementInput,
        addElementWarning: this._addElementWarning,
        groupInstances: this._groupInstances,
        newGroupInput: this._newGroupInput
    };

    // Create custom renderGroupList with our own Add Group button
    return html`
      <div class="groups-container" style="padding: 16px;">
          <div class="add-group-section" style="margin-bottom: 16px;">
              <ha-button outlined @click=${() => this._addGroup()}>Add New Group</ha-button>
          </div>

          ${this._newGroupDraft ? renderNewGroupForm(groupContext) : ''}

          ${Object.keys(groupedElements).sort().map(groupId => 
            renderGroup(groupId, groupedElements[groupId], editorContext, groupContext)
          )}

          ${groupedElements['__ungrouped__'] && groupedElements['__ungrouped__'].length > 0
              ? renderGroup('__ungrouped__', groupedElements['__ungrouped__'], editorContext, groupContext)
              : ''}
      </div>
    `;
  }

  // Use the imported styles
  static styles = editorStyles;

  // NEW UNIFIED HANDLER for the single ha-form per element
  private _handleFormValueChanged(ev: CustomEvent, elementId: string): void {
      if (!this._config?.elements) return;
      ev.stopPropagation();
      const index = this._findElementIndex(elementId);
      if (index === -1) return;
      
      const formData = ev.detail.value; // Flat object: { width: 100, fill: [255, 0, 0], ... }
      
      // --- Special Case: Handling update from the 'invalid type' form --- 
      // If the form data only contains the 'type' field, we assume it's fixing an invalid type.
      if (Object.keys(formData).length === 1 && formData.hasOwnProperty('type')) {
          const newType = formData.type;
          if (!newType) { 
              // Don't update if the type is cleared again, wait for a valid selection
              console.warn('Type selection cleared, no update performed.');
              return;
          }
          
          console.log(`Handling invalid type fix. Setting type to: ${newType} for ${elementId}`);
          
          // Create a deep copy of the current config to modify
          const newElements = structuredClone(this._config.elements);
          const elementToUpdate = newElements[index];
          
          // Directly update the type
          elementToUpdate.type = newType;
          
          // Optionally: Reset props/layout if type changes significantly? 
          // For now, let's keep existing props/layout to be less destructive.
          // If the new type needs different props, the full editor will show them.
          
          this._updateConfig(newElements);
          this.requestUpdate(); // Ensure re-render with the new type
          return; // Exit early, bypassing the instance-dependent logic below
      }
      
      // --- Regular handling for valid element forms ---
      const currentElementConfig = this._config.elements[index];
      const elementInstance = createElementInstance(currentElementConfig);
      if (!elementInstance) {
          console.error(`Could not get element instance for handler (Element ID: ${elementId})`);
          return;
      }

      const propertiesMap = elementInstance.getPropertiesMap();
      
      // Process data (e.g., cleanup conflicting fields like anchor points)
      const cleanedData = elementInstance.processDataUpdate(formData);
      
      // Special handling for color_rgb picker which returns an RGB array
      if (cleanedData.fill && Array.isArray(cleanedData.fill) && cleanedData.fill.length === 3) {
          // Convert RGB array to HEX format
          cleanedData.fill = this._rgbArrayToHex(cleanedData.fill);
          console.log('Converted RGB array to HEX:', cleanedData.fill);
      }

      // Create a deep copy to modify safely
      const newElementConfig = structuredClone(currentElementConfig);
      
      // Keep track of which keys were present in the form data
      const formKeys = new Set(Object.keys(cleanedData));

      // Update/delete values using configPath from propertiesMap
      propertiesMap.forEach((propInstance, key) => {
          const configPath = propInstance.configPath;
          if (formKeys.has(key)) {
              // Key exists in form data, update using setDeep
              // Ensure parent objects exist before setting
              const pathParts = configPath.split('.');
              if (pathParts.length === 2) {
                   const parentKey = pathParts[0] as 'props' | 'layout';
                   if (!newElementConfig[parentKey]) {
                       newElementConfig[parentKey] = {};
                   }
              }
              setDeep(newElementConfig, configPath, cleanedData[key]);
          } else {
              // Key from schema is *not* in the submitted form data
              // Delete the corresponding key from the config
              unsetDeep(newElementConfig, configPath);
          }
      });

       // Clean up empty props/layout objects after potential deletions
       if (newElementConfig.props && Object.keys(newElementConfig.props).length === 0) {
           delete newElementConfig.props;
       }
       if (newElementConfig.layout && Object.keys(newElementConfig.layout).length === 0) {
           delete newElementConfig.layout;
       }

      // Update the config array
      const newElements = [...this._config.elements];
      newElements[index] = newElementConfig;

      this._updateConfig(newElements);
      // Request update needed if schema depends on the changes (e.g., anchorTo)
      // This ensures the form re-renders with conditional fields updated
      this.requestUpdate(); 
  }
  
  // Helper to convert RGB array to HEX format
  private _rgbArrayToHex(rgb: number[]): string {
      return '#' + rgb.map(val => {
          const hex = Math.max(0, Math.min(255, val)).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
      }).join('');
  }
  
  // Helper to update the element config using the path
  private _updateElementConfigValue(elementConfig: any, path: string, value: any): void {
      const pathParts = path.split('.');
      if (pathParts.length === 1) {
          // Top-level property like 'type'
          elementConfig[pathParts[0]] = value;
      } else if (pathParts.length === 2) {
          // Nested property like 'props.fill' or 'layout.width'
          const [section, property] = pathParts;
          if (!elementConfig[section]) {
              elementConfig[section] = {};
          }
          elementConfig[section][property] = value;
      }
  }

  // Add missing _renderGroupList method still referenced in some places
  private _renderGroupList(): TemplateResult {
    // Just delegate to our new implementation
    return this._renderGroupListUsingModules();
  }

  // Update to handle element ID input changes
  private _updateElementIdInput(value: string): void {
    // Update editor state
    this._editingElementIdInput = value;
    
    // Sync validation state by getting the element instance
    if (this._editingElementId) {
      const elementInstance = this._getElementInstance(this._editingElementId);
      if (elementInstance) {
        // The instance was already updated by the renderer via elementInstance.updateIdInput
        // Now we just need to sync back the error message
        this._elementIdWarning = elementInstance.idEditErrorMessage;
      }
    }
    
    this.requestUpdate();
  }

  // Update to handle group name input changes
  private _updateGroupNameInput(value: string): void {
    // Update editor state
    this._editingGroupInput = value;
    
    // Sync validation state by getting the group instance
    if (this._editingGroup) {
      const groupInstance = this._groupInstances.get(this._editingGroup);
      if (groupInstance) {
        // The instance was already updated by the renderer via groupInstance.updateNameInput
        // Now we just need to sync back the error message
        this._groupIdWarning = groupInstance.editErrorMessage;
      }
    } else if (this._newGroupDraft) {
      // Validate new group name
      const validation = LcarsGroup.validateNewGroupName(value, new Set(this._groups));
      this._groupIdWarning = validation.error || '';
    }
    
    this.requestUpdate();
  }
  
  // Update to handle new element input changes
  private _updateNewElementInput(value: string): void {
    // Update editor state
    this._addElementInput = value;
    
    // Validate using a temporary element instance
    const tempElement = new RectangleElement({ id: '', type: 'rectangle' });
    tempElement.currentIdInput = value;
    tempElement.validateIdInput();
    this._addElementWarning = tempElement.idEditErrorMessage;
    
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-card-editor': LcarsCardEditor;
  }
} 