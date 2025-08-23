import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { appearanceSchema } from '../appearance.js';

export const elbowSchema = baseElementSchema.extend({
  type: z.literal('elbow'),
  appearance: appearanceSchema.extend({
    orientation: z.enum(['top-left','top-right','bottom-left','bottom-right']).optional(),
    bodyWidth: z.union([z.number(), z.string()]).optional(),
    armHeight: z.union([z.number(), z.string()]).optional(),
  }).optional(),
});


