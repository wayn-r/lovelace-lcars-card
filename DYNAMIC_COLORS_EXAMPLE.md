# Dynamic Colors Example

This example shows how to configure dynamic colors for LCARS card elements based on entity states.

## Basic Dynamic Color Configuration

Here's an example of a rectangle that changes color based on a light entity's state:

```yaml
type: lovelace-lcars-card
elements:
  - id: living_room_light_indicator
    type: rectangle
    props:
      fill:
        entity: light.living_room
        mapping:
          "on": "#ffaa00"      # Orange when on
          "off": "#333333"     # Dark gray when off
          "unavailable": "#ff0000"  # Red when unavailable
        default: "#666666"     # Gray fallback
    layout:
      width: 100
      height: 50
      offsetX: 10
      offsetY: 10
    button:
      enabled: true
      text: "Living Room"
      action_config:
        type: toggle
        entity: light.living_room
```

## Advanced: Using Attributes and Interpolation

For numeric attributes like brightness or temperature:

```yaml
type: lovelace-lcars-card
elements:
  - id: temperature_indicator
    type: rectangle
    props:
      fill:
        entity: sensor.living_room_temperature
        attribute: state
        interpolate: true
        mapping:
          16: "#0066cc"  # Blue for cold
          20: "#00cc66"  # Green for comfortable  
          24: "#cc6600"  # Orange for warm
          28: "#cc0000"  # Red for hot
        default: "#666666"
    layout:
      width: 200
      height: 30
      offsetX: 10
      offsetY: 70

  - id: brightness_indicator
    type: rectangle
    props:
      fill:
        entity: light.bedroom
        attribute: brightness
        interpolate: true
        mapping:
          0: "#111111"    # Very dim
          64: "#444444"   # Quarter brightness
          128: "#888888"  # Half brightness
          192: "#cccccc"  # Three quarter
          255: "#ffffff"  # Full brightness
        default: "#333333"
    layout:
      width: 150
      height: 20
      offsetX: 10
      offsetY: 110
```

## Configuration Options

### Dynamic Color Properties

- **entity** (required): The Home Assistant entity ID to monitor
- **attribute** (optional): Entity attribute to use (defaults to 'state')
- **mapping** (required): Object mapping entity values to colors
- **default** (optional): Fallback color when no mapping matches
- **interpolate** (optional): Enable interpolation for numeric values

### Color Formats

Colors can be specified in several formats:
- Hex strings: `"#ff0000"`
- RGB arrays: `[255, 0, 0]`
- CSS color names: `"red"`

### Visual Editor Support

The visual editor provides a user-friendly interface for configuring dynamic colors:

1. **Color Mode Toggle**: Switch between "Static Color" and "Dynamic Color"
2. **Entity Picker**: Select any Home Assistant entity
3. **Attribute Field**: Specify which attribute to monitor
4. **Mapping Table**: Add/remove state-to-color mappings
5. **Default Color**: Set fallback color
6. **Interpolation**: Enable for smooth color transitions with numeric values

## How It Works

1. **Entity Monitoring**: The card monitors specified entities for state changes
2. **Color Resolution**: When an entity state changes, the card looks up the corresponding color
3. **Smooth Transitions**: Color changes use a 0.3s fade transition
4. **Fallback Handling**: If entity is unavailable or state doesn't match, uses default color
5. **Performance**: Only re-renders elements when their monitored entities actually change

## Tips

- Use interpolation for smooth color gradients with numeric sensors
- Consider using entity attributes like `brightness`, `temperature`, or `humidity`
- Set meaningful default colors for when entities are unavailable
- The color picker in the editor shows live previews of your configurations 