import { describe, it, expect } from 'vitest';
import { ElementGrouper } from '../morph-element-matcher.js';
import { ElementAnalyzer } from '../morph-element-utils.js';
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

      // With endcap constraints, expect three horizontal groups:
      // - one with rectangle + text
      // - one with endcap + elbow (default endcap direction is 'left')
      // - one with rectangle_2
      expect(result.horizontalGroups).toHaveLength(3);

      const groupRectText = result.horizontalGroups.find(g => g.elements.length === 2 && g.elements.some(e => e.id === 'rectangle') && g.elements.some(e => e.id === 'text'));
      const groupEndcapElbow = result.horizontalGroups.find(g => g.elements.length === 2 && g.elements.some(e => e.id === 'endcap') && g.elements.some(e => e.id === 'elbow'));
      const singleGroup = result.horizontalGroups.find(g => g.elements.length === 1);

      expect(groupRectText).toBeDefined();
      expect(groupEndcapElbow).toBeDefined();
      expect(singleGroup).toBeDefined();

      // The two multi-element groups should share the same mean y (25)
      expect(groupRectText!.meanCoordinate).toBe(25);
      expect(groupEndcapElbow!.meanCoordinate).toBe(25);

      // rectangle_2 should be in its own group centered at 37.5
      expect(singleGroup!.elements[0].id).toBe('rectangle_2');
      expect(Math.round(singleGroup!.meanCoordinate * 10) / 10).toBe(37.5);

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

describe('ElementAnalyzer', () => {
  describe('findMatchingText', () => {
    it('matches non-text elements that render text even across large moves', () => {
      const sourceElbow = createMockElement('sourceElbow', 'Elbow', 0, 0, 150, 80, {
        text: 'Main',
        textTransform: 'uppercase'
      });
      const targetElbow = createMockElement('targetElbow', 'Elbow', 420, 260, 150, 80, {
        text: 'MAIN',
        textTransform: undefined
      });

      const pairs = ElementAnalyzer.findMatchingText([sourceElbow], [targetElbow]);
      expect(pairs.get('sourceElbow')).toBe('targetElbow');
    });

    it('matches elements that render text via cutout masks', () => {
      const source = createMockElement('sourceElbow', 'Elbow', 0, 0, 150, 80, {
        text: 'ENVIRONMENTAL',
        cutout: true
      });
      const target = createMockElement('targetElbow', 'Elbow', 0, 0, 150, 80, {
        text: 'ENVIRONMENTAL',
        cutout: true
      });

      const pairs = ElementAnalyzer.findMatchingText([source], [target]);
      expect(pairs.get('sourceElbow')).toBe('targetElbow');
    });

    it('respects tolerance constraints for pure text elements', () => {
      const source = createMockElement('sourceText', 'Text', 0, 0, 100, 40, {
        text: 'Label'
      });
      const target = createMockElement('targetText', 'Text', 500, 0, 100, 40, {
        text: 'Label'
      });

      const pairs = ElementAnalyzer.findMatchingText([source], [target]);
      expect(pairs.size).toBe(0);
    });

    it('matches rectangle elements with inline text content', () => {
      const source = createMockElement('sourceButton', 'Rectangle', 0, 0, 130, 40, {
        text: 'SICKBAY',
        textTransform: 'uppercase'
      });
      const target = createMockElement('targetButton', 'Rectangle', 400, 200, 130, 40, {
        text: 'sickbay',
        textTransform: 'uppercase'
      });

      const pairs = ElementAnalyzer.findMatchingText([source], [target]);
      expect(pairs.get('sourceButton')).toBe('targetButton');
    });
  });

  describe('findTopHeaderShapeMappings', () => {
    const createTopHeaderElements = (baseId: string): LayoutElement[] => {
      return [
        createMockElement(`${baseId}_left_text`, 'Text', 10, 0, 60, 20, { text: 'LEFT' }),
        createMockElement(`${baseId}_right_text`, 'Text', 100, 0, 60, 20, { text: 'RIGHT' }),
        createMockElement(`${baseId}_left_endcap`, 'Endcap', 0, 0, 20, 20, { direction: 'left' }),
        createMockElement(`${baseId}_right_endcap`, 'Endcap', 160, 0, 20, 20, { direction: 'right' }),
        createMockElement(`${baseId}_header_bar`, 'Rectangle', 20, 0, 140, 20, {})
      ];
    };

    it('maps top header shapes when text content changes', () => {
      const sourceElements = createTopHeaderElements('nav_header');
      const destinationElements = createTopHeaderElements('nav_header').map(element => ({
        ...element,
        props: {
          ...element.props,
          text: element.id.includes('_left_text') ? 'UPDATED' : element.props?.text
        }
      }));

      const mappings = ElementAnalyzer.findTopHeaderShapeMappings(
        sourceElements,
        destinationElements as LayoutElement[],
        new Map()
      );

      expect(mappings.get('nav_header_left_endcap')).toBe('nav_header_left_endcap');
      expect(mappings.get('nav_header_right_endcap')).toBe('nav_header_right_endcap');
      expect(mappings.get('nav_header_header_bar')).toBe('nav_header_header_bar');
    });

    it('falls back to single unmatched family pairing when bases differ', () => {
      const sourceElements = createTopHeaderElements('nav_header');
      const destinationElements = createTopHeaderElements('nav_secondary');

      const mappings = ElementAnalyzer.findTopHeaderShapeMappings(
        sourceElements,
        destinationElements,
        new Map()
      );

      expect(mappings.get('nav_header_left_endcap')).toBe('nav_secondary_left_endcap');
      expect(mappings.get('nav_header_right_endcap')).toBe('nav_secondary_right_endcap');
      expect(mappings.get('nav_header_header_bar')).toBe('nav_secondary_header_bar');
    });
  });
});
