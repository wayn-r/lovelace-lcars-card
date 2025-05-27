## YAML Configuration Options

=== Top-Level Card Configuration ===

```yaml
# === Top-Level Card Configuration ===
type: custom:lovelace-lcars-card # Required: <string> Specifies the card type. Must be "custom:lovelace-lcars-card".
card_title: <string>             # Optional: An overall title for the card, distinct from element text.

groups: <array>                  # Required: Defines groups of elements. Elements MUST belong to a group.
  # --- Group Configuration (Each item in the 'groups' array) ---
  - group_id: <string>             # Required: Unique identifier for this group.
    elements: <array>            # Required: Array of element configurations within this group.
      # === Element Configuration (Each item in an 'elements' array) ===
      - id: <string>                   # Required: Unique identifier for this element within the group (base ID).
                                       #   Full ID becomes "group_id.id" (e.g., "navigation.status_light").
        type: <string>                 # Required: The type of LCARS element.
                                       #   Options: "rectangle", "text", "endcap", "elbow",
                                       #            "chisel-endcap", "top_header".

        appearance:                    # Optional: Defines the static visual style of the element's shape.
          fill: <color_value>          # Primary fill color for the element's shape.
          stroke: <color_value>        # Outline/border color for the element's shape.
          strokeWidth: <number>        # Outline/border width in pixels for the element's shape.

          # --- Shape-Specific Appearance Properties ---
          cornerRadius: <number>       # For 'rectangle': Radius for rounded corners. Default: 0.
          direction: <string>          # For 'endcap', 'chisel-endcap': "left" or "right".
          orientation: <string>        # For 'elbow': "top-left", "top-right", "bottom-left", "bottom-right".
          bodyWidth: <number>          # For 'elbow': Thickness of the main part.
          armHeight: <number>          # For 'elbow': Thickness of the arm.
          # For 'top_header', `fill` applies to its internal endcaps and bar.

        text:                          # Optional: Defines text content and styling.
                                       #   Applicable to 'text' type directly, or for text *on* other
                                       #   buttonized elements (e.g., a rectangle button).
          content: <string>            # The text to display.
                                       #   For buttonized elements, this is the button's label.
          color: <color_value>         # Color of the text.
          fontFamily: <string>         # e.g., "Antonio, Arial, sans-serif". Default: "Antonio".
          fontSize: <number>           # Font size in pixels. Default: 16.
          fontWeight: <string|number>  # e.g., "normal", "bold", 400, 700. Default: "normal".
          letterSpacing: <string|number> # e.g., "1px", 0.5. Default: "normal".
          textAnchor: <string>         # SVG text-anchor: "start", "middle", "end". Default: "start".
          dominantBaseline: <string>   # SVG dominant-baseline. Default: "auto".
          textTransform: <string>      # CSS text-transform. Default: "none".
          cutout: <boolean>            # For buttonized elements: True for "cut-out" text. Default: false.
          elbow_text_position: <string># For 'elbow' (buttonized): "top" or "side". Default: "top".

          # --- Specific to 'top_header' type ---
          left_content: <string>       # Text for the left side of the top_header.
          right_content: <string>      # Text for the right side of the top_header.
          # `fontFamily`, `fontSize`, etc., in this `text` block will apply to both
          # left_content and right_content for a `top_header`.

        layout:                        # Optional: Defines positioning and sizing.
          width: <number | string_percentage>   # e.g., 100 or "50%"
          height: <number | string_percentage>  # e.g., 30 or "25%"
          offsetX: <number | string_percentage> # e.g., 10 or "-5%"
          offsetY: <number | string_percentage> # e.g., 10 or "-5%"

          anchor:                      # Optional: (Not for 'top_header')
            to: <string>                 # Full ID of target element ("group.base_id") or "container".
            element_point: <string>      # Point on *this* element.
            target_point: <string>       # Point on the *target*.
                                         #   Anchor point options: "topLeft", "topCenter", "topRight", "centerLeft", "center", "centerRight", "bottomLeft", "bottomCenter", "bottomRight".

          stretch:                     # Optional: (Not for 'top_header')
            target1:
              id: <string>               # Full ID of target element ("group.base_id") or "container".
              edge: <string>             # Edge of target: "left", "right", "top", "bottom", "centerLeft", "centerRight", "topCenter", "bottomCenter".
              padding: <number>          # Optional: Padding in pixels. Default: 0.
            target2:                   # Optional: For stretching between two targets or in two directions.
              id: <string>
              edge: <string>
              padding: <number>

        interactions:                  # Optional: Defines interactivity.
          visibility_triggers: <array> # Optional: Advanced control over element/group visibility based on interactions with other elements.
            - trigger_source:            # Defines what causes this visibility change.
                element_id_ref: <string>   # Full ID of the element whose interaction triggers this (e.g., "group_id.element_id"). Can be self.
                event: <string>            # "hover" or "click".
              targets: <array>             # Elements/groups whose visibility will be affected.
                - type: <string>             # "element" or "group".
                  id: <string>               # Full ID of the target element or group_id.
              action: <string>             # "show", "hide", or "toggle".
              hover_options:               # Optional: Specific to `event: "hover"`.
                mode: <string>             # "show_on_enter_hide_on_leave" (default) or "toggle_on_enter_hide_on_leave".
                hide_delay: <number>       # Optional (ms): Delay before hiding on mouse leave. Default: 0.
              click_options:               # Optional: Specific to `event: "click"`.
                behavior: <string>         # "toggle" (default), "show_only", "hide_only".
                revert_on_leave_source: <boolean> # If true and target was shown by click, leaving the trigger_source element reverts visibility. Default: false.
                revert_on_click_outside: <boolean># If true and target was shown by click, clicking anywhere else reverts visibility. Default: true.

          button:                        # Optional: Configuration if this element should act as a button.
            enabled: <boolean>           # True if it's a button. Default: false.
            # Button text is configured via the main `text.content` property of the element.
            # Button text styling is configured via the main `text` property group.
            # Use `text.cutout: true` for cutout effect.

            appearance_states:         # Optional: Overrides for `appearance` and `text` properties on hover/active.
              hover:
                appearance:              # Override base `appearance` properties.
                  fill: <color_value>
                  stroke: <color_value>
                  # strokeWidth can also be overridden here
                text:                    # Override base `text` properties.
                  color: <color_value>
                  # Other text properties (fontSize, fontWeight) can also be overridden here
                transform: <string>        # CSS transform string (e.g., "scale(1.05)").
              active:
                appearance:
                  fill: <color_value>
                  stroke: <color_value>
                text:
                  color: <color_value>
                transform: <string>

            actions:                     # Defines actions for different types of interactions.
              tap:                       # Action for a standard click/tap.
                # Can be a standard Home Assistant action or an animation action.
                # See <home_assistant_action_config_or_animation_action> definition below.
                # Example: { action: "toggle", entity: "light.living_room" }
                # Example: { action: "animate", animation: { type: "fade", target_elements_ref: ["group.other_element"] } }
                <object>

              hold:                      # Optional: Action for a click-and-hold.
                duration: <number>         # Optional (ms): Hold duration. Default: 500.
                action: <object>           # <home_assistant_action_config_or_animation_action>

              double_tap:                # Optional: Action for a double-tap.
                action: <object>           # <home_assistant_action_config_or_animation_action>

        animations:                      # Optional: Defines intrinsic animations for this element (not tied to interactions).
          on_load: <animation_definition_or_sequence>  # Optional: Animation to play when the card loads and this element is first rendered.
          on_show: <animation_definition_or_sequence>  # Optional: Animation to play when this element becomes visible (e.g., via a visibility_trigger).
          on_hide: <animation_definition_or_sequence>  # Optional: Animation to play when this element is hidden.
          # Note: on_show/on_hide animations target the element itself by default.
```

