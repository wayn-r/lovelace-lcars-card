import { z } from 'zod';
import { colorSchema, sizeSchema } from './primitives.js';

export const appearanceSchema = z.object({
  fill: colorSchema.optional(),
  stroke: colorSchema.optional(),
  strokeWidth: z.number().optional(),
  cornerRadius: z.number().optional(),
  rounded: z.enum(['left', 'right', 'both']).optional(),
  direction: z.enum(['left', 'right']).optional(),
  orientation: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  grid: z.object({
    num_lines: z.number().default(6),
    fill: colorSchema.optional(),
    label_fill: colorSchema.optional(),
  }).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  spacing: z.number().optional(),
  top_padding: z.number().optional(),
  label_height: z.number().optional(),
  use_floats: z.boolean().optional(),
});

export type AppearanceConfig = z.infer<typeof appearanceSchema>;


