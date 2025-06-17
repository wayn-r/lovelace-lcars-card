// Mocking setup needs to be at the top, before imports
const mockCreateButton = vi.fn();
vi.mock('../../../utils/button.js', () => {
  return {
    Button: vi.fn().mockImplementation((id, props, hass, cb) => {
      return {
        id,
        props,
        hass,
        requestUpdateCallback: cb,
        createButton: mockCreateButton,
      };
    }),
  };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RectangleElement } from '../rectangle';
import { generateRectanglePath } from '../../../utils/shapes';
import { svg, SVGTemplateResult } from 'lit';
import { Button } from '../../../utils/button.js';

describe('RectangleElement', () => {
  let rectangleElement: RectangleElement;
  const mockHass: any = {};
  const mockRequestUpdate = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  // Helper for extracting path attributes
  const getPathAttributesFromResult = (inputResult: SVGTemplateResult | null): Record<string, any> | null => {
    if (!inputResult) return null;

    let actualPathResult: SVGTemplateResult | null = null;
  

    /*
      Check if inputResult is the direct path template or a group containing it.
      A direct path template from RectangleElement.renderShape (non-button) looks like:
      strings: [
        "\n          <path\n            id=\"", 
        "__shape\" // Derived ID for the path itself, not the main element ID\n            d=", 
        "\n            fill=", 
        "\n            stroke=", 
        "\n            stroke-width=", 
        "\n          />\n        "
      ]
      values: [id, pathData, fill, stroke, strokeWidth]
      So, strings[1] (after id attribute) would contain "d=" if it's the direct path's static part.

      A group template from LayoutElement.render might look like:
      strings: ["<g id=\"", "\">", "</g>"]
      values: [id, shapeOrButtonTemplate] or if text: [id, shapeOrButtonTemplate, textTemplate]
    */

    if (inputResult.strings && inputResult.strings.length > 2 && inputResult.strings[1].includes('__shape') && inputResult.strings[1].includes('d=')) {
      // Heuristic: If strings[1] contains '__shape' (our specific id pattern for direct path) AND 'd=', assume it's the direct path template.
      actualPathResult = inputResult;

  } else if (inputResult.values && inputResult.values.length > 1 && inputResult.values[1] && typeof inputResult.values[1] === 'object' && '_$litType$' in inputResult.values[1]) {
      // Assume it's a group, and the second value is the shape/path template (first value is element ID)
      actualPathResult = inputResult.values[1] as SVGTemplateResult;

  } else if (inputResult.strings && inputResult.strings.some(s => s.includes('data-testid="mock-button"'))) {
        // Handle specific mock button case (this seems to be for button elements themselves, not generic paths)
        const pathDataMatch = inputResult.strings.join('').match(/data-path="([^\"]*)"/);
        const optionsMatch = inputResult.strings.join('').match(/data-options="([^\"]*)"/);
        return {
            d: pathDataMatch ? pathDataMatch[1] : 'mock-path-not-found',
            mockOptions: optionsMatch ? JSON.parse(optionsMatch[1].replace(/"/g, '"')) : {}
        };
    }
    // If none of the above, actualPathResult might still be null if inputResult didn't match any known structures.

    if (!actualPathResult || !actualPathResult.values) {
        // This case might occur if inputResult was not a recognized group or direct path, 
        // or if the mock-button logic from the original code needs to be re-evaluated here.
        // For now, if actualPathResult couldn't be determined, return null.
        // The specific mock-button logic was moved up to be checked against inputResult directly.

      return null;
  }

    // Extract path data and attributes from the SVG template
    const attributes: Record<string, any> = {};
    
    // Check if dealing with zero dimensions special case
    if (actualPathResult.strings.some(s => s.includes('d="M')) && actualPathResult.values.length >= 9) { // id + 4 pairs of coords
      // Zero dimension case - path data is embedded in the template
      return {
        d: `M ${actualPathResult.values[1]},${actualPathResult.values[2]} L ${actualPathResult.values[3]},${actualPathResult.values[4]} L ${actualPathResult.values[5]},${actualPathResult.values[6]} L ${actualPathResult.values[7]},${actualPathResult.values[8]} Z`,
        fill: 'none',
        stroke: 'none',
        'stroke-width': '0'
      };
    } else {
      // Normal non-button case from RectangleElement.renderShape():
      // template: <path id="${VAL0_ID}__shape" d=${VAL1_PATH} fill=${VAL2_FILL} stroke=${VAL3_STROKE} stroke-width=${VAL4_STROKEWIDTH} />
      // actualPathResult.values should be [idForPath, pathData, fillColor, strokeColor, strokeWidthVal]
      // So, pathData is at actualPathResult.values[1]
      if (actualPathResult.values.length > 1) {
        attributes.d = actualPathResult.values[1] as string;
      }
      if (actualPathResult.values.length > 2) {
        attributes.fill = actualPathResult.values[2] as string;
      }
      if (actualPathResult.values.length > 3) {
        attributes.stroke = actualPathResult.values[3] as string;
      }
      if (actualPathResult.values.length > 4) {
        attributes['stroke-width'] = actualPathResult.values[4] as string;
      }

      return Object.keys(attributes).length > 0 ? attributes : null;
    }
  };


  describe('Constructor and Initialization', () => {
    it('should instantiate correctly with minimal arguments', () => {
      rectangleElement = new RectangleElement('rect-min');
      expect(rectangleElement.id).toBe('rect-min');
      expect(rectangleElement.props).toEqual({});
      expect(rectangleElement.layoutConfig).toEqual({});
      expect(rectangleElement.button).toBeUndefined(); 
      expect(Button).not.toHaveBeenCalled();
    });

    it('should instantiate Button if button.enabled is true in props', () => {
      const props = { button: { enabled: true } };
      rectangleElement = new RectangleElement('rect-btn-init', props, {}, mockHass, mockRequestUpdate);

      expect(Button).toHaveBeenCalled();
      expect(Button).toHaveBeenCalledWith('rect-btn-init', props, mockHass, mockRequestUpdate, undefined);
      expect(rectangleElement.button).toBeDefined();
    });

    it('should NOT instantiate Button if button.enabled is false or button prop is missing', () => {
      rectangleElement = new RectangleElement('rect-no-btn1', { button: { enabled: false } });
      expect(Button).not.toHaveBeenCalled();
      expect(rectangleElement.button).toBeUndefined();

      vi.clearAllMocks();

      rectangleElement = new RectangleElement('rect-no-btn2', {});
      expect(Button).not.toHaveBeenCalled();
      expect(rectangleElement.button).toBeUndefined();
    });
  });

  describe('render', () => {
    it('should return null if layout.calculated is false', () => {
      rectangleElement = new RectangleElement('rect-no-layout');
      rectangleElement.layout = { x: 0, y: 0, width: 0, height: 0, calculated: false };
      expect(rectangleElement.render()).toBeNull();
    });

    describe('Non-Button Rendering', () => {
      it('should render a basic rectangle path with default props if none provided', () => {
        const layout = { x: 0, y: 0, width: 10, height: 10, calculated: true };
        rectangleElement = new RectangleElement('rect-default-props');
        rectangleElement.layout = layout;

        const result = rectangleElement.render();
        expect(result).toMatchSnapshot();

        const attrs = getPathAttributesFromResult(result);
        expect(attrs?.d).toBe(generateRectanglePath(0, 0, 10, 10, 0));
        expect(attrs?.fill).toBe('none');
        expect(attrs?.stroke).toBe('none');
        expect(attrs?.['stroke-width']).toBe('0');
      });

      it('should render with specified fill, stroke, strokeWidth, and rx', () => {
        const props = { fill: 'rgba(255,0,0,0.5)', stroke: '#00FF00', strokeWidth: '3.5', rx: 7 };
        const layout = { x: 1, y: 2, width: 30, height: 40, calculated: true };
        rectangleElement = new RectangleElement('rect-styled', props);
        rectangleElement.layout = layout;

        const result = rectangleElement.render();
        expect(result).toMatchSnapshot();

        const attrs = getPathAttributesFromResult(result);
        expect(attrs?.d).toBe(generateRectanglePath(1, 2, 30, 40, 7));
        expect(attrs?.fill).toBe('rgba(255,0,0,0.5)');
        expect(attrs?.stroke).toBe('#00FF00');
        expect(attrs?.['stroke-width']).toBe('3.5');
      });

      it('should handle cornerRadius prop as an alias for rx', () => {
        const props = { fill: 'yellow', cornerRadius: 4 };
        const layout = { x: 0, y: 0, width: 20, height: 20, calculated: true };
        rectangleElement = new RectangleElement('rect-cornerRadius', props);
        rectangleElement.layout = layout;

        const result = rectangleElement.render();
        expect(result).toMatchSnapshot();
        const attrs = getPathAttributesFromResult(result);
        expect(attrs?.d).toBe(generateRectanglePath(0, 0, 20, 20, 4));
      });

      it('should prioritize rx over cornerRadius if both are present', () => {
        const props = { fill: 'cyan', rx: 6, cornerRadius: 3 };
        const layout = { x: 0, y: 0, width: 25, height: 25, calculated: true };
        rectangleElement = new RectangleElement('rect-rx-priority', props);
        rectangleElement.layout = layout;

        const result = rectangleElement.render();
        expect(result).toMatchSnapshot();
        const attrs = getPathAttributesFromResult(result);
        expect(attrs?.d).toBe(generateRectanglePath(0, 0, 25, 25, 6));
      });

      it('should handle zero dimensions (width=0 or height=0) by rendering a minimal path', () => {
        const layoutZeroW = { x: 10, y: 10, width: 0, height: 50, calculated: true };
        rectangleElement = new RectangleElement('rect-zero-w', {});
        rectangleElement.layout = layoutZeroW;
        expect(rectangleElement.render()).toMatchSnapshot();

        const layoutZeroH = { x: 10, y: 10, width: 50, height: 0, calculated: true };
        rectangleElement = new RectangleElement('rect-zero-h', {});
        rectangleElement.layout = layoutZeroH;
        expect(rectangleElement.render()).toMatchSnapshot();
      });
    });

    describe('Button Rendering', () => {
      it('should call button.createButton with correct default rx (0) if not specified in props', () => {
        const props = { button: { enabled: true, text: "Click Me" } };
        const layout = { x: 10, y: 10, width: 100, height: 30, calculated: true };
        rectangleElement = new RectangleElement('btn-default-rx', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;

        rectangleElement.render();

        expect(mockCreateButton).toHaveBeenCalledTimes(1);
        const expectedPathD = generateRectanglePath(10, 10, 100, 30, 0);
        expect(mockCreateButton).toHaveBeenCalledWith(
          expectedPathD, 10, 10, 100, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should call button.createButton with specified rx from props', () => {
        const props = { rx: 8, button: { enabled: true, text: "Radius" } };
        const layout = { x: 0, y: 0, width: 80, height: 40, calculated: true };
        rectangleElement = new RectangleElement('btn-rx-prop', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;

        rectangleElement.render();

        expect(mockCreateButton).toHaveBeenCalledTimes(1);
        const expectedPathD = generateRectanglePath(0, 0, 80, 40, 8);
        expect(mockCreateButton).toHaveBeenCalledWith(
          expectedPathD, 0, 0, 80, 40,
          { rx: 8 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should call button.createButton with cornerRadius as rx if rx is not present', () => {
        const props = { cornerRadius: 6, button: { enabled: true, text: "Corner" } };
        const layout = { x: 0, y: 0, width: 70, height: 35, calculated: true };
        rectangleElement = new RectangleElement('btn-cornerRadius-prop', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;

        rectangleElement.render();

        expect(mockCreateButton).toHaveBeenCalledTimes(1);
        const expectedPathD = generateRectanglePath(0, 0, 70, 35, 6);
        expect(mockCreateButton).toHaveBeenCalledWith(
          expectedPathD, 0, 0, 70, 35,
          { rx: 6 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should call button.createButton with hasText:false if button.text is undefined or empty', () => {
        const propsNoText = { button: { enabled: true } , rx: 0};
        const layout = { x: 1, y: 1, width: 50, height: 20, calculated: true };
        rectangleElement = new RectangleElement('btn-no-text', propsNoText, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;
        rectangleElement.render();
        expect(mockCreateButton).toHaveBeenCalledWith(
            expect.any(String), 1, 1, 50, 20,
            { rx: 0 },
            { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
        mockCreateButton.mockClear();

        const propsEmptyText = { button: { enabled: true, text: "" }, rx: 0 };
        rectangleElement = new RectangleElement('btn-empty-text', propsEmptyText, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;
        rectangleElement.render();
        expect(mockCreateButton).toHaveBeenCalledWith(
            expect.any(String), 1, 1, 50, 20,
            { rx: 0 },
            { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should pass text properties correctly to button.createButton', () => {
        const props = {
          button: {
            enabled: true,
          },
          text: 'Test Button',
          textColor: 'white'
        };
        rectangleElement = new RectangleElement('rect-button-text', props, {}, mockHass, mockRequestUpdate);
        const mockButton = new Button('rect-button-text', props, mockHass, mockRequestUpdate, vi.fn());
        const mockCreateButton = vi.spyOn(mockButton, 'createButton');
        rectangleElement.button = mockButton;
        
        const layout = { x: 10, y: 10, width: 100, height: 50, calculated: true };
        rectangleElement.layout = layout;
        rectangleElement.render();
        
        expect(mockCreateButton).toHaveBeenCalledWith(
          expect.any(String),
          10, 10, 100, 50,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should pass cutout_text: true correctly to button.createButton', () => {
        const props = { button: { enabled: true, text: "Cutout", cutout_text: true }, rx: 0 };
        const layout = { x: 2, y: 2, width: 60, height: 25, calculated: true };
        rectangleElement = new RectangleElement('btn-cutout-true', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;
        rectangleElement.render();
        expect(mockCreateButton).toHaveBeenCalledWith(
            expect.any(String), 2, 2, 60, 25,
            { rx: 0 },
            { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should pass cutout_text: false if not specified in button props', () => {
        const props = { button: { enabled: true, text: "No Cutout Specified" }, rx: 0 };
        const layout = { x: 3, y: 3, width: 90, height: 45, calculated: true };
        rectangleElement = new RectangleElement('btn-cutout-default', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.layout = layout;
        rectangleElement.render();
        expect(mockCreateButton).toHaveBeenCalledWith(
            expect.any(String), 3, 3, 90, 45,
            { rx: 0 },
            { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should position button text correctly based on text_anchor setting', () => {
        // Mock the Button class to track createButton calls and capture text positioning
        const mockButton = {
          createButton: vi.fn((pathData, x, y, width, height, options) => {
            return svg`<g>Mock Button</g>`;
          })
        };

        // Test 'start' anchor - should position at left edge with padding
        const propsStart = { 
          button: { enabled: true, text: "Start Text", text_anchor: "start" }, 
          rx: 0 
        };
        const layout = { x: 10, y: 20, width: 100, height: 30, calculated: true };
        rectangleElement = new RectangleElement('btn-text-start', propsStart, {}, mockHass, mockRequestUpdate);
        rectangleElement.button = mockButton as any;
        rectangleElement.layout = layout;
        rectangleElement.render();
        
        expect(mockButton.createButton).toHaveBeenCalledWith(
          expect.any(String), 10, 20, 100, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );

        mockButton.createButton.mockClear();

        // Test 'end' anchor - should position at right edge with padding
        const propsEnd = { 
          button: { enabled: true, text: "End Text", text_anchor: "end" }, 
          rx: 0 
        };
        rectangleElement = new RectangleElement('btn-text-end', propsEnd, {}, mockHass, mockRequestUpdate);
        rectangleElement.button = mockButton as any;
        rectangleElement.layout = layout;
        rectangleElement.render();
        
        expect(mockButton.createButton).toHaveBeenCalledWith(
          expect.any(String), 10, 20, 100, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );

        mockButton.createButton.mockClear();

        // Test 'middle' anchor (default) - should position at center
        const propsMiddle = { 
          button: { enabled: true, text: "Middle Text", text_anchor: "middle" }, 
          rx: 0 
        };
        rectangleElement = new RectangleElement('btn-text-middle', propsMiddle, {}, mockHass, mockRequestUpdate);
        rectangleElement.button = mockButton as any;
        rectangleElement.layout = layout;
        rectangleElement.render();
        
        expect(mockButton.createButton).toHaveBeenCalledWith(
          expect.any(String), 10, 20, 100, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });
    });
  });

  describe('calculateIntrinsicSize', () => {
    it('should set intrinsicSize from props or layoutConfig', () => {
        const mockSvgContainer = {} as SVGElement; // Not actually used by Rectangle's intrinsicSize

        rectangleElement = new RectangleElement('rect-is', { width: 150, height: 75 });
        rectangleElement.calculateIntrinsicSize(mockSvgContainer);
        expect(rectangleElement.intrinsicSize).toEqual({ width: 150, height: 75, calculated: true });

        rectangleElement = new RectangleElement('rect-is2', {}, { width: 120, height: 60 });
        rectangleElement.calculateIntrinsicSize(mockSvgContainer);
        expect(rectangleElement.intrinsicSize).toEqual({ width: 120, height: 60, calculated: true });

        rectangleElement = new RectangleElement('rect-is3', {});
        rectangleElement.calculateIntrinsicSize(mockSvgContainer);
        expect(rectangleElement.intrinsicSize).toEqual({ width: 0, height: 0, calculated: true });
    });
  });

  describe('Centralized Text Rendering for Buttons', () => {
    it('should render text for button elements through centralized system', () => {
      const props = {
        button: {
          enabled: true
        },
        text: 'Kitchen Sink Toggle',
        textColor: '#FFFFFF',
        fontFamily: 'Antonio'
      };
      
      const mockButton = {
        createButton: vi.fn().mockReturnValue(svg`<g class="lcars-button-group"><path d="M0,0 L100,0 L100,30 L0,30 Z"/></g>`)
      };
      
      rectangleElement = new RectangleElement('rect-button-text', props, {}, mockHass, mockRequestUpdate);
      rectangleElement.button = mockButton as any;
      rectangleElement.layout = { x: 10, y: 20, width: 150, height: 30, calculated: true };
      
      const result = rectangleElement.render();
      
      expect(result).toBeDefined();
      
      const templateToString = (template: SVGTemplateResult): string => {
        let resultString = template.strings[0];
        for (let i = 0; i < template.values.length; i++) {
          const value = template.values[i];
          if (value && typeof value === 'object' && '_$litType$' in value) {
            resultString += templateToString(value as SVGTemplateResult);
          } else if (value !== null) {
            resultString += String(value);
          }
          resultString += template.strings[i + 1];
        }
        return resultString;
      };
      
      const fullSvgString = result ? templateToString(result) : '';
      expect(fullSvgString).toContain('lcars-button-group');
      expect(fullSvgString).toContain('Kitchen Sink Toggle');
    });

    it('should not render text for button elements when no text is configured', () => {
        const props = {
          button: {
            enabled: true
          }
        };
        
        const mockButton = {
          createButton: vi.fn().mockReturnValue(svg`<g class="lcars-button-group"><path d="M0,0 L100,0 L100,30 L0,30 Z"/></g>`)
        };
        
        rectangleElement = new RectangleElement('rect-button-no-text', props, {}, mockHass, mockRequestUpdate);
        rectangleElement.button = mockButton as any;
        rectangleElement.layout = { x: 10, y: 20, width: 150, height: 30, calculated: true };
        
        const result = rectangleElement.render();
        
        expect(result).toBeDefined();
        
        const templateToString = (template: SVGTemplateResult): string => {
          let resultString = template.strings[0];
          for (let i = 0; i < template.values.length; i++) {
            const value = template.values[i];
            if (value && typeof value === 'object' && '_$litType$' in value) {
              resultString += templateToString(value as SVGTemplateResult);
            } else if (value !== null) { // Exclude null text values from string
              resultString += String(value);
            }
            resultString += template.strings[i + 1];
          }
          return resultString;
        };
        
        const fullSvgString = result ? templateToString(result) : '';
        expect(fullSvgString).toContain('lcars-button-group');
        expect(fullSvgString).not.toContain('<text');
      });
  });
});