## BUGS
### Appearance
- text sizing is still broken

### Optimization
- log overflow: logger widget seems to retain data for as long as it's running leading to an enormous amount of useless data
    - there may be something similar with graphs, but I've only noticed it in the same interface taht the logger is running simultaneously

### Layout
- elements aren't anchoring to expect graph points: this seems likely isolated to the button area not being considered for the anchor position

### YAML Config
- this runs extremely slow when the config gets complex
    - the current solution is to develop widgets that encompass most details, but this isn't helpful for users that want to make their own dashboards
    
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
