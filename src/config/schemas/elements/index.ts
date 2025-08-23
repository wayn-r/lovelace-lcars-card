import { z } from 'zod';
import { graphWidgetSchema } from './graph-widget.js';
import { entityTextWidgetSchema } from './entity-text-widget.js';
import { entityMetricWidgetSchema } from './entity-metric-widget.js';
import { verticalSliderSchema } from './vertical-slider.js';
import { weatherIconSchema } from './weather-icon.js';
import { baseElementSchema } from './base.js';
import { rectangleSchema } from './rectangle.js';
import { textElementSchema } from './text.js';
import { endcapSchema } from './endcap.js';
import { elbowSchema } from './elbow.js';
import { topHeaderSchema } from './top-header.js';

export const builtInElementSchemas: [
  typeof rectangleSchema,
  typeof textElementSchema,
  typeof endcapSchema,
  typeof elbowSchema,
  typeof topHeaderSchema,
  typeof graphWidgetSchema,
  typeof entityTextWidgetSchema,
  typeof entityMetricWidgetSchema,
  typeof verticalSliderSchema,
  typeof weatherIconSchema,
] = [
  rectangleSchema,
  textElementSchema,
  endcapSchema,
  elbowSchema,
  topHeaderSchema,
  graphWidgetSchema,
  entityTextWidgetSchema,
  entityMetricWidgetSchema,
  verticalSliderSchema,
  weatherIconSchema,
];

export const discriminatedElementSchema: z.ZodDiscriminatedUnion<'type', any> = z.discriminatedUnion('type', builtInElementSchemas as unknown as [
  typeof rectangleSchema,
  typeof textElementSchema,
  typeof endcapSchema,
  typeof elbowSchema,
  typeof topHeaderSchema,
  typeof graphWidgetSchema,
  typeof entityTextWidgetSchema,
  typeof entityMetricWidgetSchema,
  typeof verticalSliderSchema,
  typeof weatherIconSchema,
]);

export type DiscriminatedElement = z.infer<typeof discriminatedElementSchema>;


