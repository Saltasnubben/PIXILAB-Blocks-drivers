/*
 * Driver for BlackMagic Design VideoHub routing switchers
 *
 * Communicates via TCP on port 9990 using text-based protocol.
 *
 * Features:
 * - Live routing state tracking
 * - Route any input to any output
 * - Automatic status updates from device
 * - Input and output label tracking
 *
 * Protocol documentation:
 * https://documents.blackmagicdesign.com/DeveloperManuals/VideohubEthernetProtocol.pdf
 */

import {NetworkTCP} from "system/Network";
import {Driver} from "system_lib/Driver";
import {driver, property, callable, parameter, max, min} from "system_lib/Metadata";

/**
 * Represents a single output's routing control
 */
class OutputRoute {
	private mRoutedInput: number = 0;
	private outputIndex: number;

	constructor(
		private owner: BMDvideohubDriver,
		outputIndex: number
	) {
		this.outputIndex = outputIndex;
	}

	@property("Routed input number (0-based)")
	@min(0)
	get routedInput(): number {
		return this.mRoutedInput;
	}

	set routedInput(input: number) {
		this.owner.routeInputToOutput(input, this.outputIndex);
	}

	/**
	 * Update the routed input from device feedback
	 */
	public updateRoutedInput(input: number): void {
		if (this.mRoutedInput !== input) {
			this.mRoutedInput = input;
			this.owner.changed('output');
		}
	}

	@property("Output label", true)
	get label(): string {
		return this.owner.getOutputLabel(this.outputIndex);
	}
}

/**
 * Represents input information
 */
class InputInfo {
	private mLabel: string = "";

	@property("Input label", true)
	get label(): string {
		return this.mLabel;
	}

	public updateLabel(label: string): void {
		this.mLabel = label;
	}
}

@driver('NetworkTCP', {port: 9990})
export class BMDvideohubDriver extends Driver<NetworkTCP> {

	private receiveBuffer: string = "";
	private numInputs: number = 0;
	private numOutputs: number = 0;
	private deviceModel: string = "Unknown";

	// Arrays of routing and label information (0-based indexing internally)
	public readonly output: {[index: number]: OutputRoute} = {};
	public readonly input: {[index: number]: InputInfo} = {};

	private outputLabels: string[] = [];
	private inputLabels: string[] = [];

	constructor(private socket: NetworkTCP) {
		super(socket);
		socket.autoConnect();

		socket.subscribe('connect', (sender, message) => {
			this.onConnectStateChanged(message.type === 'Connection');
		});

		socket.subscribe('textReceived', (sender, message) => {
			this.receiveData(message.text);
		});
	}

	/**
	 * Handle connection state changes
	 */
	protected onConnectStateChanged(connected: boolean): void {
		if (connected) {
			this.receiveBuffer = "";
			console.warn("VideoHub connected");
		} else {
			console.warn("VideoHub disconnected");
		}
	}

	/**
	 * Receive and buffer incoming data
	 */
	private receiveData(data: string): void {
		console.warn(`VideoHub: Received ${data.length} chars: ${JSON.stringify(data.substring(0, 50))}`);
		this.receiveBuffer += data;

		// Log buffer status
		console.warn(`VideoHub: Buffer now ${this.receiveBuffer.length} chars, looking for \\n\\n`);

		// Process complete blocks (terminated by blank line)
		let doubleLine: number;
		while ((doubleLine = this.receiveBuffer.indexOf('\n\n')) >= 0) {
			console.warn(`VideoHub: Found block delimiter at position ${doubleLine}`);
			const block = this.receiveBuffer.substring(0, doubleLine);
			this.receiveBuffer = this.receiveBuffer.substring(doubleLine + 2);

			if (block.length > 0) {
				this.processBlock(block);
			}
		}
	}

	/**
	 * Process a complete protocol block
	 */
	private processBlock(block: string): void {
		const lines = block.split('\n');
		if (lines.length === 0) return;

		const header = lines[0].trim();
		const data = lines.slice(1);

		console.warn(`VideoHub block: ${header} (${data.length} lines)`);

		switch (header) {
			case 'PROTOCOL PREAMBLE:':
				this.parseProtocolPreamble(data);
				break;
			case 'VIDEOHUB DEVICE:':
				this.parseDeviceInfo(data);
				break;
			case 'INPUT LABELS:':
				this.parseInputLabels(data);
				break;
			case 'OUTPUT LABELS:':
				this.parseOutputLabels(data);
				break;
			case 'VIDEO OUTPUT LOCKS:':
				// We could track locked outputs here if needed
				break;
			case 'VIDEO OUTPUT ROUTING:':
				this.parseOutputRouting(data);
				break;
			case 'CONFIGURATION:':
				// Configuration block - not needed for basic routing
				break;
			case 'ACK':
				console.warn('VideoHub: Command acknowledged');
				break;
			case 'NAK':
				console.warn('VideoHub: Command rejected');
				break;
			default:
				// Unknown block type - might be NETWORK, NETWORK INTERFACE 0, etc.
				if (header.startsWith('NETWORK')) {
					// Silently ignore network info blocks
				} else {
					console.warn(`VideoHub: Unknown block type: ${header}`);
				}
				break;
		}
	}

