import { fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig } from '../types';

export class ConfigUpdater {
  static updateNestedPath(
    baseConfig: LcarsCardConfig,
    path: string,
    value: any,
    component: HTMLElement
  ): void {
    const shouldRemoveValue = value === '' || value === null || value === undefined;
    
    let processedValue = value;
    if (!shouldRemoveValue && typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
      processedValue = Number(value);
    }

    const newConfig = JSON.parse(JSON.stringify(baseConfig));
    
    if (path.includes('.')) {
      this._updateNestedProperty(newConfig, path, processedValue, shouldRemoveValue);
    } else {
      this._updateTopLevelProperty(newConfig, path, processedValue, shouldRemoveValue);
    }

    fireEvent(component, 'config-changed', { config: newConfig });
  }

  static updateBoolean(
    baseConfig: LcarsCardConfig,
    path: string,
    checked: boolean,
    component: HTMLElement
  ): void {
    const newConfig = JSON.parse(JSON.stringify(baseConfig));
    this._updateNestedProperty(newConfig, path, checked, false);
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  static updateEntity(
    baseConfig: LcarsCardConfig,
    path: string,
    entityId: string,
    component: HTMLElement
  ): void {
    const newConfig = JSON.parse(JSON.stringify(baseConfig));
    this._updateNestedProperty(newConfig, path, entityId, false);
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  static updateEntityArrayItem(
    baseConfig: LcarsCardConfig,
    path: string,
    index: number,
    entityId: string,
    component: HTMLElement
  ): void {
    const newConfig = JSON.parse(JSON.stringify(baseConfig));
    const keys = path.split('.');
    let obj: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      obj = !isNaN(Number(key)) ? obj[Number(key)] : obj[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (!Array.isArray(obj[lastKey])) {
      const currentValue = obj[lastKey];
      obj[lastKey] = currentValue !== undefined ? [currentValue] : [];
    }
    
    obj[lastKey][index] = entityId;
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  private static _updateNestedProperty(
    config: any,
    path: string,
    value: any,
    shouldRemove: boolean
  ): void {
    const keys = path.split('.');
    let obj: any = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!isNaN(Number(key))) {
        obj = obj[Number(key)];
      } else {
        if (!obj[key]) {
          obj[key] = {};
        }
        obj = obj[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    if (shouldRemove) {
      delete obj[lastKey];
    } else {
      obj[lastKey] = value;
    }
  }

  private static _updateTopLevelProperty(
    config: any,
    key: string,
    value: any,
    shouldRemove: boolean
  ): void {
    if (shouldRemove) {
      delete config[key];
    } else {
      config[key] = value;
    }
  }
}

