import { Action, HassAction, CustomAction } from '../types.js';
import { HomeAssistant, handleAction } from 'custom-card-helpers';

export class ActionProcessor {
  // --- Type guards -----------------------------------------------------------
  static actionIsCustom(action: Action): action is CustomAction {
    return action.action === 'set_state' || action.action === 'toggle_state';
  }

  static isHassAction(action: Action): action is HassAction {
    return (
      action.action === 'call-service' ||
      action.action === 'navigate' ||
      action.action === 'url' ||
      action.action === 'toggle' ||
      action.action === 'more-info' ||
      action.action === 'none'
    );
  }

  static isCallService(action: Action): action is import('../types.js').CallServiceAction {
    return action.action === 'call-service';
  }

  static isNavigate(action: Action): action is import('../types.js').NavigateAction {
    return action.action === 'navigate';
  }

  static isUrl(action: Action): action is import('../types.js').UrlAction {
    return action.action === 'url';
  }

  static isToggle(action: Action): action is import('../types.js').ToggleAction {
    return action.action === 'toggle';
  }

  static isMoreInfo(action: Action): action is import('../types.js').MoreInfoAction {
    return action.action === 'more-info';
  }

  static isNone(action: Action): action is import('../types.js').NoneAction {
    return action.action === 'none';
  }

  static isSetState(action: Action): action is import('../types.js').SetStateAction {
    return action.action === 'set_state';
  }

  static isToggleState(action: Action): action is import('../types.js').ToggleStateAction {
    return action.action === 'toggle_state';
  }

  static async processHassAction(
    action: Action,
    element: HTMLElement,
    hass: HomeAssistant,
    actionType: 'tap' | 'hold' | 'double_tap' = 'tap'
  ): Promise<void> {
    if (!this.isHassAction(action)) {
      return Promise.resolve();
    }

    const actionConfig = this.buildHassActionConfig(action);
    
    if ((this.isToggle(action) || this.isMoreInfo(action)) && action.entity) {
      actionConfig.entity = action.entity;
    }
    
    if ((this.isToggle(action) || this.isMoreInfo(action)) && !action.entity) {
      (actionConfig.tap_action as any).entity = element.id;
      actionConfig.entity = element.id;
    }
    
    return handleAction(element, hass, actionConfig, actionType);
  }
  
  static validateAction(action: Action): string[] {
    const errors: string[] = [];
    
    switch (action.action) {
      case 'call-service':
        if (!this.isCallService(action) || !action.service) errors.push('service is required for call-service action');
        break;
      case 'navigate':
        if (!this.isNavigate(action) || !action.navigation_path) errors.push('navigation_path is required for navigate action');
        break;
      case 'url':
        if (!this.isUrl(action) || !action.url_path) errors.push('url_path is required for url action');
        break;
      case 'toggle':
      case 'more-info':
        if (!(this.isToggle(action) || this.isMoreInfo(action)) || !action.entity) errors.push('entity is required for toggle/more-info action');
        break;
      case 'set_state':
        if (!this.isSetState(action) || !action.target_element_ref) errors.push('target_element_ref is required for set_state action');
        if (!this.isSetState(action) || !action.state) errors.push('state is required for set_state action');
        break;
      case 'toggle_state':
        if (!this.isToggleState(action) || !action.target_element_ref) errors.push('target_element_ref is required for toggle_state action');
        if (!this.isToggleState(action) || !action.states || !Array.isArray(action.states) || action.states.length < 2) {
          errors.push('states array with at least 2 states is required for toggle_state action');
        }
        break;
    }
    
    return errors;
  }
  
  private static buildHassActionConfig(action: HassAction): any {
    const tap: any = { action: action.action };
    if (this.isCallService(action)) {
      tap.service = action.service;
      if (action.service_data) tap.service_data = action.service_data;
      if (action.target) tap.target = action.target;
    } else if (this.isNavigate(action)) {
      tap.navigation_path = action.navigation_path;
    } else if (this.isUrl(action)) {
      tap.url_path = action.url_path;
    } else if (this.isToggle(action) || this.isMoreInfo(action)) {
      tap.entity = action.entity;
    }

    return {
      tap_action: tap,
      confirmation: (action as any).confirmation,
    };
  }
}

 