/**
 * Driver for Allen & Heath SQ series mixing consoles (SQ5, SQ6, SQ7).
 *
 * Uses MIDI over TCP/IP for control and feedback.
 *
 * Features:
 * - Scene recall (1-500 scenes)
 * - Indexed properties for channels, DCAs, and mixes (level and mute control)
 * - Main LR output control
 * - Real-time NRPN feedback from console
 * - Support for up to 48 input channels, 8 DCAs, 12 mixes
 *
 * Connection:
 * - Connect to the SQ console's IP address on port 51325
 * - Configure MIDI channel on the console (default: channel 1)
 * - Set NRPN Fader Law to "Linear Taper" for high-resolution control
 *
 * Copyright (c) 2024 PIXILAB Technologies AB, Sweden (http://pixilab.se).
 * All Rights Reserved.
 */

import {NetworkTCP} from "system/Network";
import {Driver} from "system_lib/Driver";
import * as Meta from "system_lib/Metadata";
import {property, min, max, callable, parameter, driver} from "system_lib/Metadata";

/**
 * Represents a channel strip with level and mute control
 */
class ChannelStrip {
	private _level: number = -85;
	private _mute: boolean = false;

	constructor(
		private owner: AllenHeath_SQ,
		private index: number,
		private nrpnLevelMSB: number,
		private nrpnLevelLSB: number,
		private nrpnMuteMSB: number,
		private nrpnMuteLSB: number
	) {}

	@property("Fader level in dB (-85 to +10)")
	@min(-85)
	@max(10)
	get level(): number {
		return this._level;
	}

	set level(value: number) {
		if (value < -85 || value > 10) {
			console.warn(`Level must be between -85 and +10 dB`);
			return;
		}

		// Convert dB to 14-bit NRPN value (0-16383)
		const range = 10 - (-85); // 95 dB range
		const normalizedLevel = (value - (-85)) / range;
		const nrpnValue = Math.round(normalizedLevel * 16383);

		this.owner.sendNRPN(this.nrpnLevelMSB, this.nrpnLevelLSB, nrpnValue);
		this._level = value;
	}

	@property("Mute state")
	get mute(): boolean {
		return this._mute;
	}

	set mute(value: boolean) {
		const nrpnValue = value ? 1 : 0;
		this.owner.sendNRPN(this.nrpnMuteMSB, this.nrpnMuteLSB, nrpnValue);
		this._mute = value;
	}

	/**
	 * Update level from feedback (internal use)
	 */
	updateLevel(levelDB: number): void {
		this._level = levelDB;
		this.owner.changed(`channel[${this.index}].level`);
	}

	/**
	 * Update mute from feedback (internal use)
	 */
	updateMute(muted: boolean): void {
		this._mute = muted;
		this.owner.changed(`channel[${this.index}].mute`);
	}
}

@driver('NetworkTCP', { port: 51325 })
export class AllenHeath_SQ extends Driver<NetworkTCP> {

	private midiChannel: number = 0; // MIDI channel 1 (0-indexed)
	private currentScene: number = 1;

	// Indexed properties for channels, DCAs, and mixes
	public readonly channel: {[index: number]: ChannelStrip};
	public readonly dca: {[index: number]: ChannelStrip};
	public readonly mix: {[index: number]: ChannelStrip};

	// Main LR output
	private _lrLevel: number = -85;
	private _lrMute: boolean = false;

	// NRPN state machine for parsing incoming messages
	private nrpnMSB: number = -1;
	private nrpnLSB: number = -1;
	private nrpnDataMSB: number = -1;
	private nrpnDataLSB: number = -1;

	// Receive buffer for MIDI messages
	private receiveBuffer: number[] = [];

