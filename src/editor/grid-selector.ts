import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { fireEvent } from 'custom-card-helpers';

// Import necessary elements if not globally available
// Assume paper-tooltip and ha-icon are globally available
// import '@polymer/paper-tooltip/paper-tooltip.js'; // For tooltips on hover
// import '../../homeassistant-frontend/src/components/ha-icon.js';

@customElement('lcars-grid-selector')
export class LcarsGridSelector extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value = ''; // Selected anchor point (e.g., 'topLeft')
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) labelCenter = false;
  @property({ type: Boolean }) disableCorners = false;

  static styles = css`
    .anchor-grid-label {
      font-weight: bold;
      margin-bottom: 4px;
      display: block;
    }
    .anchor-grid-label.center {
        text-align: center;
        width: 100%;
    }
    .anchor-grid {
      display: grid;
      grid-template-columns: repeat(3, var(--lcars-grid-selector-size, 28px));
      grid-template-rows: repeat(3, var(--lcars-grid-selector-size, 28px));
      gap: 4px;
      margin-bottom: 8px;
      justify-content: center; /* Center grid horizontally */
    }
    .anchor-grid-btn {
      width: var(--lcars-grid-selector-size, 28px);
      height: var(--lcars-grid-selector-size, 28px);
      border: 1.5px solid var(--divider-color, #888);
      background: var(--card-background-color, #222);
      border-radius: 6px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      position: relative; /* For tooltip positioning */
    }
    .anchor-grid-btn:focus-visible {
      border-color: var(--primary-color, #ff9800);
    }
    .anchor-grid-btn.selected {
      border-color: var(--primary-color, #ff9800);
      background: var(--primary-color, #ff9800);
    }
    .anchor-grid-btn.selected ha-icon {
      color: #fff !important; /* Ensure icon color contrasts with selected background */
    }
    .anchor-grid-btn[disabled] {
      cursor: not-allowed;
      opacity: 0.3;
    }
    ha-icon {
      font-size: calc(var(--lcars-grid-selector-size, 28px) * 0.7); /* Scale icon size */
      color: var(--secondary-text-color, #bbb);
      transition: color 0.2s;
    }
    .center-icon {
        opacity: 0.7;
    }
    .center-selected-indicator {
        font-size: calc(var(--lcars-grid-selector-size, 28px) * 0.7);
        position: absolute;
        color: #fff; /* White indicator for center */
    }
  `;

  private _handleClick(point: string): void {
    if (this.disabled) return;

    const isCorner = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(point);
    if (this.disableCorners && isCorner) {
        return; // Don't allow selecting disabled corners
    }

    const newValue = this.value === point ? '' : point; // Toggle selection, empty string means deselect
    if (newValue !== this.value) {
        this.value = newValue;
        fireEvent(this, 'value-changed', { value: this.value });
    }
  }

  protected render(): TemplateResult {
    const points = [
      'topLeft', 'topCenter', 'topRight',
      'centerLeft', 'center', 'centerRight',
      'bottomLeft', 'bottomCenter', 'bottomRight'
    ];

    const iconMap: Record<string, string> = {
      topLeft: 'mdi:arrow-top-left',
      topCenter: 'mdi:arrow-up',
      topRight: 'mdi:arrow-top-right',
      centerLeft: 'mdi:arrow-left',
      center: 'mdi:circle-small',
      centerRight: 'mdi:arrow-right',
      bottomLeft: 'mdi:arrow-bottom-left',
      bottomCenter: 'mdi:arrow-down',
      bottomRight: 'mdi:arrow-bottom-right',
    };

    return html`
      ${this.label ? html`<span class="anchor-grid-label ${this.labelCenter ? 'center' : ''}">${this.label}</span>` : ''}
      <div class="anchor-grid">
        ${points.map(pt => {
          const isSelected = this.value === pt;
          const isCorner = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(pt);
          const isDisabled = this.disabled || (this.disableCorners && isCorner);
          const isCenter = pt === 'center';

          return html`
            <button
              id="button-${pt}"
              class="anchor-grid-btn ${isSelected ? 'selected' : ''}"
              title=${pt}
              ?disabled=${isDisabled}
              @click=${() => this._handleClick(pt)}
              type="button"
            >
              <ha-icon
                class="${isCenter ? 'center-icon' : ''}"
                icon="${iconMap[pt]}"
              ></ha-icon>
              ${isSelected && isCenter ? html`<ha-icon class="center-selected-indicator" icon="mdi:circle"></ha-icon>` : ''}
            </button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-grid-selector': LcarsGridSelector;
  }
} 