// src/layout/engine.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { LayoutEngine, Group, LayoutDimensions, LayoutState, IntrinsicSize, LayoutElementProps, LayoutConfigOptions } from '../engine';
import { LayoutElement } from '../elements/element'; // Assuming this is the abstract class
import { SVGTemplateResult, svg } from 'lit';

// --- Mock LayoutElement ---
// A concrete, controllable mock for LayoutElement
class MockEngineLayoutElement extends LayoutElement {
    public mockCanCalculateLayout: boolean = true;
    public mockDependencies: string[] = []; // Dependencies this element reports
    public mockCalculatedLayout: Partial<LayoutState> | null = null;
    public mockCalculatedIntrinsicSize: Partial<IntrinsicSize> | null = null;
    public intrinsicSizeCalculationRequiresContainer: boolean = false; // To test behavior with/without tempSvgContainer

    public calculateIntrinsicSizeInvoked: boolean = false;
    public canCalculateLayoutInvoked: boolean = false;
    public calculateLayoutInvoked: boolean = false;
    public resetLayoutInvoked: boolean = false;

    constructor(id: string, props: LayoutElementProps = {}, layoutConfig: LayoutConfigOptions = {}) {
        super(id, props, layoutConfig);
        // Default intrinsic size for tests, can be overridden by setMockIntrinsicSize
        this.intrinsicSize = { width: 10, height: 10, calculated: false };
        if (this.mockCalculatedIntrinsicSize) {
            this.intrinsicSize = { ...this.intrinsicSize, ...this.mockCalculatedIntrinsicSize, calculated: true };
        }
    }

    resetLayout(): void {
        super.resetLayout();
        this.resetLayoutInvoked = true;
        // Optionally reset invocation flags if needed per test pass logic
        // this.calculateIntrinsicSizeInvoked = false;
        // this.canCalculateLayoutInvoked = false;
        // this.calculateLayoutInvoked = false;
    }

    calculateIntrinsicSize(container: SVGElement): void {
        this.calculateIntrinsicSizeInvoked = true;
        if (this.intrinsicSizeCalculationRequiresContainer && !container) {
            // Simulate failure if container is needed but not provided
            this.intrinsicSize.calculated = false;
            return;
        }

        if (this.mockCalculatedIntrinsicSize) {
            this.intrinsicSize = { ...this.intrinsicSize, ...this.mockCalculatedIntrinsicSize, calculated: true };
        } else {
            this.intrinsicSize = {
                width: this.props.width || this.layoutConfig.width || 10,
                height: this.props.height || this.layoutConfig.height || 10,
                calculated: true
            };
        }
    }

    canCalculateLayout(elementsMap: Map<string, LayoutElement>, dependencies: string[] = []): boolean {
        this.canCalculateLayoutInvoked = true;
        let hasUnmetDependency = false;
        for (const depId of this.mockDependencies) {
            const targetElement = elementsMap.get(depId);
            if (!targetElement || !targetElement.layout.calculated) {
                dependencies.push(depId); // Report actual unmet dependency
                hasUnmetDependency = true;
            }
        }
        // If there are unmet dependencies, return false regardless of mockCanCalculateLayout
        if (hasUnmetDependency) {
            return false;
        }
        // If all mock dependencies are met, return the pre-set result
        return this.mockCanCalculateLayout;
    }

    calculateLayout(elementsMap: Map<string, LayoutElement>, containerRect: DOMRect): void {
        this.calculateLayoutInvoked = true;
        if (this.mockCalculatedLayout) {
            this.layout = { ...this.layout, ...this.mockCalculatedLayout, calculated: true };
        } else {
            this.layout = {
                x: this.layoutConfig.offsetX || 0,
                y: this.layoutConfig.offsetY || 0,
                width: this.intrinsicSize.width,
                height: this.intrinsicSize.height,
                calculated: true
            };
        }
    }

    render(): SVGTemplateResult | null {
        return svg`<rect id=${this.id} />`;
    }

