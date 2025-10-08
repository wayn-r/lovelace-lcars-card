import { css } from 'lit';

export const editorStyles = css`
  :host {
      display: block;
    }    
  .card-config {
    padding: 16px;
    background: var(--primary-background-color);
  }

  .header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--divider-color);
  }

  .title {
    font-size: 24px;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 14px;
    color: var(--secondary-text-color);
  }

  .option {
    margin-bottom: 16px;
  }

  ha-textfield {
    width: 100%;
  }

  .helper-text {
    font-size: 12px;
    color: var(--secondary-text-color);
    margin-top: 4px;
    padding-left: 4px;
  }

  .section {
    margin: 24px 0;
    padding: 16px;
    background: var(--secondary-background-color);
    border-radius: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 16px;
  }

  .section-header ha-icon {
    color: var(--primary-color);
  }

  .groups-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-card {
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--primary-background-color);
    border-bottom: 1px solid var(--divider-color);
  }

  .group-header ha-icon {
    color: var(--primary-color);
  }

  .group-info {
    flex: 1;
  }

  .group-name {
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .group-meta {
    font-size: 12px;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .elements-list {
    padding: 8px;
  }

  .drag-placeholder {
    width: 100%;
    box-sizing: border-box;
    border: 2px dashed var(--divider-color);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    transition: background 0.2s ease;
    pointer-events: none;
  }

  .group-placeholder {
    margin: 4px 0;
  }

  .element-placeholder {
    margin: 4px 0;
  }

  .drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: var(--secondary-text-color);
  }

  .drag-handle:hover {
    color: var(--primary-text-color);
  }

  .group-header .drag-handle {
    --mdc-icon-size: 20px;
  }

  .element-drag-handle {
    --mdc-icon-size: 18px;
  }

  .element-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    width: 100%;
    box-sizing: border-box;
    background: var(--primary-background-color);
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .element-item:last-child {
    margin-bottom: 0;
  }

  .element-item ha-icon {
    color: var(--secondary-text-color);
    --mdc-icon-size: 24px;
  }

  .group-item.dragging,
  .element-item.dragging {
    cursor: grabbing;
  }

  .dragging .drag-handle {
    cursor: grabbing;
  }

  .element-id {
    font-weight: 500;
    color: var(--primary-text-color);
    flex: 1;
  }

  .element-type {
    font-size: 12px;
    color: var(--secondary-text-color);
    padding: 2px 8px;
    background: var(--divider-color);
    border-radius: 4px;
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: var(--secondary-text-color);
  }

  .empty-state ha-icon {
    --mdc-icon-size: 48px;
    opacity: 0.5;
    margin-bottom: 8px;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .info-box {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--info-color, #2196F3);
    color: white;
    border-radius: 8px;
    margin: 24px 0;
  }

  .info-box ha-icon {
    --mdc-icon-size: 24px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-content {
    flex: 1;
  }

  .info-content strong {
    display: block;
    margin-bottom: 8px;
    font-size: 16px;
  }

  .info-content p {
    margin: 4px 0;
    font-size: 14px;
    opacity: 0.95;
  }

  .yaml-section {
    margin-top: 24px;
  }

  .yaml-preview {
    background: var(--code-editor-background-color, #1e1e1e);
    color: var(--code-editor-text-color, #d4d4d4);
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
  }

  /* New Editor Layout Styles */
  .filter-box {
    margin-bottom: 16px;
  }

  .browser-collapsed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card-background-color);
    border: 2px solid var(--primary-color);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    user-select: none;
  }

  .browser-collapsed:hover {
    background: var(--secondary-background-color);
  }

  .collapsed-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .element-path {
    font-weight: 500;
    font-size: 16px;
    color: var(--primary-text-color);
    font-family: monospace;
  }

  .expand-icon {
    color: var(--primary-color);
    --mdc-icon-size: 24px;
  }

  .collapse-browser-icon {
    margin-left: auto;
    cursor: pointer;
    color: var(--primary-color);
    --mdc-icon-size: 20px;
    padding: 4px;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .collapse-browser-icon:hover {
    background: var(--secondary-background-color);
  }

  .section-header {
    position: relative;
  }

  .groups-tree {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-item {
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .group-header.clickable {
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s;
  }

  .group-header.clickable:hover {
    background: var(--secondary-background-color);
  }

  .group-header.editing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .group-header.editing ha-textfield {
    flex: 1;
  }

  .collapse-icon {
    --mdc-icon-size: 20px;
    transition: transform 0.2s;
  }

  .element-item {
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s, border-color 0.2s;
    border: 1px solid transparent;
  }

  .element-item:hover {
    background: var(--secondary-background-color);
  }

  .element-item.selected {
    background: var(--primary-color);
    color: var(--text-primary-color);
    border-color: var(--primary-color);
  }

  .element-item.selected .element-id,
  .element-item.selected .element-type {
    color: var(--text-primary-color);
  }

  .element-item.selected ha-icon {
    color: var(--text-primary-color);
  }

  .delete-button {
    color: var(--error-color);
  }

  .delete-element-button {
    --mdc-icon-button-size: 32px;
    margin-left: auto;
  }

  .delete-element-button ha-icon {
    color: var(--error-color);
    --mdc-icon-size: 18px;
  }

  .add-group-button {
    padding: 12px 8px;
    text-align: center;
  }

  .empty-state-small {
    padding: 16px;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 12px;
    font-style: italic;
  }

  .icon-button-small {
    --mdc-icon-button-size: 32px;
  }

  .icon-button-small ha-icon {
    --mdc-icon-size: 18px;
  }

  .icon-button-tiny {
    --mdc-icon-button-size: 28px;
  }

  .icon-button-tiny ha-icon {
    --mdc-icon-size: 16px;
  }

  .element-id-input {
    flex: 1;
    min-width: 100px;
  }

  .element-icon-large {
    --mdc-icon-size: 40px;
    color: var(--secondary-text-color);
  }

  .element-type-select {
    min-width: 150px;
  }

  .config-panel {
    padding-top: 16px;
  }

  .element-info-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--primary-background-color);
    border: 1px solid transparent;
    border-radius: 4px;
    margin-bottom: 16px;
    position: relative;
  }

  .element-info-header-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .element-info-display {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .element-info-chip {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    transition: color 0.2s ease;
    outline: none;
    border-radius: 4px;
    min-width: 0;
    padding: 4px 8px;
  }

  .element-info-chip:focus-visible {
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  .element-info-id-chip {
    flex: 1;
    min-width: 0;
  }

  .element-info-type-chip {
    padding: 0;
  }

  .editable-icon {
    color: var(--primary-color);
    pointer-events: none;
    opacity: 0;
    width: 0;
    overflow: hidden;
    transition: opacity 0.2s ease, width 0.2s ease, margin 0.2s ease;
    display: inline-flex;
  }

  .element-info-id-icon,
  .element-info-type-icon {
    --mdc-icon-size: 18px;
  }

  .element-info-id-chip:hover .element-info-id-icon,
  .element-info-id-chip:focus-visible .element-info-id-icon {
    opacity: 1;
    width: 20px;
    margin-left: 4px;
  }

  .element-info-type-chip:hover .element-info-type-icon,
  .element-info-type-chip:focus-visible .element-info-type-icon {
    opacity: 1;
    width: 20px;
    margin-right: 4px;
  }

  .element-info-id-chip:hover .element-id,
  .element-info-id-chip:focus-visible .element-id,
  .element-info-type-chip:hover .element-type,
  .element-info-type-chip:focus-visible .element-type {
    color: var(--primary-color);
  }

  .element-info-chip .element-id,
  .element-info-chip .element-type {
    flex: 0 0 auto;
  }

  .element-info-id-editing,
  .element-info-type-editing {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .element-info-id-editing {
    flex: 1;
    flex-wrap: nowrap;
    min-width: 0;
  }

  .element-info-type-editing {
    flex-wrap: wrap;
  }

  .element-info-edit-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
  }

  .element-info-id-input {
    flex: 1;
    min-width: 0;
  }

  .element-info-header .element-action-button-small {
    --mdc-icon-button-size: 28px;
    --mdc-icon-size: 24px;
    display: flex;
  }

  .element-info-header .element-action-button-small ha-icon {
    --mdc-icon-size: 24px;
    display: flex;
  }

  .config-section {
    margin-bottom: 16px;
  }

  .config-section-header {
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--divider-color);
  }

  /* Collapsible Config Sections */
  .collapsible-config-section {
    margin-bottom: 8px;
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .collapsible-config-section.expanded {
    border-color: var(--primary-color);
  }

  .collapsible-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    cursor: pointer;
    user-select: none;
    background: var(--primary-background-color);
    transition: background-color 0.2s ease;
  }

  .collapsible-section-header:hover {
    background: var(--secondary-background-color);
  }

  .collapsible-section-header .collapse-icon {
    --mdc-icon-size: 20px;
    color: var(--secondary-text-color);
    transition: transform 0.2s ease;
  }

  .collapsible-section-header .section-icon {
    --mdc-icon-size: 20px;
    color: var(--primary-color);
  }

  .collapsible-section-header .section-title {
    flex: 1;
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
  }

  .collapsible-section-content {
    padding: 12px;
    background: var(--card-background-color);
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 2000px;
    }
  }

  .config-subsection {
    margin-top: 16px;
    margin-bottom: 12px;
  }

  .config-subsection-header {
    font-weight: 500;
    font-size: 13px;
    color: var(--secondary-text-color);
    margin-bottom: 8px;
  }

  .config-row {
    margin-bottom: 16px;
  }

  .anchor-section-title {
    font-weight: 600;
    font-size: 12px;
    color: var(--primary-text-color);
  }

  .config-row--split {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .config-row--split .config-field {
    flex: 1 1 calc(50% - 8px);
    max-width: calc(50% - 8px);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .config-row--split .config-field ha-select,
  .config-row--split .config-field ha-textfield {
    width: 100%;
  }

  @media (max-width: 720px) {
    .config-row--split {
      flex-direction: column;
    }

    .config-row--split .config-field {
      max-width: 100%;
      flex-basis: 100%;
    }
  }

  .entity-config-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .entity-config-row__input {
    flex: 1;
  }

  .entity-config-row__remove {
    align-self: center;
    --mdc-icon-button-size: 40px;
    --mdc-icon-size: 22px;
  }

  .entity-config-row__remove ha-icon {
    --mdc-icon-size: 22px;
  }

  .entity-config-subrow {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .entity-config-subrow__field {
    flex: 1 1 180px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .entity-config-subrow__field ha-entity-attribute-picker,
  .entity-config-subrow__field ha-textfield,
  .entity-config-subrow__field ha-color-picker {
    width: 100%;
  }

  .add-entity-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    color: var(--primary-text-color);
    border-radius: 4px;
    padding: 4px 8px 4px 4px;
  }

  .add-entity-row:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .add-entity-row__icon {
    --mdc-icon-button-size: 32px;
    --mdc-icon-size: 18px;
  }

  .add-entity-row__label {
    font-weight: 500;
  }

  .config-row:last-child {
    margin-bottom: 0;
  }

  .config-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--secondary-background-color);
    border-radius: 8px;
    font-size: 12px;
    color: var(--secondary-text-color);
    margin-top: 16px;
  }

  .config-footer ha-icon {
    --mdc-icon-size: 16px;
  }

  @media (max-width: 600px) {
    .card-config {
      padding: 12px;
    }

    .title {
      font-size: 20px;
    }

    .config-panel {
      padding: 8px;
    }

    .collapsible-section-header {
      padding: 10px;
      font-size: 13px;
    }

    .collapsible-section-content {
      padding: 8px;
    }

    .config-row {
      margin-bottom: 12px;
    }

    .element-info-header {
      padding: 8px;
    }

    .helper-text {
      font-size: 11px;
    }

    /* Make config sections more compact on mobile */
    .collapsible-config-section {
      margin-bottom: 6px;
    }
  }
    
    ha-card {
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .card-wrapper {
      position: relative;
      display: block;
    }
    
    .card-container {
      width: 100%;
      position: relative;
      overflow: hidden;
      line-height: 0; /* Prevent extra spacing */
      display: block;
    }

    /* this doesn't work, but it's here for reference of where I see the problem in the 
       inspector. In the inspector, if I change 48px to 56px, everything positions
       correctly. Changing this in this file doesn't apply since it's in the shadow
       DOM.
    .edit-mode hui-view-container {
      padding-top: calc(var(--header-height) + 48px + env(safe-area-inset-top));
    } */
    
    svg {
      width: 100%;
      display: block;
      overflow: hidden;
    }
    
    /* Remove focus outline from SVG elements when clicked */
    svg *:focus {
      outline: none !important;
    }
    
    /* Remove outline from SVG button groups */
    svg .lcars-button-group:focus {
      outline: none !important;
    }
    
    /* Disable focus rectangle globally for the card */
    :host * {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
      
  .layout-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .layout-grid-2col ha-formfield {
    display: flex;
    flex-direction: column;
  }
  .layout-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .layout-grid-2col ha-formfield {
    display: flex;
    flex-direction: column;
  }
  /* Add Styles for groups, elements, headers, warnings, forms */
  .groups-container {
      /* Add styles */
  }
  .group-editor {
      border: 1.5px solid var(--divider-color);
      border-radius: 6px;
      margin-bottom: 16px;
      background: var(--secondary-background-color);
  }
  .group-editor.ungrouped {
      /* Special style for ungrouped? */
      border-style: dashed;
  }
  .group-header {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      gap: 8px;
  }
  .group-header.editing {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 8px;
  }
  .group-name {
      font-weight: bold;
  }
  .group-count {
      color: var(--secondary-text-color);
      font-size: 0.9em;
      margin-left: 4px;
  }
  .group-name-input,
  .element-name-input {
      flex: 1;
      margin-left: 8px;
      display: flex;
      flex-direction: column;
      width: 100%;
  }
  .group-name-input ha-textfield,
  .element-name-input ha-textfield {
      width: 100%;
  }
  .warning-text {
      color: var(--error-color);
      font-size: 0.9em;
      padding-left: 8px;
  }
  .delete-warning {
      background: var(--error-color);
      color: var(--text-primary-color);
      border-radius: 4px;
      margin: 8px 16px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
  }
  .delete-warning ha-button.warning-button {
      background: rgba(255,255,255,0.8);
      color: var(--error-color);
  }
  .delete-warning ha-button {
      margin-left: auto;
  }
  .spacer { flex: 1 1 auto; }

  .element-list {
      padding: 8px 16px 16px 16px;
  }
  .element-editor {
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      margin-bottom: 12px;
      background-color: var(--primary-background-color); /* Slightly different bg */
      transition: opacity 0.2s ease-in-out;
  }
  .element-editor.drag-over {
      border: 2px dashed var(--primary-color);
      background: rgba(var(--rgb-primary-color), 0.1);
  }
  .element-header {
      display: flex;
      align-items: center;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      gap: 8px;
      border-bottom: 1px solid var(--divider-color);
  }
  .element-header.editing {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 8px;
  }
  .element-name {
      font-weight: 500;
  }
  .element-type {
      color: var(--secondary-text-color);
      font-size: 0.9em;
      margin-left: 4px;
  }
  .collapse-icon {
      transition: transform 0.2s ease-in-out;
  }
  /* Consider rotating icon when collapsed? */

  .element-body {
      padding: 12px;
      background-color: rgba(var(--rgb-primary-background-color), 0.5);
      overflow: hidden; /* Prevent content from overflowing */
  }
  .element-section {
      margin-bottom: 16px;
  }
  .element-section h5 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 1.1em;
      border-bottom: 1px solid var(--accent-color);
      padding-bottom: 4px;
  }
  ha-icon-button {
    --mdc-icon-button-size: 36px; /* Smaller icon buttons */
  }
  .confirm-button {
      color: var(--primary-color);
      opacity: 0.5;
  }
  .confirm-button.valid {
      opacity: 1;
  }
  .confirm-button[disabled] {
      opacity: 0.5;
  }
  .cancel-button {
      color: var(--error-color);
  }
  .edit-button {
      /* Style */
  }
  .delete-button {
      color: var(--error-color);
  }
  .drag-handle:active {
      cursor: grab;
      /* Add minimal styling for the div handle */
      display: inline-flex; /* Align icon nicely */
      align-items: center;
      padding: 6px; /* Adjust padding as needed */
      margin-right: 4px; /* Spacing */
  }
  .drag-handle:active {
      cursor: grabbing;
  }
  .add-element-section,
  .add-group-section {
      text-align: right;
      margin-top: 8px;
  }
  .add-element-form {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      gap: 8px;
      padding: 8px;
      border: 1px dashed var(--divider-color);
      border-radius: 4px;
  }
  .add-element-form .element-name-input {
      width: 100%;
  }
  .layout-grid-2col { display: none; } /* Hide old layout */
  .element-section h5 { display: none; } /* Hide old section headers */
  /* Ensure custom grid selector is styled appropriately if rendered manually */
  lcars-grid-selector {
      margin-top: 8px;
      display: block;
      width: 100%; /* Ensure it doesn't overflow its container */
      max-width: 100%; /* Ensure it doesn't overflow its container */
      box-sizing: border-box; /* Include padding in width calculation */
  }

  /* Ensure the grid points themselves stay contained */
  lcars-grid-selector div {
      box-sizing: border-box;
      max-width: 100%;
  }
  ha-form {
      /* Add styles if needed */
  }
  .editing-actions {
      display: flex;
      margin-left: auto;
      gap: 4px;
  }
  /* Common styles for div-based icon buttons */
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px; /* Match drag handle or adjust */
    cursor: pointer;
    border-radius: 50%; /* Optional: make it round */
    transition: background-color 0.2s;
  }
  .icon-button:hover {
    background-color: rgba(var(--rgb-primary-text-color), 0.05);
  }
  .icon-button:active {
    background-color: rgba(var(--rgb-primary-text-color), 0.1);
  }

  /* Property layout styles */
  /* Remove or comment out old .property-container if it was a grid */
  /* .property-container {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px 16px;
    margin-bottom: 16px;
  } */

  .property-container-groups {
    /* This is the new top-level container within .element-body */
    /* It doesn't need to be a grid itself, groups will flow vertically */
  }

  .property-group {
    margin-bottom: 8px;
  }

  /* Special styling for the type property group */
  .type-property-group {
    margin-bottom: 16px;
    border: none;
    background-color: transparent;
  }

  .property-group-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--divider-color);
    font-weight: bold;
    user-select: none;
  }
  .property-group-header.static { /* For the error case */
      cursor: default;
  }

  .property-group-header .collapse-icon {
    margin-right: 8px;
    transition: transform 0.2s ease-in-out;
  }

  .property-group-name {
      /* Style for the name text if needed */
  }

  .property-group-content {
    padding: 12px;
  }

  .property-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px 16px;
    margin-bottom: 12px;
  }
  .property-row:last-child {
    margin-bottom: 0;
  }

  .property-full-width {
    grid-column: 1 / -1; /* Ensure it spans if inside a .property-row accidentally, or use directly */
    margin-bottom: 12px;
  }
  .property-full-width:last-child {
    margin-bottom: 0;
  }

  .property-left, .property-right {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  /* Ensure ha-form and its contents respect the grid structure */
  .property-row ha-form,
  .property-full-width ha-form {
    display: block;
    width: 100%;
    box-sizing: border-box;
  }

  /* Target common elements within ha-form to ensure they don't overflow */
  .property-row ha-form ha-textfield,
  .property-row ha-form ha-select,
  .property-row ha-form ha-color-picker,
  .property-full-width ha-form ha-textfield,
  .property-full-width ha-form ha-select,
  .property-full-width ha-form ha-color-picker {
    display: block;
    width: 100%;
    box-sizing: border-box;
  }

  /* Ensure custom grid selector behaves correctly */
  .property-row lcars-grid-selector,
  .property-full-width lcars-grid-selector {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  /* For Stretch layout specifically */
  .stretch-layout {
    /* uses property-row's grid */
  }
  .stretch-column-left, .stretch-column-right {
    display: flex;
    flex-direction: column;
    gap: 12px; /* Space between items within the stretch column */
  }
  .stretch-column-left ha-form, .stretch-column-right ha-form { /* Ensure ha-form itself takes width */
    width: 100%;
  }
  .stretch-column-right lcars-grid-selector { /* Ensure grid selector behaves in its column */
     margin-top: 0; /* Adjust if needed, was 8px */
  }

  /* Common styles for div-based icon buttons */
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px; /* Match drag handle or adjust */
    cursor: pointer;
    border-radius: 50%; /* Optional: make it round */
    transition: background-color 0.2s;
  }

  .icon-button:hover {
    background-color: rgba(var(--rgb-primary-text-color), 0.05);
  }

  .icon-button:active {
    background-color: rgba(var(--rgb-primary-text-color), 0.1);
  }

  /* Stretch gap container */
  .stretch-gap-container {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
  }
`; 
