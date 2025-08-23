import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { appearanceSchema } from '../appearance.js';

export const chiselEndcapSchema = baseElementSchema.extend({
  type: z.literal('chisel-endcap'),
  appearance: appearanceSchema.extend({
    direction: z.enum(['left', 'right']).optional(),
  }).optional(),
});


