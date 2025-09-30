import { LayoutElement } from '../layout/elements/element.js';

export class TransformOriginUtils {
  static parseTransformOrigin(
    transformOrigin: string,
    element: LayoutElement
  ): { x: number; y: number } {
    const parts = transformOrigin.split(' ');
    const xPart = parts[0] || 'center';
    const yPart = parts[1] || 'center';

    const x = this.parseOriginComponent(xPart, element.layout.width);
    const y = this.parseOriginComponent(yPart, element.layout.height);

    return { x, y };
  }

  static anchorPointToTransformOriginString(anchorPoint: string): string {
    switch (anchorPoint) {
      case 'top-left': return 'left top';
      case 'topCenter': return 'center top';
      case 'top-right': return 'right top';
      case 'centerLeft': return 'left center';
      case 'center': return 'center center';
      case 'centerRight': return 'right center';
      case 'bottom-left': return 'left bottom';
      case 'bottomCenter': return 'center bottom';
      case 'bottom-right': return 'right bottom';
      default: return 'center center';
    }
  }

  private static parseOriginComponent(component: string, dimension: number): number {
    switch (component) {
      case 'left':
      case 'top':
        return 0;
      case 'center':
        return dimension / 2;
      case 'right':
      case 'bottom':
        return dimension;
      default:
        if (component.endsWith('%')) {
          const percentage = parseFloat(component);
          return (percentage / 100) * dimension;
        } else if (component.endsWith('px')) {
          return parseFloat(component);
        }
        return dimension / 2;
    }
  }
}

export class AnchorPointUtils {
  static getAnchorPointPosition(
    element: LayoutElement,
    anchorPoint: string
  ): { x: number; y: number } {
    const { x, y, width, height } = element.layout;

    switch (anchorPoint) {
      case 'top-left': return { x, y };
      case 'topCenter': return { x: x + width / 2, y };
      case 'top-right': return { x: x + width, y };
      case 'centerLeft': return { x, y: y + height / 2 };
      case 'center': return { x: x + width / 2, y: y + height / 2 };
      case 'centerRight': return { x: x + width, y: y + height / 2 };
      case 'bottom-left': return { x, y: y + height };
      case 'bottomCenter': return { x: x + width / 2, y: y + height };
      case 'bottom-right': return { x: x + width, y: y + height };
      default: return { x, y };
    }
  }
} 