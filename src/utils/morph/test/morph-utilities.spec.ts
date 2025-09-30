import { describe, it, expect } from 'vitest';
import { MorphUtilities } from '../morph-utilities.js';
import { RectangleElement } from '../../../layout/elements/rectangle.js';
import { TextElement } from '../../../layout/elements/text.js';

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

  it('clones logger entry text nodes directly to preserve coordinates', () => {
    const textElement = new TextElement('logger_widget_entry_1', {
      text: 'LOGGER',
      fontSize: 14,
      textAnchor: 'start'
    } as any, {
      anchor: {
        anchorTo: 'logger_widget',
        anchorPoint: 'top-left',
        targetAnchorPoint: 'top-left'
      }
    } as any);

    (textElement as any).__loggerEntryMeta = {
      widgetId: 'logger_widget',
      entryId: 'logger_widget_entry_1'
    };

    textElement.layout = {
      x: 10,
      y: 20,
      width: 100,
      height: 20,
      calculated: true
    } as any;

    const svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;

    const originalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    originalText.setAttribute('id', 'logger_widget_entry_1');
    originalText.setAttribute('x', '25');
    originalText.setAttribute('y', '45');
    originalText.setAttribute('transform', 'translate(0, 30)');
    originalText.textContent = 'LOGGER';
    svgRoot.appendChild(originalText);

    const utils = new MorphUtilities();
    const result = utils.createOverlayWithClones(
      svgRoot,
      [textElement],
      () => originalText
    );

    const cloned = result.cloneElementsById.get('logger_widget_entry_1');
    expect(cloned).toBeTruthy();
    expect(cloned?.getAttribute('id')).toBe('logger_widget_entry_1__morph_source');
    expect(cloned?.getAttribute('y')).toBe('45');
    expect(cloned?.getAttribute('transform')).toBe('translate(0, 30)');
    expect(originalText.getAttribute('data-lcars-morph-hidden')).toBe('1');
    expect(result.hiddenOriginalElements.length).toBe(0);
  });
});
