import {Driver} from "system_lib/Driver";
import {callable, driver, parameter, property} from "system_lib/Metadata";

/**
 * Sony Bravia Professional Display driver for controlling power, HDMI input, and volume
 * Uses the SSIP (Simple Serial IP Protocol) interface
 * Default port: 20060
 *
 * Supported functions:
 * - Power control (on/off)
 * - HDMI input selection (1-4)
 * - Volume control (0-100%)
 */
@driver('NetworkTCP', { port: 20060 })
export class SonyBraviaTV extends Driver<NetworkTCP> {
	private mPower = false;
	private mHdmiInput = 1;
	private mVolume = 0;

	public constructor(protected socket: NetworkTCP) {
		super(socket);
		socket.autoConnect();

		// Subscribe to connection state changes to poll status when connected
		socket.subscribe('connect', (sender, message) => {
			if (message.type === 'Connection' && sender.connected) {
				this.onConnectStateChanged(true);
			}
		});
	}

	/**
	 * Called when the connection state changes
	 */
	protected onConnectStateChanged(connected: boolean) {
		if (connected) {
			// Poll status to establish the connection and prime the protocol
			// This helps with TV models that don't trigger connection events reliably
			console.warn('Sony Bravia: Connected, polling status');
			this.pollPowerStatus();
			this.pollVolumeStatus();
			this.pollInputStatus();
		}
	}

	/**
	 * Pad a string on the left to a specific length
	 * ES5 compatible alternative to String.padStart()
	 */
	private padLeft(str: string, length: number, padChar: string): string {
		while (str.length < length) {
			str = padChar + str;
		}
		return str;
	}

	/**
	 * Send SSIP command to the TV
	 * SSIP format: 23 characters of command + 0x0A (LF) newline = 24 bytes total
	 *
	 * Some TV models (particularly 40" models) may need a small delay before
	 * accepting control commands after connection.
	 */
	private sendCommand(command: string): void {
		try {
			// Ensure command is exactly 23 characters (23 chars + LF newline = 24 bytes total)
			let padded = command;
			while (padded.length < 23) {
				padded = padded + '0';
			}

			// Truncate if longer than 23 (shouldn't happen, but be safe)
			if (padded.length > 23) {
				padded = padded.substring(0, 23);
			}

			// Add LF (0x0A) at the end as required by SSIP
			const fullCommand = padded + '\n';
			console.warn('Sony Bravia: Sending command: ' + padded);
			this.socket.sendText(fullCommand);
		} catch (e) {
			console.error('Failed to send command to Sony Bravia:', e);
		}
	}

	/**
	 * Poll current power status from the TV
	 */
	private pollPowerStatus() {
		// SSIP Enquiry: *SEPOWR[################]
		console.warn('Sony Bravia: Polling power status');
		this.sendCommand('*SEPOWR################');
	}

	/**
	 * Poll current volume status from the TV
	 */
	private pollVolumeStatus() {
		// SSIP Enquiry: *SEVOLU[################]
		console.warn('Sony Bravia: Polling volume status');
		this.sendCommand('*SEVOLU################');
	}

	/**
	 * Poll current input status from the TV
	 */
	private pollInputStatus() {
		// SSIP Enquiry: *SEINPT[################]
		console.warn('Sony Bravia: Polling input status');
		this.sendCommand('*SEINPT################');
	}

	/**
	 * Power property - get/set power state
	 */
	@property('Power control')
	public get power(): boolean {
		return this.mPower;
	}

	public set power(on: boolean) {
		if (this.mPower !== on) {
			this.mPower = on;
			// SSIP Control: *SCPOWR[16-digit value] (0=off, 1=on)
			const value = on ? '0000000000000001' : '0000000000000000';
			this.sendCommand('*SCPOWR' + value);
		}
	}

	/**
	 * HDMI input property - get/set HDMI input (1-4)
	 */
	@property('HDMI input selection (1-4)')
	public get hdmiInput(): number {
		return this.mHdmiInput;
	}

	public set hdmiInput(input: number) {
		// Validate input is between 1-4
		if (input < 1 || input > 4) {
			console.error('HDMI input must be between 1 and 4');
			return;
		}

		if (this.mHdmiInput !== input) {
			this.mHdmiInput = input;
			// SSIP Control: *SCINPT[16-digit value] where format is 00000001 + 8-digit port
			const portStr = this.padLeft(String(input), 8, '0');
			const value = '00000001' + portStr;
			this.sendCommand('*SCINPT' + value);
		}
	}

	/**
	 * Volume property - get/set volume (0-100)
	 */
	@property('Volume level (0-100)')
	public get volume(): number {
		return this.mVolume;
	}

	public set volume(level: number) {
		// Validate volume is between 0-100
		if (level < 0 || level > 100) {
			console.error('Volume must be between 0 and 100');
			return;
		}

		if (this.mVolume !== level) {
			this.mVolume = level;
			// SSIP Control: *SCVOLU[16-digit value] left-padded with zeros
			const value = this.padLeft(String(level), 16, '0');
			this.sendCommand('*SCVOLU' + value);
		}
	}

	/**
	 * Callable method to set HDMI input with validation
	 */
	@callable('Set HDMI input source')
	public setHDMI(
		@parameter('Input number (1-4)') input: number
	): void {
		this.hdmiInput = input;
	}

	/**
	 * Callable method to set volume with validation
	 */
	@callable('Set volume level')
	public setVolume(
		@parameter('Volume level (0-100)') level: number
	): void {
		this.volume = level;
	}

	/**
	 * Callable method to power on
	 */
	@callable('Power on the TV')
	public powerOn(): void {
		this.power = true;
	}

	/**
	 * Callable method to power off
	 */
	@callable('Power off the TV')
	public powerOff(): void {
		this.power = false;
	}
}
