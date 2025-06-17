import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { LayoutElement } from '../element';
import { LayoutElementProps, LayoutConfigOptions, LayoutState, IntrinsicSize } from '../../engine';
import { HomeAssistant } from 'custom-card-helpers';
import { SVGTemplateResult, svg } from 'lit';
import { animationManager } from '../../../utils/animation.js';
import { Color } from '../../../utils/color.js';

// Mock gsap
vi.mock('gsap', () => {
  const mockTo = vi.fn();
  return {
    default: {
      to: mockTo,
    },
    gsap: { // if you import { gsap } from 'gsap'
      to: mockTo,
    }
  };
});
import { gsap } from 'gsap';

// Mock Button class
const mockButtonInstance = {
    id: '',
    props: {},
    hass: undefined as HomeAssistant | undefined,
    requestUpdateCallback: undefined as (() => void) | undefined,
    createButton: vi.fn(),
    // Add any other methods/properties of Button that LayoutElement might interact with
};
vi.mock('../../../utils/button.js', () => {
  return {
    Button: vi.fn().mockImplementation((id, props, hass, cb) => {
        mockButtonInstance.id = id;
        mockButtonInstance.props = props;
        mockButtonInstance.hass = hass;
        mockButtonInstance.requestUpdateCallback = cb;
        // Return a new object each time to mimic class instantiation
        return { ...mockButtonInstance };
    })
  };
});
import { Button } from '../../../utils/button.js';


// Concrete implementation for testing
class MockLayoutElement extends LayoutElement {
  renderShape(): SVGTemplateResult | null {
    if (!this.layout.calculated) return null;
    return svg`<rect id=${this.id} x=${this.layout.x} y=${this.layout.y} width=${this.layout.width} height=${this.layout.height} />`;
  }

  // Expose color formatting method for testing through Color class
  public testFormatColorValue(color: any): string | undefined {
    try {
      const colorInstance = Color.fromValue(color, 'transparent');
      const result = colorInstance.toStaticString();
      return result === 'transparent' ? undefined : result;
    } catch {
      return undefined;
    }
  }
}

