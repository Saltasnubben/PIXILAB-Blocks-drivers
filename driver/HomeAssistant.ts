/*
 * Home Assistant integration driver for PIXILAB Blocks
 *
 * Enables control of Home Assistant entities (lights, switches, climate, etc.)
 * via the Home Assistant REST API.
 *
 * Copyright (c) 2026 PIXILAB Technologies AB, Sweden (http://pixilab.se).
 * All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NetworkTCP } from "system/Network";
import { Driver } from "system_lib/Driver";
import { driver, property, callable } from "system_lib/Metadata";

/**
 * Home Assistant driver for PIXILAB Blocks
 *
 * Configuration:
 * - Host: Your Home Assistant IP address or hostname
 * - Port: 8123 (default Home Assistant port)
 * - accessToken: Long-lived access token from Home Assistant
 *   (Create via User Profile -> Long-Lived Access Tokens)
 */
@driver('NetworkTCP', { port: 8123 })
export class HomeAssistant extends Driver<NetworkTCP> {
	private socket: NetworkTCP;
	private mConnected: boolean = false;
	private mAccessToken: string = "";
	private mBaseUrl: string = "";

	// Polling
	private pollTimer: CancelablePromise<void> | undefined;
	private static readonly POLL_INTERVAL = 10000; // 10 seconds

	// Entity states cache
	private entityStates: Map<string, EntityState> = new Map();

	// Exposed entity properties (user-configurable)
	private mEntity1Id: string = "";
	private mEntity1State: string = "";
	private mEntity1Brightness: number = 0;

	private mEntity2Id: string = "";
	private mEntity2State: string = "";
	private mEntity2Brightness: number = 0;

	private mEntity3Id: string = "";
	private mEntity3State: string = "";
	private mEntity3Brightness: number = 0;

	private mEntity4Id: string = "";
	private mEntity4State: string = "";
	private mEntity4Brightness: number = 0;

	constructor(private _socket: NetworkTCP) {
		super(_socket);
		this.socket = _socket;
		this.mBaseUrl = `http://${_socket.address}:${_socket.port}`;

		_socket.subscribe('connect', (sender, message) => {
			this.connectStateChanged(message.type);
		});

		_socket.subscribe('textReceived', (sender, message) => {
			this.handleResponse(message.text);
		});

		// Auto-connect
		_socket.autoConnect();
	}

	/**
	 * Connection state property - shows if connected to Home Assistant
	 */
	@property("Connection state", true)
	get connected(): boolean {
		return this.mConnected;
	}

	/**
	 * Access token for Home Assistant authentication
	 * Create a long-lived access token in Home Assistant:
	 * User Profile -> Security -> Long-Lived Access Tokens -> Create Token
	 */
	@property("Home Assistant long-lived access token")
	get accessToken(): string {
		return this.mAccessToken;
	}
	set accessToken(value: string) {
		this.mAccessToken = value;
		if (value && this.mConnected) {
			this.startPolling();
		}
	}

	// ==================== Entity 1 ====================

	@property("Entity 1 ID (e.g., light.living_room)")
	get entity1Id(): string {
		return this.mEntity1Id;
	}
	set entity1Id(value: string) {
		this.mEntity1Id = value;
		if (value && this.mConnected) {
			this.fetchEntityState(value);
		}
	}

	@property("Entity 1 state (on/off)", true)
	get entity1State(): string {
		return this.mEntity1State;
	}

	@property("Entity 1 brightness (0-255)", true)
	get entity1Brightness(): number {
		return this.mEntity1Brightness;
	}

	// ==================== Entity 2 ====================

	@property("Entity 2 ID (e.g., switch.bedroom)")
	get entity2Id(): string {
		return this.mEntity2Id;
	}
	set entity2Id(value: string) {
		this.mEntity2Id = value;
		if (value && this.mConnected) {
			this.fetchEntityState(value);
		}
	}

	@property("Entity 2 state (on/off)", true)
	get entity2State(): string {
		return this.mEntity2State;
	}

