import { fireEvent } from 'custom-card-helpers';
import { LcarsCardConfig } from '../types';

type MutableRecord = Record<string, unknown>;
type MutableContainer = MutableRecord | unknown[];

type MutableStretchTarget = {
  id?: unknown;
  edge?: unknown;
  padding?: unknown;
};

type TraversalFrame = {
  parent: MutableContainer;
  key: string | number;
};

export class ConfigUpdater {
  static updateNestedPath(
    baseConfig: LcarsCardConfig,
    path: string,
    value: unknown,
    component: HTMLElement
  ): void {
    const shouldRemoveValue = value === '' || value === null || value === undefined;
    
    let processedValue = value;
    if (
      !shouldRemoveValue &&
      typeof value === 'string' &&
      value.trim() !== '' &&
      !Number.isNaN(Number(value))
    ) {
      processedValue = Number(value);
    }

    const newConfig = JSON.parse(JSON.stringify(baseConfig)) as LcarsCardConfig;

    if (path.includes('.')) {
      this._updateNestedProperty(newConfig as unknown as MutableRecord, path, processedValue, shouldRemoveValue);
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
    const newConfig = JSON.parse(JSON.stringify(baseConfig)) as LcarsCardConfig;
    this._updateNestedProperty(newConfig as unknown as MutableRecord, path, checked, false);
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  static updateEntity(
    baseConfig: LcarsCardConfig,
    path: string,
    entityId: string,
    component: HTMLElement
  ): void {
    const newConfig = JSON.parse(JSON.stringify(baseConfig)) as LcarsCardConfig;
    this._updateNestedProperty(newConfig as unknown as MutableRecord, path, entityId, false);
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  static updateEntityArrayItem(
    baseConfig: LcarsCardConfig,
    path: string,
    index: number,
    entityId: string,
    component: HTMLElement
  ): void {
    const newConfig = JSON.parse(JSON.stringify(baseConfig)) as LcarsCardConfig;
    const keys = path.split('.');
    let container: MutableContainer = newConfig as unknown as MutableRecord;

    for (let i = 0; i < keys.length - 1; i++) {
      const rawKey = keys[i];
      const key = ConfigUpdater._isNumericKey(rawKey) ? Number(rawKey) : rawKey;
      const child = ConfigUpdater._getChildValue(container, key);

      if (ConfigUpdater._isContainer(child)) {
        container = child;
        continue;
      }

      const createdChild: MutableContainer = typeof key === 'number' ? [] : {};
      ConfigUpdater._setChildValue(container, key, createdChild);
      container = createdChild;
    }

    const lastRawKey = keys[keys.length - 1];
    const lastKey = ConfigUpdater._isNumericKey(lastRawKey) ? Number(lastRawKey) : lastRawKey;
    const existingValue = ConfigUpdater._getChildValue(container, lastKey);

    let targetArray: unknown[];
    if (Array.isArray(existingValue)) {
      targetArray = existingValue;
    } else {
      targetArray = [];
      if (existingValue !== undefined) {
        targetArray.push(existingValue);
      }
      ConfigUpdater._setChildValue(container, lastKey, targetArray);
    }

    targetArray[index] = entityId;
    fireEvent(component, 'config-changed', { config: newConfig });
  }

  private static _updateNestedProperty(
    config: MutableRecord,
    path: string,
    value: unknown,
    shouldRemove: boolean
  ): void {
    const keys = path.split('.');
    const traversalStack: TraversalFrame[] = [];
    let currentContainer: MutableContainer = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const rawKey = keys[i];
      const key = ConfigUpdater._isNumericKey(rawKey) ? Number(rawKey) : rawKey;
      traversalStack.push({ parent: currentContainer, key });

      const childValue = ConfigUpdater._getChildValue(currentContainer, key);
      if (ConfigUpdater._isContainer(childValue)) {
        currentContainer = childValue;
        continue;
      }

      const createdChild: MutableContainer = typeof key === 'number' ? [] : {};
      ConfigUpdater._setChildValue(currentContainer, key, createdChild);
      currentContainer = createdChild;
    }

    const lastRawKey = keys[keys.length - 1];
    const lastKey = ConfigUpdater._isNumericKey(lastRawKey) ? Number(lastRawKey) : lastRawKey;

    if (shouldRemove) {
      ConfigUpdater._deleteKey(currentContainer, lastKey);
    } else {
      ConfigUpdater._setChildValue(currentContainer, lastKey, value);
    }

    ConfigUpdater._cleanupEmptyContainers(traversalStack);
  }

  private static _updateTopLevelProperty(
    config: MutableRecord,
    key: string,
    value: unknown,
    shouldRemove: boolean
  ): void {
    if (shouldRemove) {
      delete config[key];
    } else {
      config[key] = value;
    }
  }

  private static _cleanupEmptyContainers(stack: TraversalFrame[]): void {
    for (let i = stack.length - 1; i >= 0; i--) {
      const { parent, key } = stack[i];
      const child = ConfigUpdater._getChildValue(parent, key);

      if (child === undefined || child === null) {
        ConfigUpdater._deleteKey(parent, key);
        continue;
      }

      if (Array.isArray(child)) {
        if (child.length === 0) {
          ConfigUpdater._deleteKey(parent, key);
          continue;
        }
        break;
      }

      if (!ConfigUpdater._isRecord(child)) {
        break;
      }

      if (key === 'stretch') {
        ConfigUpdater._sanitizeStretchRecord(child);
        if (!('target1' in child)) {
          ConfigUpdater._deleteKey(parent, key);
          continue;
        }
      }

      if (Object.keys(child).length === 0) {
        ConfigUpdater._deleteKey(parent, key);
        continue;
      }
    }
  }

  private static _sanitizeStretchRecord(record: MutableRecord): void {
    if ('target2' in record) {
      const target2 = record['target2'] as MutableStretchTarget | undefined;
      if (!ConfigUpdater._stretchTargetIsValid(target2)) {
        delete record.target2;
      }
    }

    if ('target1' in record) {
      const target1 = record['target1'] as MutableStretchTarget | undefined;
      if (!ConfigUpdater._stretchTargetIsValid(target1)) {
        delete record.target1;
      }
    }
  }

  private static _stretchTargetIsValid(target?: MutableStretchTarget): boolean {
    if (!target) {
      return false;
    }

    const id = target.id;
    const edge = target.edge;
    return typeof id === 'string' && id.trim() !== '' && typeof edge === 'string' && edge.trim() !== '';
  }

  private static _getChildValue(parent: MutableContainer, key: string | number): unknown {
    if (Array.isArray(parent)) {
      return typeof key === 'number' ? parent[key] : undefined;
    }

    return parent[key as string];
  }

  private static _setChildValue(parent: MutableContainer, key: string | number, value: unknown): void {
    if (Array.isArray(parent)) {
      if (typeof key !== 'number') {
        return;
      }
      parent[key] = value;
      return;
    }

    parent[key as string] = value;
  }

  private static _deleteKey(parent: MutableContainer, key: string | number): void {
    if (Array.isArray(parent)) {
      if (typeof key === 'number') {
        parent.splice(key, 1);
      }
      return;
    }

    delete parent[key as string];
  }

  private static _isRecord(value: unknown): value is MutableRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private static _isContainer(value: unknown): value is MutableContainer {
    return ConfigUpdater._isRecord(value) || Array.isArray(value);
  }

  private static _isNumericKey(key: string): boolean {
    return key !== '' && !Number.isNaN(Number(key));
  }
}
