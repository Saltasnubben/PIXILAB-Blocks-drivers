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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
define(["require", "exports", "system_lib/Driver", "system_lib/Metadata"], function (require, exports, Driver_1, Metadata_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SonyBraviaTV = void 0;
    var SonyBraviaTV = (function (_super) {
        __extends(SonyBraviaTV, _super);
        function SonyBraviaTV(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.mPower = false;
            _this.mHdmiInput = 1;
            _this.mVolume = 0;
            socket.autoConnect();
            socket.subscribe('connect', function (sender, message) {
                if (message.type === 'Connection' && sender.connected) {
                    _this.onConnectStateChanged(true);
                }
            });
            socket.subscribe('textReceived', function (sender, message) {
            });
            return _this;
        }
        SonyBraviaTV.prototype.onConnectStateChanged = function (connected) {
            if (connected) {
                console.warn('Sony Bravia: Connected, polling status');
                this.pollPowerStatus();
                this.pollVolumeStatus();
                this.pollInputStatus();
            }
        };
        SonyBraviaTV.prototype.padLeft = function (str, length, padChar) {
            while (str.length < length) {
                str = padChar + str;
            }
            return str;
        };
        SonyBraviaTV.prototype.sendCommand = function (command) {
            try {
                var padded = command;
                while (padded.length < 23) {
                    padded = padded + '0';
                }
                if (padded.length > 23) {
                    padded = padded.substring(0, 23);
                }
                var fullCommand = padded + '\n';
                console.warn('Sony Bravia: Sending command: ' + padded);
                this.socket.sendText(fullCommand);
            }
            catch (e) {
                console.error('Failed to send command to Sony Bravia:', e);
            }
        };
        SonyBraviaTV.prototype.pollPowerStatus = function () {
            console.warn('Sony Bravia: Polling power status');
            this.sendCommand('*SEPOWR################');
        };
        SonyBraviaTV.prototype.pollVolumeStatus = function () {
            console.warn('Sony Bravia: Polling volume status');
            this.sendCommand('*SEVOLU################');
        };
        SonyBraviaTV.prototype.pollInputStatus = function () {
            console.warn('Sony Bravia: Polling input status');
            this.sendCommand('*SEINPT################');
        };
        Object.defineProperty(SonyBraviaTV.prototype, "power", {
            get: function () {
                return this.mPower;
            },
            set: function (on) {
                this.mPower = on;
                var value = on ? '0000000000000001' : '0000000000000000';
                this.sendCommand('*SCPOWR' + value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SonyBraviaTV.prototype, "hdmiInput", {
            get: function () {
                return this.mHdmiInput;
            },
            set: function (input) {
                if (input < 1 || input > 4) {
                    console.error('HDMI input must be between 1 and 4');
                    return;
                }
                this.mHdmiInput = input;
                var portStr = this.padLeft(String(input), 8, '0');
                var value = '00000001' + portStr;
                this.sendCommand('*SCINPT' + value);
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SonyBraviaTV.prototype, "volume", {
            get: function () {
                return this.mVolume;
            },
            set: function (level) {
                if (level < 0 || level > 100) {
                    console.error('Volume must be between 0 and 100');
                    return;
                }
                this.mVolume = level;
                var value = this.padLeft(String(level), 16, '0');
                this.sendCommand('*SCVOLU' + value);
            },
            enumerable: false,
            configurable: true
        });
        SonyBraviaTV.prototype.setHDMI = function (input) {
            this.hdmiInput = input;
        };
        SonyBraviaTV.prototype.setVolume = function (level) {
            this.volume = level;
        };
        SonyBraviaTV.prototype.powerOn = function () {
            this.power = true;
        };
        SonyBraviaTV.prototype.powerOff = function () {
            this.power = false;
        };
        __decorate([
            (0, Metadata_1.property)('Power control'),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], SonyBraviaTV.prototype, "power", null);
        __decorate([
            (0, Metadata_1.property)('HDMI input selection (1-4)'),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], SonyBraviaTV.prototype, "hdmiInput", null);
        __decorate([
            (0, Metadata_1.property)('Volume level (0-100)'),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], SonyBraviaTV.prototype, "volume", null);
        __decorate([
            (0, Metadata_1.callable)('Set HDMI input source'),
            __param(0, (0, Metadata_1.parameter)('Input number (1-4)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SonyBraviaTV.prototype, "setHDMI", null);
        __decorate([
            (0, Metadata_1.callable)('Set volume level'),
            __param(0, (0, Metadata_1.parameter)('Volume level (0-100)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SonyBraviaTV.prototype, "setVolume", null);
        __decorate([
            (0, Metadata_1.callable)('Power on the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SonyBraviaTV.prototype, "powerOn", null);
        __decorate([
            (0, Metadata_1.callable)('Power off the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SonyBraviaTV.prototype, "powerOff", null);
        SonyBraviaTV = __decorate([
            (0, Metadata_1.driver)('NetworkTCP', { port: 20060 }),
            __metadata("design:paramtypes", [Object])
        ], SonyBraviaTV);
        return SonyBraviaTV;
    }(Driver_1.Driver));
    exports.SonyBraviaTV = SonyBraviaTV;
});
