# Page snapshot

```yaml
- complementary:
  - button "Sidebar toggle"
  - text: Home Assistant
  - listbox:
    - option "Overview":
      - option "Overview"
    - option "Dashboard 1" [selected]:
      - option "Dashboard 1"
    - option "Map":
      - option "Map"
    - option "To-do lists":
      - option "To-do lists"
    - option "Developer tools":
      - option "Developer tools"
    - option "Settings 2":
      - option "Settings 2"
  - option "Notifications"
  - option "Profile":
    - option "Developer"
- text: LCARS
- button "Entity search"
- button "Edit dashboard"
- img:
  - text: Animation Configuration example LOADING... This element should have a fade-in effect when it loads.
  - button "sliding_panel_group.sliding_panel_trigger_button"
  - text: SHOW PANEL This button should trigger a panel to slide in from the left..
  - button "scale_target_group.scale_trigger_button"
  - text: SCALE This button should toggle the scale of the "scale_target" element when pressed. SCALE TARGET SEQUENCE This element should fade in, slide up, and scale up when it loads.
  - button "multi_action_group.multi_trigger_button"
  - text: MULTI ACTION
  - button "multi_action_group.reset_button"
  - text: RESET ALL
- img
```