## BUGS
### Architectural
~~- endcap and chisel-endcap: these should be consolidated into just endcaps with an appearance option for 'chisel' defaulted to false~~
~~- graph-widget: grid and its options should be relocated to appearance~~
~~- entity-text-widget: label and value should be relocated into text and each should utilize a text option set instead of the minimally duplicated set of text options~~
~~- entity-metric-widget: label, value, and unit should be relocated into text and each should utilize a text option set instead of the minimally duplicated set of text options~~
~~- vertical-slider: min, max, spacing, top_padding, label_height, and use_floats should all be relocated into appearance~~

### Visual Editor
~~- when element browser is open, the previous element's configuration should be closed~~
~~- there needs to be a way to add and remove elements and groups~~
~~- there needs to be a way to edit group names~~
~~- comboboxes with string values of "None" don't format correctly:~~
~~  - "None" covers up the title of the combobox~~
~~  - If there is a "None" value, the combobox should display with no value.~~
~~  - This could be a None type, I'm not 100% sure~~
~~- most options should fit side by side to minimize vertical real-estate in the configurator~~
~~- anchoring should have two possible anchor points~~
~~  - the configurator only shows the option for one~~
~~- anchoring doesn't handle target/element points correctly:~~
~~  - neither are pulled in from the existing yaml config~~
~~  - changing them breaks the layout sometimes~~
~~- elbows don't have correct orientation options:~~
~~  - currently they show left or right, but these should have top-left, top-right, bottom-left, and bottom-right as options~~
~~- elbows show a chisel option, but this does not apply to elbows~~
~~- elbows should have arm_height and body_width options in the layout group in addition to height and width~~
~~- text elements shouldn't have corner radius~~
- rounded corners is not an option for rectangle elements, it shouldn't be included in the appearance options
- widgets shouldn't have stroke color, stroke width, or corner radius
- logger widget shouldn't have rounded corners option
~~- cutout missing as an option from all elements' text option~~
~~- entity option missing from applicable widgets~~
~~- attribute option should reside in entity option group~~
~~- widget specific options missing from graph-widget~~
~~- widget specific options missing from most widgets:~~
~~  - some of these may be categorized in other option groups, but if they're specific to a widget, they should be in the widget eoption group~~

### Optimization
*I think this has been fixed*
~~- log overflow: logger widget seems to retain data for as long as it's running leading to an enormous amount of useless data~~
~~    - there may be something similar with graphs, but I've only noticed it in the same interface taht the logger is running simultaneously~~

### Layout
~~- elements aren't anchoring to expected graph points: this seems likely isolated to the button area not being considered for the anchor position~~
~~- elements aren't anchoring to expected metric-entity widget points: likely same as above~~

### YAML Config
~~- this runs extremely slow when the config gets complex~~
~~    - the current solution is to develop widgets that encompass most details, but this isn't helpful for users that want to make their own dashboards~~
    
### Elements
- percentage height/width doesn't seem to be working for elbows
- text needs to be vertically centered properly by default inside elements
- text attributes in elements need edge constraint handling

## TODOs:
### Widgets
~~- implement the environmental header widget which will contain:~~
    - environmental header weather widgets
~~    - an environmentals configured version of the notification widget~~
~~    - an icon for current conditions (minimal iconography-styled radar maybe in the future?)~~
        - other entity value widgets from below the graph in the RITOS sickbay example
    - clock and date widgets
    - animated analog clock clock widget (similar to the ritos design)

### Animation
- improve morph logic to make transitioning more natural and to have a better feel
~~    - elbows currently don't morph into the same dimensions and use total area dimensions~~
    - in the ritos example, some elbows that are aligned with nav buttons break up into those groups during transition
~~    - text should disappear if it isn't the same; or some other better way of handling this~~
~~    - color transitions need handled~~
    - implement multiple step timeline for different components to add to a better and more natural feel
        - text in headers should be collapsed by surrounding elements when transitioning out, then bisect and expand to fill the expected area when transitioning in.
    - similar groupings should be handled more elegantly
~~        - header groups~~
        - sidebar groups

~~- groups should match similar object relations or compatible connections based on orientation like rectangles below a top-left elbow.~~
- avoid overlapping morphs
- non-matched groups should expand/contract from outer limits:
~~    - grouped elements to the right of a top-left elbow that don't match a similar shape should be removed cascading from right to left.~~
    - matched groups should fill text voids THEN:
        - seek matches
        - split or merge into group matched components
~~- elements should identify valid connections for potential groups~~
    - this should influence element/group matching

### Visual Editor
- anchor and stretch targets should have some type of intellisense when filling them in
- anchor and stretch options need a different UX to handle them such as previously implemented
- button options need implemented beyond "enable"
