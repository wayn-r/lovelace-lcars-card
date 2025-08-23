import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { appearanceSchema } from '../appearance.js';

export const endcapSchema = baseElementSchema.extend({
  type: z.literal('endcap'),
  appearance: appearanceSchema.extend({
    chisel: z.boolean().default(false),
    direction: z.enum(['left', 'right']).optional(),
  }).optional(),
});


