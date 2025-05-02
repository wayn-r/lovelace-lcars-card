## BUGS:

## TODOs:

### Properties
- endcap:
  - missing color, direction, and type properties
  - direction should be a dropdown
  - properties should be in the following format:
    | element type |
    | color | direction |
    | width | height |
    < anchor options >
    < stretch options >
    | offset x | offset y |
- text:
  - missing color and type properties
  - shouldn't have width and height properties
  - text anchor and dominant baseline should be a dropdown instead of radio buttons
  - properties should be in the following format:
    | element type |
    | text content | color |
    | font family | font size |
    | font weight | letter spacing |
    | text anchor | dominant baseline |
    | text transform |  |
    < anchor options >
    < stretch options >
    | offset x | offset y |
- rectangle:
  - missing color and type properties
  - properties should be in the following format:
    | element type |
    | color |  |
    | width | height |
    < anchor options >
    < stretch options >
    | offset x | offset y |
- chisel-endcap:
  - missing color, side, and type properties
  - direction should be a dropdown instead of radio buttons
  - properties should be in the following format:
    | element type |
    | color | direction |
    | width | height |
    < anchor options >
    < stretch options >
    | offset x | offset y |
- elbow:
  - missing color, side, and type properties
  - orientation should be a dropdown instead of radio buttons
  - properties should be in the following format:
    | element type |
    | color | orientation |
    | horizontal width | vertical width |
    | header height | total height |
    | outer corner radius |  |
    < anchor options >
    < stretch options >
    | offset x | offset y |


### Components
- implement headerbar as a standalone element
- implement buttons

### Layout/Positioning
- implement stretch to cardinal point (top, bottom, left, right, or combination)
  - this is partially implemented. need to determine an appropriate way to handle stretching in multiple directions. elbow for example may stretch to the left canvas border AND stretch the vertical opening to a button placement.
- determine an appropriate way to handle vertical groups of elements
- determine an appropriate way to handle groups of elements that curve into other groups of elements. visually, these look like they might be the same concept to group into a larger section

### Features
- determine a way to implement animation logic for elements

### General/Configuration
- Organize layout of configurable options.