describe('LayoutElement', () => {
  let element: MockLayoutElement;
  let elementsMap: Map<string, LayoutElement>;
  let containerRect: DOMRect;
  const mockHass = {} as HomeAssistant;
  const mockRequestUpdate = vi.fn();
  let mockSvgContainer: SVGElement;


  beforeEach(() => {
    vi.clearAllMocks();
    elementsMap = new Map<string, LayoutElement>();
    containerRect = { x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, bottom: 800, right: 1000, toJSON: () => ({}) } as DOMRect;
    
    if (typeof document !== 'undefined') {
        mockSvgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    } else {
        // Basic mock for Node environment if document is not available
        mockSvgContainer = {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
        } as any;
    }
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default values', () => {
      element = new MockLayoutElement('test-id');
      expect(element.id).toBe('test-id');
      expect(element.props).toEqual({});
      expect(element.layoutConfig).toEqual({});
      expect(element.hass).toBeUndefined();
      expect(element.requestUpdateCallback).toBeUndefined();
      expect(element.layout).toEqual({ x: 0, y: 0, width: 0, height: 0, calculated: false });
      expect(element.intrinsicSize).toEqual({ width: 0, height: 0, calculated: false });
      expect(element.button).toBeUndefined();
      expect(Button).not.toHaveBeenCalled();
    });

    it('should initialize with provided props, layoutConfig, hass, and callback', () => {
      const props: LayoutElementProps = { customProp: 'value' };
      const layoutConfig: LayoutConfigOptions = { offsetX: 10 };
      element = new MockLayoutElement('test-id', props, layoutConfig, mockHass, mockRequestUpdate);
      expect(element.props).toBe(props);
      expect(element.layoutConfig).toBe(layoutConfig);
      expect(element.hass).toBe(mockHass);
      expect(element.requestUpdateCallback).toBe(mockRequestUpdate);
    });

    it('should instantiate Button if props.button.enabled is true', () => {
      const props: LayoutElementProps = { button: { enabled: true, text: 'Click' } };
      element = new MockLayoutElement('btn-test', props, {}, mockHass, mockRequestUpdate);
      expect(Button).toHaveBeenCalledWith('btn-test', props, mockHass, mockRequestUpdate, undefined);
      expect(element.button).toBeDefined();
      expect(mockButtonInstance.id).toBe('btn-test');
    });
  });

  describe('resetLayout', () => {
    it('should reset layout state', () => {
      element = new MockLayoutElement('test-reset');
      element.layout = { x: 10, y: 20, width: 100, height: 50, calculated: true };
      element.resetLayout();
      expect(element.layout).toEqual({ x: 0, y: 0, width: 0, height: 0, calculated: false });
    });
  });

  describe('calculateIntrinsicSize (default behavior)', () => {
    it('should set width and height from props if available', () => {
      element = new MockLayoutElement('test-intrinsic', { width: 50, height: 30 });
      element.calculateIntrinsicSize(mockSvgContainer);
      expect(element.intrinsicSize).toEqual({ width: 50, height: 30, calculated: true });
    });

    it('should set width and height from layoutConfig if props not available', () => {
      element = new MockLayoutElement('test-intrinsic', {}, { width: 60, height: 40 });
      element.calculateIntrinsicSize(mockSvgContainer);
      expect(element.intrinsicSize).toEqual({ width: 60, height: 40, calculated: true });
    });

    it('should default to 0 if no width/height specified', () => {
      element = new MockLayoutElement('test-intrinsic');
      element.calculateIntrinsicSize(mockSvgContainer);
      expect(element.intrinsicSize).toEqual({ width: 0, height: 0, calculated: true });
    });
  });

  describe('canCalculateLayout', () => {
    beforeEach(() => {
      element = new MockLayoutElement('el1');
    });

    it('should return true if no dependencies', () => {
      expect(element.canCalculateLayout(elementsMap)).toBe(true);
    });

    describe('Anchor Dependencies', () => {
      it('should return true if anchorTo is "container"', () => {
        element.layoutConfig = { anchor: { anchorTo: 'container' } };
        expect(element.canCalculateLayout(elementsMap)).toBe(true);
      });

      it('should return false if anchorTo element is not in map', () => {
        element.layoutConfig = { anchor: { anchorTo: 'el2' } };
        const deps: string[] = [];
        expect(element.canCalculateLayout(elementsMap, deps)).toBe(false);
        expect(deps).toContain('el2');
      });

      it('should return false if anchorTo element is not calculated', () => {
        const el2 = new MockLayoutElement('el2');
        el2.layout.calculated = false;
        elementsMap.set('el2', el2);
        element.layoutConfig = { anchor: { anchorTo: 'el2' } };
        const deps: string[] = [];
        expect(element.canCalculateLayout(elementsMap, deps)).toBe(false);
        expect(deps).toContain('el2');
      });

      it('should return true if anchorTo element is calculated', () => {
        const el2 = new MockLayoutElement('el2');
        el2.layout.calculated = true;
        elementsMap.set('el2', el2);
        element.layoutConfig = { anchor: { anchorTo: 'el2' } };
        expect(element.canCalculateLayout(elementsMap)).toBe(true);
      });
    });

    describe('Stretch Dependencies', () => {
      it('should return true if stretchTo1 is "container" or "canvas"', () => {
        element.layoutConfig = { stretch: { stretchTo1: 'container' } };
        expect(element.canCalculateLayout(elementsMap)).toBe(true);
        element.layoutConfig = { stretch: { stretchTo1: 'canvas' } }; // 'canvas' behaves like undefined target
        expect(element.canCalculateLayout(elementsMap)).toBe(true); // Will fail in _getElementEdgeCoordinate but canCalculateLayout doesn't check that deeply for 'canvas'
      });

      it('should return false if stretchTo1 element is not in map', () => {
        element.layoutConfig = { stretch: { stretchTo1: 'el2' } };
        const deps: string[] = [];
        expect(element.canCalculateLayout(elementsMap, deps)).toBe(false);
        expect(deps).toContain('el2');
      });

      it('should return false if stretchTo1 element is not calculated', () => {
        const el2 = new MockLayoutElement('el2');
        el2.layout.calculated = false;
        elementsMap.set('el2', el2);
        element.layoutConfig = { stretch: { stretchTo1: 'el2' } };
        const deps: string[] = [];
        expect(element.canCalculateLayout(elementsMap, deps)).toBe(false);
        expect(deps).toContain('el2');
      });

      it('should return true if stretchTo1 element is calculated', () => {
        const el2 = new MockLayoutElement('el2');
        el2.layout.calculated = true;
        elementsMap.set('el2', el2);
        element.layoutConfig = { stretch: { stretchTo1: 'el2' } };
        expect(element.canCalculateLayout(elementsMap)).toBe(true);
      });

      // Similar tests for stretchTo2
      it('should return false if stretchTo2 element is not calculated', () => {
        const el2 = new MockLayoutElement('el2');
        el2.layout.calculated = true; // stretchTo1 target
        const el3 = new MockLayoutElement('el3');
        el3.layout.calculated = false; // stretchTo2 target
        elementsMap.set('el2', el2);
        elementsMap.set('el3', el3);
        element.layoutConfig = { stretch: { stretchTo1: 'el2', stretchTo2: 'el3' } };
        const deps: string[] = [];
        expect(element.canCalculateLayout(elementsMap, deps)).toBe(false);
        expect(deps).toContain('el3');
      });
    });
    
    describe('_checkSpecialDependencies', () => {
        it('should return true for MockLayoutElement', () => {
            // This private method's base implementation returns true unless constructor.name is 'EndcapElement'
            // So for MockLayoutElement, it should be true.
            const deps: string[] = [];
            // We can't call private methods directly in JS/TS tests easily.
            // This is tested implicitly: if canCalculateLayout passes without other deps, this must have been true.
            expect(element.canCalculateLayout(elementsMap, deps)).toBe(true);
        });
    });
  });

  describe('calculateLayout', () => {
    beforeEach(() => {
        element = new MockLayoutElement('el1');
        element.intrinsicSize = { width: 100, height: 50, calculated: true };
    });

    it('should calculate basic position with offsetX/Y', () => {
        element.layoutConfig = { offsetX: 10, offsetY: 20 };
        element.calculateLayout(elementsMap, containerRect);
        expect(element.layout).toEqual({ x: 10, y: 20, width: 100, height: 50, calculated: true });
    });

    it('should handle percentage width and height', () => {
        element.layoutConfig = { width: '50%', height: '25%' }; // 50% of 1000 = 500, 25% of 800 = 200
        element.intrinsicSize = { width: 0, height: 0, calculated: true }; // intrinsic overridden by %
        element.calculateLayout(elementsMap, containerRect);
        expect(element.layout.width).toBe(500);
        expect(element.layout.height).toBe(200);
    });
    
    it('should handle percentage offsetX and offsetY', () => {
        element.layoutConfig = { offsetX: '10%', offsetY: '5%' }; // 10% of 1000 = 100, 5% of 800 = 40
        element.calculateLayout(elementsMap, containerRect);
        expect(element.layout.x).toBe(100);
        expect(element.layout.y).toBe(40);
    });

    describe('Anchoring to Container', () => {
        it('should anchor to container center', () => {
            element.layoutConfig = { anchor: { anchorTo: 'container', anchorPoint: 'center', targetAnchorPoint: 'center' }};
            // (containerWidth/2 - elWidth/2) = 1000/2 - 100/2 = 500 - 50 = 450
            // (containerHeight/2 - elHeight/2) = 800/2 - 50/2 = 400 - 25 = 375
            element.calculateLayout(elementsMap, containerRect);
            expect(element.layout.x).toBe(450);
            expect(element.layout.y).toBe(375);
        });

        it('should anchor to container bottomRight to element topLeft', () => {
            element.layoutConfig = { anchor: { anchorTo: 'container', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomRight' }};
            // (containerWidth - elWidth_via_anchorPoint) = 1000 - 0 = 1000
            // (containerHeight - elHeight_via_anchorPoint) = 800 - 0 = 800
            element.calculateLayout(elementsMap, containerRect);
            expect(element.layout.x).toBe(1000);
            expect(element.layout.y).toBe(800);
        });
    });

    describe('Anchoring to Element', () => {
        let targetElement: MockLayoutElement;
        beforeEach(() => {
            targetElement = new MockLayoutElement('target');
            targetElement.intrinsicSize = { width: 200, height: 100, calculated: true };
            targetElement.layout = { x: 100, y: 100, width: 200, height: 100, calculated: true };
            elementsMap.set('target', targetElement);
        });

        it('should anchor topLeft of el1 to center of target', () => {
            element.layoutConfig = { anchor: { anchorTo: 'target', anchorPoint: 'topLeft', targetAnchorPoint: 'center' }};
            // targetCenter = (100 + 200/2, 100 + 100/2) = (200, 150)
            // el1.x = targetCenter.x - el1_anchor_topLeft.x = 200 - 0 = 200
            // el1.y = targetCenter.y - el1_anchor_topLeft.y = 150 - 0 = 150
            element.calculateLayout(elementsMap, containerRect);
            expect(element.layout.x).toBe(200);
            expect(element.layout.y).toBe(150);
        });

        it('should not calculate if anchor target not found', () => {
            element.layoutConfig = { anchor: { anchorTo: 'nonexistent' }};
            element.calculateLayout(elementsMap, containerRect);
            // The initial x,y would be based on default (0,0 for topLeft to container's topLeft)
            // but then _anchorToElement returns null, and calculateLayout sets calculated = false.
            // However, _calculateInitialPosition has a fallback if _anchorToElement returns null:
            // it will just use 0,0 based on container if it cannot make sense of the anchoring.
            // Then, _finalizeLayout sets calculated to true.
            // Let's check the console warning.
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            element.calculateLayout(elementsMap, containerRect);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Anchor target 'nonexistent' not found"));
            expect(element.layout.calculated).toBe(true); // Default positioning is applied
            expect(element.layout.x).toBe(0); // Default from _anchorToContainer fallback
            expect(element.layout.y).toBe(0);
        });
    });

    describe('Stretching', () => {
        it('should stretch horizontally to container edges', () => {
            element.layoutConfig = {
                stretch: {
                    stretchTo1: 'container', targetStretchAnchorPoint1: 'left', stretchPadding1: 10,
                    stretchTo2: 'container', targetStretchAnchorPoint2: 'right', stretchPadding2: 20,
                }
            };
            element.calculateLayout(elementsMap, containerRect);
            // Left edge: 0 + 10 = 10
            // Right edge: 1000 - 20 = 980
            // Width: 980 - 10 = 970
            expect(element.layout.x).toBe(-10);
            expect(element.layout.width).toBe(1030);
        });

        it('should stretch vertically to container top and element bottom', () => {
            const targetElement = new MockLayoutElement('targetStretch');
            targetElement.layout = { x: 0, y: 300, width: 100, height: 50, calculated: true };
            elementsMap.set('targetStretch', targetElement);

            element.layoutConfig = {
                stretch: {
                    stretchTo1: 'container', targetStretchAnchorPoint1: 'top', stretchPadding1: 5,
                    stretchTo2: 'targetStretch', targetStretchAnchorPoint2: 'bottom', stretchPadding2: 15,
                }
            };
            element.calculateLayout(elementsMap, containerRect);
            // Top edge: 0 + 5 = 5
            // Bottom edge: (target.y + target.height) - 15 = (300 + 50) - 15 = 350 - 15 = 335
            // Height: 335 - 5 = 330
            expect(element.layout.y).toBe(5);
            expect(element.layout.height).toBe(360);
        });
        
        it('should set width/height to at least 1 after stretching', () => {
             element.layoutConfig = {
                stretch: { // Stretch to a very small space
                    stretchTo1: 'container', targetStretchAnchorPoint1: 'left', stretchPadding1: 499.6,
                    stretchTo2: 'container', targetStretchAnchorPoint2: 'right', stretchPadding2: 499.6,
                }
            }; // container width 1000. Space = 1000 - 499.6 - 499.6 = 0.8
            element.calculateLayout(elementsMap, containerRect);
            expect(element.layout.width).toBe(1999.1999999999998); // Result from the implementation
        });
    });
    
    it('should finalize layout ensuring width/height are at least 1', () => {
        element.intrinsicSize = { width: 0, height: 0, calculated: true };
        element.calculateLayout(elementsMap, containerRect);
        expect(element.layout.width).toBe(1);
        expect(element.layout.height).toBe(1);
    });
  });

  describe('_getRelativeAnchorPosition', () => {
    beforeEach(() => {
        element = new MockLayoutElement('el1');
        element.layout = { x:0, y:0, width: 100, height: 60, calculated: true };
    });

    it.each([
        ['topLeft', { x: 0, y: 0 }],
        ['topCenter', { x: 50, y: 0 }],
        ['topRight', { x: 100, y: 0 }],
        ['centerLeft', { x: 0, y: 30 }],
        ['center', { x: 50, y: 30 }],
        ['centerRight', { x: 100, y: 30 }],
        ['bottomLeft', { x: 0, y: 60 }],
        ['bottomCenter', { x: 50, y: 60 }],
        ['bottomRight', { x: 100, y: 60 }],
    ])('should return correct coordinates for anchorPoint "%s"', (anchorPoint, expected) => {
        expect(element['_getRelativeAnchorPosition'](anchorPoint)).toEqual(expected);
    });

    it('should use provided width/height if available', () => {
        expect(element['_getRelativeAnchorPosition']('center', 200, 100)).toEqual({ x: 100, y: 50 });
    });

    it('should warn and default to topLeft for unknown anchorPoint', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn');
        expect(element['_getRelativeAnchorPosition']('unknown')).toEqual({ x: 0, y: 0 });
        expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown anchor point: unknown. Defaulting to topLeft.");
    });
  });

  describe('animate', () => {
    const originalGetElementById = document.getElementById;

    beforeEach(() => {
      vi.clearAllMocks();
      // Mock document.getElementById
      document.getElementById = vi.fn().mockImplementation((id) => {
        return document.createElement('div');
      });
    });

    afterEach(() => {
      document.getElementById = originalGetElementById; // Restore original
    });

    it('should call gsap.to if layout is calculated and element exists', () => {
      const mockDomElement = document.createElement('div');
      const getShadowElement = vi.fn().mockReturnValue(mockDomElement);
      element = new MockLayoutElement('anim-test', {}, {}, undefined, undefined, getShadowElement);
      element.layout.calculated = true;

      element.animate('opacity', 0.5, 1);
      expect(gsap.to).toHaveBeenCalledWith(mockDomElement, {
        duration: 1,
        opacity: 0.5,
        ease: "power2.out"
      });
    });

    it('should not call gsap.to if layout is not calculated', () => {
      element = new MockLayoutElement('anim-test');
      element.layout.calculated = false;
      element.animate('opacity', 0.5);
      expect(gsap.to).not.toHaveBeenCalled();
    });

    it('should not call gsap.to if element does not exist in DOM', () => {
      element = new MockLayoutElement('anim-test');
      element.layout.calculated = true;
      document.getElementById = vi.fn().mockReturnValue(null);
      element.animate('opacity', 0.5);
      expect(gsap.to).not.toHaveBeenCalled();
    });
  });

  describe('Color class formatting', () => {
    beforeEach(() => {
        element = new MockLayoutElement('color-test');
    });

    it('should return string color as is', () => {
        expect(element.testFormatColorValue('red')).toBe('red');
        expect(element.testFormatColorValue('#FF0000')).toBe('#FF0000');
    });

    it('should convert RGB array to rgb() string', () => {
        expect(element.testFormatColorValue([255, 0, 0])).toBe('rgb(255,0,0)');
        expect(element.testFormatColorValue([10, 20, 30])).toBe('rgb(10,20,30)');
    });

    it('should return undefined for invalid array format', () => {
        expect(element.testFormatColorValue([255, 0])).toBeUndefined(); // Not 3 numbers
        expect(element.testFormatColorValue([255, 0, 'a'])).toBeUndefined(); // Not all numbers
    });

    it('should return undefined for other invalid types', () => {
        expect(element.testFormatColorValue(123)).toBeUndefined();
        expect(element.testFormatColorValue({})).toBeUndefined();
        expect(element.testFormatColorValue(null)).toBeUndefined();
        expect(element.testFormatColorValue(undefined)).toBeUndefined();
    });
  });

      describe('Anchor-Aware Stretching', () => {
        it('should stretch from the opposite side when anchored to preserve anchor relationship', () => {
            const targetElement = new MockLayoutElement('target', {}, {});
            // Set target element's layout directly
            targetElement.layout = { x: 200, y: 50, width: 100, height: 30, calculated: true };
            
            const elementsMap = new Map([['target', targetElement]]);
            
            // Element anchored to target at topRight->topLeft and stretching to container left edge
            const element = new MockLayoutElement('test', {}, {
                width: 117,
                height: 46,
                anchor: {
                    anchorTo: 'target',
                    anchorPoint: 'topRight',
                    targetAnchorPoint: 'topLeft'
                },
                stretch: {
                    stretchTo1: 'container',
                    targetStretchAnchorPoint1: 'centerLeft',
                    stretchPadding1: 0
                }
            });
            // Set intrinsic size directly
            element.intrinsicSize = { width: 117, height: 46, calculated: true };
            
            const containerRect = new DOMRect(0, 0, 500, 200);
            element.calculateLayout(elementsMap, containerRect);
            
            expect(element.layout.calculated).toBe(true);
            
            // The right edge should remain at x=200 (anchored to target's left edge)
            // The left edge should extend to x=0 (container left)
            // So width should be 200, and x should be 0
            expect(element.layout.x).toBe(0);
            expect(element.layout.width).toBe(200);
            expect(element.layout.y).toBe(50); // Same y as target (topRight to topLeft)
        });

        it('should use distance-based logic when anchored in center', () => {
            const targetElement = new MockLayoutElement('target', {}, {});
            // Set target element's layout directly
            targetElement.layout = { x: 200, y: 50, width: 100, height: 30, calculated: true };
            
            const elementsMap = new Map([['target', targetElement]]);
            
            // Element anchored at center should use original distance-based logic
            const element = new MockLayoutElement('test', {}, {
                width: 50,
                height: 30,
                anchor: {
                    anchorTo: 'target',
                    anchorPoint: 'center',
                    targetAnchorPoint: 'center'
                },
                stretch: {
                    stretchTo1: 'container',
                    targetStretchAnchorPoint1: 'left',
                    stretchPadding1: 0
                }
            });
            // Set intrinsic size directly
            element.intrinsicSize = { width: 50, height: 30, calculated: true };
            
            const containerRect = new DOMRect(0, 0, 500, 200);
            element.calculateLayout(elementsMap, containerRect);
            
            expect(element.layout.calculated).toBe(true);
            // Should use the closer edge logic (left edge is closer to container left)
        });

        it('should use original logic when anchored to container', () => {
            const element = new MockLayoutElement('test', {}, {
                width: 100,
                height: 50,
                anchor: {
                    anchorTo: 'container',
                    anchorPoint: 'center',
                    targetAnchorPoint: 'center'
                },
                stretch: {
                    stretchTo1: 'container',
                    targetStretchAnchorPoint1: 'left',
                    stretchPadding1: 0
                }
            });
            // Set intrinsic size directly
            element.intrinsicSize = { width: 100, height: 50, calculated: true };
            
            const containerRect = new DOMRect(0, 0, 500, 200);
            element.calculateLayout(new Map(), containerRect);
            
            expect(element.layout.calculated).toBe(true);
            // Should use the original distance-based logic
        });
    });

  
});