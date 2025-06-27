import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine.js';
import { LayoutElement } from './elements/element.js';
import { RectangleElement } from './elements/rectangle.js';
import { TextElement } from './elements/text.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { expandWidget } from './widgets/registry.js';
import { parseCardConfig, type ParsedConfig } from '../parsers/schema.js';
import { ZodError } from 'zod';

interface ElementProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  direction?: 'left' | 'right';
  orientation?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bodyWidth?: number;
  armHeight?: number;
  text?: string;
  textColor?: string;
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
  button?: {
    enabled?: boolean;
    actions?: unknown;
  };
  visibility_rules?: unknown;
  visibility_triggers?: unknown;
  state_management?: unknown;
  animations?: unknown;
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

  private static convertElementProps(element: any): ElementProps {
    const props: ElementProps = {};
    
    this.mapAppearanceProps(element, props);
    this.mapTextProps(element, props);
    this.mapButtonProps(element, props);
    this.mapConfigurationProps(element, props);
    
    return props;
  }

  private static mapAppearanceProps(element: any, props: ElementProps): void {
    if (!element.appearance) return;

    const appearance = element.appearance;
    
    if (appearance.fill !== undefined) props.fill = appearance.fill;
    if (appearance.stroke !== undefined) props.stroke = appearance.stroke;
    if (appearance.strokeWidth !== undefined) props.strokeWidth = appearance.strokeWidth;
    if (appearance.cornerRadius !== undefined) props.rx = appearance.cornerRadius;
    if (appearance.direction !== undefined) props.direction = appearance.direction;
    if (appearance.orientation !== undefined) props.orientation = appearance.orientation;
    if (appearance.bodyWidth !== undefined) props.bodyWidth = appearance.bodyWidth;
    if (appearance.armHeight !== undefined) props.armHeight = appearance.armHeight;
  }

  private static mapTextProps(element: any, props: ElementProps): void {
    if (!element.text) return;

    const text = element.text;
    
    if (text.content !== undefined) props.text = text.content;
    
    if (text.fill !== undefined) {
      if (element.type === 'text') {
        props.fill = text.fill;
      } else {
        props.textColor = text.fill;
      }
    }
    
    if (text.fontFamily !== undefined) props.fontFamily = text.fontFamily;
    if (text.fontSize !== undefined) props.fontSize = text.fontSize;
    if (text.fontWeight !== undefined) props.fontWeight = text.fontWeight;
    if (text.letterSpacing !== undefined) props.letterSpacing = text.letterSpacing;
    if (text.textAnchor !== undefined) props.textAnchor = text.textAnchor;
    if (text.dominantBaseline !== undefined) props.dominantBaseline = text.dominantBaseline;
    if (text.textTransform !== undefined) props.textTransform = text.textTransform;
    if (text.elbow_text_position !== undefined) props.elbowTextPosition = text.elbow_text_position;
    if (text.left_content !== undefined) props.leftContent = text.left_content;
    if (text.right_content !== undefined) props.rightContent = text.right_content;
  }

  private static mapButtonProps(element: any, props: ElementProps): void {
    if (!element.button) return;

    props.button = {
      enabled: element.button.enabled,
      actions: element.button.actions
    };
  }

  private static mapConfigurationProps(element: any, props: ElementProps): void {
    if (element.visibility_rules !== undefined) props.visibility_rules = element.visibility_rules;
    if (element.visibility_triggers !== undefined) props.visibility_triggers = element.visibility_triggers;
    if (element.state_management !== undefined) props.state_management = element.state_management;
    if (element.animations !== undefined) props.animations = element.animations;
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
    const widgetResult = expandWidget(type, id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement);
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