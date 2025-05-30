// lovelace-lcars-card/src/layout/elements/elbow.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

// Important: vi.mock calls are hoisted to the top of the file 
// so they must come before any imports of the mocked modules
vi.mock('../button.js', () => ({
  Button: vi.fn().mockImplementation((id, props, hass, cb) => ({
    id,
    props,
    hass,
    requestUpdateCallback: cb,
    createButton: vi.fn(),
  }))
}));

vi.mock('../../../utils/shapes.js', () => ({
  generateElbowPath: vi.fn().mockImplementation(
    (x, elbowWidth, bodyWidth, armHeight, height, orientation, y, outerCornerRadius) => 
      `MOCK_PATH_elbow_${orientation}_${elbowWidth}x${height}_body${bodyWidth}_arm${armHeight}_at_${x},${y}_r${outerCornerRadius}`
  )
}));

// Import mocked modules after mock setup
import { ElbowElement } from '../elbow';
import { Button } from '../button.js';
import { LayoutElement } from '../element.js';
import { generateElbowPath } from '../../../utils/shapes.js';
import { svg, SVGTemplateResult } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';

describe('ElbowElement', () => {
  let elbowElement: ElbowElement;
  const mockHass: HomeAssistant = {} as HomeAssistant; // Simplified HomeAssistant mock
  const mockRequestUpdate = vi.fn();
  const mockContainerRect: DOMRect = { x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, bottom: 800, right: 1000, toJSON: () => ({}) };
  let elementsMap: Map<string, LayoutElement>;
  
  // For accessing the mocked functions directly
  let mockCreateButton: any;

  // Spies for superclass methods
  let superCalculateLayoutSpy: MockInstance;
  let superCanCalculateLayoutSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    elementsMap = new Map<string, LayoutElement>();

    // Setup spies on the prototype of the superclass
    superCalculateLayoutSpy = vi.spyOn(LayoutElement.prototype, 'calculateLayout');
    superCanCalculateLayoutSpy = vi.spyOn(LayoutElement.prototype, 'canCalculateLayout');
    
    // Set up mockCreateButton
    mockCreateButton = vi.fn();
  });

  afterEach(() => {
    // Restore the original methods
    superCalculateLayoutSpy.mockRestore();
    superCanCalculateLayoutSpy.mockRestore();
  });

  // Helper to get attributes from the SVGTemplateResult for non-button rendering
  const getPathAttributes = (result: SVGTemplateResult | null): Record<string, any> | null => {
    if (!result || !result.values || result.values.length < 5) return null;
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
      elbowElement = new ElbowElement('el-min');
      expect(elbowElement.id).toBe('el-min');
      expect(elbowElement.props).toEqual({});
      expect(elbowElement.layoutConfig).toEqual({});
      expect(elbowElement.button).toBeUndefined();
      expect(Button).not.toHaveBeenCalled();
    });

    it('should instantiate Button if button.enabled is true in props', () => {
      const props = { button: { enabled: true } };
      elbowElement = new ElbowElement('el-btn-init', props, {}, mockHass, mockRequestUpdate);

      expect(Button).toHaveBeenCalledOnce();
      expect(Button).toHaveBeenCalledWith('el-btn-init', props, mockHass, mockRequestUpdate, undefined);
      expect(elbowElement.button).toBeDefined();
    });

    it('should NOT instantiate Button if button.enabled is false or button prop is missing', () => {
      elbowElement = new ElbowElement('el-no-btn1', { button: { enabled: false } });
      expect(Button).not.toHaveBeenCalled();
      expect(elbowElement.button).toBeUndefined();

      vi.clearAllMocks();

      elbowElement = new ElbowElement('el-no-btn2', {});
      expect(Button).not.toHaveBeenCalled();
      expect(elbowElement.button).toBeUndefined();
    });
  });

  describe('calculateIntrinsicSize', () => {
    const mockSvgContainer = {} as SVGElement;

    it('should set width from props, layoutConfig, or default to 100', () => {
      elbowElement = new ElbowElement('el-is1', { width: 50 });
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.width).toBe(50);

      elbowElement = new ElbowElement('el-is2', {}, { width: 60 });
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.width).toBe(60);

      elbowElement = new ElbowElement('el-is3');
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.width).toBe(100);
    });

    it('should set height from props, layoutConfig, or default to 100', () => {
      elbowElement = new ElbowElement('el-is4', { height: 30 });
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.height).toBe(30);

      elbowElement = new ElbowElement('el-is5', {}, { height: 20 });
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.height).toBe(20);

      elbowElement = new ElbowElement('el-is6');
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.height).toBe(100);
    });

    it('should set intrinsicSize.calculated to true', () => {
      elbowElement = new ElbowElement('el-is-calc');
      elbowElement.calculateIntrinsicSize(mockSvgContainer);
      expect(elbowElement.intrinsicSize.calculated).toBe(true);
    });
  });

  describe('canCalculateLayout', () => {
    it('should call super.canCalculateLayout', () => {
      elbowElement = new ElbowElement('el-ccl');
      superCanCalculateLayoutSpy.mockReturnValue(true);
      expect(elbowElement.canCalculateLayout(elementsMap)).toBe(true);
      expect(superCanCalculateLayoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateLayout', () => {
    it('should call super.calculateLayout', () => {
      elbowElement = new ElbowElement('el-cl');
      elbowElement.intrinsicSize = { width: 100, height: 100, calculated: true };
      superCalculateLayoutSpy.mockImplementation(function(this: LayoutElement) {
        this.layout = { ...this.intrinsicSize, x:0, y:0, calculated: true };
      });
      elbowElement.calculateLayout(elementsMap, mockContainerRect);
      expect(superCalculateLayoutSpy).toHaveBeenCalledTimes(1);
      expect(elbowElement.layout.calculated).toBe(true);
    });
  });

  describe('render', () => {
    beforeEach(() => {
      elbowElement = new ElbowElement('el-render');
    });

    it('should return null if layout.calculated is false', () => {
      elbowElement.layout = { x: 0, y: 0, width: 10, height: 10, calculated: false };
      expect(elbowElement.render()).toBeNull();
    });

    it('should return null if layout.height <= 0', () => {
      elbowElement.layout = { x: 0, y: 0, width: 10, height: 0, calculated: true };
      expect(elbowElement.render()).toBeNull();
    });

    it('should return null if layout.width <= 0', () => {
      elbowElement.layout = { x: 0, y: 0, width: 0, height: 10, calculated: true };
      expect(elbowElement.render()).toBeNull();
    });

    it('should return null if generateElbowPath returns null', () => {
      elbowElement.layout = { x: 5, y: 10, width: 40, height: 20, calculated: true };
      (generateElbowPath as any).mockReturnValueOnce(null as unknown as string);
      expect(elbowElement.render()).toBeNull();
    });

    describe('Non-Button Rendering', () => {
      it('should render a basic elbow path with default props', () => {
        elbowElement.layout = { x: 5, y: 10, width: 100, height: 80, calculated: true };
        const result = elbowElement.render();
        expect(result).toMatchSnapshot();

        const defaultBodyWidth = 30;
        const defaultArmHeight = 30;
        expect(generateElbowPath).toHaveBeenCalledWith(5, 100, defaultBodyWidth, defaultArmHeight, 80, 'top-left', 10, defaultArmHeight);
        const attrs = getPathAttributes(result);
        expect(attrs?.id).toBe('el-render');
        expect(attrs?.fill).toBe('none');
        expect(attrs?.stroke).toBe('none');
        expect(attrs?.['stroke-width']).toBe('0');
      });

      it('should render with specified props (fill, stroke, orientation, bodyWidth, armHeight)', () => {
        elbowElement.props = {
          fill: 'red', stroke: 'blue', strokeWidth: '2',
          orientation: 'bottom-right', bodyWidth: 40, armHeight: 20, width: 120 // props.width is elbowWidth
        };
        elbowElement.layout = { x: 0, y: 0, width: 150, height: 90, calculated: true }; // layout.width is for total element bounds
        const result = elbowElement.render();
        expect(result).toMatchSnapshot();

        expect(generateElbowPath).toHaveBeenCalledWith(0, 120, 40, 20, 90, 'bottom-right', 0, 20);
        const attrs = getPathAttributes(result);
        expect(attrs?.fill).toBe('red');
        expect(attrs?.stroke).toBe('blue');
        expect(attrs?.['stroke-width']).toBe('2');
      });

      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(orientation => {
        it(`should render correctly for orientation: ${orientation}`, () => {
          elbowElement.props = { orientation: orientation as any };
          elbowElement.layout = { x: 10, y: 20, width: 100, height: 100, calculated: true };
          const result = elbowElement.render();
          expect(result).toMatchSnapshot();
          expect(generateElbowPath).toHaveBeenCalledWith(10, 100, 30, 30, 100, orientation, 20, 30);
        });
      });
    });

    describe('Button Rendering', () => {
      const mockPathData = 'MOCK_BUTTON_PATH_ELBOW';
      const layoutX = 10, layoutY = 15, layoutWidth = 120, layoutHeight = 110;
      const propsBodyWidth = 35, propsArmHeight = 25, propsElbowWidth = 100;

      beforeEach(() => {
        vi.mocked(generateElbowPath).mockReturnValue(mockPathData);
        const props = {
          button: { enabled: true },
          bodyWidth: propsBodyWidth,
          armHeight: propsArmHeight,
          width: propsElbowWidth // This is elbowWidth from props
        };
        elbowElement = new ElbowElement('el-render-btn', props, {}, mockHass, mockRequestUpdate);
        elbowElement.layout = { x: layoutX, y: layoutY, width: layoutWidth, height: layoutHeight, calculated: true };
      });

      it('should call button.createButton with correct pathData and dimensions', () => {
        elbowElement.render();
        expect(generateElbowPath).toHaveBeenCalledWith(layoutX, propsElbowWidth, propsBodyWidth, propsArmHeight, layoutHeight, 'top-left', layoutY, propsArmHeight);
        expect(elbowElement.button?.createButton).toHaveBeenCalledTimes(1);
        expect(elbowElement.button?.createButton).toHaveBeenCalledWith(
          mockPathData, layoutX, layoutY, layoutWidth, layoutHeight, // Note: layoutWidth, not propsElbowWidth for button bounding box
          expect.objectContaining({ hasText: false, isCutout: false, rx: 0 })
        );
      });

      it('should pass hasText:true if button.text is present', () => {
        elbowElement.props.button.text = 'Click';
        elbowElement.render();
        expect(elbowElement.button?.createButton).toHaveBeenCalledWith(
          mockPathData, layoutX, layoutY, layoutWidth, layoutHeight,
          expect.objectContaining({ hasText: true })
        );
      });

      it('should pass isCutout:true if button.cutout_text is true', () => {
        elbowElement.props.button.text = 'Cutout';
        elbowElement.props.button.cutout_text = true;
        elbowElement.render();
        expect(elbowElement.button?.createButton).toHaveBeenCalledWith(
          mockPathData, layoutX, layoutY, layoutWidth, layoutHeight,
          expect.objectContaining({ isCutout: true })
        );
      });

      describe('Custom Text Position Calculation', () => {
        const testCases = [
          // elbowTextPosition: 'top' (default)
          { elbowTextPos: 'top', orientation: 'top-left', expectedX: layoutX + propsElbowWidth / 2, expectedY: layoutY + propsArmHeight / 2 },
          { elbowTextPos: 'top', orientation: 'top-right', expectedX: layoutX + propsElbowWidth / 2, expectedY: layoutY + propsArmHeight / 2 },
          { elbowTextPos: 'top', orientation: 'bottom-left', expectedX: layoutX + propsElbowWidth / 2, expectedY: layoutY + propsArmHeight / 2 },
          { elbowTextPos: 'top', orientation: 'bottom-right', expectedX: layoutX + propsElbowWidth / 2, expectedY: layoutY + propsArmHeight / 2 },

          // elbowTextPosition: 'side'
          { elbowTextPos: 'side', orientation: 'top-left',
            expectedX: layoutX + propsBodyWidth / 2,
            expectedY: layoutY + propsArmHeight + (layoutHeight - propsArmHeight) / 2 },
          { elbowTextPos: 'side', orientation: 'top-right',
            expectedX: layoutX + propsElbowWidth - propsBodyWidth / 2,
            expectedY: layoutY + propsArmHeight + (layoutHeight - propsArmHeight) / 2 },
          { elbowTextPos: 'side', orientation: 'bottom-left',
            expectedX: layoutX + propsBodyWidth / 2,
            expectedY: layoutY + (layoutHeight - propsArmHeight) / 2 },
          { elbowTextPos: 'side', orientation: 'bottom-right',
            expectedX: layoutX + propsElbowWidth - propsBodyWidth / 2,
            expectedY: layoutY + (layoutHeight - propsArmHeight) / 2 },
        ];

        testCases.forEach(({ elbowTextPos, orientation, expectedX, expectedY }) => {
          it(`should calculate text position correctly for elbowTextPosition: ${elbowTextPos}, orientation: ${orientation}`, () => {
            elbowElement.props.button.text = "Test Text";
            elbowElement.props.elbowTextPosition = elbowTextPos;
            elbowElement.props.orientation = orientation as any;
            elbowElement.render();

            expect(elbowElement.button?.createButton).toHaveBeenCalledWith(
              mockPathData, layoutX, layoutY, layoutWidth, layoutHeight,
              expect.objectContaining({
                customTextPosition: {
                  x: expectedX,
                  y: expectedY
                }
              })
            );
          });
        });
      });
    });
  });

  describe('Stretching Behavior', () => {
    it('should use calculated layout width when stretch configuration is present', () => {
      const configuredWidth = 100;
      const stretchedWidth = 200;
      
      elbowElement = new ElbowElement('el-stretch', 
        { width: configuredWidth, bodyWidth: 30, armHeight: 25 },
        { stretch: { stretchTo1: 'container', targetStretchAnchorPoint1: 'left' } }
      );
      
      // Simulate layout being calculated with stretched width
      elbowElement.layout = { 
        x: 10, y: 15, 
        width: stretchedWidth, height: 80, 
        calculated: true 
      };
      
      elbowElement.render();
      
      // Should use stretchedWidth (200) not configuredWidth (100) for elbow path generation
      expect(generateElbowPath).toHaveBeenCalledWith(10, stretchedWidth, 30, 25, 80, 'top-left', 15, 25);
    });

    it('should use configured width when no stretch configuration is present', () => {
      const configuredWidth = 100;
      const layoutWidth = 200; // This might be different due to anchor positioning, but no stretch config
      
      elbowElement = new ElbowElement('el-no-stretch', 
        { width: configuredWidth, bodyWidth: 30, armHeight: 25 },
        {} // No stretch configuration
      );
      
      // Simulate layout being calculated 
      elbowElement.layout = { 
        x: 10, y: 15, 
        width: layoutWidth, height: 80, 
        calculated: true 
      };
      
      elbowElement.render();
      
      // Should use configuredWidth (100) not layoutWidth (200) for elbow path generation
      expect(generateElbowPath).toHaveBeenCalledWith(10, configuredWidth, 30, 25, 80, 'top-left', 15, 25);
    });
  });
});