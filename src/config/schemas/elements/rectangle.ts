import { z } from 'zod';
import { baseElementSchema } from './base.js';

export const rectangleSchema = baseElementSchema.extend({
  type: z.literal('rectangle'),
});


