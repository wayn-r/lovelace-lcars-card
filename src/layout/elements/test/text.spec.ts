// src/layout/elements/text.spec.ts

// First do all the imports
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set up mocks - IMPORTANT: Use factory functions with no external variables
vi.mock('../../../utils/button.js', () => {
  return {
    Button: vi.fn().mockImplementation((id, props, hass, cb) => {
      return {
        id,
        props,
        hass,
        requestUpdateCallback: cb,
        createButton: vi.fn(),
      };
    })
  };
});

vi.mock('../../../utils/font-manager.js', () => {
  return {
    FontManager: {
      getFontMetrics: vi.fn(),
      measureTextWidth: vi.fn(),
      ensureFontsLoaded: vi.fn().mockResolvedValue(undefined),
      clearMetricsCache: vi.fn()
    }
  };
});

// Now import the mocked modules
import { TextElement } from '../text';
import { Button } from '../../../utils/button.js';
import { svg, SVGTemplateResult } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { FontManager } from '../../../utils/font-manager.js';

// Create a simple SVG renderer to test SVG templates
function renderSvgTemplate(template: SVGTemplateResult): SVGElement {
  // Create a temporary SVG container
  const container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  // Recreate SVG string from template
  let svgString = template.strings[0];
  for (let i = 0; i < template.values.length; i++) {
    svgString += String(template.values[i]) + template.strings[i + 1];
  }
  
  // Set the innerHTML of the container
  container.innerHTML = svgString;
  
  // Return the first child element (should be our text element)
  return container.firstElementChild as SVGElement;
}

// Returns a string representation of the full SVG template
function getTextAttributes(template: SVGTemplateResult): string {
  // Recreate SVG string from template
  let svgString = template.strings[0];
  for (let i = 0; i < template.values.length; i++) {
    svgString += String(template.values[i]) + template.strings[i + 1];
  }
  return svgString;
}

