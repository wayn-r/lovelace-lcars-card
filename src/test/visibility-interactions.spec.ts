import { LcarsCard } from '../lovelace-lcars-card.js';
import { LcarsCardConfig, VisibilityTriggerConfig, ElementConfig, GroupConfig } from '../types';
import { LayoutElement } from '../layout/elements/element.js'; // To check isVisible

// Helper to wait for a certain amount of time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Ensure customElements are defined if not already
if (!customElements.get('lcars-card')) {
  customElements.define('lcars-card', LcarsCard);
}

describe('LcarsCard Visibility Interactions', () => {
  let card: LcarsCard;
  let container: HTMLElement;

  const setupCard = async (config: LcarsCardConfig) => {
    card = document.createElement('lcars-card') as LcarsCard;
    document.body.appendChild(container); // Card needs to be in DOM for some calculations
    container.appendChild(card);

    // Mock hass object
    card.hass = {
      states: {},
      localize: jest.fn(),
      callService: jest.fn(),
      callApi: jest.fn(),
      subscribeMessage: jest.fn(),
      subscribeEntities: jest.fn(),
      sendWS: jest.fn(),
      getUser: jest.fn(),
      formatEntityState: jest.fn(),
      formatEntityAttributeName: jest.fn(),
      formatEntityAttributeValue: jest.fn(),
      formatDateTime: jest.fn(),
      formatDate: jest.fn(),
      formatTime: jest.fn(),
      formatDateTimeWithSeconds: jest.fn(),
      formatDateTimeNumeric: jest.fn(),
      formatDateNumeric: jest.fn(),
      formatTimeNumeric: jest.fn(),
      formatTimeWithSeconds: jest.fn(),
      formatDuration: jest.fn(),
      formatNumber: jest.fn(),
      formatPercentage: jest.fn(),
      formatRelativeTime: jest.fn(),
      setTheme: jest.fn(),
      themes: {} as any,
      selectedTheme: null,
      dockedSidebar: "auto",
      moreInfoEntities: {},
      user: { id: 'test', is_admin: true, name: 'Test User', is_owner: true, credentials: [], mfa_modules: [] },
      config: { components: [], elevation: 0, latitude: 0, longitude: 0, location_name: '', time_zone: '', unit_system: { length: 'km', mass: 'kg', temperature: '°C', volume: 'L' }, version: '' },
      resources: {},
      panels: {},
      translationMetadata: {} as any,
      suspendWhenHidden: true,
      enableShortcuts: true,
      vibrate: true,
      connection: {} as any,
    } as any;

    card.setConfig(config);

    // Wait for the card to update and render its shadow DOM
    await card.updateComplete;

    // Mock containerRect for layout calculation
    // @ts-ignore For testing private properties
    card._containerRect = new DOMRect(0, 0, 600, 200);
    // @ts-ignore
    await card._performLayoutCalculation(card._containerRect);
    await card.updateComplete; // Ensure re-render after layout
  };

  beforeEach(() => {
    // Create a container for the card for each test
    container = document.createElement('div');
    // Mock jest functions if not in a Jest environment (basic mock)
    if (typeof jest === 'undefined') {
      // @ts-ignore
      global.jest = {
        fn: () => {
          const mockFn = (...args: any[]) => { mockFn.mock.calls.push(args); };
          mockFn.mock = { calls: [] };
          return mockFn;
        },
        spyOn: (obj: any, method: string) => {
          const original = obj[method];
          obj[method] = jest.fn();
          return { mockRestore: () => { obj[method] = original; } };
        },
        useFakeTimers: () => {},
        advanceTimersByTime: () => {},
        clearAllTimers: () => {},
        runOnlyPendingTimers: () => {},
      };
    }
  });

  afterEach(() => {
    if (card && card.parentNode) {
      card.parentNode.removeChild(card);
    }
    if (container && container.parentNode) {
        container.parentNode.removeChild(container);
    }
    // @ts-ignore
    if (global.jest && jest.clearAllTimers) { // Check if jest and clearAllTimers exist
        // @ts-ignore
        jest.clearAllTimers();
    }
  });

  // --- Test Scenarios ---

  it('1. Basic Click Toggle: should toggle target visibility on trigger click', async () => {
    const config: LcarsCardConfig = {
      type: 'custom:lcars-card',
      groups: [
        {
          group_id: 'test_group',
          elements: [
            { id: 'trigger1', type: 'text', layout: { x: 0, y: 0, width: 50, height: 20 }, props: { text: 'Trigger', interactions: { visibility_triggers: [{ event: 'click', action: 'toggle', targets: ['target1'] }] } } },
            { id: 'target1', type: 'text', layout: { x: 0, y: 30, width: 50, height: 20 }, props: { text: 'Target' } },
          ],
        },
      ],
    };
    await setupCard(config);

    const triggerElement = card.shadowRoot?.getElementById('trigger1');
    // @ts-ignore
    const targetLayoutElement = card._layoutEngine.getElementById('target1') as LayoutElement;

    expect(targetLayoutElement.isVisible).toBe(true); // Initially visible

    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false); // Hidden after first click

    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Visible after second click
  });

  it('2. Basic Hover Show/Hide: should show/hide target on trigger hover (no delay)', async () => {
    const config: LcarsCardConfig = {
      type: 'custom:lcars-card',
      groups: [
        {
          group_id: 'test_group',
          elements: [
            { id: 'trigger2', type: 'text', layout: { x: 0, y: 0, width: 50, height: 20 }, props: { text: 'Trigger', interactions: { visibility_triggers: [{ event: 'hover', action: 'show', targets: ['target2'], hover_options: { mode: 'show_on_enter_hide_on_leave' } }] } } },
            { id: 'target2', type: 'text', layout: { x: 0, y: 30, width: 50, height: 20 }, props: { text: 'Target' } },
          ],
        },
      ],
    };
    await setupCard(config);

    const triggerElement = card.shadowRoot?.getElementById('trigger2');
    // @ts-ignore
    const targetLayoutElement = card._layoutEngine.getElementById('target2') as LayoutElement;

    expect(targetLayoutElement.isVisible).toBe(true); // Initially visible - show() won't change it but hide will.
                                                      // Let's make it initially hidden for a clearer test.
    targetLayoutElement.hide();
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false);


    triggerElement?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Visible on mouseenter

    triggerElement?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false); // Hidden on mouseleave
  });

  it('3. Hover Show/Hide with Delay: should show/hide target with delay', async () => {
    // @ts-ignore
    if (jest.useFakeTimers) jest.useFakeTimers(); // Use Jest's fake timers

    const hideDelay = 100;
    const config: LcarsCardConfig = {
      type: 'custom:lcars-card',
      groups: [
        {
          group_id: 'test_group',
          elements: [
            { id: 'trigger3', type: 'text', layout: { x: 0, y: 0, width: 50, height: 20 }, props: { text: 'Trigger', interactions: { visibility_triggers: [{ event: 'hover', action: 'show', targets: ['target3'], hover_options: { mode: 'show_on_enter_hide_on_leave', hide_delay: hideDelay } }] } } },
            { id: 'target3', type: 'text', layout: { x: 0, y: 30, width: 50, height: 20 }, props: { text: 'Target' } },
          ],
        },
      ],
    };
    await setupCard(config);

    const triggerElement = card.shadowRoot?.getElementById('trigger3');
    // @ts-ignore
    const targetLayoutElement = card._layoutEngine.getElementById('target3') as LayoutElement;
    targetLayoutElement.hide(); // Start hidden
    await card.updateComplete;

    triggerElement?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Visible immediately on mouseenter

    triggerElement?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Still visible immediately after mouseleave

    // @ts-ignore
    if (jest.advanceTimersByTime) jest.advanceTimersByTime(hideDelay + 10); else await wait(hideDelay + 10);
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false); // Hidden after delay

    // Bonus: Test clearing timeout
    triggerElement?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); // Show it
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true);

    triggerElement?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })); // Start timer to hide
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true);

    // @ts-ignore
    if (jest.advanceTimersByTime) jest.advanceTimersByTime(hideDelay / 2); else await wait(hideDelay / 2); // Wait for half the delay
    expect(targetLayoutElement.isVisible).toBe(true); // Still visible

    triggerElement?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); // Re-hover, should clear timeout
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Should remain visible

    // @ts-ignore
    if (jest.advanceTimersByTime) jest.advanceTimersByTime(hideDelay + 10); else await wait(hideDelay + 10); // Wait for original delay
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Should still be visible because hide timeout was cleared
  });

  it('4. Click Toggle with Revert on Click Outside: should revert visibility on outside click', async () => {
    const config: LcarsCardConfig = {
      type: 'custom:lcars-card',
      groups: [
        {
          group_id: 'test_group',
          elements: [
            { id: 'trigger4', type: 'rect', layout: { x: 0, y: 0, width: 50, height: 20 }, props: { interactions: { visibility_triggers: [{ event: 'click', action: 'toggle', targets: ['target4'], click_options: { behavior: 'toggle_and_revert_on_click_outside' } }] } } },
            { id: 'target4', type: 'rect', layout: { x: 0, y: 30, width: 50, height: 20 }, props: {} },
            { id: 'other_element', type: 'rect', layout: { x: 100, y: 0, width: 50, height: 20 }, props: {} },
          ],
        },
      ],
    };
    await setupCard(config);

    const triggerElement = card.shadowRoot?.getElementById('trigger4');
    const targetElement = card.shadowRoot?.getElementById('target4');
    const otherElement = card.shadowRoot?.getElementById('other_element');
    // @ts-ignore
    const targetLayoutElement = card._layoutEngine.getElementById('target4') as LayoutElement;

    expect(targetLayoutElement.isVisible).toBe(true);

    // Click trigger to hide target
    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false);

    // Click target itself, should not revert
    targetElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false);

    // Click other_element, should revert target
    otherElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await card.updateComplete;
    // This requires the global click listener on `document` to work.
    // We need to dispatch the click on document, or ensure the event bubbles up to it.
    document.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 150, clientY: 10 })); // Simulate click on where other_element would be
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Reverted to visible

    // Click trigger again (target hidden)
    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(false);

    // Click trigger source element (the <g> or <path> inside shadow DOM)
    // This should be treated as inside the trigger, so no revert.
    // The event listener on triggerElement already has stopPropagation.
    // The global click handler checks if the click was *outside* the trigger source.
    // So, clicking the trigger source *should not* cause a revert of other elements,
    // and it *should* toggle its own target as per its config.
    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await card.updateComplete;
    expect(targetLayoutElement.isVisible).toBe(true); // Toggled back to visible
  });

  it('5. Group Target: should toggle visibility of all elements in a target group', async () => {
    const config: LcarsCardConfig = {
      type: 'custom:lcars-card',
      groups: [
        {
          group_id: 'group_trigger',
          elements: [
            { id: 'trigger5', type: 'text', layout: { x: 0, y: 0, width: 50, height: 20 }, props: { text: 'Trigger', interactions: { visibility_triggers: [{ event: 'click', action: 'toggle', targets: ['target_group'] }] } } },
          ],
        },
        {
            group_id: 'target_group',
            layout: { x: 0, y: 30 }, // Group layout for positioning
            elements: [
                { id: 'target_group_el1', type: 'text', layout: { x:0, y:0, width: 50, height: 20 }, props: { text: 'Target El1' } },
                { id: 'target_group_el2', type: 'text', layout: { x:0, y:30, width: 50, height: 20 }, props: { text: 'Target El2' } },
            ]
        }
      ],
    };
    await setupCard(config);

    const triggerElement = card.shadowRoot?.getElementById('trigger5');
    // @ts-ignore
    const targetEl1 = card._layoutEngine.getElementById('target_group.target_group_el1') as LayoutElement;
    // @ts-ignore
    const targetEl2 = card._layoutEngine.getElementById('target_group.target_group_el2') as LayoutElement;

    expect(targetEl1.isVisible).toBe(true);
    expect(targetEl2.isVisible).toBe(true);

    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await card.updateComplete;
    expect(targetEl1.isVisible).toBe(false);
    expect(targetEl2.isVisible).toBe(false);

    triggerElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await card.updateComplete;
    expect(targetEl1.isVisible).toBe(true);
    expect(targetEl2.isVisible).toBe(true);
  });

});
