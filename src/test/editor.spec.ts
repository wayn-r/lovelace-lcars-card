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

  describe('YAML Preview', () => {
    it('should generate YAML preview from config', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        title: 'Test Card',
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

      const preview = (editor as any)._getYamlPreview();
      expect(preview).toContain('Test Card');
      expect(preview).toContain('test_group');
    });

    it('should handle config without title', () => {
      const config: LcarsCardConfig = {
        type: 'lovelace-lcars-card',
        groups: []
      };

      editor.setConfig(config);

      const preview = (editor as any)._getYamlPreview();
      expect(preview).not.toContain('title');
    });
  });
});