	/**
	 * Parse protocol preamble (version info)
	 */
	private parseProtocolPreamble(data: string[]): void {
		// Protocol version information
		data.forEach(line => {
			// Just log for now
			if (line.startsWith('Version:')) {
				console.warn('VideoHub ' + line);
			}
		});
	}

	/**
	 * Parse device information
	 */
	private parseDeviceInfo(data: string[]): void {
		data.forEach(line => {
			const parts = line.split(':');
			if (parts.length < 2) return;

			const key = parts[0].trim();
			const value = parts.slice(1).join(':').trim();

			switch (key) {
				case 'Model name':
					this.deviceModel = value;
					break;
				case 'Video inputs':
					this.numInputs = parseInt(value) || 0;
					this.initializeInputs();
					break;
				case 'Video outputs':
					this.numOutputs = parseInt(value) || 0;
					this.initializeOutputs();
					break;
			}
		});

		console.warn(`VideoHub: ${this.deviceModel}, ${this.numInputs} inputs, ${this.numOutputs} outputs`);
	}

	/**
	 * Initialize input objects
	 */
	private initializeInputs(): void {
		this.inputLabels = new Array(this.numInputs).fill('');
		for (let i = 0; i < this.numInputs; i++) {
			this.input[i] = new InputInfo();
		}
	}

	/**
	 * Initialize output objects
	 */
	private initializeOutputs(): void {
		this.outputLabels = new Array(this.numOutputs).fill('');
		for (let i = 0; i < this.numOutputs; i++) {
			this.output[i] = new OutputRoute(this, i);
		}
	}

	/**
	 * Parse input labels
	 */
	private parseInputLabels(data: string[]): void {
		data.forEach(line => {
			const spaceIdx = line.indexOf(' ');
			if (spaceIdx > 0) {
				const index = parseInt(line.substring(0, spaceIdx));
				const label = line.substring(spaceIdx + 1);

				if (index >= 0 && index < this.numInputs) {
					this.inputLabels[index] = label;
					if (this.input[index]) {
						this.input[index].updateLabel(label);
					}
				}
			}
		});
	}

	/**
	 * Parse output labels
	 */
	private parseOutputLabels(data: string[]): void {
		data.forEach(line => {
			const spaceIdx = line.indexOf(' ');
			if (spaceIdx > 0) {
				const index = parseInt(line.substring(0, spaceIdx));
				const label = line.substring(spaceIdx + 1);

				if (index >= 0 && index < this.numOutputs) {
					this.outputLabels[index] = label;
				}
			}
		});
	}

	/**
	 * Parse output routing state
	 */
	private parseOutputRouting(data: string[]): void {
		let count = 0;
		data.forEach(line => {
			const spaceIdx = line.indexOf(' ');
			if (spaceIdx > 0) {
				const outputIndex = parseInt(line.substring(0, spaceIdx));
				const inputIndex = parseInt(line.substring(spaceIdx + 1));

				if (outputIndex >= 0 && outputIndex < this.numOutputs) {
					if (this.output[outputIndex]) {
						this.output[outputIndex].updateRoutedInput(inputIndex);
						count++;
					}
				}
			}
		});
		console.warn(`VideoHub: Parsed ${count} routing entries`);
	}

	/**
	 * Get output label
	 */
	public getOutputLabel(index: number): string {
		if (index >= 0 && index < this.outputLabels.length) {
			return this.outputLabels[index] || `Output ${index}`;
		}
		return `Output ${index}`;
	}

	/**
	 * Route an input to an output
	 */
	public routeInputToOutput(inputIndex: number, outputIndex: number): void {
		console.warn(`VideoHub: routeInputToOutput called - input ${inputIndex} to output ${outputIndex}`);

		if (!this.socket.connected) {
			console.warn("Cannot route - not connected to VideoHub");
			return;
		}

		if (inputIndex < 0 || inputIndex >= this.numInputs) {
			console.warn(`Invalid input index: ${inputIndex} (must be 0-${this.numInputs-1})`);
			return;
		}

		if (outputIndex < 0 || outputIndex >= this.numOutputs) {
			console.warn(`Invalid output index: ${outputIndex} (must be 0-${this.numOutputs-1})`);
			return;
		}

		// Send routing command
		const cmd = `VIDEO OUTPUT ROUTING:\n${outputIndex} ${inputIndex}\n\n`;
		console.warn(`VideoHub: Sending command: ${JSON.stringify(cmd)}`);
		this.socket.sendText(cmd);
	}

	/**
	 * Callable method to route input to output
	 */
	@callable("Route input to output")
	public route(
		@parameter("Input number (0-based)") inputNum: number,
		@parameter("Output number (0-based)") outputNum: number
	): void {
		this.routeInputToOutput(inputNum, outputNum);
	}

	/**
	 * Query current routing status
	 */
	@callable("Query routing status")
	public queryStatus(): void {
		if (this.socket.connected) {
			// Requesting routing status - device should respond with current state
			this.socket.sendText("VIDEO OUTPUT ROUTING:\n\n");
		}
	}

	// Property getters for device info

	@property("Device model name", true)
	get model(): string {
		return this.deviceModel;
	}

	@property("Number of inputs", true)
	get inputs(): number {
		return this.numInputs;
	}

	@property("Number of outputs", true)
	get outputs(): number {
		return this.numOutputs;
	}

	@property("Connection status", true)
	get connected(): boolean {
		return this.socket.connected;
	}
}
