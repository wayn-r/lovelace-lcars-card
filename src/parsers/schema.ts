import { z } from 'zod';
import { elementStateManagementSchema, cardStateManagementSchema } from '../config/schemas/state.js';
import { appearanceSchema } from '../config/schemas/appearance.js';
import { textSchema } from '../config/schemas/text.js';
import { layoutSchema, anchorSchema, stretchTargetSchema, stretchSchema } from '../config/schemas/layout.js';
import { actionSchema, buttonSchema, holdActionSchema } from '../config/schemas/actions.js';
import { ConfigSchemaRegistry } from '../config/schema-registry.js';
import { discriminatedElementSchema } from '../config/schemas/elements/index.js';
import { baseElementSchema } from '../config/schemas/elements/base.js';

// Primitive helpers moved to shared primitives
const stateString = z.string();


// Allow unknown types by falling back to base element schema to support runtime rectangle fallback
export const elementSchema = z.union([
  discriminatedElementSchema,
  baseElementSchema.extend({ type: z.string() }),
]);

function isValidEntityConfig(entity: unknown): boolean {
  if (!entity) return false;
  if (Array.isArray(entity)) {
    return entity.length > 0 && entity.every(e => {
      if (typeof e === 'string') return e.length > 0;
      if (typeof e === 'object' && e !== null && 'id' in e) {
        return typeof (e as { id: any }).id === 'string' && (e as { id: string }).id.length > 0;
      }
      return false;
    });
  }
  return typeof entity === 'string' && entity.length > 0;
}

export const refinedElementSchema = elementSchema;

export const groupSchema = z.object({
  group_id: z.string().min(1),
  elements: z.array(refinedElementSchema),
});

export const cardConfigSchema = z.object({
  type: z.string().default('lovelace-lcars-card'),
  title: z.string().optional(),
  groups: z.array(groupSchema),
  state_management: cardStateManagementSchema.optional(),
});

export const lcarsCardConfigSchema = cardConfigSchema;
export type ParsedConfig = z.infer<typeof lcarsCardConfigSchema>;
export type AppearanceConfig = z.infer<typeof appearanceSchema>;
export type TextConfig = z.infer<typeof textSchema>;
export type AnchorConfig = z.infer<typeof anchorSchema>;
export type StretchTargetConfig = z.infer<typeof stretchTargetSchema>;
export type StretchConfig = z.infer<typeof stretchSchema>;
export type LayoutConfig = z.infer<typeof layoutSchema>;
export type Action = z.infer<typeof actionSchema>;
export type HoldAction = z.infer<typeof holdActionSchema>;
export type ButtonConfig = z.infer<typeof buttonSchema>;
export type ElementConfig = z.infer<typeof refinedElementSchema>;
export type GroupConfig = z.infer<typeof groupSchema>;
export type LcarsCardConfig = z.infer<typeof lcarsCardConfigSchema>;

export class SchemaParser {
  static parseCardConfig(config: unknown): ParsedConfig {
    return lcarsCardConfigSchema.parse(config);
  }

  static parseCardConfigWithRegistry(config: unknown, registry: ConfigSchemaRegistry): ParsedConfig {
    const parsed = this.parseCardConfig(config);
    if (!parsed.groups) return parsed;
    parsed.groups.forEach((group: any) => {
      group.elements = (group.elements || []).map((el: any) => {
        if (el && typeof el.type === 'string' && registry.has(el.type)) {
          return registry.validateAndNormalizeElement(el.type, el);
        }
        return el;
      });
    });
    return parsed;
  }
}