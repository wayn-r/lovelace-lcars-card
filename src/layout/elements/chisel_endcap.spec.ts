// src/layout/elements/chisel_endcap.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

// Mock Button class
const mockCreateButton = vi.fn();
vi.mock('./button.js', () => {
  return {
    Button: vi.fn().mockImplementation((id, props, hass, cb) => {
      return {
        id,
        props,
        hass,
        requestUpdateCallback: cb,
        createButton: mockCreateButton,
      };
    })
  };
});

// Mock the shapes utility - IMPORTANT: add .js extension to match the import in the actual file
vi.mock('../../utils/shapes.js', () => {
  return {
    generateChiselEndcapPath: vi.fn().mockImplementation((width, height, direction, offsetX, offsetY): string | null => 
      `MOCK_PATH_chisel_${direction}_${width}x${height}_at_${offsetX},${offsetY}`)
  };
});

// Import after mocks
import { ChiselEndcapElement } from './chisel_endcap';
import { Button } from './button.js';
import { LayoutElement } from './element.js';
import { RectangleElement } from './rectangle';
import { generateChiselEndcapPath } from '../../utils/shapes.js';
import { svg, SVGTemplateResult } from 'lit';

describe('ChiselEndcapElement', () => {
  let chiselEndcapElement: ChiselEndcapElement;
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
    if (!result || !result.values || result.values.length < 5) return null;
    // Based on <path id=${this.id} d=${pathData} fill=${fill} stroke=${stroke} stroke-width=${strokeWidth} />
    return {
      id: result.values[0],
      d: result.values[1],
      fill: result.values[2],
      stroke: result.values[3],
      'stroke-width': result.values[4],
    };
  };

  describe('Constructor and Initialization', () => {
    it('should instantiate correctly with minimal arguments', () => {
      chiselEndcapElement = new ChiselEndcapElement('ce-min');
      expect(chiselEndcapElement.id).toBe('ce-min');
      expect(chiselEndcapElement.props).toEqual({});
      expect(chiselEndcapElement.layoutConfig).toEqual({});
      expect(chiselEndcapElement.button).toBeUndefined();
      expect(Button).not.toHaveBeenCalled();
    });

    it('should instantiate Button if button.enabled is true in props', () => {
      const props = { button: { enabled: true } };
      chiselEndcapElement = new ChiselEndcapElement('ce-btn-init', props, {}, mockHass, mockRequestUpdate);

      expect(Button).toHaveBeenCalledOnce();
      expect(Button).toHaveBeenCalledWith('ce-btn-init', props, mockHass, mockRequestUpdate);
      expect(chiselEndcapElement.button).toBeDefined();
    });

    it('should NOT instantiate Button if button.enabled is false or button prop is missing', () => {
      chiselEndcapElement = new ChiselEndcapElement('ce-no-btn1', { button: { enabled: false } });
      expect(Button).not.toHaveBeenCalled();
      expect(chiselEndcapElement.button).toBeUndefined();

      vi.clearAllMocks();

      chiselEndcapElement = new ChiselEndcapElement('ce-no-btn2', {});
      expect(Button).not.toHaveBeenCalled();
      expect(chiselEndcapElement.button).toBeUndefined();
    });
  });

  describe('calculateIntrinsicSize', () => {
    const mockSvgContainer = {} as SVGElement;

    it('should set width from props or layoutConfig, or default to 40', () => {
      chiselEndcapElement = new ChiselEndcapElement('ce-is1', { width: 50 });
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.width).toBe(50);

      chiselEndcapElement = new ChiselEndcapElement('ce-is2', {}, { width: 60 });
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.width).toBe(60);

      chiselEndcapElement = new ChiselEndcapElement('ce-is3');
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.width).toBe(40);
    });

    it('should set height from props or layoutConfig, or default to 0', () => {
      chiselEndcapElement = new ChiselEndcapElement('ce-is4', { height: 30 });
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.height).toBe(30);

      chiselEndcapElement = new ChiselEndcapElement('ce-is5', {}, { height: 20 });
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.height).toBe(20);

      chiselEndcapElement = new ChiselEndcapElement('ce-is6');
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.height).toBe(0);
    });

    it('should set intrinsicSize.calculated to true', () => {
      chiselEndcapElement = new ChiselEndcapElement('ce-is-calc');
      chiselEndcapElement.calculateIntrinsicSize(mockSvgContainer);
      expect(chiselEndcapElement.intrinsicSize.calculated).toBe(true);
    });
  });

  describe('canCalculateLayout', () => {
    beforeEach(() => {
      chiselEndcapElement = new ChiselEndcapElement('ce-ccl');
    });

    it('should call super.canCalculateLayout if intrinsicSize.height is not 0', () => {
      chiselEndcapElement.intrinsicSize = { width: 40, height: 20, calculated: true };
      superCanCalculateLayoutSpy.mockReturnValue(true);
      expect(chiselEndcapElement.canCalculateLayout(elementsMap)).toBe(true);
      expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should call super.canCalculateLayout if intrinsicSize.height is 0 but no anchorTo is configured', () => {
      chiselEndcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
      chiselEndcapElement.layoutConfig = {};
      superCanCalculateLayoutSpy.mockReturnValue(true);
      expect(chiselEndcapElement.canCalculateLayout(elementsMap)).toBe(true);
      expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    describe('when intrinsicSize.height is 0 and anchorTo is configured', () => {
      beforeEach(() => {
        chiselEndcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
        chiselEndcapElement.layoutConfig = { anchor: { anchorTo: 'target' } };
      });

      it('should return false if anchor target element is not in elementsMap', () => {
        superCanCalculateLayoutSpy.mockImplementationOnce(function(this: LayoutElement, map: Map<string, LayoutElement>, deps: string[] = []): boolean {
            if (this.layoutConfig.anchor?.anchorTo && this.layoutConfig.anchor.anchorTo === 'target') {
                if (!map.has('target')) {
                    deps.push('target');
                    return false;
                }
            }
            return true;
        });
        expect(chiselEndcapElement.canCalculateLayout(elementsMap)).toBe(false);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });

      it('should call super.canCalculateLayout which handles dependency check (target not calculated)', () => {
        const targetElement = new RectangleElement('target');
        targetElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: false };
        elementsMap.set('target', targetElement);
        superCanCalculateLayoutSpy.mockReturnValue(false);

        expect(chiselEndcapElement.canCalculateLayout(elementsMap)).toBe(false);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });

      it('should call super.canCalculateLayout if anchor target is found and calculated', () => {
        const targetElement = new RectangleElement('target');
        targetElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: true };
        elementsMap.set('target', targetElement);
        superCanCalculateLayoutSpy.mockReturnValue(true);

        expect(chiselEndcapElement.canCalculateLayout(elementsMap)).toBe(true);
        expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('calculateLayout', () => {
    beforeEach(() => {
      chiselEndcapElement = new ChiselEndcapElement('ce-cl');
      superCalculateLayoutSpy.mockImplementation(function(this: LayoutElement) {
        this.layout.x = this.layoutConfig.offsetX || 0;
        this.layout.y = this.layoutConfig.offsetY || 0;
        this.layout.width = (typeof this.layoutConfig.width === 'number' ? this.layoutConfig.width : 0) || this.intrinsicSize.width;
        this.layout.height = (typeof this.layoutConfig.height === 'number' ? this.layoutConfig.height : 0) || this.intrinsicSize.height;
        this.layout.calculated = true;
      });
    });

    it('should call super.calculateLayout directly if intrinsicSize.height is not 0', () => {
      chiselEndcapElement.intrinsicSize = { width: 40, height: 20, calculated: true };
      chiselEndcapElement.calculateLayout(elementsMap, mockContainerRect);
      expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      expect(chiselEndcapElement.layoutConfig.height).toBeUndefined();
    });

    it('should call super.calculateLayout directly if intrinsicSize.height is 0 but no anchorTo', () => {
      chiselEndcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
      chiselEndcapElement.layoutConfig = {};
      chiselEndcapElement.calculateLayout(elementsMap, mockContainerRect);
      expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });

    describe('when intrinsicSize.height is 0 and anchorTo is configured', () => {
      const targetId = 'anchorTarget';
      let anchorTarget: LayoutElement;

      beforeEach(() => {
        chiselEndcapElement.intrinsicSize = { width: 40, height: 0, calculated: true };
        chiselEndcapElement.layoutConfig = {
          anchor: { anchorTo: targetId, anchorPoint: 'topLeft', targetAnchorPoint: 'topLeft' },
          height: 10 // Original layoutConfig height
        };
        anchorTarget = new RectangleElement(targetId);
        anchorTarget.layout = { x: 10, y: 10, width: 100, height: 50, calculated: true };
        elementsMap.set(targetId, anchorTarget);
      });

      it('should adopt anchor target height, call super.calculateLayout, then restore original layoutConfig.height', () => {
        chiselEndcapElement.calculateLayout(elementsMap, mockContainerRect);

        expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
        expect(chiselEndcapElement.layout.calculated).toBe(true);
        expect(chiselEndcapElement.layoutConfig.height).toBe(10);
      });

      it('should call super.calculateLayout once if anchor target is not found', () => {
        elementsMap.delete(targetId);
        chiselEndcapElement.calculateLayout(elementsMap, mockContainerRect);
        expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
        expect(chiselEndcapElement.layout.height).toBe(10);
        expect(chiselEndcapElement.layoutConfig.height).toBe(10);
      });
    });
  });

  describe('render', () => {
    beforeEach(() => {
      chiselEndcapElement = new ChiselEndcapElement('ce-render');
    });

    it('should return null if layout.calculated is false', () => {
      chiselEndcapElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: false };
      expect(chiselEndcapElement.render()).toBeNull();
    });

    it('should return null if layout.height <= 0', () => {
      chiselEndcapElement.layout = { x: 0, y: 0, width: 10, height: 0, calculated: true };
      expect(chiselEndcapElement.render()).toBeNull();
    });

    it('should return null if layout.width <= 0', () => {
      chiselEndcapElement.layout = { x: 0, y: 0, width: 0, height: 10, calculated: true };
      expect(chiselEndcapElement.render()).toBeNull();
    });

    it('should return null if generateChiselEndcapPath returns null', () => {
      chiselEndcapElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
      // Use any to bypass type checking, since we're deliberately testing a null return
      (vi.mocked(generateChiselEndcapPath) as any).mockReturnValueOnce(null);
      expect(chiselEndcapElement.render()).toBeNull();
    });

    describe('Non-Button Rendering', () => {
      it('should render a basic chisel endcap path with default direction "right"', () => {
        chiselEndcapElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
        const result = chiselEndcapElement.render();
        expect(result).toMatchSnapshot();

        expect(generateChiselEndcapPath).toHaveBeenCalledWith(40, 20, 'right', 5, 10);
        const attrs = getPathAttributes(result);
        expect(attrs?.id).toBe('ce-render');
        expect(attrs?.fill).toBe('none');
        expect(attrs?.stroke).toBe('none');
        expect(attrs?.['stroke-width']).toBe('0');
      });

      it('should render with direction "left" from props', () => {
        chiselEndcapElement.props = { direction: 'left' };
        chiselEndcapElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
        const result = chiselEndcapElement.render();
        expect(result).toMatchSnapshot();
        
        expect(generateChiselEndcapPath).toHaveBeenCalledWith(40, 20, 'left', 5, 10);
      });

      it('should render with specified fill, stroke, strokeWidth from props', () => {
        chiselEndcapElement.props = { fill: 'red', stroke: 'blue', strokeWidth: '2' };
        chiselEndcapElement.layout = { x: 0, y: 0, width: 30, height: 15, calculated: true };
        const result = chiselEndcapElement.render();
        expect(result).toMatchSnapshot();

        const attrs = getPathAttributes(result);
        expect(attrs?.fill).toBe('red');
        expect(attrs?.stroke).toBe('blue');
        expect(attrs?.['stroke-width']).toBe('2');
      });
    });

    describe('Button Rendering', () => {
      const mockPathData = 'MOCK_BUTTON_PATH';
      beforeEach(() => {
        vi.mocked(generateChiselEndcapPath).mockReturnValue(mockPathData);
        const props = { button: { enabled: true } };
        chiselEndcapElement = new ChiselEndcapElement('ce-render-btn', props, {}, mockHass, mockRequestUpdate);
        chiselEndcapElement.layout = { x: 10, y: 15, width: 60, height: 30, calculated: true };
      });

      it('should call button.createButton with correct parameters for default direction "right"', () => {
        chiselEndcapElement.render();
        expect(generateChiselEndcapPath).toHaveBeenCalledWith(60, 30, 'right', 10, 15);
        expect(mockCreateButton).toHaveBeenCalledTimes(1);
        expect(mockCreateButton).toHaveBeenCalledWith(
          mockPathData, 10, 15, 60, 30,
          { hasText: false, isCutout: false, rx: 0 }
        );
      });

      it('should call button.createButton for direction "left"', () => {
        chiselEndcapElement.props.direction = 'left';
        chiselEndcapElement.render();

        expect(generateChiselEndcapPath).toHaveBeenCalledWith(60, 30, 'left', 10, 15);
        expect(mockCreateButton).toHaveBeenCalledWith(
          mockPathData, 10, 15, 60, 30,
          { hasText: false, isCutout: false, rx: 0 }
        );
      });

      it('should pass hasText:true if button.text is present', () => {
        chiselEndcapElement.props.button = { enabled: true, text: 'Click' };
        chiselEndcapElement.render();

        expect(mockCreateButton).toHaveBeenCalledWith(
          mockPathData, 10, 15, 60, 30,
          { hasText: true, isCutout: false, rx: 0 }
        );
      });

      it('should pass isCutout:true if button.cutout_text is true', () => {
        chiselEndcapElement.props.button = { enabled: true, text: 'Cutout', cutout_text: true };
        chiselEndcapElement.render();

        expect(mockCreateButton).toHaveBeenCalledWith(
          mockPathData, 10, 15, 60, 30,
          { hasText: true, isCutout: true, rx: 0 }
        );
      });
    });
  });
});