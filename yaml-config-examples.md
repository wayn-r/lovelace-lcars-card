# LCARS Card Configuration Examples

## Basic Card Structure

```yaml
type: custom:lovelace-lcars-card
card_title: "USS Enterprise - Bridge Operations"
groups:
  - group_id: "main_display"
    elements:
      - id: "status_bar"
        type: "rectangle"
        appearance:
          fill: "#FF9900"
        text:
          content: "ONLINE"
        layout:
          width: 200
          height: 40
```

## Complete Navigation Panel Example

```yaml
type: custom:lovelace-lcars-card
card_title: "Navigation Control"
groups:
  - group_id: "nav_header"
    elements:
      - id: "main_header"
        type: "top_header"
        appearance:
          fill: "#CC6600"
        text:
          left_content: "NAVIGATION"
          right_content: "SECTOR 001"
          fontSize: 18
          fontWeight: "bold"
        layout:
          width: "100%"
          height: 50

  - group_id: "nav_controls"
    elements:
      - id: "home_button"
        type: "rectangle"
        appearance:
          fill: "#0099CC"
          cornerRadius: 20
        text:
          content: "HOME"
          color: "#FFFFFF"
          fontSize: 16
          cutout: false
        layout:
          width: 120
          height: 40
          anchor:
            to: "nav_header.main_header"
            element_point: "topLeft"
            target_point: "bottomLeft"
        interactions:
          button:
            enabled: true
            appearance_states:
              hover:
                appearance:
                  fill: "#00CCFF"
                transform: "scale(1.05)"
              active:
                appearance:
                  fill: "#0066AA"
            actions:
              tap:
                action: "navigate"
                navigation_path: "/lovelace/0"

      - id: "lights_button"
        type: "endcap"
        appearance:
          fill: "#CC3300"
          direction: "right"
        text:
          content: "LIGHTS"
          color: "#FFFFFF"
        layout:
          width: 100
          height: 40
          anchor:
            to: "nav_controls.home_button"
            element_point: "topLeft"
            target_point: "topRight"
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "navigate"
                navigation_path: "/lovelace/lights"
```

## Dynamic Color Examples

```yaml
groups:
  - group_id: "status_indicators"
    elements:
      # Static color variations
      - id: "static_string"
        type: "rectangle"
        appearance:
          fill: "#FF9900"  # Orange hex
          stroke: "red"    # Named color
        
      - id: "static_rgb"
        type: "rectangle"
        appearance:
          fill: [255, 153, 0]  # RGB array
        
      # Dynamic color based on entity state
      - id: "light_status"
        type: "rectangle"
        appearance:
          fill:
            entity: "light.living_room"
            mapping:
              "on": "#FFFF00"
              "off": "#333333"
              "unavailable": "#FF0000"
            default: "#666666"
        text:
          content: "LIVING ROOM"
          color:
            entity: "light.living_room"
            mapping:
              "on": "#000000"
              "off": "#FFFFFF"
            default: "#CCCCCC"
        
      # Interpolated color for brightness
      - id: "brightness_bar"
        type: "rectangle"
        appearance:
          fill:
            entity: "light.bedroom"
            attribute: "brightness"
            mapping:
              0: "#000000"
              128: "#FF9900"
              255: "#FFFF00"
            interpolate: true
            default: "#333333"
        
      # Stateful color for interactive elements
      - id: "interactive_button"
        type: "rectangle"
        appearance:
          fill:
            default: "#0099CC"
            hover: "#00CCFF"
            active: "#0066AA"
        interactions:
          button:
            enabled: true
```

## Advanced Layout and Positioning

```yaml
groups:
  - group_id: "layout_examples"
    elements:
      # Basic positioning with percentages
      - id: "percentage_element"
        type: "rectangle"
        appearance:
          fill: "#CC6600"
        layout:
          width: "25%"
          height: "10%"
          offsetX: "5%"
          offsetY: "5%"
      
      # Anchoring to container
      - id: "container_anchor"
        type: "rectangle"
        appearance:
          fill: "#009966"
        layout:
          width: 150
          height: 30
          anchor:
            to: "container"
            element_point: "topRight"
            target_point: "topRight"
      
      # Anchoring to another element
      - id: "element_anchor"
        type: "text"
        text:
          content: "STATUS: NOMINAL"
          color: "#FFFFFF"
        layout:
          anchor:
            to: "layout_examples.percentage_element"
            element_point: "centerLeft"
            target_point: "centerRight"
      
      # Stretching between elements
      - id: "stretch_bar"
        type: "rectangle"
        appearance:
          fill: "#CC3300"
        layout:
          height: 20
          stretch:
            target1:
              id: "layout_examples.percentage_element"
              edge: "right"
              padding: 10
            target2:
              id: "layout_examples.container_anchor"
              edge: "left"
              padding: 10
```

