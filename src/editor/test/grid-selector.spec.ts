// src/editor/grid-selector.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fireEvent } from 'custom-card-helpers'; // For testing event firing

// Import the component to test
import '../grid-selector'; // This registers the custom element
import { LcarsGridSelector } from '../grid-selector';

const ALL_POINTS = [
  'topLeft', 'topCenter', 'topRight',
  'centerLeft', 'center', 'centerRight',
  'bottomLeft', 'bottomCenter', 'bottomRight'
];
const CORNER_POINTS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const EDGE_POINTS = ['topCenter', 'centerLeft', 'centerRight', 'bottomCenter'];
const CENTER_POINT = 'center';

describe('LcarsGridSelector', () => {
  let element: LcarsGridSelector;

  // Helper to get a button by its point name
  const getButton = (point: string): HTMLButtonElement | null | undefined => {
    return element.shadowRoot?.querySelector(`#button-${point}`);
  };

  // Helper to get the ha-icon inside a button
  const getIconInButton = (point: string): Element | null | undefined => {
    return getButton(point)?.querySelector('ha-icon');
  };

  // Helper to get the center selected indicator icon
  const getCenterSelectedIndicator = (): Element | null | undefined => {
    return getButton(CENTER_POINT)?.querySelector('ha-icon.center-selected-indicator');
  };


  beforeEach(async () => {
    element = document.createElement('lcars-grid-selector') as LcarsGridSelector;
    document.body.appendChild(element);
    await element.updateComplete; // Wait for initial render
  });

  afterEach(() => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  describe('Initialization and Defaults', () => {
    it('should be registered as a custom element', () => {
      expect(customElements.get('lcars-grid-selector')).toBe(LcarsGridSelector);
    });

    it('should have correct default property values', () => {
      expect(element.label).toBe('');
      expect(element.value).toBe('');
      expect(element.disabled).toBe(false);
      expect(element.labelCenter).toBe(false);
      expect(element.disableCorners).toBe(false);
    });
  });

  describe('Rendering', () => {
    describe('Label', () => {
      it('should not render a label span if label property is empty', () => {
        const labelElement = element.shadowRoot?.querySelector('.anchor-grid-label');
        expect(labelElement).toBeNull();
      });

      it('should render the label text correctly when label property is set', async () => {
        element.label = 'Test Label';
        await element.updateComplete;
        const labelElement = element.shadowRoot?.querySelector('.anchor-grid-label');
        expect(labelElement).not.toBeNull();
        expect(labelElement?.textContent).toBe('Test Label');
      });

      it('should apply "center" class to label if labelCenter is true', async () => {
        element.label = 'Centered Label';
        element.labelCenter = true;
        await element.updateComplete;
        const labelElement = element.shadowRoot?.querySelector('.anchor-grid-label');
        expect(labelElement).not.toBeNull();
        expect(labelElement?.classList.contains('center')).toBe(true);
      });

      it('should not apply "center" class to label if labelCenter is false (default)', async () => {
        element.label = 'Default Label';
        await element.updateComplete;
        const labelElement = element.shadowRoot?.querySelector('.anchor-grid-label');
        expect(labelElement).not.toBeNull();
        expect(labelElement?.classList.contains('center')).toBe(false);
      });
    });

    describe('Grid Buttons', () => {
      it('should render 9 grid buttons', () => {
        const buttons = element.shadowRoot?.querySelectorAll('.anchor-grid-btn');
        expect(buttons?.length).toBe(9);
      });

      ALL_POINTS.forEach(point => {
        it(`should render button for "${point}" with correct title and icon`, () => {
          const button = getButton(point);
          expect(button).not.toBeNull();
          expect(button?.getAttribute('title')).toBe(point);

          const iconElement = getIconInButton(point);
          expect(iconElement).not.toBeNull();
          
          const iconMap: Record<string, string> = {
            topLeft: 'mdi:arrow-top-left', topCenter: 'mdi:arrow-up', topRight: 'mdi:arrow-top-right',
            centerLeft: 'mdi:arrow-left', center: 'mdi:circle-small', centerRight: 'mdi:arrow-right',
            bottomLeft: 'mdi:arrow-bottom-left', bottomCenter: 'mdi:arrow-down', bottomRight: 'mdi:arrow-bottom-right',
          };
          expect(iconElement?.getAttribute('icon')).toBe(iconMap[point]);
        });
      });
    });

    describe('Selected State', () => {
      it('should apply "selected" class to the button corresponding to the "value" property', async () => {
        element.value = 'centerLeft';
        await element.updateComplete;
        expect(getButton('centerLeft')?.classList.contains('selected')).toBe(true);
        expect(getButton('center')?.classList.contains('selected')).toBe(false);
      });

      it('should not have any button selected if "value" is empty', () => {
        ALL_POINTS.forEach(point => {
          expect(getButton(point)?.classList.contains('selected')).toBe(false);
        });
      });

      it('should show center-selected-indicator icon when center point is selected', async () => {
        element.value = 'center';
        await element.updateComplete;
        expect(getCenterSelectedIndicator()).not.toBeNull();
        expect(getCenterSelectedIndicator()?.getAttribute('icon')).toBe('mdi:circle');
      });

      it('should not show center-selected-indicator icon when center point is not selected', async () => {
        element.value = 'topLeft';
        await element.updateComplete;
        expect(getCenterSelectedIndicator()).toBeNull();
      });
    });

    describe('Disabled State', () => {
      it('should disable all buttons if component "disabled" property is true', async () => {
        element.disabled = true;
        await element.updateComplete;
        ALL_POINTS.forEach(point => {
          expect(getButton(point)?.hasAttribute('disabled')).toBe(true);
        });
      });

      it('should disable only corner buttons if "disableCorners" is true and component is not disabled', async () => {
        element.disableCorners = true;
        await element.updateComplete;
        
        CORNER_POINTS.forEach(point => {
          expect(getButton(point)?.hasAttribute('disabled')).toBe(true);
        });
        EDGE_POINTS.forEach(point => {
          expect(getButton(point)?.hasAttribute('disabled')).toBe(false);
        });
        expect(getButton(CENTER_POINT)?.hasAttribute('disabled')).toBe(false);
      });

      it('should disable all buttons if both "disabled" and "disableCorners" are true', async () => {
        element.disabled = true;
        element.disableCorners = true;
        await element.updateComplete;
        ALL_POINTS.forEach(point => {
          expect(getButton(point)?.hasAttribute('disabled')).toBe(true);
        });
      });

      it('should not disable any buttons by default', () => {
        ALL_POINTS.forEach(point => {
          expect(getButton(point)?.hasAttribute('disabled')).toBe(false);
        });
      });
    });
  });

  describe('Interactions and Events', () => {
    let valueChangedSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      valueChangedSpy = vi.fn();
      element.addEventListener('value-changed', valueChangedSpy);
    });

    it('should update "value" and fire "value-changed" event when a button is clicked', async () => {
      getButton('topRight')?.click();
      await element.updateComplete;

      expect(element.value).toBe('topRight');
      expect(valueChangedSpy).toHaveBeenCalledTimes(1);
      expect(valueChangedSpy.mock.calls[0][0].detail).toEqual({ value: 'topRight' });
      expect(getButton('topRight')?.classList.contains('selected')).toBe(true);
    });

    it('should clear "value" and fire "value-changed" event if a selected button is clicked again', async () => {
      element.value = 'bottomCenter';
      await element.updateComplete;

      getButton('bottomCenter')?.click();
      await element.updateComplete;

      expect(element.value).toBe('');
      expect(valueChangedSpy).toHaveBeenCalledTimes(1);
      expect(valueChangedSpy.mock.calls[0][0].detail).toEqual({ value: '' });
      expect(getButton('bottomCenter')?.classList.contains('selected')).toBe(false);
    });

    it('should do nothing if a disabled button is clicked (component disabled)', async () => {
      element.disabled = true;
      await element.updateComplete;

      getButton('center')?.click();
      await element.updateComplete;

      expect(element.value).toBe(''); // Should remain unchanged
      expect(valueChangedSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if a disabled corner button is clicked (disableCorners=true)', async () => {
      element.disableCorners = true;
      await element.updateComplete;

      getButton('topLeft')?.click(); // Click a corner button
      await element.updateComplete;

      expect(element.value).toBe(''); // Should remain unchanged
      expect(valueChangedSpy).not.toHaveBeenCalled();
    });

    it('should update value and fire event if a non-corner button is clicked when disableCorners=true', async () => {
      element.disableCorners = true;
      await element.updateComplete;

      getButton('centerLeft')?.click(); // Click an edge button
      await element.updateComplete;

      expect(element.value).toBe('centerLeft');
      expect(valueChangedSpy).toHaveBeenCalledTimes(1);
      expect(valueChangedSpy.mock.calls[0][0].detail).toEqual({ value: 'centerLeft' });
    });
  });
});