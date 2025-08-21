import { SVGTemplateResult, html } from 'lit';
import gsap from 'gsap';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElement } from './elements/element.js';
import type { ButtonConfig, ColorValue, ElementStateManagementConfig, AnimationsConfig } from '../types.js';

export interface LayoutElementProps {
  // Appearance
  fill?: ColorValue;
  stroke?: ColorValue;
  strokeWidth?: number;
  rx?: number;
  cornerRadius?: number;
  direction?: 'left' | 'right';
  orientation?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bodyWidth?: number | string;
  armHeight?: number | string;
  cornerRadii?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

  // Text
  text?: string;
  textColor?: ColorValue;
  fillOpacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  letterSpacing?: string | number;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: string;
  textTransform?: string;
  cutout?: boolean;
  elbowTextPosition?: 'arm' | 'body';
  leftContent?: string;
  rightContent?: string;
  textPadding?: number;
  textOffsetX?: number | string;
  textOffsetY?: number | string;

  // Dimensions provided directly as props (some widgets set these)
  width?: number | string;
  height?: number | string;

  // Interactions & behavior
  button?: ButtonConfig | { enabled?: boolean; actions?: unknown };
  visibility_rules?: unknown;
  visibility_triggers?: unknown;
  state_management?: ElementStateManagementConfig;
  animations?: AnimationsConfig;

  // Element-specific internal hints
  stateIdBase?: string;

  // Entity-driven props (widgets)
  entity?: string | string[] | Array<string | { id: string; [key: string]: unknown }>;
  attribute?: string;
  label?: unknown;
  value?: unknown;
  unit?: unknown;
  appearance?: unknown;
  grid?: { num_lines?: number; fill?: ColorValue; label_fill?: ColorValue };

  // Logger widget specific
  maxLines?: number;
  lineSpacing?: number | string;
  color_cycle?: { color: any; duration: number }[];
  entity_id?: string;

  // Vertical slider specific
  min?: number;
  max?: number;
  spacing?: number;
  top_padding?: number;
  label_height?: number;
  use_floats?: boolean;
}

export interface LayoutConfigOptions {
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

export interface LayoutDimensions {
  width: number;
  height: number;
}

export class LayoutEngine {
  private elements: Map<string, LayoutElement>;
  private groups: Group[];
  private tempSvgContainer?: SVGElement;
  private containerRect?: DOMRect;

  private static sharedTempSvg?: SVGElement;
  private static instanceCount: number = 0;

  constructor() {
    this.elements = new Map();
    this.groups = [];
    
    this.initializeSharedSvgContainer();
    
    LayoutEngine.instanceCount++;
  }

