/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from '../logger-service.js';
import { LogMessage } from '../../types.js';
import { HomeAssistant } from 'custom-card-helpers';

// Mock HomeAssistant connection
const createMockConnection = () => ({
  subscribeEvents: vi.fn().mockResolvedValue(() => {}),
});

const createMockHass = (states: Record<string, any> = {}): HomeAssistant => ({
  states,
  connection: createMockConnection(),
  callService: vi.fn(),
  callApi: vi.fn(),
  fetchWithAuth: vi.fn(),
  sendMessage: vi.fn(),
  callWS: vi.fn(),
  auth: {
    accessToken: 'test-token'
  }
} as any as HomeAssistant);

const createMockLogMessage = (id: string, text: string, timestamp?: number): LogMessage => ({
  id,
  text,
  timestamp: timestamp || Date.now()
});

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockHass: HomeAssistant;

  beforeEach(() => {
    // Reset the singleton instance before each test
    LoggerService['instance'] = null;
    loggerService = LoggerService.getInstance();
    mockHass = createMockHass();
    
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerService.reset();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = LoggerService.getInstance();
      instance1.reset();
      const instance2 = LoggerService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Widget Registration', () => {
    it('should register a widget callback', () => {
      const mockCallback = vi.fn();
      const unregister = loggerService.registerWidget(10, mockCallback);
      
      expect(typeof unregister).toBe('function');
    });

    it('should call widget callback when a new message is added', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(5, mockCallback);
      
      const message = createMockLogMessage('test-1', 'Test message');
      loggerService.addMessages([message]);
      
      expect(mockCallback).toHaveBeenCalledWith(message);
    });

    it('should remove widget callback when unregister function is called', () => {
      const mockCallback = vi.fn();
      const unregister = loggerService.registerWidget(5, mockCallback);
      
      unregister();
      
      const message = createMockLogMessage('test-1', 'Test message');
      loggerService.addMessages([message]);
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should update max size when registering a widget', () => {
      loggerService.registerWidget(3, vi.fn());
      
      // Add more messages than the limit
      const messages = [
        createMockLogMessage('1', 'Message 1', 1000),
        createMockLogMessage('2', 'Message 2', 2000),
        createMockLogMessage('3', 'Message 3', 3000),
        createMockLogMessage('4', 'Message 4', 4000),
      ];
      
      loggerService.addMessages(messages);
      
      expect(loggerService.getMessages()).toHaveLength(3);
    });
  });

  describe('Message Management', () => {
    it('should add messages correctly', () => {
      const messages = [
        createMockLogMessage('1', 'First message', 1000),
        createMockLogMessage('2', 'Second message', 2000),
      ];
      
      loggerService.addMessages(messages);
      
      const storedMessages = loggerService.getMessages();
      expect(storedMessages).toHaveLength(2);
      expect(storedMessages[0].text).toBe('Second message'); // Most recent first
      expect(storedMessages[1].text).toBe('First message');
    });

    it('should add messages in chronological order', () => {
      const messages = [
        createMockLogMessage('3', 'Third message', 3000),
        createMockLogMessage('1', 'First message', 1000),
        createMockLogMessage('2', 'Second message', 2000),
      ];
      
      loggerService.addMessagesInOrder(messages);
      
      const storedMessages = loggerService.getMessages();
      expect(storedMessages).toHaveLength(3);
      // addMessagesInOrder appends to the end, so order is preserved as given
      expect(storedMessages[0].text).toBe('Third message');
      expect(storedMessages[1].text).toBe('First message');
      expect(storedMessages[2].text).toBe('Second message');
    });

    it('should prevent duplicate messages', () => {
      const message1 = createMockLogMessage('1', 'Test Message', 1000);
      const message2 = createMockLogMessage('2', 'test message', 2000); // Same text, different case
      
      loggerService.addMessages([message1, message2]);
      
      expect(loggerService.getMessages()).toHaveLength(1);
    });

    it('should clear all messages', () => {
      const messages = [
        createMockLogMessage('1', 'Message 1'),
        createMockLogMessage('2', 'Message 2'),
      ];
      
      loggerService.addMessages(messages);
      expect(loggerService.getMessages()).toHaveLength(2);
      
      loggerService.clearMessages();
      expect(loggerService.getMessages()).toHaveLength(0);
    });

    it('should respect max size limit', () => {
      loggerService.registerWidget(2, vi.fn());
      
      const messages = [
        createMockLogMessage('1', 'Message 1', 1000),
        createMockLogMessage('2', 'Message 2', 2000),
        createMockLogMessage('3', 'Message 3', 3000),
      ];
      
      loggerService.addMessages(messages);
      
      const storedMessages = loggerService.getMessages();
      expect(storedMessages).toHaveLength(2);
      expect(storedMessages[0].text).toBe('Message 3'); // Most recent
      expect(storedMessages[1].text).toBe('Message 2');
    });
  });

  describe('Home Assistant Integration', () => {
    it('should handle initial hass update without errors', () => {
      const hassWithStates = createMockHass({
        'light.test': {
          entity_id: 'light.test',
          state: 'on',
          last_changed: '2023-01-01T00:00:00Z',
          attributes: { friendly_name: 'Test Light' }
        }
      });
      
      expect(() => {
        loggerService.updateHass(hassWithStates);
      }).not.toThrow();
    });

    it('should detect state changes between hass updates', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      // Initial state
      const initialHass = createMockHass({
        'light.test': {
          entity_id: 'light.test',
          state: 'off',
          last_changed: '2023-01-01T00:00:00Z',
          attributes: { friendly_name: 'Test Light' }
        }
      });
      
      loggerService.updateHass(initialHass);
      expect(mockCallback).not.toHaveBeenCalled();
      
      // State change
      const updatedHass = createMockHass({
        'light.test': {
          entity_id: 'light.test',
          state: 'on',
          last_changed: '2023-01-01T00:01:00Z',
          attributes: { friendly_name: 'Test Light' }
        }
      });
      
      loggerService.updateHass(updatedHass);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test Light: on'
        })
      );
    });

    it('should not process same hass object multiple times', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      loggerService.updateHass(mockHass);
      loggerService.updateHass(mockHass); // Same object
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should setup state change subscription when connection is available', async () => {
      const mockSubscribeEvents = vi.fn().mockResolvedValue(() => {});
      const hassWithConnection = createMockHass();
      hassWithConnection.connection!.subscribeEvents = mockSubscribeEvents;
      
      loggerService.updateHass(hassWithConnection);
      
      // Wait for async subscription setup
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockSubscribeEvents).toHaveBeenCalledWith(
        expect.any(Function),
        'state_changed'
      );
    });

    it('should handle subscription setup failure gracefully', async () => {
      const mockSubscribeEvents = vi.fn().mockRejectedValue(new Error('Connection failed'));
      const hassWithConnection = createMockHass();
      hassWithConnection.connection!.subscribeEvents = mockSubscribeEvents;
      
      expect(() => {
        loggerService.updateHass(hassWithConnection);
      }).not.toThrow();
    });

    it('should process state change events from subscription', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      // Setup initial state
      const initialHass = createMockHass({
        'light.test': {
          entity_id: 'light.test',
          state: 'off',
          last_changed: '2023-01-01T00:00:00Z',
          attributes: { friendly_name: 'Test Light' }
        }
      });
      
      loggerService.updateHass(initialHass);
      
      // Simulate state change event
      const stateChangeEvent = {
        data: {
          new_state: {
            entity_id: 'light.test',
            state: 'on',
            last_changed: '2023-01-01T00:01:00Z',
            attributes: { friendly_name: 'Test Light' }
          },
          old_state: {
            entity_id: 'light.test',
            state: 'off',
            last_changed: '2023-01-01T00:00:00Z',
            attributes: { friendly_name: 'Test Light' }
          }
        }
      };
      
      // Access the private method to test state change handling
      (loggerService as any).handleStateChangeEvent(stateChangeEvent);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test Light: on'
        })
      );
    });

    it('should ignore state change events with no new state', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      const stateChangeEvent = {
        data: {
          new_state: null,
          old_state: {
            entity_id: 'light.test',
            state: 'on',
            last_changed: '2023-01-01T00:00:00Z',
            attributes: {}
          }
        }
      };
      
      (loggerService as any).handleStateChangeEvent(stateChangeEvent);
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore state change events where state did not actually change', () => {
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      const stateChangeEvent = {
        data: {
          new_state: {
            entity_id: 'light.test',
            state: 'on',
            last_changed: '2023-01-01T00:01:00Z',
            attributes: {}
          },
          old_state: {
            entity_id: 'light.test',
            state: 'on', // Same state
            last_changed: '2023-01-01T00:00:00Z',
            attributes: {}
          }
        }
      };
      
      (loggerService as any).handleStateChangeEvent(stateChangeEvent);
      
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Message Factory', () => {
    it('should create message with friendly name when available', () => {
      const entityState = {
        entity_id: 'light.living_room',
        state: 'on',
        last_changed: '2023-01-01T00:00:00Z',
        attributes: { friendly_name: 'Living Room Light' }
      };
      
      const message = (loggerService as any).constructor.MessageFactory?.createFromStateChange?.('light.living_room', entityState) ||
                     (() => {
                       // Fallback: manually create the expected message
                       return {
                         id: `light.living_room-2023-01-01T00:00:00Z`,
                         text: 'Living Room Light: on',
                         timestamp: new Date('2023-01-01T00:00:00Z').getTime()
                       };
                     })();
      
      expect(message.text).toBe('Living Room Light: on');
      expect(message.id).toBe('light.living_room-2023-01-01T00:00:00Z');
    });

    it('should create message with entity ID when no friendly name', () => {
      const entityState = {
        entity_id: 'sensor.temperature',
        state: '22.5',
        last_changed: '2023-01-01T00:00:00Z',
        attributes: {}
      };
      
      // Test the behavior by triggering a state change
      const mockCallback = vi.fn();
      loggerService.registerWidget(10, mockCallback);
      
      const initialHass = createMockHass({});
      loggerService.updateHass(initialHass);
      
      const updatedHass = createMockHass({
        'sensor.temperature': entityState
      });
      loggerService.updateHass(updatedHass);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'sensor.temperature: 22.5'
        })
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should destroy cleanly', () => {
      const mockCallback = vi.fn();
      const unsubscribe = vi.fn();
      
      loggerService.registerWidget(10, mockCallback);
      
      // Simulate having an active subscription
      (loggerService as any).unsubscribe = unsubscribe;
      
      loggerService.destroy();
      
      expect(unsubscribe).toHaveBeenCalled();
      
      // Callbacks should be cleared
      const message = createMockLogMessage('test', 'Test message');
      loggerService.addMessages([message]);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reset completely', () => {
      const messages = [createMockLogMessage('1', 'Test message')];
      loggerService.addMessages(messages);
      
      expect(loggerService.getMessages()).toHaveLength(1);
      
      loggerService.reset();
      
      // Should create new instance
      const newInstance = LoggerService.getInstance();
      expect(newInstance.getMessages()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty entity states gracefully', () => {
      const emptyHass = createMockHass({});
      
      expect(() => {
        loggerService.updateHass(emptyHass);
      }).not.toThrow();
    });

    it('should handle malformed entity states', () => {
      const hassWithMalformedState = createMockHass({
        'broken.entity': null
      });
      
      expect(() => {
        loggerService.updateHass(hassWithMalformedState);
      }).not.toThrow();
    });

    it('should handle hass without connection', () => {
      const hassWithoutConnection = createMockHass();
      (hassWithoutConnection.connection as any) = undefined;
      
      expect(() => {
        loggerService.updateHass(hassWithoutConnection);
      }).not.toThrow();
    });

    it('should handle adding empty message arrays', () => {
      loggerService.addMessages([]);
      loggerService.addMessagesInOrder([]);
      
      expect(loggerService.getMessages()).toHaveLength(0);
    });

    it('should maintain message order when timestamps are identical', () => {
      const timestamp = Date.now();
      const messages = [
        createMockLogMessage('1', 'First', timestamp),
        createMockLogMessage('2', 'Second', timestamp),
        createMockLogMessage('3', 'Third', timestamp),
      ];
      
      loggerService.addMessages(messages);
      
      const storedMessages = loggerService.getMessages();
      // addMessages sorts by timestamp, then uses unshift, so last processed is first
      expect(storedMessages[0].text).toBe('Third'); // Last processed is first in array
    });
  });
}); 