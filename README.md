# PIXILAB Blocks Driver for Allen & Heath SQ Series

This driver provides control and feedback for Allen & Heath SQ series mixing consoles (SQ5, SQ6, SQ7) through PIXILAB Blocks.

## Features

- **Scene Recall**: Load any of the 500 available scenes on the SQ console
- **Channel Level Control**: Set fader levels for all 48 input channels (-85dB to +10dB)
- **Channel Mute Control**: Mute/unmute channels and toggle mute state
- **Fade Control**: Smooth fades between levels with configurable fade time
- **Real-time Feedback**: Driver updates when the console is manipulated by a sound engineer
- **Bidirectional Communication**: Full two-way MIDI communication over TCP/IP

## Connection Setup

### SQ Console Configuration

1. **Network Connection**: Ensure your SQ console is connected to the same network as your PIXILAB Blocks server
2. **Find IP Address**: On the SQ, go to `Setup > Network` to find the console's IP address
3. **MIDI Settings**:
   - Go to `Setup > MIDI/Control`
   - Enable MIDI over TCP/IP
   - Note the MIDI channel (default is typically Channel 1)
   - Set **NRPN Fader Law** to **"Linear Taper"** for high-resolution level control

### PIXILAB Blocks Configuration

1. **Add Network Device**:
   - In Blocks, add a new Network TCP device
   - Enter the SQ console's IP address
   - Port: **51325** (standard MIDI over TCP port)

2. **Assign Driver**:
   - Select the `AllenHeath_SQ` driver
   - The driver will automatically connect

3. **Configure MIDI Channel**:
   - Set the `midiCh` property to match your console's MIDI channel (1-16)
   - This must match the MIDI channel configured on the SQ console

## Usage

### Properties

#### `scene` (number, 1-500)
Get or set the current scene number.

**Example:**
```typescript
// Recall scene 5
device.scene = 5;

// Get current scene
const currentScene = device.scene;
```

#### `midiCh` (number, 1-16)
Get or set the MIDI channel. Must match the console configuration.

**Example:**
```typescript
// Set MIDI channel to 1
device.midiCh = 1;
```

### Callable Functions

#### `recallScene(sceneNumber: number)`
Recall a specific scene on the console.

**Parameters:**
- `sceneNumber`: Scene number (1-500)

**Example:**
```typescript
// Recall scene 42
device.recallScene(42);
```

#### `setChannelLevel(channel: number, levelDB: number)`
Set the fader level for a specific channel.

**Parameters:**
- `channel`: Channel number (1-48)
- `levelDB`: Level in decibels (-85 to +10)

**Example:**
```typescript
// Set channel 1 to -10dB
device.setChannelLevel(1, -10);

// Set channel 12 to unity (0dB)
device.setChannelLevel(12, 0);
```

#### `getChannelLevel(channel: number): number`
Get the current fader level for a channel.

**Parameters:**
- `channel`: Channel number (1-48)

**Returns:** Level in decibels (-85 to +10)

**Example:**
```typescript
const level = device.getChannelLevel(1);
console.log(`Channel 1 level: ${level}dB`);
```

#### `setChannelMute(channel: number, mute: boolean)`
Mute or unmute a channel.

**Parameters:**
- `channel`: Channel number (1-48)
- `mute`: `true` to mute, `false` to unmute

**Example:**
```typescript
// Mute channel 5
device.setChannelMute(5, true);

// Unmute channel 5
device.setChannelMute(5, false);
```

#### `getChannelMute(channel: number): boolean`
Get the current mute state for a channel.

**Parameters:**
- `channel`: Channel number (1-48)

**Returns:** `true` if muted, `false` if unmuted

**Example:**
```typescript
const isMuted = device.getChannelMute(5);
```

#### `toggleChannelMute(channel: number)`
Toggle the mute state of a channel.

**Parameters:**
- `channel`: Channel number (1-48)

**Example:**
```typescript
// Toggle mute on channel 8
device.toggleChannelMute(8);
```

#### `fadeChannel(channel: number, targetDB: number, fadeSeconds: number)`
Fade a channel to a target level over a specified time.

**Parameters:**
- `channel`: Channel number (1-48)
- `targetDB`: Target level in decibels (-85 to +10)
- `fadeSeconds`: Fade duration in seconds

**Example:**
```typescript
// Fade channel 1 to -20dB over 3 seconds
device.fadeChannel(1, -20, 3);

// Fade channel 2 to silence over 5 seconds
device.fadeChannel(2, -85, 5);
```

