import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { WidgetRegistry } from './widgets/registry.js';
import { parseCardConfig, type ParsedConfig } from '../parsers/schema.js';
import { ZodError } from 'zod';

interface ElementProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  direction?: 'left' | 'right';
  orientation?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bodyWidth?: number | string;
  armHeight?: number | string;
  text?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  letterSpacing?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  textTransform?: string;
  cutout?: boolean;
  elbowTextPosition?: 'arm' | 'body';
  leftContent?: string;
  rightContent?: string;
  textOffsetX?: number | string;
  textOffsetY?: number | string;
  button?: {
    enabled?: boolean;
    actions?: unknown;
  };
  visibility_rules?: unknown;
  visibility_triggers?: unknown;
  state_management?: unknown;
  animations?: unknown;
  entity?: string;
  attribute?: string;
  label?: any;
  value?: any;
  appearance?: any;
  // Logger widget specific properties
  maxLines?: number;
  lineSpacing?: number | string;
  color_cycle?: { color: any; duration: number }[];
}

interface LayoutConfig {
  width?: number | string;
  height?: number | string;
  offsetX?: number | string;
  offsetY?: number | string;
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

export class ConfigParser {
  static parseConfig(
    config: unknown, 
    hass?: HomeAssistant, 
    requestUpdateCallback?: () => void, 
    getShadowElement?: (id: string) => Element | null
  ): Group[] {
    const validatedConfig = this.validateConfig(config);
    
    if (!validatedConfig.groups) {
      throw new Error('Invalid configuration: groups array is required');
    }

    return validatedConfig.groups.map(groupConfig => {
      const layoutElements: LayoutElement[] = groupConfig.elements.flatMap(elementConfig => {
        const fullId = `${groupConfig.group_id}.${elementConfig.id}`;
        const props = this.convertElementProps(elementConfig);
        const layoutConfig = this.convertLayoutConfig(elementConfig.layout);
        
        return this.createLayoutElements(
          fullId,
          elementConfig.type,
          props,
          layoutConfig,
          hass,
          requestUpdateCallback,
          getShadowElement
        );
      });

      return new Group(groupConfig.group_id, layoutElements);
    });
  }

  private static validateConfig(config: unknown): ParsedConfig {
    try {
      return parseCardConfig(config);
    } catch (error) {
      if (error instanceof ZodError) {
        const groupsError = error.errors.find(e => 
          e.path.length === 1 && e.path[0] === 'groups'
        );
        
        if (groupsError) {
          throw new Error('Invalid configuration: groups array is required');
        }
      }
      throw error;
    }
  }

  private static convertElementProps(elementConfig: any): ElementProps {
    const appearance = elementConfig.appearance || {};
    const text = elementConfig.text || {};

    const props: ElementProps = {
      fill: appearance.fill,
      stroke: appearance.stroke,
      strokeWidth: appearance.strokeWidth,
      rx: appearance.cornerRadius,
      direction: appearance.direction,
      orientation: appearance.orientation,
      bodyWidth: appearance.bodyWidth,
      armHeight: appearance.armHeight,
      
      text: text.content,
      fontFamily: text.fontFamily,
      fontSize: text.fontSize,
      fontWeight: text.fontWeight,
      letterSpacing: text.letterSpacing,
      textAnchor: text.textAnchor,
      dominantBaseline: text.dominantBaseline,
      textTransform: text.textTransform,
      cutout: text.cutout,
      elbowTextPosition: text.elbow_text_position,
      leftContent: text.left_content,
      rightContent: text.right_content,
      textOffsetX: text.offsetX,
      textOffsetY: text.offsetY,
      
      button: elementConfig.button,
      visibility_rules: elementConfig.visibility_rules,
      visibility_triggers: elementConfig.visibility_triggers,
      state_management: elementConfig.state_management,
      animations: elementConfig.animations,
      
      entity: elementConfig.entity,
      attribute: elementConfig.attribute,
      label: elementConfig.label,
      value: elementConfig.value,
      appearance: elementConfig.appearance,
      
      // Logger widget specific properties
      maxLines: text.max_lines,
      lineSpacing: text.line_spacing,
      color_cycle: text.color_cycle,
    };

    // Handle text color differently for text elements vs other elements
    if (text.fill !== undefined) {
      if (elementConfig.type === 'text') {
        // For text elements, text.fill becomes the fill property
        props.fill = text.fill;
      } else {
        // For other elements, text.fill becomes textColor
        props.textColor = text.fill;
      }
    }

    return props;
  }

  private static convertLayoutConfig(layout?: any): LayoutConfig {
    if (!layout) return {};
    
    const engineLayout: LayoutConfig = {};
    
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

  private static createLayoutElements(
    id: string,
    type: string,
    props: ElementProps,
    layoutConfig: LayoutConfig,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ): LayoutElement[] {
    const widgetResult = WidgetRegistry.expandWidget(type, id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
    if (widgetResult) {
      return widgetResult;
    }

    const elementConstructors: Record<string, new(...args: any[]) => LayoutElement> = {
      'text': TextElement,
      'rectangle': RectangleElement,
      'endcap': EndcapElement,
      'elbow': ElbowElement,
      'chisel-endcap': ChiselEndcapElement
    };

    const normalizedType = type.toLowerCase().trim();
    const ElementConstructor = elementConstructors[normalizedType];

    if (ElementConstructor) {
      return [new ElementConstructor(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement)];
    }

    console.warn(`LCARS Card Parser: Unknown element type "${type}". Defaulting to Rectangle.`);
    return [new RectangleElement(id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement)];
  }
}

export function parseConfig(
  config: unknown, 
  hass?: HomeAssistant, 
  requestUpdateCallback?: () => void, 
  getShadowElement?: (id: string) => Element | null
): Group[] {
  return ConfigParser.parseConfig(config, hass, requestUpdateCallback, getShadowElement);
}