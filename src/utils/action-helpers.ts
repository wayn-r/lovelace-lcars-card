import { Action } from '../types.js';
import { HomeAssistant, handleAction } from 'custom-card-helpers';

/**
 * Wrapper function for handling Home Assistant actions using the unified Action interface
 */
export async function handleHassAction(
  action: Action,
  element: HTMLElement,
  hass: HomeAssistant,
  actionType: 'tap' | 'hold' | 'double_tap' = 'tap'
): Promise<void> {
  
  // Convert unified Action to Home Assistant action config format
  const actionConfig: any = {
    tap_action: {
      action: action.action,
      service: action.service,
      service_data: action.service_data,
      target: action.target,
      navigation_path: action.navigation_path,
      url_path: action.url_path,
      entity: action.entity,
      // Include custom properties for pass-through
      target_element_ref: action.target_element_ref,
      state: action.state,
      states: action.states,
      actions: action.actions
    },
    confirmation: action.confirmation
  };
  
  // Always mirror entity to the top-level for helpers that expect it there
  if (action.entity) {
    actionConfig.entity = action.entity;
  }
  
  // For toggle and more-info actions, ensure entity is available as fallback
  if ((action.action === 'toggle' || action.action === 'more-info') && !action.entity) {
    actionConfig.tap_action.entity = element.id;
    actionConfig.entity = element.id;
  }
  
  return handleAction(element, hass, actionConfig, actionType);
}

/**
 * Check if an action is a custom (non-Home Assistant) action
 */
export function isCustomAction(action: Action): boolean {
  return ['set_state', 'toggle_state'].includes(action.action);
}

/**
 * Validate that an action has the required properties for its type
 */
export function validateAction(action: Action): string[] {
  const errors: string[] = [];
  
  switch (action.action) {
    case 'call-service':
      if (!action.service) errors.push('service is required for call-service action');
      break;
    case 'navigate':
      if (!action.navigation_path) errors.push('navigation_path is required for navigate action');
      break;
    case 'url':
      if (!action.url_path) errors.push('url_path is required for url action');
      break;
    case 'toggle':
    case 'more-info':
      if (!action.entity) errors.push('entity is required for toggle/more-info action');
      break;
    case 'set_state':
      if (!action.target_element_ref) errors.push('target_element_ref is required for set_state action');
      if (!action.state) errors.push('state is required for set_state action');
      break;
    case 'toggle_state':
      if (!action.target_element_ref) errors.push('target_element_ref is required for toggle_state action');
      if (!action.states || !Array.isArray(action.states) || action.states.length < 2) {
        errors.push('states array with at least 2 states is required for toggle_state action');
      }
      break;
  }
  
  return errors;
} 