## LCARS Shape Elements

```yaml
groups:
  - group_id: "lcars_shapes"
    elements:
      # Rectangle with rounded corners
      - id: "rounded_rect"
        type: "rectangle"
        appearance:
          fill: "#FF9900"
          cornerRadius: 15
        layout:
          width: 200
          height: 50
      
      # Left endcap
      - id: "left_endcap"
        type: "endcap"
        appearance:
          fill: "#CC6600"
          direction: "left"
        layout:
          width: 60
          height: 40
      
      # Right endcap
      - id: "right_endcap"
        type: "endcap"
        appearance:
          fill: "#0099CC"
          direction: "right"
        layout:
          width: 60
          height: 40
          anchor:
            to: "lcars_shapes.left_endcap"
            element_point: "topLeft"
            target_point: "topRight"
      
      # Chisel endcaps
      - id: "chisel_left"
        type: "chisel-endcap"
        appearance:
          fill: "#CC3300"
          direction: "left"
        layout:
          width: 80
          height: 35
      
      # Elbow variations
      - id: "elbow_top_left"
        type: "elbow"
        appearance:
          fill: "#9966CC"
          orientation: "top-left"
          bodyWidth: 20
          armHeight: 15
        layout:
          width: 100
          height: 80
      
      - id: "elbow_bottom_right"
        type: "elbow"
        appearance:
          fill: "#66CC99"
          orientation: "bottom-right"
          bodyWidth: 25
          armHeight: 18
        layout:
          width: 120
          height: 90
        text:
          content: "ELBOW"
          color: "#FFFFFF"
          elbow_text_position: "side"
```

## Complex Interactions and Visibility

```yaml
groups:
  - group_id: "main_controls"
    elements:
      - id: "menu_trigger"
        type: "rectangle"
        appearance:
          fill: "#FF9900"
        text:
          content: "MENU"
          color: "#000000"
        layout:
          width: 100
          height: 40
        interactions:
          button:
            enabled: true
          visibility_triggers:
            - trigger_source:
                element_id_ref: "main_controls.menu_trigger"
                event: "hover"
              targets:
                - type: "group"
                  id: "menu_items"
              action: "show"
              hover_options:
                mode: "show_on_enter_hide_on_leave"
                hide_delay: 500
            
            - trigger_source:
                element_id_ref: "main_controls.menu_trigger"
                event: "click"
              targets:
                - type: "element"
                  id: "details.info_panel"
              action: "toggle"
              click_options:
                behavior: "toggle"
                revert_on_click_outside: true

  - group_id: "menu_items"
    elements:
      - id: "option_1"
        type: "rectangle"
        appearance:
          fill: "#0099CC"
        text:
          content: "SYSTEMS"
        layout:
          width: 90
          height: 30
          anchor:
            to: "main_controls.menu_trigger"
            element_point: "topLeft"
            target_point: "bottomLeft"
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "call-service"
                service: "homeassistant.toggle"
                service_data:
                  entity_id: "switch.main_systems"
      
      - id: "option_2"
        type: "rectangle"
        appearance:
          fill: "#CC3300"
        text:
          content: "ALERTS"
        layout:
          width: 90
          height: 30
          anchor:
            to: "menu_items.option_1"
            element_point: "topLeft"
            target_point: "bottomLeft"

  - group_id: "details"
    elements:
      - id: "info_panel"
        type: "rectangle"
        appearance:
          fill: "#333333"
          stroke: "#CC6600"
          strokeWidth: 2
        text:
          content: "DETAILED INFORMATION PANEL"
          color: "#FFFFFF"
        layout:
          width: 300
          height: 150
          anchor:
            to: "container"
            element_point: "center"
            target_point: "center"
```

## Button Actions and Confirmations

```yaml
groups:
  - group_id: "action_buttons"
    elements:
      # Simple toggle action
      - id: "light_toggle"
        type: "rectangle"
        appearance:
          fill: "#FFFF00"
        text:
          content: "LIGHTS"
          color: "#000000"
        layout:
          width: 100
          height: 40
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "toggle"
                entity: "light.living_room"
      
      # Service call with data
      - id: "climate_control"
        type: "endcap"
        appearance:
          fill: "#0099CC"
          direction: "right"
        text:
          content: "COOL"
          color: "#FFFFFF"
        layout:
          width: 80
          height: 40
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "call-service"
                service: "climate.set_temperature"
                service_data:
                  entity_id: "climate.living_room"
                  temperature: 22
                target:
                  area_id: "living_room"
      
      # Action with confirmation
      - id: "security_button"
        type: "rectangle"
        appearance:
          fill: "#CC3300"
        text:
          content: "SECURITY"
          color: "#FFFFFF"
          cutout: true
        layout:
          width: 120
          height: 45
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "call-service"
                service: "alarm_control_panel.alarm_arm_away"
                service_data:
                  entity_id: "alarm_control_panel.house"
                confirmation:
                  text: "Are you sure you want to arm the security system?"
      
      # Hold action
      - id: "emergency_button"
        type: "rectangle"
        appearance:
          fill: "#FF0000"
        text:
          content: "EMERGENCY"
          color: "#FFFFFF"
          fontWeight: "bold"
        layout:
          width: 140
          height: 50
        interactions:
          button:
            enabled: true
            actions:
              hold:
                duration: 2000
                action:
                  action: "call-service"
                  service: "script.emergency_protocol"
      
      # Double tap action
      - id: "mode_switch"
        type: "rectangle"
        appearance:
          fill: "#9966CC"
        text:
          content: "MODE"
        layout:
          width: 100
          height: 40
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "toggle"
                entity: "input_boolean.day_mode"
              double_tap:
                action:
                  action: "call-service"
                  service: "script.night_mode"
```

