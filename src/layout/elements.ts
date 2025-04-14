/**
 * LCARS Card Element Implementations
 * 
 * Concrete implementations of LayoutElement for different visual elements
 * like rectangles, text, endcaps, etc.
 */

import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement, LayoutElementProps, LayoutConfigOptions } from './engine.js';
import { generateRectanglePath, generateEndcapPath, getTextWidth, measureTextBBox } from '../utils/shapes.js';
import { SVGTemplateResult, svg } from 'lit';

/**
 * A basic rectangle/rounded rectangle element.
 */
export class RectangleElement extends LayoutElement {
  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant) {
    super(id, props, layoutConfig, hass);
    // Initialize layout state (needed to fix TypeScript error)
    this.resetLayout();
  }

  /**
   * Renders the rectangle as an SVG path element.
   * @returns The SVG path element.
   */
  render(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;

    const { x, y, width, height } = this.layout;
    
    // Get corner radius from props (default to 0)
    const rx = this.props.rx ?? this.props.cornerRadius ?? 0;
    const ry = this.props.ry ?? this.props.cornerRadius ?? 0;
    
    // Generate the path data for the rectangle
    const pathData = generateRectanglePath(x, y, width, height, rx);
    
    return svg`
      <path
        id=${this.id}
        d=${pathData}
        fill=${this.props.fill || 'none'}
        stroke=${this.props.stroke || 'none'}
        stroke-width=${this.props.strokeWidth || '0'}
      />
    `;
  }
}

/**
 * A text element for displaying text.
 */
export class TextElement extends LayoutElement {
  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant) {
    super(id, props, layoutConfig, hass);
    // Initialize layout state (needed to fix TypeScript error)
    this.resetLayout();
  }

  /**
   * Calculates the intrinsic size of the text based on its content.
   * @param container - The SVG container element.
   */
  calculateIntrinsicSize(container: SVGElement): void {
    // First check if we have explicit width/height in props
    if (this.props.width && this.props.height) {
      this.intrinsicSize.width = this.props.width;
      this.intrinsicSize.height = this.props.height;
      this.intrinsicSize.calculated = true;
      return;
    }
    
    // Otherwise, we need to measure the text dimensions
    // Create temporary text element for measurement
    const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tempText.textContent = this.props.text || '';
    
    // Apply font properties
    if (this.props.fontFamily) {
      tempText.setAttribute('font-family', this.props.fontFamily);
    }
    if (this.props.fontSize) {
      tempText.setAttribute('font-size', `${this.props.fontSize}px`);
    }
    if (this.props.fontWeight) {
      tempText.setAttribute('font-weight', this.props.fontWeight);
    }
    
    // Add to container temporarily for measurement
    container.appendChild(tempText);
    
    // Measure text dimensions
    const bbox = measureTextBBox(tempText);
    
    // Remove temp element
    container.removeChild(tempText);
    
    // Use measured dimensions
    if (bbox) {
      this.intrinsicSize.width = bbox.width;
      this.intrinsicSize.height = bbox.height;
    } else {
      // Fallback if measurement fails
      this.intrinsicSize.width = getTextWidth(this.props.text || '', 
        `${this.props.fontWeight || ''} ${this.props.fontSize || 16}px ${this.props.fontFamily || 'Arial'}`);
      this.intrinsicSize.height = this.props.fontSize ? parseInt(this.props.fontSize.toString()) * 1.2 : 20;
    }
    
    this.intrinsicSize.calculated = true;
  }

  /**
   * Renders the text as an SVG text element.
   * @returns The SVG text element.
   */
  render(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;

    const { x, y, width, height } = this.layout;
    
    // Create SVG text element
    const textAnchor = this.props.textAnchor || 'start';
    const dominantBaseline = this.props.dominantBaseline || 'auto';

    let textX = x;
    let textY = y;
    
    // Adjust horizontal position based on text-anchor
    if (textAnchor === 'middle') {
      textX += width / 2;
    } else if (textAnchor === 'end') {
      textX += width;
    }
    
    // Adjust vertical position based on dominant-baseline
    if (dominantBaseline === 'middle') {
      textY += height / 2;
    } else if (dominantBaseline === 'hanging') {
      // already at top
    } else {
      // Default alignment is 'baseline', which typically needs a vertical offset
      textY += height * 0.8; // Approximate baseline position
    }
    
    // Use style attribute for text-transform as it's not an SVG attribute
    const styles = this.props.textTransform ? `text-transform: ${this.props.textTransform};` : '';

    return svg`
      <text
        id=${this.id}
        x=${textX}
        y=${textY}
        fill=${this.props.fill || '#000000'}
        font-family=${this.props.fontFamily || 'sans-serif'}
        font-size=${`${this.props.fontSize || 16}px`}
        font-weight=${this.props.fontWeight || 'normal'}
        letter-spacing=${this.props.letterSpacing || 'normal'}
        text-anchor=${textAnchor}
        dominant-baseline=${dominantBaseline}
        style=${styles}
      >
        ${this.props.text || ''}
      </text>
    `;
  }
}

