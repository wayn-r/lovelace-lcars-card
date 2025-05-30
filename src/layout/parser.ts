import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { LcarsCardConfig, GroupConfig, ElementConfig } from '../types.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { TopHeaderElement } from './elements/top_header.js';

export function parseConfig(config: LcarsCardConfig, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): Group[] {
  if (!config.groups) {
    throw new Error('Invalid configuration: groups array is required');
  }

  return config.groups.map(groupConfig => {
    const layoutElements: LayoutElement[] = groupConfig.elements.map(element => {
      const fullId = `${groupConfig.group_id}.${element.id}`;
      return createLayoutElement(
        fullId,
        element.type,
        convertNewElementToProps(element),
        convertNewLayoutToEngineFormat(element.layout),
        hass,
        requestUpdateCallback,
        getShadowElement
      );
    });

    return new Group(groupConfig.group_id, layoutElements);
  });
}

function convertNewElementToProps(element: ElementConfig): any {
  const props: any = {};
  
  // Convert appearance properties
  if (element.appearance) {
    if (element.appearance.fill !== undefined) props.fill = element.appearance.fill;
    if (element.appearance.stroke !== undefined) props.stroke = element.appearance.stroke;
    if (element.appearance.strokeWidth !== undefined) props.strokeWidth = element.appearance.strokeWidth;
    if (element.appearance.cornerRadius !== undefined) props.rx = element.appearance.cornerRadius;
    if (element.appearance.direction !== undefined) props.direction = element.appearance.direction;
    if (element.appearance.orientation !== undefined) props.orientation = element.appearance.orientation;
    if (element.appearance.bodyWidth !== undefined) props.bodyWidth = element.appearance.bodyWidth;
    if (element.appearance.armHeight !== undefined) props.armHeight = element.appearance.armHeight;
  }
  
  // Convert text properties
  if (element.text) {
    if (element.text.content !== undefined) props.text = element.text.content;
    
    // Handle text color properly based on element type
    if (element.text.fill !== undefined) {
      if (element.type === 'text') {
        // For standalone text elements, text color is the element's fill
        props.fill = element.text.fill;
      } else {
        // For other elements with text (buttons, etc.), use textColor
        props.textColor = element.text.fill;
      }
    }
    
    if (element.text.fontFamily !== undefined) props.fontFamily = element.text.fontFamily;
    if (element.text.fontSize !== undefined) props.fontSize = element.text.fontSize;
    if (element.text.fontWeight !== undefined) props.fontWeight = element.text.fontWeight;
    if (element.text.letterSpacing !== undefined) props.letterSpacing = element.text.letterSpacing;
    if (element.text.textAnchor !== undefined) props.textAnchor = element.text.textAnchor;
    if (element.text.dominantBaseline !== undefined) props.dominantBaseline = element.text.dominantBaseline;
    if (element.text.textTransform !== undefined) props.textTransform = element.text.textTransform;
    
    // top_header specific text properties
    if (element.text.left_content !== undefined) props.leftContent = element.text.left_content;
    if (element.text.right_content !== undefined) props.rightContent = element.text.right_content;
  }
  
  // Convert button configuration
  if (element.interactions?.button) {
    const buttonConfig = element.interactions.button;
    props.button = {
      enabled: buttonConfig.enabled
    };
    
    // Convert appearance states
    if (buttonConfig.appearance_states) {
      if (buttonConfig.appearance_states.hover) {
        const hover = buttonConfig.appearance_states.hover;
        if (hover.appearance?.fill) props.button.hover_fill = hover.appearance.fill;
        if (hover.appearance?.stroke) props.button.hover_stroke = hover.appearance.stroke;
        if (hover.transform) props.button.hover_transform = hover.transform;
      }
      
      if (buttonConfig.appearance_states.active) {
        const active = buttonConfig.appearance_states.active;
        if (active.appearance?.fill) props.button.active_fill = active.appearance.fill;
        if (active.appearance?.stroke) props.button.active_stroke = active.appearance.stroke;
        if (active.transform) props.button.active_transform = active.transform;
      }
    }
    
    // Convert actions
    if (buttonConfig.actions?.tap) {
      const tapAction = buttonConfig.actions.tap;
      // Check if it's a Home Assistant action (not an animation action)
      if ('action' in tapAction && tapAction.action !== 'animate') {
        props.button.action_config = {
          type: tapAction.action,
          service: tapAction.service,
          service_data: tapAction.service_data,
          target: tapAction.target,
          navigation_path: tapAction.navigation_path,
          url_path: tapAction.url_path,
          entity: tapAction.entity,
          confirmation: tapAction.confirmation
        };
      }
    }
  }
  
  return props;
}

function convertNewLayoutToEngineFormat(layout?: any): any {
  if (!layout) return {};
  
  const engineLayout: any = {};
  
  if (layout.width !== undefined) engineLayout.width = layout.width;
  if (layout.height !== undefined) engineLayout.height = layout.height;
  if (layout.offsetX !== undefined) engineLayout.offsetX = layout.offsetX;
  if (layout.offsetY !== undefined) engineLayout.offsetY = layout.offsetY;
  
  if (layout.anchor) {
    engineLayout.anchor = {
      anchorTo: layout.anchor.to,
      anchorPoint: layout.anchor.element_point,
      targetAnchorPoint: layout.anchor.target_point
    };
  }
  
  if (layout.stretch) {
    engineLayout.stretch = {
      stretchTo1: layout.stretch.target1.id,
      targetStretchAnchorPoint1: layout.stretch.target1.edge,
      stretchPadding1: layout.stretch.target1.padding || 0
    };
    
    if (layout.stretch.target2) {
      engineLayout.stretch.stretchTo2 = layout.stretch.target2.id;
      engineLayout.stretch.targetStretchAnchorPoint2 = layout.stretch.target2.edge;
      engineLayout.stretch.stretchPadding2 = layout.stretch.target2.padding || 0;
    }
  }
  
  return engineLayout;
}

function createLayoutElement(
  id: string,
  type: string,
  props: any,
  layoutConfig: any,
  hass?: HomeAssistant,
  requestUpdateCallback?: () => void,
  getShadowElement?: (id: string) => Element | null
): LayoutElement {
  switch (type.toLowerCase().trim()) {
    case 'text':
      return new TextElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    case 'rectangle':
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    case 'endcap':
      return new EndcapElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    case 'elbow':
      return new ElbowElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    case 'chisel-endcap':
      return new ChiselEndcapElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    case 'top_header':
      return new TopHeaderElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    default:
      console.warn(`LCARS Card Parser: Unknown element type "${type}". Defaulting to Rectangle.`);
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
  }
} 