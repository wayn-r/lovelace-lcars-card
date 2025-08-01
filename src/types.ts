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

// ============================================================================
// Core Color System Types
// ============================================================================

export interface DynamicColorConfig {
  entity: string;
  attribute?: string; // defaults to 'state' 
  mapping: Record<string, any>; // entity value -> color
  default?: any; // fallback color
  interpolate?: boolean; // for numeric values like temperature
}

export interface StatefulColorConfig {
  default?: any; // default color (static string, array, or dynamic config)
  hover?: any; // hover color (static string, array, or dynamic config)
  active?: any; // active/pressed color (static string, array, or dynamic config)
  toggled_off?: any;
  toggled_off_hover?: any;
  state_map?: Record<string, string>;
  state_name?: string;
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

// ============================================================================
// YAML Configuration Types
// ============================================================================

export interface LcarsCardConfig {
  type: string;
  title?: string;
  groups: GroupConfig[];
  state_management?: StateManagementConfig;
}

export interface GroupConfig {
  group_id: string;
  elements: ElementConfig[];
}

export interface ElementConfig {
  id: string;
  type: 'rectangle' | 'text' | 'endcap' | 'elbow' | 'chisel-endcap' | 'top_header' | 'logger-widget';
  appearance?: AppearanceConfig;
  text?: TextConfig;
  layout?: LayoutConfig;
  
  // Direct properties as per YAML definition
  button?: ButtonConfig;
  state_management?: ElementStateManagementConfig;
  visibility_rules?: VisibilityRulesConfig;
  visibility_triggers?: VisibilityTriggerConfig[];
  animations?: AnimationsConfig;
}

// ============================================================================
// Appearance Configuration
// ============================================================================

export interface AppearanceConfig {
  fill?: ColorValue;
  stroke?: ColorValue;
  strokeWidth?: number;
  
  // Shape-specific properties
  cornerRadius?: number; // rectangle
  direction?: 'left' | 'right'; // endcap, chisel-endcap
  orientation?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // elbow
  bodyWidth?: number; // elbow
  armHeight?: number; // elbow
}

// ============================================================================
// Text Configuration
// ============================================================================

export interface TextConfig {
  content?: string;
  fill?: ColorValue;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  letterSpacing?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  textTransform?: string;
  cutout?: boolean;
  textWidth?: number;  // not implemented yet
  textHeight?: number;  // not implemented yet
  elbow_text_position?: 'arm' | 'body'; // elbow specific
  
  // top_header specific
  left_content?: string;
  right_content?: string;
}

// ============================================================================
// Layout Configuration
// ============================================================================

export interface LayoutConfig {
  width?: number | string;
  height?: number | string;
  offsetX?: number | string;
  offsetY?: number | string;
  anchor?: AnchorConfig;
  stretch?: StretchConfig;
}

export interface AnchorConfig {
  to: string; // Full ID of target element or "container"
  element_point: string; // Point on this element
  target_point: string; // Point on the target
}

export interface StretchConfig {
  target1: StretchTargetConfig;
  target2?: StretchTargetConfig;
}

export interface StretchTargetConfig {
  id: string; // Full ID of target element or "container"
  edge: string; // Edge of target
  padding?: number;
}

// ============================================================================
// Unified Action Model - covers both Home Assistant and Custom actions
// ============================================================================

export interface Action {
  // Core action type
  action: 'call-service' | 'navigate' | 'url' | 'toggle' | 'more-info' | 'none' | 'set_state' | 'toggle_state' | 'toggle_line_visibility';
  
  // Home Assistant service actions
  service?: string;
  service_data?: Record<string, any>;
  target?: Record<string, any>;
  
  // Navigation actions
  navigation_path?: string;
  
  // URL actions
  url_path?: string;
  
  // Entity actions (toggle, more-info)
  entity?: string;
  
  // Custom state management actions
  target_element_ref?: string;
  target_id?: string;
  entity_id?: string;
  state?: string;
  states?: string[];
  actions?: Action[]; // For multi-action sequences
  
