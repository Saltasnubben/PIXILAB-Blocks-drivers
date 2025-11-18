import {Driver} from "system_lib/Driver";
import {callable, driver, parameter, property} from "system_lib/Metadata";

/**
 * Sony Bravia Professional Display driver for controlling power, HDMI input, and volume
 * Uses the JSON-RPC over TCP interface (not HTTP)
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
	private mConnected = false;
	private mRequestId = 1;

	public constructor(protected socket: NetworkTCP) {
		super(socket);
		socket.autoConnect();

		// Subscribe to connection state changes
		socket.subscribe('connect', (sender, message) => {
			if (message.type === 'Connection') {
				this.mConnected = sender.connected;
				this.onConnectStateChanged(sender.connected);
			}
		});
	}

	/**
	 * Called when the connection state changes
	 */
	protected onConnectStateChanged(connected: boolean) {
		if (connected) {
			// Poll initial state when connected
			this.pollPowerStatus();
			this.pollVolumeStatus();
		}
	}

	/**
	 * Send a JSON-RPC request to the TV
	 */
	private sendRequest(service: string, method: string, params: any[]): void {
		if (!this.mConnected) {
			console.warn('Sony Bravia TV not connected');
			return;
		}

		const request = {
			method: method,
			params: params,
			id: this.mRequestId++,
			jsonrpc: '2.0'
		};

		try {
			this.socket.sendText(JSON.stringify(request));
		} catch (e) {
			console.error('Failed to send request to Sony Bravia:', e);
		}
	}

	/**
	 * Poll current power status from the TV
	 */
	private pollPowerStatus() {
		this.sendRequest('system', 'getPowerStatus', []);
	}

	/**
	 * Poll current volume status from the TV
	 */
	private pollVolumeStatus() {
		this.sendRequest('audio', 'getVolumeInformation', []);
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
			const status = on ? 'active' : 'standby';
			this.sendRequest('system', 'setPowerStatus', [{ status: status }]);
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
			const uri = `extInput:hdmi?port=${input}`;
			this.sendRequest('avContent', 'setPlayContent', [{ uri: uri }]);
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
			this.sendRequest('audio', 'setAudioVolume', [{ volume: level }]);
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
