import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorResolver, colorResolver } from '../color-resolver';
import { AnimationContext } from '../animation';

// Mock the Color class instead of animation manager since ColorResolver now uses Color
vi.mock('../color', () => ({
  Color: {
    withFallback: vi.fn(),
    from: vi.fn(),
  }
}));

import { Color } from '../color';

describe('ColorResolver', () => {
  let resolver: ColorResolver;
  const mockContext: AnimationContext = {
    elementId: 'test-element',
    getShadowElement: vi.fn(),
    hass: undefined,
    requestUpdateCallback: vi.fn()
  };

  // Mock Color instances
  const createMockColor = (resolveValue: string) => ({
    resolve: vi.fn().mockReturnValue(resolveValue),
    toStaticString: vi.fn().mockReturnValue(resolveValue),
    value: resolveValue,
    fallback: 'transparent'
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new ColorResolver();
  });

  describe('resolveAllElementColors', () => {
    it('should use default colors when no props colors are provided', () => {
      // Mock Color.from to return mock color instances
      (Color.from as any).mockImplementation((value: string) => createMockColor(value));

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
      (Color.from as any).mockImplementation((value: string) => createMockColor(value));
      
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

    it('should resolve colors using Color class', () => {
      const props = {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3,
        textColor: '#ffffff'
      };

      // Mock Color.withFallback to return mock color instances that resolve to the expected values
      (Color.withFallback as any)
        .mockReturnValueOnce(createMockColor('#ff0000'))  // For fill
        .mockReturnValueOnce(createMockColor('#00ff00'))  // For stroke
        .mockReturnValueOnce(createMockColor('#ffffff')); // For textColor

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(Color.withFallback).toHaveBeenCalledWith(props.fill, 'none');
      expect(Color.withFallback).toHaveBeenCalledWith(props.stroke, 'none');
      expect(Color.withFallback).toHaveBeenCalledWith(props.textColor, 'currentColor');

      expect(result).toEqual({
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: '3',
        textColor: '#ffffff'
      });
    });

    it('should handle undefined color properties gracefully', () => {
      const props = {
        strokeWidth: 2
      };

      (Color.from as any).mockImplementation((value: string) => createMockColor(value));

      const result = resolver.resolveAllElementColors('test-id', props, mockContext);

      expect(result).toEqual({
        fillColor: 'none',
        strokeColor: 'none',
        strokeWidth: '2',
        textColor: 'currentColor'
      });
    });

    describe('interactive state handling', () => {
      it('should pass state context to Color.resolve', () => {
        const props = {
          fill: '#666666'
        };

        const mockColor = createMockColor('#666666');
        (Color.withFallback as any).mockReturnValue(mockColor);

        const stateContext = {
          isCurrentlyHovering: true,
          isCurrentlyActive: false
        };

        resolver.resolveAllElementColors('test-id', props, mockContext, {}, stateContext);

        expect(mockColor.resolve).toHaveBeenCalledWith(
          'test-id',
          'fill',
          mockContext,
          stateContext
        );
      });

      it('should handle multiple interactive states', () => {
        const props = {
          fill: '#666666',
          stroke: '#333333',
          textColor: '#ffffff'
        };

        const fillMockColor = createMockColor('#ff0000');
        const strokeMockColor = createMockColor('#00ff00');
        const textMockColor = createMockColor('#0000ff');
        
        (Color.withFallback as any)
          .mockReturnValueOnce(fillMockColor)
          .mockReturnValueOnce(strokeMockColor)
          .mockReturnValueOnce(textMockColor);

        const stateContext = {
          isCurrentlyHovering: false,
          isCurrentlyActive: true
        };

        const result = resolver.resolveAllElementColors('test-id', props, mockContext, {}, stateContext);

        expect(fillMockColor.resolve).toHaveBeenCalledWith('test-id', 'fill', mockContext, stateContext);
        expect(strokeMockColor.resolve).toHaveBeenCalledWith('test-id', 'stroke', mockContext, stateContext);
        expect(textMockColor.resolve).toHaveBeenCalledWith('test-id', 'textColor', mockContext, stateContext);

        expect(result).toEqual({
          fillColor: '#ff0000',
          strokeColor: '#00ff00',
          strokeWidth: '0',
          textColor: '#0000ff'
        });
      });
    });
  });

  describe('createButtonPropsWithResolvedColors', () => {
    it('should create props with resolved colors only for defined props', () => {
      const originalProps = {
        fill: '#666666',
        text: 'Click me',
        customProp: 'value'
      };

      const mockColor = createMockColor('#ffaa00');
      (Color.withFallback as any).mockReturnValue(mockColor);

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        fill: '#ffaa00',
        text: 'Click me',
        customProp: 'value'
      });
    });

    it('should not override colors that were not in original props', () => {
      const originalProps = {
        text: 'Click me',
        customProp: 'value'
      };

      (Color.from as any).mockImplementation((value: string) => createMockColor(value));

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext);

      expect(result).toEqual({
        text: 'Click me',
        customProp: 'value'
      });
      // fill, stroke, and textColor should not be added if not in original props
      expect(result).not.toHaveProperty('fill');
      expect(result).not.toHaveProperty('stroke');
      expect(result).not.toHaveProperty('textColor');
    });

    it('should handle stateful colors in button props', () => {
      const originalProps = {
        fill: '#666666',
        textColor: '#ffffff',
        text: 'Click me'
      };

      const fillMockColor = createMockColor('#0099ff');
      const textMockColor = createMockColor('#ffaa00');
      
      (Color.withFallback as any)
        .mockReturnValueOnce(fillMockColor)
        .mockReturnValueOnce(textMockColor);

      const result = resolver.createButtonPropsWithResolvedColors('test-id', originalProps, mockContext, {
        isCurrentlyHovering: true,
        isCurrentlyActive: false
      });

      expect(result).toEqual({
        fill: '#0099ff',
        textColor: '#ffaa00',
        text: 'Click me'
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton colorResolver instance', () => {
      expect(colorResolver).toBeInstanceOf(ColorResolver);
    });
  });

  describe('resolveColor method', () => {
    it('should resolve single color values', () => {
      const mockColor = createMockColor('#ff0000');
      (Color.withFallback as any).mockReturnValue(mockColor);

      const result = resolver.resolveColor('#ff0000', 'test-element', 'fill', mockContext, {}, 'blue');

      expect(Color.withFallback).toHaveBeenCalledWith('#ff0000', 'blue');
      expect(mockColor.resolve).toHaveBeenCalledWith('test-element', 'fill', mockContext, {});
      expect(result).toBe('#ff0000');
    });

    it('should use transparent as default fallback', () => {
      const mockColor = createMockColor('#ff0000');
      (Color.withFallback as any).mockReturnValue(mockColor);

      resolver.resolveColor('#ff0000');

      expect(Color.withFallback).toHaveBeenCalledWith('#ff0000', 'transparent');
    });
  });
}); 