import { html, nothing, TemplateResult } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { ElementMetadata } from '../element-metadata.js';
import { getEntitySchemaMetadata, EntitySchemaMetadata } from '../entity-schema-metadata.js';

interface NormalizedEntityEntry {
  id: string;
  attribute?: string;
  extras: Record<string, unknown>;
  type: 'string' | 'object';
  originalType: 'string' | 'object';
}

interface NormalizedEntityState {
  entries: NormalizedEntityEntry[];
  mode: 'single' | 'array';
}

type UpdateConfigFn = (path: string, value: unknown) => void;

export class EntityConfigRenderer {
  static render(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    updateConfig: UpdateConfigFn
  ): TemplateResult | string {
    const metadata = getEntitySchemaMetadata(element.type);
    const requiresEntity = ElementMetadata.requiresEntity(element.type);

    if (!metadata && !requiresEntity) {
      return '';
    }

    if (!metadata) {
      return this._renderLegacyEntityInput(element, basePath, hass, updateConfig);
    }

    const state = this._normalizeEntityState(element.entity, metadata);
    const entityHelpText = ElementMetadata.getEntityHelpText(element.type);
    const attributePickerAvailable = Boolean(customElements.get('ha-entity-attribute-picker'));
    const entityPickerAvailable = Boolean(customElements.get('ha-entity-picker'));
    const colorPickerAvailable = Boolean(customElements.get('ha-color-picker'));
    const isGraphWidget = element.type === 'graph-widget';

    const entriesContent = state.entries.length > 0
      ? state.entries.map((entry, index) => this._renderEntityEntry(
          element,
          basePath,
          hass,
          metadata,
          state,
          entry,
          index,
          updateConfig,
          entityHelpText,
          attributePickerAvailable,
          entityPickerAvailable,
          colorPickerAvailable,
          isGraphWidget
        ))
      : metadata.allowMultiple
        ? html`
            <div class="config-row">
              <div class="helper-text">${entityHelpText}</div>
          </div>
        `
        : nothing;

    return html`
      ${entriesContent}
      ${metadata.allowMultiple ? this._renderAddEntryRow(
        element,
        basePath,
        metadata,
        state,
        updateConfig,
        entityPickerAvailable
      ) : nothing}
    `;
  }

  private static _renderLegacyEntityInput(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    updateConfig: UpdateConfigFn
  ): TemplateResult | string {
    const entityValue = Array.isArray(element.entity) ? element.entity[0] : element.entity;
    const entityHelpText = ElementMetadata.getEntityHelpText(element.type);

    return html`
      <div class="config-row">
        <ha-entity-picker
          .hass=${hass}
          .value=${entityValue || ''}
          label="Entity"
          allow-custom-entity
          @value-changed=${(ev: CustomEvent) => {
            ev.stopPropagation();
            const value = ev.detail?.value ?? '';
            updateConfig(`${basePath}.entity`, value);
          }}
        ></ha-entity-picker>
        <div class="helper-text">${entityHelpText}</div>
      </div>
      ${ElementMetadata.supportsAttribute(element.type)
        ? this._renderLegacyAttributeField(element, basePath, updateConfig)
        : nothing}
    `;
  }

  private static _renderLegacyAttributeField(
    element: any,
    basePath: string,
    updateConfig: UpdateConfigFn
  ): TemplateResult {
    return html`
      <div class="config-row">
        <ha-textfield
          label="Attribute (optional)"
          .value=${element.attribute || ''}
          @input=${(ev: Event) => {
            const target = ev.target as HTMLInputElement | null;
            if (!target) {
              return;
            }
            updateConfig(`${basePath}.attribute`, target.value ?? '');
          }}
          placeholder="temperature"
        ></ha-textfield>
        <div class="helper-text">Specific entity attribute to display</div>
      </div>
    `;
  }

