import { z } from 'zod';

export const elementStateManagementSchema = z.object({
  default_state: z.string().optional(),
  entity_id: z.string().optional(),
  attribute: z.string().optional(),
}).strict();

const memberRefSchema = z.union([
  z.string(),
  z.object({
    type: z.enum(['group', 'element']).optional(),
    id: z.string(),
  }).strict(),
]);

export const stateGroupSchema = z.object({
  group_name: z.string(),
  exclusive: z.boolean(),
  members: z.array(memberRefSchema),
  default_visible: z.string().optional(),
}).strict();

export const stateConfigSchema = z.object({
  name: z.string(),
  visible_elements: z.array(z.string()),
}).strict();

export const animationPhaseSchema = z.object({
  phase: z.enum(['hide', 'show']),
  targets: z.array(z.string()),
  delay: z.number().optional(),
}).strict();

export const transitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.object({
    element_id_ref: z.string(),
    event: z.enum(['hover', 'click']),
  }).strict(),
  animation_sequence: z.array(animationPhaseSchema).optional(),
}).strict();

export const stateMachineSchema = z.object({
  states: z.array(stateConfigSchema),
  transitions: z.array(transitionSchema),
}).strict();

export const cardStateManagementSchema = z.object({
  state_groups: z.array(stateGroupSchema).optional(),
  state_machine: stateMachineSchema.optional(),
}).strict();

export type ElementStateManagementConfig = z.infer<typeof elementStateManagementSchema>;


