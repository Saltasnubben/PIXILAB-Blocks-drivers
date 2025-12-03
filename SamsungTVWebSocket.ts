/**
 * Samsung Smart TV WebSocket Controller for PixiLab Blocks
 * Supports modern Samsung TVs (2016+) using WebSocket protocol
 *
 * Features:
 * - Power control (via Wake-on-LAN)
 * - Volume control
 * - Channel navigation
 * - Menu navigation
 * - Media controls
 * - Input/source selection
 * - Custom key commands
 *
 * Protocol: WebSocket on port 8001 (ws://) or 8002 (wss://)
 * Author: Claude for PixiLab Blocks
 * Version: 1.0
 */

import { SimpleWebsocket } from "system/SimpleWebsocket";
import { SimpleFile } from "system/SimpleFile";
import { callable, parameter, property } from "system_lib/Metadata";
import { Script, ScriptEnv } from "system_lib/Script";

export class SamsungTVWebSocket extends Script {
	private ws: WebsocketConnection | null = null;
	private tvHost: string = "";
	private tvPort: number = 8001;
	private useSSL: boolean = false;
	private authToken: string = "";
	private remoteName: string = "Blocks Remote";
	private tokenFile: string = "samsung-tv-token.txt";

	private mPower: boolean = false;
	private mVolume: number = 50;
	private mMuted: boolean = false;
	private mSource: string = "HDMI1";
	private connecting: boolean = false;
	private connected: boolean = false;

	public constructor(env: ScriptEnv) {
		super(env);
		this.loadToken();
	}

	/**
	 * Load saved authentication token from disk
	 */
	private async loadToken(): Promise<void> {
		try {
			if (SimpleFile.exists(this.tokenFile) === 1) {
				const data = await SimpleFile.read(this.tokenFile);
				const tokenData = JSON.parse(data);
				if (tokenData.token && tokenData.host) {
					this.authToken = tokenData.token;
					this.tvHost = tokenData.host;
					this.tvPort = tokenData.port || 8001;
					console.log(`Loaded saved token for ${this.tvHost}:${this.tvPort}`);
				}
			}
		} catch (error) {
			console.warn("Could not load saved token:", error);
		}
	}

	/**
	 * Save authentication token to disk
	 */
	private async saveToken(): Promise<void> {
		try {
			const tokenData = {
				token: this.authToken,
				host: this.tvHost,
				port: this.tvPort
			};
			await SimpleFile.write(this.tokenFile, JSON.stringify(tokenData));
			console.log("Token saved successfully");
		} catch (error) {
			console.error("Failed to save token:", error);
		}
	}

	/**
	 * Initialize connection to Samsung TV
	 */
	@callable("Connect to Samsung TV")
	public async connect(
		@parameter("TV IP address") host: string,
		@parameter("Port (8001=ws, 8002=wss)", true) port?: number,
		@parameter("Auth token (optional)", true) token?: string
	): Promise<void> {
		if (this.connecting) {
			console.warn("Connection already in progress");
			return;
		}

		this.tvHost = host;
		this.tvPort = port || 8001;
		this.useSSL = this.tvPort === 8002;
		this.authToken = token || "";

		await this.connectWebSocket();
	}

	/**
	 * Disconnect from Samsung TV
	 */
	@callable("Disconnect from Samsung TV")
	public disconnect(): void {
		if (this.ws) {
			try {
				this.ws.disconnect();
			} catch (e) {
				console.error("Error disconnecting:", e);
			}
			this.ws = null;
			this.connected = false;
		}
	}

	/**
	 * Reconnect to Samsung TV
	 */
	@callable("Reconnect to Samsung TV")
	public async reconnect(): Promise<void> {
		this.disconnect();
		await this.connectWebSocket();
	}