	@property("Entity 2 brightness (0-255)", true)
	get entity2Brightness(): number {
		return this.mEntity2Brightness;
	}

	// ==================== Entity 3 ====================

	@property("Entity 3 ID (e.g., climate.thermostat)")
	get entity3Id(): string {
		return this.mEntity3Id;
	}
	set entity3Id(value: string) {
		this.mEntity3Id = value;
		if (value && this.mConnected) {
			this.fetchEntityState(value);
		}
	}

	@property("Entity 3 state", true)
	get entity3State(): string {
		return this.mEntity3State;
	}

	@property("Entity 3 brightness (0-255)", true)
	get entity3Brightness(): number {
		return this.mEntity3Brightness;
	}

	// ==================== Entity 4 ====================

	@property("Entity 4 ID")
	get entity4Id(): string {
		return this.mEntity4Id;
	}
	set entity4Id(value: string) {
		this.mEntity4Id = value;
		if (value && this.mConnected) {
			this.fetchEntityState(value);
		}
	}

	@property("Entity 4 state", true)
	get entity4State(): string {
		return this.mEntity4State;
	}

	@property("Entity 4 brightness (0-255)", true)
	get entity4Brightness(): number {
		return this.mEntity4Brightness;
	}

	// ==================== Callable Methods ====================

	/**
	 * Turn on an entity (light, switch, etc.)
	 */
	@callable("Turn on an entity")
	public turnOn(entityId: string): Promise<void> {
		const domain = this.getDomain(entityId);
		return this.callService(domain, 'turn_on', { entity_id: entityId });
	}

	/**
	 * Turn off an entity (light, switch, etc.)
	 */
	@callable("Turn off an entity")
	public turnOff(entityId: string): Promise<void> {
		const domain = this.getDomain(entityId);
		return this.callService(domain, 'turn_off', { entity_id: entityId });
	}

	/**
	 * Toggle an entity (light, switch, etc.)
	 */
	@callable("Toggle an entity")
	public toggle(entityId: string): Promise<void> {
		const domain = this.getDomain(entityId);
		return this.callService(domain, 'toggle', { entity_id: entityId });
	}

	/**
	 * Set light brightness (0-255)
	 */
	@callable("Set light brightness (0-255)")
	public setBrightness(entityId: string, brightness: number): Promise<void> {
		return this.callService('light', 'turn_on', {
			entity_id: entityId,
			brightness: Math.max(0, Math.min(255, brightness))
		});
	}

	/**
	 * Set light color using RGB values
	 */
	@callable("Set light color (RGB 0-255 each)")
	public setColor(entityId: string, red: number, green: number, blue: number): Promise<void> {
		return this.callService('light', 'turn_on', {
			entity_id: entityId,
			rgb_color: [
				Math.max(0, Math.min(255, red)),
				Math.max(0, Math.min(255, green)),
				Math.max(0, Math.min(255, blue))
			]
		});
	}

	/**
	 * Set light color temperature in Kelvin
	 */
	@callable("Set color temperature (Kelvin, e.g., 2700-6500)")
	public setColorTemp(entityId: string, kelvin: number): Promise<void> {
		return this.callService('light', 'turn_on', {
			entity_id: entityId,
			kelvin: Math.max(1000, Math.min(10000, kelvin))
		});
	}

	/**
	 * Set climate/thermostat temperature
	 */
	@callable("Set thermostat temperature")
	public setTemperature(entityId: string, temperature: number): Promise<void> {
		return this.callService('climate', 'set_temperature', {
			entity_id: entityId,
			temperature: temperature
		});
	}

	/**
	 * Set climate HVAC mode (heat, cool, auto, off, etc.)
	 */
	@callable("Set HVAC mode (heat, cool, auto, off)")
	public setHvacMode(entityId: string, mode: string): Promise<void> {
		return this.callService('climate', 'set_hvac_mode', {
			entity_id: entityId,
			hvac_mode: mode
		});
	}

