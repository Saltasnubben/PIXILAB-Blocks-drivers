# PIXILAB Blocks Drivers

Custom device drivers for [PIXILAB Blocks](https://pixilab.se/blocks).

## Home Assistant Integration

The `HomeAssistant.ts` driver enables control of Home Assistant entities from PIXILAB Blocks via the Home Assistant REST API.

### Setup

1. **Copy the driver** to your PIXILAB Blocks script folder:
   ```
   PIXILAB-Blocks/script/driver/HomeAssistant.ts
   ```

2. **Create a Long-Lived Access Token** in Home Assistant:
   - Go to your Home Assistant profile
   - Scroll to "Long-Lived Access Tokens"
   - Click "Create Token"
   - Copy the generated token

3. **Add the driver in PIXILAB Blocks**:
   - Go to Manage > Devices
   - Add a new device using the "Home Assistant" driver
   - Enter your Home Assistant IP address
   - Set port to 8123 (default)
   - Enter your access token in the "accessToken" property

### Properties

| Property | Description |
|----------|-------------|
| `connected` | Connection status (read-only) |
| `accessToken` | Home Assistant long-lived access token |
| `entity1Id` - `entity4Id` | Entity IDs to monitor (e.g., `light.living_room`) |
| `entity1State` - `entity4State` | Current state of monitored entities (read-only) |
| `entity1Brightness` - `entity4Brightness` | Brightness values for light entities (read-only) |

### Callable Methods

#### Basic Controls
- `turnOn(entityId)` - Turn on an entity
- `turnOff(entityId)` - Turn off an entity
- `toggle(entityId)` - Toggle an entity

#### Lights
- `setBrightness(entityId, brightness)` - Set brightness (0-255)
- `setColor(entityId, red, green, blue)` - Set RGB color
- `setColorTemp(entityId, kelvin)` - Set color temperature (2700-6500K)

#### Climate
- `setTemperature(entityId, temperature)` - Set thermostat temperature
- `setHvacMode(entityId, mode)` - Set HVAC mode (heat/cool/auto/off)

#### Covers/Blinds
- `setCoverPosition(entityId, position)` - Set position (0-100)
- `openCover(entityId)` - Open cover
- `closeCover(entityId)` - Close cover

#### Media Players
- `setVolume(entityId, volume)` - Set volume (0.0-1.0)
- `mediaPlayPause(entityId)` - Play/pause

#### Locks
- `lock(entityId)` - Lock
- `unlock(entityId)` - Unlock

#### Fans
- `setFanSpeed(entityId, percentage)` - Set fan speed (0-100)

#### Automations & Scripts
- `triggerScript(scriptId)` - Trigger a script
- `triggerAutomation(automationId)` - Trigger an automation

#### Notifications
- `sendNotification(message, title)` - Send a notification

#### Generic
- `callServiceGeneric(domain, service, dataJson)` - Call any HA service with JSON data
- `refreshEntity(entityId)` - Refresh a single entity state
- `refreshAll()` - Refresh all monitored entities

### Example Usage in Blocks

**Turn on a light from a task:**
```javascript
HomeAssistant.turnOn("light.living_room");
```

**Set light brightness:**
```javascript
HomeAssistant.setBrightness("light.living_room", 128);
```

**Set thermostat temperature:**
```javascript
HomeAssistant.setTemperature("climate.thermostat", 22);
```

**Call a custom service:**
```javascript
HomeAssistant.callServiceGeneric("input_boolean", "turn_on", '{"entity_id": "input_boolean.my_toggle"}');
```

### Supported Entity Domains

- `light` - Lights and dimmable devices
- `switch` - Switches and outlets
- `climate` - Thermostats and HVAC
- `cover` - Blinds, shades, and garage doors
- `media_player` - Media players
- `fan` - Fans
- `lock` - Locks
- `script` - Scripts
- `automation` - Automations
- `input_boolean` - Input booleans
- `scene` - Scenes (use `turnOn`)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