## Example Use Cases

### Theater Show Control

```typescript
// Scene for pre-show music
device.recallScene(1);

// Fade music down before show starts
device.fadeChannel(1, -40, 5);

// Load scene for Act 1
device.recallScene(2);

// Quick mute of wireless mic during set change
device.setChannelMute(10, true);

// Load scene for Act 2 and unmute mic
device.recallScene(3);
device.setChannelMute(10, false);
```

### Conference Room Automation

```typescript
// Load "Presentation" scene
device.recallScene(10);

// Adjust presenter mic level
device.setChannelLevel(1, -5);

// Mute audience mics during presentation
for (let i = 5; i <= 8; i++) {
    device.setChannelMute(i, true);
}

// Load "Discussion" scene
device.recallScene(11);

// Unmute audience mics
for (let i = 5; i <= 8; i++) {
    device.setChannelMute(i, false);
}
```

### Music Venue Soundcheck

```typescript
// Load soundcheck scene
device.recallScene(100);

// Solo drum channels by muting everything else
for (let i = 1; i <= 48; i++) {
    if (i >= 1 && i <= 8) {
        device.setChannelMute(i, false); // Drums
    } else {
        device.setChannelMute(i, true);  // Everything else
    }
}

// Adjust kick drum level
device.setChannelLevel(1, -8);

// Load show scene when ready
device.recallScene(1);
```

## Feedback and Status Updates

The driver automatically receives and processes feedback from the SQ console:

- When a sound engineer changes a fader on the console, the driver updates its internal state
- When a scene is recalled on the console, the driver is notified
- When channels are muted/unmuted on the console, the driver tracks the changes

This bidirectional communication ensures that PIXILAB Blocks always has the current state of the console.

## Technical Details

### MIDI Protocol

The driver uses MIDI over TCP/IP (port 51325) with the following message types:

- **Scene Recall**: Bank Select (CC 0, CC 32) + Program Change
- **Fader Levels**: NRPN (Non-Registered Parameter Numbers) for high-resolution 14-bit control
- **Mutes**: NRPN messages

### Channel Mapping

- **Input Channels**: 1-48
- **NRPN MSB**: 0 for fader levels, 1 for mutes
- **NRPN LSB**: Channel number - 1 (0-indexed)

### Level Range

- **dB Range**: -85dB to +10dB
- **NRPN Value Range**: 0 to 16383 (14-bit)
- **Conversion**: Linear scale mapping

## Troubleshooting

### Connection Issues

1. **Verify Network**: Ensure the SQ console and Blocks server are on the same network
2. **Check IP Address**: Verify the correct IP address is configured in Blocks
3. **Firewall**: Ensure port 51325 is not blocked by firewalls
4. **Console Settings**: Verify MIDI over TCP/IP is enabled on the SQ

### Control Not Working

1. **MIDI Channel**: Ensure the `midiCh` property matches the console's MIDI channel setting
2. **NRPN Fader Law**: Set to "Linear Taper" on the console for best results
3. **Scene Exists**: Scenes must be saved on the console before they can be recalled
4. **Channel Range**: Ensure channel numbers are within 1-48

### No Feedback

1. **MIDI Channel**: Verify MIDI channel matches on both sides
2. **Console Firmware**: Ensure console is running firmware V1.5.0 or later for full MIDI support
3. **Connection**: Check that the TCP connection is established

## Compatibility

- **Consoles**: SQ5, SQ6, SQ7
- **Firmware**: V1.5.0 or later recommended
- **PIXILAB Blocks**: All versions with NetworkTCP driver support

## References

- [Allen & Heath SQ MIDI Protocol Documentation](https://www.allen-heath.com/content/uploads/2023/11/SQ-MIDI-Protocol-Issue5.pdf)
- [SQ Reference Guide](https://www.allen-heath.com/content/uploads/2023/05/SQ_ReferenceGuide_V1_5_0.pdf)
- [PIXILAB Blocks Documentation](https://pixilab.se/docs/blocks/)

## License

Copyright (c) 2024 PIXILAB Technologies AB, Sweden (http://pixilab.se). All Rights Reserved.

## Support

For issues or questions about this driver, please file an issue on the GitHub repository.

For Allen & Heath SQ console support, visit the [Allen & Heath Support Portal](https://support.allen-heath.com/).
