import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicColorManager } from '../color.js';
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../../layout/engine.js';

// Mock the animation manager - use inline mock object to avoid hoisting issues
vi.mock('../animation.js', () => ({
  animationManager: {
    invalidateDynamicColorCache: vi.fn(),
    cleanupElementAnimationTracking: vi.fn()
  }
}));

describe('DynamicColorManager', () => {
  let manager: DynamicColorManager;
  let mockHass: HomeAssistant;
  let mockLayoutGroups: Group[];

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    manager = new DynamicColorManager();
    
    // Create mock HomeAssistant
    mockHass = {
      states: {
        'sensor.test': {
          entity_id: 'sensor.test',
          state: 'on',
          attributes: {},
          last_changed: '2023-01-01T00:00:00Z',
          last_updated: '2023-01-01T00:00:00Z',
          context: { id: 'test', parent_id: null, user_id: null }
        }
      }
    } as unknown as HomeAssistant;

    // Create mock layout groups
    const mockElement = {
      id: 'test-element',
      clearMonitoredEntities: vi.fn(),
      cleanupAnimations: vi.fn(),
      checkEntityChanges: vi.fn().mockReturnValue(false),
      props: {
        fill: { entity: 'sensor.test', mapping: { on: 'red', off: 'blue' } },
        text: 'Hello'
      }
    };

    mockLayoutGroups = [
      {
        id: 'test-group',
        elements: [mockElement]
      } as unknown as Group
    ];
  });

  describe('clearAllCaches', () => {
    it('should clear element state for all elements', () => {
      manager.clearAllCaches(mockLayoutGroups);

      const element = mockLayoutGroups[0].elements[0] as any;
      expect(element.clearMonitoredEntities).toHaveBeenCalled();
      expect(element.cleanupAnimations).toHaveBeenCalled();
    });

    it('should call animation manager cache invalidation', async () => {
      // Import the mocked module
      const { animationManager } = await import('../animation.js');
      
      manager.clearAllCaches(mockLayoutGroups);

      expect(animationManager.invalidateDynamicColorCache).toHaveBeenCalled();
    });
  });

  describe('checkDynamicColorChanges', () => {
    it('should call refresh callback when changes are detected', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.checkEntityChanges.mockReturnValue(true);

      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(refreshCallback).toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });

    it('should not call refresh callback when no changes are detected', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.checkEntityChanges.mockReturnValue(false);

      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(refreshCallback).not.toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });

    it('should throttle multiple calls', async () => {
      const refreshCallback = vi.fn();
      const mockElement = mockLayoutGroups[0].elements[0] as any;
      mockElement.checkEntityChanges.mockReturnValue(true);

      // Make multiple rapid calls
      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);
      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);
      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 30);

      // Wait for the timeout to complete
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Only the first call should have been processed due to throttling
          expect(refreshCallback).toHaveBeenCalledTimes(1);
          resolve();
        }, 50);
      });
    });
  });

  describe('extractEntityIdsFromElement', () => {
    it('should extract entity IDs from dynamic color properties', () => {
      const element = {
        props: {
          fill: { entity: 'sensor.test1', mapping: {} },
          stroke: { entity: 'sensor.test2', mapping: {} },
          textColor: { entity: 'sensor.test3', mapping: {} }
        }
      };

      const entityIds = manager.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set(['sensor.test1', 'sensor.test2', 'sensor.test3']));
    });

    it('should extract entity IDs from button color properties', () => {
      const element = {
        props: {
          button: {
            hover_fill: { entity: 'sensor.hover', mapping: {} },
            active_fill: { entity: 'sensor.active', mapping: {} }
          }
        }
      };

      const entityIds = manager.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set(['sensor.hover', 'sensor.active']));
    });

    it('should return empty set for element without props', () => {
      const element = {};

      const entityIds = manager.extractEntityIdsFromElement(element);

      expect(entityIds).toEqual(new Set());
    });
  });

  describe('hasSignificantEntityChanges', () => {
    it('should detect entity-based text changes', () => {
      const lastHassStates = {
        'sensor.test': { state: 'off' }
      };

      const elementWithEntityText = {
        props: {
          text: "Status: {{states['sensor.test'].state}}"
        }
      };

      const mockGroupsWithText = [
        {
          id: 'test-group',
          elements: [elementWithEntityText]
        } as unknown as Group
      ];

      const result = manager.hasSignificantEntityChanges(mockGroupsWithText, lastHassStates, mockHass);

      expect(result).toBe(true);
    });

    it('should not detect changes when entities are unchanged', () => {
      const lastHassStates = {
        'sensor.test': { state: 'on' }
      };

      const result = manager.hasSignificantEntityChanges(mockLayoutGroups, lastHassStates, mockHass);

      expect(result).toBe(false);
    });

    it('should return false when no last states are provided', () => {
      const result = manager.hasSignificantEntityChanges(mockLayoutGroups, undefined, mockHass);

      expect(result).toBe(false);
    });
  });

  describe('scheduleDynamicColorRefresh', () => {
    it('should call callbacks after delay', async () => {
      const checkCallback = vi.fn();
      const refreshCallback = vi.fn();
      const mockContainerRect = new DOMRect(0, 0, 100, 100);

      manager.scheduleDynamicColorRefresh(mockHass, mockContainerRect, checkCallback, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(checkCallback).toHaveBeenCalled();
          expect(refreshCallback).toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });

    it('should not call callbacks if hass or containerRect is missing', async () => {
      const checkCallback = vi.fn();
      const refreshCallback = vi.fn();

      manager.scheduleDynamicColorRefresh(mockHass, undefined, checkCallback, refreshCallback, 10);

      // Wait for the timeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(checkCallback).not.toHaveBeenCalled();
          expect(refreshCallback).not.toHaveBeenCalled();
          resolve();
        }, 20);
      });
    });
  });

  describe('cleanup', () => {
    it('should clear scheduled operations', async () => {
      const refreshCallback = vi.fn();

      // Schedule an operation
      manager.checkDynamicColorChanges(mockLayoutGroups, mockHass, refreshCallback, 100);

      // Clean up immediately
      manager.cleanup();

      // Wait longer than the original delay
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should not have been called due to cleanup
          expect(refreshCallback).not.toHaveBeenCalled();
          resolve();
        }, 150);
      });
    });
  });
}); 