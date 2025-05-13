import { SVGTemplateResult, html } from 'lit';
import gsap from 'gsap';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from './elements/element.js';

export interface LayoutElementProps {
  [key: string]: any;
  button?: any;
  textPadding?: number; // Padding to apply to text elements (used for equal spacing)
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

export interface StretchContext {
  x: number;
  y: number;
  width: number;
  height: number;
  elementsMap: Map<string, LayoutElement>;
  containerWidth: number;
  containerHeight: number;
}

export class LayoutEngine {
  private elements: Map<string, LayoutElement>;
  private groups: Group[];
  private tempSvgContainer?: SVGElement;
  private containerRect?: DOMRect;

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

  addGroup(group: Group): void {
    this.groups.push(group);
    group.elements.forEach(el => {
      if (this.elements.has(el.id)) {
        console.warn(`LayoutEngine: Duplicate element ID "${el.id}". Overwriting.`);
      }
      this.elements.set(el.id, el);
    });
  }

  clearLayout(): void {
    this.elements.clear();
    this.groups = [];
  }

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

  destroy(): void {
    if (this.tempSvgContainer && this.tempSvgContainer.parentNode) {
      this.tempSvgContainer.parentNode.removeChild(this.tempSvgContainer);
    }
    this.clearLayout();
  }
}

export class Group {
  id: string;
  elements: LayoutElement[];

  constructor(id: string, elements: LayoutElement[] = []) {
    this.id = id;
    this.elements = elements;
  }
}

export interface LayoutState {
  x: number;
  y: number;
  width: number;
  height: number;
  calculated: boolean;
}

export interface IntrinsicSize {
  width: number;
  height: number;
  calculated: boolean;
}
