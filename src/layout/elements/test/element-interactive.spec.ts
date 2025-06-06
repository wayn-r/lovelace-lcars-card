import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RectangleElement } from '../rectangle.js';
import { HomeAssistant } from 'custom-card-helpers';
import { LayoutElementProps } from '../../engine.js';

describe('Element Interactive States', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdateCallback: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdateCallback = vi.fn();
    mockElement = document.createElement('div');
    mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
  });

  describe('Stateful Color Support', () => {
    it('should detect when element has stateful colors', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00',
          active: '#0000FF'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      expect((element as any)._hasStatefulColors()).toBe(true);
    });

    it('should detect when element does not have stateful colors', () => {
      const props: LayoutElementProps = {
        fill: '#FF0000'
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      expect((element as any)._hasStatefulColors()).toBe(false);
    });

    it('should setup interactive listeners for elements with stateful colors', () => {
      const props: LayoutElementProps = {
        stroke: {
          default: '#000000',
          hover: '#333333'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      
      element.setupInteractiveListeners();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    it('should not setup listeners for elements without stateful colors or buttons', () => {
      const props: LayoutElementProps = {
        fill: '#FF0000'
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      
      element.setupInteractiveListeners();
      
      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Interactive State Tracking', () => {
    it('should track hover state', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      expect(element.isHovering).toBe(false);
      
      element.isHovering = true;
      expect(element.isHovering).toBe(true);
    });

    it('should track active state', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          active: '#0000FF'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      expect(element.isActive).toBe(false);
      
      element.isActive = true;
      expect(element.isActive).toBe(true);
    });

    it('should provide correct state context', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00',
          active: '#0000FF'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      element.isHovering = true;
      element.isActive = true;
      
      const stateContext = (element as any)._getStateContext();
      
      expect(stateContext).toEqual({
        isCurrentlyHovering: true,
        isCurrentlyActive: true
      });
    });

    it('should debounce state changes and trigger updates', async () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      element.isHovering = true;
      
      // Should not have called update immediately due to debounce
      expect(mockRequestUpdateCallback).not.toHaveBeenCalled();
      
      // Wait for debounce timeout
      await new Promise(resolve => setTimeout(resolve, 15)); // Slightly longer than the 10ms debounce
      expect(mockRequestUpdateCallback).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle mouse events correctly', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00',
          active: '#0000FF'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      element.setupInteractiveListeners();
      
      // Simulate mouse enter
      mockElement.dispatchEvent(new Event('mouseenter'));
      expect(element.isHovering).toBe(true);
      
      // Simulate mouse down
      mockElement.dispatchEvent(new Event('mousedown'));
      expect(element.isActive).toBe(true);
      
      // Simulate mouse up
      mockElement.dispatchEvent(new Event('mouseup'));
      expect(element.isActive).toBe(false);
      expect(element.isHovering).toBe(true); // Still hovering
      
      // Simulate mouse leave
      mockElement.dispatchEvent(new Event('mouseleave'));
      expect(element.isHovering).toBe(false);
      expect(element.isActive).toBe(false); // Should cancel active on leave
    });

    it('should handle touch events correctly', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00',
          active: '#0000FF'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      element.setupInteractiveListeners();
      
      // Simulate touch start
      mockElement.dispatchEvent(new Event('touchstart'));
      expect(element.isHovering).toBe(true);
      expect(element.isActive).toBe(true);
      
      // Simulate touch end
      mockElement.dispatchEvent(new Event('touchend'));
      expect(element.isHovering).toBe(false);
      expect(element.isActive).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timeouts and listeners on element cleanup', () => {
      const props: LayoutElementProps = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00'
        }
      };

      const element = new RectangleElement('test', props, {}, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');
      
      element.setupInteractiveListeners();
      element.cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
  });
}); 