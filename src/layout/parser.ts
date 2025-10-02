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

type MutableStretchTargetConfig = {
  id?: string;
  edge?: string;
  padding?: number;
};

type MutableStretchConfig = {
  target1?: MutableStretchTargetConfig;
  target2?: MutableStretchTargetConfig;
};

type MutableLayoutConfig = {
  stretch?: MutableStretchConfig;
};

type MutableElementConfig = {
  id?: string;
  layout?: MutableLayoutConfig;
};

type MutableGroupConfig = {
  group_id?: string;
  elements?: MutableElementConfig[];
};

type MutableCardConfig = {
  groups?: MutableGroupConfig[];
  [key: string]: unknown;
};

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
      const preparedConfig = this._prepareConfigForValidation(config);
      return SchemaParser.parseCardConfig(preparedConfig);
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

  private static _prepareConfigForValidation(config: unknown): unknown {
    if (!config || typeof config !== 'object') {
      return config;
    }

    type StructuredCloneFn = (value: unknown) => unknown;
    const globalWithClone = globalThis as typeof globalThis & { structuredClone?: StructuredCloneFn };
    const cloneFn = typeof globalWithClone.structuredClone === 'function'
      ? globalWithClone.structuredClone
      : undefined;

    const clonedConfig = typeof cloneFn === 'function'
      ? cloneFn(config)
      : JSON.parse(JSON.stringify(config));

    const workingConfig = clonedConfig as MutableCardConfig;

    if (!Array.isArray(workingConfig.groups)) {
      return workingConfig;
    }

    const removedStretchTargets: string[] = [];
    const removedSecondaryTargets: string[] = [];

    workingConfig.groups.forEach(group => {
      if (!group || !Array.isArray(group.elements)) {
        return;
      }

      group.elements.forEach(element => {
        const layout = element?.layout;
        const stretch = layout?.stretch;
        if (!layout || !stretch) {
          return;
        }

        const elementLabel = `${group.group_id ?? 'unknown-group'}.${element.id ?? 'unknown-element'}`;

        if (!ConfigParser._stretchTargetIsValid(stretch.target1)) {
          delete layout.stretch;
          removedStretchTargets.push(elementLabel);
          return;
        }

        if (stretch.target2 && !ConfigParser._stretchTargetIsValid(stretch.target2)) {
          delete stretch.target2;
          removedSecondaryTargets.push(elementLabel);
        }
      });
    });

    if (removedStretchTargets.length) {
      this.logger.warn(`Removed invalid stretch configuration from elements: ${removedStretchTargets.join(', ')}`);
    }

    if (removedSecondaryTargets.length) {
      this.logger.warn(`Removed invalid secondary stretch targets from elements: ${removedSecondaryTargets.join(', ')}`);
    }

    return workingConfig;
  }

  private static _stretchTargetIsValid(target?: MutableStretchTargetConfig): boolean {
    if (!target) {
      return false;
    }

    const idValid = typeof target.id === 'string' && target.id.trim() !== '';
    const edgeValid = typeof target.edge === 'string' && target.edge.trim() !== '';

    return idValid && edgeValid;
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
      bodyWidth: elementConfig.layout?.body_width,
      armHeight: elementConfig.layout?.arm_height,
      
      text: text.content,
      fontFamily: text.font_family,
      fontSize: text.font_size,
      fontWeight: text.font_weight,
      letterSpacing: text.letter_spacing,
      textAnchor: text.text_anchor,
      dominantBaseline: text.dominant_baseline,
      textTransform: text.text_transform,
      cutout: text.cutout,
      elbowTextPosition: text.elbow_text_position,
      leftContent: text.left_content,
      rightContent: text.right_content,
      textOffsetX: text.offset_x,
      textOffsetY: text.offset_y,
      
      button: elementConfig.button,
      visibility_rules: elementConfig.visibility_rules,
      visibility_triggers: elementConfig.visibility_triggers,
      state_management: elementConfig.state_management,
      animations: elementConfig.animations,
      
      entity: elementConfig.entity,
      attribute: elementConfig.attribute,
      label: (text as any).label ?? elementConfig.label,
      value: (text as any).value ?? elementConfig.value,
      unit: (text as any).unit ?? elementConfig.unit,
      appearance: elementConfig.appearance,
      
      // Logger widget specific properties
      maxLines: text.max_lines,
      lineSpacing: text.line_spacing,
      color_cycle: text.color_cycle,
       grid: appearance.grid ?? elementConfig.grid,
       min: appearance.min ?? elementConfig.min,
       max: appearance.max ?? elementConfig.max,
       spacing: appearance.spacing ?? elementConfig.spacing,
       top_padding: appearance.top_padding ?? elementConfig.top_padding,
       label_height: appearance.label_height ?? elementConfig.label_height,
       use_floats: appearance.use_floats ?? elementConfig.use_floats,
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
    if (layout.offset_x !== undefined) engineLayout.offsetX = layout.offset_x;
    if (layout.offset_y !== undefined) engineLayout.offsetY = layout.offset_y;
    
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
