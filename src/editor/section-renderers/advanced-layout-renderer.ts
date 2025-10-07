import { html, TemplateResult } from 'lit';
import { ANCHOR_POINT_OPTIONS, normalizeAnchorPoint } from '../../config/schemas/layout.js';

export class AdvancedLayoutRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const layout = element.layout || {};
    const layoutPath = `${basePath}.layout`;

    return html`
      ${this._renderAnchorConfig(layout, layoutPath, onValueChanged)}
      ${this._renderStretchConfig(layout, layoutPath, onValueChanged)}
    `;
  }

  private static _renderAnchorConfig(
    layout: any,
    layoutPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const anchorPoints = ANCHOR_POINT_OPTIONS.map(value => ({
      value,
      label: value
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    }));

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Anchor Configuration</div>
        <div class="helper-text">Position this element relative to another element</div>
        ${this._renderAnchorSection(
          'Primary Anchor',
          layout.anchor,
          `${layoutPath}.anchor`,
          anchorPoints,
          onValueChanged
        )}

        ${this._renderAnchorSection(
          'Secondary Anchor (optional)',
          layout.secondary_anchor,
          `${layoutPath}.secondary_anchor`,
          anchorPoints,
          onValueChanged
        )}
      </div>
    `;
  }

  private static _renderAnchorSection(
    title: string,
    anchor: any,
    anchorPath: string,
    anchorPoints: Array<{ value: string; label: string }>,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const currentAnchor = anchor || {};
    const elementPointValue = normalizeAnchorPoint(currentAnchor.element_point) ?? currentAnchor.element_point;
    const targetPointValue = normalizeAnchorPoint(currentAnchor.target_point) ?? currentAnchor.target_point;
    const normalizedElementValue = elementPointValue ?? '';
    const normalizedTargetValue = targetPointValue ?? '';

    return html`
      <div class="config-row">
        <div class="anchor-section-title">${title}</div>
      </div>
      <div class="config-row">
        <ha-textfield
          label="Anchor To (Element ID)"
          .value=${currentAnchor.to || ''}
          .configValue=${`${anchorPath}.to`}
          @input=${onValueChanged}
          .placeholder=${'target-element-id'}
        ></ha-textfield>
        <div class="helper-text">ID of the element to anchor to</div>
      </div>

      <div class="config-row config-row--split">
        <div class="config-field">
          <ha-select
            label="Element Point"
            .value=${normalizedElementValue}
            .configValue=${`${anchorPath}.element_point`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="" aria-label="Unset"></mwc-list-item>
            ${anchorPoints.map(
              option => html`<mwc-list-item value=${option.value}>${option.label}</mwc-list-item>`
            )}
          </ha-select>
          <div class="helper-text">Anchor point on this element</div>
        </div>
        <div class="config-field">
          <ha-select
            label="Target Point"
            .value=${normalizedTargetValue}
            .configValue=${`${anchorPath}.target_point`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="" aria-label="Unset"></mwc-list-item>
            ${anchorPoints.map(
              option => html`<mwc-list-item value=${option.value}>${option.label}</mwc-list-item>`
            )}
          </ha-select>
          <div class="helper-text">Anchor point on target element</div>
        </div>
      </div>
    `;
  }

  private static _renderStretchConfig(
    layout: any,
    layoutPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const stretch = layout.stretch || {};
    const stretchPath = `${layoutPath}.stretch`;
    const target1 = stretch.target1 || {};
    const target2 = stretch.target2 || {};

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Stretch Configuration</div>
        <div class="helper-text">Stretch this element between two target elements</div>
        
        <div class="config-row">
          <ha-textfield
            label="Target 1 ID"
            .value=${target1.id || ''}
            .configValue=${`${stretchPath}.target1.id`}
            @input=${onValueChanged}
            .placeholder=${'element-id'}
          ></ha-textfield>
          <div class="helper-text">ID of the first target element</div>
        </div>

        <div class="config-row config-row--split">
          <div class="config-field">
            <ha-select
              label="Target 1 Edge"
              .value=${target1.edge || undefined}
              .configValue=${`${stretchPath}.target1.edge`}
              @selected=${onValueChanged}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <mwc-list-item value="top">Top</mwc-list-item>
              <mwc-list-item value="right">Right</mwc-list-item>
              <mwc-list-item value="bottom">Bottom</mwc-list-item>
              <mwc-list-item value="left">Left</mwc-list-item>
            </ha-select>
            <div class="helper-text">Edge of target 1 to stretch to</div>
          </div>
          <div class="config-field">
            <ha-textfield
              label="Target 1 Padding"
              type="number"
              .value=${target1.padding?.toString() || ''}
              .configValue=${`${stretchPath}.target1.padding`}
              @input=${onValueChanged}
              .placeholder=${'0'}
            ></ha-textfield>
            <div class="helper-text">Padding from target 1 edge</div>
          </div>
        </div>

        <div class="config-row">
          <ha-textfield
            label="Target 2 ID (Optional)"
            .value=${target2.id || ''}
            .configValue=${`${stretchPath}.target2.id`}
            @input=${onValueChanged}
            .placeholder=${'element-id'}
          ></ha-textfield>
          <div class="helper-text">ID of the second target element (optional)</div>
        </div>

        <div class="config-row config-row--split">
          <div class="config-field">
            <ha-select
              label="Target 2 Edge"
              .value=${target2.edge || undefined}
              .configValue=${`${stretchPath}.target2.edge`}
              @selected=${onValueChanged}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              <mwc-list-item value="top">Top</mwc-list-item>
              <mwc-list-item value="right">Right</mwc-list-item>
              <mwc-list-item value="bottom">Bottom</mwc-list-item>
              <mwc-list-item value="left">Left</mwc-list-item>
            </ha-select>
            <div class="helper-text">Edge of target 2 to stretch to</div>
          </div>
          <div class="config-field">
            <ha-textfield
              label="Target 2 Padding"
              type="number"
              .value=${target2.padding?.toString() || ''}
              .configValue=${`${stretchPath}.target2.padding`}
              @input=${onValueChanged}
              .placeholder=${'0'}
            ></ha-textfield>
            <div class="helper-text">Padding from target 2 edge</div>
          </div>
        </div>
      </div>
    `;
  }
}
