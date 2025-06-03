# Transform Propagation System

## Overview

The Transform Propagation System ensures that anchor and stretch relationships between elements are maintained during animations that change an element's visual size or position. Without this system, animations like scaling would break the visual alignment of dependent elements.

## Problem Statement

When an element undergoes a transformation (such as scaling), several issues arise:

1. **Anchor Point Displacement**: The element's anchor points move to new positions
2. **Dependent Element Misalignment**: Elements anchored to the transformed element no longer align correctly
3. **Chain Reaction**: Elements anchored to the dependent elements are also affected

### Example Scenario

Consider this configuration from example 8:

```yaml
- id: scale_target
  type: rectangle
  layout:
    anchor:
      to: scale_trigger_button
      element_point: topLeft
      target_point: topRight
  animations:
    on_state_change:
      - from_state: normal
        to_state: scaled
        type: scale
        scale_params:
          scale_end: 1.2
          transform_origin: center center

- id: scale_target_description  
  type: text
  layout:
    anchor:
      to: scale_target
      element_point: centerLeft
      target_point: centerRight
```

When `scale_target` scales from 1.0 to 1.2:

1. The element grows 20% in all directions from its center
2. The `centerRight` anchor point moves outward by approximately 10px (assuming 100px width)
3. `scale_target_description` should follow this movement to maintain its relative position

## Solution Architecture

### Core Components

#### 1. TransformPropagator (`transform-propagator.ts`)

**Purpose**: Manages the propagation of transforms to maintain anchor relationships

**Key Methods**:
- `processAnimationWithPropagation()`: Main entry point for processing animations
- `_analyzeTransformEffects()`: Calculates visual effects of transformations
- `_findDependentElements()`: Identifies elements that depend on a transformed element
- `_calculateCompensatingTransform()`: Computes required compensating transforms

#### 2. Dependency Graph Building

The system automatically builds a dependency graph from layout configurations:

```typescript
// Anchor dependency example
{
  dependentElementId: 'scale_target_description',
  targetElementId: 'scale_target', 
  anchorPoint: 'centerLeft',
  targetAnchorPoint: 'centerRight',
  dependencyType: 'anchor'
}
```

#### 3. Transform Analysis

For each animation, the system analyzes what visual changes will occur:

```typescript
// Scale effect analysis
{
  type: 'scale',
  scaleX: 1.2,
  scaleY: 1.2, 
  transformOrigin: { x: 50, y: 20 } // center of element
}
```

#### 4. Displacement Calculation

The system calculates how much each anchor point moves:

For scaling with center origin:
1. Calculate transform origin in absolute coordinates
2. Find distance from origin to anchor point
3. Apply scale factor to that distance
4. Calculate final displacement

### Integration Points

#### State Manager Integration

The State Manager (`state-manager.ts`) has been enhanced to:
- Initialize the transform propagator when animation context is set
- Check if animations affect positioning before execution
- Call transform propagation for qualifying animations

#### Button Integration

The Button class (`button.ts`) has been enhanced to:
- Use transform propagation for button-triggered animations
- Maintain synchronization with dependent elements

#### Main Card Integration

The main LcarsCard component (`lovelace-lcars-card.ts`) has been enhanced to:
- Initialize the transform propagator with current layout state
- Provide shadow DOM element access for transform application

## Animation Synchronization

All compensating transforms use the same animation properties as the primary animation:

```typescript
interface AnimationSyncData {
  duration: number;
  ease: string;
  delay?: number;
  repeat?: number;
  yoyo?: boolean;
}
```

This ensures that:
- Primary and compensating animations start simultaneously
- They have the same duration and easing
- Visual relationships remain consistent throughout the animation

## Supported Transform Types

### Scale Animations
- **Detection**: Any animation with `type: 'scale'`
- **Effect**: Changes element size, displacing anchor points
- **Compensation**: Calculates anchor displacement and applies compensating translation

### Slide Animations  
- **Detection**: Slide animations with non-zero distance
- **Effect**: Permanently moves element position
- **Compensation**: Applies equivalent translation to dependent elements

### Custom GSAP Animations
- **Detection**: Custom animations with `scale`, `x`, `y`, or `rotation` properties
- **Effect**: Various transform combinations
- **Compensation**: Analyzes each transform component individually

## Usage Examples

### Basic Scale Animation

```yaml
animations:
  on_state_change:
    - from_state: normal
      to_state: scaled
      type: scale
      scale_params:
        scale_end: 1.2
        transform_origin: center center
      duration: 0.3
      ease: bounce.out
```

The system automatically:
1. Detects this is a scale animation
2. Builds dependency graph to find dependent elements
3. Calculates anchor point displacements
4. Applies compensating transforms with same timing

### Multi-Element Chain

```yaml
# Element A anchored to container
- id: element_a
  layout:
    anchor:
      to: container
      element_point: center
      target_point: center

# Element B anchored to Element A  
- id: element_b
  layout:
    anchor:
      to: element_a
      element_point: centerLeft
      target_point: centerRight

# Element C anchored to Element B
- id: element_c
  layout:
    anchor:
      to: element_b
      element_point: centerLeft 
      target_point: centerRight
```

When Element A scales, the system:
1. Calculates displacement for Element A's anchor points
2. Applies compensating transform to Element B
3. Calculates how Element B's movement affects Element C
4. Applies compensating transform to Element C
5. Continues the chain as needed

## Performance Considerations

### Optimization Strategies

1. **Significance Threshold**: Transforms below 0.001 units are ignored
2. **Dependency Caching**: Dependency graph is built once and cached
3. **Effect Filtering**: Only positioning-affecting animations trigger propagation
4. **Lazy DOM Access**: Shadow DOM elements are accessed only when needed

### Computational Complexity

- **Dependency Graph**: O(n) where n = number of elements
- **Propagation**: O(d) where d = number of dependent elements
- **Chain Length**: Typically 1-3 levels deep in LCARS designs

## Testing Strategy

The system includes comprehensive tests covering:

- **Scale Displacement Calculation**: Verifies mathematical accuracy
- **Dependency Detection**: Ensures correct graph building
- **Transform Origin Parsing**: Tests various origin formats
- **Animation Detection**: Validates significance thresholds
- **Integration Scenarios**: Tests real-world animation chains

## Debugging and Monitoring

### Console Logging

The system provides detailed logging for debugging:

```
[TransformPropagator] Not initialized, cannot process animation
[TransformPropagator] GSAP import failed for compensating transform
```

### Animation State Inspection

Use browser DevTools to inspect:
- Element transform properties during animation
- GSAP timeline properties
- Computed style values

### Testing in Development

Use the example 8 configuration to test:
1. Click the "SCALE" button
2. Observe that the description text moves with the scaled element
3. Verify smooth synchronized animation
4. Check that relationships are maintained after animation completes

## Future Enhancements

### Planned Features

1. **Rotation Support**: Full rotation compensation for dependent elements
2. **Complex Transform Chains**: Support for multiple simultaneous transforms
3. **Performance Monitoring**: Built-in timing and performance metrics
4. **Visual Debug Mode**: Overlay showing dependency relationships

### Extensibility

The system is designed for easy extension:
- New transform types can be added to `_analyzeTransformEffects()`
- Additional dependency types beyond anchor/stretch
- Custom displacement calculation algorithms
- Integration with other animation libraries

## Conclusion

The Transform Propagation System ensures that LCARS card layouts maintain their visual integrity during animations. By automatically calculating and applying compensating transforms, complex animation sequences can be achieved while preserving the precise geometric relationships that define the LCARS aesthetic.