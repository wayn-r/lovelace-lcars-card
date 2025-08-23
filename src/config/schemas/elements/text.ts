import { z } from 'zod';
import { baseElementSchema } from './base.js';

export const textElementSchema = baseElementSchema.extend({
  type: z.literal('text'),
});


