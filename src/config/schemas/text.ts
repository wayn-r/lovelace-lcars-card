import { z } from 'zod';
import { colorSchema, sizeSchema } from './primitives.js';

export const textSchema = z.object({
  content: z.string().optional(),
  fill: colorSchema.optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  letterSpacing: z.union([z.string(), z.number()]).optional(),
  textAnchor: z.enum(['start', 'middle', 'end']).optional(),
  dominantBaseline: z.string().optional(),
  textTransform: z.string().optional(),
  cutout: z.boolean().optional(),
  elbow_text_position: z.enum(['arm', 'body']).optional(),
  left_content: z.string().optional(),
  right_content: z.string().optional(),
  offsetX: z.union([z.number(), z.string()]).optional(),
  offsetY: z.union([z.number(), z.string()]).optional(),
  max_lines: z.number().optional(),
  line_spacing: sizeSchema.optional(),
  text_color: colorSchema.optional(),
  color_cycle: z.array(z.object({
    color: colorSchema,
    duration: z.number(),
  })).optional(),
});

export const entityTextLabelSchema = z.object({
  content: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fill: colorSchema.optional(),
  offsetX: z.number().optional(),
  textTransform: z.string().optional(),
  cutout: z.boolean().optional(),
});

export const entityTextValueSchema = z.object({
  content: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fill: colorSchema.optional(),
  offsetX: z.number().optional(),
  textTransform: z.string().optional(),
});

export const entityMetricUnitSchema = z.object({
  content: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fill: colorSchema.optional(),
  offsetX: z.number().optional(),
  textTransform: z.string().optional(),
  cutout: z.boolean().optional(),
});

export type TextConfig = z.infer<typeof textSchema>;


