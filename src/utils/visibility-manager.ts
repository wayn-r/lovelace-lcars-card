import { VisibilityTriggerConfig, TargetConfig } from '../types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { animationManager } from './animation.js';

export interface VisibilityState {
  visible: boolean;
  animated?: boolean;
}

export interface TriggerState {
  hovered: boolean;
  clicked: boolean;
  hoverTimeoutId?: ReturnType<typeof setTimeout>;
}

export class VisibilityManager {
  private elementVisibility = new Map<string, VisibilityState>();
  private groupVisibility = new Map<string, VisibilityState>();
  private triggerStates = new Map<string, TriggerState>();
  private visibilityTriggers: VisibilityTriggerConfig[] = [];
  private elementListeners = new Map<string, { element: Element; listeners: Array<{ event: string; handler: EventListener }> }>();
  private requestUpdateCallback?: () => void;

  constructor(requestUpdateCallback?: () => void) {
    this.requestUpdateCallback = requestUpdateCallback;
  }

  /**
   * Initialize visibility states for all elements and groups
   */
  initializeVisibility(elementIds: string[], groupIds: string[]): void {
    // Initialize all elements as visible by default
    elementIds.forEach(id => {
      if (!this.elementVisibility.has(id)) {
        this.elementVisibility.set(id, { visible: true });
      }
    });

    // Initialize all groups as visible by default
    groupIds.forEach(id => {
      if (!this.groupVisibility.has(id)) {
        this.groupVisibility.set(id, { visible: true });
      }
    });

    // Note: Initial visibility states will be applied after triggers are registered
  }

  /**
   * Apply initial visibility states based on trigger configurations
   * This should be called after registerVisibilityTriggers()
   */
  applyInitialVisibilityStates(): void {
    console.log('[VisibilityManager] Applying initial visibility states...');
    console.log('[VisibilityManager] Found', this.visibilityTriggers.length, 'visibility triggers');
    
    // Groups that have show triggers should start hidden
    this.visibilityTriggers.forEach(trigger => {
      console.log('[VisibilityManager] Processing trigger:', trigger);
      if (trigger.action === 'show' && trigger.targets) {
        trigger.targets.forEach(target => {
          console.log('[VisibilityManager] Hiding target initially:', target.type, target.id);
          if (target.type === 'group') {
            this.setGroupVisibility(target.id, false, false);
          } else if (target.type === 'element') {
            this.setElementVisibility(target.id, false, false);
          }
        });
      }
    });
    
    console.log('[VisibilityManager] Group visibility states:', Array.from(this.groupVisibility.entries()));
    console.log('[VisibilityManager] Element visibility states:', Array.from(this.elementVisibility.entries()));
  }

  /**
   * Register visibility triggers from element configurations
   */
  registerVisibilityTriggers(triggers: VisibilityTriggerConfig[]): void {
    this.visibilityTriggers = [...this.visibilityTriggers, ...triggers];
  }

  /**
   * Clear all registered triggers (useful for config changes)
   */
  clearTriggers(): void {
    this.visibilityTriggers = [];
    this.cleanupEventListeners();
  }

