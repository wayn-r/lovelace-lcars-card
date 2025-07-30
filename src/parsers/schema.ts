import { z } from 'zod';

/*
  Typed configuration layer based on the existing YAML configuration definition in src/types.ts.
  This is an initial draft – the goal is to provide strict runtime validation for configs while we
  gradually migrate the codebase to consume the typed result instead of performing manual shape
  conversions.
*/

// -----------------------------------------------------------------------------
// Primitive helpers
// -----------------------------------------------------------------------------

// Numeric or string based length (eg. 100, "100", "100px", "25%")
const sizeSchema = z.union([z.number(), z.string()]);

// State value string (kept loose for now – we will narrow once the state machine DSL is finalised)
const stateString = z.string();

// Very permissive colour value placeholder.  Will be refined once the colour system stabilises.
// Accepts: CSS string, RGB array, dynamic colour config object, stateful colour config object, etc.
const colorValueSchema = z.any();

// -----------------------------------------------------------------------------
// Appearance & Text
// -----------------------------------------------------------------------------

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
  // Logger widget specific properties
  max_lines: z.number().optional(),
  line_spacing: sizeSchema.optional(),
  text_color: colorValueSchema.optional(),
  color_cycle: z.array(z.object({
    color: colorValueSchema,
    duration: z.number(),
  })).optional(),
});

// -----------------------------------------------------------------------------
// Layout (anchor / stretch)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Button & Actions (kept permissive for first pass)
// -----------------------------------------------------------------------------

// Unified Action schema matching the Action interface in types.ts
const actionSchema: z.ZodType<any> = z.object({
  action: z.enum(['call-service', 'navigate', 'url', 'toggle', 'more-info', 'none', 'set_state', 'toggle_state']),
  
  // Home Assistant service actions
  service: z.string().optional(),
  service_data: z.record(z.any()).optional(),
  target: z.record(z.any()).optional(),
  
  // Navigation actions
  navigation_path: z.string().optional(),
  
  // URL actions
  url_path: z.string().optional(),
  
  // Entity actions
  entity: z.string().optional(),
  
  // Custom state management actions
  target_element_ref: z.string().optional(),
  state: z.string().optional(),
  states: z.array(z.string()).optional(),
  actions: z.array(z.lazy(() => actionSchema)).optional(), // Recursive for multi-action sequences
  
  // Common properties
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

// Hold can optionally include a duration plus either a single action or array of actions
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

// Update buttonSchema to use the new helpers
const buttonSchema = z.object({
  enabled: z.boolean().optional(),
  actions: z.object({
    tap: multiActionSchema.optional(),
    hold: holdActionSchema.optional(),
    double_tap: multiActionSchema.optional(),
  }).optional(),
}).optional();

// -----------------------------------------------------------------------------
// Entity Text Widget
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Element
// -----------------------------------------------------------------------------

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
  'weather-icon',
]).or(z.string()); // Allow unknown types for backwards compatibility

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
  state_management: z.any().optional(), // To be replaced when state machine typing is implemented
  visibility_rules: z.any().optional(),
  visibility_triggers: z.any().optional(),
  animations: z.any().optional(),
  
  // Entity text widget specific fields
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
            }),
        ])
    ),
  ]).optional(),
  attribute: z.string().optional(),
  label: entityTextLabelSchema.optional(),
  value: entityTextValueSchema.optional(),
});

const refinedElementSchema = elementSchema.refine(data => {
    if (data.type === 'graph-widget') {
        if (!data.entity) return false;
        if (Array.isArray(data.entity)) {
            return data.entity.length > 0 && data.entity.every(e => {
                if (typeof e === 'string') return e.length > 0;
                if (typeof e === 'object' && e !== null && 'id' in e) {
                    return typeof (e as {id:any}).id === 'string' && (e as {id:string}).id.length > 0;
                }
                return false;
            });
        }
        return typeof data.entity === 'string' && data.entity.length > 0;
    }
    if (data.type === 'entity-text-widget' || data.type === 'weather-icon') {
        return typeof data.entity === 'string' && data.entity.length > 0;
    }
    return true;
}, {
    message: "For 'graph-widget', 'entity' must be a non-empty string or a non-empty array of valid entities (string or object with id). For 'entity-text-widget' and 'weather-icon', 'entity' must be a non-empty string.",
    path: ['entity'],
});

// -----------------------------------------------------------------------------
// Group & Card
// -----------------------------------------------------------------------------

const groupSchema = z.object({
  group_id: z.string().min(1),
  elements: z.array(refinedElementSchema), // Allow empty arrays for backward compatibility
});

const cardConfigSchema = z.object({
  type: z.string().default('lovelace-lcars-card'),
  title: z.string().optional(),
  groups: z.array(groupSchema), // Allow empty arrays for backward compatibility
  state_management: z.any().optional(),
});

export const lcarsCardConfigSchema = cardConfigSchema;
export type ParsedConfig = z.infer<typeof lcarsCardConfigSchema>;

/**
 * Runtime configuration validation helper.
 *
 * Throws a ZodError if validation fails.
 */
export function parseCardConfig(config: unknown): ParsedConfig {
  return lcarsCardConfigSchema.parse(config);
} 