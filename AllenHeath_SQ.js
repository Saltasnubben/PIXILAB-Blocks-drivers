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

var __extends = (this && this.__extends) || (function () {
	var extendStatics = function (d, b) {
		extendStatics = Object.setPrototypeOf ||
			({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
			function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
		return extendStatics(d, b);
	};
	return function (d, b) {
		extendStatics(d, b);
		function __() { this.constructor = d; }
		d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
})();

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
};

var __metadata = (this && this.__metadata) || function (k, v) {
	if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};

define(["require", "exports", "system_lib/Driver", "system_lib/Metadata"], function (require, exports, Driver_1, Meta) {
	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AllenHeath_SQ = void 0;

	var AllenHeath_SQ = /** @class */ (function (_super) {
		__extends(AllenHeath_SQ, _super);

		function AllenHeath_SQ(socket) {
			var _this = _super.call(this, socket) || this;
			_this.socket = socket;

			_this.midiChannel = 0; // MIDI channel 1 (0-indexed)

			// Current state tracking
			_this.currentScene = 1;
			_this.channelLevels = new Map(); // Channel -> level in dB
			_this.channelMutes = new Map(); // Channel -> mute state

			// NRPN state machine for parsing incoming messages
			_this.nrpnMSB = -1;
			_this.nrpnLSB = -1;
			_this.nrpnDataMSB = -1;
			_this.nrpnDataLSB = -1;

			// Receive buffer for MIDI messages
			_this.receiveBuffer = [];

			// Initialize default channel states
			for (var i = 1; i <= 48; i++) {
				_this.channelLevels.set(i, -85); // Default to minimum
				_this.channelMutes.set(i, false);
			}

			// Configure socket for binary data
			socket.autoConnect(true);
			socket.enableWakeOnLAN();

			// Request initial state after connection
			socket.subscribe('connect', function (sender, message) {
				_this.onConnected();
			});

			socket.subscribe('textReceived', function (sender, message) {
				// Handle raw bytes (MIDI is binary protocol)
				_this.onDataReceived(message.text);
			});

			socket.subscribe('bytesReceived', function (sender, message) {
				// Handle binary MIDI data
				if (message.rawData) {
					_this.onBytesReceived(message.rawData);
				}
			});

			return _this;
		}

		/**
		 * Called when connection is established
		 */
		AllenHeath_SQ.prototype.onConnected = function () {
			console.log("Connected to Allen & Heath SQ console");
		};

		Object.defineProperty(AllenHeath_SQ.prototype, "scene", {
			/**
			 * Get the current scene number
			 */
			get: function () {
				return this.currentScene;
			},
			/**
			 * Recall a scene on the console
			 */
			set: function (value) {
				if (value >= 1 && value <= 500) {
					this.currentScene = value;
					this.recallScene(value);
				}
			},
			enumerable: true,
			configurable: true
		});

		Object.defineProperty(AllenHeath_SQ.prototype, "midiCh", {
			get: function () {
				return this.midiChannel + 1; // Return 1-indexed
			},
			/**
			 * MIDI channel (1-16)
			 */
			set: function (value) {
				this.midiChannel = value - 1; // Convert to 0-indexed
			},
			enumerable: true,
			configurable: true
		});

		/**
		 * Recall a scene by number (1-500)
		 */
		AllenHeath_SQ.prototype.recallScene = function (sceneNumber) {
			if (sceneNumber < 1 || sceneNumber > 500) {
				console.warn("Scene number must be between 1 and 500");
				return;
			}

			// Convert scene number to MIDI format
			// SQ counts from 1, MIDI from 0
			var midiScene = sceneNumber - 1;
			var bank = Math.floor(midiScene / 128);
			var program = midiScene % 128;

			// Bank Select MSB (CC 0)
			this.sendMIDI([0xB0 | this.midiChannel, 0x00, bank]);

			// Bank Select LSB (CC 32)
			this.sendMIDI([0xB0 | this.midiChannel, 0x20, 0x00]);

			// Program Change
			this.sendMIDI([0xC0 | this.midiChannel, program]);

			this.currentScene = sceneNumber;
			this.changed("scene");
		};

		/**
		 * Set channel fader level in dB
		 */
		AllenHeath_SQ.prototype.setChannelLevel = function (channel, levelDB) {
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
			var nrpnValue = Math.round(((levelDB + 85) / 95) * 16383);

			// NRPN MSB and LSB for channel fader
			// Input channels: NRPN MSB = 0, LSB = channel (0-47)
			var nrpnMSB = 0;
			var nrpnLSB = channel - 1;

			this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

			this.channelLevels.set(channel, levelDB);
			this.changed("ch" + channel + "Level");
		};

		/**
		 * Get channel fader level in dB
		 */
		AllenHeath_SQ.prototype.getChannelLevel = function (channel) {
			if (channel < 1 || channel > 48) {
				console.warn("Channel must be between 1 and 48");
				return -85;
			}
			return this.channelLevels.get(channel) || -85;
		};

		/**
		 * Set channel mute state
		 */
		AllenHeath_SQ.prototype.setChannelMute = function (channel, mute) {
			if (channel < 1 || channel > 48) {
				console.warn("Channel must be between 1 and 48");
				return;
			}

			// NRPN for channel mute: MSB = 1, LSB = channel (0-47)
			var nrpnMSB = 1;
			var nrpnLSB = channel - 1;
			var nrpnValue = mute ? 16383 : 0; // 16383 = muted, 0 = unmuted

			this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);

			this.channelMutes.set(channel, mute);
			this.changed("ch" + channel + "Mute");
		};

		/**
		 * Get channel mute state
		 */
		AllenHeath_SQ.prototype.getChannelMute = function (channel) {
			if (channel < 1 || channel > 48) {
				console.warn("Channel must be between 1 and 48");
				return false;
			}
			return this.channelMutes.get(channel) || false;
		};

		/**
		 * Toggle channel mute
		 */
		AllenHeath_SQ.prototype.toggleChannelMute = function (channel) {
			var currentMute = this.getChannelMute(channel);
			this.setChannelMute(channel, !currentMute);
		};

		/**
		 * Fade channel to a specific level over time
		 */
		AllenHeath_SQ.prototype.fadeChannel = function (channel, targetDB, fadeSeconds) {
			var _this = this;
			if (channel < 1 || channel > 48) {
				console.warn("Channel must be between 1 and 48");
				return;
			}

			var startLevel = this.getChannelLevel(channel);
			var steps = Math.max(10, Math.floor(fadeSeconds * 10)); // 10 updates per second
			var stepSize = (targetDB - startLevel) / steps;
			var stepDelay = (fadeSeconds * 1000) / steps;

			var currentStep = 0;

			var fadeInterval = setInterval(function () {
				currentStep++;
				var newLevel = startLevel + (stepSize * currentStep);

				if (currentStep >= steps) {
					_this.setChannelLevel(channel, targetDB);
					clearInterval(fadeInterval);
				} else {
					_this.setChannelLevel(channel, newLevel);
				}
			}, stepDelay);
		};

		/**
		 * Send NRPN (Non-Registered Parameter Number) message
		 */
		AllenHeath_SQ.prototype.sendNRPN = function (nrpnMSB, nrpnLSB, value) {
			var dataMSB = (value >> 7) & 0x7F;
			var dataLSB = value & 0x7F;

			// NRPN MSB (CC 99)
			this.sendMIDI([0xB0 | this.midiChannel, 0x63, nrpnMSB & 0x7F]);

			// NRPN LSB (CC 98)
			this.sendMIDI([0xB0 | this.midiChannel, 0x62, nrpnLSB & 0x7F]);

			// Data Entry MSB (CC 6)
			this.sendMIDI([0xB0 | this.midiChannel, 0x06, dataMSB]);

			// Data Entry LSB (CC 38)
			this.sendMIDI([0xB0 | this.midiChannel, 0x26, dataLSB]);
		};

		/**
		 * Send raw MIDI message
		 */
		AllenHeath_SQ.prototype.sendMIDI = function (bytes) {
			try {
				// Convert numbers to string of bytes for sending
				var data = '';
				for (var _i = 0, bytes_1 = bytes; _i < bytes_1.length; _i++) {
					var byte = bytes_1[_i];
					data += String.fromCharCode(byte & 0xFF);
				}
				this.socket.sendText(data);
			} catch (error) {
				console.error("Failed to send MIDI data:", error);
			}
		};

		/**
		 * Handle received text data (MIDI is binary, received as text)
		 */
		AllenHeath_SQ.prototype.onDataReceived = function (data) {
			// Convert text to byte array
			for (var i = 0; i < data.length; i++) {
				var byte = data.charCodeAt(i) & 0xFF;
				this.processMIDIByte(byte);
			}
		};

		/**
		 * Handle received binary data
		 */
		AllenHeath_SQ.prototype.onBytesReceived = function (data) {
			var bytes = new Uint8Array(data);
			for (var _i = 0, bytes_2 = bytes; _i < bytes_2.length; _i++) {
				var byte = bytes_2[_i];
				this.processMIDIByte(byte);
			}
		};

		/**
		 * Process a single MIDI byte
		 */
		AllenHeath_SQ.prototype.processMIDIByte = function (byte) {
			// Status byte (MSB set)
			if (byte & 0x80) {
				var status_1 = byte & 0xF0;
				var channel = byte & 0x0F;

				// Only process messages on our MIDI channel
				if (channel !== this.midiChannel) {
					return;
				}

				this.receiveBuffer = [byte];

				// Determine expected message length
				switch (status_1) {
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
					var status_2 = this.receiveBuffer[0] & 0xF0;

					if (status_2 === 0xB0) {
						// Control Change - could be NRPN
						this.processControlChange(this.receiveBuffer[1], this.receiveBuffer[2]);
					} else if (status_2 === 0xC0 && this.receiveBuffer.length >= 2) {
						// Program Change - scene recall
						this.processProgramChange(this.receiveBuffer[1]);
					}

					this.receiveBuffer = [];
				} else if (this.receiveBuffer.length >= 2) {
					var status_3 = this.receiveBuffer[0] & 0xF0;

					if (status_3 === 0xC0) {
						// Program Change (2-byte message)
						this.processProgramChange(this.receiveBuffer[1]);
						this.receiveBuffer = [];
					}
				}
			}
		};

		/**
		 * Process Control Change message (for NRPN)
		 */
		AllenHeath_SQ.prototype.processControlChange = function (cc, value) {
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
		};

		/**
		 * Process complete NRPN message
		 */
		AllenHeath_SQ.prototype.processNRPN = function () {
			if (this.nrpnMSB < 0 || this.nrpnLSB < 0 || this.nrpnDataMSB < 0 || this.nrpnDataLSB < 0) {
				return;
			}

			var nrpnValue = (this.nrpnDataMSB << 7) | this.nrpnDataLSB;

			// Input channel fader: MSB = 0, LSB = channel (0-47)
			if (this.nrpnMSB === 0 && this.nrpnLSB < 48) {
				var channel = this.nrpnLSB + 1;
				var levelDB = ((nrpnValue / 16383) * 95) - 85;
				this.channelLevels.set(channel, levelDB);
				this.changed("ch" + channel + "Level");
			}
			// Channel mute: MSB = 1, LSB = channel (0-47)
			else if (this.nrpnMSB === 1 && this.nrpnLSB < 48) {
				var channel = this.nrpnLSB + 1;
				var muted = nrpnValue > 8000; // Threshold for mute
				this.channelMutes.set(channel, muted);
				this.changed("ch" + channel + "Mute");
			}

			// Reset NRPN state
			this.nrpnMSB = -1;
			this.nrpnLSB = -1;
			this.nrpnDataMSB = -1;
			this.nrpnDataLSB = -1;
		};

		/**
		 * Process Program Change message (scene recall)
		 */
		AllenHeath_SQ.prototype.processProgramChange = function (program) {
			// Scene recall - we'd need to track bank select messages too
			// For now, just update if it's in the current bank
			console.log("Program change received:", program);
		};

		__decorate([
			Meta.property("Current scene number (1-500)"),
			Meta.min(1),
			Meta.max(500),
			__metadata("design:type", Number),
			__metadata("design:paramtypes", [Number])
		], AllenHeath_SQ.prototype, "scene", null);

		__decorate([
			Meta.property("MIDI channel (1-16, must match console setting)"),
			Meta.min(1),
			Meta.max(16),
			__metadata("design:type", Number),
			__metadata("design:paramtypes", [Number])
		], AllenHeath_SQ.prototype, "midiCh", null);

		__decorate([
			Meta.callable("Recall a scene"),
			Meta.parameter("Scene number (1-500)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number]),
			__metadata("design:returntype", void 0)
		], AllenHeath_SQ.prototype, "recallScene", null);

		__decorate([
			Meta.callable("Set channel fader level"),
			Meta.parameter("Channel number (1-48)"),
			Meta.parameter("Level in dB (-85 to +10)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number, Number]),
			__metadata("design:returntype", void 0)
		], AllenHeath_SQ.prototype, "setChannelLevel", null);

		__decorate([
			Meta.callable("Get channel fader level"),
			Meta.parameter("Channel number (1-48)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number]),
			__metadata("design:returntype", Number)
		], AllenHeath_SQ.prototype, "getChannelLevel", null);

		__decorate([
			Meta.callable("Set channel mute"),
			Meta.parameter("Channel number (1-48)"),
			Meta.parameter("Mute state (true = muted)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number, Boolean]),
			__metadata("design:returntype", void 0)
		], AllenHeath_SQ.prototype, "setChannelMute", null);

		__decorate([
			Meta.callable("Get channel mute state"),
			Meta.parameter("Channel number (1-48)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number]),
			__metadata("design:returntype", Boolean)
		], AllenHeath_SQ.prototype, "getChannelMute", null);

		__decorate([
			Meta.callable("Toggle channel mute"),
			Meta.parameter("Channel number (1-48)"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number]),
			__metadata("design:returntype", void 0)
		], AllenHeath_SQ.prototype, "toggleChannelMute", null);

		__decorate([
			Meta.callable("Fade channel level"),
			Meta.parameter("Channel number (1-48)"),
			Meta.parameter("Target level in dB (-85 to +10)"),
			Meta.parameter("Fade time in seconds"),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [Number, Number, Number]),
			__metadata("design:returntype", void 0)
		], AllenHeath_SQ.prototype, "fadeChannel", null);

		AllenHeath_SQ = __decorate([
			Meta.driver('NetworkTCP', { port: 51325 }),
			__metadata("design:paramtypes", [Object])
		], AllenHeath_SQ);

		return AllenHeath_SQ;
	}(Driver_1.Driver));

	exports.AllenHeath_SQ = AllenHeath_SQ;
});
