import { css } from 'lit';

export const editorStyles = css`
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
  .drag-handle {
      cursor: grab;
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
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      padding: 8px;
      border: 1px dashed var(--divider-color);
      border-radius: 4px;
  }
  .add-element-form .form-actions {
      display: flex;
      gap: 4px;
  }
  .layout-grid-2col { display: none; } /* Hide old layout */
  .element-section h5 { display: none; } /* Hide old section headers */
  /* Ensure custom grid selector is styled appropriately if rendered manually */
  lcars-grid-selector {
      margin-top: 16px;
      display: block;
  }
  ha-form {
      /* Add styles if needed */
  }
  .element-body {
      padding: 12px;
      background-color: rgba(var(--rgb-primary-background-color), 0.5);
  }
`; 