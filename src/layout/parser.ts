import { HomeAssistant } from 'custom-card-helpers';
import { Group, type LayoutConfigOptions, type LayoutElementProps } from './engine.js';
import { LayoutElement } from './elements/element.js';
import './elements/index.js';
import { ElementRegistry } from './elements/registry.js';
import { WidgetRegistry } from './widgets/registry.js';
import { SchemaParser, type ParsedConfig } from '../parsers/schema.js';
import { ZodError } from 'zod';
import { CardRuntime } from '../core/runtime.js';
import { Diagnostics } from '../utils/diagnostics.js';

export class ConfigParser {
  private static readonly logger = Diagnostics.create('ConfigParser');
  static parseConfig(
    config: unknown, 
    hass?: HomeAssistant, 
    requestUpdateCallback?: () => void, 
    getShadowElement?: (id: string) => Element | null,
    runtime?: CardRuntime
  ): Group[] {
    const validatedConfig = this._validateConfig(config);
    
    if (!validatedConfig.groups) {
      throw new Error('Invalid configuration: groups array is required');
    }

    return validatedConfig.groups.map(groupConfig => {
      const layoutElements: LayoutElement[] = groupConfig.elements.flatMap(elementConfig => {
        const fullId = `${groupConfig.group_id}.${elementConfig.id}`;
        const props = this._convertElementProps(elementConfig);
        const layoutConfig = this._convertLayoutConfig(elementConfig.layout);
        
        return this._createLayoutElements(
          fullId,
          elementConfig.type,
          props,
          layoutConfig,
          hass,
          requestUpdateCallback,
          getShadowElement,
          runtime
        );
      });

      return new Group(groupConfig.group_id, layoutElements);
    });
  }

  private static _validateConfig(config: unknown): ParsedConfig {
    try {
      return SchemaParser.parseCardConfig(config);
    } catch (error) {
      if (error instanceof ZodError) {
        const groupsError = error.errors.find(e => e.path.length === 1 && e.path[0] === 'groups');
        
        if (groupsError) {
          throw new Error('Invalid configuration: groups array is required');
        }
      }
      throw error;
    }
  }

  private static _convertElementProps(elementConfig: any): LayoutElementProps {
    const appearance = elementConfig.appearance || {};
    const text = elementConfig.text || {};

    const props: LayoutElementProps = {
      fill: appearance.fill,
      stroke: appearance.stroke,
      strokeWidth: appearance.strokeWidth,
      rx: appearance.cornerRadius,
      chisel: appearance.chisel,
      direction: appearance.direction,
      orientation: appearance.orientation,
      bodyWidth: elementConfig.layout?.bodyWidth,
      armHeight: elementConfig.layout?.armHeight,
      
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
      unit: elementConfig.unit,
      appearance: elementConfig.appearance,
      
      // Logger widget specific properties
      maxLines: text.max_lines,
      lineSpacing: text.line_spacing,
      color_cycle: text.color_cycle,
       grid: elementConfig.grid,
       // Vertical slider widget specific properties
       min: elementConfig.min,
       max: elementConfig.max,
       spacing: elementConfig.spacing,
       top_padding: elementConfig.top_padding,
       label_height: elementConfig.label_height,
       use_floats: elementConfig.use_floats,
    };

    if (text.fill !== undefined) {
      if (elementConfig.type === 'text') {
        props.fill = text.fill;
      } else {
        props.textColor = text.fill;
      }
    }

    return props;
  }

  private static _convertLayoutConfig(layout?: any): LayoutConfigOptions {
    if (!layout) return {};
    
    const engineLayout: LayoutConfigOptions = {};
    
    if (layout.width !== undefined) engineLayout.width = layout.width;
    if (layout.height !== undefined) engineLayout.height = layout.height;
    if (layout.offsetX !== undefined) engineLayout.offsetX = layout.offsetX;
    if (layout.offsetY !== undefined) engineLayout.offsetY = layout.offsetY;
    
    if (layout.anchor) {
      (engineLayout as any).anchor = {
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

  private static _createLayoutElements(
    id: string,
    type: string,
    props: LayoutElementProps,
    layoutConfig: LayoutConfigOptions,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null,
    runtime?: CardRuntime
  ): LayoutElement[] {
    const widgetResult = WidgetRegistry.expandWidget(type, id, props, layoutConfig, hass, requestUpdateCallback, getShadowElement, runtime);
    if (widgetResult) {
      return widgetResult;
    }

    const element = ElementRegistry.createElement(
      type,
      id,
      props,
      layoutConfig,
      hass,
      requestUpdateCallback,
      getShadowElement,
      runtime
    );

    if (element) {
      return [element];
    }

    ConfigParser.logger.warn(`Unknown element type "${type}". Defaulting to Rectangle.`);
    const fallback = ElementRegistry.createElement(
      'rectangle',
      id,
      props,
      layoutConfig,
      hass,
      requestUpdateCallback,
      getShadowElement,
      runtime
    );
    if (fallback) return [fallback];
    return [];
  }
}

export function parseConfig(
  config: unknown, 
  hass?: HomeAssistant, 
  requestUpdateCallback?: () => void, 
  getShadowElement?: (id: string) => Element | null,
  runtime?: CardRuntime
): Group[] {
  return ConfigParser.parseConfig(config, hass, requestUpdateCallback, getShadowElement, runtime);
}