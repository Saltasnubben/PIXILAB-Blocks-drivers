/**
 * Driver for Allen & Heath SQ series mixing consoles (SQ5, SQ6, SQ7).
 *
 * Uses MIDI over TCP/IP for control and feedback.
 *
 * Features:
 * - Scene recall (1-500 scenes)
 * - Channel fader level control with NRPN (-85dB to +10dB)
 * - Channel mute control
 * - Real-time feedback from console
 * - Support for up to 48 input channels
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

@Meta.driver('NetworkTCP', { port: 51325 })
export class AllenHeath_SQ extends Driver<NetworkTCP> {

	private midiChannel: number = 0; // MIDI channel 1 (0-indexed)

	// Current state tracking
	private currentScene: number = 1;
	private channelLevels: {[channel: number]: number} = {}; // Channel -> level in dB
	private channelMutes: {[channel: number]: boolean} = {}; // Channel -> mute state
	private dcaMutes: {[dca: number]: boolean} = {}; // DCA -> mute state

	// NRPN state machine for parsing incoming messages
	private nrpnMSB: number = -1;
	private nrpnLSB: number = -1;
	private nrpnDataMSB: number = -1;
	private nrpnDataLSB: number = -1;

	// Receive buffer for MIDI messages
	private receiveBuffer: number[] = [];

	constructor(private socket: NetworkTCP) {
		super(socket);
		console.warn("AllenHeath_SQ: Constructor started");

		// Initialize default channel states
		for (let i = 1; i <= 48; i++) {
			this.channelLevels[i] = -85; // Default to minimum
			this.channelMutes[i] = false;
		}

		// Initialize DCA mute states
		for (let i = 1; i <= 8; i++) {
			this.dcaMutes[i] = false;
		}

		console.warn("AllenHeath_SQ: Subscribing to connection events");
		// Subscribe to connection events
		socket.subscribe('connect', (sender, message) => {
			console.warn("AllenHeath_SQ: Connect event fired, socket.connected:", socket.connected);
			if (socket.connected) {
				this.onConnected();
			}
		});

		socket.subscribe('textReceived', (sender, message) => {
			// message IS the text directly, not an object with .text property
			console.warn("AllenHeath_SQ: textReceived event, data length:", message.length);
			this.onDataReceived(message);
		});

		// Enable automatic connection management
		console.warn("AllenHeath_SQ: Calling socket.autoConnect()");
		socket.autoConnect();

		// If already connected when driver loads, initialize now
		console.warn("AllenHeath_SQ: Checking if already connected, socket.connected:", socket.connected);
		if (socket.connected) {
			console.warn("AllenHeath_SQ: Already connected at startup");
			this.onConnected();
		}
		console.warn("AllenHeath_SQ: Constructor completed");
	}

	/**
	 * Called when connection is established
	 */
	private onConnected(): void {
		console.warn("AllenHeath_SQ: onConnected() called - Connected to Allen & Heath SQ console");
	}

	/**
	 * Get the current scene number
	 */
	@Meta.property("Current scene number (1-500)")
	@Meta.min(1)
	@Meta.max(500)
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
	@Meta.property("MIDI channel (1-16, must match console setting)")
	@Meta.min(1)
	@Meta.max(16)
	public set midiCh(value: number) {
		this.midiChannel = value - 1; // Convert to 0-indexed
	}

	public get midiCh(): number {
		return this.midiChannel + 1; // Return 1-indexed
	}

	/**
	 * Recall a scene by number (1-500)
	 */
	@Meta.callable("Recall a scene")
	@Meta.parameter("Scene number (1-500)")
	public recallScene(sceneNumber: number): void {
		if (sceneNumber < 1 || sceneNumber > 500) {
			console.warn("Scene number must be between 1 and 500");
			return;
		}

		console.warn("AllenHeath_SQ: Recalling scene", sceneNumber);

		// Convert scene number to MIDI format
		// SQ counts from 1, MIDI from 0
		const midiScene = sceneNumber - 1;
		const bank = Math.floor(midiScene / 128);
		const program = midiScene % 128;

		console.warn("AllenHeath_SQ: Scene MIDI values - bank:", bank, "program:", program);

		// Send all messages in one packet like PacketSender does
		// Bank Select MSB (CC 0) + Program Change
		const bankSelectMSB = [0xB0 | this.midiChannel, 0x00, bank];
		const programChange = [0xC0 | this.midiChannel, program];

		// Combine into single message
		const combined = bankSelectMSB.concat(programChange);

		console.warn("AllenHeath_SQ: Sending MIDI bytes:",
			combined.map(b => {
				const hex = b.toString(16).toUpperCase();
				return '0x' + (hex.length === 1 ? '0' + hex : hex);
			}).join(' '));

		this.sendMIDI(combined);

		this.currentScene = sceneNumber;
		this.changed("scene");
	}

	/**
	 * Set channel fader level in dB
	 */
	@Meta.callable("Set channel fader level")
	@Meta.parameter("Channel number (1-48)")
	@Meta.parameter("Level in dB (-85 to +10)")
	public setChannelLevel(channel: number, levelDB: number): void {
		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return;
		}

		if (levelDB < -85 || levelDB > 10) {
			console.warn("Level must be between -85 and +10 dB");
			return;
		}

		// Convert dB to NRPN value (0-16383)
		// Linear scale: -85dB = 0, +10dB = 16383
		const nrpnValue = Math.round(((levelDB + 85) / 95) * 16383);

		// NRPN MSB and LSB for channel fader
		// Input channels: NRPN MSB = 0, LSB = channel (0-47)
		const nrpnMSB = 0;
		const nrpnLSB = channel - 1;

		this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

		this.channelLevels[channel] = levelDB;
		this.changed(`ch${channel}Level`);
	}

	/**
	 * Get channel fader level in dB
	 */
	@Meta.callable("Get channel fader level")
	@Meta.parameter("Channel number (1-48)")
	public getChannelLevel(channel: number): number {
		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return -85;
		}
		return this.channelLevels[channel] !== undefined ? this.channelLevels[channel] : -85;
	}

	/**
	 * Set channel mute state
	 */
	@Meta.callable("Set channel mute")
	@Meta.parameter("Channel number (1-48)")
	@Meta.parameter("Mute state (true = muted)")
	public setChannelMute(channel: number, mute: boolean): void {
		console.warn("AllenHeath_SQ: setChannelMute called with channel:", channel, "type:", typeof channel, "mute:", mute, "type:", typeof mute);

		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return;
		}

		// NRPN for channel mute: MSB = 0, LSB = channel (0-47)
		const nrpnMSB = 0;
		const nrpnLSB = channel - 1;
		const nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted

		console.warn("AllenHeath_SQ: Sending mute NRPN - MSB:", nrpnMSB, "LSB:", nrpnLSB, "Value:", nrpnValue);
		this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

		this.channelMutes[channel] = mute;
		this.changed(`ch${channel}Mute`);
	}

	/**
	 * Get channel mute state
	 */
	@Meta.callable("Get channel mute state")
	@Meta.parameter("Channel number (1-48)")
	public getChannelMute(channel: number): boolean {
		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return false;
		}
		return this.channelMutes[channel] !== undefined ? this.channelMutes[channel] : false;
	}

	/**
	 * Toggle channel mute
	 */
	@Meta.callable("Toggle channel mute")
	@Meta.parameter("Channel number (1-48)")
	public toggleChannelMute(channel: number): void {
		const currentMute = this.getChannelMute(channel);
		this.setChannelMute(channel, !currentMute);
	}

	/**
	 * Set DCA mute state
	 */
	@Meta.callable("Set DCA mute")
	@Meta.parameter("DCA number (1-8)")
	@Meta.parameter("Mute state (true = muted)")
	public setDCAMute(dca: number, mute: boolean): void {
		console.warn("AllenHeath_SQ: setDCAMute called with DCA:", dca, "type:", typeof dca, "mute:", mute, "type:", typeof mute);

		if (dca < 1 || dca > 8) {
			console.warn("DCA must be between 1 and 8");
			return;
		}

		// NRPN for DCA mute: MSB = 2, LSB = DCA (0-7)
		const nrpnMSB = 2;
		const nrpnLSB = dca - 1;
		const nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted

		console.warn("AllenHeath_SQ: Sending DCA mute NRPN - MSB:", nrpnMSB, "LSB:", nrpnLSB, "Value:", nrpnValue);
		this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

		this.dcaMutes[dca] = mute;
		this.changed(`dca${dca}Mute`);
	}

	/**
	 * Get DCA mute state
	 */
	@Meta.callable("Get DCA mute state")
	@Meta.parameter("DCA number (1-8)")
	public getDCAMute(dca: number): boolean {
		if (dca < 1 || dca > 8) {
			console.warn("DCA must be between 1 and 8");
			return false;
		}
		return this.dcaMutes[dca] !== undefined ? this.dcaMutes[dca] : false;
	}

	/**
	 * Toggle DCA mute
	 */
	@Meta.callable("Toggle DCA mute")
	@Meta.parameter("DCA number (1-8)")
	public toggleDCAMute(dca: number): void {
		const currentMute = this.getDCAMute(dca);
		this.setDCAMute(dca, !currentMute);
	}

	/**
	 * Fade channel to a specific level over time
	 */
	@Meta.callable("Fade channel level")
	@Meta.parameter("Channel number (1-48)")
	@Meta.parameter("Target level in dB (-85 to +10)")
	@Meta.parameter("Fade time in seconds")
	public fadeChannel(channel: number, targetDB: number, fadeSeconds: number): void {
		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return;
		}

		const startLevel = this.getChannelLevel(channel);
		const steps = Math.max(10, Math.floor(fadeSeconds * 10)); // 10 updates per second
		const stepSize = (targetDB - startLevel) / steps;
		const stepDelay = (fadeSeconds * 1000) / steps;

		let currentStep = 0;

		const fadeInterval = setInterval(() => {
			currentStep++;
			const newLevel = startLevel + (stepSize * currentStep);

			if (currentStep >= steps) {
				this.setChannelLevel(channel, targetDB);
				clearInterval(fadeInterval);
			} else {
				this.setChannelLevel(channel, newLevel);
			}
		}, stepDelay);
	}

	/**
	 * Send NRPN (Non-Registered Parameter Number) message
	 */
	private sendNRPN(nrpnMSB: number, nrpnLSB: number, value: number): void {
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
			console.warn("AllenHeath_SQ: sendMIDI called with", bytes.length, "bytes");
			console.warn("AllenHeath_SQ: Raw byte values:", bytes.join(', '));

			console.warn("AllenHeath_SQ: Sending via socket.sendBytes, connected:", this.socket.connected);
			this.socket.sendBytes(bytes);
			console.warn("AllenHeath_SQ: sendBytes completed");
		} catch (error) {
			console.error("AllenHeath_SQ: Failed to send MIDI data:", error);
		}
	}

	/**
	 * Handle received text data (MIDI is binary, received as text)
	 */
	private onDataReceived(data: any): void {
		// Convert data to string if needed
		const text = typeof data === 'string' ? data : String(data);

		// Convert text to byte array
		for (let i = 0; i < text.length; i++) {
			const byte = text.charCodeAt(i) & 0xFF;
			this.processMIDIByte(byte);
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
					// 3-byte messages - will receive 2 more data bytes
					break;
				case 0xC0: // Program Change
				case 0xD0: // Channel Pressure
					// 2-byte messages - will receive 1 more data byte
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

		// Input channel fader: MSB = 0, LSB = channel (0-47)
		if (this.nrpnMSB === 0 && this.nrpnLSB < 48) {
			const channel = this.nrpnLSB + 1;
			const levelDB = ((nrpnValue / 16383) * 95) - 85;
			this.channelLevels[channel] = levelDB;
			this.changed(`ch${channel}Level`);
		}
		// Channel mute: MSB = 1, LSB = channel (0-47)
		else if (this.nrpnMSB === 1 && this.nrpnLSB < 48) {
			const channel = this.nrpnLSB + 1;
			const muted = nrpnValue > 8000; // Threshold for mute
			this.channelMutes[channel] = muted;
			this.changed(`ch${channel}Mute`);
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
		// Scene recall - we'd need to track bank select messages too
		// For now, just update if it's in the current bank
		console.log("Program change received:", program);
	}
}
