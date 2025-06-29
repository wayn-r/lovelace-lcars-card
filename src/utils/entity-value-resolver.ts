import { HomeAssistant } from 'custom-card-helpers';

export interface EntityValueConfig {
  entity: string;
  attribute?: string;
  fallback?: string;
}

export class EntityValueResolver {
  static resolveEntityValue(
    config: EntityValueConfig,
    hass?: HomeAssistant
  ): string {
    if (!hass || !config.entity) {
      return config.fallback || 'Unknown';
    }

    const entityStateObj = hass.states[config.entity];
    if (!entityStateObj) {
      return config.fallback || 'Unavailable';
    }

    const attribute = config.attribute || 'state';
    const rawValue = attribute === 'state' 
      ? entityStateObj.state 
      : entityStateObj.attributes?.[attribute];

    return this.formatEntityValue(rawValue, config.fallback);
  }

  static resolveEntityFriendlyName(
    entityId: string,
    hass?: HomeAssistant,
    fallback?: string
  ): string {
    if (!hass || !entityId) {
      return fallback || entityId;
    }

    const entityStateObj = hass.states[entityId];
    return entityStateObj?.attributes?.friendly_name || fallback || entityId;
  }

  static entityStateChanged(
    entityId: string,
    attribute: string = 'state',
    lastHassStates?: { [entityId: string]: any },
    currentHass?: HomeAssistant
  ): boolean {
    if (!lastHassStates || !currentHass || !entityId) {
      return false;
    }

    const oldEntity = lastHassStates[entityId];
    const newEntity = currentHass.states[entityId];

    // If both are missing, no change
    if (!oldEntity && !newEntity) return false;
    
    // If one exists and the other doesn't, there's a change
    if (!oldEntity && newEntity) return true; // Entity added
    if (oldEntity && !newEntity) return true; // Entity removed

    // Both exist, check for actual changes
    if (attribute === 'state') {
      return oldEntity.state !== newEntity.state;
    }

    return oldEntity.attributes?.[attribute] !== newEntity.attributes?.[attribute];
  }

  static detectsEntityReferences(element: { props?: any }): Set<string> {
    const entityIds = new Set<string>();
    
    if (element.props?.entity) {
      entityIds.add(element.props.entity);
    }

    return entityIds;
  }

  private static formatEntityValue(value: any, fallback?: string): string {
    if (value === null || value === undefined) {
      return fallback || 'N/A';
    }
    return String(value);
  }
} 