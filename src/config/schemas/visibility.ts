import { z } from 'zod';

export const visibilityConditionSchema: z.ZodType<any> = z.lazy(() => z.object({
  type: z.enum(['state', 'entity_state', 'group']),
  negate: z.boolean().optional(),

  // state
  target_id: z.string().optional(),
  state: z.string().optional(),

  // entity_state
  entity_id: z.string().optional(),
  attribute: z.string().optional(),
  value: z.any().optional(),

  // group
  operator: z.enum(['and', 'or', 'not', 'xor']).optional(),
  conditions: z.array(visibilityConditionSchema).optional(),
}).strict());

export const visibilityRulesSchema = z.object({
  operator: z.enum(['and', 'or', 'not', 'xor']),
  conditions: z.array(visibilityConditionSchema),
}).strict();

export const triggerSourceSchema = z.object({
  element_id_ref: z.string(),
  event: z.enum(['hover', 'click']),
}).strict();

export const hoverOptionsSchema = z.object({
  mode: z.enum(['show_on_enter_hide_on_leave', 'toggle_on_enter_hide_on_leave']).optional(),
  hide_delay: z.number().optional(),
}).strict();

export const clickOptionsSchema = z.object({
  revert_on_click_outside: z.boolean().optional(),
}).strict();

export const targetSchema = z.object({
  type: z.enum(['element', 'group']),
  id: z.string(),
}).strict();

export const visibilityTriggerSchema = z.object({
  action: z.enum(['show', 'hide', 'toggle']),
  trigger_source: triggerSourceSchema,
  targets: z.array(targetSchema).optional(),
  hover_options: hoverOptionsSchema.optional(),
  click_options: clickOptionsSchema.optional(),
}).strict();

export type VisibilityRulesConfig = z.infer<typeof visibilityRulesSchema>;
export type VisibilityTriggerConfig = z.infer<typeof visibilityTriggerSchema>;


