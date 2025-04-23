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
    // Only nested anchor is supported; skip checks when targeting 'canvas'
    const anchorCfg = (this.layoutConfig.anchor || {}) as { target?: string };
    if (anchorCfg.target && anchorCfg.target !== 'canvas') {
      const targetElement = elementsMap.get(anchorCfg.target);
      if (!targetElement || !targetElement.layout.calculated) {
        return false;
      }
    }
    // Ensure stretch target dependencies are met before calculating
    const stretchCfg = (this.layoutConfig.stretch || {}) as { hTarget?: string; vTarget?: string };
    if (stretchCfg.hTarget && stretchCfg.hTarget !== 'canvas') {
      const hEl = elementsMap.get(stretchCfg.hTarget);
      if (!hEl || !hEl.layout.calculated) {
        return false;
      }
    }
    if (stretchCfg.vTarget && stretchCfg.vTarget !== 'canvas') {
      const vEl = elementsMap.get(stretchCfg.vTarget);
      if (!vEl || !vEl.layout.calculated) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculates the element's layout based on its configuration and the layout of other elements.
   * @param elementsMap - Map of all elements by ID.
   * @param containerRect - The bounding rectangle of the target container.
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

    // --- Anchor logic (nested only, migrated from original code) ---
    const anchorCfg = (this.layoutConfig.anchor || {}) as { target?: string; selfPoint?: string; targetPoint?: string } | undefined;
    let x = 0, y = 0;
    if (anchorCfg && anchorCfg.target) {
      const selfPoint = anchorCfg.selfPoint || 'topLeft';
      const targetPoint = anchorCfg.targetPoint || selfPoint;
      const selfOffset = this._getRelativeAnchorPosition(selfPoint, elementWidth, elementHeight);
      if (anchorCfg.target === 'canvas') {
        // Container anchoring
        let cX = 0, cY = 0;
        switch (targetPoint) {
          case 'topLeft':      cX = 0;            cY = 0;            break;
          case 'topCenter':    cX = containerWidth/2;  cY = 0;        break;
          case 'topRight':     cX = containerWidth;    cY = 0;        break;
          case 'centerLeft':   cX = 0;            cY = containerHeight/2; break;
          case 'center':       cX = containerWidth/2;  cY = containerHeight/2; break;
          case 'centerRight':  cX = containerWidth;    cY = containerHeight/2; break;
          case 'bottomLeft':   cX = 0;            cY = containerHeight;   break;
          case 'bottomCenter': cX = containerWidth/2;  cY = containerHeight;   break;
          case 'bottomRight':  cX = containerWidth;    cY = containerHeight;   break;
        }
        x = cX - selfOffset.x + this._parseOffset(this.layoutConfig.offsetX, containerWidth);
        y = cY - selfOffset.y + this._parseOffset(this.layoutConfig.offsetY, containerHeight);
      } else {
        // Element anchoring
        const targetEl = elementsMap.get(anchorCfg.target);
        if (!targetEl || !targetEl.layout.calculated) {
          this.layout.calculated = false;
          return;
        }
        const targetOffset = targetEl._getRelativeAnchorPosition(targetPoint, targetEl.layout.width, targetEl.layout.height);
        x = targetEl.layout.x + targetOffset.x - selfOffset.x + this._parseOffset(this.layoutConfig.offsetX, containerWidth);
        y = targetEl.layout.y + targetOffset.y - selfOffset.y + this._parseOffset(this.layoutConfig.offsetY, containerHeight);
      }
    }

    // Check stretch dependencies for both horizontal and vertical axes
    const stretchCfg = (this.layoutConfig.stretch || {}) as { hTarget?: string; hPoint?: string; hPadding?: number | string; vTarget?: string; vPoint?: string; vPadding?: number | string };
    // Horizontal stretching
    if (stretchCfg.hTarget && stretchCfg.hPoint) {
        let selfHPoint = (stretchCfg as any).hSelfPoint as string | undefined;
        if (!selfHPoint) {
            // Default self point opposite to target side
            if (stretchCfg.hPoint.endsWith('Left')) {
                selfHPoint = 'centerRight';
            } else if (stretchCfg.hPoint.endsWith('Right')) {
                selfHPoint = 'centerLeft';
            } else {
                selfHPoint = 'center';
            }
        }
        const myHPos = this._getRelativeAnchorPosition(selfHPoint, elementWidth, elementHeight);
        let targetHCoordX = x + myHPos.x;
        let targetHCoordY = y + myHPos.y;
        if (stretchCfg.hTarget === 'canvas') {
            switch (stretchCfg.hPoint) {
                case 'topLeft':    targetHCoordX = 0; break;
                case 'topCenter':  targetHCoordX = elementWidth / 2; break;
                case 'topRight':   targetHCoordX = elementWidth; break;
                case 'centerLeft': targetHCoordX = 0; break;
                case 'center':     targetHCoordX = elementWidth / 2; break;
                case 'centerRight':targetHCoordX = elementWidth; break;
                case 'bottomLeft': targetHCoordX = 0; break;
                case 'bottomCenter':targetHCoordX = elementWidth / 2; break;
                case 'bottomRight':targetHCoordX = elementWidth; break;
            }
        } else {
            const targetEl = elementsMap.get(stretchCfg.hTarget);
            if (targetEl && targetEl.layout.calculated) {
                const tpos = targetEl._getRelativeAnchorPosition(stretchCfg.hPoint, targetEl.layout.width, targetEl.layout.height);
                targetHCoordX = targetEl.layout.x + tpos.x;
                targetHCoordY = targetEl.layout.y + tpos.y;
            }
        }
        const currentH = x + myHPos.x;
        const dh = (targetHCoordX - currentH) + (this._parseOffset(stretchCfg.hPadding, elementWidth) || 0);
        const spaH = selfHPoint.toLowerCase();
        if (spaH.includes('right') && !spaH.includes('left')) {
            elementWidth += dh;
        } else if (spaH.includes('left') && !spaH.includes('right')) {
            // Stretch from left anchor: set width directly to span to target
            elementWidth = dh;
        }
        elementWidth = Math.max(0, elementWidth);
    }
    // Vertical stretching
    if (stretchCfg.vTarget && stretchCfg.vPoint) {
        let selfVPoint = (stretchCfg as any).vSelfPoint as string | undefined;
        if (!selfVPoint) {
            // Default self point opposite to target side
            if (stretchCfg.vPoint.startsWith('top')) {
                selfVPoint = 'bottomCenter';
            } else if (stretchCfg.vPoint.startsWith('bottom')) {
                selfVPoint = 'topCenter';
            } else {
                selfVPoint = 'center';
            }
        }
        const myVPos = this._getRelativeAnchorPosition(selfVPoint, elementWidth, elementHeight);
        let targetVCoordX = x + myVPos.x;
        let targetVCoordY = y + myVPos.y;
        if (stretchCfg.vTarget === 'canvas') {
            switch (stretchCfg.vPoint) {
                case 'topLeft':    targetVCoordY = 0; break;
                case 'topCenter':  targetVCoordY = 0; break;
                case 'topRight':   targetVCoordY = 0; break;
                case 'centerLeft': targetVCoordY = elementHeight / 2; break;
                case 'center':     targetVCoordY = elementHeight / 2; break;
                case 'centerRight':targetVCoordY = elementHeight / 2; break;
                case 'bottomLeft': targetVCoordY = elementHeight; break;
                case 'bottomCenter':targetVCoordY = elementHeight; break;
                case 'bottomRight':targetVCoordY = elementHeight; break;
            }
        } else {
            const targetEl = elementsMap.get(stretchCfg.vTarget);
            if (targetEl && targetEl.layout.calculated) {
                const tpos = targetEl._getRelativeAnchorPosition(stretchCfg.vPoint, targetEl.layout.width, targetEl.layout.height);
                targetVCoordX = targetEl.layout.x + tpos.x;
                targetVCoordY = targetEl.layout.y + tpos.y;
            }
        }
        const currentV = y + myVPos.y;
        const dv = (targetVCoordY - currentV) + (this._parseOffset(stretchCfg.vPadding, elementHeight) || 0);
        const spaV = selfVPoint.toLowerCase();
        if (spaV.includes('top') && !spaV.includes('bottom')) {
            // Stretch down from top
            elementHeight = Math.max(0, dv);
        } else if (spaV.includes('bottom') && !spaV.includes('top')) {
            // Stretch up from bottom, allow overlap
            const absDv = Math.abs(dv);
            // Reposition so element bottom aligns to target
            y = targetVCoordY - absDv;
            elementHeight = absDv;
        }
    }
    
    // Update layout state
    this.layout.x = x;
    this.layout.y = y;
    this.layout.width = elementWidth;
    this.layout.height = elementHeight;
    this.layout.calculated = true;
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