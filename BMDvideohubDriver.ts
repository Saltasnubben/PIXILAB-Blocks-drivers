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

	@property("Routed input number (1-based)")
	@min(1)
	get routedInput(): number {
		// Return 1-based input number for user interface
		return this.mRoutedInput + 1;
	}

	set routedInput(input: number) {
		// Convert from 1-based to 0-based for internal routing
		this.owner.routeInputToOutput(input - 1, this.outputIndex);
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

	@property("Routed input label", true)
	get routedInputLabel(): string {
		return this.owner.getInputLabel(this.mRoutedInput);
	}
}

/**
 * Represents input information
 */
class InputInfo {
	private mLabel: string = "";

	constructor(
		private owner: BMDvideohubDriver,
		private index: number
	) {}

	@property("Input label", true)
	get label(): string {
		return this.mLabel;
	}

	@property("Routed to outputs", true)
	get destinations(): string {
		return this.owner.getInputDestinations(this.index);
	}

	public updateLabel(label: string): void {
		if (this.mLabel !== label) {
			this.mLabel = label;
			// Notify property change
			this.owner.changed(`input`);
		}
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

	// Simple label dictionaries with 1-based indexing for easy display
	public readonly inputLabel: {[index: number]: string} = {};
	public readonly outputLabel: {[index: number]: string} = {};

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
	 * NetworkTCP delivers each line separately without line endings, so we reconstruct them
	 */
	private receiveData(data: string): void {
		// Add line back with CRLF (NetworkTCP strips line endings)
		this.receiveBuffer += data + '\r\n';

		// Process complete blocks (terminated by blank line - \r\n\r\n becomes two consecutive CRLFs)
		let doubleLine: number;
		while ((doubleLine = this.receiveBuffer.indexOf('\r\n\r\n')) >= 0) {
			const block = this.receiveBuffer.substring(0, doubleLine);
			this.receiveBuffer = this.receiveBuffer.substring(doubleLine + 4); // Skip \r\n\r\n

			if (block.length > 0) {
				this.processBlock(block);
			}
		}
	}

	/**
	 * Process a complete protocol block
	 */
	private processBlock(block: string): void {
		const lines = block.split('\r\n');
		if (lines.length === 0) return;

		const header = lines[0].trim();
		const data = lines.slice(1);

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
				// Command acknowledged
				break;
			case 'NAK':
				console.warn('VideoHub: Command rejected by device');
				break;
			default:
				// Silently ignore unknown block types (NETWORK, CONFIGURATION, TAKE MODE, etc.)
				break;
		}
	}

	/**
	 * Parse protocol preamble (version info)
	 */
	private parseProtocolPreamble(data: string[]): void {
		// Protocol version information - silently parsed
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

		// Log connection info
		console.warn(`VideoHub connected: ${this.deviceModel}, ${this.numInputs} inputs, ${this.numOutputs} outputs`);

		// Explicitly notify property changes for read-only properties
		this.changed('model');
		this.changed('inputs');
		this.changed('outputs');
	}

	/**
	 * Initialize input objects
	 */
	private initializeInputs(): void {
		// Initialize array without using ES6 fill() which isn't supported in Blocks
		this.inputLabels = new Array(this.numInputs);
		for (let i = 0; i < this.numInputs; i++) {
			this.inputLabels[i] = '';
			this.input[i] = new InputInfo(this, i);
			// Populate 1-based label dictionary
			this.inputLabel[i + 1] = '';
		}
	}

