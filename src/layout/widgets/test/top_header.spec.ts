import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TopHeaderWidget } from '../top_header.js';
import { RectangleElement } from '../../elements/rectangle.js';
import { EndcapElement } from '../../elements/endcap.js';
import { TextElement } from '../../elements/text.js';
import { LayoutElementProps, LayoutConfigOptions } from '../../engine.js';
import { HomeAssistant } from 'custom-card-helpers';

describe('TopHeaderWidget', () => {
  let widget: TopHeaderWidget;
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
  });

  describe('Constructor', () => {
    it('should initialize as a Widget subclass', () => {
      widget = new TopHeaderWidget('header-test');
      
      expect(widget).toBeInstanceOf(TopHeaderWidget);
      expect(typeof widget.expand).toBe('function');
    });

    it('should accept all constructor parameters', () => {
      const props: LayoutElementProps = { fill: '#FF0000', height: 40 };
      const layoutConfig: LayoutConfigOptions = { offsetX: 10 };
      
      widget = new TopHeaderWidget(
        'full-header',
        props,
        layoutConfig,
        mockHass,
        mockRequestUpdate,
        mockGetShadowElement
      );
      
      expect(widget).toBeDefined();
    });
  });

  describe('expand method', () => {
    describe('Basic expansion structure', () => {
      it('should return exactly 6 elements in correct order', () => {
        widget = new TopHeaderWidget('basic-header');
        const elements = widget.expand();
        
        expect(elements).toHaveLength(6);
        
        // Verify order: bounds, headerBar, leftEndcap, rightEndcap, leftText, rightText
        expect(elements[0]).toBeInstanceOf(RectangleElement); // bounds
        expect(elements[1]).toBeInstanceOf(RectangleElement); // headerBar
        expect(elements[2]).toBeInstanceOf(EndcapElement);    // leftEndcap
        expect(elements[3]).toBeInstanceOf(EndcapElement);    // rightEndcap
        expect(elements[4]).toBeInstanceOf(TextElement);      // leftText
        expect(elements[5]).toBeInstanceOf(TextElement);      // rightText
      });

      it('should create bounds rectangle with public ID', () => {
        widget = new TopHeaderWidget('bounds-test');
        const elements = widget.expand();
        const bounds = elements[0] as RectangleElement;
        
        expect(bounds.id).toBe('bounds-test');
        expect(bounds.props.fill).toBe('none');
        expect(bounds.props.stroke).toBe('none');
      });

      it('should create left and right endcaps with correct IDs and directions', () => {
        widget = new TopHeaderWidget('endcap-test');
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        
        expect(leftEndcap.id).toBe('endcap-test_left_endcap');
        expect(leftEndcap.props.direction).toBe('left');
        
        expect(rightEndcap.id).toBe('endcap-test_right_endcap');
        expect(rightEndcap.props.direction).toBe('right');
      });

      it('should create left and right text elements with correct IDs', () => {
        widget = new TopHeaderWidget('text-test');
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        expect(leftText.id).toBe('text-test_left_text');
        expect(rightText.id).toBe('text-test_right_text');
      });

      it('should create header bar with correct ID and stretching', () => {
        widget = new TopHeaderWidget('bar-test');
        const elements = widget.expand();
        const headerBar = elements[1] as RectangleElement;
        
        expect(headerBar.id).toBe('bar-test_header_bar');
        expect(headerBar.layoutConfig.stretch).toBeDefined();
      });
    });

    describe('Default property handling', () => {
      it('should use default fill color when not specified', () => {
        widget = new TopHeaderWidget('default-fill');
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        const headerBar = elements[1] as RectangleElement;
        
        expect(leftEndcap.props.fill).toBe('#99CCFF');
        expect(rightEndcap.props.fill).toBe('#99CCFF');
        expect(headerBar.props.fill).toBe('#99CCFF');
      });

      it('should use default height of 30 when not specified', () => {
        widget = new TopHeaderWidget('default-height');
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        const headerBar = elements[1] as RectangleElement;
        
        expect(leftEndcap.props.height).toBe(30);
        expect(rightEndcap.props.height).toBe(30);
        expect(headerBar.props.height).toBe(30);
      });

      it('should calculate endcap width as 75% of height by default', () => {
        widget = new TopHeaderWidget('endcap-width');
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        
        // Default height is 30, so endcap width should be 30 * 0.75 = 22.5
        expect(leftEndcap.props.width).toBe(22.5);
        expect(rightEndcap.props.width).toBe(22.5);
      });

      it('should use default text content when not specified', () => {
        widget = new TopHeaderWidget('default-text');
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        expect(leftText.props.text).toBe('LEFT');
        expect(rightText.props.text).toBe('RIGHT');
      });

      it('should use default text styling', () => {
        widget = new TopHeaderWidget('default-styling');
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        expect(leftText.props.fill).toBe('#FFFFFF');
        expect(leftText.props.fontFamily).toBe('Antonio');
        expect(leftText.props.fontWeight).toBe('normal');
        expect(leftText.props.letterSpacing).toBe('normal');
        expect(leftText.props.textTransform).toBe('uppercase');
        
        expect(rightText.props.textAnchor).toBe('end'); // Right text should be right-aligned
      });
    });

    describe('Custom property handling', () => {
      it('should use custom fill color when specified', () => {
        const props: LayoutElementProps = { fill: '#FF0000' };
        widget = new TopHeaderWidget('custom-fill', props);
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        const headerBar = elements[1] as RectangleElement;
        
        expect(leftEndcap.props.fill).toBe('#FF0000');
        expect(rightEndcap.props.fill).toBe('#FF0000');
        expect(headerBar.props.fill).toBe('#FF0000');
      });

      it('should use custom height from props over layoutConfig', () => {
        const props: LayoutElementProps = { height: 50 };
        const layoutConfig: LayoutConfigOptions = { height: 40 };
        widget = new TopHeaderWidget('custom-height-props', props, layoutConfig);
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        
        expect(leftEndcap.props.height).toBe(50);
        expect(leftEndcap.props.width).toBe(37.5); // 50 * 0.75
      });

      it('should use height from layoutConfig when not in props', () => {
        const layoutConfig: LayoutConfigOptions = { height: 60 };
        widget = new TopHeaderWidget('custom-height-layout', {}, layoutConfig);
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        
        expect(leftEndcap.props.height).toBe(60);
        expect(leftEndcap.props.width).toBe(45); // 60 * 0.75
      });

      it('should use custom text content when specified', () => {
        const props: LayoutElementProps = { 
          leftContent: 'CUSTOM LEFT',
          rightContent: 'CUSTOM RIGHT'
        };
        widget = new TopHeaderWidget('custom-content', props);
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        expect(leftText.props.text).toBe('CUSTOM LEFT');
        expect(rightText.props.text).toBe('CUSTOM RIGHT');
      });

      it('should use custom text styling when specified', () => {
        const props: LayoutElementProps = {
          textColor: '#00FF00',
          fontFamily: 'Helvetica',
          fontWeight: 'bold',
          letterSpacing: '2px',
          textTransform: 'lowercase'
        };
        widget = new TopHeaderWidget('custom-text-style', props);
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        expect(leftText.props.fill).toBe('#00FF00');
        expect(leftText.props.fontFamily).toBe('Helvetica');
        expect(leftText.props.fontWeight).toBe('bold');
        expect(leftText.props.letterSpacing).toBe('2px');
        expect(leftText.props.textTransform).toBe('lowercase');
        
        expect(rightText.props.fill).toBe('#00FF00');
        expect(rightText.props.fontFamily).toBe('Helvetica');
      });
    });

    describe('Layout configuration', () => {
      it('should configure left endcap anchoring to bounds', () => {
        widget = new TopHeaderWidget('anchor-test');
        const elements = widget.expand();
        const bounds = elements[0] as RectangleElement;
        const leftEndcap = elements[2] as EndcapElement;
        
        expect(leftEndcap.layoutConfig.anchor).toEqual({
          anchorTo: bounds.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topLeft'
        });
      });

      it('should configure right endcap anchoring to bounds', () => {
        widget = new TopHeaderWidget('anchor-test-right');
        const elements = widget.expand();
        const bounds = elements[0] as RectangleElement;
        const rightEndcap = elements[3] as EndcapElement;
        
        expect(rightEndcap.layoutConfig.anchor).toEqual({
          anchorTo: bounds.id,
          anchorPoint: 'topRight',
          targetAnchorPoint: 'topRight'
        });
      });

      it('should configure left text anchoring with gap offset', () => {
        widget = new TopHeaderWidget('text-anchor-left');
        const elements = widget.expand();
        const leftEndcap = elements[2] as EndcapElement;
        const leftText = elements[4] as TextElement;
        
        expect(leftText.layoutConfig.anchor).toEqual({
          anchorTo: leftEndcap.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        });
        expect(leftText.layoutConfig.offsetX).toBe(5); // TEXT_GAP
      });

      it('should configure right text anchoring with negative gap offset', () => {
        widget = new TopHeaderWidget('text-anchor-right');
        const elements = widget.expand();
        const rightEndcap = elements[3] as EndcapElement;
        const rightText = elements[5] as TextElement;
        
        expect(rightText.layoutConfig.anchor).toEqual({
          anchorTo: rightEndcap.id,
          anchorPoint: 'topRight',
          targetAnchorPoint: 'topLeft'
        });
        expect(rightText.layoutConfig.offsetX).toBe(-5); // -TEXT_GAP
      });

      it('should configure header bar stretching between text elements', () => {
        widget = new TopHeaderWidget('stretch-test');
        const elements = widget.expand();
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        const headerBar = elements[1] as RectangleElement;
        
        expect(headerBar.layoutConfig.anchor).toEqual({
          anchorTo: leftText.id,
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        });
        expect(headerBar.layoutConfig.offsetX).toBe(5); // TEXT_GAP
        
        expect(headerBar.layoutConfig.stretch).toEqual({
          stretchTo1: rightText.id,
          targetStretchAnchorPoint1: 'left',
          stretchPadding1: -5 // -TEXT_GAP
        });
      });

      it('should preserve external layout config on bounds element', () => {
        const layoutConfig: LayoutConfigOptions = { 
          offsetX: 25,
          offsetY: 15,
          anchor: { anchorTo: 'external-element' }
        };
        widget = new TopHeaderWidget('external-layout', {}, layoutConfig);
        const elements = widget.expand();
        const bounds = elements[0] as RectangleElement;
        
        expect(bounds.layoutConfig).toBe(layoutConfig);
      });
    });

    describe('Parameter propagation', () => {
      it('should pass all constructor parameters to elements', () => {
        const props: LayoutElementProps = { customProp: 'test' };
        const layoutConfig: LayoutConfigOptions = { offsetX: 10 };
        
        widget = new TopHeaderWidget(
          'param-prop',
          props,
          layoutConfig,
          mockHass,
          mockRequestUpdate,
          mockGetShadowElement
        );
        
        const elements = widget.expand();
        
        // Check that all elements (except bounds which gets the external layoutConfig) 
        // receive the proper constructor parameters
        elements.forEach((element, index) => {
          expect(element.hass).toBe(mockHass);
          expect(element.requestUpdateCallback).toBe(mockRequestUpdate);
          
          // The bounds element (index 0) gets the external layoutConfig,
          // other elements get their own internal layout configs
          if (index === 0) {
            expect(element.layoutConfig).toBe(layoutConfig);
          } else {
            expect(element.layoutConfig).not.toBe(layoutConfig);
          }
        });
      });
    });

    describe('Integration scenarios', () => {
      it('should create a complete header widget with all elements properly configured', () => {
        const props: LayoutElementProps = {
          fill: '#0066CC',
          height: 35,
          leftContent: 'NAVIGATION',
          rightContent: 'STATUS',
          textColor: '#FFFFFF',
          fontFamily: 'Arial'
        };
        
        widget = new TopHeaderWidget('complete-header', props);
        const elements = widget.expand();
        
        // Verify complete structure
        expect(elements).toHaveLength(6);
        
        const bounds = elements[0] as RectangleElement;
        const headerBar = elements[1] as RectangleElement;
        const leftEndcap = elements[2] as EndcapElement;
        const rightEndcap = elements[3] as EndcapElement;
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        
        // Verify styling consistency
        expect(leftEndcap.props.fill).toBe('#0066CC');
        expect(rightEndcap.props.fill).toBe('#0066CC');
        expect(headerBar.props.fill).toBe('#0066CC');
        
        // Verify sizing consistency
        expect(leftEndcap.props.height).toBe(35);
        expect(rightEndcap.props.height).toBe(35);
        expect(headerBar.props.height).toBe(35);
        expect(leftEndcap.props.width).toBe(26.25); // 35 * 0.75
        
        // Verify content
        expect(leftText.props.text).toBe('NAVIGATION');
        expect(rightText.props.text).toBe('STATUS');
        expect(leftText.props.fontFamily).toBe('Arial');
        expect(rightText.props.fontFamily).toBe('Arial');
      });

      it('should handle minimal configuration gracefully', () => {
        widget = new TopHeaderWidget('minimal');
        const elements = widget.expand();
        
        expect(elements).toHaveLength(6);
        expect(() => elements.forEach(el => el.id)).not.toThrow();
        
        // Should use all defaults without error
        const leftText = elements[4] as TextElement;
        const rightText = elements[5] as TextElement;
        expect(leftText.props.text).toBe('LEFT');
        expect(rightText.props.text).toBe('RIGHT');
      });
    });
  });
}); 