  // Common properties
  confirmation?: boolean | {
    text?: string;
    exemptions?: Array<{
      user: string;
    }>;
  };
}

// ============================================================================
// Button Configuration
// ============================================================================

export interface ButtonConfig {
  enabled: boolean;
  actions?: {
    /**
     * A single Action or an array of Actions to execute on tap.
     */
    tap?: Action | Action[];

    /**
     * Action(s) to execute on hold. You can provide either:
     *   1) A single Action or array of Actions, or
     *   2) An object that extends Action with an optional duration property.
     *
     * Example:
     *   hold: {
     *     duration: 750,
     *     action: 'toggle'
     *   }
     */
    hold?: HoldAction;

    /**
     * A single Action or an array of Actions to execute on double-tap.
     */
    double_tap?: Action | Action[];
  };
}

/**
 * A HoldAction is an Action with an optional duration (milliseconds).
 */
export interface HoldAction extends Action {
  duration?: number;
}

// Backwards-compatibility type aliases – these now point directly to Action.
// They will be removed in a future breaking release.
export type ActionDefinition = Action;
export type SingleActionDefinition = Action;
export type HoldActionDefinition = HoldAction;

// ============================================================================
// Home Assistant Actions
// ============================================================================

export interface HomeAssistantActionConfig {
  action: 'call-service' | 'navigate' | 'url' | 'toggle' | 'more-info' | 'none';
  service?: string;
  service_data?: Record<string, any>;
  target?: Record<string, any>;
  navigation_path?: string;
  url_path?: string;
  entity?: string;
  confirmation?: boolean | ConfirmationConfig;
}

export interface ConfirmationConfig {
  text?: string;
  exemptions?: Array<{ user: string }>;
}

// ============================================================================
// Animation System
// ============================================================================

export interface AnimationsConfig {
  on_load?: AnimationDefinition | AnimationSequence;
  on_show?: AnimationDefinition | AnimationSequence;
  on_hide?: AnimationDefinition | AnimationSequence;
  on_state_change?: StateChangeAnimationConfig[];
}

export interface StateChangeAnimationConfig extends AnimationDefinition {
  from_state: string;
  to_state: string;
}

export interface AnimationDefinition {
  type: 'fade' | 'slide' | 'scale' | 'color' | 'custom_gsap';
  
  // Type-specific parameters
  fade_params?: FadeParams;
  slide_params?: SlideParams;
  scale_params?: ScaleParams;
  color_params?: ColorParams;
  custom_gsap_vars?: Record<string, any>;
  
  // Common parameters
  duration: number;
  delay?: number;
  ease?: string;
  repeat?: number;
  yoyo?: boolean;
  
  // Targeting
  target_self?: boolean;
  target_elements_ref?: string[];
  target_groups_ref?: string[];
}

export interface AnimationSequence {
  target_self?: boolean;
  target_elements_ref?: string[];
  target_groups_ref?: string[];
  steps: AnimationStepGroupConfig[];
}

export interface AnimationStepGroupConfig {
  index: number;
  animations: AnimationStepConfig[];
}

export interface AnimationStepConfig {
  target_self?: boolean;
  target_elements_ref?: string[];
  target_groups_ref?: string[];
  