	/**
	 * Set cover position (0-100)
	 */
	@callable("Set cover/blind position (0-100)")
	public setCoverPosition(entityId: string, position: number): Promise<void> {
		return this.callService('cover', 'set_cover_position', {
			entity_id: entityId,
			position: Math.max(0, Math.min(100, position))
		});
	}

	/**
	 * Open a cover/blind
	 */
	@callable("Open cover/blind")
	public openCover(entityId: string): Promise<void> {
		return this.callService('cover', 'open_cover', { entity_id: entityId });
	}

	/**
	 * Close a cover/blind
	 */
	@callable("Close cover/blind")
	public closeCover(entityId: string): Promise<void> {
		return this.callService('cover', 'close_cover', { entity_id: entityId });
	}

	/**
	 * Set media player volume (0-1)
	 */
	@callable("Set media player volume (0.0-1.0)")
	public setVolume(entityId: string, volume: number): Promise<void> {
		return this.callService('media_player', 'volume_set', {
			entity_id: entityId,
			volume_level: Math.max(0, Math.min(1, volume))
		});
	}

	/**
	 * Media player play/pause
	 */
	@callable("Play/pause media player")
	public mediaPlayPause(entityId: string): Promise<void> {
		return this.callService('media_player', 'media_play_pause', {
			entity_id: entityId
		});
	}

	/**
	 * Call any Home Assistant service
	 */
	@callable("Call any Home Assistant service")
	public callServiceGeneric(domain: string, service: string, dataJson: string): Promise<void> {
		let data = {};
		if (dataJson) {
			try {
				data = JSON.parse(dataJson);
			} catch (e) {
				console.error("Invalid JSON data:", dataJson);
				return Promise.reject("Invalid JSON data");
			}
		}
		return this.callService(domain, service, data);
	}

	/**
	 * Trigger a Home Assistant script
	 */
	@callable("Trigger a script")
	public triggerScript(scriptId: string): Promise<void> {
		return this.callService('script', scriptId.replace('script.', ''), {});
	}

	/**
	 * Trigger a Home Assistant automation
	 */
	@callable("Trigger an automation")
	public triggerAutomation(automationId: string): Promise<void> {
		return this.callService('automation', 'trigger', {
			entity_id: automationId
		});
	}

	/**
	 * Send a notification via Home Assistant
	 */
	@callable("Send notification")
	public sendNotification(message: string, title: string): Promise<void> {
		return this.callService('notify', 'notify', {
			message: message,
			title: title || 'PIXILAB Blocks'
		});
	}

	/**
	 * Lock a lock entity
	 */
	@callable("Lock a lock entity")
	public lock(entityId: string): Promise<void> {
		return this.callService('lock', 'lock', { entity_id: entityId });
	}

	/**
	 * Unlock a lock entity
	 */
	@callable("Unlock a lock entity")
	public unlock(entityId: string): Promise<void> {
		return this.callService('lock', 'unlock', { entity_id: entityId });
	}

	/**
	 * Set fan speed percentage
	 */
	@callable("Set fan speed (0-100)")
	public setFanSpeed(entityId: string, percentage: number): Promise<void> {
		return this.callService('fan', 'set_percentage', {
			entity_id: entityId,
			percentage: Math.max(0, Math.min(100, percentage))
		});
	}

	/**
	 * Refresh entity state
	 */
	@callable("Refresh state for an entity")
	public refreshEntity(entityId: string): Promise<void> {
		return this.fetchEntityState(entityId);
	}

	/**
	 * Refresh all configured entities
	 */
	@callable("Refresh all entity states")
	public refreshAll(): Promise<void> {
		return this.pollEntityStates();
	}

	// ==================== Internal Methods ====================

	/**
	 * Handle connection state changes
	 */
	private connectStateChanged(type: string): void {
		const connected = type === 'Connection';
		if (connected !== this.mConnected) {
			this.mConnected = connected;
			this.changed('connected');

			if (connected && this.mAccessToken) {
				this.startPolling();
			} else {
				this.stopPolling();
			}
		}
	}

