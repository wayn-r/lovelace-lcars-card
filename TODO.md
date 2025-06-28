## BUGS
### Elements
- percentage height/width doesn't seem to be working for elbows
- text needs to be vertically centered properly by default inside elements
- text attributes in elements need edge constraint handling

### YAML Config
- this runs extremely slow when the config gets complex
    - the current solution is to develop widgets that encompass most details, but this isn't helpful for users that want to make their own dashboards

## TODOs:
### Widgets
- implement notification widget from old version
- implement environmental header weather widget (temp, current conditions, etc)
    - this should have:
        - an empty leading rectangle, 
        - a rectangle with the stat header inside, and 
            - this should be clickable to open the referenced entity
        - the data
            - the data should be clickable to update the units
- implement the environmental header widget which will contain:
    - environmental header weather widgets
    - an environmentals configured version of the notification widget
    - an icon for current conditions (minimal iconography-styled radar maybe in the future?)

### Appearance
- theming support

### Layout
- anchor logic needs reworked to adapt for multiple-element anchor positioning
    - for example, an element should be able to anchor on some side of one element and another side of another
    - this allows for smooth, cascaded origin points

- implement text features:
    - cutout and dominantBaseline not implemented
    - fontWeight doesn't seem to work with smaller values - that might be inherent to fontWeight
    - textTransform only seems to work with uppercase and lowercase; integrate css logic or add other transforms
- determine an appropriate way to handle groups of elements that curve into other groups of elements. visually, these look like they might be the same concept to group into a larger section
