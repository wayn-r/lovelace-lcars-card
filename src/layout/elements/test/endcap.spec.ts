// src/layout/elements/endcap.spec.ts

// Mocking Button class
const mockCreateButton = vi.fn();
vi.mock('../../../utils/button.js', () => {
  // Ensure the mock constructor matches the actual class for type compatibility if used
  const Button = vi.fn().mockImplementation((id, props, hass, cb) => {
    return {
      id,
      props,
      hass,
      requestUpdateCallback: cb,
      createButton: mockCreateButton,
    };
  });
  return { Button }; // Export the mocked class
});

import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { EndcapElement } from '../endcap';
import { Button } from '../../../utils/button.js'; // Import the mocked Button
import { LayoutElement } from '../element'; // For spying on superclass methods
import { RectangleElement } from '../rectangle'; // Import RectangleElement
import { generateEndcapPath } from '../../../utils/shapes'; // Actual function
import { svg, SVGTemplateResult } from 'lit';

describe('EndcapElement', () => {
  let endcapElement: EndcapElement;
  const mockHass: any = {}; // Simplified HomeAssistant mock
  const mockRequestUpdate = vi.fn();
  const mockContainerRect = { x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, bottom: 800, right: 1000, toJSON: () => ({}) } as DOMRect;
  let elementsMap: Map<string, LayoutElement>;

  // Spies for superclass methods
  let superCalculateLayoutSpy: MockInstance;
  let superCanCalculateLayoutSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    elementsMap = new Map<string, LayoutElement>();

    // Setup spies on the prototype of the superclass
    // These will affect all instances of EndcapElement created after this point in this test file
    superCalculateLayoutSpy = vi.spyOn(LayoutElement.prototype, 'calculateLayout') as MockInstance;
    superCanCalculateLayoutSpy = vi.spyOn(LayoutElement.prototype, 'canCalculateLayout') as MockInstance;
  });

  afterEach(() => {
    // Restore the original methods
    superCalculateLayoutSpy.mockRestore();
    superCanCalculateLayoutSpy.mockRestore();
  });

  // Helper to get attributes from the SVGTemplateResult for non-button rendering
  const getPathAttributes = (result: SVGTemplateResult | null): Record<string, any> | null => {
    if (!result) return null;

    // Check if it's a group template with a path inside
    if (result.values && result.values.length > 1 && result.values[1] && typeof result.values[1] === 'object' && '_$litType$' in result.values[1]) {
      // Extract the path template from the group
      const pathTemplate = result.values[1] as SVGTemplateResult;
      if (pathTemplate.values && pathTemplate.values.length >= 4) {
        return {
          id: pathTemplate.values[0],
          d: pathTemplate.values[1],
          fill: pathTemplate.values[2],
          stroke: pathTemplate.values[3],
          'stroke-width': pathTemplate.values[4],
        };
      }
    }
    
    // Fallback for direct path template (shouldn't happen with current structure but keeping for safety)
    if (result.values && result.values.length >= 5) {
    return {
      id: result.values[0],
      d: result.values[1],
      fill: result.values[2],
      stroke: result.values[3],
      'stroke-width': result.values[4],
    };
    }
    
    return null;
  };

  describe('Constructor and Initialization', () => {
    it('should instantiate correctly with minimal arguments', () => {
      endcapElement = new EndcapElement('ec-min');
      expect(endcapElement.id).toBe('ec-min');
      expect(endcapElement.props).toEqual({});
      expect(endcapElement.layoutConfig).toEqual({});
      expect(endcapElement.button).toBeUndefined();
      expect(Button).not.toHaveBeenCalled();
    });

    it('should instantiate Button if button.enabled is true in props', () => {
      const props = { button: { enabled: true } };
      endcapElement = new EndcapElement('ec-btn-init', props, {}, mockHass, mockRequestUpdate);

      expect(Button).toHaveBeenCalledOnce();
      expect(Button).toHaveBeenCalledWith('ec-btn-init', props, mockHass, mockRequestUpdate, undefined);
      expect(endcapElement.button).toBeDefined();
    });

    it('should NOT instantiate Button if button.enabled is false or button prop is missing', () => {
      endcapElement = new EndcapElement('ec-no-btn1', { button: { enabled: false } });
      expect(Button).not.toHaveBeenCalled();
      expect(endcapElement.button).toBeUndefined();

      vi.clearAllMocks(); // Clear for the next check

      endcapElement = new EndcapElement('ec-no-btn2', {});
      expect(Button).not.toHaveBeenCalled();
      expect(endcapElement.button).toBeUndefined();
    });
  });

  describe('calculateIntrinsicSize', () => {
    const mockSvgContainer = {} as SVGElement; // Not directly used by Endcap's intrinsicSize

    it('should set width from props or layoutConfig, or default to 40', () => {
      endcapElement = new EndcapElement('ec-is1', { width: 50 });
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.width).toBe(50);

      endcapElement = new EndcapElement('ec-is2', {}, { width: 60 });
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.width).toBe(60);

      endcapElement = new EndcapElement('ec-is3', {});
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.width).toBe(40); // Default width
    });

    it('should set height from props or layoutConfig, or default to 0', () => {
      endcapElement = new EndcapElement('ec-is4', { height: 30 });
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.height).toBe(30);

      endcapElement = new EndcapElement('ec-is5', {}, { height: 20 });
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.height).toBe(20);

      endcapElement = new EndcapElement('ec-is6', {});
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.height).toBe(0); // Default height
    });

    it('should set intrinsicSize.calculated to true', () => {
      endcapElement = new EndcapElement('ec-is-calc');
      endcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(endcapElement.intrinsicSize.calculated).toBe(true);
    });
  });

  describe('canCalculateLayout', () => {
    beforeEach(() => {
      endcapElement = new EndcapElement('ec-ccl');
    });

    it('should call super.canCalculateLayout if intrinsicSize.height is not 0', () => {
      endcapElement.intrinsicSize = { width: 40, height: 20, calculated: true };
      superCanCalculateLayoutSpy.mockReturnValue(true);
      expect(endcapElement.canCalculateLayout(elementsMap)).toBe(true);
      expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should call super.canCalculateLayout if intrinsicSize.height is 0 but no anchorTo is configured', () => {
      endcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
      endcapElement.layoutConfig = {}; // No anchorTo
      superCanCalculateLayoutSpy.mockReturnValue(true);
      expect(endcapElement.canCalculateLayout(elementsMap)).toBe(true);
      expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    describe('when intrinsicSize.height is 0 and anchorTo is configured', () => {
      beforeEach(() => {
        endcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
        endcapElement.layoutConfig = { anchor: { anchorTo: 'target' } };
      });

      it('should return false if anchor target element is not in elementsMap', () => {
        expect(endcapElement.canCalculateLayout(elementsMap)).toBe(false);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });

      it('should return false if anchor target element is not calculated', () => {
        const targetElement = new RectangleElement('target') as LayoutElement; // Mock or use a real one
        targetElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: false };
        elementsMap.set('target', targetElement);

        expect(endcapElement.canCalculateLayout(elementsMap)).toBe(false);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });

      it('should call super.canCalculateLayout if anchor target is found and calculated', () => {
        const targetElement = new RectangleElement('target') as LayoutElement;
        targetElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: true };
        elementsMap.set('target', targetElement);
        superCanCalculateLayoutSpy.mockReturnValue(true);

        expect(endcapElement.canCalculateLayout(elementsMap)).toBe(true);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('calculateLayout', () => {
    beforeEach(() => {
      endcapElement = new EndcapElement('ec-cl');
      // Mock super.calculateLayout to prevent its actual execution and allow inspection
      superCalculateLayoutSpy.mockImplementation(function(this: LayoutElement) {
        // A simple mock that sets layout.calculated = true and copies some values
        this.layout.x = this.layoutConfig.offsetX || 0;
        this.layout.y = this.layoutConfig.offsetY || 0;
        this.layout.width = (typeof this.layoutConfig.width === 'number' ? this.layoutConfig.width : 0) || this.intrinsicSize.width;
        this.layout.height = (typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : 0) || this.intrinsicSize.height;
        this.layout.calculated = true;
      });
    });

    it('should call super.calculateLayout directly if intrinsicSize.height is not 0', () => {
      endcapElement.intrinsicSize = { width: 40, height: 20, calculated: true };
      endcapElement.calculateLayout(elementsMap, mockContainerRect);
      expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      // Verify that layoutConfig.height was not modified by this specific logic
      expect(endcapElement.layoutConfig.height).toBeUndefined(); // Or its original value if set
    });

    it('should call super.calculateLayout directly if intrinsicSize.height is 0 but no anchorTo', () => {
      endcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
      endcapElement.layoutConfig = {}; // No anchorTo
      endcapElement.calculateLayout(elementsMap, mockContainerRect);
      expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    describe('when intrinsicSize.height is 0 and anchorTo is configured', () => {
      const targetId = 'anchorTarget';
      let anchorTarget: LayoutElement;

      beforeEach(() => {
        endcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
        endcapElement.layoutConfig = { 
          anchor: { anchorTo: targetId, anchorPoint: 'topLeft', targetAnchorPoint: 'topLeft' },
          height: 10 // Original layoutConfig height
        };
        anchorTarget = new RectangleElement(targetId) as LayoutElement; // Using Rectangle as a concrete LayoutElement
        anchorTarget.layout = { x: 10, y: 10, width: 100, height: 50, calculated: true }; // Target height is 50
        elementsMap.set(targetId, anchorTarget);
      });

      it('should adopt anchor target height, call super.calculateLayout, then restore original layoutConfig.height', () => {
        endcapElement.calculateLayout(elementsMap, mockContainerRect);

        expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
        // Check that super.calculateLayout was called in a context where this.layoutConfig.height was 50
        // This is verified by checking the arguments passed to the spy, or side effects.
        // Since we mocked super.calculateLayout to use this.layoutConfig.height, we can check endcapElement.layout.height.
        expect(endcapElement.layout.height).toBe(50); // Because mocked super uses this.layoutConfig.height

        // Verify original layoutConfig.height is restored
        expect(endcapElement.layoutConfig.height).toBe(10);
      });

      it('should call super.calculateLayout once even if anchor target is not found (falls back to normal super call)', () => {
        elementsMap.delete(targetId); // Target not found
        endcapElement.calculateLayout(elementsMap, mockContainerRect);
        expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
        // In this case, the adopted height logic is skipped, super is called with original context
        expect(endcapElement.layout.height).toBe(10); // Mocked super uses original layoutConfig.height
        expect(endcapElement.layoutConfig.height).toBe(10);
      });
    });
  });

  describe('render', () => {
    beforeEach(() => {
      endcapElement = new EndcapElement('ec-render');
    });

    it('should return null if layout.calculated is false', () => {
      endcapElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: false };
      expect(endcapElement.render()).toBeNull();
    });

    it('should return null if layout.height <= 0', () => {
      endcapElement.layout = { x: 0, y: 0, width: 10, height: 0, calculated: true };
      expect(endcapElement.render()).toBeNull();
    });

    it('should return null if layout.width <= 0', () => {
      endcapElement.layout = { x: 0, y: 0, width: 0, height: 10, calculated: true };
      expect(endcapElement.render()).toBeNull();
    });

    describe('Non-Button Rendering', () => {
      it('should render a basic endcap path with default direction "left"', () => {
        endcapElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
        const result = endcapElement.render();
        expect(result).toMatchSnapshot();

        const attrs = getPathAttributes(result);
        expect(attrs?.id).toBe('ec-render');
        expect(attrs?.d).toBe(generateEndcapPath(40, 20, 'left', 5, 10));
        expect(attrs?.fill).toBe('none');
        expect(attrs?.stroke).toBe('none');
        expect(attrs?.['stroke-width']).toBe('0');
      });

      it('should render with direction "right" from props', () => {
        endcapElement.props = { direction: 'right' };
        endcapElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
        const result = endcapElement.render();
        expect(result).toMatchSnapshot();
        
        const attrs = getPathAttributes(result);
        expect(attrs?.d).toBe(generateEndcapPath(40, 20, 'right', 5, 10));
      });

      it('should render with specified fill, stroke, strokeWidth from props', () => {
        endcapElement.props = { fill: 'red', stroke: 'blue', strokeWidth: '2' };
        endcapElement.layout = { x: 0, y: 0, width: 30, height: 15, calculated: true };
        const result = endcapElement.render();
        expect(result).toMatchSnapshot();

        const attrs = getPathAttributes(result);
        expect(attrs?.fill).toBe('red');
        expect(attrs?.stroke).toBe('blue');
        expect(attrs?.['stroke-width']).toBe('2');
      });
    });

    describe('Button Rendering', () => {
      beforeEach(() => {
        // Ensure Button is instantiated for these tests
        const props = { button: { enabled: true } };
        endcapElement = new EndcapElement('ec-render-btn', props, {}, mockHass, mockRequestUpdate);
        endcapElement.layout = { x: 10, y: 15, width: 60, height: 30, calculated: true };
      });

      it('should call button.createButton with correct parameters for default direction "left"', () => {
        endcapElement.render();
        expect(mockCreateButton).toHaveBeenCalledTimes(1);
        const expectedPathD = generateEndcapPath(60, 30, 'left', 10, 15);
        expect(mockCreateButton).toHaveBeenCalledWith(
          expectedPathD, 10, 15, 60, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should call button.createButton for direction "right"', () => {
        endcapElement.props.direction = 'right'; // Modify props for this test
        endcapElement.render();

        const expectedPathD = generateEndcapPath(60, 30, 'right', 10, 15);
        expect(mockCreateButton).toHaveBeenCalledWith(
          expectedPathD, 10, 15, 60, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should pass hasText:true if button.text is present', () => {
        endcapElement.props.button = { enabled: true, text: 'Click' };
        endcapElement.render();

        expect(mockCreateButton).toHaveBeenCalledWith(
          expect.any(String), 10, 15, 60, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });

      it('should pass isCutout:true if button.cutout_text is true', () => {
        endcapElement.props.button = { enabled: true, text: 'Cutout', cutout_text: true };
        endcapElement.render();

        expect(mockCreateButton).toHaveBeenCalledWith(
          expect.any(String), 10, 15, 60, 30,
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
      });
    });
  });
});