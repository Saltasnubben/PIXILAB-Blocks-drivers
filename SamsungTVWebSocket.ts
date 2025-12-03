/**
 * Samsung Smart TV WebSocket Controller for PixiLab Blocks
 * Supports modern Samsung TVs (2016+) using WebSocket protocol
 * Supports multiple TV connections simultaneously
 *
 * Features:
 * - Multiple TV support with unique identifiers
 * - Power control using KEY_POWER toggle
 * - Volume control
 * - Channel navigation
 * - Menu navigation
 * - Media controls
 * - Input/source selection
 * - Custom key commands
 * - Persistent token storage per TV
 * - Auto-reconnect functionality
 *
 * Protocol: WebSocket on port 8001 (ws://) or 8002 (wss://)
 * Author: Claude for PixiLab Blocks
 * Version: 2.0
 */

import { SimpleWebsocket } from "system/SimpleWebsocket";
import { SimpleFile } from "system/SimpleFile";
import { callable, parameter, property } from "system_lib/Metadata";
import { Script, ScriptEnv } from "system_lib/Script";

/**
 * Represents a single TV connection
 */
class TVConnection {
	public ws: WebsocketConnection | null = null;
	public host: string;
	public port: number;
	public useSSL: boolean;
	public authToken: string = "";
	public connected: boolean = false;
	public connecting: boolean = false;
	public powerState: boolean = false;

	constructor(host: string, port: number = 8001, token: string = "") {
		this.host = host;
		this.port = port;
		this.useSSL = port === 8002;
		this.authToken = token;
	}

	public getId(): string {
		return `${this.host}:${this.port}`;
	}
}

export class SamsungTVWebSocket extends Script {
	private tvConnections: { [key: string]: TVConnection } = {};
	private defaultTvId: string = "";
	private remoteName: string = "Blocks Remote";
	private tokenFile: string = "samsung-tv-tokens.json";

	public constructor(env: ScriptEnv) {
		super(env);
		this.loadTokens();
	}

	/**
	 * Load all saved authentication tokens from disk
	 */
	private async loadTokens(): Promise<void> {
		try {
			if (SimpleFile.exists(this.tokenFile) === 1) {
				const data = await SimpleFile.read(this.tokenFile);
				const tokensData = JSON.parse(data);

				for (const tvId in tokensData) {
					if (tokensData.hasOwnProperty(tvId)) {
						const tvData = tokensData[tvId];
						const connection = new TVConnection(tvData.host, tvData.port, tvData.token);
						this.tvConnections[tvId] = connection;
						console.log(`Loaded saved token for TV: ${tvId}`);
					}
				}

				// Set default to first loaded TV
				const keys = Object.keys(this.tvConnections);
				if (keys.length > 0 && !this.defaultTvId) {
					this.defaultTvId = keys[0];
				}
			}
		} catch (error) {
			console.warn("Could not load saved tokens:", error);
		}
	}

	/**
	 * Save all authentication tokens to disk
	 */
	private async saveTokens(): Promise<void> {
		try {
			const tokensData: any = {};

			for (const tvId in this.tvConnections) {
				if (this.tvConnections.hasOwnProperty(tvId)) {
					const connection = this.tvConnections[tvId];
					if (connection.authToken) {
						tokensData[tvId] = {
							host: connection.host,
							port: connection.port,
							token: connection.authToken
						};
					}
				}
			}

			await SimpleFile.write(this.tokenFile, JSON.stringify(tokensData, null, 2));
			console.log("Tokens saved successfully");
		} catch (error) {
			console.error("Failed to save tokens:", error);
		}
	}

	/**
	 * Get TV connection, using default if tvId not specified
	 */
	private getTVConnection(tvId?: string): TVConnection | null {
		const id = tvId || this.defaultTvId;
		if (!id) {
			console.error("No TV ID specified and no default TV set. Use connect() first.");
			return null;
		}

		const connection = this.tvConnections[id];
		if (!connection) {
			console.error(`TV connection not found: ${id}`);
			return null;
		}

		return connection;
	}

