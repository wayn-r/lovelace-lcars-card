declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
  
  interface HTMLInputElement {
    configValue?: string;
  }
}

export {};

// Dynamic Color Configuration Types
export interface DynamicColorConfig {
  entity: string;
  attribute?: string; // defaults to 'state' 
  mapping: Record<string, any>; // entity value -> color
  default?: any; // fallback color
  interpolate?: boolean; // for numeric values like temperature
}

// Stateful Color Configuration Types (for hover/active states)
export interface StatefulColorConfig {
  default?: any; // default color (static string, array, or dynamic config)
  hover?: any; // hover color (static string, array, or dynamic config)
  active?: any; // active/pressed color (static string, array, or dynamic config)
}

export type ColorValue = string | number[] | DynamicColorConfig | StatefulColorConfig;

export function isDynamicColorConfig(value: any): value is DynamicColorConfig {
  return value && typeof value === 'object' && 'entity' in value && 'mapping' in value;
}

export function isStatefulColorConfig(value: any): value is StatefulColorConfig {
  return value && typeof value === 'object' && 
         ('default' in value || 'hover' in value || 'active' in value) &&
         !('entity' in value) && !('mapping' in value);
} 