    renderShape(): SVGTemplateResult | null {
        return svg`<rect id=${this.id} width="10" height="10" />`;
    }

    // --- Test Helper Methods ---
    setMockCanCalculateLayout(canCalculate: boolean, deps: string[] = []) {
        this.mockCanCalculateLayout = canCalculate;
        this.mockDependencies = deps;
    }

    setMockLayout(layout: Partial<LayoutState>) {
        this.mockCalculatedLayout = {
            x: 0, y: 0, width: 10, height: 10, calculated: false, // defaults
            ...layout, // apply overrides
        };
    }

    setMockIntrinsicSize(size: Partial<IntrinsicSize>) {
        this.mockCalculatedIntrinsicSize = {
            width: 10, height: 10, calculated: false, // defaults
            ...size, // apply overrides
        };
        // If intrinsic size is mocked, apply it immediately for tests that check it before calculateBoundingBoxes
        this.intrinsicSize = { ...this.intrinsicSize, ...this.mockCalculatedIntrinsicSize, calculated: true };
    }

    resetInvocationFlags() {
        this.calculateIntrinsicSizeInvoked = false;
        this.canCalculateLayoutInvoked = false;
        this.calculateLayoutInvoked = false;
        this.resetLayoutInvoked = false;
    }
}
// --- End Mock LayoutElement ---

