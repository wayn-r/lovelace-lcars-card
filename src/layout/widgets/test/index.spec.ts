import { describe, it, expect, beforeEach } from 'vitest';
import { expandWidget } from '../registry.js';

describe('Widget Index', () => {
  beforeEach(async () => {
    // Clear any existing registrations for clean tests
    const registryModule = await import('../registry.js');
    (registryModule as any).registry?.clear?.();
  });

  describe('Module loading and registration', () => {
    it('should register top_header widget when index is imported', async () => {
      // Import the index file which should trigger widget registration
      await import('../index.js');
      
      // Verify the widget was registered by trying to expand it
      const result = expandWidget('top_header', 'test-header');
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result!.length).toBeGreaterThan(0);
    });

    it('should register widgets with case-insensitive lookup after index import', async () => {
      await import('../index.js');
      
      const lowerResult = expandWidget('top_header', 'test-lower');
      const upperResult = expandWidget('TOP_HEADER', 'test-upper');
      const mixedResult = expandWidget('Top_Header', 'test-mixed');
      
      expect(lowerResult).not.toBeNull();
      expect(upperResult).not.toBeNull();
      expect(mixedResult).not.toBeNull();
      
      expect(lowerResult!.length).toBeGreaterThan(0);
      expect(upperResult!.length).toBeGreaterThan(0);
      expect(mixedResult!.length).toBeGreaterThan(0);
    });

    it('should handle multiple imports of index without issues', async () => {
      // Import multiple times to ensure no side effects
      await import('../index.js');
      await import('../index.js');
      await import('../index.js');
      
      const result = expandWidget('top_header', 'multi-import-test');
      
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
    });
  });

  describe('Widget availability after index import', () => {
    it('should make all registered widgets available for expansion', async () => {
      await import('../index.js');
      
      // Test that known widgets are available
      const topHeaderResult = expandWidget('top_header', 'availability-test');
      
      expect(topHeaderResult).not.toBeNull();
      expect(Array.isArray(topHeaderResult)).toBe(true);
    });

    it('should maintain widget functionality after index import', async () => {
      await import('../index.js');
      
      const result = expandWidget('top_header', 'functionality-test', { 
        fill: '#FF0000',
        height: 40 
      });
      
      expect(result).not.toBeNull();
      expect(result!.length).toBe(6); // TopHeaderWidget should return 6 elements
      
      // Verify the widget actually processes the props
      const elements = result!;
      expect(elements[0].id).toBe('functionality-test'); // bounds element gets the main ID
    });
  });
}); 