  /**
   * Set up event listeners for trigger sources
   */
  setupEventListeners(getShadowElement: (id: string) => Element | null): void {
    console.log('[VisibilityManager] Setting up event listeners...');
    this.cleanupEventListeners();

    this.visibilityTriggers.forEach((trigger, index) => {
      console.log(`[VisibilityManager] Setting up trigger ${index}:`, trigger);
      const sourceId = trigger.trigger_source.element_id_ref;
      const event = trigger.trigger_source.event;
      
      // Handle "self" reference by using the sourceId as-is
      const actualSourceId = sourceId === 'self' ? sourceId : sourceId;
      
      console.log(`[VisibilityManager] Looking for element with ID: ${actualSourceId}`);
      const element = getShadowElement(actualSourceId);
      if (!element) {
        console.warn(`[VisibilityManager] Visibility trigger source element not found: ${actualSourceId}`);
        // Try without CSS escaping in case that's the issue
        const fallbackElement = getShadowElement(actualSourceId.replace(/\./g, '\\.'));
        if (fallbackElement) {
          console.log(`[VisibilityManager] Found element with fallback selector: ${actualSourceId}`);
        } else {
          console.warn(`[VisibilityManager] Element still not found with fallback selector`);
        }
        return;
      }

      console.log(`[VisibilityManager] Found element for trigger:`, element);
      
      // Initialize trigger state
      if (!this.triggerStates.has(actualSourceId)) {
        this.triggerStates.set(actualSourceId, { hovered: false, clicked: false });
      }
      
      const listeners: Array<{ event: string; handler: EventListener }> = [];
      
      if (event === 'hover') {
        const mouseEnterHandler = () => {
          console.log(`[VisibilityManager] Mouse enter on ${actualSourceId}`);
          this.handleHoverEnter(trigger, actualSourceId);
        };
        const mouseLeaveHandler = () => {
          console.log(`[VisibilityManager] Mouse leave on ${actualSourceId}`);
          this.handleHoverLeave(trigger, actualSourceId);
        };
        
        element.addEventListener('mouseenter', mouseEnterHandler);
        element.addEventListener('mouseleave', mouseLeaveHandler);
        listeners.push({ event: 'mouseenter', handler: mouseEnterHandler });
        listeners.push({ event: 'mouseleave', handler: mouseLeaveHandler });
        console.log(`[VisibilityManager] Added hover listeners to ${actualSourceId}`);
      } else if (event === 'click') {
        const clickHandler = (e: Event) => {
          console.log(`[VisibilityManager] Click on ${actualSourceId}`);
          this.handleClick(trigger, actualSourceId, e);
        };
        
        element.addEventListener('click', clickHandler);
        listeners.push({ event: 'click', handler: clickHandler });
        console.log(`[VisibilityManager] Added click listener to ${actualSourceId}`);
      }
      
      this.elementListeners.set(actualSourceId, { element, listeners });
    });
    
    console.log(`[VisibilityManager] Set up ${this.elementListeners.size} element listeners`);
    
    // Set up global click listener for click-outside behavior
    document.addEventListener('click', this.handleGlobalClick.bind(this));
  }

  private handleHoverEnter(trigger: VisibilityTriggerConfig, sourceId: string): void {
    const triggerState = this.triggerStates.get(sourceId);
    if (!triggerState) return;

    triggerState.hovered = true;

    // Clear any existing timeout
    if (triggerState.hoverTimeoutId) {
      clearTimeout(triggerState.hoverTimeoutId);
      triggerState.hoverTimeoutId = undefined;
    }

    const mode = trigger.hover_options?.mode || 'show_on_enter_hide_on_leave';
    
    if (mode === 'show_on_enter_hide_on_leave') {
      if (trigger.action === 'show') {
        this.executeAction(trigger);
      }
    } else if (mode === 'toggle_on_enter_hide_on_leave') {
      if (trigger.action === 'toggle') {
        this.executeAction(trigger);
      }
    }
  }

  private handleHoverLeave(trigger: VisibilityTriggerConfig, sourceId: string): void {
    const triggerState = this.triggerStates.get(sourceId);
    if (!triggerState) return;

    triggerState.hovered = false;

    const mode = trigger.hover_options?.mode || 'show_on_enter_hide_on_leave';
    const hideDelay = trigger.hover_options?.hide_delay || 0;

    if (mode === 'show_on_enter_hide_on_leave') {
      if (trigger.action === 'show') {
        // Execute hide action with delay
        if (hideDelay > 0) {
          triggerState.hoverTimeoutId = setTimeout(() => {
            this.executeHideAction(trigger);
          }, hideDelay);
        } else {
          this.executeHideAction(trigger);
        }
      }
    } else if (mode === 'toggle_on_enter_hide_on_leave') {
      // Hide on leave for toggle mode
      if (hideDelay > 0) {
        triggerState.hoverTimeoutId = setTimeout(() => {
          this.executeHideAction(trigger);
        }, hideDelay);
      } else {
        this.executeHideAction(trigger);
      }
    }
  }

  private handleClick(trigger: VisibilityTriggerConfig, sourceId: string, event: Event): void {
    event.stopPropagation();
    
    const triggerState = this.triggerStates.get(sourceId);
    if (!triggerState) return;

    triggerState.clicked = true;
    this.executeAction(trigger);
  }

