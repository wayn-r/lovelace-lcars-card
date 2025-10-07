import { z } from 'zod';

export const ANCHOR_POINT_OPTIONS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export type AnchorPoint = typeof ANCHOR_POINT_OPTIONS[number];

const anchorPointEnum = z.enum(ANCHOR_POINT_OPTIONS);

export const anchorSchema = z.object({
  to: z.string(),
  element_point: anchorPointEnum,
  target_point: anchorPointEnum,
});

const anchorPointLookup: Record<string, AnchorPoint> = ANCHOR_POINT_OPTIONS.reduce(
  (acc, point) => {
    const key = point.replace(/[\s_-]+/g, '').toLowerCase();
    acc[key] = point;
    return acc;
  },
  {} as Record<string, AnchorPoint>
);

export function normalizeAnchorPoint(point?: string): AnchorPoint | undefined {
  if (!point || typeof point !== 'string') {
    return undefined;
  }

  const normalizedKey = point.replace(/[\s_-]+/g, '').toLowerCase();
  return anchorPointLookup[normalizedKey];
}

export const stretchTargetSchema = z.object({
  id: z.string(),
  edge: z.string(),
  padding: z.number().optional(),
});

export const stretchSchema = z.object({
  target1: stretchTargetSchema,
  target2: stretchTargetSchema.optional(),
});

export const layoutSchema = z.object({
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  offset_x: z.union([z.number(), z.string()]).optional(),
  offset_y: z.union([z.number(), z.string()]).optional(),
  anchor: anchorSchema.optional(),
  secondary_anchor: anchorSchema.optional(),
  stretch: stretchSchema.optional(),
});

export type LayoutConfig = z.infer<typeof layoutSchema>;
