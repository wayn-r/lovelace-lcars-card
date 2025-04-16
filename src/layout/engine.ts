/**
 * LCARS Card Layout Engine
 * 
 * Core logic for dynamically generating and positioning LCARS-style SVG elements
 * based on a declarative layout configuration.
 */

import { SVGTemplateResult, html } from 'lit';
import gsap from 'gsap';
import { HomeAssistant } from 'custom-card-helpers';

// Type declarations
export interface LayoutElementProps {
  [key: string]: any;
}

export interface LayoutConfigOptions {
  [key: string]: any;
}

/**
 * Manages the overall layout process, including calculating element positions 
 * and generating SVG elements based on configuration.
 */
export class LayoutEngine {
  private elements: Map<string, LayoutElement>;
  private groups: Group[];
  private tempSvgContainer?: SVGElement; // For measurements

  /**
   * Creates a LayoutEngine instance.
   */
  constructor() {
    this.elements = new Map();
    this.groups = [];

    // Create a temporary off-screen SVG container for measurements if needed
    if (typeof document !== 'undefined') { 
      this.tempSvgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.tempSvgContainer.style.position = 'absolute';
      this.tempSvgContainer.style.left = '-9999px';
      this.tempSvgContainer.style.top = '-9999px';
      document.body.appendChild(this.tempSvgContainer);
    }
  }

  // Public getter for groups
  public get layoutGroups(): Group[] {
    return this.groups;
  }

  /**
   * Adds a Group of elements to the engine.
   * @param group - The group to add.
   */
  addGroup(group: Group): void {
    this.groups.push(group);
    group.elements.forEach(el => {
      if (this.elements.has(el.id)) {
        console.warn(`LayoutEngine: Duplicate element ID "${el.id}". Overwriting.`);
      }
      this.elements.set(el.id, el);
    });
  }

  /**
   * Clears all groups and elements from the engine.
   */
  clearLayout(): void {
    this.elements.clear();
    this.groups = [];
  }

  /**
   * Calculates the bounding boxes and positions for all elements.
   * @param containerRect - The bounding rectangle of the target container.
   */
  calculateBoundingBoxes(containerRect: DOMRect): void {
    if (!containerRect) return;
    
    const maxPasses = 10;
    let pass = 0;
    let elementsCalculatedInPass = 0;
    let totalCalculated = 0;

    this.elements.forEach(el => el.resetLayout());

    do {
      elementsCalculatedInPass = 0;
      pass++;

      this.elements.forEach(el => {
        if (el.layout.calculated) return;

        if (!el.intrinsicSize.calculated && this.tempSvgContainer) {
          el.calculateIntrinsicSize(this.tempSvgContainer);
        }

        const canCalculate = el.canCalculateLayout(this.elements);

        if (canCalculate) {
          el.calculateLayout(this.elements, containerRect);
          if (el.layout.calculated) {
            elementsCalculatedInPass++;
            totalCalculated++;
          }
        }
      });

    } while (elementsCalculatedInPass > 0 && totalCalculated < this.elements.size && pass < maxPasses);

    if (totalCalculated < this.elements.size) {
      console.warn(`LayoutEngine: Could not resolve layout for all elements after ${maxPasses} passes.`);
      this.elements.forEach(el => {
        if (!el.layout.calculated) {
          console.warn(` -> Failed to calculate: ${el.id}`);
        }
      });
    }
  }

  /**
   * Cleans up resources.
   */
  destroy(): void {
    if (this.tempSvgContainer && this.tempSvgContainer.parentNode) {
      this.tempSvgContainer.parentNode.removeChild(this.tempSvgContainer);
    }
    this.clearLayout();
  }
}

/**
 * Represents a logical grouping of LayoutElements.
 */
export class Group {
  id: string;
  elements: LayoutElement[];

  /**
   * Creates a Group instance.
   * @param id - A unique identifier for the group.
   * @param elements - An array of LayoutElement instances.
   */
  constructor(id: string, elements: LayoutElement[] = []) {
    this.id = id;
    this.elements = elements;
  }
}