  type: 'fade' | 'slide' | 'scale' | 'color' | 'custom_gsap';
  fade_params?: FadeParams;
  slide_params?: SlideParams;
  scale_params?: ScaleParams;
  color_params?: ColorParams;
  custom_gsap_vars?: Record<string, any>;
  duration: number;
  delay?: number;
  ease?: string;
  repeat?: number;
  yoyo?: boolean;
}

export interface FadeParams {
  opacity_start?: number;
  opacity_end?: number;
}

export interface SlideParams {
  direction: 'up' | 'down' | 'left' | 'right';
  distance: string;
  opacity_start?: number;
  opacity_end?: number;
  movement?: 'in' | 'out'; // Optional: move toward ("in") or away from ("out") anchor position
}

export interface ScaleParams {
  scale_start?: number;
  scale_end?: number;
  transform_origin?: string;
}

export interface ColorParams {
  property?: 'fill' | 'stroke' | 'color';
  color_start?: string;
  color_end?: string;
}

// ============================================================================
// State Management
// ============================================================================

export interface StateManagementConfig {
  state_groups?: StateGroupConfig[];
  state_machine?: StateMachineConfig;
}

export interface StateGroupConfig {
  group_name: string;
  exclusive: boolean;
  members: string[]; // Array of element/group IDs
  default_visible?: string;
}

export interface StateMachineConfig {
  states: StateConfig[];
  transitions: TransitionConfig[];
}

export interface StateConfig {
  name: string;
  visible_elements: string[];
}

export interface TransitionConfig {
  from: string;
  to: string;
  trigger: {
    element_id_ref: string;
    event: 'hover' | 'click';
  };
  animation_sequence?: AnimationPhaseConfig[];
}

export interface AnimationPhaseConfig {
  phase: 'hide' | 'show';
  targets: string[];
  delay?: number;
}

// ============================================================================
// Layout Engine Support Types
// ============================================================================

export interface LcarsButtonElementConfig {
  enabled?: boolean;
  hover_fill?: any;
  active_fill?: any;
  hover_stroke?: string;
  active_stroke?: string;
  hover_transform?: string;
  active_transform?: string;
  action_config?: LcarsButtonActionConfig;
}

export interface LcarsButtonActionConfig {
  /** Either 'action' (single) or 'actions' (multiple) should be provided. */
  type?: 'call-service' | 'navigate' | 'toggle' | 'more-info' | 'url' | 'none' | 'set_state' | 'toggle_state'; // legacy property (will be removed)
  action?: Action; // preferred single action variant
  actions?: Action[]; // preferred multi-action variant

  // Service call specific
  service?: string;
  service_data?: Record<string, any>;
  target?: Record<string, any>;

  // Navigation specific
  navigation_path?: string;

  // URL specific
  url_path?: string;

  // Entity specific (toggle, more-info)
  entity?: string;

  // Confirmation support
  confirmation?: boolean | {
    text?: string;
    exemptions?: Array<{
      user: string;
    }>;
  };

  // Custom state management properties
  target_element_ref?: string;
  state?: string;
  states?: string[];
}

// ============================================================================
// Visibility Rules Configuration
// ============================================================================

export interface VisibilityRulesConfig {
  operator: 'and' | 'or' | 'not' | 'xor';
  conditions: VisibilityConditionConfig[];
}

// ============================================================================
// Visibility Triggers Configuration
// ============================================================================

export interface VisibilityTriggerConfig {
  action: 'show' | 'hide' | 'toggle';
  trigger_source: TriggerSourceConfig;
  targets?: TargetConfig[];
  hover_options?: HoverOptionsConfig;
  click_options?: ClickOptionsConfig;
}

export interface TriggerSourceConfig {
  element_id_ref: string;
  event: 'hover' | 'click';
}

export interface TargetConfig {
  type: 'element' | 'group';
  id: string;
}

export interface HoverOptionsConfig {
  mode?: 'show_on_enter_hide_on_leave' | 'toggle_on_enter_hide_on_leave';
  hide_delay?: number;
}

export interface ClickOptionsConfig {
  revert_on_click_outside?: boolean;
}

export interface VisibilityConditionConfig {
  type: 'state' | 'entity_state' | 'group';
  negate?: boolean;
  
  // For type: "state" (custom state)
  target_id?: string;
  state?: string;
  
  // For type: "entity_state" (Home Assistant entity)
  entity_id?: string;
  attribute?: string;
  value?: any;
  
  // For type: "group" (nested condition group)
  operator?: 'and' | 'or' | 'not' | 'xor';
  conditions?: VisibilityConditionConfig[];
}

// ============================================================================
// State Management Configuration
// ============================================================================

export interface ElementStateManagementConfig {
  default_state?: string;
  entity_id?: string;
  attribute?: string; // defaults to 'state'
}

// ============================================================================
// Log Widget Types
// ============================================================================

export interface LogMessage {
  id: string;
  text: string;
  timestamp: number;
}

export interface LogAreaLayout {
  x: number;
  y: number;
  textAnchor: 'start' | 'middle' | 'end';
} 