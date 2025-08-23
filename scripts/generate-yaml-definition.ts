#!/usr/bin/env -S node --loader ts-node/esm
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { lcarsCardConfigSchema } from '../src/parsers/schema.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { dump as yamlDump } from 'js-yaml';
import { builtInElementSchemas } from '../src/config/schemas/elements/index.js';
import { baseElementSchema } from '../src/config/schemas/elements/base.js';
import { textSchema } from '../src/config/schemas/text.js';
import { actionSchema, buttonSchema, holdActionSchema } from '../src/config/schemas/actions.js';
import { colorSchema } from '../src/config/schemas/primitives.js';
import { animationsSchema, animationDefinitionSchema, animationSequenceSchema } from '../src/config/schemas/animations.js';
import { visibilityRulesSchema, visibilityTriggerSchema } from '../src/config/schemas/visibility.js';
import { elementStateManagementSchema, cardStateManagementSchema } from '../src/config/schemas/state.js';

type ZodAny = z.ZodTypeAny;
type ZodShape = Record<string, ZodAny>;
type JsonDoc = { [k: string]: unknown; $schema?: string; title?: string; $id?: string };

class YamlDefinitionGenerator {
  static run(): void {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const outDir = join(__dirname, '..', 'docs');
    mkdirSync(outDir, { recursive: true });

    const jsonSchema = zodToJsonSchema(lcarsCardConfigSchema, 'LcarsCardConfig') as JsonDoc;
    jsonSchema.$schema = jsonSchema.$schema || 'https://json-schema.org/draft/2020-12/schema';
    jsonSchema.title = jsonSchema.title || 'LCARS Card Configuration Schema';
    jsonSchema.$id = jsonSchema.$id || 'https://schemas.local/lcars-card.schema.json';
    const jsonSchemaPath = join(outDir, 'lcars-card.schema.json');
    writeFileSync(jsonSchemaPath, JSON.stringify(jsonSchema, null, 2));

    const yamlSchema = yamlDump(jsonSchema, { noRefs: true, lineWidth: 120 });
    const yamlSchemaPath = join(outDir, 'lcars-card.schema.yaml');
    writeFileSync(yamlSchemaPath, yamlSchema);

    const conciseYaml = this._createConciseYamlDefinition();
    const concisePath = join(outDir, 'yaml-config-definition.generated.yaml');
    writeFileSync(concisePath, conciseYaml);

    console.log(`Generated:\n- ${jsonSchemaPath}\n- ${yamlSchemaPath}\n- ${concisePath}`);
  }

  private static _getObjectShapeFromSchema(schema: ZodAny | undefined): ZodShape {
    if (!schema) return {};
    try {
      const candidate: unknown = (schema as unknown as { shape?: unknown; _def?: { shape?: unknown } }).shape;
      if (typeof candidate === 'object' && candidate) return candidate as ZodShape;
      if (typeof (schema as unknown as { shape: () => unknown }).shape === 'function') return (schema as unknown as { shape: () => unknown }).shape() as ZodShape;
      const def: unknown = (schema as unknown as { _def?: { shape?: unknown } })._def;
      if (def && typeof (def as { shape?: unknown }).shape === 'function') return ((def as { shape: () => unknown }).shape() as ZodShape) || {};
      if (def && typeof (def as { shape?: unknown }).shape === 'object') return ((def as { shape: unknown }).shape as ZodShape) || {};
    } catch (_) {}
    return {};
  }

  private static _getTypeLabel(schema: ZodAny | undefined): string {
    if (!schema) return 'any';
    const core = this._unwrapSchema(schema);
    const def = (core as unknown as { _def?: { typeName?: string; values?: string[]; options?: ZodAny[]; value?: unknown } })._def;
    const typeName = def?.typeName || (core as unknown as { constructor?: { name?: string } })?.constructor?.name;
    switch (typeName) {
      case 'ZodString': return 'string';
      case 'ZodNumber': return 'number';
      case 'ZodBoolean': return 'boolean';
      case 'ZodArray': return 'array';
      case 'ZodTuple': return 'array';
      case 'ZodObject': return 'object';
      case 'ZodLiteral': return JSON.stringify(def?.value ?? 'literal');
      case 'ZodEnum': {
        const values = def?.values ?? [];
        return Array.isArray(values) && values.length ? values.join('|') : 'enum';
      }
      case 'ZodUnion': {
        const options = def?.options ?? [];
        const labels = options.map((option) => this._getTypeLabel(option));
        const unique = Array.from(new Set(labels)).slice(0, 4);
        const union = labels.join('|');
        return (unique.length ? unique.join('|') : union) || 'union';
      }
      default: return 'any';
    }
  }

