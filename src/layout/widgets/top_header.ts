import { RectangleElement } from '../elements/rectangle.js';
import { EndcapElement } from '../elements/endcap.js';
import { TextElement } from '../elements/text.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { registerWidget } from './registry.js';

const TEXT_GAP = 5;

export class TopHeaderWidget extends Widget {
  public expand(): LayoutElement[] {
    const fillColor = this.props.fill || '#99CCFF';
    const height = this.props.height || this.layoutConfig.height || 30;
    const endcapWidth = height * 0.75;

    // Invisible bounds rectangle – carries the *public* ID so external
    // anchors and stretches keep working (e.g. nav_header.main_header)
    const bounds = new RectangleElement(
      this.id,
      { fill: 'none', stroke: 'none' },
      this.layoutConfig, // keep any external layout config here
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const leftEndcap = new EndcapElement(
      `${this.id}_left_endcap`,
      { direction: 'left', fill: fillColor, width: endcapWidth, height: height },
      { anchor: { anchorTo: bounds.id, anchorPoint: 'topLeft', targetAnchorPoint: 'topLeft' } },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const rightEndcap = new EndcapElement(
      `${this.id}_right_endcap`,
      { direction: 'right', fill: fillColor, width: endcapWidth, height: height },
      { anchor: { anchorTo: bounds.id, anchorPoint: 'topRight', targetAnchorPoint: 'topRight' } },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const leftText = new TextElement(
      `${this.id}_left_text`,
      {
        text: this.props.leftContent || 'LEFT',
        fill: this.props.textColor || '#FFFFFF',
        fontFamily: this.props.fontFamily || 'Antonio',
        fontWeight: this.props.fontWeight || 'normal',
        letterSpacing: this.props.letterSpacing || 'normal',
        textTransform: this.props.textTransform || 'uppercase',
        height: height,
      },
      { anchor: { anchorTo: leftEndcap.id, anchorPoint: 'topLeft', targetAnchorPoint: 'topRight' }, offsetX: TEXT_GAP },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const rightText = new TextElement(
      `${this.id}_right_text`,
      {
        text: this.props.rightContent || 'RIGHT',
        fill: this.props.textColor || '#FFFFFF',
        fontFamily: this.props.fontFamily || 'Antonio',
        fontWeight: this.props.fontWeight || 'normal',
        letterSpacing: this.props.letterSpacing || 'normal',
        textTransform: this.props.textTransform || 'uppercase',
        textAnchor: 'end',
        height: height,
      },
      { anchor: { anchorTo: rightEndcap.id, anchorPoint: 'topRight', targetAnchorPoint: 'topLeft' }, offsetX: -TEXT_GAP },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const headerBar = new RectangleElement(
      `${this.id}_header_bar`,
      { fill: fillColor, height: height },
      {
        anchor: { anchorTo: leftText.id, anchorPoint: 'topLeft', targetAnchorPoint: 'topRight' },
        offsetX: TEXT_GAP,
        stretch: {
          stretchTo1: rightText.id,
          targetStretchAnchorPoint1: 'left',
          stretchPadding1: -TEXT_GAP,
        },
      },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    // Order matters: render background bar first so endcaps & text sit on top.
    return [bounds, headerBar, leftEndcap, rightEndcap, leftText, rightText];
  }
}

// Register at module load time
registerWidget('top_header', (id, props, layoutConfig, hass, reqUpd, getEl) => {
  const widget = new TopHeaderWidget(id, props, layoutConfig, hass, reqUpd, getEl);
  return widget.expand();
}); 