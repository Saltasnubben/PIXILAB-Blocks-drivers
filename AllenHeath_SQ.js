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
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
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
define(["require", "exports", "system_lib/Driver", "system_lib/Metadata"], function (require, exports, Driver_1, Metadata_1) {
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
            _this.channelLevels = {}; // Channel -> level in dB
            _this.channelMutes = {}; // Channel -> mute state
            _this.dcaLevels = {}; // DCA -> level in dB
            _this.dcaMutes = {}; // DCA -> mute state
            // NRPN state machine for parsing incoming messages
            _this.nrpnMSB = -1;
            _this.nrpnLSB = -1;
            _this.nrpnDataMSB = -1;
            _this.nrpnDataLSB = -1;
            // Receive buffer for MIDI messages
            _this.receiveBuffer = [];
            // Polling configuration
            _this.pollInterval = 2000; // Poll every 2 seconds
            _this.pollTimer = null;
            _this.pollChannels = [1, 2, 3, 4]; // Channels to poll for feedback
            _this.pollDCAs = [1, 2]; // DCAs to poll for feedback
            _this.currentPollIndex = 0;
            // Initialize default channel states
            for (var i = 1; i <= 48; i++) {
                _this.channelLevels[i] = -85; // Default to minimum
                _this.channelMutes[i] = false;
            }
            // Initialize DCA states
            for (var i = 1; i <= 8; i++) {
                _this.dcaLevels[i] = -85; // Default to minimum
                _this.dcaMutes[i] = false;
            }
            // Subscribe to connection events
            socket.subscribe('connect', function (sender, message) {
                if (socket.connected) {
                    _this.onConnected();
                }
            });
            // Subscribe to binary data for MIDI messages
            socket.subscribe('bytesReceived', function (sender, message) {
                _this.onDataReceived(message.rawData);
            });
            // Subscribe to disconnection events
            socket.subscribe('finish', function () {
                _this.stopPolling();
            });
            // Enable automatic connection management
            socket.autoConnect();
            // If already connected when driver loads, initialize now
            if (socket.connected) {
                _this.onConnected();
            }
            return _this;
        }
        /**
         * Called when connection is established
         */
        AllenHeath_SQ.prototype.onConnected = function () {
            console.info("Connected to Allen & Heath SQ console");
            this.startPolling();
        };
        /**
         * Start polling for feedback from the desk
         */
        AllenHeath_SQ.prototype.startPolling = function () {
            this.stopPolling(); // Clear any existing timer
            console.info("Starting polling for desk feedback");
            this.pollNext();
        };
        /**
         * Stop polling
         */
        AllenHeath_SQ.prototype.stopPolling = function () {
            if (this.pollTimer) {
                this.pollTimer.cancel();
                this.pollTimer = null;
            }
        };
        /**
         * Poll the next item in rotation
         */
        AllenHeath_SQ.prototype.pollNext = function () {
            var _this = this;
            if (!this.socket.connected) {
                return;
            }
            // Alternate between polling channels and DCAs
            var totalItems = this.pollChannels.length + this.pollDCAs.length;
            if (totalItems === 0) {
                // Nothing to poll, just reschedule
                this.pollTimer = wait(this.pollInterval);
                this.pollTimer.then(function () { return _this.pollNext(); });
                return;
            }
            var index = this.currentPollIndex % totalItems;
            if (index < this.pollChannels.length) {
                // Poll a channel
                var channel = this.pollChannels[index];
                this.queryChannelMute(channel);
                this.queryChannelLevel(channel);
            }
            else {
                // Poll a DCA
                var dcaIndex = index - this.pollChannels.length;
                var dca = this.pollDCAs[dcaIndex];
                this.queryDCAMute(dca);
                this.queryDCALevel(dca);
            }
            this.currentPollIndex++;
            // Schedule next poll
            this.pollTimer = wait(this.pollInterval);
            this.pollTimer.then(function () { return _this.pollNext(); });
        };
        /**
         * Query the current mute state of a channel
         */
        AllenHeath_SQ.prototype.queryChannelMute = function (channel) {
            if (channel < 1 || channel > 48)
                return;
            // Send NRPN query: MSB=0, LSB=channel-1, then Data Increment
            var query = [
                0xB0 | this.midiChannel, 0x63, 0x00, // NRPN MSB = 0
                0xB0 | this.midiChannel, 0x62, channel - 1, // NRPN LSB = channel
                0xB0 | this.midiChannel, 0x60, 0x7F // Data Increment
            ];
            this.sendMIDI(query);
        };
        /**
         * Query the current level of a channel
         */
        AllenHeath_SQ.prototype.queryChannelLevel = function (channel) {
            if (channel < 1 || channel > 48)
                return;
            // Send NRPN query: MSB=0x4F, LSB=channel-1, then Data Increment
            var query = [
                0xB0 | this.midiChannel, 0x63, 0x4F, // NRPN MSB = 0x4F
                0xB0 | this.midiChannel, 0x62, channel - 1, // NRPN LSB = channel
                0xB0 | this.midiChannel, 0x60, 0x7F // Data Increment
            ];
            this.sendMIDI(query);
        };
        /**
         * Query the current mute state of a DCA
         */
        AllenHeath_SQ.prototype.queryDCAMute = function (dca) {
            if (dca < 1 || dca > 8)
                return;
            // Send NRPN query: MSB=2, LSB=dca-1, then Data Increment
            var query = [
                0xB0 | this.midiChannel, 0x63, 0x02, // NRPN MSB = 2
                0xB0 | this.midiChannel, 0x62, dca - 1, // NRPN LSB = dca
                0xB0 | this.midiChannel, 0x60, 0x7F // Data Increment
            ];
            this.sendMIDI(query);
        };
        /**
         * Query the current level of a DCA
         */
        AllenHeath_SQ.prototype.queryDCALevel = function (dca) {
            if (dca < 1 || dca > 8)
                return;
            // Send NRPN query: MSB=0x4F, LSB=0x20+dca-1, then Data Increment
            var query = [
                0xB0 | this.midiChannel, 0x63, 0x4F, // NRPN MSB = 0x4F
                0xB0 | this.midiChannel, 0x62, 0x20 + (dca - 1), // NRPN LSB = 0x20+dca
                0xB0 | this.midiChannel, 0x60, 0x7F // Data Increment
            ];
            this.sendMIDI(query);
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
            enumerable: false,
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
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca1Level", {
            // ========== DCA Level Properties ==========
            get: function () { return this.dcaLevels[1] !== undefined ? this.dcaLevels[1] : -85; },
            set: function (value) { this.setDCALevel(1, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca2Level", {
            get: function () { return this.dcaLevels[2] !== undefined ? this.dcaLevels[2] : -85; },
            set: function (value) { this.setDCALevel(2, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca3Level", {
            get: function () { return this.dcaLevels[3] !== undefined ? this.dcaLevels[3] : -85; },
            set: function (value) { this.setDCALevel(3, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca4Level", {
            get: function () { return this.dcaLevels[4] !== undefined ? this.dcaLevels[4] : -85; },
            set: function (value) { this.setDCALevel(4, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca5Level", {
            get: function () { return this.dcaLevels[5] !== undefined ? this.dcaLevels[5] : -85; },
            set: function (value) { this.setDCALevel(5, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca6Level", {
            get: function () { return this.dcaLevels[6] !== undefined ? this.dcaLevels[6] : -85; },
            set: function (value) { this.setDCALevel(6, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca7Level", {
            get: function () { return this.dcaLevels[7] !== undefined ? this.dcaLevels[7] : -85; },
            set: function (value) { this.setDCALevel(7, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca8Level", {
            get: function () { return this.dcaLevels[8] !== undefined ? this.dcaLevels[8] : -85; },
            set: function (value) { this.setDCALevel(8, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca1Mute", {
            // ========== DCA Mute Properties ==========
            get: function () { return this.dcaMutes[1] !== undefined ? this.dcaMutes[1] : false; },
            set: function (value) { this.setDCAMute(1, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca2Mute", {
            get: function () { return this.dcaMutes[2] !== undefined ? this.dcaMutes[2] : false; },
            set: function (value) { this.setDCAMute(2, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca3Mute", {
            get: function () { return this.dcaMutes[3] !== undefined ? this.dcaMutes[3] : false; },
            set: function (value) { this.setDCAMute(3, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca4Mute", {
            get: function () { return this.dcaMutes[4] !== undefined ? this.dcaMutes[4] : false; },
            set: function (value) { this.setDCAMute(4, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca5Mute", {
            get: function () { return this.dcaMutes[5] !== undefined ? this.dcaMutes[5] : false; },
            set: function (value) { this.setDCAMute(5, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca6Mute", {
            get: function () { return this.dcaMutes[6] !== undefined ? this.dcaMutes[6] : false; },
            set: function (value) { this.setDCAMute(6, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca7Mute", {
            get: function () { return this.dcaMutes[7] !== undefined ? this.dcaMutes[7] : false; },
            set: function (value) { this.setDCAMute(7, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "dca8Mute", {
            get: function () { return this.dcaMutes[8] !== undefined ? this.dcaMutes[8] : false; },
            set: function (value) { this.setDCAMute(8, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch1Level", {
            // ========== Channel Level Properties ==========
            get: function () { return this.channelLevels[1] !== undefined ? this.channelLevels[1] : -85; },
            set: function (value) { this.setChannelLevel(1, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch2Level", {
            get: function () { return this.channelLevels[2] !== undefined ? this.channelLevels[2] : -85; },
            set: function (value) { this.setChannelLevel(2, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch3Level", {
            get: function () { return this.channelLevels[3] !== undefined ? this.channelLevels[3] : -85; },
            set: function (value) { this.setChannelLevel(3, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch4Level", {
            get: function () { return this.channelLevels[4] !== undefined ? this.channelLevels[4] : -85; },
            set: function (value) { this.setChannelLevel(4, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch5Level", {
            get: function () { return this.channelLevels[5] !== undefined ? this.channelLevels[5] : -85; },
            set: function (value) { this.setChannelLevel(5, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch6Level", {
            get: function () { return this.channelLevels[6] !== undefined ? this.channelLevels[6] : -85; },
            set: function (value) { this.setChannelLevel(6, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch7Level", {
            get: function () { return this.channelLevels[7] !== undefined ? this.channelLevels[7] : -85; },
            set: function (value) { this.setChannelLevel(7, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch8Level", {
            get: function () { return this.channelLevels[8] !== undefined ? this.channelLevels[8] : -85; },
            set: function (value) { this.setChannelLevel(8, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch9Level", {
            get: function () { return this.channelLevels[9] !== undefined ? this.channelLevels[9] : -85; },
            set: function (value) { this.setChannelLevel(9, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch10Level", {
            get: function () { return this.channelLevels[10] !== undefined ? this.channelLevels[10] : -85; },
            set: function (value) { this.setChannelLevel(10, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch11Level", {
            get: function () { return this.channelLevels[11] !== undefined ? this.channelLevels[11] : -85; },
            set: function (value) { this.setChannelLevel(11, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch12Level", {
            get: function () { return this.channelLevels[12] !== undefined ? this.channelLevels[12] : -85; },
            set: function (value) { this.setChannelLevel(12, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch13Level", {
            get: function () { return this.channelLevels[13] !== undefined ? this.channelLevels[13] : -85; },
            set: function (value) { this.setChannelLevel(13, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch14Level", {
            get: function () { return this.channelLevels[14] !== undefined ? this.channelLevels[14] : -85; },
            set: function (value) { this.setChannelLevel(14, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch15Level", {
            get: function () { return this.channelLevels[15] !== undefined ? this.channelLevels[15] : -85; },
            set: function (value) { this.setChannelLevel(15, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch16Level", {
            get: function () { return this.channelLevels[16] !== undefined ? this.channelLevels[16] : -85; },
            set: function (value) { this.setChannelLevel(16, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch17Level", {
            get: function () { return this.channelLevels[17] !== undefined ? this.channelLevels[17] : -85; },
            set: function (value) { this.setChannelLevel(17, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch18Level", {
            get: function () { return this.channelLevels[18] !== undefined ? this.channelLevels[18] : -85; },
            set: function (value) { this.setChannelLevel(18, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch19Level", {
            get: function () { return this.channelLevels[19] !== undefined ? this.channelLevels[19] : -85; },
            set: function (value) { this.setChannelLevel(19, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch20Level", {
            get: function () { return this.channelLevels[20] !== undefined ? this.channelLevels[20] : -85; },
            set: function (value) { this.setChannelLevel(20, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch21Level", {
            get: function () { return this.channelLevels[21] !== undefined ? this.channelLevels[21] : -85; },
            set: function (value) { this.setChannelLevel(21, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch22Level", {
            get: function () { return this.channelLevels[22] !== undefined ? this.channelLevels[22] : -85; },
            set: function (value) { this.setChannelLevel(22, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch23Level", {
            get: function () { return this.channelLevels[23] !== undefined ? this.channelLevels[23] : -85; },
            set: function (value) { this.setChannelLevel(23, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch24Level", {
            get: function () { return this.channelLevels[24] !== undefined ? this.channelLevels[24] : -85; },
            set: function (value) { this.setChannelLevel(24, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch25Level", {
            get: function () { return this.channelLevels[25] !== undefined ? this.channelLevels[25] : -85; },
            set: function (value) { this.setChannelLevel(25, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch26Level", {
            get: function () { return this.channelLevels[26] !== undefined ? this.channelLevels[26] : -85; },
            set: function (value) { this.setChannelLevel(26, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch27Level", {
            get: function () { return this.channelLevels[27] !== undefined ? this.channelLevels[27] : -85; },
            set: function (value) { this.setChannelLevel(27, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch28Level", {
            get: function () { return this.channelLevels[28] !== undefined ? this.channelLevels[28] : -85; },
            set: function (value) { this.setChannelLevel(28, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch29Level", {
            get: function () { return this.channelLevels[29] !== undefined ? this.channelLevels[29] : -85; },
            set: function (value) { this.setChannelLevel(29, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch30Level", {
            get: function () { return this.channelLevels[30] !== undefined ? this.channelLevels[30] : -85; },
            set: function (value) { this.setChannelLevel(30, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch31Level", {
            get: function () { return this.channelLevels[31] !== undefined ? this.channelLevels[31] : -85; },
            set: function (value) { this.setChannelLevel(31, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch32Level", {
            get: function () { return this.channelLevels[32] !== undefined ? this.channelLevels[32] : -85; },
            set: function (value) { this.setChannelLevel(32, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch33Level", {
            get: function () { return this.channelLevels[33] !== undefined ? this.channelLevels[33] : -85; },
            set: function (value) { this.setChannelLevel(33, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch34Level", {
            get: function () { return this.channelLevels[34] !== undefined ? this.channelLevels[34] : -85; },
            set: function (value) { this.setChannelLevel(34, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch35Level", {
            get: function () { return this.channelLevels[35] !== undefined ? this.channelLevels[35] : -85; },
            set: function (value) { this.setChannelLevel(35, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch36Level", {
            get: function () { return this.channelLevels[36] !== undefined ? this.channelLevels[36] : -85; },
            set: function (value) { this.setChannelLevel(36, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch37Level", {
            get: function () { return this.channelLevels[37] !== undefined ? this.channelLevels[37] : -85; },
            set: function (value) { this.setChannelLevel(37, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch38Level", {
            get: function () { return this.channelLevels[38] !== undefined ? this.channelLevels[38] : -85; },
            set: function (value) { this.setChannelLevel(38, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch39Level", {
            get: function () { return this.channelLevels[39] !== undefined ? this.channelLevels[39] : -85; },
            set: function (value) { this.setChannelLevel(39, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch40Level", {
            get: function () { return this.channelLevels[40] !== undefined ? this.channelLevels[40] : -85; },
            set: function (value) { this.setChannelLevel(40, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch41Level", {
            get: function () { return this.channelLevels[41] !== undefined ? this.channelLevels[41] : -85; },
            set: function (value) { this.setChannelLevel(41, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch42Level", {
            get: function () { return this.channelLevels[42] !== undefined ? this.channelLevels[42] : -85; },
            set: function (value) { this.setChannelLevel(42, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch43Level", {
            get: function () { return this.channelLevels[43] !== undefined ? this.channelLevels[43] : -85; },
            set: function (value) { this.setChannelLevel(43, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch44Level", {
            get: function () { return this.channelLevels[44] !== undefined ? this.channelLevels[44] : -85; },
            set: function (value) { this.setChannelLevel(44, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch45Level", {
            get: function () { return this.channelLevels[45] !== undefined ? this.channelLevels[45] : -85; },
            set: function (value) { this.setChannelLevel(45, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch46Level", {
            get: function () { return this.channelLevels[46] !== undefined ? this.channelLevels[46] : -85; },
            set: function (value) { this.setChannelLevel(46, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch47Level", {
            get: function () { return this.channelLevels[47] !== undefined ? this.channelLevels[47] : -85; },
            set: function (value) { this.setChannelLevel(47, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch48Level", {
            get: function () { return this.channelLevels[48] !== undefined ? this.channelLevels[48] : -85; },
            set: function (value) { this.setChannelLevel(48, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch1Mute", {
            // ========== Channel Mute Properties ==========
            get: function () { return this.channelMutes[1] !== undefined ? this.channelMutes[1] : false; },
            set: function (value) { this.setChannelMute(1, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch2Mute", {
            get: function () { return this.channelMutes[2] !== undefined ? this.channelMutes[2] : false; },
            set: function (value) { this.setChannelMute(2, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch3Mute", {
            get: function () { return this.channelMutes[3] !== undefined ? this.channelMutes[3] : false; },
            set: function (value) { this.setChannelMute(3, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch4Mute", {
            get: function () { return this.channelMutes[4] !== undefined ? this.channelMutes[4] : false; },
            set: function (value) { this.setChannelMute(4, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch5Mute", {
            get: function () { return this.channelMutes[5] !== undefined ? this.channelMutes[5] : false; },
            set: function (value) { this.setChannelMute(5, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch6Mute", {
            get: function () { return this.channelMutes[6] !== undefined ? this.channelMutes[6] : false; },
            set: function (value) { this.setChannelMute(6, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch7Mute", {
            get: function () { return this.channelMutes[7] !== undefined ? this.channelMutes[7] : false; },
            set: function (value) { this.setChannelMute(7, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch8Mute", {
            get: function () { return this.channelMutes[8] !== undefined ? this.channelMutes[8] : false; },
            set: function (value) { this.setChannelMute(8, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch9Mute", {
            get: function () { return this.channelMutes[9] !== undefined ? this.channelMutes[9] : false; },
            set: function (value) { this.setChannelMute(9, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch10Mute", {
            get: function () { return this.channelMutes[10] !== undefined ? this.channelMutes[10] : false; },
            set: function (value) { this.setChannelMute(10, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch11Mute", {
            get: function () { return this.channelMutes[11] !== undefined ? this.channelMutes[11] : false; },
            set: function (value) { this.setChannelMute(11, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch12Mute", {
            get: function () { return this.channelMutes[12] !== undefined ? this.channelMutes[12] : false; },
            set: function (value) { this.setChannelMute(12, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch13Mute", {
            get: function () { return this.channelMutes[13] !== undefined ? this.channelMutes[13] : false; },
            set: function (value) { this.setChannelMute(13, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch14Mute", {
            get: function () { return this.channelMutes[14] !== undefined ? this.channelMutes[14] : false; },
            set: function (value) { this.setChannelMute(14, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch15Mute", {
            get: function () { return this.channelMutes[15] !== undefined ? this.channelMutes[15] : false; },
            set: function (value) { this.setChannelMute(15, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch16Mute", {
            get: function () { return this.channelMutes[16] !== undefined ? this.channelMutes[16] : false; },
            set: function (value) { this.setChannelMute(16, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch17Mute", {
            get: function () { return this.channelMutes[17] !== undefined ? this.channelMutes[17] : false; },
            set: function (value) { this.setChannelMute(17, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch18Mute", {
            get: function () { return this.channelMutes[18] !== undefined ? this.channelMutes[18] : false; },
            set: function (value) { this.setChannelMute(18, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch19Mute", {
            get: function () { return this.channelMutes[19] !== undefined ? this.channelMutes[19] : false; },
            set: function (value) { this.setChannelMute(19, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch20Mute", {
            get: function () { return this.channelMutes[20] !== undefined ? this.channelMutes[20] : false; },
            set: function (value) { this.setChannelMute(20, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch21Mute", {
            get: function () { return this.channelMutes[21] !== undefined ? this.channelMutes[21] : false; },
            set: function (value) { this.setChannelMute(21, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch22Mute", {
            get: function () { return this.channelMutes[22] !== undefined ? this.channelMutes[22] : false; },
            set: function (value) { this.setChannelMute(22, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch23Mute", {
            get: function () { return this.channelMutes[23] !== undefined ? this.channelMutes[23] : false; },
            set: function (value) { this.setChannelMute(23, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch24Mute", {
            get: function () { return this.channelMutes[24] !== undefined ? this.channelMutes[24] : false; },
            set: function (value) { this.setChannelMute(24, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch25Mute", {
            get: function () { return this.channelMutes[25] !== undefined ? this.channelMutes[25] : false; },
            set: function (value) { this.setChannelMute(25, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch26Mute", {
            get: function () { return this.channelMutes[26] !== undefined ? this.channelMutes[26] : false; },
            set: function (value) { this.setChannelMute(26, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch27Mute", {
            get: function () { return this.channelMutes[27] !== undefined ? this.channelMutes[27] : false; },
            set: function (value) { this.setChannelMute(27, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch28Mute", {
            get: function () { return this.channelMutes[28] !== undefined ? this.channelMutes[28] : false; },
            set: function (value) { this.setChannelMute(28, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch29Mute", {
            get: function () { return this.channelMutes[29] !== undefined ? this.channelMutes[29] : false; },
            set: function (value) { this.setChannelMute(29, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch30Mute", {
            get: function () { return this.channelMutes[30] !== undefined ? this.channelMutes[30] : false; },
            set: function (value) { this.setChannelMute(30, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch31Mute", {
            get: function () { return this.channelMutes[31] !== undefined ? this.channelMutes[31] : false; },
            set: function (value) { this.setChannelMute(31, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch32Mute", {
            get: function () { return this.channelMutes[32] !== undefined ? this.channelMutes[32] : false; },
            set: function (value) { this.setChannelMute(32, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch33Mute", {
            get: function () { return this.channelMutes[33] !== undefined ? this.channelMutes[33] : false; },
            set: function (value) { this.setChannelMute(33, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch34Mute", {
            get: function () { return this.channelMutes[34] !== undefined ? this.channelMutes[34] : false; },
            set: function (value) { this.setChannelMute(34, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch35Mute", {
            get: function () { return this.channelMutes[35] !== undefined ? this.channelMutes[35] : false; },
            set: function (value) { this.setChannelMute(35, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch36Mute", {
            get: function () { return this.channelMutes[36] !== undefined ? this.channelMutes[36] : false; },
            set: function (value) { this.setChannelMute(36, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch37Mute", {
            get: function () { return this.channelMutes[37] !== undefined ? this.channelMutes[37] : false; },
            set: function (value) { this.setChannelMute(37, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch38Mute", {
            get: function () { return this.channelMutes[38] !== undefined ? this.channelMutes[38] : false; },
            set: function (value) { this.setChannelMute(38, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch39Mute", {
            get: function () { return this.channelMutes[39] !== undefined ? this.channelMutes[39] : false; },
            set: function (value) { this.setChannelMute(39, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch40Mute", {
            get: function () { return this.channelMutes[40] !== undefined ? this.channelMutes[40] : false; },
            set: function (value) { this.setChannelMute(40, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch41Mute", {
            get: function () { return this.channelMutes[41] !== undefined ? this.channelMutes[41] : false; },
            set: function (value) { this.setChannelMute(41, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch42Mute", {
            get: function () { return this.channelMutes[42] !== undefined ? this.channelMutes[42] : false; },
            set: function (value) { this.setChannelMute(42, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch43Mute", {
            get: function () { return this.channelMutes[43] !== undefined ? this.channelMutes[43] : false; },
            set: function (value) { this.setChannelMute(43, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch44Mute", {
            get: function () { return this.channelMutes[44] !== undefined ? this.channelMutes[44] : false; },
            set: function (value) { this.setChannelMute(44, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch45Mute", {
            get: function () { return this.channelMutes[45] !== undefined ? this.channelMutes[45] : false; },
            set: function (value) { this.setChannelMute(45, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch46Mute", {
            get: function () { return this.channelMutes[46] !== undefined ? this.channelMutes[46] : false; },
            set: function (value) { this.setChannelMute(46, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch47Mute", {
            get: function () { return this.channelMutes[47] !== undefined ? this.channelMutes[47] : false; },
            set: function (value) { this.setChannelMute(47, value); },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "ch48Mute", {
            get: function () { return this.channelMutes[48] !== undefined ? this.channelMutes[48] : false; },
            set: function (value) { this.setChannelMute(48, value); },
            enumerable: false,
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
            // Send all messages in one packet like PacketSender does
            // Bank Select MSB (CC 0) + Program Change
            var bankSelectMSB = [0xB0 | this.midiChannel, 0x00, bank];
            var programChange = [0xC0 | this.midiChannel, program];
            // Combine into single message
            var combined = bankSelectMSB.concat(programChange);
            console.info("Recall scene " + sceneNumber);
            this.sendMIDI(combined);
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
            // NRPN for channel level: MSB = 0x4F (79), LSB = 0x00-0x2F (0-47 for channels 1-48)
            var nrpnMSB = 0x4F;
            var nrpnLSB = channel - 1;
            // Convert dB to 14-bit value (0-16383)
            // -85dB = 0, +10dB = 16383
            var range = 10 - (-85); // 95 dB range
            var normalizedLevel = (levelDB - (-85)) / range;
            var nrpnValue = Math.round(normalizedLevel * 16383);
            console.info("Set channel ".concat(channel, " level to ").concat(levelDB.toFixed(1), " dB"));
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.channelLevels[channel] = levelDB;
            this.changed("ch".concat(channel, "Level"));
        };
        /**
         * Get channel fader level in dB
         */
        AllenHeath_SQ.prototype.getChannelLevel = function (channel) {
            if (channel < 1 || channel > 48) {
                console.warn("Channel must be between 1 and 48");
                return -85;
            }
            return this.channelLevels[channel] !== undefined ? this.channelLevels[channel] : -85;
        };
        /**
         * Set channel mute state
         */
        AllenHeath_SQ.prototype.setChannelMute = function (channel, mute) {
            if (channel < 1 || channel > 48) {
                console.warn("Channel must be between 1 and 48");
                return;
            }
            // NRPN for channel mute: MSB = 0, LSB = channel (0-47)
            var nrpnMSB = 0;
            var nrpnLSB = channel - 1;
            var nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted
            console.info("Set channel " + channel + " mute to " + mute);
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.channelMutes[channel] = mute;
            this.changed("ch".concat(channel, "Mute"));
        };
        /**
         * Get channel mute state
         */
        AllenHeath_SQ.prototype.getChannelMute = function (channel) {
            if (channel < 1 || channel > 48) {
                console.warn("Channel must be between 1 and 48");
                return false;
            }
            return this.channelMutes[channel] !== undefined ? this.channelMutes[channel] : false;
        };
        /**
         * Toggle channel mute
         */
        AllenHeath_SQ.prototype.toggleChannelMute = function (channel) {
            var currentMute = this.getChannelMute(channel);
            this.setChannelMute(channel, !currentMute);
        };
        /**
         * Set DCA mute state
         */
        AllenHeath_SQ.prototype.setDCAMute = function (dca, mute) {
            if (dca < 1 || dca > 8) {
                console.warn("DCA must be between 1 and 8");
                return;
            }
            // NRPN for DCA mute: MSB = 2, LSB = DCA (0-7)
            var nrpnMSB = 2;
            var nrpnLSB = dca - 1;
            var nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted
            console.info("Set DCA " + dca + " mute to " + mute);
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.dcaMutes[dca] = mute;
            this.changed("dca".concat(dca, "Mute"));
        };
        /**
         * Get DCA mute state
         */
        AllenHeath_SQ.prototype.getDCAMute = function (dca) {
            if (dca < 1 || dca > 8) {
                console.warn("DCA must be between 1 and 8");
                return false;
            }
            return this.dcaMutes[dca] !== undefined ? this.dcaMutes[dca] : false;
        };
        /**
         * Toggle DCA mute
         */
        AllenHeath_SQ.prototype.toggleDCAMute = function (dca) {
            var currentMute = this.getDCAMute(dca);
            this.setDCAMute(dca, !currentMute);
        };
        /**
         * Set DCA fader level in dB
         */
        AllenHeath_SQ.prototype.setDCALevel = function (dca, levelDB) {
            if (dca < 1 || dca > 8) {
                console.warn("DCA must be between 1 and 8");
                return;
            }
            if (levelDB < -85 || levelDB > 10) {
                console.warn("Level must be between -85 and +10 dB");
                return;
            }
            // NRPN for DCA level: MSB = 0x4F (79), LSB = 0x20-0x27 (32-39 for DCA 1-8)
            var nrpnMSB = 0x4F;
            var nrpnLSB = 0x20 + (dca - 1);
            // Convert dB to 14-bit value (0-16383)
            // -85dB = 0, +10dB = 16383
            var range = 10 - (-85); // 95 dB range
            var normalizedLevel = (levelDB - (-85)) / range;
            var nrpnValue = Math.round(normalizedLevel * 16383);
            console.info("Set DCA " + dca + " level to " + levelDB.toFixed(1) + " dB");
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.dcaLevels[dca] = levelDB;
            this.changed("dca".concat(dca, "Level"));
        };
        /**
         * Get DCA fader level in dB
         */
        AllenHeath_SQ.prototype.getDCALevel = function (dca) {
            if (dca < 1 || dca > 8) {
                console.warn("DCA must be between 1 and 8");
                return -85;
            }
            return this.dcaLevels[dca] !== undefined ? this.dcaLevels[dca] : -85;
        };
        /**
         * Set Main LR output level in dB
         */
        AllenHeath_SQ.prototype.setLRLevel = function (levelDB) {
            if (levelDB < -85 || levelDB > 10) {
                console.warn("Level must be between -85 and +10 dB");
                return;
            }
            // NRPN for Main LR level: MSB = 0x4F (79), LSB = 0x30 (48)
            var nrpnMSB = 0x4F;
            var nrpnLSB = 0x30;
            // Convert dB to 14-bit value (0-16383)
            // -85dB = 0, +10dB = 16383
            var range = 10 - (-85); // 95 dB range
            var normalizedLevel = (levelDB - (-85)) / range;
            var nrpnValue = Math.round(normalizedLevel * 16383);
            console.info("Set Main LR level to " + levelDB.toFixed(1) + " dB");
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.lrLevel = levelDB;
            this.changed('lrOutputLevel');
        };
        /**
         * Set Main LR output mute state
         */
        AllenHeath_SQ.prototype.setLRMute = function (mute) {
            // NRPN for Main LR mute: MSB = 1, LSB = 0x30 (48)
            var nrpnMSB = 1;
            var nrpnLSB = 0x30;
            var nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted
            console.info("Set Main LR mute to " + mute);
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.lrMute = mute;
            this.changed('lrOutputMute');
        };
        /**
         * Set Mix/AUX output level in dB
         */
        AllenHeath_SQ.prototype.setMixLevel = function (mix, levelDB) {
            if (mix < 1 || mix > 12) {
                console.warn("Mix must be between 1 and 12");
                return;
            }
            if (levelDB < -85 || levelDB > 10) {
                console.warn("Level must be between -85 and +10 dB");
                return;
            }
            // NRPN for Mix level: MSB = 0x4F (79), LSB = 0x31-0x3C (49-60 for Mix 1-12)
            var nrpnMSB = 0x4F;
            var nrpnLSB = 0x30 + mix;
            // Convert dB to 14-bit value (0-16383)
            // -85dB = 0, +10dB = 16383
            var range = 10 - (-85); // 95 dB range
            var normalizedLevel = (levelDB - (-85)) / range;
            var nrpnValue = Math.round(normalizedLevel * 16383);
            console.info("Set Mix " + mix + " level to " + levelDB.toFixed(1) + " dB");
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.mixLevels[mix] = levelDB;
            this.changed("mix" + mix + "Level");
        };
        /**
         * Set Mix/AUX output mute state
         */
        AllenHeath_SQ.prototype.setMixMute = function (mix, mute) {
            if (mix < 1 || mix > 12) {
                console.warn("Mix must be between 1 and 12");
                return;
            }
            // NRPN for Mix mute: MSB = 1, LSB = 0x31-0x3C (49-60 for Mix 1-12)
            var nrpnMSB = 1;
            var nrpnLSB = 0x30 + mix;
            var nrpnValue = mute ? 1 : 0; // 1 = muted, 0 = unmuted
            console.info("Set Mix " + mix + " mute to " + mute);
            this.sendNRPN(nrpnMSB, nrpnLSB, nrpnValue);
            this.mixMutes[mix] = mute;
            this.changed("mix" + mix + "Mute");
        };
        /**
         * Send NRPN (Non-Registered Parameter Number) message
         */
        AllenHeath_SQ.prototype.sendNRPN = function (nrpnMSB, nrpnLSB, value) {
            var dataMSB = (value >> 7) & 0x7F;
            var dataLSB = value & 0x7F;
            // Combine all 4 NRPN messages into a single packet
            var nrpnMessages = [
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
        };
        /**
         * Send raw MIDI message
         */
        AllenHeath_SQ.prototype.sendMIDI = function (bytes) {
            try {
                this.socket.sendBytes(bytes);
            }
            catch (error) {
                console.error("Failed to send MIDI data:", error);
            }
        };
        /**
         * Handle received binary MIDI data
         */
        AllenHeath_SQ.prototype.onDataReceived = function (data) {
            // Process each byte in the received data
            if (data && data.length) {
                for (var i = 0; i < data.length; i++) {
                    var byte = data[i] & 0xFF;
                    this.processMIDIByte(byte);
                }
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
            }
            else {
                // Data byte
                this.receiveBuffer.push(byte);
                // Process complete messages
                if (this.receiveBuffer.length >= 3) {
                    var status_2 = this.receiveBuffer[0] & 0xF0;
                    if (status_2 === 0xB0) {
                        // Control Change - could be NRPN
                        this.processControlChange(this.receiveBuffer[1], this.receiveBuffer[2]);
                    }
                    else if (status_2 === 0xC0 && this.receiveBuffer.length >= 2) {
                        // Program Change - scene recall
                        this.processProgramChange(this.receiveBuffer[1]);
                    }
                    this.receiveBuffer = [];
                }
                else if (this.receiveBuffer.length >= 2) {
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
            // Channel/DCA/Mix/LR fader levels: MSB = 0x4F (79)
            if (this.nrpnMSB === 0x4F) {
                // Channel levels: LSB = 0-47 for channels 1-48
                if (this.nrpnLSB < 48) {
                    var channel = this.nrpnLSB + 1;
                    var levelDB = ((nrpnValue / 16383) * 95) - 85;
                    console.info("Channel " + channel + " level feedback: " + levelDB.toFixed(1) + " dB");
                    this.channelLevels[channel] = levelDB;
                    this.changed("ch".concat(channel, "Level"));
                }
                // DCA levels: LSB = 0x20-0x27 (32-39) for DCA 1-8
                else if (this.nrpnLSB >= 0x20 && this.nrpnLSB <= 0x27) {
                    var dca = this.nrpnLSB - 0x20 + 1;
                    var levelDB = ((nrpnValue / 16383) * 95) - 85;
                    console.info("DCA " + dca + " level feedback: " + levelDB.toFixed(1) + " dB");
                    this.dcaLevels[dca] = levelDB;
                    this.changed("dca".concat(dca, "Level"));
                }
                // Main LR level: LSB = 0x30 (48)
                else if (this.nrpnLSB === 0x30) {
                    var levelDB = ((nrpnValue / 16383) * 95) - 85;
                    console.info("Main LR level feedback: " + levelDB.toFixed(1) + " dB");
                    this.lrLevel = levelDB;
                    this.changed('lrOutputLevel');
                }
                // Mix levels: LSB = 0x31-0x3C (49-60) for Mix 1-12
                else if (this.nrpnLSB >= 0x31 && this.nrpnLSB <= 0x3C) {
                    var mix = this.nrpnLSB - 0x30;
                    var levelDB = ((nrpnValue / 16383) * 95) - 85;
                    console.info("Mix " + mix + " level feedback: " + levelDB.toFixed(1) + " dB");
                    this.mixLevels[mix] = levelDB;
                    this.changed("mix" + mix + "Level");
                }
            }
            // Channel mutes: MSB = 0, LSB = channel (0-47)
            else if (this.nrpnMSB === 0 && this.nrpnLSB < 48) {
                var channel = this.nrpnLSB + 1;
                var muted = nrpnValue > 0;
                console.info("Channel " + channel + " mute feedback: " + muted);
                this.channelMutes[channel] = muted;
                this.changed("ch".concat(channel, "Mute"));
            }
            // Main LR and Mix mutes: MSB = 1
            else if (this.nrpnMSB === 1) {
                // Main LR mute: LSB = 0x30 (48)
                if (this.nrpnLSB === 0x30) {
                    var muted = nrpnValue > 0;
                    console.info("Main LR mute feedback: " + muted);
                    this.lrMute = muted;
                    this.changed('lrOutputMute');
                }
                // Mix mutes: LSB = 0x31-0x3C (49-60) for Mix 1-12
                else if (this.nrpnLSB >= 0x31 && this.nrpnLSB <= 0x3C) {
                    var mix = this.nrpnLSB - 0x30;
                    var muted = nrpnValue > 0;
                    console.info("Mix " + mix + " mute feedback: " + muted);
                    this.mixMutes[mix] = muted;
                    this.changed("mix" + mix + "Mute");
                }
            }
            // DCA mutes: MSB = 2, LSB = DCA (0-7)
            else if (this.nrpnMSB === 2 && this.nrpnLSB < 8) {
                var dca = this.nrpnLSB + 1;
                var muted = nrpnValue > 0;
                console.info("DCA " + dca + " mute feedback: " + muted);
                this.dcaMutes[dca] = muted;
                this.changed("dca".concat(dca, "Mute"));
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
            Metadata_1.property("Current scene number (1-500)"),
            Metadata_1.min(1),
            Metadata_1.max(500),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "scene", null);
        __decorate([
            Metadata_1.property("MIDI channel (1-16, must match console setting)"),
            Metadata_1.min(1),
            Metadata_1.max(16),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "midiCh", null);
        __decorate([
            Metadata_1.property("DCA 1 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca1Level", null);
        __decorate([
            Metadata_1.property("DCA 2 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca2Level", null);
        __decorate([
            Metadata_1.property("DCA 3 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca3Level", null);
        __decorate([
            Metadata_1.property("DCA 4 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca4Level", null);
        __decorate([
            Metadata_1.property("DCA 5 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca5Level", null);
        __decorate([
            Metadata_1.property("DCA 6 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca6Level", null);
        __decorate([
            Metadata_1.property("DCA 7 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca7Level", null);
        __decorate([
            Metadata_1.property("DCA 8 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "dca8Level", null);
        __decorate([
            Metadata_1.property("DCA 1 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca1Mute", null);
        __decorate([
            Metadata_1.property("DCA 2 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca2Mute", null);
        __decorate([
            Metadata_1.property("DCA 3 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca3Mute", null);
        __decorate([
            Metadata_1.property("DCA 4 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca4Mute", null);
        __decorate([
            Metadata_1.property("DCA 5 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca5Mute", null);
        __decorate([
            Metadata_1.property("DCA 6 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca6Mute", null);
        __decorate([
            Metadata_1.property("DCA 7 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca7Mute", null);
        __decorate([
            Metadata_1.property("DCA 8 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "dca8Mute", null);
        __decorate([
            Metadata_1.property("Channel 1 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch1Level", null);
        __decorate([
            Metadata_1.property("Channel 2 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch2Level", null);
        __decorate([
            Metadata_1.property("Channel 3 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch3Level", null);
        __decorate([
            Metadata_1.property("Channel 4 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch4Level", null);
        __decorate([
            Metadata_1.property("Channel 5 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch5Level", null);
        __decorate([
            Metadata_1.property("Channel 6 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch6Level", null);
        __decorate([
            Metadata_1.property("Channel 7 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch7Level", null);
        __decorate([
            Metadata_1.property("Channel 8 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch8Level", null);
        __decorate([
            Metadata_1.property("Channel 9 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch9Level", null);
        __decorate([
            Metadata_1.property("Channel 10 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch10Level", null);
        __decorate([
            Metadata_1.property("Channel 11 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch11Level", null);
        __decorate([
            Metadata_1.property("Channel 12 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch12Level", null);
        __decorate([
            Metadata_1.property("Channel 13 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch13Level", null);
        __decorate([
            Metadata_1.property("Channel 14 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch14Level", null);
        __decorate([
            Metadata_1.property("Channel 15 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch15Level", null);
        __decorate([
            Metadata_1.property("Channel 16 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch16Level", null);
        __decorate([
            Metadata_1.property("Channel 17 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch17Level", null);
        __decorate([
            Metadata_1.property("Channel 18 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch18Level", null);
        __decorate([
            Metadata_1.property("Channel 19 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch19Level", null);
        __decorate([
            Metadata_1.property("Channel 20 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch20Level", null);
        __decorate([
            Metadata_1.property("Channel 21 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch21Level", null);
        __decorate([
            Metadata_1.property("Channel 22 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch22Level", null);
        __decorate([
            Metadata_1.property("Channel 23 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch23Level", null);
        __decorate([
            Metadata_1.property("Channel 24 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch24Level", null);
        __decorate([
            Metadata_1.property("Channel 25 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch25Level", null);
        __decorate([
            Metadata_1.property("Channel 26 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch26Level", null);
        __decorate([
            Metadata_1.property("Channel 27 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch27Level", null);
        __decorate([
            Metadata_1.property("Channel 28 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch28Level", null);
        __decorate([
            Metadata_1.property("Channel 29 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch29Level", null);
        __decorate([
            Metadata_1.property("Channel 30 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch30Level", null);
        __decorate([
            Metadata_1.property("Channel 31 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch31Level", null);
        __decorate([
            Metadata_1.property("Channel 32 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch32Level", null);
        __decorate([
            Metadata_1.property("Channel 33 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch33Level", null);
        __decorate([
            Metadata_1.property("Channel 34 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch34Level", null);
        __decorate([
            Metadata_1.property("Channel 35 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch35Level", null);
        __decorate([
            Metadata_1.property("Channel 36 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch36Level", null);
        __decorate([
            Metadata_1.property("Channel 37 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch37Level", null);
        __decorate([
            Metadata_1.property("Channel 38 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch38Level", null);
        __decorate([
            Metadata_1.property("Channel 39 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch39Level", null);
        __decorate([
            Metadata_1.property("Channel 40 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch40Level", null);
        __decorate([
            Metadata_1.property("Channel 41 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch41Level", null);
        __decorate([
            Metadata_1.property("Channel 42 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch42Level", null);
        __decorate([
            Metadata_1.property("Channel 43 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch43Level", null);
        __decorate([
            Metadata_1.property("Channel 44 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch44Level", null);
        __decorate([
            Metadata_1.property("Channel 45 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch45Level", null);
        __decorate([
            Metadata_1.property("Channel 46 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch46Level", null);
        __decorate([
            Metadata_1.property("Channel 47 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch47Level", null);
        __decorate([
            Metadata_1.property("Channel 48 fader level (-85 to +10 dB)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "ch48Level", null);
        __decorate([
            Metadata_1.property("Channel 1 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch1Mute", null);
        __decorate([
            Metadata_1.property("Channel 2 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch2Mute", null);
        __decorate([
            Metadata_1.property("Channel 3 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch3Mute", null);
        __decorate([
            Metadata_1.property("Channel 4 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch4Mute", null);
        __decorate([
            Metadata_1.property("Channel 5 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch5Mute", null);
        __decorate([
            Metadata_1.property("Channel 6 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch6Mute", null);
        __decorate([
            Metadata_1.property("Channel 7 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch7Mute", null);
        __decorate([
            Metadata_1.property("Channel 8 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch8Mute", null);
        __decorate([
            Metadata_1.property("Channel 9 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch9Mute", null);
        __decorate([
            Metadata_1.property("Channel 10 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch10Mute", null);
        __decorate([
            Metadata_1.property("Channel 11 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch11Mute", null);
        __decorate([
            Metadata_1.property("Channel 12 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch12Mute", null);
        __decorate([
            Metadata_1.property("Channel 13 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch13Mute", null);
        __decorate([
            Metadata_1.property("Channel 14 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch14Mute", null);
        __decorate([
            Metadata_1.property("Channel 15 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch15Mute", null);
        __decorate([
            Metadata_1.property("Channel 16 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch16Mute", null);
        __decorate([
            Metadata_1.property("Channel 17 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch17Mute", null);
        __decorate([
            Metadata_1.property("Channel 18 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch18Mute", null);
        __decorate([
            Metadata_1.property("Channel 19 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch19Mute", null);
        __decorate([
            Metadata_1.property("Channel 20 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch20Mute", null);
        __decorate([
            Metadata_1.property("Channel 21 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch21Mute", null);
        __decorate([
            Metadata_1.property("Channel 22 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch22Mute", null);
        __decorate([
            Metadata_1.property("Channel 23 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch23Mute", null);
        __decorate([
            Metadata_1.property("Channel 24 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch24Mute", null);
        __decorate([
            Metadata_1.property("Channel 25 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch25Mute", null);
        __decorate([
            Metadata_1.property("Channel 26 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch26Mute", null);
        __decorate([
            Metadata_1.property("Channel 27 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch27Mute", null);
        __decorate([
            Metadata_1.property("Channel 28 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch28Mute", null);
        __decorate([
            Metadata_1.property("Channel 29 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch29Mute", null);
        __decorate([
            Metadata_1.property("Channel 30 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch30Mute", null);
        __decorate([
            Metadata_1.property("Channel 31 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch31Mute", null);
        __decorate([
            Metadata_1.property("Channel 32 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch32Mute", null);
        __decorate([
            Metadata_1.property("Channel 33 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch33Mute", null);
        __decorate([
            Metadata_1.property("Channel 34 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch34Mute", null);
        __decorate([
            Metadata_1.property("Channel 35 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch35Mute", null);
        __decorate([
            Metadata_1.property("Channel 36 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch36Mute", null);
        __decorate([
            Metadata_1.property("Channel 37 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch37Mute", null);
        __decorate([
            Metadata_1.property("Channel 38 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch38Mute", null);
        __decorate([
            Metadata_1.property("Channel 39 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch39Mute", null);
        __decorate([
            Metadata_1.property("Channel 40 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch40Mute", null);
        __decorate([
            Metadata_1.property("Channel 41 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch41Mute", null);
        __decorate([
            Metadata_1.property("Channel 42 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch42Mute", null);
        __decorate([
            Metadata_1.property("Channel 43 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch43Mute", null);
        __decorate([
            Metadata_1.property("Channel 44 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch44Mute", null);
        __decorate([
            Metadata_1.property("Channel 45 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch45Mute", null);
        __decorate([
            Metadata_1.property("Channel 46 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch46Mute", null);
        __decorate([
            Metadata_1.property("Channel 47 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch47Mute", null);
        __decorate([
            Metadata_1.property("Channel 48 mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "ch48Mute", null);
        __decorate([
            Metadata_1.callable("Recall a scene"),
            Metadata_1.parameter("Scene number (1-500)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "recallScene", null);
        __decorate([
            Metadata_1.callable("Set channel fader level"),
            Metadata_1.parameter("Channel number (1-48)"),
            Metadata_1.parameter("Level in dB (-85 to +10)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setChannelLevel", null);
        __decorate([
            Metadata_1.callable("Get channel fader level"),
            Metadata_1.parameter("Channel number (1-48)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", Number)
        ], AllenHeath_SQ.prototype, "getChannelLevel", null);
        __decorate([
            Metadata_1.callable("Set channel mute"),
            Metadata_1.parameter("Channel number (1-48)"),
            Metadata_1.parameter("Mute state (true = muted)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Boolean]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setChannelMute", null);
        __decorate([
            Metadata_1.callable("Get channel mute state"),
            Metadata_1.parameter("Channel number (1-48)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", Boolean)
        ], AllenHeath_SQ.prototype, "getChannelMute", null);
        __decorate([
            Metadata_1.callable("Toggle channel mute"),
            Metadata_1.parameter("Channel number (1-48)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "toggleChannelMute", null);
        __decorate([
            Metadata_1.callable("Set DCA mute"),
            Metadata_1.parameter("DCA number (1-8)"),
            Metadata_1.parameter("Mute state (true = muted)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Boolean]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setDCAMute", null);
        __decorate([
            Metadata_1.callable("Get DCA mute state"),
            Metadata_1.parameter("DCA number (1-8)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", Boolean)
        ], AllenHeath_SQ.prototype, "getDCAMute", null);
        __decorate([
            Metadata_1.callable("Toggle DCA mute"),
            Metadata_1.parameter("DCA number (1-8)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "toggleDCAMute", null);
        __decorate([
            Metadata_1.callable("Set DCA fader level"),
            Metadata_1.parameter("DCA number (1-8)"),
            Metadata_1.parameter("Level in dB (-85 to +10)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setDCALevel", null);
        __decorate([
            Metadata_1.callable("Get DCA fader level"),
            Metadata_1.parameter("DCA number (1-8)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", Number)
        ], AllenHeath_SQ.prototype, "getDCALevel", null);
        __decorate([
            Metadata_1.callable("Set Main LR output level"),
            Metadata_1.parameter("Level in dB (-85 to +10)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setLRLevel", null);
        __decorate([
            Metadata_1.callable("Set Main LR output mute"),
            Metadata_1.parameter("Mute state (true = muted)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Boolean]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setLRMute", null);
        __decorate([
            Metadata_1.callable("Set Mix/AUX output level"),
            Metadata_1.parameter("Mix number (1-12)"),
            Metadata_1.parameter("Level in dB (-85 to +10)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setMixLevel", null);
        __decorate([
            Metadata_1.callable("Set Mix/AUX output mute"),
            Metadata_1.parameter("Mix number (1-12)"),
            Metadata_1.parameter("Mute state (true = muted)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Boolean]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "setMixMute", null);
        AllenHeath_SQ = __decorate([
            Metadata_1.driver('NetworkTCP', { port: 51325 }),
            __metadata("design:paramtypes", [Object])
        ], AllenHeath_SQ);
        return AllenHeath_SQ;
    }(Driver_1.Driver));
    exports.AllenHeath_SQ = AllenHeath_SQ;
});
