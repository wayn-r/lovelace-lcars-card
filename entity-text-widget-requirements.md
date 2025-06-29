# Requirements for `entity-text` Widget

## General Layout
The widget will have 3 reusable components:
- a small, leading rectangle for aesthetic purposes
- a second rectangle containing entity or attribute name (configurable)
- a text element containing entity or attribute data (configurable)

### Leading Rectangle Details
the leading rectangle should default to:
- 8px wide
- height not independently configurable

### Entity or Attribute Label Rectangle Details
this element will be another rectangle that anchors:
- to: leading rectangle
- element_point: topLeft
- target_point: topRight
- offsetX: 3px (configurable by user)

this element will contain text as:
- the name of the entity or attribute selected by the user, or
- a configurable string

the width should default to 80px (configurable by user)

the text:
- height will be configurable independently of the total widget height
- font, weight, and fill will be configurable
- default height will be 20
    - user configurability should override this even if they use fontSize (which is normally superceded by using the height attribute)

the rectangle's height will not be independently configurable

### Entity or Attribute Data Text Details
this element will be a text element that anchors:
- to: label rectangle
- element_point: topLeft
- target_point: topRight
- offsetX: 10px (configurable by user)

this element will display:
- the data of the entity or attribute selected by the user, or
- a configurable string

configurability:
- height will not be independently configurable
- the font family, weight, and fill will be configurable

## General Configurability

the height will be configurable for the widget as a whole which will set the height of:
- leading rectangle,
- entity/attribute label rectangle, and
- entity/attribute text element

the default height will be 25

### Configuration Example
Minimal Implementation
```yaml
type: custom:lovelace-lcars-card
card_title: Entity Text Widget Example
groups:
  - group_id: main_display
    elements:
      - id: widget
        type: entity-text-widget
        entity: light.kitchen_sink_light
```

Implementation with Configurables Changed
```yaml
type: custom:lovelace-lcars-card
card_title: Entity Text Widget Example
groups:
  - group_id: main_display
    elements:
      - id: widget
        type: entity-text-widget
        entity: light.kitchen_sink_light
        label:
          content: Sink Light
          height: 20
          fontFamily: Antonio
          fontWeight: Bold
          fill: "#00CC99"
          offsetX: 8
          width: 100
        value:
          content: im a light
          fontFamily: Antonio
          fontWeight: narrow
          offsetX: 15
        appearance:
          fill: "#0099CC"
        layout:
          height: 30
```

## Default Interactivity
the entity/attribute label should default to opening the entity/attribute "more-info" when clicked
this should have the option to be overridden if the user sets an action-config for it