	constructor(private socket: NetworkTCP) {
		super(socket);

		// Initialize indexed properties using indexedProperty helper
		this.channel = this.indexedProperty("channel", ChannelStrip);
		this.dca = this.indexedProperty("dca", ChannelStrip);
		this.mix = this.indexedProperty("mix", ChannelStrip);

		// Initialize channels (48 input channels) using push()
		// Note: Blocks uses 0-based indexing, so channel[0] = mixer channel 1
		for (let i = 0; i < 48; i++) {
			this.channel.push(new ChannelStrip(
				this,
				i,              // 0-based index for array access
				0x4F,           // Level MSB
				i,              // Level LSB (0-47 for channels 1-48)
				0,              // Mute MSB
				i               // Mute LSB
			));
		}

		// Initialize DCAs (8 DCA groups) using push()
		// Note: Blocks uses 0-based indexing, so dca[0] = DCA 1
		for (let i = 0; i < 8; i++) {
			this.dca.push(new ChannelStrip(
				this,
				i,              // 0-based index for array access
				0x4F,           // Level MSB
				0x20 + i,       // Level LSB (0x20-0x27 for DCA 1-8)
				2,              // Mute MSB
				i               // Mute LSB (0-7)
			));
		}

		// Initialize Mixes (12 Mix/AUX outputs) using push()
		// Note: Blocks uses 0-based indexing, so mix[0] = Mix 1
		for (let i = 0; i < 12; i++) {
			this.mix.push(new ChannelStrip(
				this,
				i,              // 0-based index for array access
				0x4F,           // Level MSB
				0x31 + i,       // Level LSB (0x31-0x3C for Mix 1-12)
				1,              // Mute MSB
				0x31 + i        // Mute LSB
			));
		}

		// Subscribe to connection events
		socket.subscribe('connect', (sender, message) => {
			if (socket.connected) {
				this.onConnected();
			}
		});

		// Subscribe to binary data for MIDI messages
		socket.subscribe('bytesReceived', (sender, message) => {
			this.onDataReceived(message.rawData);
		});

		// Enable automatic connection management with raw bytes mode for MIDI binary protocol
		socket.autoConnect(true);

		// If already connected when driver loads, initialize now
		if (socket.connected) {
			this.onConnected();
		}
	}

	/**
	 * Called when connection is established
	 */
	private onConnected(): void {
		console.info("Connected to Allen & Heath SQ console");
	}

	/**
	 * Get the current scene number
	 */
	@property("Current scene number (1-500)")
	@min(1)
	@max(500)
	public get scene(): number {
		return this.currentScene;
	}

	/**
	 * Recall a scene on the console
	 */
	public set scene(value: number) {
		if (value >= 1 && value <= 500) {
			this.currentScene = value;
			this.recallScene(value);
		}
	}

	/**
	 * MIDI channel (1-16)
	 */
	@property("MIDI channel (1-16, must match console setting)")
	@min(1)
	@max(16)
	public set midiCh(value: number) {
		this.midiChannel = value - 1; // Convert to 0-indexed
	}

	public get midiCh(): number {
		return this.midiChannel + 1; // Return 1-indexed
	}

	/**
	 * Main LR output level
	 */
	@property("Main LR output level in dB (-85 to +10)")
	@min(-85)
	@max(10)
	public get lrLevel(): number {
		return this._lrLevel;
	}

	public set lrLevel(value: number) {
		if (value < -85 || value > 10) {
			console.warn("Level must be between -85 and +10 dB");
			return;
		}

		// Convert dB to 14-bit NRPN value
		const range = 10 - (-85);
		const normalizedLevel = (value - (-85)) / range;
		const nrpnValue = Math.round(normalizedLevel * 16383);

		console.info(`Set Main LR level to ${value.toFixed(1)} dB`);
		this.sendNRPN(0x4F, 0x30, nrpnValue);
		this._lrLevel = value;
	}

	/**
	 * Main LR output mute
	 */
	@property("Main LR output mute state")
	public get lrMute(): boolean {
		return this._lrMute;
	}

	public set lrMute(value: boolean) {
		const nrpnValue = value ? 1 : 0;
		console.info("Set Main LR mute to " + value);
		this.sendNRPN(1, 0x30, nrpnValue);
		this._lrMute = value;
	}

