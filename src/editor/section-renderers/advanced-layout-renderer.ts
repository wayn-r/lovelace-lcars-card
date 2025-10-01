import { html, TemplateResult } from 'lit';

export class AdvancedLayoutRenderer {
  static render(
    element: any,
    basePath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const layout = element.layout || {};
    const layoutPath = `${basePath}.layout`;

    return html`
      <div class="config-section">
        <div class="config-section-header">Advanced Layout</div>
        
        ${this._renderAnchorConfig(layout, layoutPath, onValueChanged)}
        ${this._renderStretchConfig(layout, layoutPath, onValueChanged)}
      </div>
    `;
  }

  private static _renderAnchorConfig(
    layout: any,
    layoutPath: string,
    onValueChanged: (ev: CustomEvent) => void
  ): TemplateResult {
    const anchor = layout.anchor || {};
    const anchorPath = `${layoutPath}.anchor`;

    return html`
      <div class="config-subsection">
        <div class="config-subsection-header">Anchor Configuration</div>
        <div class="helper-text">Position this element relative to another element</div>
        
        <div class="config-row">
          <ha-textfield
            label="Anchor To (Element ID)"
            .value=${anchor.to || ''}
            .configValue=${`${anchorPath}.to`}
            @input=${onValueChanged}
            .placeholder=${'target-element-id'}
          ></ha-textfield>
          <div class="helper-text">ID of the element to anchor to</div>
        </div>

        <div class="config-row">
          <ha-select
            label="Element Point"
            .value=${anchor.element_point || ''}
            .configValue=${`${anchorPath}.element_point`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="">None</mwc-list-item>
            <mwc-list-item value="topLeft">Top Left</mwc-list-item>
            <mwc-list-item value="topCenter">Top Center</mwc-list-item>
            <mwc-list-item value="topRight">Top Right</mwc-list-item>
            <mwc-list-item value="centerLeft">Center Left</mwc-list-item>
            <mwc-list-item value="center">Center</mwc-list-item>
            <mwc-list-item value="centerRight">Center Right</mwc-list-item>
            <mwc-list-item value="bottomLeft">Bottom Left</mwc-list-item>
            <mwc-list-item value="bottomCenter">Bottom Center</mwc-list-item>
            <mwc-list-item value="bottomRight">Bottom Right</mwc-list-item>
          </ha-select>
          <div class="helper-text">Anchor point on this element</div>
        </div>

        <div class="config-row">
          <ha-select
            label="Target Point"
            .value=${anchor.target_point || ''}
            .configValue=${`${anchorPath}.target_point`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="">None</mwc-list-item>
            <mwc-list-item value="topLeft">Top Left</mwc-list-item>
            <mwc-list-item value="topCenter">Top Center</mwc-list-item>
            <mwc-list-item value="topRight">Top Right</mwc-list-item>
            <mwc-list-item value="centerLeft">Center Left</mwc-list-item>
            <mwc-list-item value="center">Center</mwc-list-item>
            <mwc-list-item value="centerRight">Center Right</mwc-list-item>
            <mwc-list-item value="bottomLeft">Bottom Left</mwc-list-item>
            <mwc-list-item value="bottomCenter">Bottom Center</mwc:list-item>
            <mwc-list-item value="bottomRight">Bottom Right</mwc-list-item>
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

        <div class="config-row">
          <ha-select
            label="Target 1 Edge"
            .value=${target1.edge || ''}
            .configValue=${`${stretchPath}.target1.edge`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="">None</mwc-list-item>
            <mwc-list-item value="top">Top</mwc-list-item>
            <mwc-list-item value="right">Right</mwc-list-item>
            <mwc-list-item value="bottom">Bottom</mwc-list-item>
            <mwc-list-item value="left">Left</mwc-list-item>
          </ha-select>
          <div class="helper-text">Edge of target 1 to stretch to</div>
        </div>

        <div class="config-row">
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

        <div class="config-row">
          <ha-select
            label="Target 2 Edge"
            .value=${target2.edge || ''}
            .configValue=${`${stretchPath}.target2.edge`}
            @selected=${onValueChanged}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            <mwc-list-item value="">None</mwc-list-item>
            <mwc-list-item value="top">Top</mwc-list-item>
            <mwc-list-item value="right">Right</mwc-list-item>
            <mwc-list-item value="bottom">Bottom</mwc-list-item>
            <mwc-list-item value="left">Left</mwc-list-item>
          </ha-select>
          <div class="helper-text">Edge of target 2 to stretch to</div>
        </div>

        <div class="config-row">
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
    `;
  }
}