	/**
	 * Initialize connection to a Samsung TV
	 */
	@callable("Connect to Samsung TV")
	public async connect(
		@parameter("TV IP address") host: string,
		@parameter("Port (8001=ws, 8002=wss)", true) port?: number,
		@parameter("Auth token (optional)", true) token?: string
	): Promise<void> {
		const tvPort = port || 8001;
		const tvId = `${host}:${tvPort}`;

		// Check if already exists
		let connection = this.tvConnections[tvId];

		if (!connection) {
			connection = new TVConnection(host, tvPort, token || "");
			this.tvConnections[tvId] = connection;
		} else {
			if (token) {
				connection.authToken = token;
			}
		}

		// Set as default if it's the first one
		if (!this.defaultTvId) {
			this.defaultTvId = tvId;
		}

		await this.connectWebSocket(connection);
	}

	/**
	 * Internal method to establish WebSocket connection
	 */
	private async connectWebSocket(connection: TVConnection): Promise<void> {
		if (connection.connecting || connection.connected) {
			return;
		}

		connection.connecting = true;

		try {
			const protocol = connection.useSSL ? "wss" : "ws";
			const encodedName = this.base64Encode(this.remoteName);

			let url = `${protocol}://${connection.host}:${connection.port}/api/v2/channels/samsung.remote.control?name=${encodedName}`;

			if (connection.authToken) {
				url += `&token=${connection.authToken}`;
			}

			console.log(`Connecting to Samsung TV at ${connection.getId()}`);

			const headers: { [key: string]: string } = {};
			connection.ws = await SimpleWebsocket.connect(url, 65536, headers);

			connection.ws.subscribe('textReceived', (sender: any, message: any) => {
				this.handleMessage(connection, message.text);
			});

			connection.ws.subscribe('finish', () => {
				console.log(`WebSocket connection closed for ${connection.getId()}`);
				connection.connected = false;
				connection.ws = null;
			});

			connection.connected = true;
			console.log(`Connected to Samsung TV: ${connection.getId()}`);

		} catch (error) {
			console.error(`Failed to connect to Samsung TV ${connection.getId()}:`, error);
			connection.connected = false;
			connection.ws = null;
		} finally {
			connection.connecting = false;
		}
	}

