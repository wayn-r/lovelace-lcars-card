import { SVGTemplateResult, svg } from 'lit';
import { IRenderer } from './interfaces.js';
import { LayoutElementProps, LayoutState } from '../layout/engine.js';
import { ComputedElementColors, ColorResolutionDefaults } from '../utils/color.js';
import { colorResolver } from '../utils/color-resolver.js';
import { Button } from '../layout/elements/button.js';
import { HomeAssistant } from 'custom-card-helpers';

/**
 * Base renderer class that handles SVG generation and visual representation
 */
export abstract class BaseRenderer implements IRenderer {
  id: string;
  props: LayoutElementProps;
  layout: LayoutState;
  hass?: HomeAssistant;
  button?: Button;
  requestUpdateCallback?: () => void;
  getShadowElement?: (id: string) => Element | null;

  constructor(
    id: string, 
    props: LayoutElementProps, 
    layout: LayoutState,
    hass?: HomeAssistant,
    requestUpdateCallback?: () => void,
    getShadowElement?: (id: string) => Element | null
  ) {
    this.id = id;
    this.props = props;
    this.layout = layout;
    this.hass = hass;
    this.requestUpdateCallback = requestUpdateCallback;
    this.getShadowElement = getShadowElement;

    // Initialize button if button config exists
    if (props.button?.enabled) {
      this.button = new Button(id, props, hass, requestUpdateCallback, getShadowElement);
    }
  }

  /**
   * Main render method - combines shape and text rendering
   */
  render(): SVGTemplateResult | null {
    if (!this.layout.calculated) {
      return null;
    }

    // Get resolved colors for rendering
    const colors = this.resolveColors();
    
    // Render the shape
    const shapeTemplate = this.renderShape();
    if (!shapeTemplate) {
      return null;
    }

    // Render text if present
    const textTemplate = this.renderText(colors);
    
    // Combine shape and text
    if (textTemplate) {
      return svg`
        <g id="${this.id}">
          ${shapeTemplate}
          ${textTemplate}
        </g>
      `;
    } else {
      return svg`
        <g id="${this.id}">
          ${shapeTemplate}
        </g>
      `;
    }
  }

  /**
   * Optional method for rendering SVG definitions (gradients, patterns, etc.)
   */
  renderDefs?(): SVGTemplateResult[];

  /**
   * Abstract method that subclasses must implement to render their specific shape
   */
  abstract renderShape(): SVGTemplateResult | null;

  /**
   * Resolve colors for this element based on current state
   */
  resolveColors(): ComputedElementColors {
    const stateContext = this.getStateContext();
    const options: ColorResolutionDefaults = {
      fallbackFillColor: 'none',
      fallbackStrokeColor: 'none', 
      fallbackStrokeWidth: '0',
      fallbackTextColor: 'currentColor'
    };
    
    const animationContext = {
      elementId: this.id,
      getShadowElement: this.getShadowElement,
      hass: this.hass,
      requestUpdateCallback: this.requestUpdateCallback
    };
    
    return colorResolver.resolveAllElementColors(this.id, this.props, animationContext, options, stateContext);
  }

  /**
   * Get the current state context for color resolution
   */
  protected getStateContext() {
    // Default implementation - subclasses can override for interactive states
    return {
      isCurrentlyHovering: false,
      isCurrentlyActive: false
    };
  }

  /**
   * Render text content if present
   */
  protected renderText(colors: ComputedElementColors): SVGTemplateResult | null {
    if (!this.hasText()) {
      return null;
    }

    // Check if this is button text (handled by button renderer)
    if (this.hasButtonConfig()) {
      return null; // Button handles its own text rendering
    }

    // Render non-button text
    return this.renderNonButtonText(colors);
  }

  /**
   * Render text that's not part of a button
   */
  protected renderNonButtonText(colors: ComputedElementColors): SVGTemplateResult | null {
    if (!this.hasNonButtonText()) {
      return null;
    }

    const textPosition = this.getTextPosition();
    const text = this.props.text || '';
    const fontSize = this.props.fontSize || 12;
    const fontFamily = this.props.fontFamily || 'sans-serif';
    
    return svg`
      <text 
        x="${textPosition.x}" 
        y="${textPosition.y}" 
        fill="${colors.textColor}" 
        font-size="${fontSize}" 
        font-family="${fontFamily}"
        text-anchor="middle" 
        dominant-baseline="central"
      >
        ${text}
      </text>
    `;
  }

  /**
   * Check if element has text content
   */
  protected hasText(): boolean {
    return Boolean(this.props.text && this.props.text.trim() !== '');
  }

  /**
   * Check if element has non-button text
   */
  protected hasNonButtonText(): boolean {
    return this.hasText() && !this.hasButtonConfig();
  }

  /**
   * Check if element has button configuration
   */
  protected hasButtonConfig(): boolean {
    return Boolean(this.props.button?.enabled);
  }

  /**
   * Get text position based on element layout
   */
  protected getTextPosition(): { x: number, y: number } {
    // Default to center of element
    return {
      x: this.layout.x + this.layout.width / 2,
      y: this.layout.y + this.layout.height / 2
    };
  }

  /**
   * Cleanup animations - default implementation
   */
  cleanupAnimations(): void {
    // Default implementation - subclasses can override
    // Animation cleanup logic would go here
  }

  /**
   * Update Home Assistant instance
   */
  updateHass(hass?: HomeAssistant): void {
    this.hass = hass;
    if (this.button) {
      this.button.updateHass(hass);
    }
  }
} 