  private static _getSchemaTypeName(schema: ZodAny | undefined): string | undefined {
    const core = this._unwrapSchema(schema);
    if (!core) return undefined;
    return (core as unknown as { _def?: { typeName?: string } })._def?.typeName;
  }

  private static _unwrapSchema(schema: ZodAny | undefined): ZodAny {
    let current: unknown = schema;
    const visited = new Set<unknown>();
    while (current && (current as { _def?: { typeName?: string } })._def && !visited.has(current)) {
      visited.add(current);
      const typeName = (current as { _def: { typeName: string } })._def.typeName;
      if (typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault') {
        current = (current as unknown as { _def: { innerType: ZodAny } })._def.innerType;
        continue;
      }
      if (typeName === 'ZodEffects') {
        current = (current as unknown as { _def: { schema: ZodAny } })._def.schema;
        continue;
      }
      break;
    }
    return (current as ZodAny) || (schema as ZodAny);
  }

  private static _getDefaultValueFromSchema(schema: ZodAny | undefined): unknown {
    let current: unknown = schema;
    const visited = new Set<unknown>();
    while (current && (current as { _def?: { typeName?: string } })._def && !visited.has(current)) {
      visited.add(current);
      if ((current as { _def: { typeName: string } })._def.typeName === 'ZodDefault') {
        try {
          const dv = (current as unknown as { _def: { defaultValue: unknown | (() => unknown) } })._def.defaultValue;
          return typeof dv === 'function' ? (dv as () => unknown)() : dv;
        } catch (_) {
          return undefined;
        }
      }
      if ((current as { _def: { typeName: string } })._def.typeName === 'ZodOptional' || (current as { _def: { typeName: string } })._def.typeName === 'ZodNullable' || (current as { _def: { typeName: string } })._def.typeName === 'ZodEffects') {
        current = (current as unknown as { _def: { innerType?: ZodAny; schema?: ZodAny } })._def.innerType || (current as unknown as { _def: { schema?: ZodAny } })._def.schema;
      } else {
        current = (current as unknown as { _def: { innerType?: ZodAny } })._def.innerType;
      }
    }
    return undefined;
  }

  private static _getEnumValues(schema: ZodAny | undefined): string[] {
    const core = this._unwrapSchema(schema);
    const def = (core as unknown as { _def?: { typeName?: string; values?: string[]; value?: unknown } })._def;
    if (def?.typeName === 'ZodEnum') return (def.values as string[]) || [];
    if (def?.typeName === 'ZodLiteral') return [String(def.value)];
    return [];
  }

  private static _indent(levels: number): string {
    return '  '.repeat(levels);
  }

  private static _formatLabelSpacing(label: string): string {
    return (label || '').replace(/\|/g, ' | ');
  }

  private static _renderArrayOf(lines: string[], title: string, itemSchema: ZodAny, level: number): void {
    const core = this._unwrapSchema(itemSchema);
    const shape = this._getObjectShapeFromSchema(core);
    lines.push(`${this._indent(level)}${title}:`);
    lines.push(`${this._indent(level + 1)}-`);
    for (const [key, schemaType] of Object.entries(shape)) {
      const unwrapped = this._unwrapSchema(schemaType);
      const typeName = this._getSchemaTypeName(unwrapped);
      if (typeName === 'ZodObject') {
        lines.push(`${this._indent(level + 2)}${key}:`);
        for (const [subKey, subType] of Object.entries(this._getObjectShapeFromSchema(unwrapped))) {
          lines.push(`${this._indent(level + 3)}${subKey}: < ${this._formatLabelSpacing(this._getTypeLabel(subType))} >`);
        }
      } else {
        lines.push(`${this._indent(level + 2)}${key}: < ${this._formatLabelSpacing(this._getTypeLabel(schemaType))} >`);
      }
    }
  }