	/**
	 * Recall a scene by number (1-500)
	 */
	@callable("Recall a scene")
	@parameter("Scene number (1-500)")
	public recallScene(sceneNumber: number): void {
		if (sceneNumber < 1 || sceneNumber > 500) {
			console.warn("Scene number must be between 1 and 500");
			return;
		}

		// Convert scene number to MIDI format
		const midiScene = sceneNumber - 1;
		const bank = Math.floor(midiScene / 128);
		const program = midiScene % 128;

		// Send Bank Select MSB + Program Change
		const bankSelectMSB = [0xB0 | this.midiChannel, 0x00, bank];
		const programChange = [0xC0 | this.midiChannel, program];
		const combined = bankSelectMSB.concat(programChange);

		console.info("Recall scene " + sceneNumber);
		this.sendMIDI(combined);

		this.currentScene = sceneNumber;
		this.changed("scene");
	}

	/**
	 * Send NRPN (Non-Registered Parameter Number) message
	 */
	public sendNRPN(nrpnMSB: number, nrpnLSB: number, value: number): void {
		const dataMSB = (value >> 7) & 0x7F;
		const dataLSB = value & 0x7F;

		// Combine all 4 NRPN messages into a single packet
		const nrpnMessages = [
			// NRPN MSB (CC 99)
			0xB0 | this.midiChannel, 0x63, nrpnMSB & 0x7F,
			// NRPN LSB (CC 98)
			0xB0 | this.midiChannel, 0x62, nrpnLSB & 0x7F,
			// Data Entry MSB (CC 6)
			0xB0 | this.midiChannel, 0x06, dataMSB,
			// Data Entry LSB (CC 38)
			0xB0 | this.midiChannel, 0x26, dataLSB
		];

		this.sendMIDI(nrpnMessages);
	}

	/**
	 * Send raw MIDI message
	 */
	private sendMIDI(bytes: number[]): void {
		try {
			this.socket.sendBytes(bytes);
		} catch (error) {
			console.error("Failed to send MIDI data:", error);
		}
	}

	/**
	 * Handle received binary MIDI data
	 */
	private onDataReceived(data: any): void {
		if (data && data.length) {
			for (let i = 0; i < data.length; i++) {
				const byte = data[i] & 0xFF;
				this.processMIDIByte(byte);
			}
		}
	}

	/**
	 * Process a single MIDI byte
	 */
	private processMIDIByte(byte: number): void {
		// Status byte (MSB set)
		if (byte & 0x80) {
			const status = byte & 0xF0;
			const channel = byte & 0x0F;

			// Only process messages on our MIDI channel
			if (channel !== this.midiChannel) {
				return;
			}

			this.receiveBuffer = [byte];

			// Determine expected message length
			switch (status) {
				case 0x80: // Note Off
				case 0x90: // Note On
				case 0xA0: // Aftertouch
				case 0xB0: // Control Change
				case 0xE0: // Pitch Bend
					// 3-byte messages
					break;
				case 0xC0: // Program Change
				case 0xD0: // Channel Pressure
					// 2-byte messages
					break;
			}
		} else {
			// Data byte
			this.receiveBuffer.push(byte);

			// Process complete messages
			if (this.receiveBuffer.length >= 3) {
				const status = this.receiveBuffer[0] & 0xF0;

				if (status === 0xB0) {
					// Control Change - could be NRPN
					this.processControlChange(this.receiveBuffer[1], this.receiveBuffer[2]);
				} else if (status === 0xC0 && this.receiveBuffer.length >= 2) {
					// Program Change - scene recall
					this.processProgramChange(this.receiveBuffer[1]);
				}

				this.receiveBuffer = [];
			} else if (this.receiveBuffer.length >= 2) {
				const status = this.receiveBuffer[0] & 0xF0;

				if (status === 0xC0) {
					// Program Change (2-byte message)
					this.processProgramChange(this.receiveBuffer[1]);
					this.receiveBuffer = [];
				}
			}
		}
	}

	/**
	 * Process Control Change message (for NRPN)
	 */
	private processControlChange(cc: number, value: number): void {
		switch (cc) {
			case 0x63: // NRPN MSB
				this.nrpnMSB = value;
				break;
			case 0x62: // NRPN LSB
				this.nrpnLSB = value;
				break;
			case 0x06: // Data Entry MSB
				this.nrpnDataMSB = value;
				break;
			case 0x26: // Data Entry LSB
				this.nrpnDataLSB = value;
				this.processNRPN();
				break;
		}
	}

