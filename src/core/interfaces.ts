import { LayoutElementProps, LayoutState, IntrinsicSize, LayoutConfigOptions } from "../layout/engine.js";
import { HomeAssistant } from "custom-card-helpers";
import { SVGTemplateResult } from 'lit';
import { ComputedElementColors } from '../utils/color.js';

/**
 * Core layout interface - handles element sizing and positioning
 */
export interface ILayoutElement {
  id: string;
  props: LayoutElementProps;
  layoutConfig: LayoutConfigOptions;
  layout: LayoutState;
  intrinsicSize: IntrinsicSize;
  
  // Layout calculation methods
  resetLayout(): void;
  calculateIntrinsicSize(container: SVGElement): void;
  canCalculateLayout(elementsMap: Map<string, ILayoutElement>, dependencies?: string[]): boolean;
  calculateLayout(elementsMap: Map<string, ILayoutElement>, containerRect: DOMRect): void;
  
  // Home Assistant integration
  updateHass(hass?: HomeAssistant): void;
  entityChangesDetected(hass: HomeAssistant): boolean;
  
  // Lifecycle
  cleanup(): void;
}

/**
 * Rendering interface - handles SVG generation and visual representation
 */
export interface IRenderer {
  id: string;
  props: LayoutElementProps;
  layout: LayoutState;
  
  // Core rendering
  render(): SVGTemplateResult | null;
  renderDefs?(): SVGTemplateResult[];
  
  // Shape rendering
  renderShape(): SVGTemplateResult | null;
  
  // Color resolution
  resolveColors(): ComputedElementColors;
  
  // Animation support
  cleanupAnimations(): void;
}

/**
 * Interaction interface - handles user interactions and state changes
 */
export interface IInteractive {
  id: string;
  
  // Interactive state
  isHovering: boolean;
  isActive: boolean;
  
  // Event handling
  setupInteractiveListeners(): void;
  cleanup(): void;
  
  // State management
  hasInteractiveFeatures(): boolean;
  
  // Callbacks
  getShadowElement?: (id: string) => Element | null;
  requestUpdateCallback?: () => void;
}

/**
 * Animation interface - handles element animations
 */
export interface IAnimatable {
  id: string;
  
  // Animation methods
  animate(property: string, value: any, duration?: number): void;
  cleanupAnimations(): void;
  
  // Animation context
  getAnimationContext?(): any;
}

/**
 * Combined interface for elements that need all capabilities
 */
export interface ILayoutRendererElement extends ILayoutElement, IRenderer {
  // Combined interface - no additional methods needed
}

/**
 * Full element interface with all capabilities
 */
export interface IFullElement extends ILayoutElement, IRenderer, IInteractive, IAnimatable {
  // Full capability element - no additional methods needed
} 