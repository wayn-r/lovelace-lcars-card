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
vi.mock('./elements/text.js', () => ({ TextElement: mockTextElementConstructor }));
vi.mock('./elements/rectangle.js', () => ({ RectangleElement: mockRectangleElementConstructor }));
vi.mock('./elements/endcap.js', () => ({ EndcapElement: mockEndcapElementConstructor }));
vi.mock('./elements/elbow.js', () => ({ ElbowElement: mockElbowElementConstructor }));
vi.mock('./elements/chisel_endcap.js', () => ({ ChiselEndcapElement: mockChiselEndcapElementConstructor }));
vi.mock('./elements/top_header.js', () => ({ TopHeaderElement: mockTopHeaderElementConstructor }));

// Import after mock setup
import { HomeAssistant } from 'custom-card-helpers';
import { Group } from './engine';
import { LcarsCardConfig, LcarsElementConfig } from '../lovelace-lcars-card';
import { parseConfig } from './parser';

// These imports are for type checking
import { TextElement } from './elements/text.js';
import { RectangleElement } from './elements/rectangle.js';
import { EndcapElement } from './elements/endcap.js';
import { ElbowElement } from './elements/elbow.js';
import { ChiselEndcapElement } from './elements/chisel_endcap.js';
import { TopHeaderElement } from './elements/top_header.js';


