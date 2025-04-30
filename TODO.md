## BUGS:
 - group and element name editor should fill the width of its respective container up to the confirm/cancel buttons.
   - the confirm/cancel buttons seem to be left aligned with the name editor input field, but should instead be right aligned in their respective container

## TODOs:
 - implement stretch to cardinal point (top, bottom, left, right, or combination)
   - this is partially implemented. need to determine an appropriate way to handle stretching in multiple directions. elbow for example may stretch to the left canvas border AND stretch the vertical opening to a button placement.
 - implement headerbar as a standalone element
 - implement buttons
 - determine an appropriate way to handle vertical groups of elements
 - determine an appropriate way to handle groups of elements that curve into other groups of elements. visually, these look like they might be the same concept to group into a larger section
 - determine a way to implement animation logic for elements