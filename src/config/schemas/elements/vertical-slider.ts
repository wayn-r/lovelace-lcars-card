import { z } from 'zod';
import { baseElementSchema } from './base.js';

const sliderEntityItemSchema = z.object({
  id: z.string(),
  color: z.any().optional(),
  label: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  attribute: z.string().optional(),
});

export const sliderEntitySchema = z.union([
  z.string(),
  z.array(z.union([z.string(), sliderEntityItemSchema])),
]);

export const verticalSliderSchema = baseElementSchema.extend({
  type: z.literal('vertical-slider'),
  entity: sliderEntitySchema,
});


