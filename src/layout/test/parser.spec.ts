// src/layout/parser.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure proper hoisting of mock functions
const mockTextElementConstructor = vi.hoisted(() => vi.fn());
const mockRectangleElementConstructor = vi.hoisted(() => vi.fn());
const mockEndcapElementConstructor = vi.hoisted(() => vi.fn());
const mockElbowElementConstructor = vi.hoisted(() => vi.fn());
const mockChiselEndcapElementConstructor = vi.hoisted(() => vi.fn());
const mockTopHeaderElementConstructor = vi.hoisted(() => vi.fn());

// Mock imports
vi.mock('../elements/text', () => ({ TextElement: mockTextElementConstructor }));
vi.mock('../elements/rectangle', () => ({ RectangleElement: mockRectangleElementConstructor }));
vi.mock('../elements/endcap', () => ({ EndcapElement: mockEndcapElementConstructor }));
vi.mock('../elements/elbow', () => ({ ElbowElement: mockElbowElementConstructor }));
vi.mock('../elements/chisel_endcap', () => ({ ChiselEndcapElement: mockChiselEndcapElementConstructor }));
vi.mock('../elements/top_header', () => ({ TopHeaderElement: mockTopHeaderElementConstructor }));

// Import after mock setup
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from '../engine';
import { LcarsCardConfig, GroupConfig, ElementConfig } from '../../types.js';
import { parseConfig } from '../parser';

// These imports are for type checking
import { TextElement } from '../elements/text';
import { RectangleElement } from '../elements/rectangle';
import { EndcapElement } from '../elements/endcap';
import { ElbowElement } from '../elements/elbow';
import { ChiselEndcapElement } from '../elements/chisel_endcap';
import { TopHeaderElement } from '../elements/top_header';

