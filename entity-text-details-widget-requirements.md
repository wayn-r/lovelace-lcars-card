# Requirements for `entity-text-details` Widget

## General Layout
The widget will have 3 reusable components:
- a small, leading rectangle for aesthetic purposes
- a second rectangle containing entity or attribute name (configurable)
- a text element containing entity or attribute data (configurable)

### Leading Rectangle Details
the leading rectangle should default to:
- 8px wide (configurable by user)
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

## Default Interactivity
the entity/attribute label should default to opening the entity/attribute "more-info" when clicked
this should have the option to be overridden if the user sets an action-config for it