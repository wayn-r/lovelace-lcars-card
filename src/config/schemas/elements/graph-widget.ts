import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { colorSchema } from '../primitives.js';

const graphEntityItemSchema = z.object({
  id: z.string(),
  color: colorSchema.optional(),
  toggleable: z.boolean().optional(),
  animated: z.boolean().optional(),
  duration: z.number().optional(),
  label: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  attribute: z.string().optional(),
});

export const graphEntitySchema = z.union([
  z.string(),
  z.array(z.union([z.string(), graphEntityItemSchema])),
]);

export const graphWidgetSchema = baseElementSchema.extend({
  type: z.literal('graph-widget'),
  entity: graphEntitySchema,
  grid: z.object({
    num_lines: z.number().default(6),
    fill: colorSchema.optional(),
    label_fill: colorSchema.optional(),
  }).optional(),
});


