import {NetworkTCP} from "system/Network";
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
	private mRequestId = 1;
	private mPendingRequests = new Map<number, (response: any) => void>();

	public constructor(protected socket: NetworkTCP) {
		super(socket);
		socket.autoConnect();

		// Subscribe to connection state changes
		socket.subscribe('connect', (sender, message) => {
			if (message.type === 'Connection')
				this.onConnectStateChanged(sender.connected);
		});

		// Subscribe to received data
		socket.subscribe('textReceived', (sender, message) => {
			this.onTextReceived(message.text);
		});
	}

	/**
	 * Called when the connection state changes
	 */
	private onConnectStateChanged(connected: boolean) {
		if (connected) {
			// Poll initial state when connected
			this.pollPowerStatus();
			this.pollVolumeStatus();
		}
	}

	/**
	 * Handle received text data from the TV
	 */
	private onTextReceived(text: string) {
		try {
			const response = JSON.parse(text);

			// Handle responses to requests
			if (response.id !== undefined) {
				const callback = this.mPendingRequests.get(response.id);
				if (callback) {
					callback(response);
					this.mPendingRequests.delete(response.id);
				}
			}

			// Handle errors
			if (response.error) {
				console.error('Sony Bravia API Error:', response.error);
			}
		} catch (e) {
			console.error('Failed to parse Sony Bravia response:', text);
		}
	}

	/**
	 * Send a JSON-RPC request to the TV
	 */
	private sendRequest(service: string, method: string, params: any[] = []): Promise<any> {
		return new Promise((resolve, reject) => {
			const requestId = this.mRequestId++;

			this.mPendingRequests.set(requestId, (response: any) => {
				if (response.error) {
					reject(new Error(response.error.message || 'Unknown error'));
				} else {
					resolve(response.result);
				}
			});

			const request = {
				method: method,
				params: params,
				id: requestId,
				jsonrpc: '2.0'
			};

			this.socket.sendText(JSON.stringify(request));
		});
	}

	/**
	 * Poll current power status from the TV
	 */
	private pollPowerStatus() {
		if (this.socket.connected) {
			this.sendRequest('system', 'getPowerStatus')
				.then((result: any) => {
					if (result && result.length > 0) {
						const status = result[0];
						this.mPower = status.status === 'active';
					}
				})
				.catch(err => console.error('Failed to poll power status:', err));
		}
	}

	/**
	 * Poll current volume status from the TV
	 */
	private pollVolumeStatus() {
		if (this.socket.connected) {
			this.sendRequest('audio', 'getVolumeInformation')
				.then((result: any) => {
					if (result && result.length > 0) {
						const volumeInfo = result[0];
						this.mVolume = volumeInfo.volume || 0;
					}
				})
				.catch(err => console.error('Failed to poll volume status:', err));
		}
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
			this.sendRequest('system', 'setPowerStatus', [{ status: status }])
				.then(() => {
					console.log(`Power set to ${status}`);
				})
				.catch(err => console.error('Failed to set power:', err));
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
			this.sendRequest('avContent', 'setPlayContent', [{ uri: uri }])
				.then(() => {
					console.log(`HDMI input set to ${input}`);
				})
				.catch(err => console.error('Failed to set HDMI input:', err));
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
			this.sendRequest('audio', 'setAudioVolume', [{ volume: level }])
				.then(() => {
					console.log(`Volume set to ${level}`);
				})
				.catch(err => console.error('Failed to set volume:', err));
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
