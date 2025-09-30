import { RectangleElement } from '../elements/rectangle.js';
import { EndcapElement } from '../elements/endcap.js';
import { TextElement } from '../elements/text.js';
import { Widget } from './widget.js';
import { LayoutElement } from '../elements/element.js';
import { WidgetRegistry } from './registry.js';

const TEXT_GAP = 5;

export class TopHeaderWidget extends Widget {
  public expand(): LayoutElement[] {
    const fillColor = this.props.fill || '#99CCFF';
    const height = (typeof this.props.height === 'number' ? (this.props.height as number) : undefined)
      ?? (typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : undefined)
      ?? 30;
    const endcapWidth = height * 0.75;

    // Invisible bounds rectangle – carries the *public* ID so external
    // anchors and stretches keep working (e.g. nav_header.main_header)
    const bounds = new RectangleElement(
      this.id,
      { fill: 'none', stroke: 'none' },
      this.layoutConfig,
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const leftEndcap = new EndcapElement(
      `${this.id}_left_endcap`,
      { direction: 'left', fill: fillColor },
      { anchor: { anchorTo: bounds.id, anchorPoint: 'top-left', targetAnchorPoint: 'top-left' }, width: endcapWidth, height },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const rightEndcap = new EndcapElement(
      `${this.id}_right_endcap`,
      { direction: 'right', fill: fillColor },
      { anchor: { anchorTo: bounds.id, anchorPoint: 'top-right', targetAnchorPoint: 'top-right' }, width: endcapWidth, height },
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
      },
      { anchor: { anchorTo: leftEndcap.id, anchorPoint: 'top-left', targetAnchorPoint: 'top-right' }, offsetX: TEXT_GAP, height },
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
      },
      { anchor: { anchorTo: rightEndcap.id, anchorPoint: 'top-right', targetAnchorPoint: 'top-left' }, offsetX: -TEXT_GAP, height },
      this.hass,
      this.requestUpdateCallback,
      this.getShadowElement
    );

    const headerBar = new RectangleElement(
      `${this.id}_header_bar`,
      { fill: fillColor },
      {
        anchor: { anchorTo: leftText.id, anchorPoint: 'top-left', targetAnchorPoint: 'top-right' },
        offsetX: TEXT_GAP,
        height,
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


WidgetRegistry.registerWidget('top_header', (id, props, layoutConfig, hass, reqUpd, getEl, runtime) => {
  const widget = new TopHeaderWidget(id, props, layoutConfig, hass, reqUpd, getEl, runtime as any);
  WidgetRegistry.registerInstance(runtime as any, id, widget);
  return widget.expand();
});