/**
 * LCARS Card Configuration Parser
 * 
 * Parses the YAML configuration for the LCARS card and creates the appropriate
 * layout elements and groups.
 */

import { HomeAssistant } from 'custom-card-helpers';
import { Group, LayoutElement } from './engine.js';
import { RectangleElement, TextElement, EndcapElement, ElbowElement, ChiselEndcapElement } from './elements.js';
import { LcarsCardConfig } from '../lovelace-lcars-card.js';

/**
 * Parses the LCARS card configuration and creates layout groups and elements.
 * @param config - The card configuration object.
 * @param hass - Home Assistant instance for entity state access.
 * @returns An array of Group instances ready to be added to the layout engine.
 */
export function parseConfig(config: LcarsCardConfig, hass?: HomeAssistant): Group[] {
  // If no elements defined, create a simple default layout
  if (!config.elements || config.elements.length === 0) {
    return [createDefaultGroup(config, hass)];
  }

  // Group elements by their group property
  const groupedElements: { [key: string]: any[] } = {};
  
  config.elements.forEach(element => {
    const groupId = element.group || 'default';
    if (!groupedElements[groupId]) {
      groupedElements[groupId] = [];
    }
    groupedElements[groupId].push(element);
  });
  
  // Create groups from grouped elements
  const groups: Group[] = [];
  
  Object.entries(groupedElements).forEach(([groupId, elements]) => {
    // Create layout elements for each element in the group
    const layoutElements: LayoutElement[] = elements.map(element => {
      return createLayoutElement(
        element.id,
        element.type,
        element.props || {},
        element.layout || {},
        hass
      );
    });
    
    // Create the group and add it to the list
    groups.push(new Group(groupId, layoutElements));
  });
  
  return groups;
}

/**
 * Creates a default group with basic elements if no elements are defined.
 * @param config - The card configuration.
 * @param hass - Home Assistant instance.
 * @returns A Group instance with default elements.
 */
function createDefaultGroup(config: LcarsCardConfig, hass?: HomeAssistant): Group {
  const { title, text, fontSize } = config;
  
  // Create basic text elements
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
    hass
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
    hass
  );
  
  // Create a basic header bar
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
    hass
  );
  
  return new Group('default-group', [headerBar, titleElement, textElement]);
}

/**
 * Creates a layout element based on the element type and configuration.
 * @param id - The element's unique identifier.
 * @param type - The type of element to create.
 * @param props - The element's visual properties.
 * @param layoutConfig - The element's layout configuration.
 * @param hass - Home Assistant instance.
 * @returns A LayoutElement instance.
 */
function createLayoutElement(
  id: string,
  type: string,
  props: any,
  layoutConfig: any,
  hass?: HomeAssistant
): LayoutElement {
  // Create the appropriate element type based on the configuration
  switch (type.toLowerCase()) {
    case 'text':
      return new TextElement(id, props, layoutConfig, hass);
      
    case 'endcap':
      return new EndcapElement(id, props, layoutConfig, hass);
    
    case 'elbow':
      return new ElbowElement(id, props, layoutConfig, hass);
    
    case 'chisel-endcap':
      return new ChiselEndcapElement(id, props, layoutConfig, hass);
      
    case 'rectangle':
    default:
      // Default to rectangle for unknown types
      return new RectangleElement(id, props, layoutConfig, hass);
  }
} 