// Layout size and position state
export interface LayoutState {
  x: number;
  y: number;
  width: number;
  height: number;
  calculated: boolean;
}

// Intrinsic size information
export interface IntrinsicSize {
  width: number;
  height: number;
  calculated: boolean;
}

/**
 * Abstract base class for all visual elements in the layout.
 */
export abstract class LayoutElement {
  id: string;
  props: LayoutElementProps;
  layoutConfig: LayoutConfigOptions;
  layout: LayoutState;
  intrinsicSize: IntrinsicSize;
  hass?: HomeAssistant;

  /**
   * Creates a LayoutElement instance.
   * @param id - A unique identifier for the element.
   * @param props - Visual properties (e.g., fill, text, stroke).
   * @param layoutConfig - Configuration for positioning and sizing.
   * @param hass - Home Assistant instance for entity state access.
   */
  constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}, hass?: HomeAssistant) {
    this.id = id;
    this.props = props;
    this.layoutConfig = layoutConfig;
    this.hass = hass;

    // Initialize state properties
    this.resetLayout();
    this.intrinsicSize = { width: 0, height: 0, calculated: false };
  }

  /**
   * Resets the calculated layout state. Called before each layout pass.
   */
  resetLayout(): void {
    this.layout = { x: 0, y: 0, width: 0, height: 0, calculated: false };
  }

  /**
   * Calculates the element's intrinsic size based on its content.
   * Subclasses should override this if their size depends on content.
   * @param container - The SVG container (needed for text measurement).
   */
  calculateIntrinsicSize(container: SVGElement): void {
    // Default implementation - use explicit dimensions from props/layoutConfig
    this.intrinsicSize.width = this.props.width || this.layoutConfig.width || 0;
    this.intrinsicSize.height = this.props.height || this.layoutConfig.height || 0;
    this.intrinsicSize.calculated = true;
  }

  /**
   * Checks if all dependencies required to calculate this element's layout
   * are already calculated.
   * @param elementsMap - Map of all elements by ID.
   * @returns True if layout can be calculated, false otherwise.
   */
  canCalculateLayout(elementsMap: Map<string, LayoutElement>): boolean {
    // Check anchor dependencies
    if (this.layoutConfig.anchorTo) {
        const targetElement = elementsMap.get(this.layoutConfig.anchorTo);
        if (!targetElement || !targetElement.layout.calculated) {
            return false;
        }
    }
    // Check stretch dependencies
    if (this.layoutConfig.stretchTo) {
        const targetElement = elementsMap.get(this.layoutConfig.stretchTo);
        if (!targetElement || !targetElement.layout.calculated) {
            return false;
        }
    }
    // Check height dependency for endcaps specifically
    if (this.constructor.name === 'EndcapElement' && this.layoutConfig.anchorTo && !this.props.height) {
      const targetElement = elementsMap.get(this.layoutConfig.anchorTo);
      if (!targetElement || !targetElement.layout.calculated) {
          return false;
      }
    }

    return true;
  }

  /**
   * Calculates the element's layout based on its configuration and dependencies.
   * @param elementsMap - Map of all elements by ID.
   * @param containerRect - The bounding rect of the SVG container.
   */
  calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
    const { width: containerWidth, height: containerHeight } = containerRect;
    let elementWidth = this.intrinsicSize.width;
    let elementHeight = this.intrinsicSize.height;
    if (typeof this.layoutConfig.width === 'string' && this.layoutConfig.width.endsWith('%')) {
      elementWidth = containerWidth * (parseFloat(this.layoutConfig.width) / 100);
    }
    if (typeof this.layoutConfig.height === 'string' && this.layoutConfig.height.endsWith('%')) {
      elementHeight = containerHeight * (parseFloat(this.layoutConfig.height) / 100);
    }
    let x = 0, y = 0;
    // --- Container anchoring logic ---
    if (!this.layoutConfig.anchorTo) {
      // Use containerAnchorPoint if present
      const containerAnchor = this.layoutConfig.containerAnchorPoint || 'topLeft';
      // Get the anchor offset for this element (where its anchor point is)
      const anchorOffset = this._getRelativeAnchorPosition(containerAnchor, elementWidth, elementHeight);
      // Get the container anchor position
      let containerAnchorX = 0;
      let containerAnchorY = 0;
      switch (containerAnchor) {
        case 'topLeft':
          containerAnchorX = 0;
          containerAnchorY = 0;
          break;
        case 'topCenter':
          containerAnchorX = containerWidth / 2;
          containerAnchorY = 0;
          break;
        case 'topRight':
          containerAnchorX = containerWidth;
          containerAnchorY = 0;
          break;
        case 'centerLeft':
          containerAnchorX = 0;
          containerAnchorY = containerHeight / 2;
          break;
        case 'center':
          containerAnchorX = containerWidth / 2;
          containerAnchorY = containerHeight / 2;
          break;
        case 'centerRight':
          containerAnchorX = containerWidth;
          containerAnchorY = containerHeight / 2;
          break;
        case 'bottomLeft':
          containerAnchorX = 0;
          containerAnchorY = containerHeight;
          break;
        case 'bottomCenter':
          containerAnchorX = containerWidth / 2;
          containerAnchorY = containerHeight;
          break;
        case 'bottomRight':
          containerAnchorX = containerWidth;
          containerAnchorY = containerHeight;
          break;
        default:
          containerAnchorX = 0;
          containerAnchorY = 0;
      }
      x = containerAnchorX - anchorOffset.x;
      y = containerAnchorY - anchorOffset.y;
      // Apply offsets if present
      x += this._parseOffset(this.layoutConfig.offsetX, containerWidth);
      y += this._parseOffset(this.layoutConfig.offsetY, containerHeight);
    }
    // --- Debugging Anchor Logic --- 
    if (this.layoutConfig.anchorTo) {
      const targetElement = elementsMap.get(this.layoutConfig.anchorTo);
      
      if (targetElement && targetElement.layout.calculated) { 
        
        const anchorPoint = this.layoutConfig.anchorPoint || 'topLeft';
        const targetAnchorPoint = this.layoutConfig.targetAnchorPoint || 'topLeft';
        
        
        const anchorPos = this._getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
        const targetPos = targetElement._getRelativeAnchorPosition(targetAnchorPoint);
        
        
        const initialX = targetElement.layout.x + targetPos.x - anchorPos.x;
        const initialY = targetElement.layout.y + targetPos.y - anchorPos.y;
        

        x = initialX;
        y = initialY;
        
        // Apply offsets relative to the anchor
        const offsetX = this._parseOffset(this.layoutConfig.offsetX, containerWidth);
        const offsetY = this._parseOffset(this.layoutConfig.offsetY, containerHeight);
        if (this.layoutConfig.offsetX !== undefined) {
            
            x += offsetX;
        }
        if (this.layoutConfig.offsetY !== undefined) {
            
            y += offsetY;
        }
        

      } else {
        console.warn(`[${this.id}] Anchor target '${this.layoutConfig.anchorTo}' not found or not calculated yet.`);
        // If target not ready, layout cannot be calculated accurately this pass
        this.layout.calculated = false; 
        return; // Stop calculation for this element this pass
      }
    }
    // --- End Debugging --- 

    // Handle stretching to other elements (can modify width/height)
    if (this.layoutConfig.stretchTo) {
      const targetElement = elementsMap.get(this.layoutConfig.stretchTo);
      if (targetElement && targetElement.layout.calculated) {
        const stretchAnchorPoint = this.layoutConfig.stretchAnchorPoint || 'topRight';
        const targetStretchAnchorPoint = this.layoutConfig.targetStretchAnchorPoint || 'topLeft';
        const myStretchPos = this._getRelativeAnchorPosition(stretchAnchorPoint, elementWidth, elementHeight);
        const targetStretchPos = targetElement._getRelativeAnchorPosition(targetStretchAnchorPoint);
        const targetStretchCoordX = targetElement.layout.x + targetStretchPos.x;
        const targetStretchCoordY = targetElement.layout.y + targetStretchPos.y;
        const currentStretchCoordX = x + myStretchPos.x;
        const currentStretchCoordY = y + myStretchPos.y;
        let stretchX = targetStretchCoordX - currentStretchCoordX + (this._parseOffset(this.layoutConfig.stretchPaddingX, containerWidth) || 0);
        let stretchY = targetStretchCoordY - currentStretchCoordY + (this._parseOffset(this.layoutConfig.stretchPaddingY, containerHeight) || 0);
        if (stretchAnchorPoint.includes('Right') && !stretchAnchorPoint.includes('Left')) elementWidth += stretchX;
        if (stretchAnchorPoint.includes('Bottom') && !stretchAnchorPoint.includes('Top')) elementHeight += stretchY;
        elementWidth = Math.max(0, elementWidth);
        elementHeight = Math.max(0, elementHeight);
      }
    }
    
    // Update layout state
    this.layout.x = x;
    this.layout.y = y;
    this.layout.width = elementWidth;
    this.layout.height = elementHeight;
    this.layout.calculated = true;
    // 
  }

  /**
   * Parses offset values (px or %)
   */
  private _parseOffset(offset: string | number | undefined, containerDimension: number): number {
      if (offset === undefined) return 0;
      if (typeof offset === 'number') return offset;
      if (typeof offset === 'string') {
          if (offset.endsWith('%')) {
              return (parseFloat(offset) / 100) * containerDimension;
          }
          return parseFloat(offset);
      }
      return 0;
  }

  /**
   * Gets the position of an anchor point relative to the element's top-left corner.
   * @param anchorPoint - The anchor point identifier (e.g., 'topLeft', 'centerRight').
   * @param width - Optional width override (defaults to layout width).
   * @param height - Optional height override (defaults to layout height).
   * @returns The {x, y} coordinates relative to the element's origin.
   */
  _getRelativeAnchorPosition(anchorPoint: string, width?: number, height?: number): { x: number; y: number } {
    const w = width !== undefined ? width : this.layout.width;
    const h = height !== undefined ? height : this.layout.height;
    
    switch (anchorPoint) {
      case 'topLeft': return { x: 0, y: 0 };
      case 'topCenter': return { x: w / 2, y: 0 };
      case 'topRight': return { x: w, y: 0 };
      case 'centerLeft': return { x: 0, y: h / 2 };
      case 'center': return { x: w / 2, y: h / 2 };
      case 'centerRight': return { x: w, y: h / 2 };
      case 'bottomLeft': return { x: 0, y: h };
      case 'bottomCenter': return { x: w / 2, y: h };
      case 'bottomRight': return { x: w, y: h };
      default: 
        console.warn(`Unknown anchor point: ${anchorPoint}. Defaulting to topLeft.`);
        return { x: 0, y: 0 };
    }
  }

  /**
   * Abstract method to render the element as an SVG Template.
   * @returns The SVGTemplateResult to add to the DOM, or null.
   */
  abstract render(): SVGTemplateResult | null;

  /**
   * Animates a property of the element using GSAP.
   * @param property - The property to animate.
   * @param value - The target value.
   * @param duration - Animation duration in seconds.
   */
  animate(property: string, value: any, duration: number = 0.5): void {
    if (!this.layout.calculated) return;
    
    // Get SVG element (assuming it's rendered and has the correct ID)
    const element = document.getElementById(this.id);
    if (!element) return;
    
    const animProps: { [key: string]: any } = {};
    animProps[property] = value;
    
    gsap.to(element, {
      duration,
      ...animProps,
      ease: "power2.out"
    });
  }
} 