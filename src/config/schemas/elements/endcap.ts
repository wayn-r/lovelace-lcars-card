import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { appearanceSchema } from '../appearance.js';

export const endcapSchema = baseElementSchema.extend({
  type: z.literal('endcap'),
  appearance: appearanceSchema.extend({
    direction: z.enum(['left', 'right']).optional(),
  }).optional(),
});


