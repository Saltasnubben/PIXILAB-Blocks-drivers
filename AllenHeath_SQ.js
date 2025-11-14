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
    /**
     * Level control for a single channel/DCA/AUX
     */
    var LevelControl = /** @class */ (function () {
        function LevelControl(owner, channelNumber, nrpnMSB, nrpnLSBBase, propertyName) {
            this.owner = owner;
            this.channelNumber = channelNumber;
            this.nrpnMSB = nrpnMSB;
            this.nrpnLSBBase = nrpnLSBBase;
            this.propertyName = propertyName;
            this._value = -85;
        }
        Object.defineProperty(LevelControl.prototype, "value", {
            get: function () {
                return this._value;
            },
            set: function (level) {
                if (level < -85 || level > 10) {
                    console.warn("Level must be between -85 and +10 dB");
                    return;
                }
                this._value = level;
                // Convert dB to 14-bit NRPN value (0-16383)
                var range = 10 - (-85); // 95 dB range
                var normalizedLevel = (level - (-85)) / range;
                var nrpnValue = Math.round(normalizedLevel * 16383);
                // Calculate LSB: convert 1-based channel number to 0-based LSB
                var lsb = this.nrpnLSBBase + (this.channelNumber - 1);
                this.owner.sendNRPN(this.nrpnMSB, lsb, nrpnValue);
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Update from feedback without sending MIDI
         */
        LevelControl.prototype.updateValue = function (level) {
            this._value = level;
        };
        __decorate([
            Metadata_1.property("Fader level in dB (-85 to +10)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], LevelControl.prototype, "value", null);
        return LevelControl;
    }());
    /**
     * Mute control for a single channel/DCA/AUX
     */
    var MuteControl = /** @class */ (function () {
        function MuteControl(owner, channelNumber, nrpnMSB, nrpnLSBBase, propertyName) {
            this.owner = owner;
            this.channelNumber = channelNumber;
            this.nrpnMSB = nrpnMSB;
            this.nrpnLSBBase = nrpnLSBBase;
            this.propertyName = propertyName;
            this._value = false;
        }
        Object.defineProperty(MuteControl.prototype, "value", {
            get: function () {
                return this._value;
            },
            set: function (muted) {
                this._value = muted;
                var nrpnValue = muted ? 1 : 0;
                // Calculate LSB: convert 1-based channel number to 0-based LSB
                var lsb = this.nrpnLSBBase + (this.channelNumber - 1);
                this.owner.sendNRPN(this.nrpnMSB, lsb, nrpnValue);
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Update from feedback without sending MIDI
         */
        MuteControl.prototype.updateValue = function (muted) {
            this._value = muted;
        };
        __decorate([
            Metadata_1.property("Mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], MuteControl.prototype, "value", null);
        return MuteControl;
    }());
    var AllenHeath_SQ = /** @class */ (function (_super) {
        __extends(AllenHeath_SQ, _super);
        function AllenHeath_SQ(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.midiChannel = 0; // MIDI channel 1 (0-indexed)
            _this.currentScene = 1;
            // Main LR output
            _this._lrLevel = -85;
            _this._lrMute = false;
            // NRPN state machine for parsing incoming messages
            _this.nrpnMSB = -1;
            _this.nrpnLSB = -1;
            _this.nrpnDataMSB = -1;
            _this.nrpnDataLSB = -1;
            // Receive buffer for MIDI messages
            _this.receiveBuffer = [];
            // Initialize indexed properties with 1-based indexing
            _this.channelLevel = _this.indexedProperty("channelLevel", LevelControl);
            _this.channelMute = _this.indexedProperty("channelMute", MuteControl);
            _this.dcaLevel = _this.indexedProperty("dcaLevel", LevelControl);
            _this.dcaMute = _this.indexedProperty("dcaMute", MuteControl);
            _this.auxLevel = _this.indexedProperty("auxLevel", LevelControl);
            _this.auxMute = _this.indexedProperty("auxMute", MuteControl);
            // Use direct assignment for 1-based indexing (skip index 0)
            // Channels 1-48: Level LSB base=0x0C, Mute LSB base=0
            for (var i = 1; i <= 48; i++) {
                _this.channelLevel[i] = new LevelControl(_this, i, 0x4F, 0x0C, "channelLevel");
                _this.channelMute[i] = new MuteControl(_this, i, 0, 0, "channelMute");
            }
            // DCAs 1-8: Level LSB base=0x40, Mute LSB base=0
            for (var i = 1; i <= 8; i++) {
                _this.dcaLevel[i] = new LevelControl(_this, i, 0x4F, 0x40, "dcaLevel");
                _this.dcaMute[i] = new MuteControl(_this, i, 2, 0, "dcaMute");
            }
            // AUX 1-12: Level LSB base=0x00, Mute LSB base=0
            for (var i = 1; i <= 12; i++) {
                _this.auxLevel[i] = new LevelControl(_this, i, 0x4F, 0x00, "auxLevel");
                _this.auxMute[i] = new MuteControl(_this, i, 1, 0, "auxMute");
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
            // Enable automatic connection management with raw bytes mode for MIDI binary protocol
            socket.autoConnect(true);
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
        Object.defineProperty(AllenHeath_SQ.prototype, "lrLevel", {
            /**
             * Main LR output level
             */
            get: function () {
                return this._lrLevel;
            },
            set: function (value) {
                if (value < -85 || value > 10) {
                    console.warn("Level must be between -85 and +10 dB");
                    return;
                }
                // Convert dB to 14-bit NRPN value
                var range = 10 - (-85);
                var normalizedLevel = (value - (-85)) / range;
                var nrpnValue = Math.round(normalizedLevel * 16383);
                console.info("Set Main LR level to " + value.toFixed(1) + " dB");
                this.sendNRPN(0x4F, 0x48, nrpnValue);  // LR level at LSB 0x48
                this._lrLevel = value;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(AllenHeath_SQ.prototype, "lrMute", {
            /**
             * Main LR output mute
             */
            get: function () {
                return this._lrMute;
            },
            set: function (value) {
                var nrpnValue = value ? 1 : 0;
                console.info("Set Main LR mute to " + value);
                this.sendNRPN(1, 0x0C, nrpnValue);  // LR mute at MSB=1, LSB=0x0C
                this._lrMute = value;
            },
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
            var midiScene = sceneNumber - 1;
            var bank = Math.floor(midiScene / 128);
            var program = midiScene % 128;
            // Send Bank Select MSB + Program Change
            var bankSelectMSB = [0xB0 | this.midiChannel, 0x00, bank];
            var programChange = [0xC0 | this.midiChannel, program];
            var combined = bankSelectMSB.concat(programChange);
            console.info("Recall scene " + sceneNumber);
            this.sendMIDI(combined);
            this.currentScene = sceneNumber;
            this.changed("scene");
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
                        // 3-byte messages
                        break;
                    case 0xC0: // Program Change
                    case 0xD0: // Channel Pressure
                        // 2-byte messages
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
            // Fader levels: MSB = 0x4F
            if (this.nrpnMSB === 0x4F) {
                var levelDB = ((nrpnValue / 16383) * 95) - 85;
                // AUX levels: LSB 0-11 (0x00-0x0B)
                if (this.nrpnLSB >= 0x00 && this.nrpnLSB <= 0x0B) {
                    var auxNumber = this.nrpnLSB + 1; // Convert to 1-based
                    console.info("AUX " + auxNumber + " level feedback: " + levelDB.toFixed(1) + " dB");
                    if (this.auxLevel[auxNumber]) {
                        this.auxLevel[auxNumber].updateValue(levelDB);
                        this.changed("auxLevel[" + auxNumber + "]");
                    }
                }
                // Channel levels: LSB 12-59 (0x0C-0x3B)
                else if (this.nrpnLSB >= 0x0C && this.nrpnLSB <= 0x3B) {
                    var channelNumber = (this.nrpnLSB - 0x0C) + 1; // Convert to 1-based
                    console.info("Channel " + channelNumber + " level feedback: " + levelDB.toFixed(1) + " dB");
                    if (this.channelLevel[channelNumber]) {
                        this.channelLevel[channelNumber].updateValue(levelDB);
                        this.changed("channelLevel[" + channelNumber + "]");
                    }
                }
                // DCA levels: LSB 64-71 (0x40-0x47)
                else if (this.nrpnLSB >= 0x40 && this.nrpnLSB <= 0x47) {
                    var dcaNumber = (this.nrpnLSB - 0x40) + 1; // Convert to 1-based
                    console.info("DCA " + dcaNumber + " level feedback: " + levelDB.toFixed(1) + " dB");
                    if (this.dcaLevel[dcaNumber]) {
                        this.dcaLevel[dcaNumber].updateValue(levelDB);
                        this.changed("dcaLevel[" + dcaNumber + "]");
                    }
                }
                // LR level: LSB 72 (0x48)
                else if (this.nrpnLSB === 0x48) {
                    console.info("Main LR level feedback: " + levelDB.toFixed(1) + " dB");
                    this._lrLevel = levelDB;
                    this.changed('lrLevel');
                }
            }
            // Channel mutes: MSB = 0, LSB 0-47
            else if (this.nrpnMSB === 0 && this.nrpnLSB <= 47) {
                var channelNumber = this.nrpnLSB + 1; // Convert to 1-based
                var muted = nrpnValue > 0;
                console.info("Channel " + channelNumber + " mute feedback: " + muted);
                if (this.channelMute[channelNumber]) {
                    this.channelMute[channelNumber].updateValue(muted);
                    this.changed("channelMute[" + channelNumber + "]");
                }
            }
            // AUX and LR mutes: MSB = 1
            else if (this.nrpnMSB === 1) {
                var muted = nrpnValue > 0;
                // AUX mutes: LSB 0-11
                if (this.nrpnLSB <= 11) {
                    var auxNumber = this.nrpnLSB + 1; // Convert to 1-based
                    console.info("AUX " + auxNumber + " mute feedback: " + muted);
                    if (this.auxMute[auxNumber]) {
                        this.auxMute[auxNumber].updateValue(muted);
                        this.changed("auxMute[" + auxNumber + "]");
                    }
                }
                // LR mute: LSB 12 (0x0C)
                else if (this.nrpnLSB === 0x0C) {
                    console.info("Main LR mute feedback: " + muted);
                    this._lrMute = muted;
                    this.changed('lrMute');
                }
            }
            // DCA mutes: MSB = 2, LSB 0-7
            else if (this.nrpnMSB === 2 && this.nrpnLSB <= 7) {
                var dcaNumber = this.nrpnLSB + 1; // Convert to 1-based
                var muted = nrpnValue > 0;
                console.info("DCA " + dcaNumber + " mute feedback: " + muted);
                if (this.dcaMute[dcaNumber]) {
                    this.dcaMute[dcaNumber].updateValue(muted);
                    this.changed("dcaMute[" + dcaNumber + "]");
                }
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
            // Scene recall feedback from console
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
            Metadata_1.property("Main LR output level in dB (-85 to +10)"),
            Metadata_1.min(-85),
            Metadata_1.max(10),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], AllenHeath_SQ.prototype, "lrLevel", null);
        __decorate([
            Metadata_1.property("Main LR output mute state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], AllenHeath_SQ.prototype, "lrMute", null);
        __decorate([
            Metadata_1.callable("Recall a scene"),
            Metadata_1.parameter("Scene number (1-500)"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], AllenHeath_SQ.prototype, "recallScene", null);
        AllenHeath_SQ = __decorate([
            Metadata_1.driver('NetworkTCP', { port: 51325 }),
            __metadata("design:paramtypes", [Object])
        ], AllenHeath_SQ);
        return AllenHeath_SQ;
    }(Driver_1.Driver));
    exports.AllenHeath_SQ = AllenHeath_SQ;
});