/**
 * An endcap element for LCARS-style endcaps.
 */
export class EndcapElement extends LayoutElement {
  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant) {
    super(id, props, layoutConfig, hass);
    // Initialize layout state (needed to fix TypeScript error)
    this.resetLayout();
  }

  /**
   * Calculates the intrinsic size of the endcap.
   * @param container - The SVG container element.
   */
  calculateIntrinsicSize(container: SVGElement): void {
    // Use width from props or layoutConfig, defaulting to 40
    this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 40;
    
    // Use height from props or layoutConfig, defaulting to 0 (height might depend on anchor target)
    this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0; 
    
    this.intrinsicSize.calculated = true;
  }

  /**
   * Checks if dependencies are ready to calculate this element's layout.
   * @param elementsMap - Map of all elements by ID.
   * @returns Whether the layout can be calculated.
   */
  canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
    // If height is zero (potentially depends on anchor) and we have an anchor, check anchor dependency
    if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
      const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
      // If anchor isn't ready, we can't calculate final layout yet
      if (!anchorElement || !anchorElement.layout.calculated) return false; 
    }
    // Check other potential dependencies (like stretchTo if implemented fully)
    return super.canCalculateLayout(elementsMap); 
  }

  /**
   * Calculates the layout of the endcap. Overrides base to handle dynamic height.
   * @param elementsMap - Map of all elements by ID.
   * @param containerRect - The bounding rect of the SVG container.
   */
  calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    // If intrinsic height is still zero (meaning it wasn't set in props/layoutConfig) 
    // AND we are anchored, try to adopt the anchor target's height.
    if (this.intrinsicSize.height === 0 && this.layoutConfig.anchorTo) {
      const anchorElement = elementsMap.get(this.layoutConfig.anchorTo);
      // We know anchorElement is calculated because canCalculateLayout passed
      if (anchorElement) { 
        // IMPORTANT: Modify the height used for this specific layout calculation
        // We store the calculated dimensions in this.layout, not this.intrinsicSize here
        // Let the base calculateLayout use this adopted height
         const adoptedHeight = anchorElement.layout.height;
         // Temporarily set layoutConfig height for base calculation if needed
         const originalLayoutHeight = this.layoutConfig.height;
         this.layoutConfig.height = adoptedHeight; 
         super.calculateLayout(elementsMap, containerRect);
         this.layoutConfig.height = originalLayoutHeight; // Restore original config
         return; // Skip the default base calculation call below
      }
    }
    
    // If height was defined explicitly or anchor logic didn't run, use standard calculation
    super.calculateLayout(elementsMap, containerRect);
  }

  /**
   * Renders the endcap as an SVG path element.
   * @returns The SVG path element.
   */
  render(): SVGTemplateResult | null {
    if (!this.layout.calculated || this.layout.height <= 0 || this.layout.width <= 0) return null; // Don't render if dimensions invalid

    const { x, y, width, height } = this.layout;
    const direction = (this.props.direction || 'left') as 'left' | 'right';
    
    // Adjust X position for rendering based on direction if needed.
    // This assumes the layout calculation places the *logical* start point,
    // and we adjust here for visual placement.
    // Example: A 'left' endcap might have its layout calculated relative to the
    // *right* side of where it should visually appear.
    // For now, we'll assume layout.x/y is the top-left of the endcap's bounding box.
    // If generateEndcapPath implicitly handled position, this might need adjustment.

    // Call the utility with the calculated layout dimensions
    const pathData = generateEndcapPath(width, height, direction, x, y);

    if (!pathData) return null; // Don't render if path generation failed

    return svg`
      <path
        id=${this.id}
        d=${pathData}
        fill=${this.props.fill || 'none'}
        stroke=${this.props.stroke || 'none'}
        stroke-width=${this.props.strokeWidth || '0'}
      />
    `;
  }
} 