import { z } from 'zod';

export const anchorSchema = z.object({
  to: z.string(),
  element_point: z.string(),
  target_point: z.string(),
});

export const stretchTargetSchema = z.object({
  id: z.string(),
  edge: z.string(),
  padding: z.number().optional(),
});

export const stretchSchema = z.object({
  target1: stretchTargetSchema,
  target2: stretchTargetSchema.optional(),
});

export const layoutSchema = z.object({
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  offsetX: z.union([z.number(), z.string()]).optional(),
  offsetY: z.union([z.number(), z.string()]).optional(),
  anchor: anchorSchema.optional(),
  stretch: stretchSchema.optional(),
});

export type LayoutConfig = z.infer<typeof layoutSchema>;