  private static _renderColorDefinition(lines: string[], level: number): void {
    lines.push(`${this._indent(level)}color:`);
    const core = this._unwrapSchema(colorSchema as unknown as ZodAny);
    const def = (core as unknown as { _def?: { typeName?: string; options?: ZodAny[] } })._def;
    if (def?.typeName === 'ZodUnion') {
      for (const option of (def?.options || [])) {
        const unwrapped = this._unwrapSchema(option);
        const tn = this._getSchemaTypeName(unwrapped);
        if (tn === 'ZodString') {
          lines.push(`${this._indent(level + 1)}string: < string >`);
        } else if (tn === 'ZodTuple') {
          lines.push(`${this._indent(level + 1)}rgb: [< number >, < number >, < number >]`);
        } else if (tn === 'ZodObject') {
          const shape = this._getObjectShapeFromSchema(unwrapped);
          if ('entity' in shape && 'mapping' in shape) {
            lines.push(`${this._indent(level + 1)}dynamic:`);
            for (const [key, schemaType] of Object.entries(shape)) {
              lines.push(`${this._indent(level + 2)}${key}: < ${this._formatLabelSpacing(this._getTypeLabel(schemaType))} >`);
            }
          } else {
            lines.push(`${this._indent(level + 1)}stateful:`);
            for (const [key, schemaType] of Object.entries(shape)) {
              lines.push(`${this._indent(level + 2)}${key}: < ${this._formatLabelSpacing(this._getTypeLabel(schemaType))} >`);
            }
          }
        }
      }
    }
  }

  private static _computeUniqueNestedKeys(baseObjSchema: ZodAny | undefined, elemObjSchema: ZodAny | undefined): { uniqueKeys: string[]; isSpecializedSubset: boolean; elementKeys: string[] } {
    if (!elemObjSchema) return { uniqueKeys: [], isSpecializedSubset: false, elementKeys: [] };
    const baseCore = this._unwrapSchema(baseObjSchema);
    const elemCore = this._unwrapSchema(elemObjSchema);
    const baseShape = this._getObjectShapeFromSchema(baseCore);
    const elemShape = this._getObjectShapeFromSchema(elemCore);
    const uniqueKeys: string[] = [];
    const baseKeys = Object.keys(baseShape || {});
    const elementKeys = Object.keys(elemShape || {});
    for (const [key, value] of Object.entries(elemShape)) {
      const baseValue = (baseShape as ZodShape)[key];
      if (!baseValue) {
        uniqueKeys.push(key);
        continue;
      }
      if (value !== baseValue || this._getTypeLabel(value) !== this._getTypeLabel(baseValue)) {
        uniqueKeys.push(key);
      }
    }
    const isSubset = elementKeys.length > 0 && elementKeys.every((key) => baseKeys.includes(key));
    const isSpecializedSubset = uniqueKeys.length === 0 && isSubset && baseKeys.length !== elementKeys.length;
    return { uniqueKeys: uniqueKeys.sort(), isSpecializedSubset, elementKeys };
  }

  private static _renderUniqueNested(lines: string[], blockName: string, baseObjSchema: ZodAny | undefined, elemObjSchema: ZodAny | undefined, level: number): void {
    if (!elemObjSchema) return;
    const baseCore = this._unwrapSchema(baseObjSchema);
    const elemCore = this._unwrapSchema(elemObjSchema);
    const baseIsObject = this._getSchemaTypeName(baseCore) === 'ZodObject';
    const elemIsObject = this._getSchemaTypeName(elemCore) === 'ZodObject';
    if (!baseIsObject && elemIsObject) {
      this._pushBlock(lines, blockName, elemCore, level, true);
      return;
    }
    const { uniqueKeys, isSpecializedSubset, elementKeys } = this._computeUniqueNestedKeys(baseObjSchema, elemObjSchema);
    if (uniqueKeys.length === 0 && !isSpecializedSubset) return;
    lines.push(`${this._indent(level)}${blockName}:`);
    const elemShape = this._getObjectShapeFromSchema(elemCore);
    const keysToRender = uniqueKeys.length ? uniqueKeys : elementKeys;
    for (const key of keysToRender) {
      const schemaType = (elemShape as ZodShape)[key];
      if (!schemaType) continue;
      lines.push(`${this._indent(level + 1)}${key}: < ${this._formatLabelSpacing(this._getTypeLabel(schemaType))} >`);
    }
  }

  private static _pushBlock(lines: string[], title: string, schema: ZodAny, level: number, includeDefaults = false): void {
    const core = this._unwrapSchema(schema);
    const shape = this._getObjectShapeFromSchema(core);
    lines.push(`${this._indent(level)}${title}:`);
    for (const [key, schemaType] of Object.entries(shape)) {
      const unwrapped = this._unwrapSchema(schemaType);
      const typeName = this._getSchemaTypeName(unwrapped);
      const label = this._formatLabelSpacing(this._getTypeLabel(schemaType));
      const defaultNote = includeDefaults ? this._getDefaultValueFromSchema(schemaType) : undefined;
      if (typeName === 'ZodObject') {
        this._pushBlock(lines, String(key), unwrapped, level + 1, includeDefaults);
      } else {
        if (defaultNote !== undefined) {
          lines.push(`${this._indent(level + 1)}${key}: < ${label} > (default: ${JSON.stringify(defaultNote)})`);
        } else {
          lines.push(`${this._indent(level + 1)}${key}: < ${label} >`);
        }
      }
    }
  }

