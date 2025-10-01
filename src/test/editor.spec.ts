import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LcarsCardEditor } from '../editor.js';
import type { LcarsCardConfig } from '../types.js';

describe('LcarsCardEditor', () => {
  let editor: LcarsCardEditor;
  const mockHass = {
    states: {},
    callService: vi.fn(),
    callWS: vi.fn(),
    connection: {},
    connected: true,
    language: 'en',
    user: { name: 'Test User' },
  } as any;

  beforeEach(() => {
    editor = new LcarsCardEditor();
    editor.hass = mockHass;
  });

  describe('Initialization', () => {
    it('should create the editor element', () => {
      expect(editor).toBeTruthy();
      expect(editor).toBeInstanceOf(LcarsCardEditor);
    });

    it('should have hass property set', () => {
      expect(editor.hass).toBe(mockHass);
    });
  });

  describe('Configuration', () => {
    it('should accept and store config', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        title: 'Test Card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              {
                id: 'test_element',
                type: 'rectangle',
              }
            ]
          }
        ]
      };

      editor.setConfig(config);
      
      // Access the private _config property via type assertion
      const editorConfig = (editor as any)._config;
      expect(editorConfig).toBeTruthy();
      expect(editorConfig.title).toBe('Test Card');
      expect(editorConfig.groups).toHaveLength(1);
    });

    it('should handle config with multiple groups', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'group1',
            elements: [
              { id: 'elem1', type: 'rectangle' },
              { id: 'elem2', type: 'text' }
            ]
          },
          {
            group_id: 'group2',
            elements: [
              { id: 'elem3', type: 'endcap' }
            ]
          }
        ]
      };

      editor.setConfig(config);

      const editorConfig = (editor as any)._config;
      expect(editorConfig.groups).toHaveLength(2);
      expect(editorConfig.groups[0].elements).toHaveLength(2);
      expect(editorConfig.groups[1].elements).toHaveLength(1);
    });

    it('should handle empty groups', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: []
      };

      editor.setConfig(config);

      const editorConfig = (editor as any)._config;
      expect(editorConfig.groups).toHaveLength(0);
    });
  });

  describe('Element Icon Mapping', () => {
    it('should return correct icon for rectangle', () => {
      const icon = (editor as any)._getElementIcon('rectangle');
      expect(icon).toBe('mdi:rectangle-outline');
    });

    it('should return correct icon for text', () => {
      const icon = (editor as any)._getElementIcon('text');
      expect(icon).toBe('mdi:format-text');
    });

    it('should return correct icon for graph-widget', () => {
      const icon = (editor as any)._getElementIcon('graph-widget');
      expect(icon).toBe('mdi:chart-line');
    });

    it('should return default icon for unknown type', () => {
      const icon = (editor as any)._getElementIcon('unknown-type');
      expect(icon).toBe('mdi:shape');
    });
  });

  describe('Element Selection', () => {
    it('should select an element and collapse browser', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              { id: 'elem1', type: 'rectangle' }
            ]
          }
        ]
      };

      editor.setConfig(config);
      (editor as any)._selectElement(0, 0);

      const selectedElement = (editor as any)._selectedElement;
      expect(selectedElement).toBeTruthy();
      expect(selectedElement.groupIndex).toBe(0);
      expect(selectedElement.elementIndex).toBe(0);
      expect((editor as any)._browserExpanded).toBe(false);
    });

    it('should generate correct element path', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              { id: 'elem1', type: 'rectangle' }
            ]
          }
        ]
      };

      editor.setConfig(config);
      (editor as any)._selectElement(0, 0);

      const path = (editor as any)._getSelectedElementPath();
      expect(path).toBe('test_group.elem1');
    });
  });

  describe('Group Toggle', () => {
    it('should toggle group collapse state', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              { id: 'elem1', type: 'rectangle' }
            ]
          }
        ]
      };

      editor.setConfig(config);

      // Initially not collapsed
      let collapsedGroups = (editor as any)._collapsedGroups;
      expect(collapsedGroups.has(0)).toBe(false);

      // Toggle to collapsed
      (editor as any)._toggleGroup(0);
      collapsedGroups = (editor as any)._collapsedGroups;
      expect(collapsedGroups.has(0)).toBe(true);

      // Toggle back to expanded
      (editor as any)._toggleGroup(0);
      collapsedGroups = (editor as any)._collapsedGroups;
      expect(collapsedGroups.has(0)).toBe(false);
    });
  });

  describe('Browser Toggle', () => {
    it('should toggle browser expand/collapse state', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              { id: 'elem1', type: 'rectangle' }
            ]
          }
        ]
      };

      editor.setConfig(config);

      // Initially expanded
      expect((editor as any)._browserExpanded).toBe(true);

      // Select element - should collapse
      (editor as any)._selectElement(0, 0);
      expect((editor as any)._browserExpanded).toBe(false);

      // Toggle browser
      (editor as any)._toggleBrowser();
      expect((editor as any)._browserExpanded).toBe(true);

      // Toggle again
      (editor as any)._toggleBrowser();
      expect((editor as any)._browserExpanded).toBe(false);
    });
  });

  describe('Filter', () => {
    it('should filter elements by ID', () => {
      (editor as any)._filterText = 'test';
      const matches = (editor as any)._matchesFilter('test_element', 'rectangle');
      expect(matches).toBe(true);
    });

    it('should filter elements by type', () => {
      (editor as any)._filterText = 'rect';
      const matches = (editor as any)._matchesFilter('elem1', 'rectangle');
      expect(matches).toBe(true);
    });

    it('should not match elements that dont contain filter text', () => {
      (editor as any)._filterText = 'graph';
      const matches = (editor as any)._matchesFilter('elem1', 'rectangle');
      expect(matches).toBe(false);
    });

    it('should match all elements when filter is empty', () => {
      (editor as any)._filterText = '';
      const matches = (editor as any)._matchesFilter('elem1', 'rectangle');
      expect(matches).toBe(true);
    });
  });

  describe('Element Configuration', () => {
    it('should handle element with layout config', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              {
                id: 'elem1',
                type: 'rectangle',
                layout: {
                  width: 100,
                  height: 50
                }
              }
            ]
          }
        ]
      };

      editor.setConfig(config);
      (editor as any)._selectElement(0, 0);

      const editorConfig = (editor as any)._config;
      expect(editorConfig.groups[0].elements[0].layout.width).toBe(100);
      expect(editorConfig.groups[0].elements[0].layout.height).toBe(50);
    });

    it('should handle element without layout config', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: [
          {
            group_id: 'test_group',
            elements: [
              {
                id: 'elem1',
                type: 'rectangle'
              }
            ]
          }
        ]
      };

      editor.setConfig(config);
      (editor as any)._selectElement(0, 0);

      const editorConfig = (editor as any)._config;
      const element = editorConfig.groups[0].elements[0];
      expect(element.layout).toBeUndefined();
    });
  });
});
