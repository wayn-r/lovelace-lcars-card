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
  bodyWidth: z.number().optional(),
  armHeight: z.number().optional(),
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
  elbow_text_position: z.enum(['arm', 'body']).optional(),
  left_content: z.string().optional(),
  right_content: z.string().optional(),
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

const actionSchema = z.any(); // TODO: replace with unified Action model in roadmap step 2

const buttonSchema = z.object({
  enabled: z.boolean(),
  actions: z.object({
    tap: actionSchema.optional(),
    hold: actionSchema.optional(),
    double_tap: actionSchema.optional(),
  }).partial().optional(),
}).partial();

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
]);

const elementSchema = z.object({
  id: z.string().min(1),
  type: elementTypeEnum,
  appearance: appearanceSchema.optional(),
  text: textSchema.optional(),
  layout: layoutSchema.optional(),
  button: buttonSchema.optional(),
  state_management: z.any().optional(), // To be replaced when state machine typing is implemented
  visibility_rules: z.any().optional(),
  visibility_triggers: z.any().optional(),
  animations: z.any().optional(),
});

// -----------------------------------------------------------------------------
// Group & Card
// -----------------------------------------------------------------------------

const groupSchema = z.object({
  group_id: z.string().min(1),
  elements: z.array(elementSchema).min(1),
});

const cardConfigSchema = z.object({
  type: z.string().default('lovelace-lcars-card'),
  title: z.string().optional(),
  groups: z.array(groupSchema).min(1),
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