	/**
	 * Start periodic polling for entity states
	 */
	private startPolling(): void {
		this.stopPolling();
		this.pollEntityStates();
		this.pollTimer = wait(HomeAssistant.POLL_INTERVAL);
		this.pollTimer.then(() => {
			if (this.mConnected) {
				this.startPolling();
			}
		});
	}

	/**
	 * Stop polling
	 */
	private stopPolling(): void {
		if (this.pollTimer) {
			this.pollTimer.cancel();
			this.pollTimer = undefined;
		}
	}

	/**
	 * Poll all configured entity states
	 */
	private pollEntityStates(): Promise<void> {
		const promises: Promise<void>[] = [];

		if (this.mEntity1Id) {
			promises.push(this.fetchEntityState(this.mEntity1Id));
		}
		if (this.mEntity2Id) {
			promises.push(this.fetchEntityState(this.mEntity2Id));
		}
		if (this.mEntity3Id) {
			promises.push(this.fetchEntityState(this.mEntity3Id));
		}
		if (this.mEntity4Id) {
			promises.push(this.fetchEntityState(this.mEntity4Id));
		}

		return Promise.all(promises).then(() => {});
	}

	/**
	 * Fetch state for a single entity
	 */
	private fetchEntityState(entityId: string): Promise<void> {
		return this.apiGet(`/api/states/${entityId}`).then(response => {
			this.updateEntityState(entityId, response);
		}).catch(err => {
			console.error(`Failed to fetch state for ${entityId}:`, err);
		});
	}

	/**
	 * Update local entity state and notify changes
	 */
	private updateEntityState(entityId: string, state: EntityState): void {
		this.entityStates.set(entityId, state);

		const stateValue = state.state || '';
		const brightness = state.attributes?.brightness || 0;

		if (entityId === this.mEntity1Id) {
			if (this.mEntity1State !== stateValue) {
				this.mEntity1State = stateValue;
				this.changed('entity1State');
			}
			if (this.mEntity1Brightness !== brightness) {
				this.mEntity1Brightness = brightness;
				this.changed('entity1Brightness');
			}
		} else if (entityId === this.mEntity2Id) {
			if (this.mEntity2State !== stateValue) {
				this.mEntity2State = stateValue;
				this.changed('entity2State');
			}
			if (this.mEntity2Brightness !== brightness) {
				this.mEntity2Brightness = brightness;
				this.changed('entity2Brightness');
			}
		} else if (entityId === this.mEntity3Id) {
			if (this.mEntity3State !== stateValue) {
				this.mEntity3State = stateValue;
				this.changed('entity3State');
			}
			if (this.mEntity3Brightness !== brightness) {
				this.mEntity3Brightness = brightness;
				this.changed('entity3Brightness');
			}
		} else if (entityId === this.mEntity4Id) {
			if (this.mEntity4State !== stateValue) {
				this.mEntity4State = stateValue;
				this.changed('entity4State');
			}
			if (this.mEntity4Brightness !== brightness) {
				this.mEntity4Brightness = brightness;
				this.changed('entity4Brightness');
			}
		}
	}

	/**
	 * Extract domain from entity ID
	 */
	private getDomain(entityId: string): string {
		const parts = entityId.split('.');
		return parts.length > 0 ? parts[0] : 'homeassistant';
	}

	/**
	 * Call a Home Assistant service
	 */
	private callService(domain: string, service: string, data: object): Promise<void> {
		return this.apiPost(`/api/services/${domain}/${service}`, data).then(() => {
			// Refresh entity state after service call if entity_id is provided
			const entityId = (data as any).entity_id;
			if (entityId) {
				wait(500).then(() => this.fetchEntityState(entityId));
			}
		});
	}

