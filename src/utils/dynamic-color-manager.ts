import { HomeAssistant } from 'custom-card-helpers';
import { animationManager } from './animation.js';
import { Group } from '../layout/engine.js';

/**
 * Manages dynamic color system operations including cache invalidation,
 * entity monitoring cleanup, and refresh scheduling
 */
export class DynamicColorManager {
  private dynamicColorCheckScheduled: boolean = false;
  private refreshTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Clear all dynamic color system caches and entity monitoring
   */
  public clearAllCaches(layoutGroups: Group[]): void {
    // Clear element-level entity monitoring and animation state
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        this.clearElementState(element);
      }
    }

    // Clear global animation manager caches
    animationManager.invalidateDynamicColorCache();
  }

  /**
   * Clear state for a specific element
   */
  private clearElementState(element: any): void {
    // Clear entity monitoring and animation state
    if (typeof element.clearMonitoredEntities === 'function') {
      element.clearMonitoredEntities();
    }
    
    if (typeof element.cleanupAnimations === 'function') {
      element.cleanupAnimations();
    }
    
    // Clear from animation manager directly
    animationManager.cleanupElementAnimationTracking(element.id);
  }

  /**
   * Check for dynamic color changes with throttling to prevent excessive checks
   */
  public checkDynamicColorChanges(
    layoutGroups: Group[],
    hass: HomeAssistant,
    refreshCallback: () => void,
    checkDelay: number = 25
  ): void {
    if (this.dynamicColorCheckScheduled) {
      return;
    }
    
    this.dynamicColorCheckScheduled = true;
    
    // Clear any existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    this.refreshTimeout = setTimeout(() => {
      this.dynamicColorCheckScheduled = false;
      this.refreshTimeout = undefined;
      
      const needsRefresh = this.performDynamicColorCheck(layoutGroups, hass);
      
      if (needsRefresh) {
        refreshCallback();
      }
    }, checkDelay);
  }

  /**
   * Perform the actual dynamic color check
   */
  private performDynamicColorCheck(layoutGroups: Group[], hass: HomeAssistant): boolean {
    let needsRefresh = false;
    let elementsChecked = 0;
    
    // Collect all elements that need entity change checks
    const elementsToCheck = this.collectElementsForChecking(layoutGroups);
    
    // Check each element for entity changes
    for (const { element } of elementsToCheck) {
      elementsChecked++;
      if (this.checkElementEntityChanges(element, hass)) {
        needsRefresh = true;
        // Continue checking all elements to ensure comprehensive updates
      }
    }
    
    return needsRefresh;
  }

  /**
   * Collect elements that need to be checked for entity changes
   */
  private collectElementsForChecking(layoutGroups: Group[]): Array<{ element: any }> {
    const elementsToCheck: Array<{ element: any }> = [];
    
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        elementsToCheck.push({ element });
      }
    }
    
    return elementsToCheck;
  }

  /**
   * Check if an element has entity changes that require refresh
   */
  private checkElementEntityChanges(element: any, hass: HomeAssistant): boolean {
    try {
      return typeof element.checkEntityChanges === 'function' 
        ? element.checkEntityChanges(hass)
        : false;
    } catch (error) {
      console.warn('Error checking entity changes for element:', element.id, error);
      return false;
    }
  }

  /**
   * Schedule a dynamic color refresh with a delay
   */
  public scheduleDynamicColorRefresh(
    hass: HomeAssistant,
    containerRect: DOMRect | undefined,
    checkCallback: () => void,
    refreshCallback: () => void,
    delay: number = 50
  ): void {
    setTimeout(() => {
      if (hass && containerRect) {
        checkCallback();
        refreshCallback();
      }
    }, delay);
  }

  /**
   * Extract entity IDs that an element is using for dynamic colors
   */
  public extractEntityIdsFromElement(element: any): Set<string> {
    const entityIds = new Set<string>();
    const props = element.props;
    
    if (!props) {
      return entityIds;
    }
    
    // Check dynamic color properties
    this.extractFromColorProperty(props.fill, entityIds);
    this.extractFromColorProperty(props.stroke, entityIds);
    this.extractFromColorProperty(props.textColor, entityIds);
    
    // Check button color properties
    if (props.button) {
      this.extractFromColorProperty(props.button.hover_fill, entityIds);
      this.extractFromColorProperty(props.button.active_fill, entityIds);
      this.extractFromColorProperty(props.button.hover_text_color, entityIds);
      this.extractFromColorProperty(props.button.active_text_color, entityIds);
    }
    
    return entityIds;
  }

  /**
   * Extract entity ID from a color property if it's a dynamic color config
   */
  private extractFromColorProperty(colorProp: any, entityIds: Set<string>): void {
    if (colorProp && typeof colorProp === 'object' && colorProp.entity) {
      entityIds.add(colorProp.entity);
    }
  }

  /**
   * Check if there are significant entity changes that might affect layout
   */
  public hasSignificantEntityChanges(
    layoutGroups: Group[],
    lastHassStates: { [entityId: string]: any } | undefined,
    currentHass: HomeAssistant
  ): boolean {
    if (!lastHassStates) {
      return false;
    }
    
    // Check for entity state changes that might affect text content or dimensions
    for (const group of layoutGroups) {
      for (const element of group.elements) {
        if (this.elementHasSignificantChanges(element, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a specific element has significant changes
   */
  private elementHasSignificantChanges(
    element: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const props = element.props;
    
    // Check for text elements with entity-based content
    if (this.hasEntityBasedTextChanges(props, lastHassStates, currentHass)) {
      return true;
    }
    
    // Check for dynamic color changes that might affect entity-based colors
    if (this.hasEntityBasedColorChanges(props, lastHassStates, currentHass)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check for entity-based text content changes
   */
  private hasEntityBasedTextChanges(
    props: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    if (props.text && typeof props.text === 'string') {
      return this.checkEntityReferencesInText(props.text, lastHassStates, currentHass);
    }
    return false;
  }

  /**
   * Check for entity-based color changes
   */
  private hasEntityBasedColorChanges(
    props: any,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const colorProps = [props.fill, props.stroke, props.textColor];
    
    for (const colorProp of colorProps) {
      if (this.isEntityBasedColor(colorProp)) {
        if (this.checkEntityReferencesInText(colorProp, lastHassStates, currentHass)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a color property is entity-based
   */
  private isEntityBasedColor(colorProp: any): boolean {
    return typeof colorProp === 'string' && colorProp.includes('states[');
  }

  /**
   * Check entity references in text/color strings
   */
  private checkEntityReferencesInText(
    text: string,
    lastHassStates: { [entityId: string]: any },
    currentHass: HomeAssistant
  ): boolean {
    const entityMatches = text.match(/states\['([^']+)'\]/g);
    if (!entityMatches) return false;
    
    for (const match of entityMatches) {
      const entityIdMatch = match.match(/states\['([^']+)'\]/);
      if (entityIdMatch) {
        const entityId = entityIdMatch[1];
        const oldState = lastHassStates[entityId]?.state;
        const newState = currentHass.states[entityId]?.state;
        
        if (oldState !== newState) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Cleanup any pending operations
   */
  public cleanup(): void {
    this.dynamicColorCheckScheduled = false;
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
  }
} 