## Helper Type Definitions

=== Color Value Configuration ===

```yaml
# === Color Value Configuration ===
color_property: <string>             # Option 1: Static color string (e.g., "#FF9900", "rgb(255,153,0)", "red").

color_property: <array>              # Option 2: Static color RGB array.
  - <number_0_to_255>                # Red component.
  - <number_0_to_255>                # Green component.
  - <number_0_to_255>                # Blue component.

color_property:                      # Option 3: Dynamic color object (based on Home Assistant entity state).
  entity: <string>                   # Required: Home Assistant entity ID (e.g., "light.living_room").
  attribute: <string>                # Optional: Entity attribute to use (e.g., "brightness"). Default: 'state'.
  mapping: <object>                  # Required: Object mapping entity values to static colors.
    "<state_value_1>": <color_value> # e.g., "on": "#ffaa00"
    "<state_value_2>": <color_value> # e.g., "off": [51, 51, 51]
                                     # For numeric attributes with interpolate: true, keys should be numbers.
  default: <color_value>             # Optional: Fallback color if no mapping matches.
  interpolate: <boolean>             # Optional: If true, interpolates colors for numeric entity values. Default: false.

color_property:                      # Option 4: Stateful color object (for hover/active states).
  default: <color_value>             # Required: Base color for the normal state.
  hover: <color_value>               # Optional: Color when the element is hovered.
  active: <color_value>              # Optional: Color when the element is pressed/active.
```

=== Home Assistant Action or Animation Action Configuration ===

```yaml
# === Home Assistant Action Configuration ===
action_definition:                   # Option 1: Standard Home Assistant action configuration object.
  action: <string>                   # Required: Type of HA action.
                                     #   Options: "call-service", "navigate", "url", "toggle", "more-info", "none".

  # --- Service Call Specific (if action: "call-service") ---
  service: <string>                  # Optional: Service to call (e.g., "light.turn_on").
  service_data: <object>             # Optional: Data for the service call (e.g., { "entity_id": "light.office" }).
  target: <object>                   # Optional: More specific target for service call (e.g., { "area_id": "kitchen" }).

  # --- Navigation Specific (if action: "navigate") ---
  navigation_path: <string>          # Optional: Path to navigate to (e.g., "/lovelace/lights").

  # --- URL Specific (if action: "url") ---
  url_path: <string>                 # Optional: URL to open (e.g., "https://www.home-assistant.io").

  # --- Entity Specific (if action: "toggle" or "more-info") ---
  entity: <string>                   # Optional: Entity ID for the action (e.g., "switch.fan").

  # --- General Confirmation Option (applies to all action types except "none") ---
  confirmation: <boolean | object>   # Optional: Prompts user before executing.
                                     #   - true (for default confirmation dialog)
                                     #   - { text: "Custom message?", exemptions: [{ user: "user_id_exempt" }] }

# === Animation Action Configuration ===
action_definition:                   # Option 2: Animation action configuration object.
  action: "animate"                  # Required: Special keyword to trigger an animation.
  animation: <animation_definition>  # Required: The animation to play.
```

