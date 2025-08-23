import { z } from 'zod';
import { appearanceSchema } from '../appearance.js';
import { textSchema } from '../text.js';
import { layoutSchema } from '../layout.js';
import { buttonSchema } from '../actions.js';
import { colorSchema } from '../primitives.js';
import { animationsSchema } from '../animations.js';
import { visibilityRulesSchema, visibilityTriggerSchema } from '../visibility.js';
import { elementStateManagementSchema } from '../state.js';

export const baseElementSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  appearance: appearanceSchema.optional(),
  text: textSchema.optional(),
  layout: layoutSchema.optional(),
  button: buttonSchema.optional(),
  state_management: elementStateManagementSchema.optional(),
  visibility_rules: visibilityRulesSchema.optional(),
  visibility_triggers: z.array(visibilityTriggerSchema).optional(),
  animations: animationsSchema.optional(),
  attribute: z.string().optional(),
});

export type BaseElementConfig = z.infer<typeof baseElementSchema>;


