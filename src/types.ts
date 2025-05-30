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
  type: 'rectangle' | 'text' | 'endcap' | 'elbow' | 'chisel-endcap' | 'top_header';
  appearance?: AppearanceConfig;
  text?: TextConfig;
  layout?: LayoutConfig;
  interactions?: InteractionsConfig;
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
// Interactions Configuration
// ============================================================================

export interface InteractionsConfig {
  visibility_triggers?: VisibilityTriggerConfig[];
  button?: ButtonConfig;
}

export interface VisibilityTriggerConfig {
  trigger_source: TriggerSourceConfig;
  targets?: TargetConfig[];
  action?: 'show' | 'hide' | 'toggle';
  orchestrated_action?: OrchestratedActionConfig;
  conditional_actions?: ConditionalActionConfig[];
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

export interface OrchestratedActionConfig {
  type: 'state_transition' | 'toggle_with_dependencies';
  state_group?: string; // for state_transition
  target_state?: string; // for state_transition
  primary_target?: TargetConfig; // for toggle_with_dependencies
  when_showing?: ActionGroupConfig;
  when_hiding?: ActionGroupConfig;
  additional_actions?: AdditionalActionConfig[];
  timing?: TimingConfig;
}

export interface ActionGroupConfig {
  hide?: TargetConfig[];
  show?: TargetConfig[];
}

export interface AdditionalActionConfig {
  targets: TargetConfig[];
  action: 'show' | 'hide' | 'toggle';
}

export interface TimingConfig {
  hide_first?: boolean;
  hide_delay?: number;
  show_delay?: number;
  stagger_hide?: number;
  stagger_show?: number;
}

export interface ConditionalActionConfig {
  condition: ConditionConfig;
  action: 'show' | 'hide' | 'toggle';
  targets: TargetConfig[];
  additional_hide?: TargetConfig[];
  additional_show?: TargetConfig[];
}

export interface ConditionConfig {
  state_group?: string;
  current_state?: string;
  element_visible?: string;
  element_hidden?: string;
}

export interface HoverOptionsConfig {
  mode?: 'show_on_enter_hide_on_leave' | 'toggle_on_enter_hide_on_leave';
  hide_delay?: number;
}

export interface ClickOptionsConfig {
  behavior?: 'toggle' | 'show_only' | 'hide_only';
  revert_on_leave_source?: boolean;
  revert_on_click_outside?: boolean;
}

// ============================================================================
// Button Configuration
// ============================================================================

export interface ButtonConfig {
  enabled: boolean;
  appearance_states?: AppearanceStatesConfig;
  actions?: ButtonActionsConfig;
}

export interface AppearanceStatesConfig {
  hover?: StateAppearanceConfig;
  active?: StateAppearanceConfig;
}

export interface StateAppearanceConfig {
  appearance?: Partial<AppearanceConfig>;
  text?: Partial<TextConfig>;
  transform?: string;
}

export interface ButtonActionsConfig {
  tap?: HomeAssistantActionConfig | AnimationActionConfig;
  hold?: HoldActionConfig;
  double_tap?: DoubleTabActionConfig;
}

export interface HoldActionConfig {
  duration?: number;
  action: HomeAssistantActionConfig | AnimationActionConfig;
}

export interface DoubleTabActionConfig {
  action: HomeAssistantActionConfig | AnimationActionConfig;
}

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
}

export interface AnimationActionConfig {
  action: 'animate';
  animation: AnimationDefinition | AnimationSequence;
}

export interface AnimationDefinition {
  type: 'fade' | 'slide' | 'scale' | 'custom_gsap';
  
  // Type-specific parameters
  fade_params?: FadeParams;
  slide_params?: SlideParams;
  scale_params?: ScaleParams;
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
  steps: AnimationStepConfig[];
}

export interface AnimationStepConfig {
  index: number;
  target_self?: boolean;
  target_elements_ref?: string[];
  target_groups_ref?: string[];
  
  type: 'fade' | 'slide' | 'scale' | 'custom_gsap';
  fade_params?: FadeParams;
  slide_params?: SlideParams;
  scale_params?: ScaleParams;
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
}

export interface ScaleParams {
  scale_start?: number;
  scale_end?: number;
  transform_origin?: string;
}

// ============================================================================
// State Management
// ============================================================================

export interface StateManagementConfig {
  state_groups?: StateGroupConfig[];
  state_machine?: StateMachineConfig;
  global_interactions?: GlobalInteractionsConfig;
}

export interface StateGroupConfig {
  group_name: string;
  exclusive: boolean;
  members: TargetConfig[];
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
  trigger: TriggerSourceConfig;
  animation_sequence?: AnimationPhaseConfig[];
}

export interface AnimationPhaseConfig {
  phase: 'hide' | 'show';
  targets: string[];
  delay?: number;
}

export interface GlobalInteractionsConfig {
  visibility_triggers?: VisibilityTriggerConfig[];
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
  type: 'call-service' | 'navigate' | 'toggle' | 'more-info' | 'url' | 'none';
  service?: string;
  service_data?: Record<string, any>;
  navigation_path?: string;
  url_path?: string;
  entity?: string;
  confirmation?: boolean | {
    text?: string;
    exemptions?: Array<{
      user: string;
    }>;
  };
} 