=== Animation Definition or Sequence Configuration ===

```yaml
# === Single Animation Definition ===
animation_definition:                # Option 1: Single animation definition object.
  type: <string>                     # Required: Animation type.
                                     #   Options: "fade", "slide", "scale", "custom_gsap".

  # --- Fade Animation Parameters (if type: "fade") ---
  fade_params:                       # Optional: Parameters for fade animation.
    opacity_start: <number_0_to_1>   # Optional: Starting opacity. Default: 0 for on_show/on_load, 1 for on_hide.
    opacity_end: <number_0_to_1>     # Optional: Ending opacity. Default: 1 for on_show/on_load, 0 for on_hide.

  # --- Slide Animation Parameters (if type: "slide") ---
  slide_params:                      # Optional: Parameters for slide animation.
    direction: <string>              # Required: Slide direction. Options: "up", "down", "left", "right".
    distance: <string>               # Required: Slide distance (e.g., "50px", "100%").
    opacity_start: <number_0_to_1>   # Optional: Control opacity during slide. Default: current or 0 if sliding in from fully hidden.

  # --- Scale Animation Parameters (if type: "scale") ---
  scale_params:                      # Optional: Parameters for scale animation.
    scale_start: <number>            # Optional: Starting scale factor. Default: 0 for on_show/on_load, 1 for on_hide.
    scale_end: <number>              # Optional: Ending scale factor. Default: 1 for on_show/on_load, 0 for on_hide.
    transform_origin: <string>       # Optional: CSS transform-origin (e.g., "center center", "top left"). Default: "center center".

  # --- Custom GSAP Parameters (if type: "custom_gsap") ---
  custom_gsap_vars: <object>         # Optional: Raw GSAP variables object for custom animations.

  # --- Common Animation Parameters ---
  duration: <number>                 # Required: Duration in seconds (e.g., 0.5).
  delay: <number>                    # Optional: Delay in seconds before the animation starts. Default: 0.
  ease: <string>                     # Optional: GSAP easing function (e.g., "power2.out", "bounce.inOut"). Default: "power2.out".
  repeat: <number>                   # Optional: Number of times to repeat. Use -1 for infinite. Default: 0.
  yoyo: <boolean>                    # Optional: If true, animation plays forwards then backwards on repeats. Default: false.

  # --- Animation Targeting ---
  target_self: <boolean>             # Optional: If true, targets the element itself.
                                     #   For element.animations.on_X, implicitly true.
                                     #   For button actions, defaults to false if other targets specified.
  target_elements_ref: <array>       # Optional: Array of full element IDs to target ("group_id.element_id").
  target_groups_ref: <array>         # Optional: Array of group IDs to target (animates all elements in the group).

# === Animation Sequence Definition ===
animation_definition:                # Option 2: Animation sequence definition object.
  # --- Sequence-Level Targeting (can be overridden by individual steps) ---
  target_self: <boolean>             # Optional: Global target setting for the sequence.
  target_elements_ref: <array>       # Optional: Global element targets for the sequence.
  target_groups_ref: <array>         # Optional: Global group targets for the sequence.

  steps: <array>                     # Required: Array of animation steps.
    # --- Animation Step Configuration (Each item in the 'steps' array) ---
    - index: <number>                # Required: Execution order. Same index = concurrent execution.
                                     #   Higher indices wait for all lower indices to complete.

      # --- Step-Level Targeting (overrides sequence-level for this step) ---
      target_self: <boolean>         # Optional: Override sequence-level target_self for this step.
      target_elements_ref: <array>   # Optional: Override/add to sequence-level element targets for this step.
      target_groups_ref: <array>     # Optional: Override/add to sequence-level group targets for this step.

      # --- Animation Parameters (same as Single Animation Definition) ---
      type: <string>                 # Required: Animation type for this step.
      fade_params: <object>          # Optional: Fade parameters (if type: "fade").
      slide_params: <object>         # Optional: Slide parameters (if type: "slide").
      scale_params: <object>         # Optional: Scale parameters (if type: "scale").
      custom_gsap_vars: <object>     # Optional: Custom GSAP variables (if type: "custom_gsap").
      duration: <number>             # Required: Duration for this step.
      delay: <number>                # Optional: Delay for this step.
      ease: <string>                 # Optional: Easing for this step.
      repeat: <number>               # Optional: Repeat count for this step.
      yoyo: <boolean>                # Optional: Yoyo setting for this step.
```