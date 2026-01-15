# PIXILAB Blocks Drivers

Custom drivers and scripts for PIXILAB Blocks.

## Home Assistant

Drivers for integrating PIXILAB Blocks with Home Assistant.

### SendRestCall

A flexible script for sending REST API calls to Home Assistant from PIXILAB Blocks tasks. Supports both GET and POST requests with optional authentication, query parameters, and custom headers.

#### Features
- GET and POST request methods
- Optional authorization headers (Basic, Bearer, etc.)
- JSON query parameters support
- Custom headers support

#### Setup

1. In Home Assistant, create a Long-Lived Access Token:
   - Go to your Profile → Security → Long-Lived Access Tokens
   - Create a new token and copy it

2. Use the `sendPost` callable to control Home Assistant entities

#### Example: Toggle a Light

```
Host: http://your-homeassistant-ip:8123
Path: /api/services/light/toggle
Auth: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN
Body: {"entity_id": "light.living_room"}
Headers: {"Content-Type": "application/json"}
```

#### Example: Call a Script

```
Host: http://your-homeassistant-ip:8123
Path: /api/services/script/turn_on
Auth: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN
Body: {"entity_id": "script.my_script"}
Headers: {"Content-Type": "application/json"}
```

## License

See [LICENSE](LICENSE) for details.
