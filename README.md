# PIXILAB Blocks Driver for Allen & Heath SQ Series

This driver provides comprehensive control and feedback for Allen & Heath SQ series mixing consoles (SQ5, SQ6, SQ7) through PIXILAB Blocks.

## Features

- **Scene Recall**: Load any of the 500 available scenes
- **Channel Control**: Level and mute for all 48 input channels (-85dB to +10dB)
- **DCA Control**: Level and mute for all 8 DCAs
- **Mix/AUX Control**: Level and mute for all 12 mix outputs
- **Main LR Control**: Level and mute for main output
- **Layer/Fader Mapping**: Control channels by physical fader position per layer
- **Channel Colors**: Visual feedback with configurable channel colors
- **Real-time Feedback**: Bidirectional communication with console
- **Polling**: Automatic state updates from the console

## Connection Setup

### SQ Console Configuration

1. **Network Connection**: Connect your SQ console to the same network as PIXILAB Blocks
2. **Find IP Address**: On the SQ, go to `Setup > Network`
3. **MIDI Settings** (`Setup > MIDI/Control`):
   - Enable MIDI over TCP/IP
   - Note the MIDI channel (default: Channel 1)
   - Set **NRPN Fader Law** to **"Linear Taper"**

### PIXILAB Blocks Configuration

1. Add a Network TCP device with the SQ's IP address
2. Port: **51325**
3. Assign the `AllenHeath_SQ` driver
4. Set `midiCh` to match your console's MIDI channel

---

## Properties

### Basic Settings

| Property | Range | Description |
|----------|-------|-------------|
| `scene` | 1-500 | Current scene number (read/write) |
| `midiCh` | 1-16 | MIDI channel (must match console) |

### Layer/Fader Control (Bindable)

These properties allow you to control channels by physical fader position. Perfect for binding to UI sliders in Blocks.

| Property | Range | Description |
|----------|-------|-------------|
| `activeLayer` | 1-6 | Select which layer to control |
| `activeFader` | 1-24 | Select which fader position |
| `layerFaderLevel` | -85 to +10 | **Bind to slider** — fader level in dB |
| `layerFaderMute` | true/false | **Bind to button** — mute state |
| `layerFaderColor` | string | Color for active position (read-only) |
| `layerFaderChannel` | number | Channel number for active position (read-only) |

**Usage Example:**
```
1. Set activeLayer = 2
2. Set activeFader = 5
3. Bind layerFaderLevel to a fader control
→ Now controls channel 21 (if using default mapping)
```

### Configuration (JSON)

| Property | Description |
|----------|-------------|
| `layerConfig` | Layer-to-channel mapping |
| `colorConfig` | Channel color assignments |

**Layer Config Example:**
```json
{
  "1": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
  "2": [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],
  "3": [33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48]
}
```

**Color Config Example:**
```json
{
  "1": "blue",
  "2": "red", 
  "3": "green",
  "10": "yellow"
}
```

Available colors: `off`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`

### Channel Properties (1-48)

Each channel has individual properties:

| Property | Range | Description |
|----------|-------|-------------|
| `ch1Level` ... `ch48Level` | -85 to +10 | Channel fader level in dB |
| `ch1Mute` ... `ch48Mute` | true/false | Channel mute state |

### DCA Properties (1-8)

| Property | Range | Description |
|----------|-------|-------------|
| `dca1Level` ... `dca8Level` | -85 to +10 | DCA fader level in dB |
| `dca1Mute` ... `dca8Mute` | true/false | DCA mute state |

### Mix Output Properties (1-12)

| Property | Range | Description |
|----------|-------|-------------|
| `mix1Level` ... `mix12Level` | -85 to +10 | Mix output level in dB |
| `mix1Mute` ... `mix12Mute` | true/false | Mix output mute state |

### Main LR Output

| Property | Range | Description |
|----------|-------|-------------|
| `lrOutputLevel` | -85 to +10 | Main LR level in dB |
| `lrOutputMute` | true/false | Main LR mute state |

---

## Callable Functions

### Scene Control

```typescript
recallScene(sceneNumber: number)  // Recall scene 1-500
```

### Channel Control

```typescript
setChannelLevel(channel: number, levelDB: number)
getChannelLevel(channel: number): number
setChannelMute(channel: number, mute: boolean)
getChannelMute(channel: number): boolean
toggleChannelMute(channel: number)
```

### DCA Control

```typescript
setDCALevel(dca: number, levelDB: number)
getDCALevel(dca: number): number
setDCAMute(dca: number, mute: boolean)
getDCAMute(dca: number): boolean
toggleDCAMute(dca: number)
```

### Mix Output Control

```typescript
setMixLevel(mix: number, levelDB: number)
setMixMute(mix: number, mute: boolean)
```

### Main LR Control

```typescript
setLRLevel(levelDB: number)
setLRMute(mute: boolean)
```

### Layer/Fader Functions

```typescript
// Get channel number for a layer/fader position
getChannelForLayerFader(layer: number, fader: number): number

