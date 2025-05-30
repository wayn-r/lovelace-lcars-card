import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Button } from '../button';
import { svg, SVGTemplateResult } from 'lit';

// Mock HomeAssistant
const mockHass: any = {
  callService: vi.fn(),
  states: {}
};

describe('Button Text Positioning', () => {
  let button: Button;
  const mockRequestUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createButton with different text anchors', () => {
    it('should position text at left edge with padding for text_anchor: "start"', () => {
      const props = {
        button: {
          enabled: true,
          text: 'Start Text',
          text_anchor: 'start'
        },
        textPadding: 10
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      // Capture the createText call to verify positioning
      const originalCreateText = button.createText;
      const createTextSpy = vi.fn();
      button.createText = createTextSpy;

      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      button.createButton(pathData, 0, 0, 100, 30, {
        hasText: true,
        isCutout: false,
        rx: 0
      });

      expect(createTextSpy).toHaveBeenCalledWith(
        10, // x position: left edge (0) + padding (10)
        15, // y position: center (30/2)
        'Start Text',
        expect.objectContaining({
          textAnchor: 'start'
        })
      );
    });

    it('should position text at right edge with padding for text_anchor: "end"', () => {
      const props = {
        button: {
          enabled: true,
          text: 'End Text',
          text_anchor: 'end'
        },
        textPadding: 10
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const createTextSpy = vi.fn();
      button.createText = createTextSpy;

      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      button.createButton(pathData, 0, 0, 100, 30, {
        hasText: true,
        isCutout: false,
        rx: 0
      });

      expect(createTextSpy).toHaveBeenCalledWith(
        90, // x position: right edge (100) - padding (10)
        15, // y position: center (30/2)
        'End Text',
        expect.objectContaining({
          textAnchor: 'end'
        })
      );
    });

    it('should position text at center for text_anchor: "middle" (default)', () => {
      const props = {
        button: {
          enabled: true,
          text: 'Middle Text',
          text_anchor: 'middle'
        }
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const createTextSpy = vi.fn();
      button.createText = createTextSpy;

      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      button.createButton(pathData, 0, 0, 100, 30, {
        hasText: true,
        isCutout: false,
        rx: 0
      });

      expect(createTextSpy).toHaveBeenCalledWith(
        50, // x position: center (100/2)
        15, // y position: center (30/2)
        'Middle Text',
        expect.objectContaining({
          textAnchor: 'middle'
        })
      );
    });

    it('should use default padding when textPadding is not specified', () => {
      const props = {
        button: {
          enabled: true,
          text: 'Start Text',
          text_anchor: 'start'
        }
        // No textPadding specified
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const createTextSpy = vi.fn();
      button.createText = createTextSpy;

      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      button.createButton(pathData, 0, 0, 100, 30, {
        hasText: true,
        isCutout: false,
        rx: 0
      });

      expect(createTextSpy).toHaveBeenCalledWith(
        2, // x position: left edge (0) + default padding (2)
        15, // y position: center (30/2)
        'Start Text',
        expect.objectContaining({
          textAnchor: 'start'
        })
      );
    });

    it('should respect customTextPosition when provided', () => {
      const props = {
        button: {
          enabled: true,
          text: 'Custom Position',
          text_anchor: 'start' // This should be ignored when customTextPosition is provided
        }
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const createTextSpy = vi.fn();
      button.createText = createTextSpy;

      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      button.createButton(pathData, 0, 0, 100, 30, {
        hasText: true,
        isCutout: false,
        rx: 0,
        customTextPosition: {
          x: 25,
          y: 20
        }
      });

      expect(createTextSpy).toHaveBeenCalledWith(
        25, // x position: custom position
        20, // y position: custom position
        'Custom Position',
        expect.objectContaining({
          textAnchor: 'start'
        })
      );
    });
  });

  describe('hover state handling', () => {
    it('should update appearance directly without triggering global re-render for hover states', () => {
      const mockElement = document.createElement('path');
      mockElement.id = 'test-button';
      
      const mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
      const mockRequestUpdate = vi.fn();
      
      const button = new Button('test-button', {
        fill: '#FF0000',
        button: {
          enabled: true,
          hover_fill: '#00FF00'
        }
      }, undefined, mockRequestUpdate, mockGetShadowElement);
      
      // Initially not hovering
      expect(button.isHovering).toBe(false);
      
      // Set hovering to true
      button.isHovering = true;
      
      // Wait for the debounced update
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should not have triggered global re-render immediately
          expect(mockRequestUpdate).not.toHaveBeenCalled();
          
          // Should have tried to update the element directly
          expect(mockGetShadowElement).toHaveBeenCalledWith('test-button');
          
          resolve();
        }, 15); // Wait longer than the 10ms debounce
      });
    });
    
    it('should fall back to global update if direct DOM update fails', () => {
      const mockGetShadowElement = vi.fn().mockReturnValue(null); // Element not found
      const mockRequestUpdate = vi.fn();
      
      const button = new Button('test-button', {
        fill: '#FF0000',
        button: {
          enabled: true,
          hover_fill: '#00FF00'
        }
      }, undefined, mockRequestUpdate, mockGetShadowElement);
      
      // Set hovering to true
      button.isHovering = true;
      
      // Wait for the debounced update
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should have fallen back to global re-render
          expect(mockRequestUpdate).toHaveBeenCalled();
          
          resolve();
        }, 15); // Wait longer than the 10ms debounce
      });
    });
  });
}); 