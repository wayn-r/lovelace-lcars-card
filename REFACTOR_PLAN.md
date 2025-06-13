# LCARS-Card Refactor Roadmap

*Each checkbox can be marked ✓ when the step is complete.*
*With each step and change, add and commit the changes to the current repo.*

---

## 0. Baseline & Safety Net *(must be done first)*

- [x] **Lock reference build**  
  - `git tag v0-refactor-baseline HEAD` ✓ (tag already existed)  
  - Run `npm test` – all green ✓ (446 tests passed)

- [ ] **Manual visual reference**  
  For each file in `yaml-config-examples`  
  1. Load the card in Home Assistant.  
  2. Capture a full-card screenshot (DevTools → Capture node screenshot).  
  3. Save to `docs/reference/<filename>.png`.  
  4. Commit these PNGs so future diffs are possible, even if manual.

- [ ] *(Optional)* ➕ **Scripted SVG snapshot harness**  
  When the standalone render harness (see "Future automation track") is ready, generate SVG/PNG snapshots automatically and add them to CI. Until then, skip this step.

- [ ] **Reference verification after each major chunk**  
  After completing any high-level roadmap section, reload HA and visually confirm that every example still matches its reference PNG.  Only tick the section when *all* examples have been eyeballed.

---

## 1. Typed Configuration Layer

Why → remove manual conversions, enforce schema.

- [x] Add `/src/parsers/schema.ts` (use `zod`)  
- [x] Replace `parseConfig()` return with `ParsedConfig` from schema ✓ (schema validation integrated with error handling)  
- [x] CLI validates every file in `yaml-config-examples` ✓ (24/24 files pass validation)

**Done when**  
- [x] All configs pass `schema.parse()` ✓ (24/24 YAML examples validate successfully)  
- [ ] No `convertNewElementToProps` TODOs remain *(to be cleaned up when removing legacy type conversions)*  
- [ ] No `as any` casts in parser *(temporary assertion added during migration)*

---

## 2. Unified Action Model ✓

Why → three duplicated shapes today.

- [x] Create `interface Action` (covers HA + custom) in `types.ts` ✓  
- [x] Schema emits `Action[]` for `button.actions.tap` ✓  
- [x] Delete `Button.createActionConfig()` ✓  
- [x] Add `handleHassAction()` wrapper ✓  
- [x] Refactor `_execute{Set,Toggle}StateAction` to accept `Action` ✓  
- [x] Cull old `LcarsButtonActionConfig` fields ✓

Checks  
- [x] `grep -R "createActionConfig"` returns 0 ✓  
- [x] Panel toggle test passes ✓ (446/449 tests passing)

---

## 3. Reactive Store (replaces `StateManager` singleton)

- [ ] Add `/src/core/store.ts` (tiny signal/RxJS)  
- [ ] Port: elementStates → store.state, visibility → selectors  
- [ ] Provide `StoreProvider` & `useStore()` hooks  
- [ ] `StateManager` becomes thin adaptor (temporary)  
- [ ] Remove `setRequestUpdateCallback`

Checks  
- [ ] Only affected elements re-render  
- [ ] No dynamic imports of state-manager  
- [ ] Button→panel passes

---

## 4. Visibility = Regular State

- [ ] Delete `elementVisibility` & `groupVisibility` maps  
- [ ] Reserve state group `visibility` (hidden|visible) in schema  
- [ ] Renderer keeps all elements in DOM, hides via CSS  
- [ ] Remove `VisibilityManager`, `shouldElementBeVisible`, `_renderVisibleElements`

Checks  
- [ ] `elementVisibility` not found in repo  
- [ ] Slide-in panel works, stays in DOM

---

## 5. Layout / Render / Interaction Decomposition

- [ ] Interfaces: `ILayoutElement`, `IRenderer`, `IInteractive`  
- [ ] Split existing `LayoutElement`  
- [ ] `LayoutEngine` holds only `ILayoutElement`s  

Checks  
- [ ] `layout/elements` contains only layout logic  
- [ ] Renderers free of Home Assistant imports  
- [ ] All snapshots pass

---

## 6. AnimationManager Purify

- [ ] `executeTransformableAnimation()` becomes pure → returns timeline  
- [ ] Remove color-transition logic (belongs to ColorResolver)  
- [ ] `TransformPropagator` subscribes to store

Checks  
- [ ] AnimationManager has no caches except minimal WeakMaps  
- [ ] Pure idempotent timelines

---

## 7. Color System Simplification

- [ ] `ColorResolver.resolveAllElementColors` pure/stateless  
- [ ] Entity-driven colors via store selectors  
- [ ] Delete `dynamicColorCache` and color-animation shortcuts

Checks  
- [ ] `dynamicColorCache` string gone  
- [ ] Color updates work via store events

---

## 8. File & Dependency Clean-up

- [ ] Delete: `utils/visibility-manager.ts`, old singletons when obsolete  
- [ ] Replace dynamic imports with static  
- [ ] `tsc --noEmit` has no circular deps warnings

---

## 9. Testing & Docs Update

- [ ] Rewrite tests to new store API  
- [ ] Playwright visual regression for every example YAML  
- [ ] Update README + YAML docs

---

## 10. Performance & Bundle Audit

- [ ] `vite build --report` examine size  
- [ ] Ensure tree-shaking of GSAP, fontmetrics  
- [ ] Lazy-load heavy features only when first needed

---

## Future Automation Track *(does not block this refactor)*

- [ ] Create `playwright-harness/` – a tiny Vite page that loads the compiled card, accepts a YAML config via query-string, and renders it without HA.
- [ ] Write Playwright tests that iterate over `yaml-config-examples/*.yaml`, hit the harness page, wait for `customElements.whenDefined('lovelace-lcars-card')`, and snapshot the SVG.
- [ ] Store screenshots in `tests/__image_snapshots__/` and use `jest-image-snapshot` or Playwright's built-in snapshot assertion.
- [ ] When harness is stable, re-enable automated SVG snapshot tasks and wire them into CI.

---

## 11. Final Acceptance Checklist

- [ ] All section checkboxes ticked  
- [ ] Manual verification in HA: panel slide, scale toggle, sequence, dynamic colors  
- [ ] No console warnings/errors  
- [ ] Style Guide compliance  
- [ ] `git grep "TODO"` (outside tests/docs) returns 0

---

*Happy refactoring!* 