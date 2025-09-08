import type { LayoutElement } from '../../layout/elements/element.js';
import type { ElementGroupingResult, ElementGroup } from './morph-element-matcher.js';
import { Diagnostics } from '../diagnostics.js';

const logger = Diagnostics.create('MorphDebug');

export interface MorphDebugOptions {
  showGroupLines: boolean;
  pauseForUserInteraction: boolean;
}

export class MorphDebugger {
  private static readonly _defaultOptions: MorphDebugOptions = {
    showGroupLines: true,
    pauseForUserInteraction: true
  };

  static async visualizeElementGroups(
    svgRoot: SVGSVGElement,
    elementGroupingResult: ElementGroupingResult,
    options: Partial<MorphDebugOptions> = {}
  ): Promise<void> {
    const mergedOptions = { ...this._defaultOptions, ...options };
    
    if (!mergedOptions.showGroupLines) {
      return;
    }

    const groupOverlayElements = this._createGroupVisualizationLines(svgRoot, elementGroupingResult);
    
    if (mergedOptions.pauseForUserInteraction) {
      await this._waitForUserInteraction(svgRoot);
    }
    
    this._cleanupGroupVisualizationElements(groupOverlayElements);
  }

  private static _createGroupVisualizationLines(
    svgRoot: SVGSVGElement,
    elementGroupingResult: ElementGroupingResult
  ): SVGElement[] {
    const visualizationElements: SVGElement[] = [];
    const groupsWithMultipleElements = this._filterGroupsWithMultipleElements(elementGroupingResult);
    
    groupsWithMultipleElements.forEach(group => {
      const groupLine = this._createGroupMeanLine(group);
      svgRoot.appendChild(groupLine);
      visualizationElements.push(groupLine);
    });
    
    logger.debug(`Created ${visualizationElements.length} group visualization lines`);
    return visualizationElements;
  }

  private static _filterGroupsWithMultipleElements(elementGroupingResult: ElementGroupingResult): ElementGroup[] {
    const allGroups = [...elementGroupingResult.horizontalGroups, ...elementGroupingResult.verticalGroups];
    return allGroups.filter(group => group.elements.length > 1);
  }

  private static _createGroupMeanLine(group: ElementGroup): SVGLineElement {
    const { groupType, meanCoordinate, elements } = group;
    const lineCoordinates = this._calculateLineCoordinates(groupType, meanCoordinate, elements);
    
    return this._buildSvgLineElement(group.id, lineCoordinates);
  }

  private static _calculateLineCoordinates(
    groupType: 'horizontal' | 'vertical',
    meanCoordinate: number,
    elements: LayoutElement[]
  ): { x1: number; y1: number; x2: number; y2: number } {
    if (elements.length === 0) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }

    const elementExtent = this._calculateElementExtent(elements, groupType);

    if (groupType === 'horizontal') {
      return {
        x1: elementExtent.min,
        y1: meanCoordinate,
        x2: elementExtent.max,
        y2: meanCoordinate
      };
    } else {
      return {
        x1: meanCoordinate,
        y1: elementExtent.min,
        x2: meanCoordinate,
        y2: elementExtent.max
      };
    }
  }

  private static _calculateElementExtent(
    elements: LayoutElement[],
    groupType: 'horizontal' | 'vertical'
  ): { min: number; max: number } {
    let minExtent = Number.MAX_VALUE;
    let maxExtent = Number.MIN_VALUE;

    elements.forEach(element => {
      const { x, y, width, height } = element.layout;
      
      if (groupType === 'horizontal') {
        minExtent = Math.min(minExtent, x);
        maxExtent = Math.max(maxExtent, x + width);
      } else {
        minExtent = Math.min(minExtent, y);
        maxExtent = Math.max(maxExtent, y + height);
      }
    });

    return { min: minExtent, max: maxExtent };
  }

  private static _buildSvgLineElement(
    groupId: string,
    coordinates: { x1: number; y1: number; x2: number; y2: number }
  ): SVGLineElement {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', `group-debug-line-${groupId}`);
    line.setAttribute('x1', coordinates.x1.toString());
    line.setAttribute('y1', coordinates.y1.toString());
    line.setAttribute('x2', coordinates.x2.toString());
    line.setAttribute('y2', coordinates.y2.toString());
    line.setAttribute('stroke', 'green');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('pointer-events', 'none');
    line.style.opacity = '0.8';
    
    return line;
  }

  private static _cleanupGroupVisualizationElements(visualizationElements: SVGElement[]): void {
    visualizationElements.forEach(element => {
      try {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch (error) {
        logger.warn('Failed to cleanup visualization element', error);
      }
    });
  }

  private static async _waitForUserInteraction(svgRoot: SVGSVGElement): Promise<void> {
    return new Promise<void>((resolve) => {
      const interactionIndicator = this._createUserInteractionIndicator(svgRoot);
      
      const handleUserInteraction = (event: Event) => {
        this._cleanupInteractionIndicator(interactionIndicator);
        this._removeInteractionListeners(handleUserInteraction, handleKeyboardInteraction);
        resolve();
      };
      
      const handleKeyboardInteraction = (event: KeyboardEvent) => {
        handleUserInteraction(event);
      };
      
      this._addInteractionListeners(handleUserInteraction, handleKeyboardInteraction);
    });
  }

  private static _createUserInteractionIndicator(svgRoot: SVGSVGElement): SVGElement {
    const indicatorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    indicatorGroup.setAttribute('id', 'morph-debug-interaction-indicator');
    
    const background = this._createIndicatorBackground();
    const text = this._createIndicatorText();
    
    indicatorGroup.appendChild(background);
    indicatorGroup.appendChild(text);
    svgRoot.appendChild(indicatorGroup);
    
    return indicatorGroup;
  }

  private static _createIndicatorBackground(): SVGRectElement {
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', '5');
    background.setAttribute('y', '10');
    background.setAttribute('width', '300');
    background.setAttribute('height', '20');
    background.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
    background.setAttribute('rx', '3');
    background.style.pointerEvents = 'none';
    
    return background;
  }

  private static _createIndicatorText(): SVGTextElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '10');
    text.setAttribute('y', '25');
    text.setAttribute('fill', 'green');
    text.setAttribute('font-family', 'monospace');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.style.pointerEvents = 'none';
    text.textContent = 'Click anywhere to continue morph animation...';
    
    return text;
  }

  private static _cleanupInteractionIndicator(indicator: SVGElement): void {
    try {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    } catch (error) {
      logger.warn('Failed to cleanup interaction indicator', error);
    }
  }

  private static _addInteractionListeners(
    clickHandler: (event: Event) => void,
    keyHandler: (event: KeyboardEvent) => void
  ): void {
    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
  }

  private static _removeInteractionListeners(
    clickHandler: (event: Event) => void,
    keyHandler: (event: KeyboardEvent) => void
  ): void {
    document.removeEventListener('click', clickHandler);
    document.removeEventListener('keydown', keyHandler);
  }
}
