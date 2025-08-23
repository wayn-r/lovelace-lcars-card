import { z } from 'zod';

// Primitive helpers extracted for reuse across schemas
export const sizeSchema = z.union([z.number(), z.string()]);

// Color schema aligned to runtime types: string | [r,g,b] | dynamic | stateful
const rgbTupleSchema = z.tuple([z.number(), z.number(), z.number()]);

const dynamicColorSchema = z.object({
  entity: z.string(),
  attribute: z.string().optional(),
  mapping: z.record(z.any()),
  default: z.any().optional(),
  interpolate: z.boolean().optional(),
});

// At least one of default/hover/active must be present; extra optional states allowed
const statefulColorCoreSchema = z.object({
  default: z.any().optional(),
  hover: z.any().optional(),
  active: z.any().optional(),
  toggled_off: z.any().optional(),
  toggled_off_hover: z.any().optional(),
  state_map: z.record(z.string()).optional(),
  state_name: z.string().optional(),
});

const statefulColorSchema = statefulColorCoreSchema.refine((obj) => {
  return obj.default !== undefined || obj.hover !== undefined || obj.active !== undefined;
}, { message: 'stateful color must include at least one of default, hover, or active' });

export const colorSchema = z.union([
  z.string(),
  rgbTupleSchema,
  dynamicColorSchema,
  statefulColorSchema,
]);


