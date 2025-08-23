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
});

export type AppearanceConfig = z.infer<typeof appearanceSchema>;


