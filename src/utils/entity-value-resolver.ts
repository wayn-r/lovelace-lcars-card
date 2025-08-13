import { HomeAssistant } from 'custom-card-helpers';

export interface EntityValueConfig {
  entity: string;
  attribute?: string;
  fallback?: string;
}

export interface NumericRangeStrategy {
  getRange(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): { min?: number; max?: number };
}

export class EntityValueResolver {
  private static numericRangeStrategies = new Map<string, NumericRangeStrategy>();

  static registerNumericRangeStrategy(domain: string, strategy: NumericRangeStrategy): void {
    this.numericRangeStrategies.set(domain.toLowerCase(), strategy);
  }
  static readEntityRaw(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): any {
    if (!hass || !entityId) return undefined;
    const stateObj = hass.states[entityId];
    if (!stateObj) return undefined;
    const attr = attribute && attribute !== 'state' ? attribute : 'state';
    if (attr === 'state') return stateObj.state;
    const attrs = (stateObj.attributes as any) || {};
    let value = attrs?.[attr];
    if (value !== undefined) return value;
    const aliases = this._attributeAliases(attr);
    for (const alt of aliases) {
      if (attrs?.[alt] !== undefined) return attrs[alt];
    }
    return undefined;
  }

  static readEntityNumeric(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): number {
    const raw = this.readEntityRaw(hass, entityId, attribute);
    const n = parseFloat(String(raw));
    return Number.isNaN(n) ? NaN : n;
  }

  private static _attributeAliases(attr: string): string[] {
    const a = (attr || '').toLowerCase();
    const aliasMap: Record<string, string[]> = {
      target_temp: ['temperature', 'target_temperature'],
      temperature: ['target_temp', 'target_temperature'],
      target_temperature: ['target_temp', 'temperature'],
      target_temp_high: ['target_temperature_high'],
      target_temperature_high: ['target_temp_high'],
      target_temp_low: ['target_temperature_low'],
      target_temperature_low: ['target_temp_low'],
    };
    return aliasMap[a] || [];
  }

  static isFahrenheit(hass: HomeAssistant | undefined): boolean {
    const unit = (hass as any)?.config?.unit_system?.temperature;
    if (!unit) return false;
    const u = String(unit).toLowerCase();
    return u === 'f' || u.startsWith('f') || u.includes('fahren');
  }

  /**
   * Attempts to derive a sensible numeric range for a given entity/attribute.
   * Returns undefineds when the range cannot be determined.
   */
  static readEntityNumericRange(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): { min?: number; max?: number } {
    const domain = (entityId || '').split('.')[0].toLowerCase();
    const strategy = this.numericRangeStrategies.get(domain);
    if (strategy) return strategy.getRange(hass, entityId, attribute);
    return this._getDefaultNumericRange(hass, entityId, attribute);
  }
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

  static formatEntityIdAsDisplayText(entityId: string): string {
    return entityId.split('.').pop()?.replace(/_/g, ' ') || "";
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

    if (!oldEntity && !newEntity) return false;
    
    if (!oldEntity && newEntity) return true;
    if (oldEntity && !newEntity) return true;

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

  private static _getClimateNumericRange(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): { min?: number; max?: number } {
    if (!hass || !entityId) return { min: undefined, max: undefined };
    const stateObj = hass.states[entityId];
    if (!stateObj) return { min: undefined, max: undefined };

    const attrs = (stateObj.attributes || {}) as Record<string, unknown>;
    const minTemp = this._toNumber((attrs as any).min_temp);
    const maxTemp = this._toNumber((attrs as any).max_temp);
    const baseMin = this._finiteOrUndefined(minTemp);
    const baseMax = this._finiteOrUndefined(maxTemp);

    const currentHigh = this._toNumber((attrs as any).target_temp_high ?? (attrs as any).target_temperature_high);
    const currentLow = this._toNumber((attrs as any).target_temp_low ?? (attrs as any).target_temperature_low);
    const hasHigh = Number.isFinite(currentHigh);
    const hasLow = Number.isFinite(currentLow);

    const attrName = (attribute || 'temperature').toLowerCase();
    const isHigh = attrName === 'target_temp_high' || attrName === 'target_temperature_high';
    const isLow = attrName === 'target_temp_low' || attrName === 'target_temperature_low';

    if (isHigh) {
      const min = hasLow ? (currentLow as number) : baseMin;
      const max = baseMax;
      return { min, max };
    }
    if (isLow) {
      const min = baseMin;
      const max = hasHigh ? (currentHigh as number) : baseMax;
      return { min, max };
    }
    return { min: baseMin, max: baseMax };
  }

  private static _getNumberEntityNumericRange(
    hass: HomeAssistant | undefined,
    entityId: string
  ): { min?: number; max?: number } {
    if (!hass || !entityId) return { min: undefined, max: undefined };
    const attrs = (hass.states[entityId]?.attributes || {}) as Record<string, unknown>;
    const min = this._finiteOrUndefined(this._toNumber((attrs as any).min));
    const max = this._finiteOrUndefined(this._toNumber((attrs as any).max));
    return { min, max };
  }

  private static _getDefaultNumericRange(
    hass: HomeAssistant | undefined,
    entityId: string,
    attribute?: string
  ): { min?: number; max?: number } {
    if (!hass || !entityId) return { min: undefined, max: undefined };
    const attrs = (hass.states[entityId]?.attributes || {}) as Record<string, unknown>;
    const attrName = (attribute || '').toLowerCase();

    if (attrName === 'brightness') return { min: 0, max: 255 };
    if (attrName === 'brightness_pct') return { min: 0, max: 100 };
    if (attrName === 'volume_level') return { min: 0, max: 1 };
    if (attrName === 'percentage' || attrName === 'position') return { min: 0, max: 100 };

    const min = this._finiteOrUndefined(this._toNumber((attrs as any).min));
    const max = this._finiteOrUndefined(this._toNumber((attrs as any).max));
    return { min, max };
  }

  private static _toNumber(v: unknown): number {
    return Number(v);
  }

  private static _finiteOrUndefined(v: number): number | undefined {
    return Number.isFinite(v) ? v : undefined;
  }

  static {
    // Built-in strategies
    this.registerNumericRangeStrategy('climate', {
      getRange: (hass, entityId, attribute) => this._getClimateNumericRange(hass, entityId, attribute)
    });
    this.registerNumericRangeStrategy('number', {
      getRange: (hass, entityId) => this._getNumberEntityNumericRange(hass, entityId)
    });
    this.registerNumericRangeStrategy('input_number', {
      getRange: (hass, entityId) => this._getNumberEntityNumericRange(hass, entityId)
    });
  }
} 