  private static _renderEntityEntry(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    entry: NormalizedEntityEntry,
    index: number,
    updateConfig: UpdateConfigFn,
    entityHelpText: string,
    attributePickerAvailable: boolean,
    entityPickerAvailable: boolean,
    colorPickerAvailable: boolean,
    isGraphWidget: boolean
  ): TemplateResult {
    const label = metadata.allowMultiple ? `Entity ${index + 1}` : 'Entity';
    const removeButton = metadata.allowMultiple
      ? html`
          <ha-icon-button
            class="icon-button-tiny entity-config-row__remove"
            title="Remove entity"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this._removeEntry(element, metadata, state, basePath, index, updateConfig);
            }}
          >
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        `
      : nothing;

    const entityInput = entityPickerAvailable
      ? html`
          <ha-entity-picker
            .hass=${hass}
            .value=${entry.id}
            .label=${label}
            allow-custom-entity
            @value-changed=${(ev: CustomEvent) => {
              ev.stopPropagation();
              const value = ev.detail?.value ?? '';
              this._updateEntry(element, metadata, state, basePath, index, updateConfig, draft => {
                draft.id = value;
              });
            }}
          ></ha-entity-picker>
        `
      : html`
          <ha-textfield
            .value=${entry.id}
            .label=${label}
            placeholder="sensor.example"
            @input=${(ev: Event) => {
              const target = ev.target as HTMLInputElement | null;
              if (!target) {
                return;
              }
              this._updateEntry(element, metadata, state, basePath, index, updateConfig, draft => {
                draft.id = target.value ?? '';
              });
            }}
          ></ha-textfield>
        `;

    const attributeField = this._renderEntryAttributeField(
      element,
      basePath,
      hass,
      metadata,
      state,
      entry,
      index,
      updateConfig,
      attributePickerAvailable
    );

    const colorField = this._renderEntryColorField(
      element,
      basePath,
      hass,
      metadata,
      state,
      entry,
      index,
      updateConfig,
      colorPickerAvailable,
      isGraphWidget
    );

    const hasSecondaryFields = attributeField !== nothing || colorField !== nothing;

    return html`
      <div class="config-row entity-config-row">
        <div class="entity-config-row__input">
          ${entityInput}
          <div class="helper-text">${entityHelpText}</div>
        </div>
        ${removeButton}
      </div>
      ${hasSecondaryFields ? html`
        <div class="config-row entity-config-subrow">
          ${attributeField}
          ${colorField}
        </div>
      ` : nothing}
    `;
  }

  private static _renderEntryAttributeField(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    entry: NormalizedEntityEntry,
    index: number,
    updateConfig: UpdateConfigFn,
    attributePickerAvailable: boolean
  ): TemplateResult | typeof nothing {
    const hasAttributeField = metadata.fieldSpecs.some(spec => spec.key === 'attribute');

    if (!hasAttributeField) {
      return nothing;
    }

    const label = metadata.allowMultiple ? `Attribute ${index + 1} (optional)` : 'Attribute (optional)';

    if (attributePickerAvailable && entry.id) {
      return html`
        <div class="entity-config-subrow__field">
          <ha-entity-attribute-picker
            .hass=${hass}
            .entity=${entry.id}
            .value=${entry.attribute ?? ''}
            .label=${label}
            allow-custom-attribute
            @value-changed=${(ev: CustomEvent) => {
              ev.stopPropagation();
              const value = ev.detail?.value ?? '';
              this._updateEntry(element, metadata, state, basePath, index, updateConfig, draft => {
                draft.attribute = value || undefined;
                draft.type = value ? 'object' : draft.extras && Object.keys(draft.extras).length > 0 ? 'object' : draft.originalType;
              });
            }}
          ></ha-entity-attribute-picker>
          <div class="helper-text">Specific attribute from this entity</div>
        </div>
      `;
    }

    return html`
      <div class="entity-config-subrow__field">
        <ha-textfield
          .value=${entry.attribute ?? ''}
          .label=${label}
          placeholder="temperature"
          @input=${(ev: Event) => {
            const target = ev.target as HTMLInputElement | null;
            if (!target) {
              return;
            }
            const value = target.value ?? '';
            this._updateEntry(element, metadata, state, basePath, index, updateConfig, draft => {
              draft.attribute = value || undefined;
              draft.type = value ? 'object' : draft.extras && Object.keys(draft.extras).length > 0 ? 'object' : draft.originalType;
            });
          }}
        ></ha-textfield>
        <div class="helper-text">Specific attribute from this entity</div>
      </div>
    `;
  }