  private static _formatEntityHint(entitySchema: ZodAny): string {
    const core = this._unwrapSchema(entitySchema);
    const def = (core as unknown as { _def?: { typeName?: string; options?: ZodAny[] } })._def;
    const tn = def?.typeName;
    if (tn === 'ZodUnion') {
      const options = def?.options || [];
      const arrayOpt = options.find((option) => this._unwrapSchema(option)?._def?.typeName === 'ZodArray');
      if (arrayOpt) {
        const inner = this._unwrapSchema(arrayOpt)._def?.type || this._unwrapSchema(arrayOpt)._def?.innerType;
        const innerUnwrapped = this._unwrapSchema(inner as ZodAny);
        if ((innerUnwrapped as unknown as { _def?: { typeName?: string; options?: ZodAny[] } })._def?.typeName === 'ZodUnion') {
          const objOption = (innerUnwrapped as unknown as { _def: { options: ZodAny[] } })._def.options.find((opt) => this._unwrapSchema(opt)?._def?.typeName === 'ZodObject');
          if (objOption) {
            const objShape = this._getObjectShapeFromSchema(objOption);
            const detail = Object.keys(objShape).map((key) => `${key}${(objShape as ZodShape)[key]?._def?.typeName === 'ZodOptional' ? '?' : ''}: <${this._getTypeLabel((objShape as ZodShape)[key])}>`).join(', ');
            return `<string | array<string|{ ${detail} }>>`;
          }
        }
        if (this._unwrapSchema(inner as ZodAny)?._def?.typeName === 'ZodString') {
          return '<string | string[1..2]>';
        }
      }
      return `<${(options.map((opt) => this._getTypeLabel(opt))).join('|')}>`;
    }
    if (tn === 'ZodString') return '<string>';
    if (tn === 'ZodArray') return '<array>';
    return `<${this._getTypeLabel(core)}>`;
  }