describe('parseConfig', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdateCallback: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockHass = {} as HomeAssistant;
    mockRequestUpdateCallback = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(null);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset all mocks before each test to ensure clean state
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Error Handling', () => {
    it('should throw error when groups is undefined', () => {
      const config: any = {
        type: 'lcars-card',
        title: 'Test Title',
        // groups is undefined
      };

      expect(() => {
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      }).toThrow('Invalid configuration: groups array is required');
    });

    it('should throw error when groups is null', () => {
      const config: any = {
        type: 'lcars-card',
        title: 'Test Title',
        groups: null,
      };

      expect(() => {
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      }).toThrow('Invalid configuration: groups array is required');
    });

    it('should handle empty groups array without error', () => {
      const config: LcarsCardConfig = {
        type: 'lcars-card',
        title: 'Test Title',
        groups: [],
      };

      const result = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);
      expect(result).toHaveLength(0);
    });
  });

  describe('Group and Element Parsing', () => {
    describe('Basic Group Creation', () => {
      it('should create groups from new configuration format', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'groupA',
              elements: [
                {
                  id: 'el1',
                  type: 'rectangle',
                  appearance: { fill: '#FF0000' },
                  layout: { offsetX: 10 }
                }
              ]
            }
          ]
        };

        const result = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('groupA');
        expect(result[0].elements).toHaveLength(1);

        // Verify that RectangleElement was called with the full ID (group.element)
        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'groupA.el1', // Full ID should be group.element
          expect.any(Object),
          expect.any(Object),
          mockHass,
          mockRequestUpdateCallback,
          mockGetShadowElement
        );
      });

      it('should handle multiple groups', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'groupA',
              elements: [
                { id: 'el1', type: 'rectangle' },
                { id: 'el2', type: 'text', text: { content: 'Hello' } }
              ]
            },
            {
              group_id: 'groupB',
              elements: [
                { id: 'el3', type: 'endcap', appearance: { direction: 'left' } }
              ]
            }
          ]
        };

        const result = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('groupA');
        expect(result[0].elements).toHaveLength(2);
        expect(result[1].id).toBe('groupB');
        expect(result[1].elements).toHaveLength(1);
      });
    });

    describe('Element Type Creation', () => {
      it('should create rectangle elements', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'rect1',
                  type: 'rectangle',
                  appearance: { fill: '#FF0000' }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'testGroup.rect1',
          expect.objectContaining({ fill: '#FF0000' }),
          expect.any(Object),
          mockHass,
          mockRequestUpdateCallback,
          mockGetShadowElement
        );
      });

      it('should create text elements', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'text1',
                  type: 'text',
                  text: { content: 'Hello World' }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockTextElementConstructor).toHaveBeenCalledWith(
          'testGroup.text1',
          expect.objectContaining({ text: 'Hello World' }),
          expect.any(Object),
          mockHass,
          mockRequestUpdateCallback,
          mockGetShadowElement
        );
      });

      it('should create endcap elements', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'endcap1',
                  type: 'endcap',
                  appearance: { direction: 'left' }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockEndcapElementConstructor).toHaveBeenCalledWith(
          'testGroup.endcap1',
          expect.objectContaining({ direction: 'left' }),
          expect.any(Object),
          mockHass,
          mockRequestUpdateCallback,
          mockGetShadowElement
        );
      });

      it('should handle unknown element types by defaulting to rectangle', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'unknown1',
                  type: 'unknown_type' as any
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'testGroup.unknown1',
          expect.any(Object),
          expect.any(Object),
          mockHass,
          mockRequestUpdateCallback,
          mockGetShadowElement
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown element type "unknown_type"')
        );
      });
    });

    describe('Configuration Conversion', () => {
      it('should convert new appearance configuration to engine props', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'styled1',
                  type: 'rectangle',
                  appearance: {
                    fill: '#FF0000',
                    stroke: '#00FF00',
                    strokeWidth: 2,
                    cornerRadius: 5
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.fill).toBe('#FF0000');
        expect(props.stroke).toBe('#00FF00');
        expect(props.strokeWidth).toBe(2);
        expect(props.rx).toBe(5);
      });

      it('should convert new text configuration to engine props', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'text1',
                  type: 'text',
                  text: {
                    content: 'Hello',
                    fill: '#0000FF',
                    fontSize: 20,
                    fontWeight: 'bold'
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockTextElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.text).toBe('Hello');
        expect(props.fill).toBe('#0000FF');
        expect(props.fontSize).toBe(20);
        expect(props.fontWeight).toBe('bold');
      });

      it('should convert text color for non-text elements to textColor property', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'rect1',
                  type: 'rectangle',
                  appearance: { fill: '#FF0000' },
                  text: {
                    content: 'Button Text',
                    fill: '#FFFFFF',
                    fontSize: 14
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.fill).toBe('#FF0000');
        expect(props.text).toBe('Button Text');
        expect(props.textColor).toBe('#FFFFFF');
        expect(props.fontSize).toBe(14);
      });

      it('should convert new layout configuration to engine format', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'testGroup',
              elements: [
                {
                  id: 'positioned1',
                  type: 'rectangle',
                  layout: {
                    width: 100,
                    height: 50,
                    offsetX: 10,
                    offsetY: 20,
                    anchor: {
                      to: 'container',
                      element_point: 'topLeft',
                      target_point: 'topLeft'
                    }
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const layoutConfig = call[2];

        expect(layoutConfig.width).toBe(100);
        expect(layoutConfig.height).toBe(50);
        expect(layoutConfig.offsetX).toBe(10);
        expect(layoutConfig.offsetY).toBe(20);
        expect(layoutConfig.anchor).toBeDefined();
        expect(layoutConfig.anchor.anchorTo).toBe('container');
        expect(layoutConfig.anchor.anchorPoint).toBe('topLeft');
        expect(layoutConfig.anchor.targetAnchorPoint).toBe('topLeft');
      });
    });

    describe('Button Configuration Conversion', () => {
      it('should convert button interactions to engine button config', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'buttonGroup',
              elements: [
                {
                  id: 'button1',
                  type: 'rectangle',
                  text: { content: 'Click Me' },
                  interactions: {
                    button: {
                      enabled: true,
                      actions: {
                        tap: {
                          action: 'call-service',
                          service: 'light.turn_on',
                          service_data: { entity_id: 'light.test' }
                        }
                      }
                    }
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.button).toBeDefined();
        expect(props.button.enabled).toBe(true);
        expect(props.text).toBe('Click Me');
        expect(props.button.action_config).toBeDefined();
        expect(props.button.action_config.type).toBe('call-service');
        expect(props.button.action_config.service).toBe('light.turn_on');
      });

      it('should handle elements without button configuration', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'normalGroup',
              elements: [
                {
                  id: 'normal1',
                  type: 'rectangle',
                  appearance: { fill: '#FF0000' }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.button).toBeUndefined();
      });

      it('should convert button appearance states', () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          groups: [
            {
              group_id: 'styledButtonGroup',
              elements: [
                {
                  id: 'styledButton',
                  type: 'rectangle',
                  text: { content: 'Styled Button' },
                  interactions: {
                    button: {
                      enabled: true,
                      appearance_states: {
                        hover: {
                          appearance: { fill: '#FF0000' },
                          text: { fill: '#FFFFFF' }
                        },
                        active: {
                          appearance: { fill: '#AA0000' }
                        }
                      }
                    }
                  }
                }
              ]
            }
          ]
        };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        const call = mockRectangleElementConstructor.mock.calls[0];
        const props = call[1];

        expect(props.button.hover_fill).toBe('#FF0000');
        expect(props.button.active_fill).toBe('#AA0000');
      });
    });
  });
});