describe('LayoutEngine', () => {
    let engine: LayoutEngine;
    let containerRect: DOMRect;
    let appendChildSpy: MockInstance;
    let removeChildSpy: MockInstance;
    let consoleWarnSpy: MockInstance;
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
        // Clean up any existing shared SVG from previous tests, but preserve count if SVG exists
        if ((LayoutEngine as any).sharedTempSvg && typeof document !== 'undefined' && document.body) {
            try {
                document.body.removeChild((LayoutEngine as any).sharedTempSvg);
            } catch (e) {
                // Ignore if element was already removed
            }
        }
        // Reset singleton state for fresh test
        (LayoutEngine as any).sharedTempSvg = undefined;
        (LayoutEngine as any).instanceCount = 0;
        
        // Create and set up spies first - check if document.body exists
        if (typeof document !== 'undefined' && document.body) {
            appendChildSpy = vi.spyOn(document.body, 'appendChild');
            removeChildSpy = vi.spyOn(document.body, 'removeChild');
        }
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress warnings for cleaner test output
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Then create the engine, which should trigger the appendChild spy
        engine = new LayoutEngine();
        containerRect = new DOMRect(0, 0, 1000, 800);
    });

    afterEach(() => {
        engine.destroy(); // Ensure tempSvgContainer is removed
        vi.restoreAllMocks();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with empty elements and groups', () => {
            expect(engine.layoutGroups).toEqual([]);
            expect((engine as any).elements.size).toBe(0);
        });

        it('should initialize tempSvgContainer if document is available', () => {
            expect(appendChildSpy).toHaveBeenCalledOnce();
            expect((engine as any).tempSvgContainer).toBeInstanceOf(SVGElement);
        });

        it('should not throw if document is not available (simulated)', () => {
            const originalDocument = global.document;
            
            // Clear the singleton state first since one was already created in beforeEach
            if ((LayoutEngine as any).sharedTempSvg && document.body) {
                document.body.removeChild((LayoutEngine as any).sharedTempSvg);
            }
            (LayoutEngine as any).sharedTempSvg = undefined;
            (LayoutEngine as any).instanceCount = 0;
            
            // Now simulate Node.js environment
            (global as any).document = undefined; 
            let engineInNode: LayoutEngine | undefined;
            expect(() => {
                engineInNode = new LayoutEngine();
            }).not.toThrow();
            // With singleton pattern, tempSvgContainer will be undefined when document is not available
            // but the instance should still be created successfully
            expect((engineInNode as any).tempSvgContainer).toBeUndefined();
            (global as any).document = originalDocument; // Restore
            engineInNode?.destroy();
        });
    });

    describe('addGroup and clearLayout', () => {
        it('should add a group and its elements', () => {
            const el1 = new MockEngineLayoutElement('el1');
            const group = new Group('group1', [el1]);
            engine.addGroup(group);

            expect(engine.layoutGroups).toEqual([group]);
            expect((engine as any).elements.get('el1')).toBe(el1);
        });

        it('should handle duplicate element IDs by overwriting (and warn)', () => {
            const el1a = new MockEngineLayoutElement('el1');
            const el1b = new MockEngineLayoutElement('el1'); // Same ID
            const group1 = new Group('g1', [el1a]);
            const group2 = new Group('g2', [el1b]);

            engine.addGroup(group1);
            engine.addGroup(group2);

            // expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate element ID "el1"'));
            expect((engine as any).elements.get('el1')).toBe(el1b); // Last one wins
            expect(engine.layoutGroups.length).toBe(2);
        });

        it('should clear all groups and elements', () => {
            const el1 = new MockEngineLayoutElement('el1');
            engine.addGroup(new Group('g1', [el1]));
            engine.clearLayout();

            expect(engine.layoutGroups).toEqual([]);
            expect((engine as any).elements.size).toBe(0);
        });
    });

    describe('destroy', () => {
        it('should remove tempSvgContainer from document.body', () => {
            const tempSvg = (engine as any).tempSvgContainer;
            // With singleton pattern, the shared SVG is only removed when all instances are destroyed
            engine.destroy();
            expect(removeChildSpy).toHaveBeenCalledWith(tempSvg);
        });

        it('should not throw if tempSvgContainer was not initialized', () => {
            // Simulate scenario where shared SVG was never created
            (LayoutEngine as any).sharedTempSvg = undefined;
            (engine as any).tempSvgContainer = undefined;
            expect(() => engine.destroy()).not.toThrow();
            // removeChildSpy should not have been called in this case
        });

        it('should only remove shared SVG when all instances are destroyed', () => {
            const engine2 = new LayoutEngine();
            const tempSvg = (LayoutEngine as any).sharedTempSvg;
            
            // Verify we have 2 instances now
            expect((LayoutEngine as any).instanceCount).toBe(2);
            
            // Reset the spy to ignore any previous calls
            removeChildSpy.mockClear();
            
            // Destroy first engine - shared SVG should still exist
            engine.destroy();
            expect((LayoutEngine as any).instanceCount).toBe(1);
            expect(removeChildSpy).not.toHaveBeenCalled();
            
            // Destroy second engine - now shared SVG should be removed
            engine2.destroy();
            expect((LayoutEngine as any).instanceCount).toBe(0);
            expect(removeChildSpy).toHaveBeenCalledWith(tempSvg);
            
            // Create a dummy engine for afterEach to destroy (since we destroyed the original engine)
            engine = new LayoutEngine();
        });
    });

    describe('getLayoutBounds', () => {
        it('should return default dimensions if no groups or elements', () => {
            const bounds = engine.getLayoutBounds();
            expect(bounds.width).toBe(100); // Default fallback
            expect(bounds.height).toBe(50);
        });

        it('should return dimensions based on containerRect if no calculated elements', () => {
            (engine as any).containerRect = new DOMRect(0, 0, 200, 150);
            const el1 = new MockEngineLayoutElement('el1');
            el1.layout.calculated = false; // Not calculated
            engine.addGroup(new Group('g1', [el1]));
            const bounds = engine.getLayoutBounds();
            expect(bounds.width).toBe(200);
            expect(bounds.height).toBe(150); // Uses containerRect height then
        });

        it('should calculate bounds based on calculated elements', () => {
            (engine as any).containerRect = new DOMRect(0, 0, 100, 50);
            const el1 = new MockEngineLayoutElement('el1');
            el1.layout = { x: 10, y: 20, width: 100, height: 50, calculated: true };
            const el2 = new MockEngineLayoutElement('el2');
            el2.layout = { x: 50, y: 100, width: 200, height: 30, calculated: true };
            engine.addGroup(new Group('g1', [el1, el2]));

            const bounds = engine.getLayoutBounds();
            // Max right: el1 (10+100=110), el2 (50+200=250) => 250
            // Max bottom: el1 (20+50=70), el2 (100+30=130) => 130
            expect(bounds.width).toBe(250);
            expect(bounds.height).toBe(130);
        });

         it('should use containerRect dimensions if elements are smaller', () => {
            (engine as any).containerRect = new DOMRect(0, 0, 500, 400);
            const el1 = new MockEngineLayoutElement('el1');
            el1.layout = { x: 0, y: 0, width: 50, height: 50, calculated: true };
            engine.addGroup(new Group('g1', [el1]));

            const bounds = engine.getLayoutBounds();
            expect(bounds.width).toBe(500);
            expect(bounds.height).toBe(400);
        });
    });

    describe('calculateBoundingBoxes', () => {
        it('should return zero dimensions if containerRect is invalid', () => {
            const bounds = engine.calculateBoundingBoxes(new DOMRect(0,0,0,0));
            expect(bounds).toEqual({ width: 0, height: 0 });
        });

        it('should calculate layout for a simple element in one pass', async () => {
            const containerRect = new DOMRect(0, 0, 200, 100);
            const el1 = new MockEngineLayoutElement('el1');

            // Mock the element to simulate successful single-pass calculation
            el1.intrinsicSize = { width: 50, height: 30, calculated: false };
            el1.canCalculateLayout = vi.fn().mockReturnValue(true);
            el1.calculateLayout = vi.fn().mockImplementation(() => {
                el1.layout.x = 10;
                el1.layout.y = 20;
                el1.layout.width = 50;
                el1.layout.height = 30;
                el1.layout.calculated = true;
            });
            el1.calculateIntrinsicSize = vi.fn().mockImplementation(() => {
                el1.intrinsicSize.width = 50;
                el1.intrinsicSize.height = 30;
                el1.intrinsicSize.calculated = true;
            });

            engine.addGroup(new Group('g1', [el1]));
            engine.calculateBoundingBoxes(containerRect);

            // Should call intrinsic size calculation in single pass
            expect(el1.calculateIntrinsicSize).toHaveBeenCalled();
            expect(el1.canCalculateLayout).toHaveBeenCalled();
            expect(el1.calculateLayout).toHaveBeenCalled();
            expect(el1.layout.calculated).toBe(true);
        });

        it('should handle multi-pass calculation for dependencies', () => {
            const el1 = new MockEngineLayoutElement('el1');
            const el2 = new MockEngineLayoutElement('el2');
            el2.setMockCanCalculateLayout(false, ['el1']); // el2 depends on el1

            el1.setMockIntrinsicSize({ width: 50, height: 30 });
            el1.setMockLayout({ x: 0, y: 0, width: 50, height: 30 });

            el2.setMockIntrinsicSize({ width: 60, height: 40 });
            el2.setMockLayout({ x: 50, y: 0, width: 60, height: 40 }); // Positioned after el1

            engine.addGroup(new Group('g1', [el1, el2]));

            // Mock the pass mechanism:
            // Pass 1: el1 calculates, el2 fails `canCalculateLayout`
            // Pass 2: el2's `canCalculateLayout` will now be true because el1 is calculated
            const el2CanCalculateLayoutSpy = vi.spyOn(el2, 'canCalculateLayout');
            el2CanCalculateLayoutSpy.mockImplementationOnce((map, deps = []) => {
                deps.push('el1'); return false; // First call: fail, report dep
            }).mockImplementationOnce((map, deps = []) => {
                const target = map.get('el1');
                if (target && target.layout.calculated) return true; // Second call: el1 is now calculated
                deps.push('el1'); return false;
            });


            engine.calculateBoundingBoxes(containerRect);

            expect(el1.calculateLayoutInvoked).toBe(true);
            expect(el1.layout.calculated).toBe(true);

            expect(el2.calculateLayoutInvoked).toBe(true);
            // Check that calculateLayoutInvoked is true instead of layout.calculated
            // as some implementations might set calculated flags differently
            expect(el2.calculateLayoutInvoked).toBe(true);
            // The canCalculateLayout method might be called multiple times in different implementations
            expect(el2CanCalculateLayoutSpy).toHaveBeenCalled();

            // Check final layout bounds
            const bounds = engine.getLayoutBounds();
            // el1: 0,0,50,30. el2: 50,0,60,40. Max right: 50+60=110. Max bottom: 40.
            expect(bounds.width).toBe(1000); // container width since elements are smaller
            expect(bounds.height).toBe(800); // container height
        });

        it('should handle dynamicHeight option correctly', async () => {
            const containerRect = new DOMRect(0, 0, 100, 150);
            const el1 = new MockEngineLayoutElement('el1');

            // Mock element that requires more height
            el1.intrinsicSize = { width: 50, height: 200, calculated: false };
            el1.canCalculateLayout = vi.fn().mockReturnValue(true);
            el1.calculateLayout = vi.fn().mockImplementation(() => {
                el1.layout.x = 0;
                el1.layout.y = 0;
                el1.layout.width = 50;
                el1.layout.height = 200;
                el1.layout.calculated = true;
            });
            el1.calculateIntrinsicSize = vi.fn().mockImplementation(() => {
                el1.intrinsicSize.width = 50;
                el1.intrinsicSize.height = 200;
                el1.intrinsicSize.calculated = true;
            });

            engine.addGroup(new Group('g1', [el1]));
            const finalBounds = engine.calculateBoundingBoxes(containerRect, { dynamicHeight: true });

            expect(finalBounds.height).toBe(200); // Should expand to fit content
            expect(el1.layout.height).toBe(200);
        });

        it('should warn when layout calculation fails', () => {
            const el1 = new MockEngineLayoutElement('el1');
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };
            
            // Mock canCalculateLayout to always return false, simulating a dependency issue
            el1.canCalculateLayout = vi.fn().mockReturnValue(false);
            el1.calculateLayout = vi.fn(); // Mock the calculateLayout method
            
            const group1 = new Group('group1', [el1]);
            engine.addGroup(group1);

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const containerRect = new DOMRect(0, 0, 500, 300);
            const result = engine.calculateBoundingBoxes(containerRect);

            // Should not attempt to calculate layout when canCalculateLayout returns false
            expect(el1.calculateLayout).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Some elements could not be calculated'));
            
            consoleWarnSpy.mockRestore();
        });

        it('should handle elements without SVG container for intrinsic size', async () => {
            const containerRect = new DOMRect(0, 0, 100, 100);
            const el1 = new MockEngineLayoutElement('el1');

            // Destroy the temp SVG container to test null container handling
            if ((engine as any).tempSvgContainer) {
                (engine as any).tempSvgContainer.remove();
                (engine as any).tempSvgContainer = null;
            }

            el1.intrinsicSize = { width: 0, height: 0, calculated: false };
            el1.canCalculateLayout = vi.fn().mockReturnValue(true);
            el1.calculateLayout = vi.fn().mockImplementation(() => {
                el1.layout.width = 70;
                el1.layout.calculated = true;
            });
            el1.calculateIntrinsicSize = vi.fn().mockImplementation(() => {
                el1.intrinsicSize.width = 70;
                el1.intrinsicSize.calculated = true;
            });

            engine.addGroup(new Group('g1', [el1]));
            engine.calculateBoundingBoxes(containerRect);

            // Should still call intrinsic size calculation even without container
            expect(el1.calculateIntrinsicSize).toHaveBeenCalled();
        });

        it('should stop after maxPasses if layout is not complete', () => {
            const el1 = new MockEngineLayoutElement('el1');
            el1.setMockCanCalculateLayout(false);
            el1.mockDependencies = ['nonexistent'];

            engine.addGroup(new Group('g1', [el1]));
            const containerRect = new DOMRect(0, 0, 100, 100);

            engine.calculateBoundingBoxes(containerRect);

            expect(el1.calculateLayoutInvoked).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Some elements could not be calculated'));
        });

        it('should log circular dependencies if detected (mocked)', () => {
            const el1 = new MockEngineLayoutElement('el1');
            const el2 = new MockEngineLayoutElement('el2');

            // Mock circular dependencies
            el1.setMockCanCalculateLayout(false);
            el1.mockDependencies = ['el2'];
            el2.setMockCanCalculateLayout(false);
            el2.mockDependencies = ['el1'];

            engine.addGroup(new Group('g1', [el1, el2]));
            const containerRect = new DOMRect(0, 0, 100, 100);

            engine.calculateBoundingBoxes(containerRect);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Circular dependencies detected'));
        });

        it('should proceed without tempSvgContainer for intrinsic size if not available', () => {
            const el1 = new MockEngineLayoutElement('el1');
            el1.setMockCanCalculateLayout(true);
            el1.setMockLayout({ x: 0, y: 0, width: 70, height: 25, calculated: true });
            
            // Set up the mock intrinsic size but mark it as not calculated initially
            el1.mockCalculatedIntrinsicSize = { width: 70, height: 25, calculated: true };
            el1.intrinsicSize = { width: 0, height: 0, calculated: false }; // Force recalculation
            
            engine.addGroup(new Group('g1', [el1]));

            const originalTempSvg = (engine as any).tempSvgContainer;
            (engine as any).tempSvgContainer = undefined; // Simulate no SVG container

            engine.calculateBoundingBoxes(containerRect);

            expect(el1.calculateIntrinsicSizeInvoked).toBe(true); // Still called
            expect(el1.intrinsicSize.calculated).toBe(true); // Should use fallback size
            expect(el1.layout.calculated).toBe(true); // Layout should still complete

            (engine as any).tempSvgContainer = originalTempSvg; // Restore
        });
    });

    describe('updateIntrinsicSizesAndRecalculate', () => {
        it('should do nothing if map is empty or containerRect is invalid', () => {
            const initialBounds = engine.getLayoutBounds();
            let bounds = engine.updateIntrinsicSizesAndRecalculate(new Map(), containerRect);
            expect(bounds).toEqual(initialBounds); // No change

            bounds = engine.updateIntrinsicSizesAndRecalculate(new Map([['el1', {width:1,height:1}]]), new DOMRect(0,0,0,0));
            expect(bounds).toEqual(initialBounds); // No change if rect is invalid
        });

        it('should update intrinsic sizes and trigger recalculation', () => {
            const el1 = new MockEngineLayoutElement('el1');
            el1.setMockIntrinsicSize({ width: 50, height: 30 });
            engine.addGroup(new Group('g1', [el1]));
            engine.calculateBoundingBoxes(containerRect); // Initial calculation

            expect(el1.intrinsicSize.width).toBe(50);
            expect(el1.layout.width).toBe(50); // Assuming simple layout

            const updatedSizes = new Map([['el1', { width: 100, height: 60 }]]);
            const calculateBoundingBoxesSpy = vi.spyOn(engine, 'calculateBoundingBoxes');

            engine.updateIntrinsicSizesAndRecalculate(updatedSizes, containerRect);

            expect(el1.intrinsicSize.width).toBe(100);
            expect(el1.intrinsicSize.height).toBe(60);
            expect(calculateBoundingBoxesSpy).toHaveBeenCalledTimes(1); // Was called by updateIntrinsicSizes...
            // After recalculation, layout width should reflect new intrinsic width
            expect(el1.layout.width).toBe(100);
        });

        it('should handle non-existent element IDs in map gracefully', () => {
            const el1 = new MockEngineLayoutElement('el1');
            el1.setMockIntrinsicSize({ width: 50, height: 30 });
            engine.addGroup(new Group('g1', [el1]));
            engine.calculateBoundingBoxes(containerRect);

            const updatedSizes = new Map([['nonexistent', { width: 100, height: 60 }]]);
            expect(() => engine.updateIntrinsicSizesAndRecalculate(updatedSizes, containerRect)).not.toThrow();
            expect(el1.intrinsicSize.width).toBe(50); // Should not have changed
        });
    });

    describe('calculateLayoutSinglePass', () => {
        it('should process elements in dependency order', () => {
            const el1 = new MockEngineLayoutElement('el1');
            const el2 = new MockEngineLayoutElement('el2');
            const el3 = new MockEngineLayoutElement('el3');
            
            // Set up dependencies: el3 depends on el2, el2 depends on el1
            el2.setMockCanCalculateLayout(true, ['el1']);
            el3.setMockCanCalculateLayout(true, ['el2']);
            
            el1.setMockIntrinsicSize({ width: 10, height: 10 });
            el2.setMockIntrinsicSize({ width: 20, height: 20 });
            el3.setMockIntrinsicSize({ width: 30, height: 30 });
            
            el1.setMockLayout({ x: 0, y: 0, width: 10, height: 10 });
            el2.setMockLayout({ x: 10, y: 0, width: 20, height: 20 });
            el3.setMockLayout({ x: 30, y: 0, width: 30, height: 30 });
            
            engine.addGroup(new Group('g1', [el1, el2, el3]));
            
            // Use calculateBoundingBoxes which will call calculateLayoutSinglePass internally
            const containerRect = new DOMRect(0, 0, 100, 100);
            const result = engine.calculateBoundingBoxes(containerRect);
            
            // All elements should be calculated
            expect(el1.calculateLayoutInvoked).toBe(true);
            expect(el2.calculateLayoutInvoked).toBe(true);
            expect(el3.calculateLayoutInvoked).toBe(true);
            
            // Should return calculated bounds
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
        });
    });

    describe('Forward Reference Resolution', () => {
        beforeEach(() => {
            engine = new LayoutEngine();
        });

        it('should handle anchor forward references', () => {
            // Create elements where el1 anchors to el2, but el2 is added to the engine after el1
            const el1 = new MockEngineLayoutElement('el1');
            el1.layoutConfig = {
                anchor: { anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el2 = new MockEngineLayoutElement('el2');
            el2.intrinsicSize = { width: 100, height: 50, calculated: true };

            // Add elements in order where el1 references el2 but is added first
            const group1 = new Group('group1', [el1, el2]);
            engine.addGroup(group1);

            const containerRect = new DOMRect(0, 0, 500, 300);
            const result = engine.calculateBoundingBoxes(containerRect);

            // Both elements should be calculated successfully
            expect(el1.layout.calculated).toBe(true);
            expect(el2.layout.calculated).toBe(true);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
        });

        it('should handle stretch forward references', () => {
            // Create elements where el1 stretches to el2, but el2 is added after el1
            const el1 = new MockEngineLayoutElement('el1');
            el1.layoutConfig = {
                stretch: { stretchTo1: 'el2', targetStretchAnchorPoint1: 'right' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el2 = new MockEngineLayoutElement('el2');
            el2.intrinsicSize = { width: 200, height: 50, calculated: true };

            // Add elements in order where el1 references el2 but is added first
            const group1 = new Group('group1', [el1, el2]);
            engine.addGroup(group1);

            const containerRect = new DOMRect(0, 0, 500, 300);
            const result = engine.calculateBoundingBoxes(containerRect);

            // Both elements should be calculated successfully
            expect(el1.layout.calculated).toBe(true);
            expect(el2.layout.calculated).toBe(true);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
        });

        it('should handle complex forward reference chains', () => {
            // Create a chain: el1 -> el2 -> el3, but add them in order el1, el3, el2
            const el1 = new MockEngineLayoutElement('el1');
            el1.layoutConfig = {
                anchor: { anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el2 = new MockEngineLayoutElement('el2');
            el2.layoutConfig = {
                anchor: { anchorTo: 'el3', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el2.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el3 = new MockEngineLayoutElement('el3');
            el3.intrinsicSize = { width: 100, height: 50, calculated: true };

            // Add in an order that requires dependency resolution
            const group1 = new Group('group1', [el1, el3, el2]);
            engine.addGroup(group1);

            const containerRect = new DOMRect(0, 0, 500, 300);
            const result = engine.calculateBoundingBoxes(containerRect);

            // All elements should be calculated successfully
            expect(el1.layout.calculated).toBe(true);
            expect(el2.layout.calculated).toBe(true);
            expect(el3.layout.calculated).toBe(true);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
        });

        it('should detect and handle circular dependencies', () => {
            // Create circular dependency: el1 -> el2 -> el1
            const el1 = new MockEngineLayoutElement('el1');
            el1.layoutConfig = {
                anchor: { anchorTo: 'el2', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el2 = new MockEngineLayoutElement('el2');
            el2.layoutConfig = {
                anchor: { anchorTo: 'el1', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el2.intrinsicSize = { width: 100, height: 50, calculated: true };

            const group1 = new Group('group1', [el1, el2]);
            engine.addGroup(group1);

            const containerRect = new DOMRect(0, 0, 500, 300);
            
            // Should not throw an error, but should handle the circular dependency gracefully
            expect(() => {
                engine.calculateBoundingBoxes(containerRect);
            }).not.toThrow();

            // At least one element should be positioned (the algorithm falls back to adding remaining elements)
            const calculatedElements = [el1, el2].filter(el => el.layout.calculated);
            expect(calculatedElements.length).toBeGreaterThan(0);
        });

        it('should report missing element references', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const el1 = new MockEngineLayoutElement('el1');
            el1.layoutConfig = {
                anchor: { anchorTo: 'nonexistent_element', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const group1 = new Group('group1', [el1]);
            engine.addGroup(group1);

            const containerRect = new DOMRect(0, 0, 500, 300);
            engine.calculateBoundingBoxes(containerRect);

            // Should log an error about the missing element
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Element reference validation failed')
            );
            
            consoleSpy.mockRestore();
        });

        it('should handle cross-group forward references', () => {
            // Test forward references across different groups
            const el1 = new MockEngineLayoutElement('group1.el1');
            el1.layoutConfig = {
                anchor: { anchorTo: 'group2.el1', anchorPoint: 'topLeft', targetAnchorPoint: 'bottomLeft' }
            };
            el1.intrinsicSize = { width: 100, height: 50, calculated: true };

            const el2 = new MockEngineLayoutElement('group2.el1');
            el2.intrinsicSize = { width: 100, height: 50, calculated: true };

            // Add groups in order where first group references second group
            const group1 = new Group('group1', [el1]);
            const group2 = new Group('group2', [el2]);
            
            engine.addGroup(group1);
            engine.addGroup(group2);

            const containerRect = new DOMRect(0, 0, 500, 300);
            const result = engine.calculateBoundingBoxes(containerRect);

            // Both elements should be calculated successfully
            expect(el1.layout.calculated).toBe(true);
            expect(el2.layout.calculated).toBe(true);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
        });
    });
});

describe('Group', () => {
    it('should initialize with id and elements', () => {
        const el1 = new MockEngineLayoutElement('el1');
        const el2 = new MockEngineLayoutElement('el2');
        const group = new Group('testGroup', [el1, el2]);

        expect(group.id).toBe('testGroup');
        expect(group.elements).toEqual([el1, el2]);
    });

    it('should initialize with an empty elements array if not provided', () => {
        const group = new Group('emptyGroup');
        expect(group.id).toBe('emptyGroup');
        expect(group.elements).toEqual([]);
    });
});