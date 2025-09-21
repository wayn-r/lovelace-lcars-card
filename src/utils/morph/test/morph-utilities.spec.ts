import { describe, it, expect } from 'vitest';
import { MorphUtilities } from '../morph-utilities.js';
import { RectangleElement } from '../../../layout/elements/rectangle.js';

describe('MorphUtilities', () => {
  it('appends unique suffixes to cloned mask definitions', () => {
    const element = new RectangleElement('rect-with-cutout', {
      text: 'TEST',
      cutout: true
    } as any, {});

    (element as any).layout = {
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      calculated: true
    };

    (element as any).resolveElementColors = () => ({
      fillColor: '#000',
      strokeColor: '#000',
      strokeWidth: 0
    });

    const utils = new MorphUtilities();
    const sourceClone = utils.createSyntheticElement(element, undefined, {
      initialOpacity: 1,
      idSuffix: '__morph_source'
    });
    const targetClone = utils.createSyntheticElement(element, undefined, {
      idSuffix: '__morph_target'
    });

    expect(sourceClone).toBeTruthy();
    expect(targetClone).toBeTruthy();

    const sourceMask = sourceClone?.querySelector('mask');
    const targetMask = targetClone?.querySelector('mask');

    expect(sourceMask?.id).toBe('rect-with-cutout__cutout-mask__morph_source');
    expect(targetMask?.id).toBe('rect-with-cutout__cutout-mask__morph_target');
    expect(sourceMask?.id).not.toBe(targetMask?.id);

    const sourceMaskedGroup = sourceClone?.querySelector('[mask]');
    const targetMaskedGroup = targetClone?.querySelector('[mask]');

    expect(sourceMaskedGroup?.getAttribute('mask')).toBe('url(#rect-with-cutout__cutout-mask__morph_source)');
    expect(targetMaskedGroup?.getAttribute('mask')).toBe('url(#rect-with-cutout__cutout-mask__morph_target)');
  });
});