	/**
	 * Initialize output objects
	 */
	private initializeOutputs(): void {
		// Initialize array without using ES6 fill() which isn't supported in Blocks
		this.outputLabels = new Array(this.numOutputs);
		for (let i = 0; i < this.numOutputs; i++) {
			this.outputLabels[i] = '';
			this.output[i] = new OutputRoute(this, i);
			// Populate 1-based label dictionary
			this.outputLabel[i + 1] = '';
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
					// Update 1-based label dictionary
					this.inputLabel[index + 1] = label;
					if (this.input[index]) {
						this.input[index].updateLabel(label);
					}
				}
			}
		});
		this.changed('inputLabel');
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
					// Update 1-based label dictionary
					this.outputLabel[index + 1] = label;
				}
			}
		});
		this.changed('outputLabel');
	}

	/**
	 * Parse output routing state
	 */
	private parseOutputRouting(data: string[]): void {
		data.forEach(line => {
			const spaceIdx = line.indexOf(' ');
			if (spaceIdx > 0) {
				const outputIndex = parseInt(line.substring(0, spaceIdx));
				const inputIndex = parseInt(line.substring(spaceIdx + 1));

				if (outputIndex >= 0 && outputIndex < this.numOutputs) {
					if (this.output[outputIndex]) {
						this.output[outputIndex].updateRoutedInput(inputIndex);
					}
				}
			}
		});
		// Routing changes affect input destinations, so notify
		this.changed('input');
	}

	/**
	 * Get output label (0-based index)
	 */
	public getOutputLabel(index: number): string {
		if (index >= 0 && index < this.outputLabels.length) {
			return this.outputLabels[index] || `Output ${index + 1}`;
		}
		return `Output ${index + 1}`;
	}

	/**
	 * Get input label (0-based index)
	 */
	public getInputLabel(index: number): string {
		if (index >= 0 && index < this.inputLabels.length) {
			return this.inputLabels[index] || `Input ${index + 1}`;
		}
		return `Input ${index + 1}`;
	}

	/**
	 * Get comma-separated list of output labels where this input is routed (0-based index)
	 */
	public getInputDestinations(inputIndex: number): string {
		const destinations: string[] = [];
		for (let i = 0; i < this.numOutputs; i++) {
			if (this.output[i] && this.output[i]['mRoutedInput'] === inputIndex) {
				destinations.push(this.getOutputLabel(i));
			}
		}
		return destinations.length > 0 ? destinations.join(', ') : 'None';
	}

	/**
	 * Route an input to an output
	 */
	public routeInputToOutput(inputIndex: number, outputIndex: number): void {
		if (!this.socket.connected) {
			console.warn("VideoHub: Cannot route - not connected");
			return;
		}

		if (inputIndex < 0 || inputIndex >= this.numInputs) {
			console.warn(`VideoHub: Invalid input ${inputIndex + 1} (must be 1-${this.numInputs})`);
			return;
		}

		if (outputIndex < 0 || outputIndex >= this.numOutputs) {
			console.warn(`VideoHub: Invalid output ${outputIndex + 1} (must be 1-${this.numOutputs})`);
			return;
		}

		// Send routing command (must use CRLF line endings)
		const cmd = `VIDEO OUTPUT ROUTING:\r\n${outputIndex} ${inputIndex}\r\n\r\n`;
		this.socket.sendText(cmd);
	}

	/**
	 * Callable method to route input to output (1-based numbering)
	 */
	@callable("Route input to output")
	public route(
		@parameter("Input number") inputNum: number,
		@parameter("Output number") outputNum: number
	): void {
		// Convert from 1-based to 0-based for internal routing
		this.routeInputToOutput(inputNum - 1, outputNum - 1);
	}

	/**
	 * Query current routing status
	 */
	@callable("Query routing status")
	public queryStatus(): void {
		if (this.socket.connected) {
			// Requesting routing status - device should respond with current state (must use CRLF)
			this.socket.sendText("VIDEO OUTPUT ROUTING:\r\n\r\n");
		}
	}

	@callable("Debug: Show device info")
	public debugInfo(): void {
		console.warn(`=== VIDEOHUB DEBUG INFO ===`);
		console.warn(`Connected: ${this.socket.connected}`);
		console.warn(`Model: "${this.deviceModel}"`);
		console.warn(`Inputs: ${this.numInputs}`);
		console.warn(`Outputs: ${this.numOutputs}`);
		console.warn(`Input objects created: ${Object.keys(this.input).length}`);
		console.warn(`Output objects created: ${Object.keys(this.output).length}`);
		console.warn(`Buffer size: ${this.receiveBuffer.length} chars`);
		if (this.numOutputs > 0 && this.output[0]) {
			console.warn(`Output[0].routedInput: ${this.output[0].routedInput}`);
		}
		console.warn(`=== END DEBUG ===`);
	}

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
