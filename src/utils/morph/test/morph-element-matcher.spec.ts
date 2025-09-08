import { describe, it, expect } from 'vitest';
import { ElementGrouper } from '../morph-element-matcher.js';
import type { LayoutElement } from '../../../layout/elements/element.js';

// Mock LayoutElement for testing
const createMockElement = (
  id: string,
  category: string,
  x: number,
  y: number,
  width: number,
  height: number,
  additionalProps: any = {}
): LayoutElement => {
  const element = {
    id,
    layout: { x, y, width, height, calculated: true },
    constructor: { name: `${category}Element` },
    props: additionalProps,
    render: () => null
  } as any as LayoutElement;

  return element;
};

describe('ElementGrouper', () => {
  describe('groupElementsByAlignment', () => {
    it('should group elements by horizontal alignment (y-coordinate)', () => {
      // Test elements from the user's example
      const elements: LayoutElement[] = [
        createMockElement('rectangle', 'Rectangle', 0, 0, 200, 50),
        createMockElement('text', 'Text', 250, 0, 10, 50),
        createMockElement('endcap', 'Endcap', 400, 0, 900, 50),
        createMockElement('elbow', 'Elbow', 1310, 0, 200, 400, {
          orientation: 'top-right',
          armHeight: 50,
          bodyWidth: 180
        }),
        createMockElement('rectangle_2', 'Rectangle', 0, 0, 200, 75)
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      // Should have two horizontal groups: one with 4 elements (rectangle, text, endcap, elbow), one with rectangle_2
      expect(result.horizontalGroups).toHaveLength(2);
      
      // Find the group with 4 elements
      const mainGroup = result.horizontalGroups.find(g => g.elements.length === 4);
      const singleGroup = result.horizontalGroups.find(g => g.elements.length === 1);
      
      expect(mainGroup).toBeDefined();
      expect(singleGroup).toBeDefined();
      
      // The main group should be grouped by their y-center coordinate
      // rectangle: (0 + 50) / 2 = 25
      // text: (0 + 50) / 2 = 25
      // endcap: (0 + 50) / 2 = 25
      // elbow (top-right): (0 + 50) / 2 = 25 (armHeight = 50)
      expect(mainGroup!.meanCoordinate).toBe(25);
      
      // rectangle_2 should be in its own group
      // rectangle_2: (0 + 75) / 2 = 37.5, which is > 5 away from 25
      const mainGroupIds = mainGroup!.elements.map(e => e.id);
      expect(mainGroupIds).toContain('rectangle');
      expect(mainGroupIds).toContain('text');
      expect(mainGroupIds).toContain('endcap');
      expect(mainGroupIds).toContain('elbow');
      expect(mainGroupIds).not.toContain('rectangle_2');

      expect(singleGroup!.elements[0].id).toBe('rectangle_2');
      expect(Math.round(singleGroup!.meanCoordinate * 10) / 10).toBe(37.5); // Handle floating point precision

      // No elements should be ungrouped (all belong to some group)
      expect(result.ungroupedElements).toHaveLength(0);
    });

    it('should group elbow with compatible element only', () => {
      // Test just elbow and one compatible element first
      const elements: LayoutElement[] = [
        createMockElement('rect_left', 'Rectangle', 100, 0, 200, 50),
        createMockElement('elbow', 'Elbow', 500, 0, 200, 400, {
          orientation: 'top-right',
          armHeight: 50,
          bodyWidth: 180
        })
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      expect(result.horizontalGroups).toHaveLength(1);
      expect(result.horizontalGroups[0].elements).toHaveLength(2);
      
      const groupedIds = result.horizontalGroups[0].elements.map(e => e.id);
      expect(groupedIds).toContain('rect_left');
      expect(groupedIds).toContain('elbow');
    });

    it('should handle elbow positioning constraints for top-right orientation', () => {
      const elements: LayoutElement[] = [
        // Element to the left of elbow (should be grouped)
        createMockElement('rect_left', 'Rectangle', 100, 0, 200, 50),
        // Elbow element  
        createMockElement('elbow', 'Elbow', 500, 0, 200, 400, {
          orientation: 'top-right',
          armHeight: 50,
          bodyWidth: 180
        }),
        // Element to the right of elbow (should NOT be grouped due to constraint)
        createMockElement('rect_right', 'Rectangle', 800, 0, 200, 50)
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      // Should have two groups: one with rect_left and elbow, one with rect_right
      expect(result.horizontalGroups).toHaveLength(2);
      
      // Find the groups
      const mainGroup = result.horizontalGroups.find(g => g.elements.length === 2);
      const singleGroup = result.horizontalGroups.find(g => g.elements.length === 1);
      
      expect(mainGroup).toBeDefined();
      expect(singleGroup).toBeDefined();
      
      const mainGroupIds = mainGroup!.elements.map(e => e.id);
      expect(mainGroupIds).toContain('rect_left');
      expect(mainGroupIds).toContain('elbow');
      
      expect(singleGroup!.elements[0].id).toBe('rect_right');
    });

    it('should handle elbow positioning constraints for top-left orientation', () => {
      const elements: LayoutElement[] = [
        // Elbow element
        createMockElement('elbow', 'Elbow', 100, 0, 200, 400, {
          orientation: 'top-left',
          armHeight: 50,
          bodyWidth: 180
        }),
        // Element to the right of elbow (should be grouped)
        createMockElement('rect_right', 'Rectangle', 400, 0, 200, 50),
        // Element to the left of elbow (should NOT be grouped due to constraint)
        createMockElement('rect_left', 'Rectangle', 0, 0, 50, 50)
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      // Should have two groups: one with elbow and rect_right, one with rect_left
      expect(result.horizontalGroups).toHaveLength(2);
      
      // Find the groups
      const mainGroup = result.horizontalGroups.find(g => g.elements.length === 2);
      const singleGroup = result.horizontalGroups.find(g => g.elements.length === 1);
      
      expect(mainGroup).toBeDefined();
      expect(singleGroup).toBeDefined();
      
      const mainGroupIds = mainGroup!.elements.map(e => e.id);
      expect(mainGroupIds).toContain('elbow');
      expect(mainGroupIds).toContain('rect_right');
      expect(mainGroupIds).not.toContain('rect_left');

      expect(singleGroup!.elements[0].id).toBe('rect_left');
    });

    it('should group elements by vertical alignment (x-coordinate)', () => {
      const elements: LayoutElement[] = [
        createMockElement('rect1', 'Rectangle', 100, 0, 50, 100),
        createMockElement('rect2', 'Rectangle', 100, 200, 50, 100),
        createMockElement('text1', 'Text', 100, 400, 50, 30),
        // Element with different x-center (should not be grouped)
        createMockElement('rect3', 'Rectangle', 200, 0, 50, 100)
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      // Should have two vertical groups: one with 3 elements, one with rect3
      expect(result.verticalGroups).toHaveLength(2);
      
      // Find the groups
      const mainGroup = result.verticalGroups.find(g => g.elements.length === 3);
      const singleGroup = result.verticalGroups.find(g => g.elements.length === 1);
      
      expect(mainGroup).toBeDefined();
      expect(singleGroup).toBeDefined();
      
      // The main group should be grouped by their x-center coordinate
      // All have x-center at (100 + 50) / 2 = 125
      expect(Math.round(mainGroup!.meanCoordinate)).toBe(125);
      
      const mainGroupIds = mainGroup!.elements.map(e => e.id);
      expect(mainGroupIds).toContain('rect1');
      expect(mainGroupIds).toContain('rect2');
      expect(mainGroupIds).toContain('text1');
      expect(mainGroupIds).not.toContain('rect3');

      expect(singleGroup!.elements[0].id).toBe('rect3');
    });

    it('should filter out non-groupable element types', () => {
      const elements: LayoutElement[] = [
        createMockElement('rectangle', 'Rectangle', 0, 0, 200, 50),
        createMockElement('text', 'Text', 250, 0, 10, 50),
        createMockElement('unknown', 'Unknown', 400, 0, 50, 50), // Should be filtered out
        createMockElement('custom', 'Custom', 500, 0, 50, 50) // Should be filtered out
      ];

      const result = ElementGrouper.groupElementsByAlignment(elements, 5);

      // Should only group the rectangle and text elements
      expect(result.horizontalGroups).toHaveLength(1);
      expect(result.horizontalGroups[0].elements).toHaveLength(2);
      
      const groupedIds = result.horizontalGroups[0].elements.map(e => e.id);
      expect(groupedIds).toContain('rectangle');
      expect(groupedIds).toContain('text');
      
      // Unknown and custom elements should be ungrouped
      expect(result.ungroupedElements).toHaveLength(2);
      const ungroupedIds = result.ungroupedElements.map(e => e.id);
      expect(ungroupedIds).toContain('unknown');
      expect(ungroupedIds).toContain('custom');
    });
  });
});
