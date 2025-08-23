import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { entityTextLabelSchema, entityTextValueSchema } from '../text.js';

const stringPairSchema = z.tuple([z.string(), z.string()]);

export const entityTextEntitySchema = z.union([
  z.string(),
  z.array(z.string()).refine(arr => arr.length > 0 && arr.length <= 2, {
    message: 'entity array must have 1 or 2 items',
  }),
]);

export const entityTextWidgetSchema = baseElementSchema.extend({
  type: z.literal('entity-text-widget'),
  entity: entityTextEntitySchema,
  label: entityTextLabelSchema.optional(),
  value: entityTextValueSchema.optional(),
});


