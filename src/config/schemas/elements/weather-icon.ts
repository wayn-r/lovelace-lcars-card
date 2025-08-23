import { z } from 'zod';
import { baseElementSchema } from './base.js';

export const weatherIconSchema = baseElementSchema.extend({
  type: z.literal('weather-icon'),
  entity: z.string(),
});