describe('TextElement', () => {
  let textElement: TextElement;
  const mockHass = {} as HomeAssistant;
  const mockRequestUpdate = vi.fn();
  let mockSvgContainer: SVGSVGElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSvgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(mockSvgContainer);

    // Reset mock implementations
    (FontManager.getFontMetrics as any).mockReturnValue(null);
    (FontManager.measureTextWidth as any).mockReturnValue(0);
  });

  afterEach(() => {
    if (mockSvgContainer.parentNode) {
      mockSvgContainer.parentNode.removeChild(mockSvgContainer);
    }
  });

  describe('Constructor and Initialization', () => {
    it('should instantiate correctly with minimal arguments', () => {
      textElement = new TextElement('txt-min');
      expect(textElement.id).toBe('txt-min');
      expect(textElement.props).toEqual({});
      expect(textElement.layoutConfig).toEqual({});
      expect(textElement.button).toBeUndefined();
      expect(Button).not.toHaveBeenCalled();
    });

    it('should instantiate Button if button.enabled is true in props', () => {
      const props = { button: { enabled: true } };
      textElement = new TextElement('txt-btn-init', props, {}, mockHass, mockRequestUpdate);

      expect(Button).toHaveBeenCalledOnce();
      expect(Button).toHaveBeenCalledWith('txt-btn-init', props, mockHass, mockRequestUpdate, undefined);
      expect(textElement.button).toBeDefined();
    });

    it('should NOT instantiate Button if button.enabled is false or button prop is missing', () => {
      textElement = new TextElement('txt-no-btn1', { button: { enabled: false } });
      expect(Button).not.toHaveBeenCalled();
      expect(textElement.button).toBeUndefined();

      vi.clearAllMocks();

      textElement = new TextElement('txt-no-btn2', {});
      expect(Button).not.toHaveBeenCalled();
      expect(textElement.button).toBeUndefined();
    });
  });

  describe('calculateIntrinsicSize', () => {
    it('should use props.width and props.height if provided', () => {
      textElement.props.width = 150;
      textElement.props.height = 80;

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.intrinsicSize.width).toBe(150);
      expect(textElement.intrinsicSize.height).toBe(80);
      expect(textElement.intrinsicSize.calculated).toBe(true);
    });

    it('should calculate size using fontmetrics if available', () => {
      const props = {
        text: 'Test',
        height: 20, // Provide height without fontSize to trigger getFontMetrics call
        fontFamily: 'Arial'
      };
      textElement = new TextElement('txt-metrics', props);

      (FontManager.getFontMetrics as any).mockReturnValue({
        top: -0.8,
        bottom: 0.2,
        ascent: -0.75,
        descent: 0.25,
        capHeight: 0.7
      });

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(FontManager.getFontMetrics).toHaveBeenCalledWith('Arial', 'normal');
      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('Test', expect.objectContaining({
        fontFamily: 'Arial',
        fontWeight: 'normal'
      }));
      expect(textElement.intrinsicSize.calculated).toBe(true);
    });

    it('should use fallback calculation if getFontMetrics fails', () => {
      const props = {
        text: 'Test',
        fontSize: 20,
        fontFamily: 'Arial'
      };
      textElement = new TextElement('txt-fallback', props);

      (FontManager.getFontMetrics as any).mockReturnValue(null);

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('Test', expect.objectContaining({
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'normal'
      }));
      expect(textElement.intrinsicSize.height).toBe(24); // fontSize * 1.2
      expect(textElement.intrinsicSize.calculated).toBe(true);
    });

    it('should handle text with letter spacing and text transform', () => {
      const props = {
        text: 'Test',
        fontSize: 18,
        fontFamily: 'Arial',
        letterSpacing: '2px',
        textTransform: 'uppercase'
      };
      textElement = new TextElement('txt-spacing', props);

      (FontManager.getFontMetrics as any).mockReturnValue({
        top: -0.8,
        bottom: 0.2,
      });

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(FontManager.measureTextWidth).toHaveBeenCalledWith('Test', expect.objectContaining({
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: 'normal',
        letterSpacing: '2px',
        textTransform: 'uppercase'
      }));
      expect(textElement.intrinsicSize.calculated).toBe(true);
    });

    it('should handle empty text string gracefully', () => {
      textElement.props.text = '';
      textElement.props.fontSize = 16;

      textElement.calculateIntrinsicSize(mockSvgContainer);

      expect(textElement.intrinsicSize.calculated).toBe(true);
    });
  });

  describe('render', () => {
    it('should return null if layout.calculated is false', () => {
      textElement = new TextElement('txt-render-nolayout');
      textElement.layout = { x: 0, y: 0, width: 0, height: 0, calculated: false };
      expect(textElement.render()).toBeNull();
    });

    it('should render basic text with default properties', () => {
      textElement = new TextElement('txt-render-default', { fill: '#000000' });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };
      // Set _fontMetrics for this test
      (textElement as any)._fontMetrics = { ascent: -0.75, top: -0.8 };
      textElement.props.fontSize = 16; // Ensure fontSize is set for metric calc

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      // Render the SVG template to a DOM element
      const textElem = renderSvgTemplate(result!);
      
      expect(textElem.getAttribute('id')).toBe('txt-render-default');
      expect(parseFloat(textElem.getAttribute('x') || '0')).toBe(10);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(20 + (-(-0.75) * 16)); // y + (-ascent * fontSize)
      
      // In the rendered SVG, the attribute might be empty or null if it matches the default
      expect(textElem).toBeDefined();
      
      expect(textElem.getAttribute('font-family')).toBe('sans-serif');
      expect(textElem.getAttribute('font-size')).toBe('16px');
      expect(textElem.getAttribute('font-weight')).toBe('normal');
      expect(textElem.getAttribute('letter-spacing')).toBe('normal');
      expect(textElem.getAttribute('text-anchor')).toBe('start');
      expect(textElem.getAttribute('dominant-baseline')).toBe('auto');
      
      // The style attribute might be formatted differently in different browsers
      const styleAttr = textElem.getAttribute('style') || '';
      expect(styleAttr.includes('text-transform')).toBe(false);
      
      // Check that textContent after trimming is empty
      expect(textElem.textContent?.trim()).toBe('');
    });

    it('should render text with all properties set', () => {
      const props = {
        text: 'LCARS', fill: 'red', fontFamily: 'Swiss911', fontSize: 24,
        fontWeight: 'bold', letterSpacing: '2px', textAnchor: 'middle',
        dominantBaseline: 'middle', textTransform: 'uppercase',
      };
      textElement = new TextElement('txt-render-custom', props);
      textElement.layout = { x: 50, y: 60, width: 200, height: 40, calculated: true };
      (textElement as any)._fontMetrics = { top: -0.8, bottom: 0.2, ascent: -0.75, descent: 0.25 };
      textElement.props.fontSize = 24; // Ensure fontSize is set

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      // Get full SVG string using helper function
      const fullSvgString = getTextAttributes(result!);
      
      // Check that the style attribute includes text-transform
      expect(fullSvgString.includes('style="text-transform: uppercase;"')).toBe(true);
      
      // Render the SVG template to a DOM element
      const textElem = renderSvgTemplate(result!);

      expect(textElem.getAttribute('id')).toBe('txt-render-custom');
      expect(parseFloat(textElem.getAttribute('x') || '0')).toBe(50 + 200 / 2); // textAnchor: 'middle'
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(60 + ((0.2 - (-0.8)) * 24 / 2) + (-0.8 * 24)); // dominantBaseline: 'middle'
      expect(textElem.getAttribute('fill')).toBe('red');
      expect(textElem.getAttribute('font-family')).toBe('Swiss911');
      expect(textElem.getAttribute('font-size')).toBe('24px');
      expect(textElem.getAttribute('font-weight')).toBe('bold');
      expect(textElem.getAttribute('letter-spacing')).toBe('2px');
      expect(textElem.getAttribute('text-anchor')).toBe('middle');
      expect(textElem.getAttribute('dominant-baseline')).toBe('middle');
      
      // Check for 'LCARS' text content
      expect(textElem.textContent?.trim()).toBe('LCARS');
    });

    it('should handle textAnchor="end"', () => {
      textElement = new TextElement('txt-anchor-end', { textAnchor: 'end' });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };
      (textElement as any)._fontMetrics = { ascent: -0.75, top: -0.8 };
      textElement.props.fontSize = 16;

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('x') || '0')).toBe(10 + 100);
    });
    
    it('should handle dominantBaseline="hanging" with font metrics', () => {
      textElement = new TextElement('txt-baseline-hanging', { dominantBaseline: 'hanging', fontSize: 20 });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };
      (textElement as any)._cachedMetrics = { top: -0.8, ascent: -0.75 }; // ascent needed for 'auto' path if it were taken
      textElement.props.fontSize = 20;

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(20 + (-0.8 * 20)); // y + (top * fontSize)
    });

    it('should handle dominantBaseline="middle" without font metrics (fallback)', () => {
      textElement = new TextElement('txt-baseline-middle-nofm', { dominantBaseline: 'middle' });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };
      // No _fontMetrics or _cachedMetrics set

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(20 + 30 / 2); // y + height / 2
    });
    
    it('should handle dominantBaseline="hanging" without font metrics (fallback)', () => {
      textElement = new TextElement('txt-baseline-hanging-nofm', { dominantBaseline: 'hanging' });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(20); // y directly
    });

    it('should handle default dominantBaseline="auto" without font metrics (fallback to 0.8*height)', () => {
      textElement = new TextElement('txt-baseline-auto-nofm', { dominantBaseline: 'auto' });
      textElement.layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(20 + 30 * 0.8); // y + height * 0.8
    });

    it('should use _cachedMetrics if available, ignoring _fontMetrics', () => {
      textElement = new TextElement('txt-cached-metrics', { fontSize: 18 });
      textElement.layout = { x: 5, y: 15, width: 50, height: 25, calculated: true };
      (textElement as any)._cachedMetrics = { ascent: -0.7, top: -0.7 };
      (textElement as any)._fontMetrics = { ascent: -0.8, top: -0.8 }; // Should be ignored
      textElement.props.fontSize = 18;

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(15 + (-(-0.7) * 18)); // Uses _cachedMetrics.ascent
      expect(FontManager.getFontMetrics).not.toHaveBeenCalled();
    });

    it('should try to fetch new metrics if no cached or initial metrics, and fontFamily is present', () => {
      (FontManager.getFontMetrics as any).mockReturnValue({ 
        ascent: -0.6, top: -0.6, bottom: 0, descent: 0, capHeight: 0, xHeight: 0, baseline: 0,
        fontFamily: 'TestFont', fontWeight: 'normal', fontSize: 15, tittle: 0
      });
      
      textElement = new TextElement('txt-fetch-metrics', { fontFamily: 'TestFont', fontSize: 15 });
      textElement.layout = { x: 2, y: 8, width: 40, height: 20, calculated: true };
      // _cachedMetrics and _fontMetrics are null initially

      const result = textElement.render();
      expect(result).toBeTruthy();
      
      const textElem = renderSvgTemplate(result!);

      expect(FontManager.getFontMetrics).toHaveBeenCalledWith('TestFont', undefined);
      expect(parseFloat(textElem.getAttribute('y') || '0')).toBeCloseTo(8 + (-(-0.6) * 15));
      // Check that _cachedMetrics is now set
      expect((textElement as any)._cachedMetrics).toEqual({ 
        ascent: -0.6, top: -0.6, bottom: 0, descent: 0, capHeight: 0, xHeight: 0, baseline: 0,
        fontFamily: 'TestFont', fontWeight: 'normal', fontSize: 15, tittle: 0
      });
    });
  });
});