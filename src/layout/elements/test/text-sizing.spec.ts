import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextElement } from '../text.js';
import { FontManager } from '../../../utils/font-manager.js';

// Mock FontManager
vi.mock('../../../utils/font-manager.js', () => ({
  FontManager: {
    getFontMetrics: vi.fn(),
    measureTextWidth: vi.fn(),
  },
}));

describe('TextElement - Height/Width Override Behavior', () => {
  let mockSvgContainer: SVGElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock SVG container
    mockSvgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGElement;
    
    // Setup default FontManager mocks
    (FontManager.getFontMetrics as any).mockReturnValue({
      capHeight: 0.7,
      top: -0.8,
      bottom: 0.2,
      ascent: -0.75,
      descent: 0.25
    });
    
    (FontManager.measureTextWidth as any).mockReturnValue(100);
  });

  describe('Height overrides fontSize', () => {
    it('should calculate fontSize from layout.height when specified as number', () => {
      const textElement = new TextElement(
        'height-override-test',
        { text: 'Test Text', fontFamily: 'Arial' },
        { height: 35 } // Numeric height in layoutConfig
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Expected fontSize = height / capHeightRatio = 35 / 0.7 = 50
      expect(textElement.props.fontSize).toBe(35 / 0.7);
      expect(FontManager.getFontMetrics).toHaveBeenCalledWith('Arial', 'normal');
    });

    it('should use fallback calculation when getFontMetrics returns null', () => {
      (FontManager.getFontMetrics as any).mockReturnValue(null);
      
      const textElement = new TextElement(
        'height-fallback-test',
        { text: 'Test Text' },
        { height: 40 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Expected fontSize = height * 0.8 = 40 * 0.8 = 32
      expect(textElement.props.fontSize).toBe(32);
    });

    it('should preserve explicit fontSize when layout.height is percentage string', () => {
      const textElement = new TextElement(
        'percentage-height-test',
        { text: 'Test Text', fontSize: 18 },
        { height: '50%' } // Percentage height should not override
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.props.fontSize).toBe(18); // Should preserve original
    });

    it('should preserve explicit fontSize when no layout.height specified', () => {
      const textElement = new TextElement(
        'no-height-test',
        { text: 'Test Text', fontSize: 24 },
        {} // No height specified
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.props.fontSize).toBe(24);
    });

    it('should maintain backwards compatibility with props.height (top_header case)', () => {
      const textElement = new TextElement(
        'props-height-test',
        { text: 'Test Text', height: 30, fontFamily: 'Antonio' }, // Height in props
        {} // No layout height
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Should still use props.height for fontSize calculation
      expect(textElement.props.fontSize).toBe(30 / 0.7);
      expect(FontManager.getFontMetrics).toHaveBeenCalledWith('Antonio', 'normal');
    });
  });

  describe('Width overrides letterSpacing', () => {
    beforeEach(() => {
      // Mock measureTextWidth to return different values for different calls
      (FontManager.measureTextWidth as any)
        .mockReturnValueOnce(80) // Base width with normal spacing
        .mockReturnValue(120); // Final width measurement
    });

    it('should calculate letterSpacing from layout.width when specified as number', () => {
      const textElement = new TextElement(
        'width-override-test',
        { text: 'HELLO', fontSize: 16, fontFamily: 'Arial' },
        { width: 120 } // Numeric width in layoutConfig
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Expected calculation:
      // baseWidth = 80, targetWidth = 120, gapCount = 4 (5 chars - 1)
      // spacingPx = (120 - 80) / 4 = 10
      expect(textElement.props.letterSpacing).toBe(10);
      
      // Should measure with normal spacing first, then with calculated spacing
      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('HELLO', {
        fontFamily: 'Arial',
        fontWeight: 'normal',
        fontSize: 16,
        letterSpacing: 'normal',
        textTransform: undefined,
      });
    });

    it('should clamp letterSpacing to reasonable bounds', () => {
      // Test maximum clamp
      (FontManager.measureTextWidth as any).mockReturnValueOnce(50);
      
      const textElement = new TextElement(
        'width-clamp-max-test',
        { text: 'AB', fontSize: 16 },
        { width: 1000 } // Very wide target
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // spacingPx = (1000 - 50) / 1 = 950, but should be clamped to MAX_LETTER_SPACING (20)
      expect(textElement.props.letterSpacing).toBe(20);
    });

    it('should clamp negative letterSpacing to minimum bound', () => {
      // Test minimum clamp
      (FontManager.measureTextWidth as any).mockReturnValueOnce(200);
      
      const textElement = new TextElement(
        'width-clamp-min-test',
        { text: 'WIDE', fontSize: 16 },
        { width: 50 } // Very narrow target
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // spacingPx = (50 - 200) / 3 = -50, but should be clamped to MIN_LETTER_SPACING (-4)
      expect(textElement.props.letterSpacing).toBe(-4);
    });

    it('should preserve explicit letterSpacing when layout.width is percentage string', () => {
      const textElement = new TextElement(
        'percentage-width-test',
        { text: 'Test Text', letterSpacing: '2px' },
        { width: '75%' } // Percentage width should not override
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.props.letterSpacing).toBe('2px'); // Should preserve original
    });

    it('should preserve explicit letterSpacing when no layout.width specified', () => {
      const textElement = new TextElement(
        'no-width-test',
        { text: 'Test Text', letterSpacing: '1px' },
        {} // No width specified
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.props.letterSpacing).toBe('1px');
    });

    it('should skip letterSpacing calculation for single character text', () => {
      const textElement = new TextElement(
        'single-char-test',
        { text: 'A', letterSpacing: 'normal' },
        { width: 100 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Should preserve original letterSpacing for single character
      expect(textElement.props.letterSpacing).toBe('normal');
    });

    it('should skip letterSpacing calculation for empty text', () => {
      const textElement = new TextElement(
        'empty-text-test',
        { text: '', letterSpacing: 'normal' },
        { width: 100 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Should preserve original letterSpacing for empty text
      expect(textElement.props.letterSpacing).toBe('normal');
    });
  });

  describe('Combined height and width overrides', () => {
    beforeEach(() => {
      (FontManager.measureTextWidth as any)
        .mockReturnValueOnce(90) // Base width measurement
        .mockReturnValue(110); // Final width measurement
    });

    it('should apply both fontSize and letterSpacing overrides together', () => {
      const textElement = new TextElement(
        'combined-override-test',
        { text: 'TEST', fontFamily: 'Arial' },
        { height: 28, width: 110 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Height should calculate fontSize
      expect(textElement.props.fontSize).toBe(28 / 0.7);
      
      // Width should calculate letterSpacing
      // gapCount = 3, spacingPx = (110 - 90) / 3 = 6.67 (approximately)
      expect(textElement.props.letterSpacing).toBeCloseTo(6.67, 1);
    });

    it('should use calculated fontSize in letterSpacing calculation', () => {
      const textElement = new TextElement(
        'fontSize-in-spacing-test',
        { text: 'HELLO', fontFamily: 'Arial' },
        { height: 35, width: 150 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      const expectedFontSize = 35 / 0.7;
      
      // Should use the calculated fontSize (not original) in measureTextWidth call
      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('HELLO', expect.objectContaining({
        fontSize: expectedFontSize,
        letterSpacing: 'normal',
      }));
    });
  });

  describe('Intrinsic size calculation', () => {
    it('should set intrinsicSize.height to layout.height when specified', () => {
      const textElement = new TextElement(
        'intrinsic-height-test',
        { text: 'Test' },
        { height: 42 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.intrinsicSize.height).toBe(42);
    });

    it('should use fontSize * 1.2 for intrinsicSize.height when no layout.height', () => {
      const textElement = new TextElement(
        'intrinsic-height-fallback-test',
        { text: 'Test', fontSize: 20 },
        {}
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.intrinsicSize.height).toBe(24); // 20 * 1.2
    });

    it('should measure text width with final calculated letterSpacing', () => {
      (FontManager.measureTextWidth as any)
        .mockReturnValueOnce(60) // Base measurement
        .mockReturnValue(80); // Final measurement with spacing
      
      const textElement = new TextElement(
        'final-width-test',
        { text: 'ABC', fontSize: 16 },
        { width: 80 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.intrinsicSize.width).toBe(80);
      
      // Should be called twice: once for base measurement, once for final
      expect(FontManager.measureTextWidth).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases and regression tests', () => {
    it('should handle explicit dimensions path correctly', () => {
      const textElement = new TextElement(
        'explicit-dims-test',
        { width: 200, height: 50, text: 'Test' }, // Props width/height without fontSize
        {}
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Should use explicit dimensions path
      expect(textElement.intrinsicSize.width).toBe(200);
      expect(textElement.intrinsicSize.height).toBe(50);
      expect(textElement.intrinsicSize.calculated).toBe(true);
    });

    it('should handle textTransform in width calculations', () => {
      const textElement = new TextElement(
        'text-transform-test',
        { text: 'hello', textTransform: 'uppercase' },
        { width: 100 }
      );

      textElement.calculateIntrinsicSize(mockSvgContainer);

      // Should pass textTransform to measureTextWidth
      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('hello', expect.objectContaining({
        textTransform: 'uppercase',
      }));
    });
  });
}); 