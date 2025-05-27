import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorResolver, colorResolver } from '../color-resolver';
import { AnimationContext } from '../animation';

// Mock the animation manager
vi.mock('../animation', () => ({
  animationManager: {
    resolveDynamicColorWithAnimation: vi.fn()
  }
}));

import { animationManager } from '../animation';

describe('ColorResolver', () => {
  let resolver: ColorResolver;
  const mockContext: AnimationContext = {
    elementId: 'test-element',
    getShadowElement: vi.fn(),
    hass: undefined,
    requestUpdateCallback: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new ColorResolver();
  });

  describe('resolveAllElementColors', () => {
    it('should use default colors when no props colors are provided', () => {
      const props = {};
      const result = resolver.resolveAllElementColors('test-id', props, mockContext);
      
      expect(result).toEqual({
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: '0',
        textColor: 'currentColor'
      });
    });

    it('should use custom defaults when provided', () => {
      const props = {};
      const options = {
        fallbackFillColor: '#ff0000',
        fallbackStrokeColor: '#00ff00',
        fallbackStrokeWidth: '2',
        fallbackTextColor: '#ffffff'
      };
      
      const result = resolver.resolveAllElementColors('test-id', props, mockContext, options);
      
              expect(result).toEqual({
          fillColor: '#ff0000',
          strokeColor: '#00ff00',
          strokeWidth: '2',
          textColor: '#ffffff'
        });
    });

    it('should resolve dynamic colors through animation manager', () => {
      const props = {
        fill: { entity: 'light.test', mapping: { on: '#ffaa00', off: '#333333' } },
        stroke: '#00ff00',
        strokeWidth: 3,
        text_color: '#ffffff'
      };

      (animationManager.resolveDynamicColorWithAnimation as any)
        .mockReturnValueOnce('#ffaa00')  // For fill
        .mockReturnValueOnce('#00ff00')  // For stroke
        .mockReturnValueOnce('#ffffff'); // For text_color

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
        'test-id',
        props.fill,
        'fill',
        mockContext
      );
      expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
        'test-id',
        props.stroke,
        'stroke',
        mockContext
      );
      expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
        'test-id',
        props.text_color,
        'fill',
        mockContext
      );

      expect(result).toEqual({
        fillColor: '#ffaa00',
        strokeColor: '#00ff00',
        strokeWidth: '3',
        textColor: '#ffffff'
      });
    });

    it('should fallback to prop values when animation manager returns undefined', () => {
      const props = {
        fill: '#ff0000',
        stroke: '#00ff00',
        text_color: '#ffffff'
      };

      (animationManager.resolveDynamicColorWithAnimation as any)
        .mockReturnValue(undefined);

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(result).toEqual({
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: '0',
        textColor: '#ffffff'
      });
    });

    describe('stateful colors', () => {
      it('should use default color when no state is active', () => {
        const props = {
          fill: {
            default: '#666666',
            hover: '#0099ff',
            active: '#ff0099'
          }
        };

        (animationManager.resolveDynamicColorWithAnimation as any)
          .mockReturnValue('#666666');

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, {
          isCurrentlyHovering: false,
          isCurrentlyActive: false
        });

        expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
          'test-id',
          '#666666',
          'fill',
          mockContext
        );

        expect(result.fillColor).toBe('#666666');
      });

      it('should use hover color when hovering', () => {
        const props = {
          fill: {
            default: '#666666',
            hover: '#0099ff',
            active: '#ff0099'
          }
        };

        (animationManager.resolveDynamicColorWithAnimation as any)
          .mockReturnValue('#0099ff');

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, {
          isCurrentlyHovering: true,
          isCurrentlyActive: false
        });

        expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
          'test-id',
          '#0099ff',
          'fill',
          mockContext
        );

        expect(result.fillColor).toBe('#0099ff');
      });

      it('should use active color when active (priority over hover)', () => {
        const props = {
          fill: {
            default: '#666666',
            hover: '#0099ff',
            active: '#ff0099'
          }
        };

        (animationManager.resolveDynamicColorWithAnimation as any)
          .mockReturnValue('#ff0099');

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, {
          isCurrentlyHovering: true,
          isCurrentlyActive: true
        });

        expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
          'test-id',
          '#ff0099',
          'fill',
          mockContext
        );

        expect(result.fillColor).toBe('#ff0099');
      });

      it('should handle stateful colors with dynamic default', () => {
        const props = {
          fill: {
            default: {
              entity: 'light.test',
              mapping: { on: '#ffaa00', off: '#333333' },
              default: '#666666'
            },
            hover: '#0099ff',
            active: '#ff0099'
          }
        };

        (animationManager.resolveDynamicColorWithAnimation as any)
          .mockReturnValue('#ffaa00');

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, {
          isCurrentlyHovering: false,
          isCurrentlyActive: false
        });

        expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
          'test-id',
          props.fill.default,
          'fill',
          mockContext
        );

        expect(result.fillColor).toBe('#ffaa00');
      });

      it('should handle stateful text colors', () => {
        const props = {
          text_color: {
            default: '#ffffff',
            hover: '#ffaa00',
            active: '#ff0000'
          }
        };

        (animationManager.resolveDynamicColorWithAnimation as any)
          .mockReturnValue('#ffaa00');

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, {
          isCurrentlyHovering: true,
          isCurrentlyActive: false
        });

        expect(animationManager.resolveDynamicColorWithAnimation).toHaveBeenCalledWith(
          'test-id',
          '#ffaa00',
          'fill', // Text color uses fill internally for animation
          mockContext
        );

        expect(result.textColor).toBe('#ffaa00');
      });
    });
  });

  describe('createButtonPropsWithResolvedColors', () => {
    it('should create props with resolved colors only for defined props', () => {
      const originalProps = {
        fill: { entity: 'light.test', mapping: { on: '#ffaa00' } },
        text: 'Click me',
        customProp: 'value'
      };

      (animationManager.resolveDynamicColorWithAnimation as any)
        .mockReturnValue('#ffaa00');

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        fill: '#ffaa00',
        text: 'Click me',
        customProp: 'value'
      });
    });

    it('should not override colors that were not in original props', () => {
      const originalProps = {
        text: 'Click me'
      };

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        text: 'Click me'
      });
      expect(result).not.toHaveProperty('fill');
      expect(result).not.toHaveProperty('stroke');
      expect(result).not.toHaveProperty('text_color');
    });

    it('should handle stateful colors in button props', () => {
      const originalProps = {
        fill: {
          default: '#666666',
          hover: '#0099ff',
          active: '#ff0099'
        },
        text_color: {
          default: '#ffffff',
          hover: '#ffaa00'
        },
        text: 'Click me'
      };

      (animationManager.resolveDynamicColorWithAnimation as any)
        .mockReturnValueOnce('#0099ff')  // For fill
        .mockReturnValueOnce('#ffaa00'); // For text_color

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext, {
        isCurrentlyHovering: true,
        isCurrentlyActive: false
      });

      expect(result).toEqual({
        fill: '#0099ff',
        text_color: '#ffaa00',
        text: 'Click me'
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton colorResolver instance', () => {
      expect(colorResolver).toBeInstanceOf(ColorResolver);
    });
  });
}); 