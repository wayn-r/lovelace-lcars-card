import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { textSchema } from '../text.js';

const topHeaderTextSchema = textSchema.pick({
  left_content: true,
  right_content: true,
  fontFamily: true,
  fontWeight: true,
  letterSpacing: true,
  textTransform: true,
  content: false as any,
} as any).passthrough();

export const topHeaderSchema = baseElementSchema.extend({
  type: z.literal('top_header'),
  text: topHeaderTextSchema.optional(),
});


