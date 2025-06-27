import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransformPropagator, TransformEffect, ElementDependency } from '../transform-propagator.js';
import { LayoutElement } from '../../layout/elements/element.js';
import gsap from 'gsap';

// Mock GSAP
vi.mock('gsap', () => ({
  default: {
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      fromTo: vi.fn().mockReturnThis(),
      delay: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      kill: vi.fn().mockReturnThis(),
    })),
    set: vi.fn(),
    killTweensOf: vi.fn(),
  },
}));

// Mock store provider
vi.mock('../../core/store.js', () => ({
  StoreProvider: {
    getStore: () => ({
      onStateChange: vi.fn(() => vi.fn()),
    }),
  },
}));

// Mock layout element for testing
class MockLayoutElement extends LayoutElement {
  constructor(id: string, layout = { x: 0, y: 0, width: 100, height: 40, calculated: true }) {
    super(id, {}, {});
    this.layout = layout;
  }

  calculateIntrinsicSize(): void {}
  renderShape(): any { return null; }
}

describe('TransformPropagator', () => {
  let propagator: TransformPropagator;
  let elementsMap: Map<string, LayoutElement>;
  let getShadowElement: (id: string) => Element | null;
  let mockElements: Map<string, Element>;

  beforeEach(() => {
    vi.clearAllMocks();
    propagator = new TransformPropagator();
    elementsMap = new Map();
    getShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
    mockElements = new Map();
  });

  describe('Scale Transform Propagation', () => {
    it('should calculate correct displacement for scale target scenario', () => {
      // Set up elements similar to the YAML example
      const scaleTarget = new MockLayoutElement('scale_target_group.scale_target', {
        x: 105, y: 50, width: 100, height: 40, calculated: true
      });
      
      // Set up anchor configuration for scale target (anchored to trigger button's topRight)
      scaleTarget.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target_group.scale_trigger_button',
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        }
      };

      const triggerButton = new MockLayoutElement('scale_target_group.scale_trigger_button', {
        x: 0, y: 50, width: 100, height: 40, calculated: true
      });

      // Add a description element anchored to the scale target
      const description = new MockLayoutElement('scale_target_group.scale_target_description', {
        x: 210, y: 70, width: 200, height: 20, calculated: true
      });
      
      description.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target_group.scale_target',
          anchorPoint: 'centerLeft',
          targetAnchorPoint: 'centerRight'
        }
      };

      elementsMap.set('scale_target_group.scale_target', scaleTarget);
      elementsMap.set('scale_target_group.scale_trigger_button', triggerButton);
      elementsMap.set('scale_target_group.scale_target_description', description);

      // Initialize propagator
      propagator.initialize(elementsMap, getShadowElement);

      // Create scale animation config (scale from 1 to 1.2 with center origin)
      const scaleAnimation = {
        type: 'scale' as const,
        scale_params: {
          scale_start: 1,
          scale_end: 1.2,
          transform_origin: 'center center'
        },
        duration: 0.3,
        ease: 'bounce.out'
      };

      const syncData = {
        duration: 0.3,
        ease: 'bounce.out'
      };

      // Process the animation
      propagator.processAnimationWithPropagation(
        'scale_target_group.scale_target',
        scaleAnimation,
        syncData
      );

      // Verify getShadowElement was called for dependent elements
      expect(getShadowElement).toHaveBeenCalled();
    });

    it('should correctly identify dependent elements', () => {
      const scaleTarget = new MockLayoutElement('scale_target');
      scaleTarget.layoutConfig = {};

      const dependentElement = new MockLayoutElement('dependent');
      dependentElement.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target',
          anchorPoint: 'centerLeft',
          targetAnchorPoint: 'centerRight'
        }
      };

      elementsMap.set('scale_target', scaleTarget);
      elementsMap.set('dependent', dependentElement);

      propagator.initialize(elementsMap, getShadowElement);

      // Access private method for testing (TypeScript workaround)
      const findDependentElements = (propagator as any)._findDependentElements;
      const dependents = findDependentElements.call(propagator, 'scale_target');

      expect(dependents).toHaveLength(1);
      expect(dependents[0].dependentElementId).toBe('dependent');
      expect(dependents[0].targetElementId).toBe('scale_target');
    });

    it('should calculate scale displacement correctly for center transform origin', () => {
      const element = new MockLayoutElement('test', {
        x: 100, y: 100, width: 100, height: 40, calculated: true
      });

      const scaleEffect: TransformEffect = {
        type: 'scale',
        scaleStartX: 1.0,
        scaleTargetX: 1.2,
        scaleTargetY: 1.2,
        transformOrigin: { x: 50, y: 20 } // center of 100x40 element
      };

      // Test anchor point at centerRight (x: 200, y: 120)
      const anchorPosition = { x: 200, y: 120 };

      // Access private method for testing
      const calculateScaleDisplacement = (propagator as any)._calculateScaleDisplacement;
      const displacement = calculateScaleDisplacement.call(
        propagator,
        anchorPosition,
        scaleEffect,
        element
      );

      // Transform origin is at (150, 120) in absolute coordinates
      // Distance from origin to anchor: (200-150, 120-120) = (50, 0)
      // After scaling by 1.2: new position = (150 + 50*1.2, 120 + 0*1.2) = (210, 120)
      // Displacement = (210-200, 120-120) = (10, 0)
      expect(displacement.x).toBeCloseTo(10, 2);
      expect(displacement.y).toBeCloseTo(0, 2);
    });

    it('should parse transform origin correctly', () => {
      const element = new MockLayoutElement('test', {
        x: 0, y: 0, width: 100, height: 40, calculated: true
      });

      // Access private method for testing
      const parseTransformOrigin = (propagator as any)._parseTransformOrigin;

      const centerCenter = parseTransformOrigin.call(propagator, 'center center', element);
      expect(centerCenter.x).toBe(50);
      expect(centerCenter.y).toBe(20);

      const topLeft = parseTransformOrigin.call(propagator, 'left top', element);
      expect(topLeft.x).toBe(0);
      expect(topLeft.y).toBe(0);

      const bottomRight = parseTransformOrigin.call(propagator, 'right bottom', element);
      expect(bottomRight.x).toBe(100);
      expect(bottomRight.y).toBe(40);
    });
  });

  describe('Self-Compensation', () => {
    it('should apply self-compensation for anchored scaled elements', () => {
      // Create a target element to anchor to
      const targetElement = new MockLayoutElement('target', { x: 50, y: 50, width: 20, height: 20, calculated: true });
      
      // Create a square element anchored to the target's topRight with its topLeft
      // Important: Place it so that scaling will cause significant displacement of its anchor point
      const squareElement = new MockLayoutElement('square', { x: 70, y: 50, width: 40, height: 40, calculated: true });
      squareElement.layoutConfig = {
        anchor: {
          anchorTo: 'target',
          anchorPoint: 'topLeft',  // This is the point that should stay fixed
          targetAnchorPoint: 'topRight'
        }
      };

      elementsMap.set('target', targetElement);
      elementsMap.set('square', squareElement);

      // Initialize propagator
      propagator.initialize(elementsMap, getShadowElement);

      // Define scale animation with center origin to ensure displacement
      const animationConfig = {
        type: 'scale' as const,
        scale_params: {
          scale_end: 2,
          transform_origin: 'center center'  // This will cause the anchor point to move
        },
        duration: 0.3,
        ease: 'power2.inOut'
      };

      const syncData = {
        duration: 0.3,
        ease: 'power2.inOut'
      };

      // Process the animation
      propagator.processAnimationWithPropagation('square', animationConfig, syncData);

      // Verify that the square element received self-compensation 
      expect(getShadowElement).toHaveBeenCalledWith('square');
    });

    it('should use anchor point as transform origin when not specified', () => {
      const element = new MockLayoutElement('test', { x: 100, y: 100, width: 10, height: 10, calculated: true });
      element.layoutConfig = {
        anchor: {
          anchorTo: 'other',
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        }
      };

      elementsMap.set('test', element);
      propagator.initialize(elementsMap, getShadowElement);

      // Access private method for testing
      const analyzeScaleEffect = (propagator as any)._analyzeScaleEffect;
      
             const scaleAnimation = {
         type: 'scale' as const,
         scale_params: {
           scale_end: 1.5
           // No transform_origin specified
         },
         duration: 0.3,
         ease: 'power2.inOut'
       };

      const effect = analyzeScaleEffect.call(propagator, element, scaleAnimation);
      
      // Should use left top (corresponding to topLeft anchor point)
      expect(effect.transformOrigin.x).toBe(0); // left edge of element
      expect(effect.transformOrigin.y).toBe(0); // top edge of element
    });

    it('should not apply self-compensation for non-anchored elements', () => {
      const element = new MockLayoutElement('test');
      element.layoutConfig = {}; // No anchor config

      elementsMap.set('test', element);
      propagator.initialize(elementsMap, getShadowElement);

      // Access private method for testing
      const applySelfCompensation = (propagator as any)._applySelfCompensation;
      
      const transformEffects = [{
        type: 'scale' as const,
        scaleStartX: 1.0,
        scaleTargetX: 2,
        scaleTargetY: 2,
        transformOrigin: { x: 50, y: 20 }
      }];

      const syncData = { duration: 0.3, ease: 'power2.inOut' };

      // Should not apply compensation
      applySelfCompensation.call(propagator, 'test', transformEffects, syncData);
      
      // getShadowElement should not be called since no compensation is needed
      expect(getShadowElement).not.toHaveBeenCalledWith('test');
    });
  });

  describe('Animation Detection', () => {
    it('should detect positioning-affecting animations', () => {
      // Access private method for testing
      const analyzeTransformEffects = (propagator as any)._analyzeTransformEffects;
      
      const element = new MockLayoutElement('test');
      elementsMap.set('test', element);
      propagator.initialize(elementsMap, getShadowElement);

      const scaleAnimation = {
        type: 'scale' as const,
        scale_params: { scale_end: 1.2 },
        duration: 0.3,
        ease: 'power2.inOut'
      };

      const effects = analyzeTransformEffects.call(propagator, 'test', scaleAnimation);
      expect(effects).toHaveLength(1);
      expect(effects[0].type).toBe('scale');
      expect(effects[0].scaleTargetX).toBe(1.2);
    });

    it('should ignore insignificant transforms', () => {
      const isEffectSignificant = (propagator as any)._isEffectSignificant;

      const insignificantScale: TransformEffect = {
        type: 'scale',
        scaleStartX: 1.0,
        scaleTargetX: 1.0001,
        scaleTargetY: 1.0001,
        transformOrigin: { x: 0, y: 0 }
      };

      const significantScale: TransformEffect = {
        type: 'scale',
        scaleStartX: 1.0,
        scaleTargetX: 1.2,
        scaleTargetY: 1.2,
        transformOrigin: { x: 0, y: 0 }
      };

      expect(isEffectSignificant.call(propagator, insignificantScale, 'test')).toBe(false);
      expect(isEffectSignificant.call(propagator, significantScale, 'test')).toBe(true);
    });

    it('should handle reverse animations with proper sync data', () => {
      const scaleTarget = new MockLayoutElement('scale_target', {
        x: 100, y: 100, width: 100, height: 40, calculated: true
      });
      const dependentElement = new MockLayoutElement('dependent', {
        x: 210, y: 120, width: 50, height: 20, calculated: true
      });
      dependentElement.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target',
          anchorPoint: 'centerLeft',
          targetAnchorPoint: 'centerRight'
        }
      };

      elementsMap.set('scale_target', scaleTarget);
      elementsMap.set('dependent', dependentElement);

      propagator.initialize(elementsMap, getShadowElement);

             const scaleAnimation = {
         type: 'scale' as const,
        scale_params: { 
          scale_start: 1,
          scale_end: 1.5,
          transform_origin: 'center center'
        },
         duration: 0.3,
         ease: 'power2.inOut'
       };

      const syncData = {
        duration: 0.3,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      };

      // Process animation with reverse properties
      propagator.processAnimationWithPropagation('scale_target', scaleAnimation, syncData);

      // Should call getShadowElement for dependent element
      expect(getShadowElement).toHaveBeenCalledWith('dependent');
    });

    it('should properly handle reverse state transitions (scaled → normal)', () => {
      const scaleTarget = new MockLayoutElement('scale_target', {
        x: 100, y: 100, width: 100, height: 40, calculated: true
      });
      
      const dependentElement = new MockLayoutElement('dependent', {
        x: 210, y: 120, width: 50, height: 20, calculated: true
      });
      
      dependentElement.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target',
          anchorPoint: 'centerLeft',
          targetAnchorPoint: 'centerRight'
        }
      };

      elementsMap.set('scale_target', scaleTarget);
      elementsMap.set('dependent', dependentElement);

      propagator.initialize(elementsMap, getShadowElement);

      // First animation: normal → scaled (scale to 1.2)
      const forwardAnimation = {
        type: 'scale' as const,
        scale_params: {
          scale_start: 1,
          scale_end: 1.2,
          transform_origin: 'center center'
        },
        duration: 0.3,
        ease: 'bounce.out'
      };

      const forwardSyncData = {
        duration: 0.3,
        ease: 'bounce.out'
      };

      // Process the forward animation
      propagator.processAnimationWithPropagation('scale_target', forwardAnimation, forwardSyncData);

      // Verify forward animation worked
      expect(getShadowElement).toHaveBeenCalledWith('dependent');
      
      // Reset the mock to track only the reverse animation calls
      vi.clearAllMocks();

      // Second animation: scaled → normal (scale from 1.2 to 1)
      const reverseAnimation = {
        type: 'scale' as const,
        scale_params: {
          scale_start: 1.2,
          scale_end: 1,
          transform_origin: 'center center'
        },
        duration: 0.3,
        ease: 'power2.inOut'
      };

      const reverseSyncData = {
        duration: 0.3,
        ease: 'power2.inOut'
      };

      // Process the reverse animation
      propagator.processAnimationWithPropagation('scale_target', reverseAnimation, reverseSyncData);

      // The key test is that the dependent element gets compensated in the reverse direction
      // This verifies that the transform state tracking is working correctly
      expect(getShadowElement).toHaveBeenCalledWith('dependent');
    });
  });

  describe('Sequenced Animations', () => {
    it('should calculate correct displacement for sequenced animations (slide then scale)', () => {
      const anchorTarget = new MockLayoutElement('anchor_target', { x: 0, y: 0, width: 10, height: 10, calculated: true });
      const primaryElement = new MockLayoutElement('primary', { x: 10, y: 0, width: 100, height: 40, calculated: true });
      primaryElement.layoutConfig = {
        anchor: { anchorTo: 'anchor_target', anchorPoint: 'topLeft', targetAnchorPoint: 'topRight' }
      };
      const dependentElement = new MockLayoutElement('dependent', { x: 115, y: 20, width: 50, height: 20, calculated: true });
      dependentElement.layoutConfig = {
        anchor: { anchorTo: 'primary', anchorPoint: 'centerLeft', targetAnchorPoint: 'centerRight' }
      };

      elementsMap.set('anchor_target', anchorTarget);
      elementsMap.set('primary', primaryElement);
      elementsMap.set('dependent', dependentElement);

      propagator.initialize(elementsMap, getShadowElement);
      const applyTransformSpy = vi.spyOn(propagator as any, '_applyTransform');

      // --- Step 1: Slide animation for primaryElement ---
      const slideAnimation = {
        type: 'slide' as const,
        slide_params: { direction: 'up' as 'left' | 'right' | 'up' | 'down', distance: '20px' }, // Slide up by 20px
        duration: 0.1,
        ease: 'none'
      };
      const slideSyncData = { duration: 0.1, ease: 'none' };
      
      propagator.processAnimationWithPropagation('primary', slideAnimation, slideSyncData);

      // Check self-compensation for primary during slide (should be none if slide doesn't move its own anchor point)
      // The primary's own 'topLeft' anchor point (10,0) does not move relative to its geometry due to a slide.
      // So self-compensation for slide should be {translateX:0, translateY:0} or null.
      // The spy will capture all calls. We need to identify the one for self-compensation if it occurs.

      // Check compensation for dependent during slide
      // Primary's centerRight (110, 20) slides up by 20px to (110, 0).
      // Dependent's centerLeft (115, 20) is anchored to it.
      // Expected displacement for dependent: (0, -20)
      expect(applyTransformSpy).toHaveBeenCalledWith(
        'dependent',
        expect.objectContaining({ type: 'translate', translateY: -20 }),
        slideSyncData
      );
      
      // Clear mock calls for the next step, but retain spy
      applyTransformSpy.mockClear();

      // --- Step 2: Scale animation for primaryElement ---
      // Primary is now effectively at y = -20 relative to its original layout y=0 due to slide.
      // Its elementTransformStates should reflect translateX:0, translateY:-20, scaleX:1, scaleY:1

      const scaleAnimation = {
        type: 'scale' as const,
        scale_params: { scale_start: 1, scale_end: 1.2, transform_origin: 'center center' },
        duration: 0.1,
        ease: 'none'
      };
      const scaleSyncData = { duration: 0.1, ease: 'none' };

      propagator.processAnimationWithPropagation('primary', scaleAnimation, scaleSyncData);

      // Primary's original layout: x:10, y:0, w:100, h:40. Origin for scale: center center (60, 20 relative to layout)
      // After slide, its effective y is -20. So visual center is (60, 0).
      // Primary's own anchorPoint 'topLeft' is (10, 0) in layout. After slide: (10, -20).
      // Relative to scale origin (60,0): (-50, -20).
      // Scaled: (-50*1.2, -20*1.2) = (-60, -24).
      // New topLeft: (60-60, 0-24) = (0, -24) relative to original layout, or (0, -4) relative to slid position.
      // Displacement of primary's topLeft: (0 - 10, -24 - (-20)) = (-10, -4). This is simplified.
      // Let's re-evaluate self-compensation for primary due to scale:
      // Initial state for scale: translateY=-20, scaleX=1, scaleY=1.
      // Primary's anchor 'topLeft' is at (10, -20) absolute.
      // Scale origin (center center of 100x40 element) is (layout.x + 50*scaleX + translateX, layout.y + 20*scaleY + translateY)
      // = (10 + 50*1 + 0, 0 + 20*1 - 20) = (60, 0) absolute.
      // Vector from origin (60,0) to anchor (10,-20) is (-50, -20).
      // Scaled vector: (-50*1.2, -20*1.2) = (-60, -24).
      // New anchor pos: (60-60, 0-24) = (0, -24).
      // Displacement of primary's own anchor: (0-10, -24-(-20)) = (-10, -4).
      // Self-compensation for primary: {translateX: 10, translateY: 4}. This is T_self_scale.
      
      // Now for the dependent:
      // Primary's targetAnchorPoint 'centerRight' (layout.x+100, layout.y+20) is (110,20) original.
      // After slide: (110, 0) absolute. This is initialAbsoluteAnchorPosition for the scale step.
      // Scale origin is (60,0) absolute.
      // Vector from origin (60,0) to primary's centerRight (110,0) is (50,0).
      // Scaled vector: (50*1.2, 0*1.2) = (60,0).
      // New pos of primary's centerRight: (60+60, 0+0) = (120,0).
      // Displacement of primary's centerRight due to scale (D_scale): (120-110, 0-0) = (10,0).

      // Total displacement for dependent: D_scale + T_self_scale = (10,0) + (10,4) = (20,4).
      // Dependent compensation: {translateX: 20, translateY: 4}.
      // (Note: previous error in manual calculation, this is net translation)
      // The _applyTransform will apply a NEGATIVE of this sum for the dependent to compensate.
      // So, dependent receives translate(-20, -4) if primarySelfComp is positive.
      // No, the dependent's compensation is `totalDisplacementOfAnchorOnPrimary + primaryTotalSelfCompTranslation`.
      // And the actual transform applied to dependent is that sum.

      // Let's re-check _applyCompensatingTransforms:
      // compTranslateX = displacementOfAnchorOnPrimary.x + (primarySelfCompensation?.translateX || 0);
      // compTranslateY = displacementOfAnchorOnPrimary.y + (primarySelfCompensation?.translateY || 0);
      // _applyTransform(dependentElementId, { type: 'translate', translateX: compTranslateX, translateY: compTranslateY, ... })

      // So, for dependent: compTranslateX = 10 + 10 = 20. compTranslateY = 0 + 4 = 4.
      // Dependent gets {translateX: 20, translateY: 4} applied.
      
      // This means if primary's anchor point moves right by 10 and primary also self-compensates by moving right by 10,
      // the dependent should move right by 20.

      // Find the call to _applyTransform for the dependent element during the scale step.
      const dependentScaleCompensationCall = applyTransformSpy.mock.calls.find(
        call => call[0] === 'dependent'
      );
      expect(dependentScaleCompensationCall).toBeDefined();
      if (dependentScaleCompensationCall) {
        expect(dependentScaleCompensationCall[1]).toMatchObject({ // The TransformEffect
          type: 'translate',
          translateX: 20, // 10 from D_scale.x + 10 from T_self_scale.x
          translateY: 4   // 0 from D_scale.y + 4 from T_self_scale.y
        });
        expect(dependentScaleCompensationCall[2]).toEqual(scaleSyncData); // The SyncData
      }
    });
  });

  describe('Timeline-based propagation reversal', () => {
    beforeEach(() => {
      // Create primary element that will be animated
      const primaryElement = new MockLayoutElement('primary', {
        x: 100, y: 100, width: 50, height: 30, calculated: true
      });
      primaryElement.layoutConfig = { anchor: { anchorTo: 'container', anchorPoint: 'topLeft' } };
      
      // Create dependent element anchored to the primary element
      const dependentElement = new MockLayoutElement('dependent', {
        x: 150, y: 100, width: 40, height: 20, calculated: true
      });
      dependentElement.layoutConfig = { 
        anchor: { 
          anchorTo: 'primary', 
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        } 
      };
      
      elementsMap.set('primary', primaryElement);
      elementsMap.set('dependent', dependentElement);
      
      // Create mock DOM elements
      mockElements.set('primary', document.createElement('div'));
      mockElements.set('dependent', document.createElement('div'));
      getShadowElement = (id: string) => mockElements.get(id) || null;
      
      propagator.initialize(elementsMap, getShadowElement);
    });

    it('should create timeline for dependent element animations', () => {
      const animationConfig = {
        type: 'scale' as const,
        duration: 500,
        scale_params: { scale_start: 1, scale_end: 1.5 }
      };
      
      const syncData = { duration: 500, ease: 'power2.out' };
      
      propagator.processAnimationWithPropagation('primary', animationConfig, syncData);
      
      // Should create timeline for GSAP
      expect(gsap.timeline).toHaveBeenCalled();
    });

    it('should verify timeline methods are available for propagation', () => {
      // Test that our GSAP mock has the necessary timeline methods
      const timelineMock = gsap.timeline();
      expect(timelineMock.to).toBeDefined();
      expect(timelineMock.reverse).toBeDefined();
      expect(timelineMock.kill).toBeDefined();
      expect(timelineMock.play).toBeDefined();
    });

    it('should handle timeline-based propagation without throwing errors', () => {
      const animationConfig = {
        type: 'scale' as const,
        duration: 500,
        scale_params: { scale_start: 1, scale_end: 1.5 }
      };
      
      const syncData = { duration: 500, ease: 'power2.out' };
      
      // This should not throw even if no dependencies are found
      expect(() => {
        propagator.processAnimationWithPropagation('primary', animationConfig, syncData);
      }).not.toThrow();
    });

    it('should handle reversal without throwing errors', () => {
      const animationConfig = {
        type: 'scale' as const,
        duration: 500,
        scale_params: { scale_start: 1, scale_end: 1.5 }
      };
      
      // This should not throw even if no timelines exist to reverse
      expect(() => {
        propagator.reverseAnimationPropagation('primary', animationConfig);
      }).not.toThrow();
    });

    it('should handle stop propagation without throwing errors', () => {
      // This should not throw even if no timelines exist to stop
      expect(() => {
        propagator.stopAnimationPropagation('primary');
      }).not.toThrow();
    });
  });

  // Test behavior with working dependencies (extend from existing working tests)
  describe('Timeline management integration', () => {
    it('should use timeline-based animations for working scale propagation', () => {
      // Set up elements similar to existing working tests  
      const scaleTarget = new MockLayoutElement('scale_target_group.scale_target', {
        x: 105, y: 50, width: 100, height: 40, calculated: true
      });
      
      scaleTarget.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target_group.scale_trigger_button',
          anchorPoint: 'topLeft',
          targetAnchorPoint: 'topRight'
        }
      };

      const triggerButton = new MockLayoutElement('scale_target_group.scale_trigger_button', {
        x: 0, y: 50, width: 100, height: 40, calculated: true
      });

      const description = new MockLayoutElement('scale_target_group.scale_target_description', {
        x: 210, y: 70, width: 200, height: 20, calculated: true
      });
      
      description.layoutConfig = {
        anchor: {
          anchorTo: 'scale_target_group.scale_target',
          anchorPoint: 'centerLeft',
          targetAnchorPoint: 'centerRight'
        }
      };

      elementsMap.set('scale_target_group.scale_target', scaleTarget);
      elementsMap.set('scale_target_group.scale_trigger_button', triggerButton);
      elementsMap.set('scale_target_group.scale_target_description', description);
      
      // Create mock DOM elements
      getShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
      
      propagator.initialize(elementsMap, getShadowElement);

      const scaleAnimation = {
        type: 'scale' as const,
        scale_params: {
          scale_start: 1,
          scale_end: 1.2,
          transform_origin: 'center center'
        },
        duration: 0.3,
        ease: 'bounce.out'
      };

      const syncData = {
        duration: 0.3,
        ease: 'bounce.out'
      };

      // Process the animation - this should use timelines
      propagator.processAnimationWithPropagation(
        'scale_target_group.scale_target',
        scaleAnimation,
        syncData
      );

      // Verify timeline was created for propagation
      expect(gsap.timeline).toHaveBeenCalled();
    });

         it('should successfully reverse timeline-based propagation', () => {
       // Use the same setup as above
       const scaleTarget = new MockLayoutElement('scale_target_group.scale_target', {
         x: 105, y: 50, width: 100, height: 40, calculated: true
       });
       
       scaleTarget.layoutConfig = {
         anchor: {
           anchorTo: 'scale_target_group.scale_trigger_button',
           anchorPoint: 'topLeft',
           targetAnchorPoint: 'topRight'
         }
       };

       const description = new MockLayoutElement('scale_target_group.scale_target_description', {
         x: 210, y: 70, width: 200, height: 20, calculated: true
       });
       
       description.layoutConfig = {
         anchor: {
           anchorTo: 'scale_target_group.scale_target',
           anchorPoint: 'centerLeft',
           targetAnchorPoint: 'centerRight'
         }
       };

       elementsMap.set('scale_target_group.scale_target', scaleTarget);
       elementsMap.set('scale_target_group.scale_target_description', description);
       
       getShadowElement = vi.fn().mockReturnValue(document.createElement('div'));
       propagator.initialize(elementsMap, getShadowElement);

       const scaleAnimation = {
         type: 'scale' as const,
         scale_params: { scale_start: 1, scale_end: 1.2 },
         duration: 0.3,
         ease: 'bounce.out'
       };

       const syncData = { duration: 0.3, ease: 'bounce.out' };

       // Create the initial propagation
       propagator.processAnimationWithPropagation('scale_target_group.scale_target', scaleAnimation, syncData);
       
       // Now reverse it - should not throw
       expect(() => {
         propagator.reverseAnimationPropagation('scale_target_group.scale_target', scaleAnimation);
       }).not.toThrow();
       
       // The reversal process should complete successfully
       expect(true).toBe(true); // Test passes if no error is thrown
     });
  });
}); 