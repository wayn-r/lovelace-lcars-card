import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { appearanceSchema } from '../appearance.js';
import { layoutSchema } from '../layout.js';
import { sizeSchema } from '../primitives.js';

export const elbowSchema = baseElementSchema.extend({
  type: z.literal('elbow'),
  appearance: appearanceSchema.extend({
    orientation: z.enum(['top-left','top-right','bottom-left','bottom-right']).optional(),
  }).optional(),
  layout: layoutSchema.extend({
    bodyWidth: sizeSchema.optional(),
    armHeight: sizeSchema.optional(),
  }).optional(),
});


