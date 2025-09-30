import { z } from 'zod';

export const actionSchema: z.ZodType<any> = z.object({
  action: z.enum(['call-service', 'navigate', 'url', 'toggle', 'more-info', 'none', 'set-state', 'toggle-state']),
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
      exemptions: z.array(z.object({ user: z.string() })).optional(),
    }),
  ]).optional(),
});

export const multiActionSchema = z.union([actionSchema, z.array(actionSchema)]);

export const holdActionSchema = z.union([
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
  }, { message: 'hold must specify "action" or "actions"' }),
]);

export const buttonSchema = z.object({
  enabled: z.boolean().optional(),
  actions: z.object({
    tap: multiActionSchema.optional(),
    hold: holdActionSchema.optional(),
    double_tap: multiActionSchema.optional(),
  }).optional(),
}).optional();

export type Action = z.infer<typeof actionSchema>;


