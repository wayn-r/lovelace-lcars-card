import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { LcarsCardConfig, GroupConfig, ElementConfig, ButtonConfig } from '../types.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { TopHeaderElement } from './elements/top_header.js';
import { parseCardConfig, type ParsedConfig } from '../parsers/schema.js';
import { ZodError } from 'zod';

// Define the properly typed props interface that LayoutElement expects
interface ConvertedElementProps {
  // Appearance properties
  fill?: any;
  stroke?: any;
  strokeWidth?: number;
  rx?: number;
  direction?: 'left' | 'right';
  orientation?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bodyWidth?: number;
  armHeight?: number;
  
  // Text properties
  text?: string;
  textColor?: any;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  letterSpacing?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  textTransform?: string;
  elbowTextPosition?: 'arm' | 'body';
  leftContent?: string;
  rightContent?: string;
  
  // Button configuration
  button?: {
    enabled?: boolean;
    action_config?: {
      type: string;
      service?: string;
      service_data?: Record<string, any>;
      target?: Record<string, any>;
      navigation_path?: string;
      url_path?: string;
      entity?: string;
      confirmation?: any;
      target_element_ref?: string;
      state?: string;
      states?: string[];
      actions?: any[];
    };
  };
  
  // Other configurations
  visibility_rules?: any;
  visibility_triggers?: any;
  state_management?: any;
  animations?: any;
}

// Define the engine layout format interface
interface ConvertedLayoutConfig {
  width?: any;
  height?: any;
  offsetX?: any;
  offsetY?: any;
  anchor?: {
    anchorTo: string;
    anchorPoint: string;
    targetAnchorPoint: string;
  };
  stretch?: {
    stretchTo1: string;
    targetStretchAnchorPoint1: string;
    stretchPadding1: number;
    stretchTo2?: string;
    targetStretchAnchorPoint2?: string;
    stretchPadding2?: number;
  };
}

export function parseConfig(config: unknown, hass?: HomeAssistant, requestUpdateCallback?: () => void, getShadowElement?: (id: string) => Element | null): Group[] {
  let validatedConfig: ParsedConfig;
  
  try {
    // Validate configuration using schema
    validatedConfig = parseCardConfig(config);
  } catch (error) {
    if (error instanceof ZodError) {
      // Check if it's a groups-related error and provide friendly message
      const groupsError = error.errors.find(e => 
        e.path.length === 1 && e.path[0] === 'groups'
      );
      
      if (groupsError) {
        throw new Error('Invalid configuration: groups array is required');
      }
      
      // For other validation errors, throw the original error
      throw error;
    }
    throw error;
  }
  
  if (!validatedConfig.groups) {
    throw new Error('Invalid configuration: groups array is required');
  }

  return validatedConfig.groups.map(groupConfig => {
    const layoutElements: LayoutElement[] = groupConfig.elements.map(element => {
      const fullId = `${groupConfig.group_id}.${element.id}`;
      
      // Convert element configuration to props format
      const props = convertElementToProps(element);
      
      // Resolve "self" references in visibility triggers
      if (props.visibility_triggers) {
        props.visibility_triggers = props.visibility_triggers.map((trigger: any) => ({
          ...trigger,
          trigger_source: {
            ...trigger.trigger_source,
            element_id_ref: trigger.trigger_source.element_id_ref === 'self' 
              ? fullId 
              : trigger.trigger_source.element_id_ref
          }
        }));
      }
      
      return createLayoutElement(
        fullId,
        element.type,
        props,
        convertLayoutToEngineFormat(element.layout),
        hass,
        requestUpdateCallback,
        getShadowElement
      );
    });

    return new Group(groupConfig.group_id, layoutElements);
  });
}

function convertElementToProps(element: any): ConvertedElementProps {
  const props: ConvertedElementProps = {};
  
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
    
    // elbow specific text properties
    if (element.text.elbow_text_position !== undefined) props.elbowTextPosition = element.text.elbow_text_position;
    
    // top_header specific text properties
    if (element.text.left_content !== undefined) props.leftContent = element.text.left_content;
    if (element.text.right_content !== undefined) props.rightContent = element.text.right_content;
  }
  
  // Convert button configuration
  if (element.button) {
    const buttonConfig = element.button;
    props.button = {
      enabled: buttonConfig.enabled
    };
    
    // Convert actions with new structure
    if (buttonConfig.actions?.tap) {
      const tapAction = buttonConfig.actions.tap;
      props.button.action_config = {
        type: tapAction.action,
        service: tapAction.service,
        service_data: tapAction.service_data,
        target: tapAction.target,
        navigation_path: tapAction.navigation_path,
        url_path: tapAction.url_path,
        entity: tapAction.entity,
        confirmation: tapAction.confirmation,
        // Custom action properties
        target_element_ref: tapAction.target_element_ref,
        state: tapAction.state,
        states: tapAction.states,
        actions: tapAction.actions
      };
    }
  }

  // Convert other configurations directly
  if (element.visibility_rules) {
    props.visibility_rules = element.visibility_rules;
  }
  
  if (element.visibility_triggers) {
    props.visibility_triggers = element.visibility_triggers;
  }
  
  if (element.state_management) {
    props.state_management = element.state_management;
  }
  
  if (element.animations) {
    props.animations = element.animations;
  }
  
  return props;
}

function convertLayoutToEngineFormat(layout?: any): ConvertedLayoutConfig {
  if (!layout) return {};
  
  const engineLayout: ConvertedLayoutConfig = {};
  
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
  props: ConvertedElementProps,
  layoutConfig: ConvertedLayoutConfig,
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