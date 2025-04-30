## BUGS:

### ~~Anchor and Stretch components~~
  - ~~Anchor and stretch weren't properly migrated in the refactor:~~
    - ~~Anchor a stretch are currently bullet selectors and should instead be~~ 
      - ~~dropdowns that:~~
        - ~~defaults to a blank selection~~
        - ~~contains all of the existing elements~~
        - ~~contains 'Container' as an option~~
          - ~~this should be the first option below the blank option~~

## TODOs:

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