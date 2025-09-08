## BUGS
### Architectural
~~- endcap and chisel-endcap: these should be consolidated into just endcaps with an appearance option for 'chisel' defaulted to false~~
~~- graph-widget: grid and its options should be relocated to appearance~~
~~- entity-text-widget: label and value should be relocated into text and each should utilize a text option set instead of the minimally duplicated set of text options~~
~~- entity-metric-widget: label, value, and unit should be relocated into text and each should utilize a text option set instead of the minimally duplicated set of text options~~
~~- vertical-slider: min, max, spacing, top_padding, label_height, and use_floats should all be relocated into appearance~~

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
    - text should disappear if it isn't the same; or some other better way of handling this
    - color transitions need handled
    - implement multiple step timeline for different components to add to a better and more natural feel
        - text in headers should be collapsed by surrounding elements when transitioning out, then bisect and expand to fill the expected area when transitioning in.
    - similar groupings should be handled more elegantly
        - header groups
        - sidebar groups

- groups should match similar object relations or compatible connections based on orientation like rectangles below a top-left elbow.
- avoid overlapping morphs
- non-matched groups should expand/contract from outer limits:
    - grouped elements to the right of a top-left elbow that don't match a similar shape should be removed cascading from right to left.
    - matched groups should fill text voids THEN:
        - seek matches
        - split or merge into group matched components
        