// Control by layer/fader position
setLayerFaderLevel(layer: number, fader: number, levelDB: number)
getLayerFaderLevel(layer: number, fader: number): number
setLayerFaderMute(layer: number, fader: number, mute: boolean)
getLayerFaderMute(layer: number, fader: number): boolean
toggleLayerFaderMute(layer: number, fader: number)

// Get info
getLayerFaderCount(layer: number): number
getChannelColor(channel: number): string
getLayerFaderColor(layer: number, fader: number): string
```

---

## Example Use Cases

### Theater Show Control

```typescript
// Pre-show: Load house music scene
device.recallScene(1);

// Show start: Fade music, load Act 1
device.setChannelLevel(1, -85);
device.recallScene(2);

// Quick mute of wireless during set change
device.setChannelMute(10, true);

// Act 2
device.recallScene(3);
device.setChannelMute(10, false);
```

### Layer-Based Control Panel

```typescript
// Build a control panel that mirrors the physical console
// User selects layer with buttons, faders control that layer

// When user presses "Layer 2" button:
device.activeLayer = 2;

// Each UI fader sets activeFader and binds to layerFaderLevel
// Fader 1 in UI:
device.activeFader = 1;
// Bind slider to device.layerFaderLevel

// Mute button for each fader:
// Bind toggle to device.layerFaderMute
```

### Conference Room with DCAs

```typescript
// Use DCAs for group control
device.setDCALevel(1, 0);   // Presenter mics at unity
device.setDCALevel(2, -10); // Audience mics lower
device.setDCAMute(3, true); // Mute playback DCA

// Quick "all mute" for break
device.setLRMute(true);
```

---

## Default Layer Mapping

Out of the box, the driver uses standard SQ layer mapping:

| Layer | Channels |
|-------|----------|
| 1 | 1-16 |
| 2 | 17-32 |
| 3 | 33-48 |
| 4-6 | Empty (configure as needed) |

Customize via the `layerConfig` property to match your console's strip assignments.

---

## Technical Details

### Protocol
- MIDI over TCP/IP on port 51325
- NRPN messages for high-resolution 14-bit fader control
- Bank Select + Program Change for scene recall

### Polling
The driver polls the console every 2 seconds to sync state when channels are adjusted directly on the console.

### Level Conversion
- Range: -85dB to +10dB (95dB range)
- NRPN: 0-16383 (14-bit)
- Linear taper mapping

---

## Troubleshooting

### No Connection
- Verify IP address and network connectivity
- Check port 51325 is not blocked
- Ensure MIDI over TCP/IP is enabled on console

### Control Not Working
- Verify `midiCh` matches console MIDI channel
- Set NRPN Fader Law to "Linear Taper"
- Check channel numbers are 1-48

### Layer Control Issues
- Verify `layerConfig` JSON is valid
- Check that channels are mapped in the config
- Use `getChannelForLayerFader()` to debug mapping

---

## Compatibility

- **Consoles**: SQ5, SQ6, SQ7
- **Firmware**: V1.5.0 or later
- **PIXILAB Blocks**: All versions with NetworkTCP support

## References

- [SQ MIDI Protocol (PDF)](https://www.allen-heath.com/content/uploads/2023/11/SQ-MIDI-Protocol-Issue5.pdf)
- [SQ Reference Guide (PDF)](https://www.allen-heath.com/content/uploads/2023/05/SQ_ReferenceGuide_V1_5_0.pdf)

---

## License

Copyright (c) 2024 PIXILAB Technologies AB, Sweden (http://pixilab.se). All Rights Reserved.
