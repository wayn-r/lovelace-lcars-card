import { z } from 'zod';
import { baseElementSchema } from './base.js';
import { textSchema } from '../text.js';

const topHeaderTextSchema = textSchema.pick({
  left_content: true,
  right_content: true,
  font_family: true,
  font_weight: true,
  letter_spacing: true,
  text_transform: true,
  content: false as any,
} as any).passthrough();

export const topHeaderSchema = baseElementSchema.extend({
  type: z.literal('top_header'),
  text: topHeaderTextSchema.optional(),
});