	/**
	 * Process complete NRPN message
	 */
	private processNRPN(): void {
		if (this.nrpnMSB < 0 || this.nrpnLSB < 0 || this.nrpnDataMSB < 0 || this.nrpnDataLSB < 0) {
			return;
		}

		const nrpnValue = (this.nrpnDataMSB << 7) | this.nrpnDataLSB;

		// Channel/DCA/Mix/LR fader levels: MSB = 0x4F (79)
		if (this.nrpnMSB === 0x4F) {
			const levelDB = ((nrpnValue / 16383) * 95) - 85;

			// Channel levels: LSB = 0-47 for channels 1-48
			if (this.nrpnLSB < 48) {
				const channelIndex = this.nrpnLSB; // 0-based index for array (channel[0] = Ch 1)
				console.info(`Channel ${channelIndex + 1} level feedback: ${levelDB.toFixed(1)} dB`);
				this.channel[channelIndex].updateLevel(levelDB);
			}
			// DCA levels: LSB = 0x20-0x27 (32-39) for DCA 1-8
			else if (this.nrpnLSB >= 0x20 && this.nrpnLSB <= 0x27) {
				const dcaIndex = this.nrpnLSB - 0x20; // 0-based index for array (dca[0] = DCA 1)
				console.info(`DCA ${dcaIndex + 1} level feedback: ${levelDB.toFixed(1)} dB`);
				this.dca[dcaIndex].updateLevel(levelDB);
			}
			// Main LR level: LSB = 0x30 (48)
			else if (this.nrpnLSB === 0x30) {
				console.info(`Main LR level feedback: ${levelDB.toFixed(1)} dB`);
				this._lrLevel = levelDB;
				this.changed('lrLevel');
			}
			// Mix levels: LSB = 0x31-0x3C (49-60) for Mix 1-12
			else if (this.nrpnLSB >= 0x31 && this.nrpnLSB <= 0x3C) {
				const mixIndex = this.nrpnLSB - 0x31; // 0-based index for array (mix[0] = Mix 1)
				console.info(`Mix ${mixIndex + 1} level feedback: ${levelDB.toFixed(1)} dB`);
				this.mix[mixIndex].updateLevel(levelDB);
			}
		}
		// Channel mutes: MSB = 0, LSB = channel (0-47)
		else if (this.nrpnMSB === 0 && this.nrpnLSB < 48) {
			const channelIndex = this.nrpnLSB; // 0-based index for array
			const muted = nrpnValue > 0;
			console.info(`Channel ${channelIndex + 1} mute feedback: ${muted}`);
			this.channel[channelIndex].updateMute(muted);
		}
		// Main LR and Mix mutes: MSB = 1
		else if (this.nrpnMSB === 1) {
			const muted = nrpnValue > 0;

			// Main LR mute: LSB = 0x30 (48)
			if (this.nrpnLSB === 0x30) {
				console.info(`Main LR mute feedback: ${muted}`);
				this._lrMute = muted;
				this.changed('lrMute');
			}
			// Mix mutes: LSB = 0x31-0x3C (49-60) for Mix 1-12
			else if (this.nrpnLSB >= 0x31 && this.nrpnLSB <= 0x3C) {
				const mixIndex = this.nrpnLSB - 0x31; // 0-based index for array
				console.info(`Mix ${mixIndex + 1} mute feedback: ${muted}`);
				this.mix[mixIndex].updateMute(muted);
			}
		}
		// DCA mutes: MSB = 2, LSB = DCA (0-7)
		else if (this.nrpnMSB === 2 && this.nrpnLSB < 8) {
			const dcaIndex = this.nrpnLSB; // 0-based index for array
			const muted = nrpnValue > 0;
			console.info(`DCA ${dcaIndex + 1} mute feedback: ${muted}`);
			this.dca[dcaIndex].updateMute(muted);
		}

		// Reset NRPN state
		this.nrpnMSB = -1;
		this.nrpnLSB = -1;
		this.nrpnDataMSB = -1;
		this.nrpnDataLSB = -1;
	}

	/**
	 * Process Program Change message (scene recall)
	 */
	private processProgramChange(program: number): void {
		// Scene recall feedback from console
		console.log("Program change received:", program);
	}
}
