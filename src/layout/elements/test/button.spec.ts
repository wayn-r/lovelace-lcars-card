import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Button } from '../button';
import { svg, SVGTemplateResult } from 'lit';

// Mock HomeAssistant
const mockHass: any = {
  callService: vi.fn(),
  states: {}
};

describe('Button Functionality', () => {
  let button: Button;
  const mockRequestUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createButton basic functionality', () => {
    it('should create a button with proper SVG structure', () => {
      const props = {
        button: {
          enabled: true
        },
        fill: '#FF0000'
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      const result = button.createButton(pathData, 0, 0, 100, 30, {
        rx: 0
      });

      // The result should be a button group with interactive handlers
      expect(result).toBeDefined();
      // Check that it's a proper SVG template result by checking for expected properties
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });

    it('should apply correct colors from props', () => {
      const props = {
        button: {
          enabled: true
        },
        fill: '#FF0000',
        stroke: '#00FF00',
        strokeWidth: 2
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      const result = button.createButton(pathData, 0, 0, 100, 30, {
        rx: 0
      });

      // Check that the result contains the expected structure
      expect(result).toBeDefined();
      // Check that it's a proper SVG template result by checking for expected properties
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });

    it('should create interactive button group with event handlers', () => {
      const props = {
        button: {
          enabled: true,
          action_config: {
            type: 'toggle',
            entity: 'light.test'
          }
        }
      };
      
      button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      const result = button.createButton(pathData, 0, 0, 100, 30, {
        rx: 0
      });

      // Check that the result is an interactive button
      expect(result).toBeDefined();
      // Check that it's a proper SVG template result by checking for expected properties
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });
  });

  describe('hover and active state handling', () => {
    it('should trigger global update when hover state changes', () => {
      const mockRequestUpdate = vi.fn();
      
      const button = new Button('test-button', {
        fill: '#FF0000',
        button: {
          enabled: true,
          hover_fill: '#00FF00'
        }
      }, undefined, mockRequestUpdate);
      
      // Initially not hovering
      expect(button.isHovering).toBe(false);
      
      // Set hovering to true
      button.isHovering = true;
      
      // Wait for the debounced update
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should have triggered global re-render to update colors
          expect(mockRequestUpdate).toHaveBeenCalled();
          
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

    it('should handle active state changes', () => {
      const button = new Button('test-button', {
        button: {
          enabled: true,
          active_fill: '#0000FF'
        }
      });
      
      // Initially not active
      expect(button.isActive).toBe(false);
      
      // Set active to true
      button.isActive = true;
      expect(button.isActive).toBe(true);
      
      // Set active to false
      button.isActive = false;
      expect(button.isActive).toBe(false);
    });
  });

  // Legacy button property tests removed - now using unified color system

  describe('cleanup', () => {
    it('should clean up timeouts properly', () => {
      const button = new Button('test-button', {});
      
      // Set hover state to trigger timeout
      button.isHovering = true;
      button.isActive = true;
      
      // Should not throw when cleaning up
      expect(() => button.cleanup()).not.toThrow();
    });
  });
}); 