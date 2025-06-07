import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Button } from '../button';
import { HomeAssistant } from 'custom-card-helpers';
import type { Mock } from 'vitest';

describe('Button', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn();
    vi.mock('custom-card-helpers', () => ({
      handleAction: vi.fn(),
    }));
  });

  describe('Button Creation and Interactivity', () => {
    it('should create a non-interactive element if button is not enabled', () => {
        const props = { fill: '#FF0000', button: { enabled: false } };
        const button = new Button('test-button', props, mockHass, mockRequestUpdate);
        const result = button.createButton('M 0 0', 0, 0, 10, 10, { rx: 0 }, { isCurrentlyHovering: false, isCurrentlyActive: false });
        expect(result).toBeDefined();
        
        // A disabled button should just be a <g> tag with the path, no event handlers
        const svgString = result.strings.join('');
        expect(svgString).not.toContain('@click');
        expect(svgString).not.toContain('@keydown');
        expect(svgString).not.toContain('role="button"');
        expect(svgString).not.toContain('@mouseenter');
        expect(svgString).not.toContain('@mouseleave');
        expect(svgString).not.toContain('@mousedown');
        expect(svgString).not.toContain('@mouseup');
    });

    it('should create an interactive element with action handlers only if button is enabled', () => {
        const props = { fill: '#FF0000', button: { enabled: true } };
        const button = new Button('test-button', props, mockHass, mockRequestUpdate, mockGetShadowElement);
        const result = button.createButton('M 0 0', 0, 0, 10, 10, { rx: 0 }, { isCurrentlyHovering: false, isCurrentlyActive: false });
        expect(result).toBeDefined();

        const svgString = result.strings.join('');
        // Check for presence of action event handlers
        expect(svgString).toContain('@click');
        expect(svgString).toContain('@keydown');

        // Mouse event handlers should NOT be present in Button output since they're handled by LayoutElement
        expect(svgString).not.toContain('@mouseenter');
        expect(svgString).not.toContain('@mouseleave');
        expect(svgString).not.toContain('@mousedown');
        expect(svgString).not.toContain('@mouseup');
    });
  });
  
  describe('Button Appearance and Color Resolution', () => {
    let mockRequestUpdate: Mock;
    let mockGetShadowElement: Mock;
    let mockElement: HTMLElement;
    let button: Button;

    beforeEach(() => {
      mockRequestUpdate = vi.fn();
      mockElement = document.createElement('div');
      mockGetShadowElement = vi.fn().mockReturnValue(mockElement);
      
      const props = {
        fill: {
          default: '#FF0000',
          hover: '#00FF00',
          active: '#0000FF'
        }
      };
      
      button = new Button('test-button', props, undefined, mockRequestUpdate, mockGetShadowElement);
    });

    it('should resolve colors correctly based on interactive state', () => {
      const defaultColors = (button as any).getResolvedColors({ isCurrentlyHovering: false, isCurrentlyActive: false });
      expect(defaultColors.fillColor).toBe('#FF0000');
      
      const hoverColors = (button as any).getResolvedColors({ isCurrentlyHovering: true, isCurrentlyActive: false });
      expect(hoverColors.fillColor).toBe('#00FF00');
      
      const activeColors = (button as any).getResolvedColors({ isCurrentlyHovering: true, isCurrentlyActive: true });
      expect(activeColors.fillColor).toBe('#0000FF');
    });
  });

  describe('Action Handling', () => {
    it('should handle action configuration', () => {
      const props = {
        button: {
          enabled: true,
          action_config: {
            type: 'toggle',
            entity: 'light.test'
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate, mockGetShadowElement);
      
      const pathData = 'M 0,0 L 100,0 L 100,30 L 0,30 Z';
      const result = button.createButton(pathData, 0, 0, 100, 30, { rx: 0 }, { isCurrentlyHovering: false, isCurrentlyActive: false });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });

    it('should create single action config format correctly', () => {
      const props = {
        button: {
          enabled: true,
          action_config: {
            type: 'toggle',
            entity: 'light.test',
            confirmation: true
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      const actionConfig = (button as any).createActionConfig(props.button);
      
      expect(actionConfig).toEqual({
        confirmation: true,
        tap_action: {
          action: 'toggle',
          service: undefined,
          service_data: undefined,
          target: undefined,
          navigation_path: undefined,
          url_path: undefined,
          entity: 'light.test',
          target_element_ref: undefined,
          state: undefined,
          states: undefined,
        },
        entity: 'light.test'
      });
    });

    it('should create multiple actions config format correctly', () => {
      const props = {
        button: {
          enabled: true,
          action_config: {
            actions: [
              {
                action: 'toggle',
                entity: 'light.living_room'
              },
              {
                action: 'set_state',
                target_element_ref: 'group.element',
                state: 'active'
              }
            ]
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      const actionConfig = (button as any).createActionConfig(props.button);
      
      expect(actionConfig).toEqual({
        confirmation: undefined,
        tap_action: {
          actions: [
            {
              action: 'toggle',
              service: undefined,
              service_data: undefined,
              target: undefined,
              navigation_path: undefined,
              url_path: undefined,
              entity: 'light.living_room',
              target_element_ref: undefined,
              state: undefined,
              states: undefined,
              confirmation: undefined
            },
            {
              action: 'set_state',
              service: undefined,
              service_data: undefined,
              target: undefined,
              navigation_path: undefined,
              url_path: undefined,
              entity: undefined,
              target_element_ref: 'group.element',
              state: 'active',
              states: undefined,
              confirmation: undefined
            }
          ]
        }
      });
    });

    it('should handle multiple actions execution correctly', () => {
      const executeActionSpy = vi.spyOn(Button.prototype as any, 'executeAction');
      const props = {
        button: {
          enabled: true,
          action_config: {
            actions: [
              { action: 'toggle', entity: 'light.test1' },
              { action: 'toggle', entity: 'light.test2' }
            ]
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      const actionConfig = {
        tap_action: {
          actions: [
            { action: 'toggle', entity: 'light.test1' },
            { action: 'toggle', entity: 'light.test2' }
          ]
        }
      };
      
      (button as any)._executeMultipleActions(actionConfig.tap_action.actions, document.createElement('div'));
      
      expect(executeActionSpy).toHaveBeenCalledTimes(2);
      expect(executeActionSpy).toHaveBeenNthCalledWith(1, {
        tap_action: { action: 'toggle', entity: 'light.test1' },
        confirmation: undefined
      }, expect.any(HTMLElement));
      expect(executeActionSpy).toHaveBeenNthCalledWith(2, {
        tap_action: { action: 'toggle', entity: 'light.test2' },
        confirmation: undefined
      }, expect.any(HTMLElement));
      
      executeActionSpy.mockRestore();
    });

    it('should detect multiple actions in executeAction and delegate to _executeMultipleActions', () => {
      const executeMultipleActionsSpy = vi.spyOn(Button.prototype as any, '_executeMultipleActions');
      const props = { button: { enabled: true } };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      const actionConfig = {
        tap_action: {
          actions: [
            { action: 'toggle', entity: 'light.test1' },
            { action: 'toggle', entity: 'light.test2' }
          ]
        }
      };
      
      (button as any).executeAction(actionConfig, document.createElement('div'));
      
      expect(executeMultipleActionsSpy).toHaveBeenCalledWith(actionConfig.tap_action.actions, expect.any(HTMLElement));
      
      executeMultipleActionsSpy.mockRestore();
    });

    it('should not detect multiple actions when actions array is not present', () => {
      const executeMultipleActionsSpy = vi.spyOn(Button.prototype as any, '_executeMultipleActions');
      const props = { button: { enabled: true } };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      const actionConfig = {
        tap_action: {
          action: 'toggle',
          entity: 'light.test'
        }
      };
      
      // Mock the handleAction import to prevent actual execution
      vi.doMock('custom-card-helpers', () => ({
        handleAction: vi.fn()
      }));
      
      (button as any).executeAction(actionConfig, document.createElement('div'));
      
      expect(executeMultipleActionsSpy).not.toHaveBeenCalled();
      
      executeMultipleActionsSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should be a no-op and not throw an error', () => {
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate);
      expect(() => button.cleanup()).not.toThrow();
    });
  });
}); 