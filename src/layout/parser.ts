import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { TopHeaderElement } from './elements/top_header.js';

export function parseConfig(config: LcarsCardConfig, hass?: HomeAssistant, requestUpdateCallback?: () => void): Group[] {
  if (!config.elements || config.elements.length === 0) {
    return [createDefaultGroup(config, hass, requestUpdateCallback)];
  }

  const groupedElements: { [key: string]: any[] } = {};
  
  config.elements.forEach(element => {
    const groupId = element.group || '__ungrouped__';
    if (!groupedElements[groupId]) {
      groupedElements[groupId] = [];
    }
    groupedElements[groupId].push(element);
  });
  
  const groups: Group[] = [];
  
  Object.entries(groupedElements).forEach(([groupId, elements]) => {
    const layoutElements: LayoutElement[] = elements.map(element => {
      return createLayoutElement(
        element.id,
        element.type,
        { ...element.props, button: element.button },
        element.layout || {},
        hass,
        requestUpdateCallback
      );
    });
    
    groups.push(new Group(groupId, layoutElements));
  });
  
  return groups;
}

function createDefaultGroup(config: LcarsCardConfig, hass?: HomeAssistant, requestUpdateCallback?: () => void): Group {
  const { title, text, fontSize } = config;
  
  const titleElement = new TextElement(
    'default-title',
    {
      text: title,
      fontWeight: 'bold',
      fontSize: fontSize ? fontSize + 4 : 20,
      fill: '#FFFFFF'
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 16,
      offsetY: 30
    },
    hass,
    requestUpdateCallback
  );
  
  const textElement = new TextElement(
    'default-text',
    {
      text: text,
      fontSize: fontSize || 16,
      fill: '#CCCCCC'
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 16,
      offsetY: 60
    },
    hass,
    requestUpdateCallback
  );
  
  const headerBar = new RectangleElement(
    'default-header',
    {
      fill: '#FF9900',
      rx: 0,
      ry: 0
    },
    {
      anchorLeft: true,
      anchorTop: true,
      offsetX: 0,
      offsetY: 0,
      width: '100%',
      height: 16
    },
    hass,
    requestUpdateCallback
  );
  
  return new Group('__default__', [headerBar, titleElement, textElement]);
}

function createLayoutElement(
  id: string,
  type: string,
  props: any,
  layoutConfig: any,
  hass?: HomeAssistant,
  requestUpdateCallback?: () => void
): LayoutElement {
  switch (type.toLowerCase().trim()) {
    case 'text':
      return new TextElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'rectangle':
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'endcap':
      return new EndcapElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'elbow':
      return new ElbowElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'chisel-endcap':
      return new ChiselEndcapElement(id, props, layoutConfig, hass, requestUpdateCallback);
    case 'top_header':
      return new TopHeaderElement(id, props, layoutConfig, hass, requestUpdateCallback);
    default:
      console.warn(`LCARS Card Parser: Unknown element type "${type}". Defaulting to Rectangle.`);
      return new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback);
  }
} 