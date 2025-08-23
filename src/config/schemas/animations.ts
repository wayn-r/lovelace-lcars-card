import { z } from 'zod';

export const fadeParamsSchema = z.object({
  opacity_start: z.number().optional(),
  opacity_end: z.number().optional(),
}).strict();

export const slideParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']),
  distance: z.string(),
  opacity_start: z.number().optional(),
  opacity_end: z.number().optional(),
  movement: z.enum(['in', 'out']).optional(),
}).strict();

export const scaleParamsSchema = z.object({
  scale_start: z.number().optional(),
  scale_end: z.number().optional(),
  transform_origin: z.string().optional(),
}).strict();

export const colorParamsSchema = z.object({
  property: z.enum(['fill', 'stroke', 'color']).optional(),
  color_start: z.string().optional(),
  color_end: z.string().optional(),
}).strict();

export const animationDefinitionSchema = z.object({
  type: z.enum(['fade', 'slide', 'scale', 'color', 'custom_gsap']),
  fade_params: fadeParamsSchema.optional(),
  slide_params: slideParamsSchema.optional(),
  scale_params: scaleParamsSchema.optional(),
  color_params: colorParamsSchema.optional(),
  custom_gsap_vars: z.record(z.any()).optional(),
  duration: z.number(),
  delay: z.number().optional(),
  ease: z.string().optional(),
  repeat: z.number().optional(),
  yoyo: z.boolean().optional(),
  target_self: z.boolean().optional(),
  target_elements_ref: z.array(z.string()).optional(),
  target_groups_ref: z.array(z.string()).optional(),
}).strict();

export const animationStepSchema = z.object({
  target_self: z.boolean().optional(),
  target_elements_ref: z.array(z.string()).optional(),
  target_groups_ref: z.array(z.string()).optional(),
  type: z.enum(['fade', 'slide', 'scale', 'color', 'custom_gsap']),
  fade_params: fadeParamsSchema.optional(),
  slide_params: slideParamsSchema.optional(),
  scale_params: scaleParamsSchema.optional(),
  color_params: colorParamsSchema.optional(),
  custom_gsap_vars: z.record(z.any()).optional(),
  duration: z.number(),
  delay: z.number().optional(),
  ease: z.string().optional(),
  repeat: z.number().optional(),
  yoyo: z.boolean().optional(),
}).strict();

export const animationStepGroupSchema = z.object({
  index: z.number(),
  animations: z.array(animationStepSchema),
}).strict();

export const animationSequenceSchema = z.object({
  target_self: z.boolean().optional(),
  target_elements_ref: z.array(z.string()).optional(),
  target_groups_ref: z.array(z.string()).optional(),
  steps: z.array(animationStepGroupSchema),
}).strict();

export const stateChangeAnimationSchema = animationDefinitionSchema.extend({
  from_state: z.string(),
  to_state: z.string(),
});

export const animationsSchema = z.object({
  on_load: z.union([animationDefinitionSchema, animationSequenceSchema]).optional(),
  on_show: z.union([animationDefinitionSchema, animationSequenceSchema]).optional(),
  on_hide: z.union([animationDefinitionSchema, animationSequenceSchema]).optional(),
  on_state_change: z.array(stateChangeAnimationSchema).optional(),
}).strict();

export type AnimationDefinition = z.infer<typeof animationDefinitionSchema>;
export type AnimationSequence = z.infer<typeof animationSequenceSchema>;
export type AnimationStep = z.infer<typeof animationStepSchema>;
export type AnimationStepGroup = z.infer<typeof animationStepGroupSchema>;
export type AnimationsConfig = z.infer<typeof animationsSchema>;


