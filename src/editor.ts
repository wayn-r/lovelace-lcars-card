import { LitElement, html, TemplateResult, CSSResultGroup, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig, ElementConfig } from './types';
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
import { gsap } from 'gsap';
import Draggable from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

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
  private _groupDraggables: Draggable[] = [];
  private _elementDraggables: Map<number, Draggable[]> = new Map();
  private _groupDragContext?: {
    initialIndex: number;
    placeholder: HTMLElement;
    container: HTMLElement;
    containerOriginalPosition: string;
  };
  private _elementDragContext?: {
    groupIndex: number;
    initialIndex: number;
    placeholder: HTMLElement;
    sourceList: HTMLElement;
    currentGroupIndex: number;
    currentInsertionIndex: number;
    temporaryLists: Set<HTMLElement>;
    sourceListOriginalPosition: string;
  };
  private _isDragging: boolean = false;

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

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (this._isDragging) {
      return;
    }
    this._initializeDragAndDrop();
  }

  disconnectedCallback(): void {
    this._destroyDragAndDrop();
    super.disconnectedCallback();
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

  private _initializeDragAndDrop(): void {
    if (!this.isConnected) return;
    this._setupGroupDraggables();
    this._setupElementDraggables();
  }

  private _destroyDragAndDrop(): void {
    this._groupDraggables.forEach(draggable => draggable.kill());
    this._groupDraggables = [];

    this._elementDraggables.forEach(draggables => draggables.forEach(draggable => draggable.kill()));
    this._elementDraggables.clear();
  }

  private _setupGroupDraggables(): void {
    this._groupDraggables.forEach(draggable => draggable.kill());
    this._groupDraggables = [];

    if (!this._config?.groups || this._config.groups.length < 2) return;
    if (this._filterText) return;

    const container = this.renderRoot.querySelector('.groups-tree') as HTMLElement | null;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>('.group-item'));
    if (items.length < 2) return;

    items.forEach(item => {
      const handle = item.querySelector<HTMLElement>('.group-drag-handle');
      if (!handle) return;

      const draggable = Draggable.create(item, {
        type: 'y',
        trigger: handle,
        onPress: () => this._onGroupDragStart(item),
        onDrag: () => this._onGroupDragMove(item),
        onDragEnd: () => this._onGroupDragEnd(item)
      })[0];

      if (draggable) {
        this._groupDraggables.push(draggable);
      }
    });
  }

  private _setupElementDraggables(): void {
    this._elementDraggables.forEach(draggables => draggables.forEach(draggable => draggable.kill()));
    this._elementDraggables.clear();

    if (!this._config?.groups || this._filterText) return;

    const groupItems = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.group-item'));
    
    groupItems.forEach(groupItem => {
      const groupIndexAttr = groupItem.getAttribute('data-group-index');
      if (groupIndexAttr === null) return;
      const groupIndex = Number(groupIndexAttr);
      if (Number.isNaN(groupIndex)) return;

      const list = groupItem.querySelector<HTMLElement>('.elements-list');
      if (!list) return;

      const allItems = Array.from(list.querySelectorAll<HTMLElement>('.element-item'));
      if (allItems.length < 2) return;

      const draggables: Draggable[] = [];

      allItems.forEach(item => {
        const handle = item.querySelector<HTMLElement>('.element-drag-handle');
        if (!handle) return;

        const draggable = Draggable.create(item, {
          type: 'y',
          trigger: handle,
          onPress: () => this._onElementDragStart(groupIndex, item),
          onDrag: () => this._onElementDragMove(item),
          onDragEnd: () => this._onElementDragEnd(item)
        })[0];

        if (draggable) {
          draggables.push(draggable);
        }
      });

      if (draggables.length > 0) {
        this._elementDraggables.set(groupIndex, draggables);
      }
    });
  }

  private _onGroupDragStart(element: HTMLElement): void {
    const dataIndex = Number(element.getAttribute('data-group-index'));
    if (Number.isNaN(dataIndex)) return;

    const container = element.parentElement as HTMLElement | null;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const placeholder = this._createPlaceholder(elementRect.height, 'group');
    container.insertBefore(placeholder, element);

    const originalPosition = container.style.position;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    gsap.set(element, {
      position: 'absolute',
      width: `${elementRect.width}px`,
      left: `${elementRect.left - containerRect.left}px`,
      top: `${elementRect.top - containerRect.top}px`,
      pointerEvents: 'none',
      margin: 0
    });

    this._groupDragContext = {
      initialIndex: dataIndex,
      placeholder,
      container,
      containerOriginalPosition: originalPosition
    };

    this._isDragging = true;
    element.classList.add('dragging');
    gsap.set(element, { zIndex: 1000 });
    gsap.to(element, { duration: 0.12, scale: 1.03, boxShadow: '0px 12px 24px rgba(0,0,0,0.3)' });
  }

  private _onGroupDragMove(element: HTMLElement): void {
    const context = this._groupDragContext;
    if (!context) return;

    const { container, placeholder } = context;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const currentCenter = elementRect.top - containerRect.top + elementRect.height / 2;

    const siblings = Array.from(container.children).filter((child): child is HTMLElement => child !== element);

    let insertBeforeNode: ChildNode | null = null;
    for (const sibling of siblings) {
      if (sibling === placeholder) continue;
      const siblingRect = sibling.getBoundingClientRect();
      const siblingCenter = siblingRect.top - containerRect.top + siblingRect.height / 2;
      if (currentCenter < siblingCenter) {
        insertBeforeNode = sibling;
        break;
      }
    }

    if (insertBeforeNode) {
      if (insertBeforeNode !== placeholder) {
        container.insertBefore(placeholder, insertBeforeNode);
      }
    } else if (placeholder.nextSibling !== null || placeholder.parentElement !== container) {
      container.appendChild(placeholder);
    }
  }

  private _onGroupDragEnd(element: HTMLElement): void {
    const context = this._groupDragContext;
    if (!context) {
      this._resetDraggingStyles(element, { animate: false });
      this._clearDragInlineStyles(element);
      this._isDragging = false;
      return;
    }

    const { initialIndex, placeholder, container, containerOriginalPosition } = context;
    const targetIndex = this._getGroupIndexFromPlaceholder(container, placeholder, element);

    // Restore group to its original position before config update
    // This ensures Lit's reconciliation works correctly during re-render
    const childrenArray = Array.from(container.children);
    let referenceNode: Element | null = null;
    let count = 0;
    for (const child of childrenArray) {
      if (child === element || child === placeholder) continue;
      if ((child as HTMLElement).classList?.contains('group-item')) {
        if (count === initialIndex) {
          referenceNode = child;
          break;
        }
        count++;
      }
    }
    
    // Insert group back at its original position
    if (referenceNode) {
      container.insertBefore(element, referenceNode);
    } else {
      container.appendChild(element);
    }

    this._resetDraggingStyles(element, { animate: false });
    this._clearDragInlineStyles(element);

    placeholder.remove();
    container.style.position = containerOriginalPosition;

    this._groupDragContext = undefined;
    this._isDragging = false;

    if (targetIndex === initialIndex) {
      return;
    }
    this._reorderGroup(initialIndex, targetIndex);
  }

  private _onElementDragStart(groupIndex: number, element: HTMLElement): void {
    const dataIndex = Number(element.getAttribute('data-element-index'));
    if (Number.isNaN(dataIndex)) return;

    const sourceList = element.closest('.elements-list') as HTMLElement | null;
    if (!sourceList) return;

    const listRect = sourceList.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const placeholder = this._createPlaceholder(elementRect.height, 'element');
    sourceList.insertBefore(placeholder, element);

    const originalPosition = sourceList.style.position;
    if (getComputedStyle(sourceList).position === 'static') {
      sourceList.style.position = 'relative';
    }

    gsap.set(element, {
      position: 'absolute',
      width: `${elementRect.width}px`,
      left: `${elementRect.left - listRect.left}px`,
      top: `${elementRect.top - listRect.top}px`,
      pointerEvents: 'none',
      margin: 0
    });

    this._elementDragContext = {
      groupIndex,
      initialIndex: dataIndex,
      placeholder,
      sourceList,
      currentGroupIndex: groupIndex,
      currentInsertionIndex: dataIndex,
      temporaryLists: new Set<HTMLElement>(),
      sourceListOriginalPosition: originalPosition
    };

    this._isDragging = true;
    element.classList.add('dragging');
    gsap.set(element, { zIndex: 1000 });
    gsap.to(element, { duration: 0.12, scale: 1.02, boxShadow: '0px 8px 16px rgba(0,0,0,0.25)' });
  }

  private _onElementDragMove(element: HTMLElement): void {
    const context = this._elementDragContext;
    if (!context) return;

    const dropTarget = this._determineElementDropTarget(element);
    if (!dropTarget) return;

    const { groupIndex, insertionIndex } = dropTarget;
    const groupItem = this.renderRoot.querySelector<HTMLElement>(`.group-item[data-group-index="${groupIndex}"]`);
    if (!groupItem) return;

    let list = groupItem.querySelector<HTMLElement>('.elements-list');
    if (!list) {
      list = groupItem.querySelector<HTMLElement>('.drag-temp-list') as HTMLElement;
      if (!list) {
        list = document.createElement('div');
        list.classList.add('elements-list', 'drag-temp-list');
        list.setAttribute('data-drag-temp', 'true');
        groupItem.appendChild(list);
        context.temporaryLists.add(list);
      }
    }

    if (getComputedStyle(list).position === 'static') {
      list.style.position = 'relative';
    }

    const existingItems = Array.from(list.children).filter(
      (child): child is HTMLElement =>
        child !== element && child !== context.placeholder && child.classList.contains('element-item')
    );

    const referenceNode = existingItems[insertionIndex] ?? null;
    if (referenceNode) {
      list.insertBefore(context.placeholder, referenceNode);
    } else if (context.placeholder.parentElement !== list) {
      list.appendChild(context.placeholder);
    }

    context.currentGroupIndex = groupIndex;
    context.currentInsertionIndex = insertionIndex;
  }

  private _onElementDragEnd(element: HTMLElement): void {
    const context = this._elementDragContext;
    if (!context) {
      this._resetDraggingStyles(element, { animate: false });
      this._clearDragInlineStyles(element);
      this._isDragging = false;
      return;
    }

    const {
      groupIndex: sourceGroupIndex,
      initialIndex,
      placeholder,
      sourceList,
      sourceListOriginalPosition,
      currentGroupIndex,
      currentInsertionIndex,
      temporaryLists
    } = context;

    let targetGroupIndex = currentGroupIndex;
    let targetElementIndex = currentInsertionIndex;

    const placeholderList = placeholder.parentElement as HTMLElement | null;
    if (placeholderList) {
      const listHasTempFlag = placeholderList.getAttribute('data-drag-temp') === 'true';

      const groupItem = placeholderList.closest<HTMLElement>('.group-item');
      const groupIndexAttr = groupItem?.getAttribute('data-group-index');
      if (groupIndexAttr !== null && groupIndexAttr !== undefined) {
        targetGroupIndex = Number(groupIndexAttr);
      }
      targetElementIndex = this._getElementIndexFromPlaceholder(placeholderList, placeholder, element);

      // Remove temporary list if it exists
      if (listHasTempFlag) {
        placeholderList.remove();
      }
    }
    
    // Restore element to its original position in the source list
    // This ensures Lit's reconciliation works correctly during re-render
    const childrenArray = Array.from(sourceList.children);
    const currentElementIndex = childrenArray.indexOf(element);
    
    // Find the correct reference node for the original position
    let referenceNode: Element | null = null;
    let count = 0;
    for (const child of childrenArray) {
      if (child === element || child === placeholder) continue;
      if ((child as HTMLElement).classList?.contains('element-item')) {
        if (count === initialIndex) {
          referenceNode = child;
          break;
        }
        count++;
      }
    }
    
    // Insert element back at its original position
    if (referenceNode) {
      sourceList.insertBefore(element, referenceNode);
    } else {
      sourceList.appendChild(element);
    }

    this._resetDraggingStyles(element, { animate: false });

    placeholder.remove();
    this._clearDragInlineStyles(element);

    sourceList.style.position = sourceListOriginalPosition;

    temporaryLists.forEach(tempList => {
      if (!tempList.querySelector('.element-item')) {
        tempList.remove();
      }
    });

    this._elementDragContext = undefined;
    this._isDragging = false;

    if (Number.isNaN(targetGroupIndex)) {
      return;
    }

    if (targetGroupIndex === sourceGroupIndex && targetElementIndex === initialIndex) {
      return;
    }

    this._moveElementToGroup(sourceGroupIndex, targetGroupIndex, initialIndex, targetElementIndex);
  }

  private _createPlaceholder(height: number, type: 'group' | 'element'): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.classList.add('drag-placeholder');
    placeholder.classList.add(type === 'group' ? 'group-placeholder' : 'element-placeholder');
    placeholder.style.height = `${height}px`;
    return placeholder;
  }

  private _getGroupIndexFromPlaceholder(
    container: HTMLElement,
    placeholder: HTMLElement,
    draggedElement?: HTMLElement
  ): number {
    let index = 0;
    for (const child of Array.from(container.children)) {
      if (child === placeholder) {
        return index;
      }
      if (draggedElement && child === draggedElement) {
        continue;
      }
      if ((child as HTMLElement).classList?.contains('group-item')) {
        index++;
      }
    }
    return index;
  }

  private _getElementIndexFromPlaceholder(
    list: HTMLElement | null,
    placeholder: HTMLElement,
    draggedElement?: HTMLElement
  ): number {
    if (!list) return 0;
    let index = 0;
    for (const child of Array.from(list.children)) {
      if (child === placeholder) {
        break;
      }
      if (draggedElement && child === draggedElement) {
        continue;
      }
      if ((child as HTMLElement).classList?.contains('element-item')) {
        index++;
      }
    }
    return index;
  }

  private _clearDragInlineStyles(element: HTMLElement): void {
    element.style.position = '';
    element.style.width = '';
    element.style.left = '';
    element.style.top = '';
    element.style.margin = '';
    element.style.pointerEvents = '';
  }

  private _resetDraggingStyles(element: HTMLElement, options: { animate?: boolean } = {}): void {
    const { animate = false } = options;
    element.classList.remove('dragging');
    gsap.killTweensOf(element);

    if (animate) {
      gsap.to(element, {
        duration: 0.18,
        y: 0,
        scale: 1,
        boxShadow: '0px 0px 0px rgba(0,0,0,0)',
        onComplete: () => {
          gsap.set(element, { clearProps: 'transform,boxShadow,zIndex' });
        }
      });
      return;
    }

    gsap.set(element, { clearProps: 'transform,boxShadow,zIndex' });
  }

  private _reorderGroup(fromIndex: number, toIndex: number): void {
    if (!this._config?.groups) return;

    const groupCount = this._config.groups.length;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= groupCount || toIndex >= groupCount) return;

    if (fromIndex === toIndex) return;

    const newConfig = JSON.parse(JSON.stringify(this._config)) as LcarsCardConfig;
    const previousGroups = this._config.groups;

    const [movedGroup] = newConfig.groups.splice(fromIndex, 1);
    newConfig.groups.splice(toIndex, 0, movedGroup);

    this._config = newConfig;
    this._updateStateAfterGroupMove(fromIndex, toIndex, previousGroups, newConfig.groups);

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _updateStateAfterGroupMove(
    fromIndex: number,
    toIndex: number,
    previousGroups: LcarsCardConfig['groups'],
    nextGroups: LcarsCardConfig['groups']
  ): void {
    if (!previousGroups || !nextGroups) return;

    const collapsedIds = new Set(
      [...this._collapsedGroups]
        .map(index => previousGroups[index]?.group_id)
        .filter((id): id is string => typeof id === 'string')
    );

    const updatedCollapsed = new Set<number>();
    nextGroups.forEach((group, index) => {
      if (group && collapsedIds.has(group.group_id)) {
        updatedCollapsed.add(index);
      }
    });
    this._collapsedGroups = updatedCollapsed;

    if (this._selectedElement) {
      const newGroupIndex = this._computeIndexAfterMove(this._selectedElement.groupIndex, fromIndex, toIndex);
      this._selectedElement = {
        groupIndex: newGroupIndex,
        elementIndex: this._selectedElement.elementIndex
      };
    }

    if (this._editingGroupIndex !== undefined) {
      this._editingGroupIndex = this._computeIndexAfterMove(this._editingGroupIndex, fromIndex, toIndex);
    }

    if (this._editingElementId) {
      const newGroupIndex = this._computeIndexAfterMove(this._editingElementId.groupIndex, fromIndex, toIndex);
      this._editingElementId = {
        groupIndex: newGroupIndex,
        elementIndex: this._editingElementId.elementIndex
      };
    }
  }

  private _computeIndexAfterMove(index: number, fromIndex: number, toIndex: number): number {
    if (index === fromIndex) {
      return toIndex;
    }

    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
      return index - 1;
    }

    if (toIndex < fromIndex && index >= toIndex && index < fromIndex) {
      return index + 1;
    }

    return index;
  }

  private _reorderElement(groupIndex: number, fromIndex: number, toIndex: number): void {
    if (!this._config?.groups) return;
    const group = this._config.groups[groupIndex];
    if (!group || !group.elements) return;

    const elementCount = group.elements.length;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= elementCount || toIndex >= elementCount) return;
    if (fromIndex === toIndex) return;

    const newConfig = JSON.parse(JSON.stringify(this._config)) as LcarsCardConfig;
    const newGroup = newConfig.groups[groupIndex];
    if (!newGroup?.elements) return;

    const [movedElement] = newGroup.elements.splice(fromIndex, 1);
    newGroup.elements.splice(toIndex, 0, movedElement);

    this._config = newConfig;
    this._updateStateAfterElementMove(groupIndex, fromIndex, toIndex);

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _applyReferenceReplacements(
    config: LcarsCardConfig,
    replacements: Array<{ from: string; to: string }>
  ): void {
    const sanitized = replacements.filter(
      (replacement) => replacement.from && replacement.to && replacement.from !== replacement.to
    );
    if (!sanitized.length) {
      return;
    }

    const traverse = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = traverse(value[i]);
        }
        return value;
      }

      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        Object.keys(record).forEach((key) => {
          record[key] = traverse(record[key]);
        });
        return record;
      }

      if (typeof value === 'string') {
        for (const replacement of sanitized) {
          if (value === replacement.from) {
            return replacement.to;
          }
        }
        return value;
      }

      return value;
    };

    traverse(config as unknown as Record<string, unknown>);
  }

  private _moveElementToGroup(
    fromGroupIndex: number,
    toGroupIndex: number,
    fromIndex: number,
    toIndex: number
  ): void {
    if (!this._config?.groups) return;

    const sourceGroupId = this._config.groups[fromGroupIndex]?.group_id;
    const destinationGroupId = this._config.groups[toGroupIndex]?.group_id;
    const movingElementId = this._config.groups[fromGroupIndex]?.elements?.[fromIndex]?.id;

    if (fromGroupIndex === toGroupIndex) {
      this._reorderElement(fromGroupIndex, fromIndex, toIndex);
      return;
    }

    const newConfig = JSON.parse(JSON.stringify(this._config)) as LcarsCardConfig;
    const sourceGroup = newConfig.groups[fromGroupIndex];
    const destinationGroup = newConfig.groups[toGroupIndex];

    if (!sourceGroup?.elements || !destinationGroup) return;

    const [movedElement] = sourceGroup.elements.splice(fromIndex, 1);
    if (!movedElement) return;

    if (!destinationGroup.elements) {
      destinationGroup.elements = [];
    }

    const insertionIndex = Math.max(0, Math.min(toIndex, destinationGroup.elements.length));
    destinationGroup.elements.splice(insertionIndex, 0, movedElement);

    if (sourceGroupId && destinationGroupId && movingElementId) {
      this._applyReferenceReplacements(newConfig, [
        {
          from: `${sourceGroupId}.${movingElementId}`,
          to: `${destinationGroupId}.${movingElementId}`
        }
      ]);
    }

    this._config = newConfig;
    this._updateStateAfterElementTransfer(fromGroupIndex, toGroupIndex, fromIndex, insertionIndex);

    if (this._collapsedGroups.has(toGroupIndex)) {
      const updatedCollapsed = new Set(this._collapsedGroups);
      updatedCollapsed.delete(toGroupIndex);
      this._collapsedGroups = updatedCollapsed;
    }

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _updateStateAfterElementMove(groupIndex: number, fromIndex: number, toIndex: number): void {
    if (this._selectedElement?.groupIndex === groupIndex) {
      const newElementIndex = this._computeIndexAfterMove(this._selectedElement.elementIndex, fromIndex, toIndex);
      this._selectedElement = {
        groupIndex,
        elementIndex: newElementIndex
      };
    }

    if (this._editingElementId?.groupIndex === groupIndex) {
      const newEditingIndex = this._computeIndexAfterMove(this._editingElementId.elementIndex, fromIndex, toIndex);
      this._editingElementId = {
        groupIndex,
        elementIndex: newEditingIndex
      };
    }
  }

  private _updateStateAfterElementTransfer(
    fromGroupIndex: number,
    toGroupIndex: number,
    fromIndex: number,
    toIndex: number
  ): void {
    if (this._selectedElement) {
      if (this._selectedElement.groupIndex === fromGroupIndex) {
        if (this._selectedElement.elementIndex === fromIndex) {
          this._selectedElement = { groupIndex: toGroupIndex, elementIndex: toIndex };
        } else if (this._selectedElement.elementIndex > fromIndex) {
          this._selectedElement = {
            groupIndex: fromGroupIndex,
            elementIndex: this._selectedElement.elementIndex - 1
          };
        }
      } else if (
        this._selectedElement.groupIndex === toGroupIndex &&
        this._selectedElement.elementIndex >= toIndex
      ) {
        this._selectedElement = {
          groupIndex: toGroupIndex,
          elementIndex: this._selectedElement.elementIndex + 1
        };
      }
    }

    if (this._editingElementId) {
      if (this._editingElementId.groupIndex === fromGroupIndex) {
        if (this._editingElementId.elementIndex === fromIndex) {
          this._editingElementId = { groupIndex: toGroupIndex, elementIndex: toIndex };
        } else if (this._editingElementId.elementIndex > fromIndex) {
          this._editingElementId = {
            groupIndex: fromGroupIndex,
            elementIndex: this._editingElementId.elementIndex - 1
          };
        }
      } else if (
        this._editingElementId.groupIndex === toGroupIndex &&
        this._editingElementId.elementIndex >= toIndex
      ) {
        this._editingElementId = {
          groupIndex: toGroupIndex,
          elementIndex: this._editingElementId.elementIndex + 1
        };
      }
    }
  }

  private _determineElementDropTarget(element: HTMLElement): { groupIndex: number; insertionIndex: number } | undefined {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const groupItems = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.group-item'));
    let bestMatch: { groupIndex: number; groupItem: HTMLElement; distance: number } | undefined;

    for (const groupItem of groupItems) {
      const indexAttr = groupItem.getAttribute('data-group-index');
      if (indexAttr === null) continue;
      const groupIndex = Number(indexAttr);
      if (Number.isNaN(groupIndex)) continue;

      const groupRect = groupItem.getBoundingClientRect();
      if (centerX < groupRect.left || centerX > groupRect.right) continue;

      let distance = 0;
      if (centerY < groupRect.top) {
        distance = groupRect.top - centerY;
      } else if (centerY > groupRect.bottom) {
        distance = centerY - groupRect.bottom;
      }

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { groupIndex, groupItem, distance };
        if (distance === 0) {
          break;
        }
      }
    }

    if (!bestMatch) return undefined;

    const { groupIndex, groupItem } = bestMatch;
    const list = groupItem.querySelector<HTMLElement>('.elements-list');

    if (!list) {
      const elementsLength = this._config?.groups?.[groupIndex]?.elements?.length ?? 0;
      return { groupIndex, insertionIndex: elementsLength };
    }

    const siblingItems = Array.from(list.querySelectorAll<HTMLElement>('.element-item')).filter(
      item => item !== element
    );
    const insertionIndex = this._calculateInsertionIndex(centerY, siblingItems);
    return { groupIndex, insertionIndex };
  }

  private _calculateInsertionIndex(positionY: number, items: HTMLElement[]): number {
    if (items.length === 0) {
      return 0;
    }

    let index = 0;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      if (positionY > center) {
        index++;
      } else {
        break;
      }
    }

    return index;
  }

  private _preventHandleInteraction(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
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
            <div class="group-item" data-group-index=${groupIndex}>
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
                    icon="mdi:drag-vertical"
                    class="drag-handle group-drag-handle"
                    title="Drag group to reorder"
                    @click=${this._preventHandleInteraction}
                  ></ha-icon>
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
                        data-group-index=${groupIndex}
                        data-element-index=${elementIndex}
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
                          <ha-icon
                            icon="mdi:drag-vertical"
                            class="drag-handle element-drag-handle"
                            title="Drag element to reorder"
                            @click=${this._preventHandleInteraction}
                          ></ha-icon>
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

    const oldGroupId = this._config.groups[this._editingGroupIndex].group_id;
    const newConfig = JSON.parse(JSON.stringify(this._config));
    const targetGroup = newConfig.groups[this._editingGroupIndex];
    targetGroup.group_id = newName;

    const replacements: Array<{ from: string; to: string }> = [{ from: oldGroupId, to: newName }];
    (targetGroup.elements || []).forEach((element: ElementConfig) => {
      replacements.push({
        from: `${oldGroupId}.${element.id}`,
        to: `${newName}.${element.id}`
      });
    });

    this._applyReferenceReplacements(newConfig, replacements);

    this._config = newConfig;
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

    const oldId = this._config.groups[groupIndex].elements[elementIndex].id;
    const groupId = this._config.groups[groupIndex].group_id;
    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig.groups[groupIndex].elements[elementIndex].id = newId;

    this._applyReferenceReplacements(newConfig, [
      {
        from: `${groupId}.${oldId}`,
        to: `${groupId}.${newId}`
      }
    ]);

    this._config = newConfig;
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
