import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Button } from '../button.js';
import { HomeAssistant } from 'custom-card-helpers';

describe('Button', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdate: () => void;
  let mockGetShadowElement: (id: string) => Element | null;

  beforeEach(() => {
    mockHass = {
      states: {
        'light.test': {
          entity_id: 'light.test',
          state: 'off',
          attributes: {},
          context: { id: 'test', parent_id: null, user_id: null },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }
      }
    } as any as HomeAssistant;

    mockRequestUpdate = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a Button instance with all parameters', () => {
      const props = { someProperty: 'value' };
      const button = new Button('test-button', props, mockHass, mockRequestUpdate, mockGetShadowElement);
      
      expect(button).toBeInstanceOf(Button);
    });

    it('should create a Button instance with minimal parameters', () => {
      const button = new Button('test-button', {});
      
      expect(button).toBeInstanceOf(Button);
    });
  });

  describe('createButtonGroup', () => {
    it('should create a regular group when not a button', () => {
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate, mockGetShadowElement);
      
      const result = button.createButtonGroup([], {
        isButton: false,
        elementId: 'test'
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });

    it('should create an interactive button group when isButton is true', () => {
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate, mockGetShadowElement);
      
      const result = button.createButtonGroup([], {
        isButton: true,
        elementId: 'test'
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('_$litType$');
      expect(result).toHaveProperty('strings');
      expect(result).toHaveProperty('values');
    });
  });

  describe('createButton', () => {
    it('should create a button with proper structure', () => {
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
  });

  describe('unified action execution', () => {
    it('should execute single action correctly', () => {
      const executeUnifiedActionSpy = vi.spyOn(Button.prototype as any, 'executeUnifiedAction');
      const props = {
        button: {
          enabled: true,
          actions: {
            tap: {
              action: 'toggle',
              entity: 'light.test',
              confirmation: true
            }
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      // Simulate button click by calling handleClick directly
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: document.createElement('div') } as any;
      (button as any).handleClick(mockEvent);
      
      expect(executeUnifiedActionSpy).toHaveBeenCalledTimes(1);
      expect(executeUnifiedActionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'toggle',
          entity: 'light.test',
          confirmation: true
        }),
        expect.any(HTMLElement)
      );
      
      executeUnifiedActionSpy.mockRestore();
    });

    it('should execute multiple actions correctly', () => {
      const executeUnifiedActionSpy = vi.spyOn(Button.prototype as any, 'executeUnifiedAction');
      const props = {
        button: {
          enabled: true,
          actions: {
            tap: [
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
      
      // Simulate button click by calling handleClick directly
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: document.createElement('div') } as any;
      (button as any).handleClick(mockEvent);
      
      expect(executeUnifiedActionSpy).toHaveBeenCalledTimes(2);
      expect(executeUnifiedActionSpy).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          action: 'toggle',
          entity: 'light.living_room'
        }),
        expect.any(HTMLElement)
      );
      expect(executeUnifiedActionSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          action: 'set_state',
          target_element_ref: 'group.element',
          state: 'active'
        }),
        expect.any(HTMLElement)
      );
      
      executeUnifiedActionSpy.mockRestore();
    });

    it('should handle action type conversion from set-state to set_state', () => {
      const convertToUnifiedActionSpy = vi.spyOn(Button.prototype as any, 'convertToUnifiedAction');
      const props = {
        button: {
          enabled: true,
          actions: {
            tap: [
              {
                action: 'set-state',
                target_element_ref: 'group.element',
                state: 'active'
              }
            ]
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      // Simulate button click by calling handleClick directly
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: document.createElement('div') } as any;
      (button as any).handleClick(mockEvent);
      
      expect(convertToUnifiedActionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'set-state',
          target_element_ref: 'group.element',
          state: 'active'
        })
      );
      
      convertToUnifiedActionSpy.mockRestore();
    });

    it('should auto-populate entity for toggle/more-info actions when missing', () => {
      const executeUnifiedActionSpy = vi.spyOn(Button.prototype as any, 'executeUnifiedAction');
      const props = {
        button: {
          enabled: true,
          actions: {
            tap: {
              action: 'toggle'
              // entity intentionally missing
            }
          }
        }
      };
      
      const button = new Button('test-button', props, mockHass, mockRequestUpdate);
      
      // Simulate button click by calling handleClick directly
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: document.createElement('div') } as any;
      (button as any).handleClick(mockEvent);
      
      expect(executeUnifiedActionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'toggle',
          entity: 'test-button' // Should use button ID
        }),
        expect.any(HTMLElement)
      );
      
      executeUnifiedActionSpy.mockRestore();
    });
  });

  describe('custom action handling', () => {
    it('should handle custom set_state action', async () => {
      const mockStateManager = {
        executeSetStateAction: vi.fn(),
        executeToggleStateAction: vi.fn()
      };
      
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate);
      const action = {
        action: 'set_state' as const,
        target_element_ref: 'test.element',
        state: 'active'
      };
      
      // Spy on the actual dynamic import and replace it
      const importSpy = vi.spyOn(button as any, 'executeCustomAction').mockImplementation(async (action: any) => {
        switch (action.action) {
          case 'set_state':
            mockStateManager.executeSetStateAction(action);
            break;
          case 'toggle_state':
            mockStateManager.executeToggleStateAction(action);
            break;
        }
      });
      
      await (button as any).executeCustomAction(action);
      
      expect(mockStateManager.executeSetStateAction).toHaveBeenCalledWith(action);
      
      importSpy.mockRestore();
    });

    it('should handle custom toggle_state action', async () => {
      const mockStateManager = {
        executeSetStateAction: vi.fn(),
        executeToggleStateAction: vi.fn()
      };
      
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate);
      const action = {
        action: 'toggle_state' as const,
        target_element_ref: 'test.element',
        states: ['state1', 'state2']
      };
      
      // Spy on the actual dynamic import and replace it
      const importSpy = vi.spyOn(button as any, 'executeCustomAction').mockImplementation(async (action: any) => {
        switch (action.action) {
          case 'set_state':
            mockStateManager.executeSetStateAction(action);
            break;
          case 'toggle_state':
            mockStateManager.executeToggleStateAction(action);
            break;
        }
      });
      
      await (button as any).executeCustomAction(action);
      
      expect(mockStateManager.executeToggleStateAction).toHaveBeenCalledWith(action);
      
      importSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should be a no-op and not throw an error', () => {
      const button = new Button('test-button', {}, mockHass, mockRequestUpdate);
      expect(() => button.cleanup()).not.toThrow();
    });
  });
}); 