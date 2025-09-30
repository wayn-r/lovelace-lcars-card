import { z } from 'zod';
import { colorSchema, sizeSchema } from './primitives.js';

export const textSchema = z.object({
  content: z.string().optional(),
  fill: colorSchema.optional(),
  font_family: z.string().optional(),
  font_size: z.number().optional(),
  font_weight: z.union([z.string(), z.number()]).optional(),
  letter_spacing: z.union([z.string(), z.number()]).optional(),
  text_anchor: z.enum(['start', 'middle', 'end']).optional(),
  dominant_baseline: z.string().optional(),
  text_transform: z.string().optional(),
  cutout: z.boolean().optional(),
  elbow_text_position: z.enum(['arm', 'body']).optional(),
  left_content: z.string().optional(),
  right_content: z.string().optional(),
  offset_x: z.union([z.number(), z.string()]).optional(),
  offset_y: z.union([z.number(), z.string()]).optional(),
  max_lines: z.number().optional(),
  line_spacing: sizeSchema.optional(),
  text_color: colorSchema.optional(),
  color_cycle: z.array(z.object({
    color: colorSchema,
    duration: z.number(),
  })).optional(),
});

export const textOptionsSchema = z.object({
  content: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  font_family: z.string().optional(),
  font_weight: z.union([z.string(), z.number()]).optional(),
  fill: colorSchema.optional(),
  offset_x: z.number().optional(),
  text_transform: z.string().optional(),
  cutout: z.boolean().optional(),
});

export const entityTextLabelSchema = textOptionsSchema;
export const entityTextValueSchema = textOptionsSchema;
export const entityMetricUnitSchema = textOptionsSchema;

export type TextConfig = z.infer<typeof textSchema>;


