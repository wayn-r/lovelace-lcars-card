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
  
  stretch?: {
    stretchTo1?: string;
    targetStretchAnchorPoint1?: string;
    stretchPadding1?: number;
    stretchTo2?: string;
    targetStretchAnchorPoint2?: string;
    stretchPadding2?: number;
  };
}

// Context for stretch calculations
interface StretchContext {
  x: number;
  y: number;
  width: number;
  height: number;
  elementsMap: Map<string, LayoutElement>;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Manages the overall layout process, including calculating element positions 
 * and generating SVG elements based on configuration.
 */
export class LayoutEngine {
  private elements: Map<string, LayoutElement>;
  private groups: Group[];
  private tempSvgContainer?: SVGElement;
  private containerRect?: DOMRect;

  /**
   * Creates a LayoutEngine instance.
   */
  constructor() {
    this.elements = new Map();
    this.groups = [];
    this._initializeTempSvgContainer();
  }

  private _initializeTempSvgContainer(): void {
    if (typeof document !== 'undefined') { 
      this.tempSvgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.tempSvgContainer.style.position = 'absolute';
      this.tempSvgContainer.style.left = '-9999px';
      this.tempSvgContainer.style.top = '-9999px';
      document.body.appendChild(this.tempSvgContainer);
    }
  }

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
    
    this.containerRect = containerRect;
    const maxPasses = 10;
    let pass = 0;
    let elementsCalculatedInPass = 0;
    let totalCalculated = 0;

    this.elements.forEach(el => el.resetLayout());

    do {
      elementsCalculatedInPass = this._calculateElementsForPass(pass, totalCalculated);
      totalCalculated += elementsCalculatedInPass;
      pass++;
    } while (elementsCalculatedInPass > 0 && totalCalculated < this.elements.size && pass < maxPasses);

    this._logLayoutCalculationResults(totalCalculated, maxPasses);
  }

  private _calculateElementsForPass(pass: number, totalCalculated: number): number {
    let elementsCalculatedInPass = 0;

    this.elements.forEach(el => {
      if (el.layout.calculated) return;

      if (!el.intrinsicSize.calculated && this.tempSvgContainer) {
        el.calculateIntrinsicSize(this.tempSvgContainer);
      }

      const canCalculate = el.canCalculateLayout(this.elements);

      if (canCalculate && this.containerRect) {
        el.calculateLayout(this.elements, this.containerRect);
        if (el.layout.calculated) {
          elementsCalculatedInPass++;
        }
      }
    });

    return elementsCalculatedInPass;
  }

  private _logLayoutCalculationResults(totalCalculated: number, maxPasses: number): void {
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
    if (!this._checkAnchorDependencies(elementsMap)) return false;
    if (!this._checkStretchDependencies(elementsMap)) return false;
    if (!this._checkSpecialDependencies(elementsMap)) return false;

    return true;
  }

  private _checkAnchorDependencies(elementsMap: Map<string, LayoutElement>): boolean {
    if (this.layoutConfig.anchor?.anchorTo && this.layoutConfig.anchor.anchorTo !== 'container') {
        const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
        if (!targetElement || !targetElement.layout.calculated) {
            return false;
        }
    }
    return true;
  }

  private _checkStretchDependencies(elementsMap: Map<string, LayoutElement>): boolean {
    // Check first stretch dependency
    if (this.layoutConfig.stretch?.stretchTo1 && 
        this.layoutConfig.stretch.stretchTo1 !== 'canvas' && 
        this.layoutConfig.stretch.stretchTo1 !== 'container') {
        
        const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo1);
        if (!targetElement || !targetElement.layout.calculated) {
            return false;
        }
    }
    
    // Check second stretch dependency
    if (this.layoutConfig.stretch?.stretchTo2 && 
        this.layoutConfig.stretch.stretchTo2 !== 'canvas' && 
        this.layoutConfig.stretch.stretchTo2 !== 'container') {
        
        const targetElement = elementsMap.get(this.layoutConfig.stretch.stretchTo2);
        if (!targetElement || !targetElement.layout.calculated) {
            return false;
        }
    }
    
