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
	private dcaLevels: {[dca: number]: number} = {}; // DCA -> level in dB
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

		// Initialize DCA states
		for (let i = 1; i <= 8; i++) {
			this.dcaLevels[i] = -85; // Default to minimum
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

		// Subscribe to binary data for MIDI messages
		socket.subscribe('bytesReceived', (sender, message) => {
			console.warn("AllenHeath_SQ: bytesReceived event, data length:", message.rawData.length);
			this.onDataReceived(message.rawData);
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

	// ========== DCA Level Properties ==========

	@Meta.property("DCA 1 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca1Level(): number { return this.dcaLevels[1] !== undefined ? this.dcaLevels[1] : -85; }
	public set dca1Level(value: number) { this.setDCALevel(1, value); }

	@Meta.property("DCA 2 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca2Level(): number { return this.dcaLevels[2] !== undefined ? this.dcaLevels[2] : -85; }
	public set dca2Level(value: number) { this.setDCALevel(2, value); }

	@Meta.property("DCA 3 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca3Level(): number { return this.dcaLevels[3] !== undefined ? this.dcaLevels[3] : -85; }
	public set dca3Level(value: number) { this.setDCALevel(3, value); }

	@Meta.property("DCA 4 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca4Level(): number { return this.dcaLevels[4] !== undefined ? this.dcaLevels[4] : -85; }
	public set dca4Level(value: number) { this.setDCALevel(4, value); }

	@Meta.property("DCA 5 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca5Level(): number { return this.dcaLevels[5] !== undefined ? this.dcaLevels[5] : -85; }
	public set dca5Level(value: number) { this.setDCALevel(5, value); }

	@Meta.property("DCA 6 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca6Level(): number { return this.dcaLevels[6] !== undefined ? this.dcaLevels[6] : -85; }
	public set dca6Level(value: number) { this.setDCALevel(6, value); }

	@Meta.property("DCA 7 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca7Level(): number { return this.dcaLevels[7] !== undefined ? this.dcaLevels[7] : -85; }
	public set dca7Level(value: number) { this.setDCALevel(7, value); }

	@Meta.property("DCA 8 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get dca8Level(): number { return this.dcaLevels[8] !== undefined ? this.dcaLevels[8] : -85; }
	public set dca8Level(value: number) { this.setDCALevel(8, value); }

	// ========== DCA Mute Properties ==========

	@Meta.property("DCA 1 mute state")
	public get dca1Mute(): boolean { return this.dcaMutes[1] !== undefined ? this.dcaMutes[1] : false; }
	public set dca1Mute(value: boolean) { this.setDCAMute(1, value); }

	@Meta.property("DCA 2 mute state")
	public get dca2Mute(): boolean { return this.dcaMutes[2] !== undefined ? this.dcaMutes[2] : false; }
	public set dca2Mute(value: boolean) { this.setDCAMute(2, value); }

	@Meta.property("DCA 3 mute state")
	public get dca3Mute(): boolean { return this.dcaMutes[3] !== undefined ? this.dcaMutes[3] : false; }
	public set dca3Mute(value: boolean) { this.setDCAMute(3, value); }

	@Meta.property("DCA 4 mute state")
	public get dca4Mute(): boolean { return this.dcaMutes[4] !== undefined ? this.dcaMutes[4] : false; }
	public set dca4Mute(value: boolean) { this.setDCAMute(4, value); }

	@Meta.property("DCA 5 mute state")
	public get dca5Mute(): boolean { return this.dcaMutes[5] !== undefined ? this.dcaMutes[5] : false; }
	public set dca5Mute(value: boolean) { this.setDCAMute(5, value); }

	@Meta.property("DCA 6 mute state")
	public get dca6Mute(): boolean { return this.dcaMutes[6] !== undefined ? this.dcaMutes[6] : false; }
	public set dca6Mute(value: boolean) { this.setDCAMute(6, value); }

	@Meta.property("DCA 7 mute state")
	public get dca7Mute(): boolean { return this.dcaMutes[7] !== undefined ? this.dcaMutes[7] : false; }
	public set dca7Mute(value: boolean) { this.setDCAMute(7, value); }

	@Meta.property("DCA 8 mute state")
	public get dca8Mute(): boolean { return this.dcaMutes[8] !== undefined ? this.dcaMutes[8] : false; }
	public set dca8Mute(value: boolean) { this.setDCAMute(8, value); }
	// ========== Channel Level Properties ==========

	@Meta.property("Channel 1 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch1Level(): number { return this.channelLevels[1] !== undefined ? this.channelLevels[1] : -85; }
	public set ch1Level(value: number) { this.setChannelLevel(1, value); }

	@Meta.property("Channel 2 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch2Level(): number { return this.channelLevels[2] !== undefined ? this.channelLevels[2] : -85; }
	public set ch2Level(value: number) { this.setChannelLevel(2, value); }

	@Meta.property("Channel 3 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch3Level(): number { return this.channelLevels[3] !== undefined ? this.channelLevels[3] : -85; }
	public set ch3Level(value: number) { this.setChannelLevel(3, value); }

	@Meta.property("Channel 4 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch4Level(): number { return this.channelLevels[4] !== undefined ? this.channelLevels[4] : -85; }
	public set ch4Level(value: number) { this.setChannelLevel(4, value); }

	@Meta.property("Channel 5 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch5Level(): number { return this.channelLevels[5] !== undefined ? this.channelLevels[5] : -85; }
	public set ch5Level(value: number) { this.setChannelLevel(5, value); }

	@Meta.property("Channel 6 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch6Level(): number { return this.channelLevels[6] !== undefined ? this.channelLevels[6] : -85; }
	public set ch6Level(value: number) { this.setChannelLevel(6, value); }

	@Meta.property("Channel 7 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch7Level(): number { return this.channelLevels[7] !== undefined ? this.channelLevels[7] : -85; }
	public set ch7Level(value: number) { this.setChannelLevel(7, value); }

	@Meta.property("Channel 8 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch8Level(): number { return this.channelLevels[8] !== undefined ? this.channelLevels[8] : -85; }
	public set ch8Level(value: number) { this.setChannelLevel(8, value); }

	@Meta.property("Channel 9 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch9Level(): number { return this.channelLevels[9] !== undefined ? this.channelLevels[9] : -85; }
	public set ch9Level(value: number) { this.setChannelLevel(9, value); }

	@Meta.property("Channel 10 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch10Level(): number { return this.channelLevels[10] !== undefined ? this.channelLevels[10] : -85; }
	public set ch10Level(value: number) { this.setChannelLevel(10, value); }

	@Meta.property("Channel 11 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch11Level(): number { return this.channelLevels[11] !== undefined ? this.channelLevels[11] : -85; }
	public set ch11Level(value: number) { this.setChannelLevel(11, value); }

	@Meta.property("Channel 12 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch12Level(): number { return this.channelLevels[12] !== undefined ? this.channelLevels[12] : -85; }
	public set ch12Level(value: number) { this.setChannelLevel(12, value); }

	@Meta.property("Channel 13 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch13Level(): number { return this.channelLevels[13] !== undefined ? this.channelLevels[13] : -85; }
	public set ch13Level(value: number) { this.setChannelLevel(13, value); }

	@Meta.property("Channel 14 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch14Level(): number { return this.channelLevels[14] !== undefined ? this.channelLevels[14] : -85; }
	public set ch14Level(value: number) { this.setChannelLevel(14, value); }

	@Meta.property("Channel 15 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch15Level(): number { return this.channelLevels[15] !== undefined ? this.channelLevels[15] : -85; }
	public set ch15Level(value: number) { this.setChannelLevel(15, value); }

	@Meta.property("Channel 16 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch16Level(): number { return this.channelLevels[16] !== undefined ? this.channelLevels[16] : -85; }
	public set ch16Level(value: number) { this.setChannelLevel(16, value); }

	@Meta.property("Channel 17 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch17Level(): number { return this.channelLevels[17] !== undefined ? this.channelLevels[17] : -85; }
	public set ch17Level(value: number) { this.setChannelLevel(17, value); }

	@Meta.property("Channel 18 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch18Level(): number { return this.channelLevels[18] !== undefined ? this.channelLevels[18] : -85; }
	public set ch18Level(value: number) { this.setChannelLevel(18, value); }

	@Meta.property("Channel 19 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch19Level(): number { return this.channelLevels[19] !== undefined ? this.channelLevels[19] : -85; }
	public set ch19Level(value: number) { this.setChannelLevel(19, value); }

	@Meta.property("Channel 20 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch20Level(): number { return this.channelLevels[20] !== undefined ? this.channelLevels[20] : -85; }
	public set ch20Level(value: number) { this.setChannelLevel(20, value); }

	@Meta.property("Channel 21 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch21Level(): number { return this.channelLevels[21] !== undefined ? this.channelLevels[21] : -85; }
	public set ch21Level(value: number) { this.setChannelLevel(21, value); }

	@Meta.property("Channel 22 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch22Level(): number { return this.channelLevels[22] !== undefined ? this.channelLevels[22] : -85; }
	public set ch22Level(value: number) { this.setChannelLevel(22, value); }

	@Meta.property("Channel 23 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch23Level(): number { return this.channelLevels[23] !== undefined ? this.channelLevels[23] : -85; }
	public set ch23Level(value: number) { this.setChannelLevel(23, value); }

	@Meta.property("Channel 24 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch24Level(): number { return this.channelLevels[24] !== undefined ? this.channelLevels[24] : -85; }
	public set ch24Level(value: number) { this.setChannelLevel(24, value); }

	@Meta.property("Channel 25 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch25Level(): number { return this.channelLevels[25] !== undefined ? this.channelLevels[25] : -85; }
	public set ch25Level(value: number) { this.setChannelLevel(25, value); }

	@Meta.property("Channel 26 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch26Level(): number { return this.channelLevels[26] !== undefined ? this.channelLevels[26] : -85; }
	public set ch26Level(value: number) { this.setChannelLevel(26, value); }

	@Meta.property("Channel 27 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch27Level(): number { return this.channelLevels[27] !== undefined ? this.channelLevels[27] : -85; }
	public set ch27Level(value: number) { this.setChannelLevel(27, value); }

	@Meta.property("Channel 28 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch28Level(): number { return this.channelLevels[28] !== undefined ? this.channelLevels[28] : -85; }
	public set ch28Level(value: number) { this.setChannelLevel(28, value); }

	@Meta.property("Channel 29 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch29Level(): number { return this.channelLevels[29] !== undefined ? this.channelLevels[29] : -85; }
	public set ch29Level(value: number) { this.setChannelLevel(29, value); }

	@Meta.property("Channel 30 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch30Level(): number { return this.channelLevels[30] !== undefined ? this.channelLevels[30] : -85; }
	public set ch30Level(value: number) { this.setChannelLevel(30, value); }

	@Meta.property("Channel 31 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch31Level(): number { return this.channelLevels[31] !== undefined ? this.channelLevels[31] : -85; }
	public set ch31Level(value: number) { this.setChannelLevel(31, value); }

	@Meta.property("Channel 32 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch32Level(): number { return this.channelLevels[32] !== undefined ? this.channelLevels[32] : -85; }
	public set ch32Level(value: number) { this.setChannelLevel(32, value); }

	@Meta.property("Channel 33 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch33Level(): number { return this.channelLevels[33] !== undefined ? this.channelLevels[33] : -85; }
	public set ch33Level(value: number) { this.setChannelLevel(33, value); }

	@Meta.property("Channel 34 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch34Level(): number { return this.channelLevels[34] !== undefined ? this.channelLevels[34] : -85; }
	public set ch34Level(value: number) { this.setChannelLevel(34, value); }

	@Meta.property("Channel 35 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch35Level(): number { return this.channelLevels[35] !== undefined ? this.channelLevels[35] : -85; }
	public set ch35Level(value: number) { this.setChannelLevel(35, value); }

	@Meta.property("Channel 36 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch36Level(): number { return this.channelLevels[36] !== undefined ? this.channelLevels[36] : -85; }
	public set ch36Level(value: number) { this.setChannelLevel(36, value); }

	@Meta.property("Channel 37 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch37Level(): number { return this.channelLevels[37] !== undefined ? this.channelLevels[37] : -85; }
	public set ch37Level(value: number) { this.setChannelLevel(37, value); }

	@Meta.property("Channel 38 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch38Level(): number { return this.channelLevels[38] !== undefined ? this.channelLevels[38] : -85; }
	public set ch38Level(value: number) { this.setChannelLevel(38, value); }

	@Meta.property("Channel 39 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch39Level(): number { return this.channelLevels[39] !== undefined ? this.channelLevels[39] : -85; }
	public set ch39Level(value: number) { this.setChannelLevel(39, value); }

	@Meta.property("Channel 40 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch40Level(): number { return this.channelLevels[40] !== undefined ? this.channelLevels[40] : -85; }
	public set ch40Level(value: number) { this.setChannelLevel(40, value); }

	@Meta.property("Channel 41 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch41Level(): number { return this.channelLevels[41] !== undefined ? this.channelLevels[41] : -85; }
	public set ch41Level(value: number) { this.setChannelLevel(41, value); }

	@Meta.property("Channel 42 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch42Level(): number { return this.channelLevels[42] !== undefined ? this.channelLevels[42] : -85; }
	public set ch42Level(value: number) { this.setChannelLevel(42, value); }

	@Meta.property("Channel 43 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch43Level(): number { return this.channelLevels[43] !== undefined ? this.channelLevels[43] : -85; }
	public set ch43Level(value: number) { this.setChannelLevel(43, value); }

	@Meta.property("Channel 44 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch44Level(): number { return this.channelLevels[44] !== undefined ? this.channelLevels[44] : -85; }
	public set ch44Level(value: number) { this.setChannelLevel(44, value); }

	@Meta.property("Channel 45 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch45Level(): number { return this.channelLevels[45] !== undefined ? this.channelLevels[45] : -85; }
	public set ch45Level(value: number) { this.setChannelLevel(45, value); }

	@Meta.property("Channel 46 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch46Level(): number { return this.channelLevels[46] !== undefined ? this.channelLevels[46] : -85; }
	public set ch46Level(value: number) { this.setChannelLevel(46, value); }

	@Meta.property("Channel 47 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch47Level(): number { return this.channelLevels[47] !== undefined ? this.channelLevels[47] : -85; }
	public set ch47Level(value: number) { this.setChannelLevel(47, value); }

	@Meta.property("Channel 48 fader level (-85 to +10 dB)")
	@Meta.min(-85)
	@Meta.max(10)
	public get ch48Level(): number { return this.channelLevels[48] !== undefined ? this.channelLevels[48] : -85; }
	public set ch48Level(value: number) { this.setChannelLevel(48, value); }

	// ========== Channel Mute Properties ==========

	@Meta.property("Channel 1 mute state")
	public get ch1Mute(): boolean { return this.channelMutes[1] !== undefined ? this.channelMutes[1] : false; }
	public set ch1Mute(value: boolean) { this.setChannelMute(1, value); }

	@Meta.property("Channel 2 mute state")
	public get ch2Mute(): boolean { return this.channelMutes[2] !== undefined ? this.channelMutes[2] : false; }
	public set ch2Mute(value: boolean) { this.setChannelMute(2, value); }

	@Meta.property("Channel 3 mute state")
	public get ch3Mute(): boolean { return this.channelMutes[3] !== undefined ? this.channelMutes[3] : false; }
	public set ch3Mute(value: boolean) { this.setChannelMute(3, value); }

	@Meta.property("Channel 4 mute state")
	public get ch4Mute(): boolean { return this.channelMutes[4] !== undefined ? this.channelMutes[4] : false; }
	public set ch4Mute(value: boolean) { this.setChannelMute(4, value); }

	@Meta.property("Channel 5 mute state")
	public get ch5Mute(): boolean { return this.channelMutes[5] !== undefined ? this.channelMutes[5] : false; }
	public set ch5Mute(value: boolean) { this.setChannelMute(5, value); }

	@Meta.property("Channel 6 mute state")
	public get ch6Mute(): boolean { return this.channelMutes[6] !== undefined ? this.channelMutes[6] : false; }
	public set ch6Mute(value: boolean) { this.setChannelMute(6, value); }

	@Meta.property("Channel 7 mute state")
	public get ch7Mute(): boolean { return this.channelMutes[7] !== undefined ? this.channelMutes[7] : false; }
	public set ch7Mute(value: boolean) { this.setChannelMute(7, value); }

	@Meta.property("Channel 8 mute state")
	public get ch8Mute(): boolean { return this.channelMutes[8] !== undefined ? this.channelMutes[8] : false; }
	public set ch8Mute(value: boolean) { this.setChannelMute(8, value); }

	@Meta.property("Channel 9 mute state")
	public get ch9Mute(): boolean { return this.channelMutes[9] !== undefined ? this.channelMutes[9] : false; }
	public set ch9Mute(value: boolean) { this.setChannelMute(9, value); }

	@Meta.property("Channel 10 mute state")
	public get ch10Mute(): boolean { return this.channelMutes[10] !== undefined ? this.channelMutes[10] : false; }
	public set ch10Mute(value: boolean) { this.setChannelMute(10, value); }

	@Meta.property("Channel 11 mute state")
	public get ch11Mute(): boolean { return this.channelMutes[11] !== undefined ? this.channelMutes[11] : false; }
	public set ch11Mute(value: boolean) { this.setChannelMute(11, value); }

	@Meta.property("Channel 12 mute state")
	public get ch12Mute(): boolean { return this.channelMutes[12] !== undefined ? this.channelMutes[12] : false; }
	public set ch12Mute(value: boolean) { this.setChannelMute(12, value); }

	@Meta.property("Channel 13 mute state")
	public get ch13Mute(): boolean { return this.channelMutes[13] !== undefined ? this.channelMutes[13] : false; }
	public set ch13Mute(value: boolean) { this.setChannelMute(13, value); }

	@Meta.property("Channel 14 mute state")
	public get ch14Mute(): boolean { return this.channelMutes[14] !== undefined ? this.channelMutes[14] : false; }
	public set ch14Mute(value: boolean) { this.setChannelMute(14, value); }

	@Meta.property("Channel 15 mute state")
	public get ch15Mute(): boolean { return this.channelMutes[15] !== undefined ? this.channelMutes[15] : false; }
	public set ch15Mute(value: boolean) { this.setChannelMute(15, value); }

	@Meta.property("Channel 16 mute state")
	public get ch16Mute(): boolean { return this.channelMutes[16] !== undefined ? this.channelMutes[16] : false; }
	public set ch16Mute(value: boolean) { this.setChannelMute(16, value); }

	@Meta.property("Channel 17 mute state")
	public get ch17Mute(): boolean { return this.channelMutes[17] !== undefined ? this.channelMutes[17] : false; }
	public set ch17Mute(value: boolean) { this.setChannelMute(17, value); }

	@Meta.property("Channel 18 mute state")
	public get ch18Mute(): boolean { return this.channelMutes[18] !== undefined ? this.channelMutes[18] : false; }
	public set ch18Mute(value: boolean) { this.setChannelMute(18, value); }

	@Meta.property("Channel 19 mute state")
	public get ch19Mute(): boolean { return this.channelMutes[19] !== undefined ? this.channelMutes[19] : false; }
	public set ch19Mute(value: boolean) { this.setChannelMute(19, value); }

	@Meta.property("Channel 20 mute state")
	public get ch20Mute(): boolean { return this.channelMutes[20] !== undefined ? this.channelMutes[20] : false; }
	public set ch20Mute(value: boolean) { this.setChannelMute(20, value); }

	@Meta.property("Channel 21 mute state")
	public get ch21Mute(): boolean { return this.channelMutes[21] !== undefined ? this.channelMutes[21] : false; }
	public set ch21Mute(value: boolean) { this.setChannelMute(21, value); }

	@Meta.property("Channel 22 mute state")
	public get ch22Mute(): boolean { return this.channelMutes[22] !== undefined ? this.channelMutes[22] : false; }
	public set ch22Mute(value: boolean) { this.setChannelMute(22, value); }

	@Meta.property("Channel 23 mute state")
	public get ch23Mute(): boolean { return this.channelMutes[23] !== undefined ? this.channelMutes[23] : false; }
	public set ch23Mute(value: boolean) { this.setChannelMute(23, value); }

	@Meta.property("Channel 24 mute state")
	public get ch24Mute(): boolean { return this.channelMutes[24] !== undefined ? this.channelMutes[24] : false; }
	public set ch24Mute(value: boolean) { this.setChannelMute(24, value); }

	@Meta.property("Channel 25 mute state")
	public get ch25Mute(): boolean { return this.channelMutes[25] !== undefined ? this.channelMutes[25] : false; }
	public set ch25Mute(value: boolean) { this.setChannelMute(25, value); }

	@Meta.property("Channel 26 mute state")
	public get ch26Mute(): boolean { return this.channelMutes[26] !== undefined ? this.channelMutes[26] : false; }
	public set ch26Mute(value: boolean) { this.setChannelMute(26, value); }

	@Meta.property("Channel 27 mute state")
	public get ch27Mute(): boolean { return this.channelMutes[27] !== undefined ? this.channelMutes[27] : false; }
	public set ch27Mute(value: boolean) { this.setChannelMute(27, value); }

	@Meta.property("Channel 28 mute state")
	public get ch28Mute(): boolean { return this.channelMutes[28] !== undefined ? this.channelMutes[28] : false; }
	public set ch28Mute(value: boolean) { this.setChannelMute(28, value); }

	@Meta.property("Channel 29 mute state")
	public get ch29Mute(): boolean { return this.channelMutes[29] !== undefined ? this.channelMutes[29] : false; }
	public set ch29Mute(value: boolean) { this.setChannelMute(29, value); }

	@Meta.property("Channel 30 mute state")
	public get ch30Mute(): boolean { return this.channelMutes[30] !== undefined ? this.channelMutes[30] : false; }
	public set ch30Mute(value: boolean) { this.setChannelMute(30, value); }

	@Meta.property("Channel 31 mute state")
	public get ch31Mute(): boolean { return this.channelMutes[31] !== undefined ? this.channelMutes[31] : false; }
	public set ch31Mute(value: boolean) { this.setChannelMute(31, value); }

	@Meta.property("Channel 32 mute state")
	public get ch32Mute(): boolean { return this.channelMutes[32] !== undefined ? this.channelMutes[32] : false; }
	public set ch32Mute(value: boolean) { this.setChannelMute(32, value); }

	@Meta.property("Channel 33 mute state")
	public get ch33Mute(): boolean { return this.channelMutes[33] !== undefined ? this.channelMutes[33] : false; }
	public set ch33Mute(value: boolean) { this.setChannelMute(33, value); }

	@Meta.property("Channel 34 mute state")
	public get ch34Mute(): boolean { return this.channelMutes[34] !== undefined ? this.channelMutes[34] : false; }
	public set ch34Mute(value: boolean) { this.setChannelMute(34, value); }

	@Meta.property("Channel 35 mute state")
	public get ch35Mute(): boolean { return this.channelMutes[35] !== undefined ? this.channelMutes[35] : false; }
	public set ch35Mute(value: boolean) { this.setChannelMute(35, value); }

	@Meta.property("Channel 36 mute state")
	public get ch36Mute(): boolean { return this.channelMutes[36] !== undefined ? this.channelMutes[36] : false; }
	public set ch36Mute(value: boolean) { this.setChannelMute(36, value); }

	@Meta.property("Channel 37 mute state")
	public get ch37Mute(): boolean { return this.channelMutes[37] !== undefined ? this.channelMutes[37] : false; }
	public set ch37Mute(value: boolean) { this.setChannelMute(37, value); }

	@Meta.property("Channel 38 mute state")
	public get ch38Mute(): boolean { return this.channelMutes[38] !== undefined ? this.channelMutes[38] : false; }
	public set ch38Mute(value: boolean) { this.setChannelMute(38, value); }

	@Meta.property("Channel 39 mute state")
	public get ch39Mute(): boolean { return this.channelMutes[39] !== undefined ? this.channelMutes[39] : false; }
	public set ch39Mute(value: boolean) { this.setChannelMute(39, value); }

	@Meta.property("Channel 40 mute state")
	public get ch40Mute(): boolean { return this.channelMutes[40] !== undefined ? this.channelMutes[40] : false; }
	public set ch40Mute(value: boolean) { this.setChannelMute(40, value); }

	@Meta.property("Channel 41 mute state")
	public get ch41Mute(): boolean { return this.channelMutes[41] !== undefined ? this.channelMutes[41] : false; }
	public set ch41Mute(value: boolean) { this.setChannelMute(41, value); }

	@Meta.property("Channel 42 mute state")
	public get ch42Mute(): boolean { return this.channelMutes[42] !== undefined ? this.channelMutes[42] : false; }
	public set ch42Mute(value: boolean) { this.setChannelMute(42, value); }

	@Meta.property("Channel 43 mute state")
	public get ch43Mute(): boolean { return this.channelMutes[43] !== undefined ? this.channelMutes[43] : false; }
	public set ch43Mute(value: boolean) { this.setChannelMute(43, value); }

	@Meta.property("Channel 44 mute state")
	public get ch44Mute(): boolean { return this.channelMutes[44] !== undefined ? this.channelMutes[44] : false; }
	public set ch44Mute(value: boolean) { this.setChannelMute(44, value); }

	@Meta.property("Channel 45 mute state")
	public get ch45Mute(): boolean { return this.channelMutes[45] !== undefined ? this.channelMutes[45] : false; }
	public set ch45Mute(value: boolean) { this.setChannelMute(45, value); }

	@Meta.property("Channel 46 mute state")
	public get ch46Mute(): boolean { return this.channelMutes[46] !== undefined ? this.channelMutes[46] : false; }
	public set ch46Mute(value: boolean) { this.setChannelMute(46, value); }

	@Meta.property("Channel 47 mute state")
	public get ch47Mute(): boolean { return this.channelMutes[47] !== undefined ? this.channelMutes[47] : false; }
	public set ch47Mute(value: boolean) { this.setChannelMute(47, value); }

	@Meta.property("Channel 48 mute state")
	public get ch48Mute(): boolean { return this.channelMutes[48] !== undefined ? this.channelMutes[48] : false; }
	public set ch48Mute(value: boolean) { this.setChannelMute(48, value); }

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
		console.warn("AllenHeath_SQ: setChannelLevel called with channel:", channel, "level:", levelDB);

		if (channel < 1 || channel > 48) {
			console.warn("Channel must be between 1 and 48");
			return;
		}

		if (levelDB < -85 || levelDB > 10) {
			console.warn("Level must be between -85 and +10 dB");
			return;
		}

		// NRPN for channel level: MSB = 0x4F (79), LSB = 0x00-0x2F (0-47 for channels 1-48)
		const nrpnMSB = 0x4F;
		const nrpnLSB = channel - 1;

		// Convert dB to 14-bit value (0-16383)
		// -85dB = 0, +10dB = 16383
		const range = 10 - (-85); // 95 dB range
		const normalizedLevel = (levelDB - (-85)) / range;
		const nrpnValue = Math.round(normalizedLevel * 16383);

		console.warn("AllenHeath_SQ: Sending channel level NRPN - MSB:", nrpnMSB, "LSB:", nrpnLSB, "Value:", nrpnValue);
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
	 * Set DCA fader level in dB
	 */
	@Meta.callable("Set DCA fader level")
	@Meta.parameter("DCA number (1-8)")
	@Meta.parameter("Level in dB (-85 to +10)")
	public setDCALevel(dca: number, levelDB: number): void {
		console.warn("AllenHeath_SQ: setDCALevel called with DCA:", dca, "level:", levelDB);

		if (dca < 1 || dca > 8) {
			console.warn("DCA must be between 1 and 8");
			return;
		}

		if (levelDB < -85 || levelDB > 10) {
			console.warn("Level must be between -85 and +10 dB");
			return;
		}

		// NRPN for DCA level: MSB = 0x4F (79), LSB = 0x20-0x27 (32-39 for DCA 1-8)
		const nrpnMSB = 0x4F;
		const nrpnLSB = 0x20 + (dca - 1);

		// Convert dB to 14-bit value (0-16383)
		// -85dB = 0, +10dB = 16383
		const range = 10 - (-85); // 95 dB range
		const normalizedLevel = (levelDB - (-85)) / range;
		const nrpnValue = Math.round(normalizedLevel * 16383);

		console.warn("AllenHeath_SQ: Sending DCA level NRPN - MSB:", nrpnMSB, "LSB:", nrpnLSB, "Value:", nrpnValue);
		this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

		this.dcaLevels[dca] = levelDB;
		this.changed(`dca${dca}Level`);
	}

	/**
	 * Get DCA fader level in dB
	 */
	@Meta.callable("Get DCA fader level")
	@Meta.parameter("DCA number (1-8)")
	public getDCALevel(dca: number): number {
		if (dca < 1 || dca > 8) {
			console.warn("DCA must be between 1 and 8");
			return -85;
		}
		return this.dcaLevels[dca] !== undefined ? this.dcaLevels[dca] : -85;
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
	 * Handle received binary MIDI data
	 */
	private onDataReceived(data: any): void {
		console.warn("AllenHeath_SQ: onDataReceived called, data type:", typeof data, "length:", data ? data.length : 'null');

		// Process each byte in the received data
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