describe('parseConfig', () => {
  let mockHass: HomeAssistant;
  let mockRequestUpdateCallback: () => void;
  let mockGetShadowElement: (id: string) => Element | null;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockHass = {} as HomeAssistant; // Minimal mock, can be expanded if needed
    mockRequestUpdateCallback = vi.fn();
    mockGetShadowElement = vi.fn().mockReturnValue(null);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn during tests

    // Reset all mocks before each test to ensure clean state
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Default Group Creation', () => {
    const testCasesForDefaultGroup = [
      { description: 'elements is undefined', elements: undefined },
      { description: 'elements is null', elements: null as any }, // Test null explicitly
      { description: 'elements is an empty array', elements: [] },
    ];

    testCasesForDefaultGroup.forEach(({ description, elements }) => {
      it(`should create a default group if ${description}`, () => {
        const config: LcarsCardConfig = {
          type: 'lcars-card',
          title: 'Test Title',
          text: 'Test Text',
          fontSize: 18,
          elements: elements, // Use the test case value here
        };

        const groups = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(groups).toHaveLength(1);
        const group = groups[0];
        expect(group.id).toBe('__default__');
        expect(group.elements).toHaveLength(3);

        // 1. Header Bar (RectangleElement)
        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'default-header', // id
          { fill: '#FF9900', rx: 0, ry: 0 }, // props (button merged)
          { anchorLeft: true, anchorTop: true, offsetX: 0, offsetY: 0, width: '100%', height: 16 }, // layoutConfig
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );

        // 2. Title Element (TextElement)
        expect(mockTextElementConstructor).toHaveBeenCalledWith(
          'default-title', // id
          { text: 'Test Title', fontWeight: 'bold', fontSize: 22, fill: '#FFFFFF' }, // props (fontSize: 18 + 4)
          { anchorLeft: true, anchorTop: true, offsetX: 16, offsetY: 30 }, // layoutConfig
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );

        // 3. Text Element (TextElement)
        expect(mockTextElementConstructor).toHaveBeenCalledWith(
          'default-text', // id
          { text: 'Test Text', fontSize: 18, fill: '#CCCCCC' }, // props
          { anchorLeft: true, anchorTop: true, offsetX: 16, offsetY: 60 }, // layoutConfig
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
      });
    });

    it('should use default font sizes for default group if config.fontSize is undefined', () => {
      const config: LcarsCardConfig = {
        type: 'lcars-card',
        title: 'No Font Size Title',
        text: 'No Font Size Text',
        // fontSize is undefined
        elements: [], // Triggers default group creation
      };

      parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

      // Check title element font size (config.fontSize undefined ? 20)
      expect(mockTextElementConstructor).toHaveBeenCalledWith(
        'default-title',
        expect.objectContaining({ fontSize: 20 }),
        expect.anything(), mockHass, mockRequestUpdateCallback, expect.any(Function)
      );

      // Check text element font size (config.fontSize undefined ? 16)
      expect(mockTextElementConstructor).toHaveBeenCalledWith(
        'default-text',
        expect.objectContaining({ fontSize: 16 }),
        expect.anything(), mockHass, mockRequestUpdateCallback, expect.any(Function)
      );
    });

    it('should handle undefined title and text for default group by passing undefined to TextElement props', () => {
      const config: LcarsCardConfig = {
        type: 'lcars-card',
        // title is undefined
        // text is undefined
        elements: [], // Triggers default group creation
      };

      parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

      expect(mockTextElementConstructor).toHaveBeenCalledWith(
        'default-title',
        expect.objectContaining({ text: undefined }),
        expect.anything(), mockHass, mockRequestUpdateCallback, expect.any(Function)
      );
      expect(mockTextElementConstructor).toHaveBeenCalledWith(
        'default-text',
        expect.objectContaining({ text: undefined }),
        expect.anything(), mockHass, mockRequestUpdateCallback, expect.any(Function)
      );
    });
  });

  describe('Custom Element Parsing', () => {
    describe('Grouping Logic', () => {
      it('should assign element to specified group ID', () => {
        const elements: LcarsElementConfig[] = [
          { id: 'el1', type: 'rectangle', group: 'groupA', props: { p1: 'v1'}, layout: {offsetX: 10} }
        ];
        const config: LcarsCardConfig = { type: 'lcars-card', elements };
        const groups = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(groups).toHaveLength(1);
        expect(groups[0].id).toBe('groupA');
        expect(groups[0].elements).toHaveLength(1);
        // Verify the element was constructed (constructor args checked in Element Instantiation tests)
        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
            'el1',
            { p1: 'v1', button: undefined }, // props merged
            { offsetX: 10 }, // layoutConfig
            mockHass,
            mockRequestUpdateCallback,
            expect.any(Function) // getShadowElement
        );
      });

      it('should assign element to "__ungrouped__" if group ID is not specified', () => {
        const elements: LcarsElementConfig[] = [
          { id: 'el1', type: 'rectangle' } // No group property
        ];
        const config: LcarsCardConfig = { type: 'lcars-card', elements };
        const groups = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(groups).toHaveLength(1);
        expect(groups[0].id).toBe('__ungrouped__');
        expect(groups[0].elements).toHaveLength(1);
        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
            'el1', { button: undefined }, {}, mockHass, mockRequestUpdateCallback, expect.any(Function)
        );
      });

      it('should handle multiple elements across different groups and ungrouped', () => {
        const elements: LcarsElementConfig[] = [
          { id: 'el1', type: 'rectangle', group: 'groupA' },
          { id: 'el2', type: 'text', group: 'groupB' },
          { id: 'el3', type: 'rectangle' }, // Ungrouped
          { id: 'el4', type: 'text', group: 'groupA' },
        ];
        const config: LcarsCardConfig = { type: 'lcars-card', elements };
        const groups = parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement); // Using default hass/callback for brevity

        expect(groups).toHaveLength(3); // groupA, groupB, __ungrouped__

        const groupA = groups.find(g => g.id === 'groupA');
        const groupB = groups.find(g => g.id === 'groupB');
        const ungrouped = groups.find(g => g.id === '__ungrouped__');

        expect(groupA).toBeDefined();
        expect(groupA?.elements).toHaveLength(2);
        expect(groupB).toBeDefined();
        expect(groupB?.elements).toHaveLength(1);
        expect(ungrouped).toBeDefined();
        expect(ungrouped?.elements).toHaveLength(1);

        // Check that constructors were called
        expect(mockRectangleElementConstructor).toHaveBeenCalledTimes(2);
        expect(mockTextElementConstructor).toHaveBeenCalledTimes(2);
      });
    });

    describe('Element Instantiation', () => {
      // Map element types to their mock constructors
      const elementTypesMap: Record<string, ReturnType<typeof vi.fn>> = {
        'text': mockTextElementConstructor,
        'rectangle': mockRectangleElementConstructor,
        'endcap': mockEndcapElementConstructor,
        'elbow': mockElbowElementConstructor,
        'chisel-endcap': mockChiselEndcapElementConstructor,
        'top_header': mockTopHeaderElementConstructor,
      };

      Object.entries(elementTypesMap).forEach(([type, mockConstructor]) => {
        it(`should correctly instantiate ${type} element with all properties`, () => {
          const elementConfig: LcarsElementConfig = {
            id: `el-${type}`,
            type: type,
            props: { customProp: 'value', fill: 'red' },
            layout: { offsetX: 10, width: '50%' },
            button: { enabled: true, text: 'Click', text_transform: 'none' }
          };
          const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };

          parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

          expect(mockConstructor).toHaveBeenCalledTimes(1);
          expect(mockConstructor).toHaveBeenCalledWith(
            `el-${type}`, // id
            { customProp: 'value', fill: 'red', button: { enabled: true, text: 'Click', text_transform: 'none' } }, // props (merged)
            { offsetX: 10, width: '50%' }, // layoutConfig
            mockHass,
            mockRequestUpdateCallback,
            expect.any(Function) // getShadowElement
          );
        });

        it(`should correctly instantiate ${type} element with varied type string casing/spacing`, () => {
          const variedType = `  ${type.toUpperCase()}   `; // With spaces and different case
          const elementConfig: LcarsElementConfig = {
            id: `el-${type}-varied`,
            type: variedType,
            // No props, layout, button for simplicity
          };
          const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };

          parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement); // Pass hass/cb

          expect(mockConstructor).toHaveBeenCalledTimes(1);
          expect(mockConstructor).toHaveBeenCalledWith(
            `el-${type}-varied`,
            { button: undefined }, // Default props if element.props is undefined
            {},                   // Default layout if element.layout is undefined
            mockHass,
            mockRequestUpdateCallback,
            expect.any(Function) // getShadowElement
          );
        });
      });

      it('should instantiate RectangleElement for an unknown type and log a warning', () => {
        const elementConfig: LcarsElementConfig = {
          id: 'el-unknown',
          type: 'unknown-type',
          props: { p: 1 },
          layout: { offsetX: 2 },
          button: { enabled: false, text_transform: 'none' }
        };
        const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };

        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledTimes(1);
        // Other constructors should not have been called for this element
        expect(mockTextElementConstructor).not.toHaveBeenCalled();

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'el-unknown',
          { p: 1, button: { enabled: false, text_transform: 'none' } },
          { offsetX: 2 },
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'LCARS Card Parser: Unknown element type "unknown-type". Defaulting to Rectangle.'
        );
      });

      it('should pass empty object for props if element.props is undefined, merging button', () => {
        const elementConfig: LcarsElementConfig = {
          id: 'el-no-props',
          type: 'rectangle',
          // props: undefined, // Implicitly undefined
          layout: { offsetX: 5 },
          button: { text: 'Button Action', text_transform: 'none' }
        };
        const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'el-no-props',
          { button: { text: 'Button Action', text_transform: 'none' } }, // props is just the button object
          { offsetX: 5 },
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
      });

      it('should pass empty object for layout if element.layout is undefined', () => {
        const elementConfig: LcarsElementConfig = {
          id: 'el-no-layout',
          type: 'rectangle',
          props: { fill: 'blue' },
          // layout: undefined // Implicitly undefined
          // button: undefined // Implicitly undefined
        };
        const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'el-no-layout',
          { fill: 'blue', button: undefined }, // props.button will be undefined
          {}, // layoutConfig will be {}
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
      });

      it('should pass button as undefined in merged props if element.button is undefined', () => {
        const elementConfig: LcarsElementConfig = {
          id: 'el-no-button',
          type: 'rectangle',
          props: { fill: 'green' },
          layout: { width: 100 },
          // button: undefined // Implicitly undefined
        };
        const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockRectangleElementConstructor).toHaveBeenCalledWith(
          'el-no-button',
          { fill: 'green', button: undefined }, // props.button remains undefined
          { width: 100 },
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
      });

       it('should handle element config where props, layout, and button are all undefined', () => {
        const elementConfig: LcarsElementConfig = {
          id: 'el-all-undefined',
          type: 'text',
          // props, layout, button are all implicitly undefined
        };
        const config: LcarsCardConfig = { type: 'lcars-card', elements: [elementConfig] };
        parseConfig(config, mockHass, mockRequestUpdateCallback, mockGetShadowElement);

        expect(mockTextElementConstructor).toHaveBeenCalledWith(
          'el-all-undefined',
          { button: undefined }, // props ends up as { button: undefined }
          {}, // layoutConfig is {}
          mockHass,
          mockRequestUpdateCallback,
          expect.any(Function) // getShadowElement
        );
      });
    });
  });
});
