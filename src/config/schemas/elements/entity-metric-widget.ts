import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { textOptionsSchema, textSchema } from '../text.js';

export const entityMetricEntitySchema = z.union([
  z.string(),
  z.array(z.string()).refine(arr => arr.length > 0 && arr.length <= 2, {
    message: 'entity array must have 1 or 2 items',
  }),
]);

export const entityMetricWidgetSchema = baseElementSchema.extend({
  type: z.literal('entity-metric-widget'),
  entity: entityMetricEntitySchema,
  text: textSchema.extend({
    label: textOptionsSchema.optional(),
    value: textOptionsSchema.optional(),
    unit: textOptionsSchema.optional(),
  }).optional(),
});


