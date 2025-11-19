import {Driver} from "system_lib/Driver";
import {callable, driver, parameter, property} from "system_lib/Metadata";

/**
 * Samsung TV Network driver for remote control functionality
 * Supports legacy protocol (pre-2014 TVs) on port 55000
 *
 * Supported functions:
 * - Power control (on/off/toggle)
 * - Volume control (up/down/mute)
 * - Channel control (up/down)
 * - Navigation (arrows, enter, back, menu)
 * - Source/Input selection
 * - Direct key command sending
 *
 * Protocol: Legacy Samsung TV protocol using TCP socket
 * Default port: 55000
 */
@driver('NetworkTCP', { port: 55000 })
export class SamsungTV extends Driver<NetworkTCP> {
	private mPower = false;
	private mVolume = 0;
	private mMuted = false;
	private mSource = "HDMI1";

	// Application and device info for protocol handshake
	private readonly APP_STRING = "iphone..iapp.samsung";
	private readonly REMOTE_NAME = "Blocks Remote";

	private isAuthenticated = false;

	public constructor(protected socket: NetworkTCP) {
		super(socket);
		socket.autoConnect();

		// Subscribe to connection state changes
		socket.subscribe('connect', (sender, message) => {
			if (message.type === 'Connection' && sender.connected) {
				this.onConnectStateChanged(true);
			}
		});

		// Subscribe to incoming text for authentication responses
		socket.subscribe('textReceived', (sender, message) => {
			this.handleResponse(message.text);
		});
	}

	/**
	 * Called when the connection state changes
	 */
	protected onConnectStateChanged(connected: boolean) {
		if (connected) {
			// Send authentication handshake for legacy protocol
			this.authenticate();
		} else {
			this.isAuthenticated = false;
		}
	}

	/**
	 * Authenticate with the TV using legacy protocol handshake
	 */
	private authenticate(): void {
		// Legacy protocol authentication packet structure
		const ipEncoded = this.base64Encode("0.0.0.0"); // IP doesn't matter for most TVs
		const macEncoded = this.base64Encode("00:00:00:00:00:00"); // MAC doesn't matter
		const nameEncoded = this.base64Encode(this.REMOTE_NAME);

		const authPayload = String.fromCharCode(0x64) +
			String.fromCharCode(0x00) +
			String.fromCharCode(ipEncoded.length) + String.fromCharCode(0x00) +
			ipEncoded +
			String.fromCharCode(macEncoded.length) + String.fromCharCode(0x00) +
			macEncoded +
			String.fromCharCode(nameEncoded.length) + String.fromCharCode(0x00) +
			nameEncoded;

		const authPacket = String.fromCharCode(0x00) +
			String.fromCharCode(this.APP_STRING.length) + String.fromCharCode(0x00) +
			this.APP_STRING +
			String.fromCharCode(authPayload.length) + String.fromCharCode(0x00) +
			authPayload;

		try {
			this.socket.sendText(authPacket);
			this.isAuthenticated = true;
		} catch (e) {
			console.error('Failed to authenticate with Samsung TV:', e);
		}
	}

	/**
	 * Handle responses from the TV
	 */
	private handleResponse(response: string): void {
		// Response handling for future enhancements
		// Legacy protocol doesn't provide much feedback
	}

	/**
	 * Base64 encode a string
	 */
	private base64Encode(str: string): string {
		// Simple base64 encoding
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

	/**
	 * Send a key command to the TV
	 */
	private sendKey(key: string): void {
		if (!this.isAuthenticated) {
			console.warn('Not authenticated with TV, attempting to authenticate...');
			this.authenticate();
			// Wait a bit for authentication, then send key
			// In production, you might want to queue commands
		}

		const keyEncoded = this.base64Encode(key);

		const keyPayload = String.fromCharCode(0x00) +
			String.fromCharCode(0x00) +
			String.fromCharCode(0x00) +
			String.fromCharCode(keyEncoded.length) + String.fromCharCode(0x00) +
			keyEncoded;

		const keyPacket = String.fromCharCode(0x00) +
			String.fromCharCode(this.APP_STRING.length) + String.fromCharCode(0x00) +
			this.APP_STRING +
			String.fromCharCode(keyPayload.length) + String.fromCharCode(0x00) +
			keyPayload;

		try {
			this.socket.sendText(keyPacket);
		} catch (e) {
			console.error('Failed to send key to Samsung TV:', e);
		}
	}

	// ============================================
	// Properties
	// ============================================

	/**
	 * Power property - get/set power state
	 */
	@property('Power control')
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

	/**
	 * Volume property - get/set volume level
	 * Note: Legacy protocol doesn't support absolute volume setting
	 * This tracks relative changes
	 */
	@property('Volume level')
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

	/**
	 * Mute property - get/set mute state
	 */
	@property('Mute control')
	public get muted(): boolean {
		return this.mMuted;
	}

	public set muted(mute: boolean) {
		if (this.mMuted !== mute) {
			this.mMuted = mute;
			this.sendKey('KEY_MUTE');
		}
	}

	/**
	 * Source property - get/set input source
	 */
	@property('Input source')
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
