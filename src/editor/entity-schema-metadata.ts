import { builtInElementSchemas } from '../config/schemas/elements/index.js';
import {
  ZodFirstPartyTypeKind,
  ZodTypeAny,
  ZodObject,
} from 'zod';

export type EntityFieldType = 'entity' | 'attribute';

export interface EntityFieldSpec {
  key: 'id' | 'attribute';
  type: EntityFieldType;
  label: string;
  optional: boolean;
}

export interface EntitySchemaMetadata {
  hasEntity: boolean;
  allowMultiple: boolean;
  allowStringEntries: boolean;
  allowObjectEntries: boolean;
  fieldSpecs: EntityFieldSpec[];
  defaultEntryType: 'string' | 'object';
  maxItems?: number;
}

type AnalysisContext = 'root' | 'arrayItem';

type MutableAnalysis = {
  allowArray: boolean;
  singleAllowsString: boolean;
  singleAllowsObject: boolean;
  arrayAllowsString: boolean;
  arrayAllowsObject: boolean;
  objectHasId: boolean;
  objectHasAttribute: boolean;
};

const DEFAULT_ANALYSIS: MutableAnalysis = {
  allowArray: false,
  singleAllowsString: false,
  singleAllowsObject: false,
  arrayAllowsString: false,
  arrayAllowsObject: false,
  objectHasId: false,
  objectHasAttribute: false,
};

const MAX_ITEMS_OVERRIDES: Record<string, number> = {
  'entity-text-widget': 2,
  'entity-metric-widget': 2,
};

const metadataRegistry: Map<string, EntitySchemaMetadata> = buildMetadataRegistry();

function buildMetadataRegistry(): Map<string, EntitySchemaMetadata> {
  const registry = new Map<string, EntitySchemaMetadata>();

  for (const schema of builtInElementSchemas) {
    const shape: Record<string, ZodTypeAny> = (schema as any).shape;
    const typeLiteral = shape?.type;
    if (!typeLiteral || typeLiteral._def?.typeName !== ZodFirstPartyTypeKind.ZodLiteral) {
      continue;
    }

    const typeValue = String(typeLiteral._def.value);
    const entitySchema = shape?.entity as ZodTypeAny | undefined;

    if (!entitySchema) {
      continue;
    }

    const analysis = analyseEntitySchema(entitySchema);
    const fieldSpecs = buildFieldSpecs(analysis);
    const allowStringEntries = analysis.singleAllowsString || analysis.arrayAllowsString;
    const allowObjectEntries = analysis.singleAllowsObject || analysis.arrayAllowsObject;
    const allowMultiple = analysis.allowArray;
    const defaultEntryType: 'string' | 'object' = allowStringEntries ? 'string' : 'object';

    const metadata: EntitySchemaMetadata = {
      hasEntity: true,
      allowMultiple,
      allowStringEntries,
      allowObjectEntries,
      fieldSpecs,
      defaultEntryType,
      maxItems: MAX_ITEMS_OVERRIDES[typeValue],
    };

    registry.set(typeValue, metadata);
  }

  return registry;
}

function analyseEntitySchema(schema: ZodTypeAny): MutableAnalysis {
  const analysis: MutableAnalysis = { ...DEFAULT_ANALYSIS };
  traverseEntitySchema(schema, 'root', analysis);
  return analysis;
}

function traverseEntitySchema(
  schema: ZodTypeAny,
  context: AnalysisContext,
  analysis: MutableAnalysis
): void {
  const unwrapped = unwrap(schema);
  const typeName = unwrapped._def?.typeName;

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      if (context === 'root') {
        analysis.singleAllowsString = true;
      } else {
        analysis.arrayAllowsString = true;
      }
      break;

    case ZodFirstPartyTypeKind.ZodObject:
      recordObjectFields(unwrapped as ZodObject<any>, analysis);
      if (context === 'root') {
        analysis.singleAllowsObject = true;
      } else {
        analysis.arrayAllowsObject = true;
      }
      break;

    case ZodFirstPartyTypeKind.ZodArray:
      analysis.allowArray = true;
      traverseEntitySchema((unwrapped as any)._def.type, 'arrayItem', analysis);
      break;

    case ZodFirstPartyTypeKind.ZodUnion:
    case ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
      for (const option of (unwrapped as any)._def.options) {
        traverseEntitySchema(option, context, analysis);
      }
      break;

    case ZodFirstPartyTypeKind.ZodLazy:
      traverseEntitySchema((unwrapped as any)._def.getter(), context, analysis);
      break;

    default:
      // Unsupported type for entity analysis; nothing to record.
      break;
  }
}

function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let current: ZodTypeAny = schema;

  while (true) {
    const typeName = current._def?.typeName;

    if (typeName === ZodFirstPartyTypeKind.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    if (
      typeName === ZodFirstPartyTypeKind.ZodOptional ||
      typeName === ZodFirstPartyTypeKind.ZodNullable ||
      typeName === ZodFirstPartyTypeKind.ZodDefault
    ) {
      current = current._def.innerType;
      continue;
    }

    break;
  }

  return current;
}

function recordObjectFields(objectSchema: ZodObject<any>, analysis: MutableAnalysis): void {
  const shape: Record<string, ZodTypeAny> = objectSchema.shape;
  if (shape.id) {
    analysis.objectHasId = true;
  }
  if (shape.attribute) {
    analysis.objectHasAttribute = true;
  }
}

function buildFieldSpecs(analysis: MutableAnalysis): EntityFieldSpec[] {
  const specs: EntityFieldSpec[] = [
    {
      key: 'id',
      type: 'entity',
      label: 'Entity',
      optional: false,
    },
  ];

  if (analysis.objectHasAttribute) {
    specs.push({
      key: 'attribute',
      type: 'attribute',
      label: 'Attribute (optional)',
      optional: true,
    });
  }

  return specs;
}

export function getEntitySchemaMetadata(type: string): EntitySchemaMetadata | undefined {
  return metadataRegistry.get(type);
}