	/**
	 * Disconnect from a specific TV or all TVs
	 */
	@callable("Disconnect from Samsung TV")
	public disconnect(
		@parameter("TV ID (host:port) or leave empty for all", true) tvId?: string
	): void {
		if (tvId) {
			const connection = this.tvConnections[tvId];
			if (connection && connection.ws) {
				try {
					connection.ws.disconnect();
				} catch (e) {
					console.error(`Error disconnecting from ${tvId}:`, e);
				}
				connection.ws = null;
				connection.connected = false;
			}
		} else {
			// Disconnect all
			for (const id in this.tvConnections) {
				if (this.tvConnections.hasOwnProperty(id)) {
					const connection = this.tvConnections[id];
					if (connection.ws) {
						try {
							connection.ws.disconnect();
						} catch (e) {
							console.error(`Error disconnecting from ${id}:`, e);
						}
						connection.ws = null;
						connection.connected = false;
					}
				}
			}
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(connection: TVConnection, text: string): void {
		try {
			const message = JSON.parse(text);

			// Handle connection event
			if (message.event === 'ms.channel.connect') {
				console.log(`Connection established for ${connection.getId()}:`, message.data);

				// Extract token if provided
				if (message.data && message.data.token) {
					connection.authToken = message.data.token;
					console.log(`Received auth token for ${connection.getId()}`);
					this.saveTokens();
				}
			}

			// Handle unauthorized event
			else if (message.event === 'ms.channel.unauthorized') {
				console.warn(`Unauthorized for ${connection.getId()} - TV may require pairing approval on TV screen`);
			}

			// Handle other events
			else {
				console.log(`Received message from ${connection.getId()}:`, message);
			}

		} catch (e) {
			console.warn(`Failed to parse message from ${connection.getId()}:`, text);
		}
	}

	/**
	 * Send a remote control key to a TV
	 * Automatically reconnects if not connected
	 */
	private async sendKey(keyCode: string, tvId?: string): Promise<void> {
		const connection = this.getTVConnection(tvId);
		if (!connection) {
			return;
		}

		// Auto-reconnect if needed
		if (!connection.connected) {
			console.log(`Not connected to ${connection.getId()}, attempting to reconnect...`);
			try {
				await this.connectWebSocket(connection);
				// Wait for connection to stabilize
				await new Promise(resolve => setTimeout(resolve, 1000));
			} catch (error) {
				console.error(`Failed to reconnect to ${connection.getId()}:`, error);
				return;
			}
		}

		if (!connection.connected || !connection.ws) {
			console.error(`Still not connected to ${connection.getId()}. Please check TV is on.`);
			return;
		}

		const command = {
			method: "ms.remote.control",
			params: {
				Cmd: "Click",
				DataOfCmd: keyCode,
				Option: "false",
				TypeOfRemote: "SendRemoteKey"
			}
		};

		try {
			connection.ws.sendText(JSON.stringify(command));
			console.log(`Sent command to ${connection.getId()}: ${keyCode}`);
		} catch (error) {
			console.error(`Failed to send key to ${connection.getId()}:`, error);
		}
	}

	/**
	 * Base64 encode a string
	 */
	private base64Encode(str: string): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		let result = '';
		let i = 0;

		while (i < str.length) {
			const a = str.charCodeAt(i++);
			const b = i < str.length ? str.charCodeAt(i++) : 0;
			const c = i < str.length ? str.charCodeAt(i++) : 0;

			const bitmap = (a << 16) | (b << 8) | c;

			result += chars.charAt((bitmap >> 18) & 63);
			result += chars.charAt((bitmap >> 12) & 63);
			result += i - 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
			result += i < str.length ? chars.charAt(bitmap & 63) : '=';
		}

		return result;
	}

	// ============================================
	// Properties
	// ============================================

	@property("Default TV ID")
	public get defaultTV(): string {
		return this.defaultTvId;
	}

	public set defaultTV(tvId: string) {
		if (this.tvConnections[tvId]) {
			this.defaultTvId = tvId;
			console.log(`Default TV set to: ${tvId}`);
		} else {
			console.error(`TV not found: ${tvId}`);
		}
	}

	@property("Connected TVs (comma-separated)")
	public get connectedTVs(): string {
		const connected: string[] = [];
		for (const id in this.tvConnections) {
			if (this.tvConnections.hasOwnProperty(id)) {
				const connection = this.tvConnections[id];
				if (connection.connected) {
					connected.push(id);
				}
			}
		}
		return connected.join(', ');
	}

	// ============================================
	// Callable Methods - Power Control
	// ============================================

	@callable('Power on the TV')
	public async powerOn(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		const connection = this.getTVConnection(tvId);
		if (!connection) return;

		// Only send if currently off
		if (!connection.powerState) {
			await this.sendKey('KEY_POWER', tvId);
			connection.powerState = true;
		}
	}

	@callable('Power off the TV')
	public async powerOff(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		const connection = this.getTVConnection(tvId);
		if (!connection) return;

		// Only send if currently on
		if (connection.powerState) {
			await this.sendKey('KEY_POWER', tvId);
			connection.powerState = false;
		}
	}

	@callable('Toggle power state')
	public async powerToggle(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		const connection = this.getTVConnection(tvId);
		if (!connection) return;

		await this.sendKey('KEY_POWER', tvId);
		connection.powerState = !connection.powerState;
	}

	// ============================================
	// Callable Methods - Volume Control
	// ============================================

	@callable('Increase volume')
	public async volumeUp(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_VOLUP', tvId);
	}

	@callable('Decrease volume')
	public async volumeDown(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_VOLDOWN', tvId);
	}

	@callable('Toggle mute')
	public async toggleMute(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_MUTE', tvId);
	}

	// ============================================
	// Callable Methods - Channel Control
	// ============================================

	@callable('Next channel')
	public async channelUp(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_CHUP', tvId);
	}

	@callable('Previous channel')
	public async channelDown(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_CHDOWN', tvId);
	}

	@callable('Return to previous channel')
	public async previousChannel(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_PRECH', tvId);
	}

	// ============================================
	// Callable Methods - Navigation
	// ============================================

	@callable('Navigate up')
	public async up(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_UP', tvId);
	}

	@callable('Navigate down')
	public async down(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_DOWN', tvId);
	}

	@callable('Navigate left')
	public async left(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_LEFT', tvId);
	}

	@callable('Navigate right')
	public async right(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_RIGHT', tvId);
	}

	@callable('Select/Enter')
	public async enter(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_ENTER', tvId);
	}

	@callable('Back/Return')
	public async back(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_RETURN', tvId);
	}

	@callable('Exit')
	public async exit(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_EXIT', tvId);
	}

	// ============================================
	// Callable Methods - Menu & Special Functions
	// ============================================

	@callable('Open main menu')
	public async menu(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_MENU', tvId);
	}

	@callable('Open home screen')
	public async home(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_HOME', tvId);
	}

	@callable('Open tools menu')
	public async tools(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_TOOLS', tvId);
	}

	@callable('Open info display')
	public async info(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_INFO', tvId);
	}

	@callable('Change input source')
	public async changeSource(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_SOURCE', tvId);
	}

	// ============================================
	// Callable Methods - Media Control
	// ============================================

	@callable('Play')
	public async play(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_PLAY', tvId);
	}

	@callable('Pause')
	public async pause(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_PAUSE', tvId);
	}

	@callable('Stop')
	public async stop(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_STOP', tvId);
	}

	@callable('Rewind')
	public async rewind(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_REWIND', tvId);
	}

	@callable('Fast forward')
	public async fastForward(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_FF', tvId);
	}

	@callable('Record')
	public async record(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_REC', tvId);
	}

	// ============================================
	// Callable Methods - Direct Input
	// ============================================

	@callable('Send custom key command')
	public async sendCommand(
		@parameter('Key command (e.g., KEY_HDMI, KEY_MENU)') key: string,
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey(key, tvId);
	}

	@callable('Select HDMI input')
	public async selectHDMI(
		@parameter('HDMI input number (1-4)') input: number,
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		if (input < 1 || input > 4) {
			console.error('HDMI input must be between 1 and 4');
			return;
		}
		await this.sendKey('KEY_HDMI' + input, tvId);
	}

	@callable('Press number key')
	public async pressNumber(
		@parameter('Number (0-9)') num: number,
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		if (num < 0 || num > 9) {
			console.error('Number must be between 0 and 9');
			return;
		}
		await this.sendKey('KEY_' + num, tvId);
	}

	// ============================================
	// Callable Methods - Picture Settings
	// ============================================

	@callable('Cycle picture mode')
	public async pictureMode(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_PMODE', tvId);
	}

	@callable('Toggle picture size')
	public async pictureSize(
		@parameter("TV ID (host:port) - optional", true) tvId?: string
	): Promise<void> {
		await this.sendKey('KEY_PICTURE_SIZE', tvId);
	}

	// ============================================
	// Utility Methods
	// ============================================

	@callable('List all configured TVs')
	public listTVs(): string {
		const tvList: string[] = [];
		for (const id in this.tvConnections) {
			if (this.tvConnections.hasOwnProperty(id)) {
				const connection = this.tvConnections[id];
				const status = connection.connected ? "connected" : "disconnected";
				const isDefault = id === this.defaultTvId ? " (default)" : "";
				tvList.push(`${id} - ${status}${isDefault}`);
			}
		}
		return tvList.join('\n') || 'No TVs configured';
	}
}
