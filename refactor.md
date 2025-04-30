# LCARS Card Editor Refactor Plan

This document outlines the steps to refactor the `lcars-card-editor` using a schema-based approach with `<ha-form>`, inspired by Mushroom cards.

## Goal

Migrate the current manual HTML templating for editor fields to a schema-based approach using Home Assistant's form components (`<ha-form>`). This will significantly reduce boilerplate, improve maintainability, and leverage existing HA UI patterns.

## Phases

### Phase 1: Introduce `<ha-form>` for Basic Card Properties (Optional)

- [x] Create a new lcars-card-editor.ts file to migrate the new logic into.
- [x] Define a simple `HaFormSchema` array for any card-level configuration. - Deferred, focusing on elements first.
- [x] Render an `<ha-form>` element in the main `render()` method for these basic properties. - Deferred.
- [x] Update or remove `_handleBasicChange` to work with the `<ha-form>` `value-changed` event. - Deferred.
- [x] **Verification:** Basic section of the editor renders correctly via `<ha-form>`. - *Deferred/Requires manual testing.*

### Phase 2: Refactor Element Properties (`props`)

- [x] Create `_computeElementPropsSchema(elementType)` function to generate `HaFormSchema` array based on element type.
    - [x] Use standard HA selectors (`text`, `number`, `boolean`, etc.).
    - [x] Use/Investigate appropriate color selectors (e.g., `mush_color` or HA standard). - Used `ha-color-picker` selector.
    - [x] Handle conditional schema logic (e.g., advanced text options). - Included all options for now.
- [x] Update `_renderElementEditor` (or new component) to render props using `<ha-form>` with the generated schema and `element.props` data.
- [x] Create `_handleElementPropsChange(ev, index)` handler for the props `<ha-form>`.
- [x] Remove the old `_renderPropsFields` function. - Replaced by schema/ha-form approach.
- [x] **Verification:** "Props" section for each element type renders correctly via `<ha-form>` and updates config.

### Phase 3: Refactor Element Layout (`layout`)

- [x] Create `_computeElementLayoutSchema(element)` function to generate `HaFormSchema` array for layout properties.
    - [x] Use standard selectors for simple fields (offsets).
    - [x] Implement `select` selectors for `anchorTo` and `stretchTo`, dynamically populating options.
    - [x] Choose and implement a strategy for Anchor Grids:
        - [x] **Option A:** Create custom `<lcars-anchor-grid-selector>` Lit element(s). - Implemented `lcars-grid-selector`.
        - [ ] **Option B:** Use simpler selectors (e.g., `select`) initially. - Superseded by Option A.
        - [ ] **Option C:** Investigate reusing/adapting Mushroom components (e.g., `alignment-picker`).
- [x] Update `_renderElementEditor` (or new component) to render layout using `<ha-form>` with the generated schema and `element.layout` data.
- [x] Create `_handleElementLayoutChange(ev, index)` handler for the layout `<ha-form>`.
- [x] Remove `_renderLayoutFields` and related helper functions (`_renderAnchorGrid`, `_renderAnchorMultiGrid`). - Replaced by schema/ha-form approach.
- [x] **Verification:** "Layout" section renders correctly, anchor/stretch selections work, and updates config.

### Phase 4: Refactor Group and Element Management UI

- [x] **Component Breakdown:** Consider splitting `LcarsCardEditor` into smaller components:
    - [x] `<lcars-group-editor>` (for single group display/management) - Implemented via render methods.
    - [x] `<lcars-element-editor>` (for single element display/props/layout forms) - Implemented via render methods.
    - [x] `<lcars-element-list>` (for overall list management, add buttons, drag-and-drop) - Implemented via render methods.
- [x] Simplify state management (`_collapsedGroups`, `_editingGroup`, etc.), potentially moving state down into sub-components. - State kept central for now, passed via props/callbacks implicitly.
- [x] Review and refactor event handling for communication between components and `config-changed` events. - Refactored handlers for groups/elements.
- [x] Refine drag-and-drop logic, potentially within `<lcars-element-list>`. - Implemented drag/drop within groups.
- [ ] **Verification:** Group/element management (add, rename, delete, collapse, reorder) functions correctly with the new component structure. - *Requires manual testing.*

### Phase 5: Cleanup and Final Polish

- [ ] Delete unused old rendering functions, state variables, and event handlers.
- [ ] Remove unused imports.
- [ ] Review and simplify CSS styles.
- [ ] Add code comments where necessary (schema generation, custom elements).
- [ ] Final end-to-end testing of the editor. 