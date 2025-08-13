import { z } from 'zod';

// Primitive helpers
const sizeSchema = z.union([z.number(), z.string()]);

const stateString = z.string();

const colorValueSchema = z.any();

const appearanceSchema = z.object({
  fill: colorValueSchema.optional(),
  stroke: colorValueSchema.optional(),
  strokeWidth: z.number().optional(),
  cornerRadius: z.number().optional(),
  direction: z.enum(['left', 'right']).optional(),
  orientation: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  bodyWidth: sizeSchema.optional(),
  armHeight: sizeSchema.optional(),
});

const textSchema = z.object({
  content: z.string().optional(),
  fill: colorValueSchema.optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  letterSpacing: z.union([z.string(), z.number()]).optional(),
  textAnchor: z.enum(['start', 'middle', 'end']).optional(),
  dominantBaseline: z.string().optional(),
  textTransform: z.string().optional(),
  cutout: z.boolean().optional(),
  elbow_text_position: z.enum(['arm', 'body']).optional(),
  left_content: z.string().optional(),
  right_content: z.string().optional(),
  offsetX: z.union([z.number(), z.string()]).optional(),
  offsetY: z.union([z.number(), z.string()]).optional(),
  max_lines: z.number().optional(),
  line_spacing: sizeSchema.optional(),
  text_color: colorValueSchema.optional(),
  color_cycle: z.array(z.object({
    color: colorValueSchema,
    duration: z.number(),
  })).optional(),
});

const anchorSchema = z.object({
  to: z.string(),
  element_point: z.string(),
  target_point: z.string(),
});

const stretchTargetSchema = z.object({
  id: z.string(),
  edge: z.string(),
  padding: z.number().optional(),
});

const stretchSchema = z.object({
  target1: stretchTargetSchema,
  target2: stretchTargetSchema.optional(),
});

const layoutSchema = z.object({
  width: sizeSchema.optional(),
  height: sizeSchema.optional(),
  offsetX: sizeSchema.optional(),
  offsetY: sizeSchema.optional(),
  anchor: anchorSchema.optional(),
  stretch: stretchSchema.optional(),
});

const actionSchema: z.ZodType<any> = z.object({
  action: z.enum(['call-service', 'navigate', 'url', 'toggle', 'more-info', 'none', 'set_state', 'toggle_state']),
  
  service: z.string().optional(),
  service_data: z.record(z.any()).optional(),
  target: z.record(z.any()).optional(),
  
  navigation_path: z.string().optional(),
  
  url_path: z.string().optional(),
  
  entity: z.string().optional(),
  
  target_element_ref: z.string().optional(),
  state: z.string().optional(),
  states: z.array(z.string()).optional(),
  actions: z.array(z.lazy(() => actionSchema)).optional(),
  
  confirmation: z.union([
    z.boolean(),
    z.object({
      text: z.string().optional(),
      exemptions: z.array(z.object({
        user: z.string()
      })).optional()
    })
  ]).optional()
});

const multiActionSchema = z.union([actionSchema, z.array(actionSchema)]);

const holdActionSchema = z.union([
  actionSchema,
  z.array(actionSchema),
  z.object({
    duration: z.number().optional(),
    action: actionSchema.optional(),
    actions: z.array(actionSchema).optional(),
  }).refine((val) => {
    return (
      (Array.isArray((val as any).actions) && (val as any).actions.length > 0) ||
      (val as any).action !== undefined
    );
  }, { message: 'hold must specify "action" or "actions"' })
]);

const buttonSchema = z.object({
  enabled: z.boolean().optional(),
  actions: z.object({
    tap: multiActionSchema.optional(),
    hold: holdActionSchema.optional(),
    double_tap: multiActionSchema.optional(),
  }).optional(),
}).optional();

const entityTextLabelSchema = z.object({
  content: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fill: colorValueSchema.optional(),
  offsetX: z.number().optional(),
  textTransform: z.string().optional(),
});

const entityTextValueSchema = z.object({
  content: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fill: colorValueSchema.optional(),
  offsetX: z.number().optional(),
  textTransform: z.string().optional(),
});

const elementTypeEnum = z.enum([
  'rectangle',
  'text',
  'endcap',
  'elbow',
  'chisel-endcap',
  'top_header',
  'entity-text-widget',
  'logger-widget',
  'graph-widget',
  'vertical-slider',
  'weather-icon',
]).or(z.string());

const elementSchema = z.object({
  id: z.string().min(1),
  type: elementTypeEnum,
  grid: z.object({
    num_lines: z.number().optional(),
    fill: colorValueSchema.optional(),
    label_fill: colorValueSchema.optional(),
  }).optional(),
  appearance: appearanceSchema.optional(),
  text: textSchema.optional(),
  layout: layoutSchema.optional(),
  button: buttonSchema.optional(),
  state_management: z.any().optional(),
  visibility_rules: z.any().optional(),
  visibility_triggers: z.any().optional(),
  animations: z.any().optional(),
  
  entity: z.union([
    z.string(),
    z.array(
        z.union([
            z.string(),
            z.object({
                id: z.string(),
                color: z.string().optional(),
                toggleable: z.boolean().optional(),
                animated: z.boolean().optional(),
                duration: z.number().optional(),
                label: z.string().optional(),
                min: z.number().optional(),
                max: z.number().optional(),
                 attribute: z.string().optional(),
            }),
        ])
    ),
  ]).optional(),
  attribute: z.string().optional(),
  label: entityTextLabelSchema.optional(),
  value: entityTextValueSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  spacing: z.number().optional(),
  top_padding: z.number().optional(),
  label_height: z.number().optional(),
  use_floats: z.boolean().optional(),
});

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

const refinedElementSchema = elementSchema.refine(data => {
    if (data.type === 'graph-widget') {
        return isValidEntityConfig(data.entity);
    }
    if (data.type === 'vertical-slider') {
        return isValidEntityConfig(data.entity);
    }
    if (data.type === 'entity-text-widget') {
        if (typeof data.entity === 'string') {
            return data.entity.length > 0;
        }
        if (Array.isArray(data.entity)) {
            return (
                data.entity.length > 0 &&
                data.entity.length <= 2 &&
                data.entity.every(e => typeof e === 'string' && e.length > 0)
            );
        }
        return false;
    }
    if (data.type === 'weather-icon') {
        return typeof data.entity === 'string' && data.entity.length > 0;
    }
    return true;
}, {
    message: "For 'graph-widget', 'entity' must be a non-empty string or a non-empty array of valid entities (string or object with id). For 'entity-text-widget', 'entity' must be a non-empty string or an array of up to two non-empty strings. For 'weather-icon', 'entity' must be a non-empty string.",
    path: ['entity'],
});

const groupSchema = z.object({
  group_id: z.string().min(1),
  elements: z.array(refinedElementSchema),
});

const cardConfigSchema = z.object({
  type: z.string().default('lovelace-lcars-card'),
  title: z.string().optional(),
  groups: z.array(groupSchema),
  state_management: z.any().optional(),
});

export const lcarsCardConfigSchema = cardConfigSchema;
export type ParsedConfig = z.infer<typeof lcarsCardConfigSchema>;

export function parseCardConfig(config: unknown): ParsedConfig {
  return lcarsCardConfigSchema.parse(config);
} 