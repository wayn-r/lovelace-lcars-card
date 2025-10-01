export class ElementMetadata {
  private static readonly ELEMENT_ICONS: Record<string, string> = {
    'rectangle': 'mdi:rectangle-outline',
    'text': 'mdi:format-text',
    'endcap': 'mdi:arrow-right-bold',
    'elbow': 'mdi:arrow-top-right',
    'top_header': 'mdi:page-layout-header',
    'graph-widget': 'mdi:chart-line',
    'entity-text-widget': 'mdi:text-box',
    'entity-metric-widget': 'mdi:counter',
    'vertical-slider': 'mdi:tune-vertical',
    'weather-icon': 'mdi:weather-partly-cloudy',
  };

  private static readonly ENTITY_REQUIRED_TYPES = new Set([
    'graph-widget',
    'entity-text-widget',
    'entity-metric-widget',
    'vertical-slider',
    'weather-icon'
  ]);

  private static readonly ATTRIBUTE_SUPPORTED_TYPES = new Set([
    'graph-widget',
    'entity-text-widget',
    'entity-metric-widget',
    'vertical-slider'
  ]);

  private static readonly ENTITY_HELP_TEXT: Record<string, string> = {
    'graph-widget': 'Entity to display in graph',
    'entity-text-widget': 'Entity to display (supports up to 2 entities)',
    'entity-metric-widget': 'Entity to display as metric (supports up to 2 entities)',
    'vertical-slider': 'Entity to control with slider',
    'weather-icon': 'Weather entity to display',
  };

  static getIconForType(type: string): string {
    return this.ELEMENT_ICONS[type] || 'mdi:shape';
  }

  static requiresEntity(type: string): boolean {
    return this.ENTITY_REQUIRED_TYPES.has(type);
  }

  static supportsAttribute(type: string): boolean {
    return this.ATTRIBUTE_SUPPORTED_TYPES.has(type);
  }

  static isGraphWidget(type: string): boolean {
    return type === 'graph-widget';
  }

  static isSliderWidget(type: string): boolean {
    return type === 'vertical-slider';
  }

  static getEntityHelpText(type: string): string {
    return this.ENTITY_HELP_TEXT[type] || 'Home Assistant entity ID';
  }

  static getAllElementTypes(): string[] {
    return [
      'rectangle',
      'text',
      'endcap',
      'elbow',
      'top_header',
      'graph-widget',
      'entity-text-widget',
      'entity-metric-widget',
      'vertical-slider',
      'weather-icon'
    ];
  }
}