  private initializeSharedSvgContainer(): void {
    if (!LayoutEngine.sharedTempSvg && typeof document !== 'undefined' && document.body) {
      LayoutEngine.sharedTempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      LayoutEngine.sharedTempSvg.style.position = 'absolute';
      LayoutEngine.sharedTempSvg.style.left = '-9999px';
      LayoutEngine.sharedTempSvg.style.top = '-9999px';
      document.body.appendChild(LayoutEngine.sharedTempSvg);
    }
    
    this.tempSvgContainer = LayoutEngine.sharedTempSvg;
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

  setGroups(groups: Group[]): void {
    this.elements.clear();
    this.groups = [];
    groups.forEach(group => this.addGroup(group));
  }

  clearLayout(): void {
    this.elements.clear();
    this.groups = [];
  }

  public getLayoutBounds(): LayoutDimensions {
    let requiredWidth = this.containerRect?.width || 100;
    let requiredHeight = this.containerRect?.height || 50;
    
    if (!this.layoutGroups || this.layoutGroups.length === 0) {
      return { width: requiredWidth, height: requiredHeight };
    }
    
    let maxRight = 0;
    let maxBottom = 0;
    
    this.elements.forEach(el => {
      if (el.layout.calculated) {
        const right = el.layout.x + el.layout.width;
        const bottom = el.layout.y + el.layout.height;
        
        maxRight = Math.max(maxRight, right);
        maxBottom = Math.max(maxBottom, bottom);
      }
    });
    
    requiredWidth = Math.max(maxRight, requiredWidth);
    requiredHeight = Math.max(maxBottom, requiredHeight);
    
    return {
      width: Math.ceil(requiredWidth),
      height: Math.ceil(requiredHeight)
    };
  }

  calculateBoundingBoxes(containerRect: DOMRect, options?: { dynamicHeight?: boolean }): LayoutDimensions {
    try {
      if (!containerRect || containerRect.width === 0 || containerRect.height === 0) {
        return { width: 0, height: 0 };
      }
      
      this.containerRect = containerRect;
      
      this.validateElementReferences();
      
      this.elements.forEach(el => el.resetLayout());
      
      const success = this.calculateLayoutMultiPass();
      
      if (!success) {
        console.warn('LayoutEngine: Some elements could not be calculated in single pass');
        return { width: containerRect.width, height: containerRect.height };
      }

      const firstPassBounds = this.getLayoutBounds();
      const needsSecondPass = options?.dynamicHeight && firstPassBounds.height !== containerRect.height;
      if (!needsSecondPass) {
        return firstPassBounds;
      }

      const updatedRect = new DOMRect(
        containerRect.x,
        containerRect.y,
        containerRect.width,
        firstPassBounds.height
      );
      this.containerRect = updatedRect;
      this.elements.forEach(el => el.resetLayout());
      this.calculateLayoutMultiPass();
      return this.getLayoutBounds();
    } catch (error) {
      if (error instanceof Error) {
        console.error(`LayoutEngine: ${error.message}`);
        return { width: containerRect.width, height: containerRect.height };
      }
      throw error;
    }
  }

  recalculate(containerRect: DOMRect, options?: { dynamicHeight?: boolean }): LayoutDimensions {
    return this.calculateBoundingBoxes(containerRect, options);
  }

  private validateElementReferences(): void {
    const allElementIds = Array.from(this.elements.keys());
    const issues: string[] = [];
    
    for (const [elementId, element] of this.elements) {
      if (element.layoutConfig.anchor?.anchorTo && 
          element.layoutConfig.anchor.anchorTo !== 'container') {
        
        const anchorTo = element.layoutConfig.anchor.anchorTo;
        if (!this.elements.has(anchorTo)) {
          issues.push(`Element '${elementId}' anchor target '${anchorTo}' does not exist`);
        }
      }
      
      if (element.layoutConfig.stretch?.stretchTo1 && 
          element.layoutConfig.stretch.stretchTo1 !== 'canvas' && 
          element.layoutConfig.stretch.stretchTo1 !== 'container') {
        
        const stretchTo1 = element.layoutConfig.stretch.stretchTo1;
        if (!this.elements.has(stretchTo1)) {
          issues.push(`Element '${elementId}' stretch target1 '${stretchTo1}' does not exist`);
        }
      }
      
      if (element.layoutConfig.stretch?.stretchTo2 && 
          element.layoutConfig.stretch.stretchTo2 !== 'canvas' && 
          element.layoutConfig.stretch.stretchTo2 !== 'container') {
        
        const stretchTo2 = element.layoutConfig.stretch.stretchTo2;
        if (!this.elements.has(stretchTo2)) {
          issues.push(`Element '${elementId}' stretch target2 '${stretchTo2}' does not exist`);
        }
      }
    }
    
    if (issues.length > 0) {
      console.error('LayoutEngine: Element reference validation failed:');
      issues.forEach(issue => console.error(`  - ${issue}`));
      console.error('Available elements:', allElementIds.join(', '));
    }
  }

  private calculateLayoutMultiPass(): boolean {
    this.elements.forEach(el => {
      if (!el.intrinsicSize.calculated) {
        el.calculateIntrinsicSize(this.tempSvgContainer || null as unknown as SVGElement);
      }
    });
    
    const sortedElements = this.sortElementsByDependencies();
    const maxPasses = Math.max(1, sortedElements.length);
    
    for (let pass = 0; pass < maxPasses; pass++) {
      let progressMade = false;
      
      for (const el of sortedElements) {
        if (!el.layout.calculated && this.containerRect) {
          const dependencies: string[] = [];
          const canCalculate = el.canCalculateLayout(this.elements, dependencies);
          
          if (canCalculate) {
            el.calculateLayout(this.elements, this.containerRect);
            if (el.layout.calculated) {
              progressMade = true;
            } else {
              console.warn(`LayoutEngine: Element ${el.id} failed to calculate layout despite passing canCalculateLayout`);
            }
          }
        }
      }
      
      if (sortedElements.every(el => el.layout.calculated)) {
        return true;
      }
      if (!progressMade) {
        break;
      }
    }
    
    console.warn('LayoutEngine: Some elements could not be fully calculated after multiple passes');
    return false;
  }

  private sortElementsByDependencies(): LayoutElement[] {
    const elements = Array.from(this.elements.values());
    
    const dependencyGraph = this.buildDependencyGraph(elements);
    
    const circularDeps = this.detectCircularDependencies(elements, dependencyGraph);
    if (circularDeps.length > 0) {
      throw new Error(`LayoutEngine: Circular dependencies detected: ${circularDeps.join(' -> ')}`);
    }
    
    return this.topologicalSort(elements, dependencyGraph);
  }

  private buildDependencyGraph(elements: LayoutElement[]): Map<string, Set<string>> {
    const dependencyGraph = new Map<string, Set<string>>();
    
    for (const el of elements) {
      const dependencies: string[] = el.getDependencies();
      
      const validDependencies = dependencies.filter(dep => {
        if (this.elements.has(dep)) {
          return true;
        }
        console.warn(`LayoutEngine: Element '${el.id}' references non-existent element '${dep}'`);
        return false;
      });
      
      dependencyGraph.set(el.id, new Set(validDependencies));
    }
    
    return dependencyGraph;
  }

  private topologicalSort(elements: LayoutElement[], dependencyGraph: Map<string, Set<string>>): LayoutElement[] {
    const resolved = new Set<string>();
    const result: LayoutElement[] = [];
    
    while (result.length < elements.length) {
      const readyElements = elements.filter(el => {
        if (resolved.has(el.id)) return false;
        
        const dependencies = dependencyGraph.get(el.id) || new Set();
        return Array.from(dependencies).every(dep => resolved.has(dep));
      });
      
      if (readyElements.length === 0) {
        const remaining = elements.filter(el => !resolved.has(el.id));
        const remainingIds = remaining.map(el => el.id);
        throw new Error(`LayoutEngine: Unable to resolve dependencies for elements: ${remainingIds.join(', ')}`);
      }
      
      readyElements.forEach(el => {
        resolved.add(el.id);
        result.push(el);
      });
    }
    
    return result;
  }

  private detectCircularDependencies(elements: LayoutElement[], dependencyGraph: Map<string, Set<string>>): string[] {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const cycle: string[] = [];
    
    const visit = (elementId: string, path: string[]): boolean => {
      if (visiting.has(elementId)) {
        const cycleStart = path.indexOf(elementId);
        return cycleStart >= 0;
      }
      
      if (visited.has(elementId)) {
        return false;
      }
      
      visiting.add(elementId);
      const newPath = [...path, elementId];
      
      const deps = dependencyGraph.get(elementId) || new Set();
      for (const dep of deps) {
        if (visit(dep, newPath)) {
          cycle.push(...newPath.slice(newPath.indexOf(dep)));
          return true;
        }
      }
      
      visiting.delete(elementId);
      visited.add(elementId);
      return false;
    };
    
    for (const el of elements) {
      if (!visited.has(el.id)) {
        if (visit(el.id, [])) {
          break;
        }
      }
    }
    
    return cycle;
  }

  destroy(): void {
    LayoutEngine.instanceCount--;
    
    if (LayoutEngine.instanceCount <= 0 && LayoutEngine.sharedTempSvg && LayoutEngine.sharedTempSvg.parentNode) {
      LayoutEngine.sharedTempSvg.parentNode.removeChild(LayoutEngine.sharedTempSvg);
      LayoutEngine.sharedTempSvg = undefined;
      LayoutEngine.instanceCount = 0;
    }
    
    this.tempSvgContainer = undefined;
    this.clearLayout();
  }

  updateIntrinsicSizesAndRecalculate(
    updatedSizesMap: Map<string, { width: number, height: number }>, 
    containerRect: DOMRect
  ): LayoutDimensions {
    if (!updatedSizesMap.size) {
      return this.getLayoutBounds();
    }
    
    if (!containerRect || containerRect.width === 0 || containerRect.height === 0) {
      return this.getLayoutBounds();
    }
    
    updatedSizesMap.forEach((newSize, id) => {
      const element = this.elements.get(id);
      if (element) {
        element.intrinsicSize.width = newSize.width;
        element.intrinsicSize.height = newSize.height;
        element.intrinsicSize.calculated = true;
      }
    });
    
    return this.calculateBoundingBoxes(containerRect, { dynamicHeight: true });
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
