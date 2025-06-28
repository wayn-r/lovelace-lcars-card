import { DistanceParser } from './animation.js';

export class OffsetCalculator {
  static calculateTextOffset(
    offsetValue: number | string | undefined, 
    elementDimension: number
  ): number {
    if (offsetValue === undefined) return 0;
    
    return DistanceParser.parse(
      offsetValue.toString(), 
      { layout: { width: elementDimension, height: elementDimension } }
    );
  }
  
  static applyTextOffsets(
    position: { x: number; y: number },
    offsetX: number | string | undefined,
    offsetY: number | string | undefined,
    elementWidth: number,
    elementHeight: number
  ): { x: number; y: number } {
    const dx = this.calculateTextOffset(offsetX, elementWidth);
    const dy = this.calculateTextOffset(offsetY, elementHeight);
    return { x: position.x + dx, y: position.y + dy };
  }
} 