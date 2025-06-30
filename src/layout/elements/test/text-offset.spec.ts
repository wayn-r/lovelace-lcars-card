import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RectangleElement } from '../rectangle.js';
import { ElbowElement } from '../elbow.js';
import { TextElement } from '../text.js';
import { OffsetCalculator } from '../../../utils/offset-calculator.js';

vi.mock('../../../utils/offset-calculator.js', () => ({
  OffsetCalculator: {
    applyTextOffsets: vi.fn(),
    calculateTextOffset: vi.fn((val, dim) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
          if (val.endsWith('%')) {
              return (parseFloat(val) / 100) * dim;
          }
          return parseFloat(val) || 0;
      }
      return 0;
    }),
  }
}));

describe('Text Offset Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OffsetCalculator Integration', () => {
    it('verifies OffsetCalculator.applyTextOffsets is called with correct parameters', () => {
      const mockApplyTextOffsets = vi.mocked(OffsetCalculator.applyTextOffsets);
      mockApplyTextOffsets.mockReturnValue({ x: 60, y: 85 });

      const element = new RectangleElement(
        'test.rectangle',
        {
          textOffsetX: 10,
          textOffsetY: 5,
          text: 'Test Text'
        },
        {},
        undefined,
        undefined,
        undefined
      );

      element.layout = { x: 10, y: 20, width: 100, height: 50, calculated: true };

      // Call the protected method through the public render method
      element.render();

      expect(mockApplyTextOffsets).toHaveBeenCalledWith(
        { x: 60, y: 45 }, // Default center position: x + width/2, y + height/2
        10,
        5,
        100,
        50
      );
    });

    it('works with undefined offsets', () => {
      const mockApplyTextOffsets = vi.mocked(OffsetCalculator.applyTextOffsets);
      mockApplyTextOffsets.mockReturnValue({ x: 60, y: 45 });

      const element = new RectangleElement(
        'test.rectangle',
        { text: 'Test Text' },
        {},
        undefined,
        undefined,
        undefined
      );

      element.layout = { x: 10, y: 20, width: 100, height: 50, calculated: true };

      element.render();

      expect(mockApplyTextOffsets).toHaveBeenCalledWith(
        { x: 60, y: 45 },
        undefined,
        undefined,
        100,
        50
      );
    });

    it('works with ElbowElement offsets', () => {
      const mockApplyTextOffsets = vi.mocked(OffsetCalculator.applyTextOffsets);
      mockApplyTextOffsets.mockReturnValue({ x: 85, y: 35 });

      const element = new ElbowElement(
        'test.elbow',
        {
          textOffsetX: '5%',
          textOffsetY: -10,
          text: 'Test Text',
          orientation: 'top-left',
          elbowTextPosition: 'arm',
          bodyWidth: 30,
          armHeight: 20
        },
        {},
        undefined,
        undefined,
        undefined
      );

      element.layout = { x: 0, y: 0, width: 100, height: 60, calculated: true };

      element.render();

      expect(mockApplyTextOffsets).toHaveBeenCalledWith(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        '5%',
        -10,
        100,
        60
      );
    });

    it('works with TextElement offsets', () => {
      const mockApplyTextOffsets = vi.mocked(OffsetCalculator.applyTextOffsets);
      mockApplyTextOffsets.mockReturnValue({ x: 25, y: 35 });

      const element = new TextElement(
        'test.text',
        {
          textOffsetX: 15,
          textOffsetY: -5,
          text: 'Test Text',
          textAnchor: 'start'
        },
        {},
        undefined,
        undefined,
        undefined
      );

      element.layout = { x: 10, y: 20, width: 80, height: 30, calculated: true };

      element.renderShape();
      
      expect(mockApplyTextOffsets).toHaveBeenCalledWith(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        15,
        -5,
        80,
        30
      );
    });

    it('handles edge cases with zero dimensions', () => {
      const mockApplyTextOffsets = vi.mocked(OffsetCalculator.applyTextOffsets);
      mockApplyTextOffsets.mockReturnValue({ x: 5, y: -3 });

      const element = new RectangleElement(
        'test.rectangle',
        {
          textOffsetX: 5,
          textOffsetY: -3,
          text: 'Test'
        },
        {},
        undefined,
        undefined,
        undefined
      );

      element.layout = { x: 0, y: 0, width: 0, height: 0, calculated: true };

      element.render();

      expect(mockApplyTextOffsets).toHaveBeenCalledWith(
        { x: 0, y: 0 },
        5,
        -3,
        0,
        0
      );
    });
  });
}); 