## Animation Examples

```yaml
groups:
  - group_id: "animated_elements"
    elements:
      # Element with load animation
      - id: "fade_in_element"
        type: "rectangle"
        appearance:
          fill: "#FF9900"
        text:
          content: "LOADING..."
        layout:
          width: 150
          height: 40
        animations:
          on_load:
            type: "fade"
            fade_params:
              opacity_start: 0
              opacity_end: 1
            duration: 1.0
            ease: "power2.out"
      
      # Element with show/hide animations
      - id: "sliding_panel"
        type: "rectangle"
        appearance:
          fill: "#0099CC"
        layout:
          width: 200
          height: 100
        animations:
          on_show:
            type: "slide"
            slide_params:
              direction: "right"
              distance: "100%"
              opacity_start: 0
            duration: 0.5
            ease: "power2.out"
          on_hide:
            type: "slide"
            slide_params:
              direction: "left"
              distance: "100%"
            duration: 0.3
      
      # Button with animation action
      - id: "animation_trigger"
        type: "rectangle"
        appearance:
          fill: "#CC6600"
        text:
          content: "ANIMATE"
        layout:
          width: 100
          height: 40
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "animate"
                animation:
                  target_elements_ref: ["animated_elements.sliding_panel"]
                  type: "scale"
                  scale_params:
                    scale_start: 1.0
                    scale_end: 1.2
                    transform_origin: "center center"
                  duration: 0.3
                  repeat: 1
                  yoyo: true
      
      # Complex animation sequence
      - id: "sequence_element"
        type: "rectangle"
        appearance:
          fill: "#CC3300"
        layout:
          width: 120
          height: 50
        animations:
          on_load:
            target_self: true
            target_elements_ref: ["animated_elements.fade_in_element"]
            steps:
              - index: 0
                type: "fade"
                fade_params:
                  opacity_start: 0
                  opacity_end: 1
                duration: 0.5
              - index: 0
                target_self: false
                target_elements_ref: ["animated_elements.fade_in_element"]
                type: "slide"
                slide_params:
                  direction: "up"
                  distance: "20px"
                duration: 0.5
              - index: 1
                type: "scale"
                scale_params:
                  scale_start: 1.0
                  scale_end: 1.1
                duration: 0.2
                repeat: 2
                yoyo: true
      
      # Custom GSAP animation
      - id: "custom_animation"
        type: "rectangle"
        appearance:
          fill: "#9966CC"
        layout:
          width: 100
          height: 40
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "animate"
                animation:
                  target_self: true
                  type: "custom_gsap"
                  custom_gsap_vars:
                    rotation: 360
                    transformOrigin: "center center"
                    ease: "bounce.out"
                  duration: 1.0
```

## Text Styling Examples

```yaml
groups:
  - group_id: "text_examples"
    elements:
      # Basic text element
      - id: "simple_text"
        type: "text"
        text:
          content: "STARFLEET COMMAND"
          color: "#FF9900"
          fontSize: 24
          fontWeight: "bold"
          fontFamily: "Antonio, Arial, sans-serif"
        layout:
          width: 300
          height: 30
      
      # Text with advanced styling
      - id: "styled_text"
        type: "text"
        text:
          content: "OPERATIONAL STATUS"
          color: "#FFFFFF"
          fontSize: 18
          letterSpacing: "2px"
          textTransform: "uppercase"
          textAnchor: "middle"
          dominantBaseline: "central"
        layout:
          width: 250
          height: 25
      
      # Button with cutout text
      - id: "cutout_button"
        type: "rectangle"
        appearance:
          fill: "#CC6600"
        text:
          content: "TACTICAL"
          color: "#000000"
          fontSize: 16
          fontWeight: "bold"
          cutout: true
        layout:
          width: 120
          height: 45
        interactions:
          button:
            enabled: true
            appearance_states:
              hover:
                text:
                  color: "#FFFFFF"
      
      # Top header with dual content
      - id: "dual_header"
        type: "top_header"
        appearance:
          fill: "#0099CC"
        text:
          left_content: "BRIDGE"
          right_content: "12:34:56"
          fontSize: 20
          fontWeight: "bold"
          color: "#FFFFFF"
        layout:
          width: "100%"
          height: 60
```

