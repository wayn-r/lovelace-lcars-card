// lovelace-lcars-card/src/layout/elements/elbow.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

// Important: vi.mock calls are hoisted to the top of the file 
// so they must come before any imports of the mocked modules
vi.mock('../../../utils/button.js', () => ({
  Button: vi.fn().mockImplementation((id, props, hass, cb) => ({
    id,
    props,
    hass,
    requestUpdateCallback: cb,
    createButton: vi.fn(),
  }))
}));

vi.mock('../../../utils/shapes.js', () => ({
  ShapeGenerator: {
    generateElbow: vi.fn().mockImplementation(
      (x, elbowWidth, bodyWidth, armHeight, height, orientation, y, outerCornerRadius) => 
        `MOCK_PATH_elbow_${orientation}_${elbowWidth}x${height}_body${bodyWidth}_arm${armHeight}_at_${x},${y}_r${outerCornerRadius}`
    )
  }
}));

// Import mocked modules after mock setup
import { ElbowElement } from '../elbow';
import { Button } from '../../../utils/button.js';
import { LayoutElement } from '../element.js';
import { ShapeGenerator } from '../../../utils/shapes.js';
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
      expect(Button).toHaveBeenCalledWith('el-btn-init', props, mockHass, mockRequestUpdate, undefined, undefined);
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
      (ShapeGenerator.generateElbow as any).mockReturnValueOnce(null as unknown as string);
      expect(elbowElement.render()).toBeNull();
    });

    describe('Non-Button Rendering', () => {
      it('should render a basic elbow path with default props', () => {
        elbowElement.layout = { x: 5, y: 10, width: 100, height: 80, calculated: true };
        const result = elbowElement.render();
        expect(result).toMatchSnapshot();

        const defaultBodyWidth = 30;
        const defaultArmHeight = 30;
        expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(5, 100, defaultBodyWidth, defaultArmHeight, 80, 'top-left', 10, defaultArmHeight);
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

        expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(0, 120, 40, 20, 90, 'bottom-right', 0, 20);
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
          expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(10, 100, 30, 30, 100, orientation, 20, 30);
        });
      });
    });

    describe('Button Rendering', () => {
      const mockPathData = 'MOCK_BUTTON_PATH_ELBOW';
      const layoutX = 10, layoutY = 15, layoutWidth = 120, layoutHeight = 110;
      const propsBodyWidth = 35, propsArmHeight = 25, propsElbowWidth = 100;

      beforeEach(() => {
        vi.mocked(ShapeGenerator.generateElbow).mockReturnValue(mockPathData);
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
        expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(layoutX, propsElbowWidth, propsBodyWidth, propsArmHeight, layoutHeight, 'top-left', layoutY, propsArmHeight);
        expect(elbowElement.button?.createButton).toHaveBeenCalledTimes(1);
        expect(elbowElement.button?.createButton).toHaveBeenCalledWith(
          mockPathData, layoutX, layoutY, layoutWidth, layoutHeight, // Note: layoutWidth, not propsElbowWidth
          { rx: 0 },
          { isCurrentlyHovering: false, isCurrentlyActive: false }
        );
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
      expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(10, stretchedWidth, 30, 25, 80, 'top-left', 15, 25);
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
      expect(ShapeGenerator.generateElbow).toHaveBeenCalledWith(10, configuredWidth, 30, 25, 80, 'top-left', 15, 25);
    });
  });

  describe('Text Positioning', () => {
    beforeEach(() => {
      elbowElement.layout = { x: 10, y: 20, width: 100, height: 80, calculated: true };
      elbowElement.props = {
        orientation: 'top-left',
        bodyWidth: 30,
        armHeight: 25,
        width: 100
      };
    });

    it('should position text in arm when elbowTextPosition is "arm"', () => {
      elbowElement.props.elbowTextPosition = 'arm';
      elbowElement.props.orientation = 'top-left'; // arm is at top for top orientations
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of arm (horizontal part extending from left body)
      expect(position.x).toBe(75); // x + bodyWidth + (width - bodyWidth) / 2 = 10 + 30 + (100-30)/2 = 75
      expect(position.y).toBe(32.5); // y + armHeight / 2 = 20 + 25/2 (top orientation)
    });

    it('should position text in body when elbowTextPosition is "body" for top-left orientation', () => {
      elbowElement.props.elbowTextPosition = 'body';
      elbowElement.props.orientation = 'top-left';
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of body (vertical part)
      expect(position.x).toBe(25); // x + bodyWidth / 2 = 10 + 30/2
      expect(position.y).toBe(72.5); // y + armHeight + (height - armHeight) / 2 = 20 + 25 + (80-25)/2
    });

    it('should position text in body when elbowTextPosition is "body" for top-right orientation', () => {
      elbowElement.props.elbowTextPosition = 'body';
      elbowElement.props.orientation = 'top-right';
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of body on the right side
      expect(position.x).toBe(95); // x + width - bodyWidth / 2 = 10 + 100 - 30/2 = 95
      expect(position.y).toBe(72.5); // y + armHeight + (height - armHeight) / 2 = 20 + 25 + (80-25)/2
    });

    it('should position text in body when elbowTextPosition is "body" for bottom-left orientation', () => {
      elbowElement.props.elbowTextPosition = 'body';
      elbowElement.props.orientation = 'bottom-left';
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of body (upper part for bottom orientation)
      expect(position.x).toBe(25); // x + bodyWidth / 2 = 10 + 30/2
      expect(position.y).toBe(47.5); // y + (height - armHeight) / 2 = 20 + (80-25)/2
    });

    it('should position text in body when elbowTextPosition is "body" for bottom-right orientation', () => {
      elbowElement.props.elbowTextPosition = 'body';
      elbowElement.props.orientation = 'bottom-right';
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of body on the right side (upper part for bottom orientation)
      expect(position.x).toBe(95); // x + width - bodyWidth / 2 = 10 + 100 - 30/2 = 95
      expect(position.y).toBe(47.5); // y + (height - armHeight) / 2 = 20 + (80-25)/2
    });

    it('should default to arm positioning when elbowTextPosition is not specified', () => {
      // Don't set elbowTextPosition, default orientation is top-left
      const position = (elbowElement as any).getTextPosition();
      
      // Should default to arm positioning (extending from left body)
      expect(position.x).toBe(75); // x + bodyWidth + (width - bodyWidth) / 2 = 10 + 30 + (100-30)/2 = 75
      expect(position.y).toBe(32.5); // y + armHeight / 2 = 20 + 25/2 (top orientation)
    });

    it('should position text in arm correctly for bottom orientations', () => {
      elbowElement.props.elbowTextPosition = 'arm';
      elbowElement.props.orientation = 'bottom-left'; // arm is at bottom for bottom orientations
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of arm at the bottom (extending from left body)
      expect(position.x).toBe(75); // x + bodyWidth + (width - bodyWidth) / 2 = 10 + 30 + (100-30)/2 = 75
      expect(position.y).toBe(87.5); // y + height - armHeight / 2 = 20 + 80 - 25/2 = 87.5
    });

    it('should position text in arm correctly for right-side orientations', () => {
      elbowElement.props.elbowTextPosition = 'arm';
      elbowElement.props.orientation = 'top-right'; // arm is at top, body on right
      const position = (elbowElement as any).getTextPosition();
      
      // Should position at center of arm (extending from right body to left)
      expect(position.x).toBe(45); // x + (width - bodyWidth) / 2 = 10 + (100-30)/2 = 45
      expect(position.y).toBe(32.5); // y + armHeight / 2 = 20 + 25/2 (top orientation)
    });

    it('should handle stretching correctly when positioning text', () => {
      // Set up stretch configuration
      elbowElement.layoutConfig.stretch = { stretchTo1: 'some-element' };
      elbowElement.layout.width = 150; // Stretched width
      elbowElement.props.width = 100; // Original configured width
      elbowElement.props.elbowTextPosition = 'arm';
      elbowElement.props.orientation = 'top-left'; // Specify orientation for clarity
      
      const position = (elbowElement as any).getTextPosition();
      
      // Should use stretched width for arm positioning (extending from left body)
      expect(position.x).toBe(100); // x + bodyWidth + (stretchedWidth - bodyWidth) / 2 = 10 + 30 + (150-30)/2 = 100
      expect(position.y).toBe(32.5); // y + armHeight / 2 = 20 + 25/2 (top orientation)
    });
  });
});