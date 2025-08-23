// New file implementing YAML configuration validation for LCARS card
import { LcarsCardConfig, GroupConfig, ElementConfig, Action } from '../types.js';
import { SchemaParser } from '../parsers/schema.js';
import { ActionProcessor } from './action-helpers.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ConfigValidator {
  static validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  // ---------------------------------------------------------------------------
  // 1. Zod schema validation (structure & primitive types)
  // ---------------------------------------------------------------------------
  try {
    SchemaParser.parseCardConfig(config);
  } catch (err: any) {
    const zodErrors = err?.errors as any[] | undefined;
    if (Array.isArray(zodErrors)) {
      zodErrors.forEach((e) => {
        const friendlyPath = ConfigValidator.formatZodPath(e.path, config);
        errors.push(`schema » ${friendlyPath} – ${e.message}`);
      });
    } else if (err instanceof Error) {
      errors.push(`schema – ${err.message}`);
    }
  }

  // Bail early if top-level groups are missing – subsequent checks rely on them.
  const cfg = config as LcarsCardConfig & { groups?: GroupConfig[] };
  if (!Array.isArray(cfg.groups)) {
    errors.push('root.groups – required array is missing');
    return { valid: errors.length === 0, errors };
  }

  // ---------------------------------------------------------------------------
  // 2. Collect IDs for reference checks
  // ---------------------------------------------------------------------------
  const groupIds = new Set<string>();
  const elementIds = new Set<string>();

  cfg.groups.forEach((group) => {
    if (groupIds.has(group.group_id)) {
      errors.push(`duplicate group_id "${group.group_id}"`);
    }
    groupIds.add(group.group_id);

    (group.elements || []).forEach((el) => {
      const fullId = `${group.group_id}.${el.id}`;
      if (elementIds.has(fullId)) {
        errors.push(`duplicate element id "${fullId}"`);
      }
      elementIds.add(fullId);
    });
  });

  // Helper for reference existence checks
  const refExists = (ref: string | undefined): boolean =>
    !!ref && (ref === 'container' || groupIds.has(ref) || elementIds.has(ref));

  // ---------------------------------------------------------------------------
  // 3. Deep validation per element
  // ---------------------------------------------------------------------------
  cfg.groups.forEach((group) => {
    (group.elements || []).forEach((el) => {
      const contextId = `${group.group_id}.${el.id}`;

      // --- Layout.anchor ---------------------------------------------
      const anchorTo = el.layout?.anchor?.to;
      if (anchorTo && !refExists(anchorTo)) {
        errors.push(`${contextId} layout.anchor.to → "${anchorTo}" does not match any element/group`);
      }

      // --- Layout.stretch --------------------------------------------
      const stretchTargets: Array<{ id?: string; path: string }> = [];
      if (el.layout?.stretch?.target1) {
        stretchTargets.push({ id: el.layout.stretch.target1.id, path: 'layout.stretch.target1.id' });
      }
      if (el.layout?.stretch?.target2) {
        stretchTargets.push({ id: el.layout.stretch.target2.id, path: 'layout.stretch.target2.id' });
      }
      stretchTargets.forEach(({ id, path }) => {
        if (id && !refExists(id)) {
          errors.push(`${contextId} ${path} → "${id}" does not match any element/group`);
        }
      });

      // --- Button actions --------------------------------------------
      if (el.button?.enabled && el.button.actions) {
        Object.entries(el.button.actions).forEach(([key, acts]: [string, any]) => {
          if (!acts) return;

          const flatten = (input: any): Action[] => {
            if (Array.isArray(input)) return input;
            if (typeof input === 'object' && input !== null) {
              if (Array.isArray(input.actions)) {
                return input.actions as Action[];
              }
              if (input.action) {
                return [input as Action];
              }
            }
            return [input as Action];
          };

          const flat: Action[] = flatten(acts);
          flat.forEach((act) => {
            // Validate required properties per action type
            ActionProcessor.validateAction(act).forEach((msg: string) => errors.push(`${contextId} button.action – ${msg}`));

            if (
              (act.action === 'set_state' || act.action === 'toggle_state') &&
              act.target_element_ref &&
              !refExists(act.target_element_ref)
            ) {
              errors.push(`${contextId} button.action.target_element_ref → "${act.target_element_ref}" does not exist`);
            }
          });
        });
      }

      // --- Visibility rules ------------------------------------------
      const queue = [...(el.visibility_rules?.conditions || [])];
      while (queue.length) {
        const cond: any = queue.shift();
        if (!cond) continue;
        if (cond.type === 'state' && cond.target_id && !refExists(cond.target_id)) {
          errors.push(`${contextId} visibility_rules.condition.target_id → "${cond.target_id}" does not exist`);
        }
        if (cond.type === 'group' && Array.isArray(cond.conditions)) {
          queue.push(...cond.conditions);
        }
      }
    });
  });

  return { valid: errors.length === 0, errors };
  }

  private static formatZodPath(path: (string | number)[], cfg: any): string {
    if (!path || path.length === 0) return '';

    const parts: string[] = [];
    let cursor: any = cfg;

    for (let i = 0; i < path.length; i++) {
      const seg = path[i];

      if (seg === 'groups' && typeof path[i + 1] === 'number') {
        const idx = path[i + 1] as number;
        const group = Array.isArray(cursor?.groups) ? cursor.groups[idx] : undefined;
        const name = group?.group_id ?? idx;
        parts.push(`groups.${name}`);
        cursor = group;
        i++;
        continue;
      }

      if (seg === 'elements' && typeof path[i + 1] === 'number') {
        const idx = path[i + 1] as number;
        const element = Array.isArray(cursor?.elements) ? cursor.elements[idx] : undefined;
        const name = element?.id ?? idx;
        parts.push(`elements.${name}`);
        cursor = element;
        i++;
        continue;
      }

      parts.push(String(seg));

      if (typeof seg === 'string') {
        cursor = cursor ? cursor[seg] : undefined;
      }
    }

    return parts.join('.');
  }
}

export function logValidationResult(result: ValidationResult): void {
  if (result.valid) {
    // Using info so the output is less alarming but still visible in console.
    console.info('[LCARS Config Validator] ✅ Configuration passed validation');
    return;
  }

  console.groupCollapsed(
    `%c[LCARS Config Validator] ❌ ${result.errors.length} issue${result.errors.length > 1 ? 's' : ''} found`,
    'color: #ff5555; font-weight: bold;'
  );
  result.errors.forEach((msg) => console.error(`• ${msg}`));
  console.groupEnd();
}