  private static _renderEntryColorField(
    element: any,
    basePath: string,
    hass: HomeAssistant,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    entry: NormalizedEntityEntry,
    index: number,
    updateConfig: UpdateConfigFn,
    colorPickerAvailable: boolean,
    isGraphWidget: boolean
  ): TemplateResult | typeof nothing {
    if (!isGraphWidget) {
      return nothing;
    }

    const label = metadata.allowMultiple ? `Color ${index + 1} (optional)` : 'Color (optional)';
    const currentColor = typeof entry.extras.color === 'string' ? entry.extras.color : '';

    const handleUpdate = (value: string) => {
      this._updateEntry(element, metadata, state, basePath, index, updateConfig, draft => {
        if (value) {
          draft.extras.color = value;
          draft.type = 'object';
        } else {
          delete draft.extras.color;
        }
      });
    };

    if (colorPickerAvailable) {
      return html`
        <div class="entity-config-subrow__field">
          <ha-color-picker
            .hass=${hass}
            .value=${currentColor || ''}
            .label=${label}
            @value-changed=${(ev: CustomEvent) => {
              ev.stopPropagation();
              const value = ev.detail?.value ?? '';
              handleUpdate(value ?? '');
            }}
          ></ha-color-picker>
          <div class="helper-text">Optional override for this series color</div>
        </div>
      `;
    }

    return html`
      <div class="entity-config-subrow__field">
        <ha-textfield
          .value=${currentColor}
          .label=${label}
          placeholder="#ff9900"
          @input=${(ev: Event) => {
            const target = ev.target as HTMLInputElement | null;
            if (!target) {
              return;
            }
            handleUpdate(target.value ?? '');
          }}
        ></ha-textfield>
        <div class="helper-text">Optional override for this series color</div>
      </div>
    `;
  }

  private static _renderAddEntryRow(
    element: any,
    basePath: string,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    updateConfig: UpdateConfigFn,
    entityPickerAvailable: boolean
  ): TemplateResult | string {
    const reachedMax = typeof metadata.maxItems === 'number' && state.entries.length >= metadata.maxItems;

    if (reachedMax) {
      return '';
    }

    const buttonLabel = state.entries.length === 0 ? 'Add entity' : 'Add another entity';
    const addHandler = (ev: Event) => {
      ev.stopPropagation();
      this._addEntry(element, metadata, state, basePath, updateConfig, entityPickerAvailable);
    };

    return html`
      <div class="config-row">
        <div
          class="add-entity-row"
          role="button"
          tabindex="0"
          @click=${addHandler}
          @keydown=${(ev: KeyboardEvent) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              addHandler(ev);
            }
          }}
        >
          <ha-icon-button
            class="icon-button-tiny add-entity-row__icon"
            title=${buttonLabel}
            @click=${(ev: Event) => {
              ev.stopPropagation();
              addHandler(ev);
            }}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
          </ha-icon-button>
          <span class="add-entity-row__label">${buttonLabel}</span>
        </div>
      </div>
    `;
  }

  private static _addEntry(
    element: any,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    basePath: string,
    updateConfig: UpdateConfigFn,
    entityPickerAvailable: boolean
  ): void {
    const newEntry = this._createEmptyEntry(metadata, entityPickerAvailable);
    this._mutateEntries(element, metadata, state, basePath, updateConfig, entries => {
      entries.push(newEntry);
    });
  }

  private static _removeEntry(
    element: any,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    basePath: string,
    index: number,
    updateConfig: UpdateConfigFn
  ): void {
    this._mutateEntries(element, metadata, state, basePath, updateConfig, entries => {
      entries.splice(index, 1);
    });
  }