## Complete Dashboard Example

```yaml
type: custom:lovelace-lcars-card
card_title: "USS Enterprise - Main Bridge"
groups:
  - group_id: "header"
    elements:
      - id: "main_header"
        type: "top_header"
        appearance:
          fill: "#CC6600"
        text:
          left_content: "BRIDGE OPERATIONS"
          right_content: "STARDATE 2024.147"
          fontSize: 18
          fontWeight: "bold"
          color: "#FFFFFF"
        layout:
          width: "100%"
          height: 50

  - group_id: "navigation"
    elements:
      - id: "nav_bar"
        type: "rectangle"
        appearance:
          fill: "#FF9900"
          cornerRadius: 25
        layout:
          width: "90%"
          height: 50
          anchor:
            to: "header.main_header"
            element_point: "topCenter"
            target_point: "bottomCenter"
      
      - id: "home_btn"
        type: "endcap"
        appearance:
          fill: "#0099CC"
          direction: "left"
        text:
          content: "HOME"
          color: "#FFFFFF"
          fontSize: 14
        layout:
          width: 80
          height: 35
          anchor:
            to: "navigation.nav_bar"
            element_point: "centerLeft"
            target_point: "centerLeft"
        interactions:
          button:
            enabled: true
            appearance_states:
              hover:
                appearance:
                  fill: "#00CCFF"
            actions:
              tap:
                action: "navigate"
                navigation_path: "/lovelace/0"

  - group_id: "systems"
    elements:
      - id: "power_status"
        type: "rectangle"
        appearance:
          fill:
            entity: "sensor.power_level"
            attribute: "state"
            mapping:
              100: "#00FF00"
              75: "#FFFF00"
              50: "#FF9900"
              25: "#FF3300"
            interpolate: true
            default: "#666666"
        text:
          content: "POWER"
          color: "#000000"
          fontWeight: "bold"
        layout:
          width: 100
          height: 40
          anchor:
            to: "navigation.nav_bar"
            element_point: "topLeft"
            target_point: "bottomLeft"
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "more-info"
                entity: "sensor.power_level"
      
      - id: "shields_control"
        type: "elbow"
        appearance:
          fill:
            entity: "binary_sensor.shields"
            mapping:
              "on": "#0099CC"
              "off": "#333333"
            default: "#666666"
          orientation: "top-right"
          bodyWidth: 20
          armHeight: 15
        text:
          content: "SHIELDS"
          color: "#FFFFFF"
          elbow_text_position: "top"
        layout:
          width: 120
          height: 80
          anchor:
            to: "systems.power_status"
            element_point: "topLeft"
            target_point: "topRight"
        interactions:
          button:
            enabled: true
            actions:
              tap:
                action: "toggle"
                entity: "binary_sensor.shields"
                confirmation: true
        animations:
          on_load:
            type: "fade"
            duration: 0.8
            delay: 0.5

  - group_id: "alerts"
    elements:
      - id: "alert_panel"
        type: "rectangle"
        appearance:
          fill: "#CC3300"
          stroke: "#FF6666"
          strokeWidth: 2
        text:
          content: "RED ALERT"
          color: "#FFFFFF"
          fontSize: 20
          fontWeight: "bold"
          cutout: true
        layout:
          width: 200
          height: 60
          anchor:
            to: "container"
            element_point: "bottomRight"
            target_point: "bottomRight"
        interactions:
          visibility_triggers:
            - trigger_source:
                element_id_ref: "alerts.alert_panel"
                event: "click"
              targets:
                - type: "element"
                  id: "alerts.alert_details"
              action: "toggle"
          button:
            enabled: true
        animations:
          on_show:
            type: "scale"
            scale_params:
              scale_start: 0.8
              scale_end: 1.0
            duration: 0.3
            ease: "back.out"
      
      - id: "alert_details"
        type: "rectangle"
        appearance:
          fill: "#660000"
          stroke: "#CC3300"
          strokeWidth: 1
        text:
          content: "HULL BREACH - DECK 7\nAUTOMATIC CONTAINMENT ACTIVE"
          color: "#FFFFFF"
          fontSize: 12
        layout:
          width: 250
          height: 80
          anchor:
            to: "alerts.alert_panel"
            element_point: "bottomRight"
            target_point: "topRight"
        animations:
          on_show:
            type: "slide"
            slide_params:
              direction: "down"
              distance: "20px"
              opacity_start: 0
            duration: 0.4
```