    return true;
  }

  private _checkSpecialDependencies(elementsMap: Map<string, LayoutElement>): boolean {
    // Check height dependency for endcaps specifically
    if (this.constructor.name === 'EndcapElement' && 
        this.layoutConfig.anchor?.anchorTo && 
        this.layoutConfig.anchor.anchorTo !== 'container' && 
        !this.props.height) {
      
      const targetElement = elementsMap.get(this.layoutConfig.anchor.anchorTo);
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
    let elementWidth = this._calculateElementWidth(containerWidth);
    let elementHeight = this._calculateElementHeight(containerHeight);

    let { x, y } = this._calculateInitialPosition(elementsMap, containerWidth, containerHeight, elementWidth, elementHeight);

    // Process stretching if configured
    if (this.layoutConfig.stretch) {
      const stretchContext: StretchContext = {
        x,
        y,
        width: elementWidth,
        height: elementHeight,
        elementsMap,
        containerWidth,
        containerHeight
      };
      
      this._applyStretchConfigurations(stretchContext);
      
      x = stretchContext.x;
      y = stretchContext.y;
      elementWidth = stretchContext.width;
      elementHeight = stretchContext.height;
    }

    this._finalizeLayout(x, y, elementWidth, elementHeight);
  }

  private _calculateElementWidth(containerWidth: number): number {
    let width = this.intrinsicSize.width;
    if (typeof this.layoutConfig.width === 'string' && this.layoutConfig.width.endsWith('%')) {
      width = containerWidth * (parseFloat(this.layoutConfig.width) / 100);
    }
    return width;
  }

  private _calculateElementHeight(containerHeight: number): number {
    let height = this.intrinsicSize.height;
    if (typeof this.layoutConfig.height === 'string' && this.layoutConfig.height.endsWith('%')) {
      height = containerHeight * (parseFloat(this.layoutConfig.height) / 100);
    }
    return height;
  }

  private _calculateInitialPosition(
    elementsMap: Map<string, LayoutElement>, 
    containerWidth: number, 
    containerHeight: number,
    elementWidth: number,
    elementHeight: number
  ): { x: number, y: number } {
    let x = 0;
    let y = 0;

    const anchorConfig = this.layoutConfig.anchor;
    const anchorTo = anchorConfig?.anchorTo;
    const anchorPoint = anchorConfig?.anchorPoint || 'topLeft';
    const targetAnchorPoint = anchorConfig?.targetAnchorPoint || 'topLeft';

    if (!anchorTo || anchorTo === 'container') {
      // Anchoring to container
      const { x: elementX, y: elementY } = this._anchorToContainer(
        anchorPoint, 
        targetAnchorPoint, 
        elementWidth, 
        elementHeight, 
        containerWidth, 
        containerHeight
      );
      x = elementX;
      y = elementY;
    } else {
      // Anchoring to another element
      const result = this._anchorToElement(
        anchorTo, 
        anchorPoint, 
        targetAnchorPoint, 
        elementWidth, 
        elementHeight, 
        elementsMap
      );
      
      if (!result) {
        // Failed to anchor to element
        this.layout.calculated = false;
        return { x, y }; // Return defaults
      }
      
      x = result.x;
      y = result.y;
    }

    // Apply offsets
    x += this._parseOffset(this.layoutConfig.offsetX, containerWidth);
    y += this._parseOffset(this.layoutConfig.offsetY, containerHeight);

    return { x, y };
  }

  private _anchorToContainer(
    anchorPoint: string, 
    targetAnchorPoint: string, 
    elementWidth: number, 
    elementHeight: number, 
    containerWidth: number, 
    containerHeight: number
  ): { x: number, y: number } {
    const elementAnchorPos = this._getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
    const containerTargetPos = this._getRelativeAnchorPosition(targetAnchorPoint, containerWidth, containerHeight); 

    const x = containerTargetPos.x - elementAnchorPos.x;
    const y = containerTargetPos.y - elementAnchorPos.y;

    return { x, y };
  }

  private _anchorToElement(
    anchorTo: string,
    anchorPoint: string,
    targetAnchorPoint: string,
    elementWidth: number,
    elementHeight: number,
    elementsMap: Map<string, LayoutElement>
  ): { x: number, y: number } | null {
    const targetElement = elementsMap.get(anchorTo);
    if (!targetElement || !targetElement.layout.calculated) {
      console.warn(`[${this.id}] Anchor target '${anchorTo}' not found or not calculated yet.`);
      return null;
    }

    const elementAnchorPos = this._getRelativeAnchorPosition(anchorPoint, elementWidth, elementHeight);
    const targetElementPos = targetElement._getRelativeAnchorPosition(targetAnchorPoint);

    const x = targetElement.layout.x + targetElementPos.x - elementAnchorPos.x;
    const y = targetElement.layout.y + targetElementPos.y - elementAnchorPos.y;

    return { x, y };
  }

  private _applyStretchConfigurations(context: StretchContext): void {
    const stretchConfig = this.layoutConfig.stretch;
    if (!stretchConfig) return;
    
    // Process first stretch
    this._processSingleStretch(
      stretchConfig.stretchTo1, 
      stretchConfig.targetStretchAnchorPoint1, 
      stretchConfig.stretchPadding1,
      context
    );

    // Process second stretch
    this._processSingleStretch(
      stretchConfig.stretchTo2, 
      stretchConfig.targetStretchAnchorPoint2, 
      stretchConfig.stretchPadding2,
      context
    );
  }

  private _finalizeLayout(x: number, y: number, width: number, height: number): void {
    this.layout.x = x;
    this.layout.y = y;
    this.layout.width = Math.max(1, width); // Ensure minimum width of 1px
    this.layout.height = Math.max(1, height); // Ensure minimum height of 1px
    this.layout.calculated = true;
  }

  /**
   * Processes a single stretch configuration (either stretch1 or stretch2).
   */
  private _processSingleStretch(
    stretchTo: string | undefined, 
    targetStretchAnchorPoint: string | undefined, 
    stretchPadding: number | undefined,
    context: StretchContext
  ): void {
    if (!stretchTo || !targetStretchAnchorPoint) return;
    
    const padding = stretchPadding ?? 0;
    const isHorizontal = this._isHorizontalStretch(targetStretchAnchorPoint);
    
    if (isHorizontal) {
      this._applyHorizontalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
    } else {
      this._applyVerticalStretch(context, stretchTo, targetStretchAnchorPoint, padding);
    }
  }

  private _isHorizontalStretch(targetStretchAnchorPoint: string): boolean {
    return ['left', 'right'].some(dir => targetStretchAnchorPoint.toLowerCase().includes(dir));
  }

  private _applyHorizontalStretch(
    context: StretchContext,
    stretchTo: string,
    targetStretchAnchorPoint: string,
    padding: number
  ): void {
    const { x: stretchedX, size: stretchedWidth } = this._applyStretch(
      context.x, 
      context.width, 
      true, // isHorizontal
      stretchTo,
      targetStretchAnchorPoint,
      padding,
      context.elementsMap,
      context.containerWidth
    );
    
    if (stretchedX !== undefined) context.x = stretchedX;
    context.width = stretchedWidth;
  }

  private _applyVerticalStretch(
    context: StretchContext,
    stretchTo: string,
    targetStretchAnchorPoint: string,
    padding: number
  ): void {
    const { y: stretchedY, size: stretchedHeight } = this._applyStretch(
      context.y, 
      context.height, 
      false, // isHorizontal
      stretchTo,
      targetStretchAnchorPoint,
      padding,
      context.elementsMap,
      context.containerHeight
    );
    
    if (stretchedY !== undefined) context.y = stretchedY;
    context.height = stretchedHeight;
  }

  /**
   * Calculates the coordinate (x or y) of the stretch target.
   */
  private _getTargetCoordinate(
    stretchTargetId: string, 
    targetAnchorPoint: string, 
    isHorizontal: boolean,
    elementsMap: Map<string, LayoutElement>,
    containerSize: number
  ): number | null {
    if (stretchTargetId === 'container') {
      return this._getContainerEdgeCoordinate(targetAnchorPoint, isHorizontal, containerSize);
    } else {
      return this._getElementEdgeCoordinate(stretchTargetId, targetAnchorPoint, isHorizontal, elementsMap);
    }
  }

  private _getContainerEdgeCoordinate(
    targetAnchorPoint: string, 
    isHorizontal: boolean, 
    containerSize: number
  ): number {
    if (isHorizontal) {
      if (targetAnchorPoint === 'left' || targetAnchorPoint.includes('Left')) return 0;
      if (targetAnchorPoint === 'right' || targetAnchorPoint.includes('Right')) return containerSize;
      if (targetAnchorPoint === 'center' || targetAnchorPoint.includes('Center')) return containerSize / 2;
      return containerSize; // Default to right edge
    } else {
      if (targetAnchorPoint === 'top' || targetAnchorPoint.includes('Top')) return 0;
      if (targetAnchorPoint === 'bottom' || targetAnchorPoint.includes('Bottom')) return containerSize;
      if (targetAnchorPoint === 'center' || targetAnchorPoint.includes('Center')) return containerSize / 2;
      return containerSize; // Default to bottom edge
    }
  }

  private _getElementEdgeCoordinate(
    stretchTargetId: string,
    targetAnchorPoint: string,
    isHorizontal: boolean,
    elementsMap: Map<string, LayoutElement>
  ): number | null {
    const targetElement = elementsMap.get(stretchTargetId);
    if (!targetElement || !targetElement.layout.calculated) {
      console.warn(`[${this.id}] Stretch target '${stretchTargetId}' not found or not calculated yet.`);
      return null; 
    }
    
    const anchorPointToUse = this._mapSimpleDirectionToAnchorPoint(targetAnchorPoint, isHorizontal);
    const targetRelativePos = targetElement._getRelativeAnchorPosition(anchorPointToUse);
    
    return isHorizontal
      ? targetElement.layout.x + targetRelativePos.x
      : targetElement.layout.y + targetRelativePos.y;
  }

  private _mapSimpleDirectionToAnchorPoint(direction: string, isHorizontal: boolean): string {
    if (isHorizontal) {
      if (direction === 'left') return 'centerLeft';
      if (direction === 'right') return 'centerRight';
      if (direction === 'center') return 'center';
    } else {
      if (direction === 'top') return 'topCenter';
      if (direction === 'bottom') return 'bottomCenter';
      if (direction === 'center') return 'center';
    }
    return direction; // Return original if no mapping needed
  }

  /**
   * Applies stretching in a specific direction
   */
  private _applyStretch(
    initialPosition: number, 
    initialSize: number, 
    isHorizontal: boolean,
    stretchTo: string,
    targetAnchorPoint: string,
    padding: number,
    elementsMap: Map<string, LayoutElement>,
    containerSize: number
  ): { x?: number, y?: number, size: number } {
    let newPosition = initialPosition;
    let newSize = initialSize;
    
    const targetCoord = this._getTargetCoordinate(
      stretchTo, 
      targetAnchorPoint, 
      isHorizontal, 
      elementsMap, 
      containerSize
    );

    if (targetCoord === null) {
      return isHorizontal ? { x: initialPosition, size: initialSize } : { y: initialPosition, size: initialSize };
    }

    const myAnchorPoint = this._getCloserEdge(initialPosition, initialSize, targetCoord, isHorizontal);
    const myRelativePos = this._getRelativeAnchorPosition(myAnchorPoint, initialSize, initialSize);
    const currentCoord = initialPosition + (isHorizontal ? myRelativePos.x : myRelativePos.y);
    
    let delta = targetCoord - currentCoord;
    delta = this._applyPadding(delta, myAnchorPoint, padding, containerSize);
    
    const result = this._applyStretchToEdge(
      initialPosition, 
      initialSize, 
      delta, 
      myAnchorPoint, 
      isHorizontal
    );
    
    return result;
  }

  private _applyPadding(
    delta: number, 
    anchorPoint: string, 
    padding: number, 
    containerSize: number
  ): number {
    const paddingOffset = this._parseOffset(padding, containerSize);
    
    if (anchorPoint.includes('Left') || anchorPoint.includes('Top')) {
      return delta - paddingOffset;
    } else {
      return delta + paddingOffset;
    }
  }

  private _applyStretchToEdge(
    initialPosition: number,
    initialSize: number,
    delta: number,
    anchorPoint: string,
    isHorizontal: boolean
  ): { x?: number, y?: number, size: number } {
    let newPosition = initialPosition;
    let newSize = initialSize;
    
    if (isHorizontal) {
      if (anchorPoint === 'centerRight') {
        newSize += delta;
      } else { // centerLeft
        if (delta < initialSize) {
          newPosition += delta;
          newSize -= delta;
        } else {
          newPosition += initialSize - 1;
          newSize = 1;
        }
      }
      
      newSize = Math.max(1, newSize);
      return { x: newPosition, size: newSize };
    } else {
      if (anchorPoint === 'bottomCenter') {
        newSize += delta;
      } else { // topCenter
        if (delta < initialSize) {
          newPosition += delta;
          newSize -= delta;
        } else {
          newPosition += initialSize - 1;
          newSize = 1;
        }
      }
      
      newSize = Math.max(1, newSize);
      return { y: newPosition, size: newSize };
    }
  }

  private _getCloserEdge(
    initialPosition: number, 
    initialSize: number, 
    targetCoord: number, 
    isHorizontal: boolean
  ): string {
    if (isHorizontal) {
      const leftEdge = initialPosition;
      const rightEdge = initialPosition + initialSize;
      return (Math.abs(targetCoord - leftEdge) <= Math.abs(targetCoord - rightEdge)) ? 'centerLeft' : 'centerRight';
    } else {
      const topEdge = initialPosition;
      const bottomEdge = initialPosition + initialSize;
      return (Math.abs(targetCoord - topEdge) <= Math.abs(targetCoord - bottomEdge)) ? 'topCenter' : 'bottomCenter';
    }
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