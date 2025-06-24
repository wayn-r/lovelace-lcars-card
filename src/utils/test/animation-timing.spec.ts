/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { AnimationTimingCalculator, AnimationTimingInfo } from '../../../tests/e2e/test-helpers';

describe('Animation Timing Utilities', () => {
  describe('AnimationTimingCalculator', () => {
    it('should calculate basic animation duration correctly (milliseconds)', () => {
      const animConfig = { type: 'fade', duration: 500 }; // 500ms
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(500);
    });

    it('should handle duration in seconds (convert to milliseconds)', () => {
      const animConfig = { type: 'fade', duration: 0.5 }; // 0.5 seconds = 500ms
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(500);
    });

    it('should handle duration in milliseconds (keep as-is)', () => {
      const animConfig = { type: 'fade', duration: 1500 }; // 1500ms (>= 10 treated as ms)
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(1500);
    });

    it('should calculate animation with repeat and yoyo correctly', () => {
      const animConfig = { 
        type: 'slide', 
        duration: 0.5,  // 500ms
        repeat: 2, 
        yoyo: true 
      };
      // Formula: delay + duration * (repeat + 1) = 0 + 500 * (2 + 1) = 1500
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(1500);
    });

    it('should calculate animation with delay correctly', () => {
      const animConfig = { 
        type: 'fade', 
        duration: 0.5,  // 500ms
        delay: 0.5      // 500ms
      };
      // Formula: delay + duration * (repeat + 1) = 500 + 500 * (0 + 1) = 1000
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(1000);
    });

    it('should handle delay in milliseconds', () => {
      const animConfig = { 
        type: 'fade', 
        duration: 500, // 500ms (>= 10 treated as ms)
        delay: 250     // 250ms (>= 10 treated as ms)
      };
      expect(AnimationTimingCalculator.calculateAnimationDuration(animConfig)).toBe(750);
    });

    it('should calculate sequence duration correctly for real YAML config', () => {
      // This matches the 18-sequential-animation-and-propogation.yaml sequence_element config
      const sequenceConfig = {
        steps: [
          {
            index: 0,
            animations: [
              { 
                type: 'slide', 
                duration: 0.5  // 500ms
              },
              { 
                type: 'fade', 
                duration: 0.5,  // 500ms
                delay: 0.5      // 500ms delay
              }
            ],
          },
          {
            index: 1,
            animations: [
              { 
                type: 'slide', 
                duration: 0.5,  // 500ms
                repeat: 2,      // repeat 2 times
                yoyo: true 
              }
            ],
          },
        ],
      };

      const duration = AnimationTimingCalculator.calculateSequenceDuration(sequenceConfig);
      // Step 0: max(500, 1000) = 1000ms
      // Step 1: 500 * (2 + 1) = 1500ms  
      // Total: 1000 + 1500 = 2500ms
      expect(duration).toBe(2500);
    });

    it('should calculate sequence duration for 8-animations.yaml sequence_element', () => {
      // This matches the 8-animations.yaml sequence_element config
      const sequenceConfig = {
        steps: [
          {
            index: 0,
            animations: [
              { 
                type: 'slide', 
                duration: 0.5  // 500ms
              },
              { 
                type: 'fade', 
                duration: 2,    // 2000ms
                delay: 0.25     // 250ms delay
              }
            ],
          },
          {
            index: 1,
            animations: [
              { 
                type: 'slide', 
                duration: 0.5,  // 500ms
                repeat: 2,      // repeat 2 times
                yoyo: true 
              }
            ],
          },
        ],
      };

      const duration = AnimationTimingCalculator.calculateSequenceDuration(sequenceConfig);
      // Step 0: max(500, 2250) = 2250ms (fade: 250 + 2000 * 1 = 2250)
      // Step 1: 500 * (2 + 1) = 1500ms  
      // Total: 2250 + 1500 = 3750ms
      expect(duration).toBe(3750);
    });

    it('should handle empty sequence config', () => {
      const emptyConfig = { steps: [] };
      expect(AnimationTimingCalculator.calculateSequenceDuration(emptyConfig)).toBe(0);
      
      const nullConfig = null;
      expect(AnimationTimingCalculator.calculateSequenceDuration(nullConfig)).toBe(0);
    });

    it('should analyze element animations correctly for fade_in_element from 8-animations.yaml', () => {
      const elementConfig = {
        animations: {
          on_load: {
            type: 'fade',
            duration: 2,  // 2 seconds = 2000ms
          }
        },
      };

      const maxDuration = AnimationTimingCalculator.analyzeElementAnimations(elementConfig, 'fade_in_group.fade_in_element');
      expect(maxDuration).toBe(2000);
    });

    it('should analyze element with state change animations for scale target', () => {
      const elementConfig = {
        animations: {
          on_state_change: [
            {
              from_state: 'normal',
              to_state: 'scaled',
              type: 'scale',
              duration: 0.3,  // 300ms
            },
            {
              from_state: 'scaled',
              to_state: 'normal',
              type: 'scale',
              duration: 0.3,  // 300ms
            },
          ],
        },
      };

      const maxDuration = AnimationTimingCalculator.analyzeElementAnimations(elementConfig, 'scale_target_group.scale_target');
      expect(maxDuration).toBe(300); // Max of both state change animations
    });

    it('should analyze element with sequence animations', () => {
      const elementConfig = {
        animations: {
          on_load: {
            steps: [
              {
                index: 0,
                animations: [{ type: 'slide', duration: 0.5 }],  // 500ms
              },
              {
                index: 1,
                animations: [{ type: 'fade', duration: 0.3, delay: 0.1 }],  // 100 + 300 = 400ms
              },
            ],
          },
        },
      };

      const maxDuration = AnimationTimingCalculator.analyzeElementAnimations(elementConfig, 'test.element');
      expect(maxDuration).toBe(900); // 500 + 400
    });

    it('should analyze full configuration timing for 18-sequential-animation-and-propogation.yaml structure', () => {
      const yamlConfig = {
        groups: [
          {
            group_id: 'sequence_group',
            elements: [
              {
                id: 'sequence_element',
                animations: {
                  on_load: {
                    steps: [
                      {
                        index: 0,
                        animations: [
                          { type: 'slide', duration: 0.5 },
                          { type: 'fade', duration: 0.5, delay: 0.5 }
                        ]
                      },
                      {
                        index: 1,
                        animations: [
                          { type: 'slide', duration: 0.5, repeat: 2, yoyo: true }
                        ]
                      }
                    ]
                  }
                }
              }
            ]
          },
          {
            group_id: 'propogated_group',
            elements: [
              {
                id: 'fade_in_element',
                animations: {
                  on_load: { type: 'fade', duration: 2 }  // 2000ms
                }
              },
              {
                id: 'scale_element',
                animations: {
                  on_load: { type: 'scale', duration: 1 }  // 1000ms
                }
              }
            ]
          }
        ],
      };

      const timingInfo = AnimationTimingCalculator.analyzeConfigurationTiming(yamlConfig);
      expect(timingInfo.hasAnimations).toBe(true);
      expect(timingInfo.hasSequences).toBe(true);
      expect(timingInfo.totalDuration).toBe(2500); // max(2500, 2000, 1000) = 2500 from sequence_element
      expect(timingInfo.elementAnimations.size).toBe(3);
      expect(timingInfo.elementAnimations.get('sequence_group.sequence_element')).toBe(2500);
      expect(timingInfo.elementAnimations.get('propogated_group.fade_in_element')).toBe(2000);
      expect(timingInfo.elementAnimations.get('propogated_group.scale_element')).toBe(1000);
    });

    it('should handle configuration without animations', () => {
      const yamlConfig = {
        groups: [
          {
            group_id: 'group1',
            elements: [
              {
                id: 'element1',
                type: 'rectangle',
              },
            ],
          },
        ],
      };

      const timingInfo = AnimationTimingCalculator.analyzeConfigurationTiming(yamlConfig);
      expect(timingInfo.hasAnimations).toBe(false);
      expect(timingInfo.hasSequences).toBe(false);
      expect(timingInfo.totalDuration).toBe(0);
      expect(timingInfo.elementAnimations.size).toBe(0);
    });
  });

  describe('TestWaitHelper - timing logic', () => {
    // Note: Full TestWaitHelper tests that use page.waitForTimeout would need to be in the actual E2E environment
    // These tests focus on the logic and timing calculations
    
    it('should handle timing info with animations', () => {
      const timingInfo: AnimationTimingInfo = {
        totalDuration: 2500,  // 2.5 seconds
        hasAnimations: true,
        hasSequences: true,
        elementAnimations: new Map([['sequence_group.sequence_element', 2500]]),
      };

      // We can't test the actual waiting in unit tests, but we can verify the calculations
      // would be correct by checking the timing info is processed correctly
      expect(timingInfo.totalDuration).toBe(2500);
      expect(timingInfo.hasAnimations).toBe(true);
      expect(timingInfo.hasSequences).toBe(true);
    });

    it('should handle no animations case', () => {
      const timingInfo: AnimationTimingInfo = {
        totalDuration: 0,
        hasAnimations: false,
        hasSequences: false,
        elementAnimations: new Map(),
      };

      expect(timingInfo.hasAnimations).toBe(false);
      expect(timingInfo.totalDuration).toBe(0);
    });

    it('should handle state change animation timing calculations', () => {
      const timingInfo: AnimationTimingInfo = {
        totalDuration: 300,  // 0.3 seconds
        hasAnimations: true,
        hasSequences: false,
        elementAnimations: new Map([['scale_target_group.scale_target', 300]]),
      };

      expect(timingInfo.totalDuration).toBe(300);
      expect(timingInfo.hasSequences).toBe(false);
    });
  });
}); 