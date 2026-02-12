# Samsung Smart TV Driver for PIXILAB Blocks

WebSocket-based driver for controlling Samsung Smart TVs (2016 and newer) running Tizen OS.

## Compatibility

- **Samsung Smart TVs from 2016 onwards** (Tizen-based)
- Tested on: TU98DU9005KXXC (2024 98" model)
- **Not compatible** with pre-2016 Samsung TVs (which use the legacy TCP protocol on port 55000)

## Features

- Power on/off with state detection (prevents toggling when already in desired state)
- Volume control (up/down/mute)
- Input/source selection (HDMI 1-4)
- Navigation controls (up/down/left/right/enter/back)
- Media controls (play/pause/stop)
- Real-time screen state monitoring (`screenOn` property)
- Token-based authentication
- Auto-reconnect with keepalive ping

## Installation

1. Copy `SamsungTV.js` to your Blocks server's `script/driver/` directory
2. Restart the Blocks server or reload drivers
3. Add a new Network device with the TV's IP address

## Configuration

### Network Device Settings

- **Driver**: SamsungTV
- **IP Address**: Your TV's IP address
- **Port**: 8001 (or 8002 for SSL)

### Driver Options (JSON)

```json
{
  "token": "12345678",
  "name": "Blocks Remote",
  "useSSL": true
}
```

| Option | Type | Description |
|--------|------|-------------|
| `token` | string | Authentication token (obtained during pairing) |
| `name` | string | Remote control name shown on TV (default: "PIXILAB Blocks") |
| `useSSL` | boolean | Use secure WebSocket on port 8002 (recommended for 2024+ models) |

## First-Time Pairing

1. Configure the driver **without** a token
2. Start the driver - the TV should display a pairing prompt
3. Accept the pairing on the TV
4. Check the Blocks server log for: `New token received: XXXXXXXX`
5. Add the token to your driver options
6. Restart the driver

**Note:** 2024 models may not show a pairing popup. If this happens:
- Go to TV Settings → General → External Device Manager → Device Connection Manager
- Set "Access Notification" to "Always On"
- Clear the device list and try again

## Properties

| Property | Type | Read-Only | Description |
|----------|------|-----------|-------------|
| `connected` | boolean | ✓ | WebSocket connection status |
| `power` | boolean | | Power state (set to control) |
| `screenOn` | boolean | ✓ | Actual screen state from TV API |
| `modelName` | string | ✓ | TV model name |
| `deviceName` | string | ✓ | TV device name |
| `volume` | number | | Volume level (0-100) |
| `muted` | boolean | | Mute state |
| `source` | string | ✓ | Current input source |

## Callable Methods

### Power Control

| Method | Description |
|--------|-------------|
| `powerOn()` | Turn on the TV (checks state first) |
| `powerOff()` | Turn off the TV (checks state first) |
| `powerToggle()` | Toggle power state |

### Volume Control

| Method | Description |
|--------|-------------|
| `volumeUp()` | Increase volume |
| `volumeDown()` | Decrease volume |
| `toggleMute()` | Toggle mute |

### Input Selection

| Method | Description |
|--------|-------------|
| `openSourceMenu()` | Open source selection menu |
| `selectHDMI(input)` | Select HDMI input (1-4) |
| `hdmi1()` - `hdmi4()` | Direct HDMI selection |

### Navigation

| Method | Description |
|--------|-------------|
| `up()`, `down()`, `left()`, `right()` | Navigate |
| `enter()` | Select/confirm |
| `back()` | Go back |
| `exit()` | Exit current screen |
| `home()` | Go to home screen |
| `menu()` | Open menu |

### Media Control

| Method | Description |
|--------|-------------|
| `play()` | Play |
| `pause()` | Pause |
| `stop()` | Stop |

### Utility

| Method | Description |
|--------|-------------|
| `sendCommand(key)` | Send any key command (e.g., "KEY_INFO") |
| `reconnect()` | Force reconnection |
| `checkStatus()` | Check TV availability |

## TV Settings Requirements

For reliable operation, ensure these TV settings are configured:

1. **Network** → **Expert Settings** → **IP Remote** → **ON**
2. **General** → **External Device Manager** → **Device Connection Manager** → **Access Notification** → **Always On**

## Protocol Details

- **WebSocket URL**: `ws://IP:8001/api/v2/channels/samsung.remote.control?name=BASE64_NAME&token=TOKEN`
- **SSL URL**: `wss://IP:8002/api/v2/channels/samsung.remote.control?name=BASE64_NAME&token=TOKEN`
- **Info API**: `http://IP:8001/api/v2/` (returns device info and PowerState)

### Key Codes

Common key codes used by the driver:

```
KEY_POWER, KEY_VOLUP, KEY_VOLDOWN, KEY_MUTE
KEY_HDMI1, KEY_HDMI2, KEY_HDMI3, KEY_HDMI4, KEY_SOURCE
KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_ENTER, KEY_RETURN
KEY_HOME, KEY_MENU, KEY_EXIT, KEY_INFO
KEY_PLAY, KEY_PAUSE, KEY_STOP
```

## Troubleshooting

### "ms.channel.unauthorized" error
- Token is missing or invalid
- TV pairing was rejected or expired
- Try clearing the device list on the TV and re-pairing

### Connection drops frequently
- The driver includes auto-reconnect and keepalive ping (every 30 seconds)
- Check network stability between Blocks server and TV

### screenOn always shows true/false
- PowerState is fetched from TV's REST API
- Some TV firmware may report state differently
- State is verified 3 seconds after power commands

## Version History

- **v2.8** - Smart power control with state checking, screenOn property with immediate updates
- **v2.2** - Removed TCP socket dependency, WebSocket-only connection management
- **v2.0** - Initial WebSocket implementation for Tizen TVs

## License

MIT License - See LICENSE file for details.

## Author

Developed for PIXILAB Blocks by SaltBot 🧂