  private handleGlobalClick(event: Event): void {
    // Handle revert_on_click_outside for click triggers
    this.visibilityTriggers.forEach(trigger => {
      if (trigger.trigger_source.event === 'click' && 
          trigger.click_options?.revert_on_click_outside) {
        
        const sourceElement = this.elementListeners.get(trigger.trigger_source.element_id_ref)?.element;
        if (sourceElement && !sourceElement.contains(event.target as Node)) {
          // Click was outside the trigger source, revert visibility
          this.executeHideAction(trigger);
        }
      }
    });
  }

  private executeAction(trigger: VisibilityTriggerConfig): void {
    console.log('[VisibilityManager] Executing action:', trigger.action, 'for targets:', trigger.targets);
    if (!trigger.targets) return;

    trigger.targets.forEach(target => {
      console.log('[VisibilityManager] Processing target:', target.type, target.id);
      if (trigger.action === 'show') {
        this.showTarget(target);
      } else if (trigger.action === 'hide') {
        this.hideTarget(target);
      } else if (trigger.action === 'toggle') {
        this.toggleTarget(target);
      }
    });

    // Trigger re-render
    console.log('[VisibilityManager] Triggering re-render after action execution');
    this.requestUpdateCallback?.();
  }

  private executeHideAction(trigger: VisibilityTriggerConfig): void {
    if (!trigger.targets) return;

    trigger.targets.forEach(target => {
      this.hideTarget(target);
    });

    this.requestUpdateCallback?.();
  }

  private showTarget(target: TargetConfig): void {
    if (target.type === 'group') {
      this.setGroupVisibility(target.id, true, true);
    } else if (target.type === 'element') {
      this.setElementVisibility(target.id, true, true);
    }
  }

  private hideTarget(target: TargetConfig): void {
    if (target.type === 'group') {
      this.setGroupVisibility(target.id, false, true);
    } else if (target.type === 'element') {
      this.setElementVisibility(target.id, false, true);
    }
  }

  private toggleTarget(target: TargetConfig): void {
    if (target.type === 'group') {
      const current = this.getGroupVisibility(target.id);
      this.setGroupVisibility(target.id, !current, true);
    } else if (target.type === 'element') {
      const current = this.getElementVisibility(target.id);
      this.setElementVisibility(target.id, !current, true);
    }
  }

  /**
   * Set element visibility
   */
  setElementVisibility(elementId: string, visible: boolean, animated: boolean = false): void {
    this.elementVisibility.set(elementId, { visible, animated });
  }

  /**
   * Set group visibility
   */
  setGroupVisibility(groupId: string, visible: boolean, animated: boolean = false): void {
    this.groupVisibility.set(groupId, { visible, animated });
  }

  /**
   * Get element visibility
   */
  getElementVisibility(elementId: string): boolean {
    const visible = this.elementVisibility.get(elementId)?.visible ?? true;
    console.log(`[VisibilityManager] getElementVisibility(${elementId}): ${visible}`);
    return visible;
  }

  /**
   * Get group visibility
   */
  getGroupVisibility(groupId: string): boolean {
    const visible = this.groupVisibility.get(groupId)?.visible ?? true;
    console.log(`[VisibilityManager] getGroupVisibility(${groupId}): ${visible}`);
    return visible;
  }

  /**
   * Check if an element should be rendered based on its own visibility and its group's visibility
   */
  shouldElementBeVisible(elementId: string, groupId: string): boolean {
    const elementVisible = this.getElementVisibility(elementId);
    const groupVisible = this.getGroupVisibility(groupId);
    const result = elementVisible && groupVisible;
    console.log(`[VisibilityManager] shouldElementBeVisible(${elementId}, ${groupId}): element=${elementVisible}, group=${groupVisible}, result=${result}`);
    return result;
  }

  /**
   * Cleanup event listeners
   */
  private cleanupEventListeners(): void {
    this.elementListeners.forEach(({ element, listeners }) => {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.elementListeners.clear();

    // Remove global click listener
    document.removeEventListener('click', this.handleGlobalClick.bind(this));
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.cleanupEventListeners();
    
    // Clear any pending timeouts
    this.triggerStates.forEach(state => {
      if (state.hoverTimeoutId) {
        clearTimeout(state.hoverTimeoutId);
      }
    });
    
    this.elementVisibility.clear();
    this.groupVisibility.clear();
    this.triggerStates.clear();
    this.visibilityTriggers = [];
  }
} 