  private static _updateEntry(
    element: any,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    basePath: string,
    index: number,
    updateConfig: UpdateConfigFn,
    updater: (entry: NormalizedEntityEntry) => void
  ): void {
    this._mutateEntries(element, metadata, state, basePath, updateConfig, entries => {
      const target = { ...entries[index], extras: { ...entries[index].extras } };
      updater(target);

      const hasExtras = Object.keys(target.extras).length > 0;

      if (!target.attribute && !hasExtras && entries[index].originalType === 'string') {
        target.type = 'string';
      } else if (target.attribute && target.attribute !== '') {
        target.type = 'object';
      } else if (hasExtras) {
        target.type = 'object';
      }

      entries[index] = target;
    });
  }

  private static _mutateEntries(
    element: any,
    metadata: EntitySchemaMetadata,
    state: NormalizedEntityState,
    basePath: string,
    updateConfig: UpdateConfigFn,
    mutator: (entries: NormalizedEntityEntry[]) => void
  ): void {
    const workingEntries = state.entries.map(entry => ({
      ...entry,
      extras: { ...entry.extras },
    }));

    mutator(workingEntries);

    const newValue = this._denormalizeEntries(workingEntries, state.mode, metadata);
    updateConfig(`${basePath}.entity`, newValue);
  }

  private static _normalizeEntityState(
    entityValue: any,
    metadata: EntitySchemaMetadata
  ): NormalizedEntityState {
    if (Array.isArray(entityValue)) {
      return {
        mode: 'array',
        entries: entityValue.map(value => this._normalizeEntry(value)),
      };
    }

    if (entityValue === undefined || entityValue === null) {
      return metadata.allowMultiple
        ? { mode: 'array', entries: [] }
        : { mode: 'single', entries: [this._createEmptyEntry(metadata, true)] };
    }

    return {
      mode: 'single',
      entries: [this._normalizeEntry(entityValue)],
    };
  }

  private static _normalizeEntry(value: any): NormalizedEntityEntry {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { attribute, id, ...rest } = value as Record<string, unknown>;
      return {
        id: typeof id === 'string' ? id : '',
        attribute: typeof attribute === 'string' ? attribute : undefined,
        extras: rest,
        type: 'object',
        originalType: 'object',
      };
    }

    return {
      id: typeof value === 'string' ? value : '',
      attribute: undefined,
      extras: {},
      type: 'string',
      originalType: 'string',
    };
  }

  private static _createEmptyEntry(
    metadata: EntitySchemaMetadata,
    preferString: boolean
  ): NormalizedEntityEntry {
    const defaultType = preferString && metadata.allowStringEntries ? 'string' : metadata.defaultEntryType;
    return {
      id: '',
      attribute: undefined,
      extras: {},
      type: defaultType,
      originalType: defaultType,
    };
  }

  private static _denormalizeEntries(
    entries: NormalizedEntityEntry[],
    originalMode: 'single' | 'array',
    metadata: EntitySchemaMetadata
  ): any {
    if (metadata.allowMultiple) {
      if (entries.length === 0) {
        return [];
      }

      if (entries.length === 1 && originalMode !== 'array') {
        return this._convertEntryToRaw(entries[0]);
      }

      return entries.map(entry => this._convertEntryToRaw(entry));
    }

    const first = entries[0];
    return first ? this._convertEntryToRaw(first) : '';
  }

  private static _convertEntryToRaw(entry: NormalizedEntityEntry): any {
    const hasAttribute = entry.attribute !== undefined && entry.attribute !== '';
    const hasExtras = Object.keys(entry.extras).length > 0;

    if (entry.type === 'object' || hasAttribute || hasExtras) {
      const result: Record<string, unknown> = { ...entry.extras };
      result.id = entry.id ?? '';
      if (hasAttribute) {
        result.attribute = entry.attribute;
      }
      return result;
    }

    return entry.id;
  }
}
