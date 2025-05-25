import { LitElement, html, TemplateResult, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';

import { editorStyles } from '../styles/styles.js';
import { 
  renderGroup, 
  renderNewGroupForm
} from './renderer.js';

import './grid-selector.js';
import { EditorElement } from './elements/element.js';
import './elements/rectangle.js';
import './elements/text.js';
import './elements/elbow.js';
import './elements/endcap.js';
import './elements/chisel_endcap.js';
import './elements/top_header.js';

import { LcarsGroup } from './group.js';
import { Rectangle } from './elements/rectangle.js';
import { PropertyGroup } from './properties/properties.js';

import './dynamic-color-editor.js';
import { isDynamicColorConfig, DynamicColorConfig } from '../types.js';

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

  @state() private _groups: string[] = [];
  @state() private _groupInstances: Map<string, LcarsGroup> = new Map();
  @state() private _collapsedGroups: { [groupId: string]: boolean } = {};
  @state() private _newGroupDraft: string | null = null;
  @state() private _newGroupInput: string = '';
  @state() private _editingGroup: string | null = null;
  @state() private _editingGroupInput: string = '';
  @state() private _deleteWarningGroup: string | null = null;
  @state() private _groupIdWarning: string = '';

  @state() private _collapsedElements: { [elementId: string]: boolean } = {};
  @state() private _editingElementId: string | null = null;
  @state() private _editingElementIdInput: string = '';
  @state() private _elementIdWarning: string = '';
  @state() private _addElementDraftGroup: string | null = null;
  @state() private _addElementInput: string = '';
  @state() private _addElementWarning: string = '';

  @state() private _collapsedPropertyGroups: { [elementId: string]: Record<PropertyGroup, boolean> } = {};

  private _draggedElementId: string | null = null;
  private _dragOverElementId: string | null = null;

  public setConfig(config: LcarsCardConfig): void {
    const prevConfig = this._config;
    this._config = {
        ...config,
        elements: config.elements || []
    };
    this._extractGroupsAndInitState(prevConfig?.elements);
  }

  private _extractGroupsAndInitState(prevElements?: any[]): void {
    if (!this._config?.elements) {
        this._groups = [];
        this._groupInstances.clear();
        this._collapsedGroups = {};
        this._collapsedElements = {};
        this._collapsedPropertyGroups = {};
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
    const newCollapsedPropertyGroups: { [elementId: string]: Record<PropertyGroup, boolean> } = {};

    newGroups.forEach(gid => {
        let instance = this._groupInstances.get(gid);
        if (!instance) {
            instance = new LcarsGroup(gid);
        } else {
             instance.id = gid;
        }
        newGroupInstances.set(gid, instance);
        newCollapsedGroups[gid] = this._collapsedGroups[gid] ?? instance.isCollapsed;
        instance.isCollapsed = newCollapsedGroups[gid];
    });

    currentElements.forEach(el => {
        if (el?.id) {
            newCollapsedElements[el.id] = this._collapsedElements[el.id] ?? true;

            newCollapsedPropertyGroups[el.id] = this._initCollapsedPG(el.id, this._collapsedPropertyGroups[el.id]);
        }
    });

    this._groups = newGroups;
    this._groupInstances = newGroupInstances;
    this._collapsedGroups = newCollapsedGroups;
    this._collapsedElements = newCollapsedElements;
    this._collapsedPropertyGroups = newCollapsedPropertyGroups;
  }

  private _updateConfig(newElements: any[]): void {
      
      const oldElementIds = this._config?.elements?.map(el => el.id) || [];
      
      this._config = { ...(this._config || { type: 'lcars-card' }), elements: newElements };
      
      const newElementIds = newElements.map(el => el.id);
      const addedIds = newElementIds.filter(id => !oldElementIds.includes(id));
      const removedIds = oldElementIds.filter(id => !newElementIds.includes(id));
      
      this._extractGroupsAndInitState();
      fireEvent(this, 'config-changed', { config: this._config });
  }

  private _findElementIndex(elementId: string): number {
      return this._config?.elements?.findIndex(el => el.id === elementId) ?? -1;
  }

  private _toggleGroupCollapse(groupId: string): void { 
      this._collapsedGroups = { ...this._collapsedGroups, [groupId]: !this._collapsedGroups[groupId] };
      if (this._editingGroup === groupId) {
           this._cancelEditGroup();
      }
      if (this._deleteWarningGroup === groupId) {
           this._cancelDeleteGroup();
      }
      this.requestUpdate();
  }
  
  private async _addGroup(): Promise<void> { 
       if (this._newGroupDraft) return;
      this._newGroupDraft = '__new__';
      this._newGroupInput = '';
      this._groupIdWarning = '';
      await this.requestUpdate();
  }
  private _confirmNewGroup(): void { 
      const name = this._newGroupInput;
      const validation = LcarsGroup.validateIdentifier(name, "Group ID", new Set(this._groups));

      if (!validation.isValid) {
          this._groupIdWarning = validation.error || 'Invalid group name.';
          this.requestUpdate();
          return;
      }
      
      const newInstance = new LcarsGroup(name);
      this._groups = [...this._groups, name].sort();
      this._groupInstances.set(name, newInstance);
      this._collapsedGroups = { ...this._collapsedGroups, [name]: false };
      
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';

      this.requestUpdate(); 
  }
  private _cancelNewGroup(): void {
      this._newGroupDraft = null;
      this._newGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }
  private _startEditGroup(groupId: string): void {
      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Cannot start editing non-existent group: ${groupId}`);
          return;
      }
      
      groupInstance.startEditingName();
      
      this._editingGroup = groupId;
      this._editingGroupInput = groupId;
      this._groupIdWarning = groupInstance.editErrorMessage;
      this.requestUpdate();
  }
  private _handleConfirmEditGroup(groupId: string): void { 
       if (!groupId) {
           console.error("Cannot confirm edit for null/empty group ID");
           this._cancelEditGroup();
           return;
       }

       const groupInstance = this._groupInstances.get(groupId);
       if (!groupInstance) {
           console.error(`Cannot confirm edit for non-existent group instance: ${groupId}`);
           this._cancelEditGroup();
           return;
       }

       groupInstance.updateNameInput(this._editingGroupInput);

       const result = groupInstance.confirmEditName(new Set(this._groups));

       if (!result) {
            this._groupIdWarning = groupInstance.editErrorMessage;
            if (!groupInstance.isEditingName) { 
                 this._cancelEditGroup(); 
            }
            this.requestUpdate();
            return;
       }

       const { oldId, newId } = result; 

       if (this._groups.includes(newId)) {
           groupInstance.editErrorMessage = 'Group name already exists.'; 
           groupInstance.isEditingName = true; 
           this._groupIdWarning = groupInstance.editErrorMessage; 
           this.requestUpdate();
           return; 
       }

       this._groups = this._groups.map(g => g === oldId ? newId : g).sort();
       const { [oldId]: oldVal, ...rest } = this._collapsedGroups;
       this._collapsedGroups = { ...rest, [newId]: oldVal ?? false }; 
       
       this._groupInstances.delete(oldId); 
       groupInstance.id = newId; 
       this._groupInstances.set(newId, groupInstance); 
       
       const currentElements = this._config?.elements || [];
       const newElements = currentElements.map(el => {
           let updatedEl = { ...el };
           if (updatedEl.id?.startsWith(oldId + '.')) {
               const baseId = updatedEl.id.substring(oldId.length + 1);
               updatedEl.id = `${newId}.${baseId}`;
           }
           
           if (updatedEl.layout?.anchor?.anchorTo?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.anchor.anchorTo.substring(oldId.length + 1);
               if (!updatedEl.layout) updatedEl.layout = {};
               if (!updatedEl.layout.anchor) updatedEl.layout.anchor = { anchorTo: '', anchorPoint: '', targetAnchorPoint: '' };
               updatedEl.layout.anchor.anchorTo = `${newId}.${targetBaseId}`;
           }
           if (updatedEl.layout?.stretch?.stretchTo1?.startsWith(oldId + '.')) {
               const targetBaseId = updatedEl.layout.stretch.stretchTo1.substring(oldId.length + 1);
               if (!updatedEl.layout) updatedEl.layout = {};
               if (!updatedEl.layout.stretch) updatedEl.layout.stretch = { stretchTo1: '', targetStretchAnchorPoint1: '' };
               updatedEl.layout.stretch.stretchTo1 = `${newId}.${targetBaseId}`;
           }
           return updatedEl;
       });

       this._editingGroup = null;
       this._editingGroupInput = '';
       this._groupIdWarning = '';
       
       this._updateConfig(newElements);
   }
  private _cancelEditGroup(): void { 
      this._editingGroup = null;
      this._editingGroupInput = '';
      this._groupIdWarning = '';
      this.requestUpdate();
  }
  private _requestDeleteGroup(groupId: string): void { 
      const hasElements = (this._config?.elements || []).some(el => el.id?.startsWith(groupId + '.'));
      if (hasElements) {
          this._deleteWarningGroup = groupId;
          this.requestUpdate();
      } else {
          this._handleConfirmDeleteGroup(groupId); 
      }
  }
  private _handleConfirmDeleteGroup(groupId: string): void {
       this._groups = this._groups.filter(g => g !== groupId);
       const { [groupId]: _removed, ...rest } = this._collapsedGroups;
       this._collapsedGroups = rest;

       const currentElements = this._config?.elements || [];
       const elementsToRemove = new Set(currentElements.filter(el => el.id?.startsWith(groupId + '.')).map(el => el.id));
       const elementsToKeep = currentElements.filter(el => 
           !el.id?.startsWith(groupId + '.') &&
           !(el.layout?.anchor?.anchorTo && elementsToRemove.has(el.layout.anchor.anchorTo)) &&
           !(el.layout?.stretch?.stretchTo1 && elementsToRemove.has(el.layout.stretch.stretchTo1))
       );
       
       if (this._editingGroup === groupId) this._cancelEditGroup(); 
       this._deleteWarningGroup = null;

       this._updateConfig(elementsToKeep);
  }
  private _cancelDeleteGroup(): void { 
      this._deleteWarningGroup = null;
      this.requestUpdate();
  }

  private _toggleElementCollapse(elementId: string): void { 
      this._collapsedElements = { ...this._collapsedElements, [elementId]: !this._collapsedElements[elementId] };
      if (this._editingElementId === elementId) {
           this._cancelEditElementId();
      }
      this.requestUpdate();
  }
  
  private async _addElement(groupId: string): Promise<void> { 
       if (this._addElementDraftGroup) return;
      this._addElementDraftGroup = groupId;
      this._addElementInput = ''; 
      this._addElementWarning = '';
      await this.requestUpdate();
  }
  private _confirmAddElement(): void {
      const groupId = this._addElementDraftGroup;
      const baseId = this._addElementInput.trim();
      if (!groupId) {
          console.error("Cannot add element without target group ID");
          this._cancelAddElement();
          return;
      }

      const groupInstance = this._groupInstances.get(groupId);
      if (!groupInstance) {
          console.error(`Could not find group instance for ID: ${groupId}`);
          this._addElementWarning = `Error finding group ${groupId}`;
          this.requestUpdate();
          return;
      }

      const existingElementIdsInGroup = new Set(
          (this._config?.elements || [])
              .filter(el => el.id?.startsWith(groupId + '.'))
              .map(el => el.id)
      );

      const result = groupInstance.requestAddElement(baseId, existingElementIdsInGroup);

      if (result.error) {
          this._addElementWarning = result.error;
          this.requestUpdate();
          return; 
      }

      if (result.newElementConfig) {
          const currentElements = this._config?.elements || [];
          const newElements = [...currentElements, result.newElementConfig];
          
          const newElementId = result.newElementConfig.id;
          this._collapsedElements = { ...(this._collapsedElements || {}), [newElementId]: false }; 
 this._collapsedPropertyGroups = {
   ...this._collapsedPropertyGroups,
   [newElementId]: Object.fromEntries(
     Object.values(PropertyGroup).map((pgKey) => [pgKey, true])
   ),
 };
          this._addElementDraftGroup = null;
          this._addElementInput = '';
          this._addElementWarning = '';
          
          this._updateConfig(newElements);
      } else {
           console.warn("requestAddElement returned no config and no error");
           this._cancelAddElement(); 
      }
  }
  private _cancelAddElement(): void { 
      this._addElementDraftGroup = null;
      this._addElementInput = '';
      this._addElementWarning = '';
      this.requestUpdate();
  }
  private _handleDeleteElement(elementId: string): void {
      const currentElements = this._config?.elements || [];
      const newElements = currentElements.filter(el => 
           el.id !== elementId && 
           el.layout?.anchor?.anchorTo !== elementId && 
           el.layout?.stretch?.stretchTo1 !== elementId
      );

      const { [elementId]: _r, ...restCol } = this._collapsedElements;
      this._collapsedElements = restCol;

      const { [elementId]: _rProp, ...restPropColDel } = this._collapsedPropertyGroups;
      this._collapsedPropertyGroups = restPropColDel;

      if (this._editingElementId === elementId) {
          this._cancelEditElementId();
      }

      this._updateConfig(newElements);
  }
  private _startEditElementId(elementId: string): void { 
      const elementInstance = this._getElementInstance(elementId); 
      if (!elementInstance) {
          console.error(`Cannot start editing non-existent element: ${elementId}`);
          return;
      }
      
      elementInstance.startEditingId();
      
      this._editingElementId = elementId;
      this._editingElementIdInput = elementInstance.getBaseId(); 
      this._elementIdWarning = elementInstance.idEditErrorMessage;
      this.requestUpdate();
  }
  private _handleConfirmEditElementId(elementInstance: EditorElement): void { 
      const elementId = this._editingElementId;
      if (!elementId) {
          console.error("Trying to confirm edit for null element ID");
          this._cancelEditElementId();
          return;
      }

      elementInstance.updateIdInput(this._editingElementIdInput);
      
      elementInstance.isEditingId = true;
      
      const result = elementInstance.confirmEditId();
      if (!result) { 
          this._elementIdWarning = elementInstance.idEditErrorMessage;
          if (elementInstance.idEditErrorMessage === '') { 
              this._cancelEditElementId();
          }
          this.requestUpdate();
          return;
      }

      const { oldId, newId } = result;

      if (this._config?.elements?.some(el => el.id === newId && el.id !== oldId)) {
          this._elementIdWarning = 'ID already exists in this group.';
          this.requestUpdate();
          return;
      }

      const currentElements = this._config?.elements || [];
      
      const index = this._findElementIndex(oldId);
      if (index === -1) {
          console.error(`Could not find element with ID ${oldId} in config`);
          this._elementIdWarning = 'Element not found in config';
          this.requestUpdate();
          return;
      }
      
      const newElements = [...currentElements];
      
      const updatedElement = { ...newElements[index], id: newId };
      newElements[index] = updatedElement;
      
      for (let i = 0; i < newElements.length; i++) {
          if (i === index) continue; 
          
          const el = newElements[i];
          let needsUpdate = false;
          
          let updatedLayout = el.layout;
          
          if (el.layout?.anchor?.anchorTo === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  if (updatedLayout && !updatedLayout.anchor) updatedLayout.anchor = { anchorTo: '' };
                  needsUpdate = true;
              }
              if(updatedLayout?.anchor) updatedLayout.anchor.anchorTo = newId;
          }
          
          if (el.layout?.stretch?.stretchTo1 === oldId) {
              if (!needsUpdate) {
                  updatedLayout = { ...el.layout };
                  if (updatedLayout && !updatedLayout.stretch) updatedLayout.stretch = { stretchTo1: '', targetStretchAnchorPoint1: '' };
                  needsUpdate = true;
              }
              if(updatedLayout?.stretch) updatedLayout.stretch.stretchTo1 = newId;
          }
          
          if (needsUpdate) {
              newElements[i] = { ...el, layout: updatedLayout };
          }
      }

      const { [oldId]: oldCollapseVal, ...restCol } = this._collapsedElements;
      this._collapsedElements = { ...restCol, [newId]: oldCollapseVal ?? false }; 
      
      const oldPropGroupState = this._collapsedPropertyGroups[oldId] || {};
      const { [oldId]: _rOldProp, ...restPropGroupStates } = this._collapsedPropertyGroups;
      this._collapsedPropertyGroups = { ...restPropGroupStates };
      this._collapsedPropertyGroups[newId] = this._initCollapsedPG(newId, oldPropGroupState);

      this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';

      this._updateConfig(newElements);
  }
  private _cancelEditElementId(): void { 
      this._editingElementId = null;
      this._editingElementIdInput = '';
      this._elementIdWarning = '';
      this.requestUpdate();
  }

  private _getElementInstance(elementId: string): EditorElement | null {
      const index = this._findElementIndex(elementId);
      if (index === -1 || !this._config?.elements) {
          console.error(`Element with ID ${elementId} not found in config.`);
          return null;
      }
      const elementConfig = this._config.elements[index];
      const instance = EditorElement.create(elementConfig);
      if (!instance) {
           console.error(`Could not create instance for element ID ${elementId} with type ${elementConfig?.type}`);
      }
      return instance;
  }

  private _onDragStart(ev: DragEvent, elementId: string): void { 
       this._draggedElementId = elementId;
      if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          
          const draggedEl = this.renderRoot.querySelector(`.element-editor[data-element-id="${elementId}"]`) as HTMLElement | null;
          if (draggedEl) {
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
              
              const rect = draggedEl.getBoundingClientRect();
              const offsetX = ev.clientX - rect.left;
              const offsetY = ev.clientY - rect.top;
              
              ev.dataTransfer.setDragImage(ghost, offsetX, offsetY);
              
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
      
      const [movedElement] = elements.splice(draggedIndex, 1);
      elements.splice(targetIndex, 0, movedElement);
      
      this._draggedElementId = null;
      this._dragOverElementId = null;
      this._updateConfig(elements);
  }
  private _onDragEnd(ev: DragEvent): void { 
      this._draggedElementId = null;
      this._dragOverElementId = null;
      
      this.requestUpdate();
  }

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
      return html`<p style="padding: 16px;">Card configuration options will go here.</p>`;
  }

  private _renderGroupListUsingModules(): TemplateResult {
    const elements = this._config?.elements || [];
    const groupedElements: { [groupId: string]: any[] } = {};

    elements.forEach(el => {
        const gid = el.id?.split('.')[0] || '__ungrouped__';
        if (!groupedElements[gid]) groupedElements[gid] = [];
        groupedElements[gid].push(el);
    });

    this._groups.forEach(gid => {
        if (!groupedElements[gid]) groupedElements[gid] = [];
    });

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
        togglePropertyGroupCollapse: this._togglePropertyGroupCollapse.bind(this),
        startEditElementId: this._startEditElementId.bind(this),
        handleDeleteElement: this._handleDeleteElement.bind(this),
        handleConfirmEditElementId: this._handleConfirmEditElementId.bind(this),
        cancelEditElementId: this._cancelEditElementId.bind(this),
        updateElementIdInput: this._updateElementIdInput.bind(this),
        updateElementConfigValue: this._updateElementConfigValue.bind(this),
        
        editingElementId: this._editingElementId,
        editingElementIdInput: this._editingElementIdInput,
        elementIdWarning: this._elementIdWarning,
        collapsedElements: this._collapsedElements,
        collapsedPropertyGroups: this._collapsedPropertyGroups,
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
        confirmNewGroup: this._confirmNewGroup.bind(this),
        cancelNewGroup: this._cancelNewGroup.bind(this),
        addGroup: this._addGroup.bind(this),
        
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

    return html`
      <div class="groups-container">
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

  static styles = editorStyles;

private _handleFormValueChanged(ev: CustomEvent, elementId: string): void {
    if (!this._config?.elements) return;
    ev.stopPropagation();
    const index = this._findElementIndex(elementId);
    if (index === -1) return;

    const formData = ev.detail.value;

    // Handle single property changes (dynamic colors)
    if (ev.detail.name && ev.detail.value !== undefined) {
        const { name, value } = ev.detail;
        const elementInstance = this._getElementInstance(elementId);
        if (!elementInstance) return;

        const propertiesMap = elementInstance.getPropertiesMap();
        const property = propertiesMap.get(name);
        
        // Handle dynamic color configurations
        if (property && property.name === 'fill' && isDynamicColorConfig(value)) {
            // Store dynamic color config directly
            this._updateElementConfigValue(this._config.elements[index], property.configPath, value);
            this._updateConfig(this._config.elements);
            return;
        }

        // Handle other single property changes
        let processedValue = value;
        if (Array.isArray(value) && value.length === 3 && value.every(num => typeof num === 'number')) {
            processedValue = this._rgbArrayToHex(value);
        }

        this._updateElementConfigValue(this._config.elements[index], property?.configPath || name, processedValue);
        this._updateConfig(this._config.elements);
        return;
    }

    // Handle complete form data changes (existing logic)
    if (Object.keys(formData).length === 1 && formData.hasOwnProperty('type')) {
        const newType = formData.type;
        if (!newType) {
            console.warn('Type selection cleared, no update performed.');
            return;
        }

        const newElementsConfig = structuredClone(this._config.elements);
        const elementToUpdate = newElementsConfig[index];
        elementToUpdate.type = newType;

        this._updateConfig(newElementsConfig);
        this.requestUpdate();
        return;
    }

    const currentElementConfig = this._config.elements[index];
    const elementInstance = EditorElement.create(currentElementConfig);
    if (!elementInstance) {
        console.error(`Could not get element instance for handler (Element ID: ${elementId})`);
        return;
    }

    const cleanedData = elementInstance.processDataUpdate(formData);

    let newElementConfig: any = { id: currentElementConfig.id, type: currentElementConfig.type };

    const propertiesMap = elementInstance.getPropertiesMap();

    propertiesMap.forEach((propInstance, key) => {
        if (cleanedData.hasOwnProperty(key)) {
            let value = cleanedData[key];

            // Handle dynamic colors
            if (key === 'fill' && isDynamicColorConfig(value)) {
                setDeep(newElementConfig, propInstance.configPath, value);
            } else if (key === 'fill' && Array.isArray(value) && value.length === 3) {
                value = this._rgbArrayToHex(value);
                setDeep(newElementConfig, propInstance.configPath, value);
            } else {
                setDeep(newElementConfig, propInstance.configPath, value);
            }
        }
    });

    if (newElementConfig.props && Object.keys(newElementConfig.props).length === 0) {
        delete newElementConfig.props;
    }
    if (newElementConfig.layout) {
        if (Object.keys(newElementConfig.layout).length === 0) {
            delete newElementConfig.layout;
        } else if (newElementConfig.layout.stretch && Object.keys(newElementConfig.layout.stretch).length === 0) {
            delete newElementConfig.layout.stretch;
            if (Object.keys(newElementConfig.layout).length === 0) {
                delete newElementConfig.layout;
            }
        }
    }

    const updatedElementsArray = [...this._config.elements];
    updatedElementsArray[index] = newElementConfig;

    this._updateConfig(updatedElementsArray);
    this.requestUpdate();
}
  
private _rgbArrayToHex(rgb: number[]): string {
    return '#' + rgb.map(val => {
        const hex = Math.max(0, Math.min(255, val)).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}
  
private _updateElementConfigValue(elementConfig: any, path: string, value: any): void {
    const pathParts = path.split('.');
    if (pathParts.length === 1) {
        elementConfig[pathParts[0]] = value;
    } else if (pathParts.length === 2) {
        const [section, property] = pathParts;
        if (!elementConfig[section]) {
            elementConfig[section] = {};
        }
        elementConfig[section][property] = value;
    }
}

private _updateElementIdInput(value: string): void {
  this._editingElementIdInput = value;
  
  if (this._editingElementId) {
    const elementInstance = this._getElementInstance(this._editingElementId);
    if (elementInstance) {
      elementInstance.currentIdInput = value;
      elementInstance.validateIdInput();
      this._elementIdWarning = elementInstance.idEditErrorMessage;
    }
  }
  
  this.requestUpdate();
}

private _updateGroupNameInput(value: string): void {
  if (this._editingGroup) {
    this._editingGroupInput = value;
    
    const groupInstance = this._groupInstances.get(this._editingGroup);
    if (groupInstance) {
      groupInstance.updateNameInput(value);
      this._groupIdWarning = groupInstance.editErrorMessage;
    }
  } else if (this._newGroupDraft) {
    this._newGroupInput = value;
    
    const validation = LcarsGroup.validateIdentifier(value, "Group ID", new Set(this._groups));
    this._groupIdWarning = validation.error || '';
  }
  
  this.requestUpdate();
}
  
private _updateNewElementInput(value: string): void {
  this._addElementInput = value;
  
  const tempElement = new Rectangle({ id: '', type: 'rectangle' });
  tempElement.currentIdInput = value;
  tempElement.validateIdInput();
  this._addElementWarning = tempElement.idEditErrorMessage;
  
  this.requestUpdate();
}

/**
 * Initializes the collapsed state for property groups of a given element.
 * If previous state is provided, uses it, otherwise defaults to all true.
 * @param elementId The ID of the element.
 * @param prevCollapsedState Optional previous collapsed state for this element.
 * @returns The initialized collapsed state map for property groups.
 */
private _initCollapsedPG(elementId: string, prevCollapsedState?: Record<PropertyGroup, boolean>): Record<PropertyGroup, boolean> {
    // Initialize with a temporary type that allows string keys, then populate
    const newState: { [key: string]: boolean } = {};
    Object.values(PropertyGroup).forEach(pgKey => {
        newState[pgKey] = prevCollapsedState?.[pgKey] ?? true;
    });
    // The object now conforms to Record<PropertyGroup, boolean>, implicitly returned as such
    return newState as Record<PropertyGroup, boolean>;
}

private _togglePropertyGroupCollapse(elementId: string, groupKey: PropertyGroup): void {
  if (!this._collapsedPropertyGroups[elementId]) {
      // Use helper to initialize if element state doesn't exist
      this._collapsedPropertyGroups[elementId] = this._initCollapsedPG(elementId);
  }
  // Ensure all keys are present, even if not explicitly initialized before
  Object.values(PropertyGroup).forEach(pgKey => {
      if (this._collapsedPropertyGroups[elementId][pgKey] === undefined) {
           this._collapsedPropertyGroups[elementId][pgKey] = true;
      }
  });

  this._collapsedPropertyGroups = {
      ...this._collapsedPropertyGroups,
      [elementId]: {
          ...this._collapsedPropertyGroups[elementId],
          [groupKey]: !this._collapsedPropertyGroups[elementId][groupKey],
      },
  };
  this.requestUpdate();
}
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-card-editor': LcarsCardEditor;
  }
} 