	/**
	 * Internal method to establish WebSocket connection
	 */
	private async connectWebSocket(): Promise<void> {
		if (this.connecting || this.connected) {
			return;
		}

		this.connecting = true;

		try {
			const protocol = this.useSSL ? "wss" : "ws";
			const encodedName = this.base64Encode(this.remoteName);

			let url = `${protocol}://${this.tvHost}:${this.tvPort}/api/v2/channels/samsung.remote.control?name=${encodedName}`;

			if (this.authToken) {
				url += `&token=${this.authToken}`;
			}

			console.log(`Connecting to Samsung TV at ${url}`);

			const headers: { [key: string]: string } = {};

			this.ws = await SimpleWebsocket.connect(url, 65536, headers);

			this.ws.subscribe('textReceived', (sender: any, message: any) => {
				this.handleMessage(message.text);
			});

			this.ws.subscribe('finish', () => {
				console.log("WebSocket connection closed");
				this.connected = false;
				this.ws = null;
			});

			this.connected = true;
			console.log("Connected to Samsung TV");

		} catch (error) {
			console.error("Failed to connect to Samsung TV:", error);
			this.connected = false;
			this.ws = null;
		} finally {
			this.connecting = false;
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(text: string): void {
		try {
			const message = JSON.parse(text);

			// Handle connection event
			if (message.event === 'ms.channel.connect') {
				console.log("Connection established:", message.data);

				// Extract token if provided
				if (message.data && message.data.token) {
					this.authToken = message.data.token;
					console.log("Received auth token:", this.authToken);
					// Save token to disk for future use
					this.saveToken();
				}
			}

			// Handle unauthorized event
			else if (message.event === 'ms.channel.unauthorized') {
				console.warn("Unauthorized - TV may require pairing approval on TV screen");
			}

			// Handle other events
			else {
				console.log("Received message:", message);
			}

		} catch (e) {
			console.warn("Failed to parse message:", text);
		}
	}

	/**
	 * Send a remote control key to the TV
	 * Automatically reconnects if not connected
	 */
	private async sendKey(keyCode: string): Promise<void> {
		// Auto-reconnect if we have a saved host but not connected
		if (!this.connected && this.tvHost) {
			console.log("Not connected, attempting to reconnect...");
			try {
				await this.connectWebSocket();
				// Wait a bit for connection to establish
				await new Promise(resolve => setTimeout(resolve, 1000));
			} catch (error) {
				console.error("Failed to reconnect:", error);
				console.warn("Not connected to TV. Use connect() first to set up the TV.");
				return;
			}
		}

		if (!this.connected || !this.ws) {
			console.error("Still not connected after reconnection attempt. Please check TV is on and use connect() method.");
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
			this.ws.sendText(JSON.stringify(command));
			console.log(`Sent command: ${keyCode}`);
		} catch (error) {
			console.error("Failed to send key:", error);
		}
	}

	/**
	 * Base64 encode a string
	 */
	private base64Encode(str: string): string {
		// Simple base64 encoding for ASCII strings
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

	@property("Connection status")
	public get isConnected(): boolean {
		return this.connected;
	}

	@property("Power state")
	public get power(): boolean {
		return this.mPower;
	}

	public set power(on: boolean) {
		this.mPower = on;
		if (on) {
			this.sendKey('KEY_POWERON');
		} else {
			this.sendKey('KEY_POWEROFF');
		}
	}

	@property("Volume level (0-100)")
	public get volume(): number {
		return this.mVolume;
	}

	public set volume(level: number) {
		if (level < 0 || level > 100) {
			console.error('Volume must be between 0 and 100');
			return;
		}
		this.mVolume = level;
	}

	@property("Mute status")
	public get muted(): boolean {
		return this.mMuted;
	}

	public set muted(mute: boolean) {
		if (this.mMuted !== mute) {
			this.mMuted = mute;
			this.sendKey('KEY_MUTE');
		}
	}

	@property("Current input source")
	public get source(): string {
		return this.mSource;
	}

	public set source(src: string) {
		this.mSource = src;
		this.sendKey('KEY_SOURCE');
	}

	// ============================================
	// Callable Methods - Power Control
	// ============================================

	@callable('Power on the TV')
	public powerOn(): void {
		this.power = true;
	}

	@callable('Power off the TV')
	public powerOff(): void {
		this.power = false;
	}

	@callable('Toggle power state')
	public powerToggle(): void {
		this.sendKey('KEY_POWER');
		this.mPower = !this.mPower;
	}

	// ============================================
	// Callable Methods - Volume Control
	// ============================================

	@callable('Increase volume')
	public volumeUp(): void {
		this.sendKey('KEY_VOLUP');
		if (this.mVolume < 100) {
			this.mVolume++;
		}
	}

	@callable('Decrease volume')
	public volumeDown(): void {
		this.sendKey('KEY_VOLDOWN');
		if (this.mVolume > 0) {
			this.mVolume--;
		}
	}

	@callable('Toggle mute')
	public toggleMute(): void {
		this.mMuted = !this.mMuted;
		this.sendKey('KEY_MUTE');
	}

	// ============================================
	// Callable Methods - Channel Control
	// ============================================

	@callable('Next channel')
	public channelUp(): void {
		this.sendKey('KEY_CHUP');
	}

	@callable('Previous channel')
	public channelDown(): void {
		this.sendKey('KEY_CHDOWN');
	}

	@callable('Return to previous channel')
	public previousChannel(): void {
		this.sendKey('KEY_PRECH');
	}

	// ============================================
	// Callable Methods - Navigation
	// ============================================

	@callable('Navigate up')
	public up(): void {
		this.sendKey('KEY_UP');
	}

	@callable('Navigate down')
	public down(): void {
		this.sendKey('KEY_DOWN');
	}

	@callable('Navigate left')
	public left(): void {
		this.sendKey('KEY_LEFT');
	}

	@callable('Navigate right')
	public right(): void {
		this.sendKey('KEY_RIGHT');
	}

	@callable('Select/Enter')
	public enter(): void {
		this.sendKey('KEY_ENTER');
	}

	@callable('Back/Return')
	public back(): void {
		this.sendKey('KEY_RETURN');
	}

	@callable('Exit')
	public exit(): void {
		this.sendKey('KEY_EXIT');
	}

	// ============================================
	// Callable Methods - Menu & Special Functions
	// ============================================

	@callable('Open main menu')
	public menu(): void {
		this.sendKey('KEY_MENU');
	}

	@callable('Open home screen')
	public home(): void {
		this.sendKey('KEY_HOME');
	}

	@callable('Open tools menu')
	public tools(): void {
		this.sendKey('KEY_TOOLS');
	}

	@callable('Open info display')
	public info(): void {
		this.sendKey('KEY_INFO');
	}

	@callable('Change input source')
	public changeSource(): void {
		this.sendKey('KEY_SOURCE');
	}

	// ============================================
	// Callable Methods - Media Control
	// ============================================

	@callable('Play')
	public play(): void {
		this.sendKey('KEY_PLAY');
	}

	@callable('Pause')
	public pause(): void {
		this.sendKey('KEY_PAUSE');
	}

	@callable('Stop')
	public stop(): void {
		this.sendKey('KEY_STOP');
	}

	@callable('Rewind')
	public rewind(): void {
		this.sendKey('KEY_REWIND');
	}

	@callable('Fast forward')
	public fastForward(): void {
		this.sendKey('KEY_FF');
	}

	@callable('Record')
	public record(): void {
		this.sendKey('KEY_REC');
	}

	// ============================================
	// Callable Methods - Direct Input
	// ============================================

	@callable('Send custom key command')
	public sendCommand(
		@parameter('Key command (e.g., KEY_HDMI, KEY_MENU)') key: string
	): void {
		this.sendKey(key);
	}

	@callable('Select HDMI input')
	public selectHDMI(
		@parameter('HDMI input number (1-4)') input: number
	): void {
		if (input < 1 || input > 4) {
			console.error('HDMI input must be between 1 and 4');
			return;
		}
		this.sendKey('KEY_HDMI' + input);
		this.mSource = 'HDMI' + input;
	}

	@callable('Press number key')
	public pressNumber(
		@parameter('Number (0-9)') num: number
	): void {
		if (num < 0 || num > 9) {
			console.error('Number must be between 0 and 9');
			return;
		}
		this.sendKey('KEY_' + num);
	}

	// ============================================
	// Callable Methods - Picture Settings
	// ============================================

	@callable('Cycle picture mode')
	public pictureMode(): void {
		this.sendKey('KEY_PMODE');
	}

	@callable('Toggle picture size')
	public pictureSize(): void {
		this.sendKey('KEY_PICTURE_SIZE');
	}
}