  private static _createConciseYamlDefinition(): string {
    const lines: string[] = [];
    lines.push('## YAML Configuration Options');
    lines.push('');
    const cardShape = this._getObjectShapeFromSchema(lcarsCardConfigSchema as unknown as ZodAny);
    const typeDefault = this._getDefaultValueFromSchema(cardShape['type']);
    lines.push(`type: < ${this._formatLabelSpacing(this._getTypeLabel(cardShape['type']))} >${typeDefault !== undefined ? ` (default: ${JSON.stringify(typeDefault)})` : ''}`);
    if (cardShape['title']) {
      lines.push(`title: < ${this._formatLabelSpacing(this._getTypeLabel(cardShape['title']))} >`);
    }
    lines.push('');

    const elementShapes = builtInElementSchemas.map((schema) => this._getObjectShapeFromSchema(schema as unknown as ZodAny));
    const keySets = elementShapes.map((shape) => new Set(Object.keys(shape)));
    const coreKeys = Array.from(keySets.reduce((acc, set) => {
      const next = new Set<string>();
      acc.forEach((key) => { if (set.has(key)) next.add(key); });
      return next;
    }, new Set<string>(Object.keys(elementShapes[0] || {}))));

    const excludedFromCore = new Set(['id','type','entity','appearance','layout','text','label','value','unit']);
    const shownCoreKeys = coreKeys.filter((key) => !excludedFromCore.has(key));

    lines.push('# === Core Card Structure ===');
    lines.push('groups:');
    lines.push(`${this._indent(1)}- group_id: < ${this._formatLabelSpacing('string')} >`);
    lines.push(`${this._indent(1)}  elements:`);
    lines.push(`${this._indent(2)}  - id: < ${this._formatLabelSpacing('string')} >`);

    const elementTypeValues: string[] = [];
    for (const schema of builtInElementSchemas) {
      const shape = this._getObjectShapeFromSchema(schema as unknown as ZodAny);
      const typeValues = this._getEnumValues(shape['type']);
      for (const value of typeValues) if (!elementTypeValues.includes(value)) elementTypeValues.push(value);
    }
    const typeUnion = elementTypeValues.length ? elementTypeValues.join(' | ') : 'string';
    lines.push(`${this._indent(2)}    type: < ${typeUnion} >`);
    for (const key of shownCoreKeys) {
      const refShape = (this._getObjectShapeFromSchema(baseElementSchema as unknown as ZodAny) as ZodShape)[key];
      const unwrapped = this._unwrapSchema(refShape);
      const tn = this._getSchemaTypeName(unwrapped);
      if (tn === 'ZodObject') {
        lines.push(`${this._indent(2)}    ${key}:`);
        const subShape = this._getObjectShapeFromSchema(unwrapped);
        for (const subKey of Object.keys(subShape)) {
          lines.push(`${this._indent(3)}      ${subKey}: < ${this._formatLabelSpacing(this._getTypeLabel(subShape[subKey]))} >`);
        }
      } else {
        lines.push(`${this._indent(2)}    ${key}: < ${this._formatLabelSpacing(this._getTypeLabel(refShape))} >`);
      }
    }
    lines.push('');

    lines.push('## Element Types');
    const commonKeys = new Set<string>([
      'id','type','appearance','text','layout','button','state_management','visibility_rules','visibility_triggers','animations','attribute','label','value','unit'
    ]);

    for (const schema of builtInElementSchemas) {
      const shape = this._getObjectShapeFromSchema(schema as unknown as ZodAny);
      const typeDef = shape['type'] as unknown as { _def?: { value?: unknown } };
      const typeName = (typeDef && (typeDef as { _def?: { value?: unknown } })._def && (typeDef as { _def: { value?: unknown } })._def.value) ? String((typeDef as { _def: { value?: unknown } })._def.value) : '<unknown>';
      lines.push('');
      lines.push(`type: ${typeName}`);

      if (shape['entity']) {
        const entityHint = this._formatEntityHint(shape['entity']);
        lines.push(`  entity: ${entityHint}`);
      }

      const baseShapeLocal = this._getObjectShapeFromSchema(baseElementSchema as unknown as ZodAny);
      for (const nested of ['appearance','text','layout','label','value','unit']) {
        if (shape[nested]) {
          this._renderUniqueNested(lines, nested, (baseShapeLocal as ZodShape)[nested], (shape as ZodShape)[nested], 1);
        }
      }

      const extraKeys = Object.keys(shape).filter((key) => !commonKeys.has(key) && key !== 'entity' && key !== 'id' && key !== 'type');
      for (const key of extraKeys) {
        const schemaType = (shape as ZodShape)[key];
        const core = this._unwrapSchema(schemaType);
        const tn = (core as unknown as { _def?: { typeName?: string } })._def?.typeName;
        if (tn === 'ZodObject') {
          this._pushBlock(lines, key, core, 1, true);
        } else if (tn === 'ZodArray') {
          const item = (core as unknown as { _def?: { type?: ZodAny; innerType?: ZodAny } })._def?.type || (core as unknown as { _def?: { innerType?: ZodAny } })._def?.innerType;
          const itemCore = this._unwrapSchema(item as ZodAny);
          if (((itemCore as unknown as { _def?: { typeName?: string } })._def?.typeName) === 'ZodObject') {
            this._renderArrayOf(lines, key, itemCore, 1);
          } else {
            lines.push(`  ${key}: < array >`);
          }
        } else {
          lines.push(`  ${key}: < ${this._formatLabelSpacing(this._getTypeLabel(schemaType))} >`);
        }
      }
    }

    lines.push('');
    lines.push('## Common Definitions');
    this._renderColorDefinition(lines, 0);

    lines.push('');
    this._pushBlock(lines, 'text', textSchema as unknown as ZodAny, 0, false);

    lines.push('');
    this._pushBlock(lines, 'button', buttonSchema as unknown as ZodAny, 0, false);
    lines.push('');
    this._pushBlock(lines, 'action', actionSchema as unknown as ZodAny, 0, false);
    lines.push(`hold_action: < ${this._formatLabelSpacing(this._getTypeLabel(holdActionSchema as unknown as ZodAny))} >`);

    lines.push('');
    this._pushBlock(lines, 'visibility_rules', visibilityRulesSchema as unknown as ZodAny, 0, false);
    lines.push('');
    this._renderArrayOf(lines, 'visibility_triggers', visibilityTriggerSchema as unknown as ZodAny, 0);

    lines.push('');
    this._pushBlock(lines, 'animations', animationsSchema as unknown as ZodAny, 0, false);
    lines.push('');
    this._pushBlock(lines, 'Animation', animationDefinitionSchema as unknown as ZodAny, 0, false);
    this._pushBlock(lines, 'Sequence', animationSequenceSchema as unknown as ZodAny, 0, false);

    lines.push('');
    this._pushBlock(lines, 'element_state_management', elementStateManagementSchema as unknown as ZodAny, 0, false);
    lines.push('');
    this._pushBlock(lines, 'card_state_management', cardStateManagementSchema as unknown as ZodAny, 0, false);

    return lines.join('\n');
  }
}

YamlDefinitionGenerator.run();