	/**
	 * Make an HTTP GET request to Home Assistant API
	 */
	private apiGet(path: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const request = this.buildHttpRequest('GET', path);
			this.sendHttpRequest(request, resolve, reject);
		});
	}

	/**
	 * Make an HTTP POST request to Home Assistant API
	 */
	private apiPost(path: string, data: object): Promise<any> {
		return new Promise((resolve, reject) => {
			const body = JSON.stringify(data);
			const request = this.buildHttpRequest('POST', path, body);
			this.sendHttpRequest(request, resolve, reject);
		});
	}

	/**
	 * Build an HTTP request string
	 */
	private buildHttpRequest(method: string, path: string, body?: string): string {
		const headers = [
			`${method} ${path} HTTP/1.1`,
			`Host: ${this.socket.address}:${this.socket.port}`,
			`Authorization: Bearer ${this.mAccessToken}`,
			'Content-Type: application/json',
			'Accept: application/json',
			'Connection: keep-alive'
		];

		if (body) {
			headers.push(`Content-Length: ${body.length}`);
		}

		return headers.join('\r\n') + '\r\n\r\n' + (body || '');
	}

	// Response handling
	private pendingResolve: ((value: any) => void) | undefined;
	private pendingReject: ((reason: any) => void) | undefined;
	private responseBuffer: string = '';

	/**
	 * Send HTTP request over the TCP socket
	 */
	private sendHttpRequest(
		request: string,
		resolve: (value: any) => void,
		reject: (reason: any) => void
	): void {
		this.pendingResolve = resolve;
		this.pendingReject = reject;
		this.responseBuffer = '';

		this.socket.sendText(request);
	}

	/**
	 * Handle incoming response data
	 */
	private handleResponse(text: string): void {
		this.responseBuffer += text;

		// Check if we have a complete HTTP response
		const headerEndIndex = this.responseBuffer.indexOf('\r\n\r\n');
		if (headerEndIndex === -1) {
			return; // Wait for more data
		}

		const headers = this.responseBuffer.substring(0, headerEndIndex);
		const body = this.responseBuffer.substring(headerEndIndex + 4);

		// Parse Content-Length
		const contentLengthMatch = headers.match(/Content-Length:\s*(\d+)/i);
		if (contentLengthMatch) {
			const contentLength = parseInt(contentLengthMatch[1]);
			if (body.length < contentLength) {
				return; // Wait for more data
			}
		}

		// Parse status code
		const statusMatch = headers.match(/HTTP\/\d\.\d\s+(\d+)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;

		// Parse JSON body
		try {
			const jsonBody = body.trim();
			const data = jsonBody ? JSON.parse(jsonBody) : {};

			if (statusCode >= 200 && statusCode < 300) {
				if (this.pendingResolve) {
					this.pendingResolve(data);
				}
			} else {
				console.warn(`Home Assistant API error: ${statusCode}`, data);
				if (this.pendingReject) {
					this.pendingReject(`HTTP ${statusCode}: ${JSON.stringify(data)}`);
				}
			}
		} catch (e) {
			console.error('Failed to parse Home Assistant response:', e);
			if (this.pendingReject) {
				this.pendingReject(e);
			}
		}

		// Clear pending handlers
		this.pendingResolve = undefined;
		this.pendingReject = undefined;
		this.responseBuffer = '';
	}
}

/**
 * Entity state interface from Home Assistant
 */
interface EntityState {
	entity_id: string;
	state: string;
	attributes: {
		brightness?: number;
		rgb_color?: number[];
		color_temp?: number;
		temperature?: number;
		current_temperature?: number;
		hvac_mode?: string;
		friendly_name?: string;
		[key: string]: any;
	};
	last_changed: string;
	last_updated: string;
}

/**
 * Cancelable promise interface (PIXILAB Blocks specific)
 */
interface CancelablePromise<T> extends Promise<T> {
	cancel(): void;
}

/**
 * Wait function declaration (provided by PIXILAB Blocks runtime)
 */
declare function wait(ms: number): CancelablePromise<void>;
