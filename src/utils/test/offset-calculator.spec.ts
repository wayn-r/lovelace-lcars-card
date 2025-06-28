import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OffsetCalculator } from '../../../src/utils/offset-calculator.js';
import { DistanceParser } from '../../../src/utils/animation.js';

vi.mock('../../../src/utils/animation.js', () => ({
  DistanceParser: {
    parse: vi.fn()
  }
}));

describe('OffsetCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTextOffset', () => {
    it('returns 0 for undefined offset', () => {
      const result = OffsetCalculator.calculateTextOffset(undefined, 100);
      expect(result).toBe(0);
      expect(DistanceParser.parse).not.toHaveBeenCalled();
    });

    it('calls DistanceParser.parse with correct parameters for number offset', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(10);
      
      const result = OffsetCalculator.calculateTextOffset(10, 100);
      
      expect(DistanceParser.parse).toHaveBeenCalledWith(
        '10',
        { layout: { width: 100, height: 100 } }
      );
      expect(result).toBe(10);
    });

    it('calls DistanceParser.parse with correct parameters for string offset', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(5);
      
      const result = OffsetCalculator.calculateTextOffset('5%', 100);
      
      expect(DistanceParser.parse).toHaveBeenCalledWith(
        '5%',
        { layout: { width: 100, height: 100 } }
      );
      expect(result).toBe(5);
    });

    it('handles negative offsets', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(-10);
      
      const result = OffsetCalculator.calculateTextOffset(-10, 100);
      
      expect(result).toBe(-10);
    });
  });

  describe('applyTextOffsets', () => {
    it('returns original position when no offsets provided', () => {
      const position = { x: 50, y: 75 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        undefined,
        undefined,
        200,
        150
      );
      
      expect(result).toEqual({ x: 50, y: 75 });
      expect(DistanceParser.parse).not.toHaveBeenCalled();
    });

    it('applies only X offset when Y offset is undefined', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(10);
      
      const position = { x: 50, y: 75 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        10,
        undefined,
        200,
        150
      );
      
      expect(result).toEqual({ x: 60, y: 75 });
      expect(DistanceParser.parse).toHaveBeenCalledTimes(1);
      expect(DistanceParser.parse).toHaveBeenCalledWith(
        '10',
        { layout: { width: 200, height: 200 } }
      );
    });

    it('applies only Y offset when X offset is undefined', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(-5);
      
      const position = { x: 50, y: 75 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        undefined,
        -5,
        200,
        150
      );
      
      expect(result).toEqual({ x: 50, y: 70 });
      expect(DistanceParser.parse).toHaveBeenCalledTimes(1);
      expect(DistanceParser.parse).toHaveBeenCalledWith(
        '-5',
        { layout: { width: 150, height: 150 } }
      );
    });

    it('applies both X and Y offsets', () => {
      vi.mocked(DistanceParser.parse)
        .mockReturnValueOnce(15)  // X offset
        .mockReturnValueOnce(-8); // Y offset
      
      const position = { x: 50, y: 75 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        '10%',
        '-5%',
        200,
        150
      );
      
      expect(result).toEqual({ x: 65, y: 67 });
      expect(DistanceParser.parse).toHaveBeenCalledTimes(2);
      expect(DistanceParser.parse).toHaveBeenNthCalledWith(1,
        '10%',
        { layout: { width: 200, height: 200 } }
      );
      expect(DistanceParser.parse).toHaveBeenNthCalledWith(2,
        '-5%',
        { layout: { width: 150, height: 150 } }
      );
    });

    it('handles mixed numeric and percentage offsets', () => {
      vi.mocked(DistanceParser.parse)
        .mockReturnValueOnce(20)  // X offset (numeric)
        .mockReturnValueOnce(7.5); // Y offset (percentage)
      
      const position = { x: 100, y: 200 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        20,
        '5%',
        300,
        150
      );
      
      expect(result).toEqual({ x: 120, y: 207.5 });
    });

    it('handles zero offsets', () => {
      vi.mocked(DistanceParser.parse).mockReturnValue(0);
      
      const position = { x: 50, y: 75 };
      
      const result = OffsetCalculator.applyTextOffsets(
        position,
        0,
        '0%',
        200,
        150
      );
      
      expect(result).toEqual({ x: 50, y: 75 });
    });
  });
}); 