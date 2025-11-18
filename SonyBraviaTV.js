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
            _this.mConnected = false;
            _this.mRequestId = 1;
            socket.autoConnect();
            socket.subscribe('connect', function (sender, message) {
                if (message.type === 'Connection') {
                    _this.mConnected = sender.connected;
                    _this.onConnectStateChanged(sender.connected);
                }
            });
            return _this;
        }
        SonyBraviaTV.prototype.onConnectStateChanged = function (connected) {
            if (connected) {
                this.pollPowerStatus();
                this.pollVolumeStatus();
            }
        };
        SonyBraviaTV.prototype.sendRequest = function (service, method, params) {
            if (!this.mConnected) {
                console.warn('Sony Bravia TV not connected');
                return;
            }
            var request = {
                method: method,
                params: params,
                id: this.mRequestId++,
                jsonrpc: '2.0'
            };
            try {
                this.socket.sendText(JSON.stringify(request));
            }
            catch (e) {
                console.error('Failed to send request to Sony Bravia:', e);
            }
        };
        SonyBraviaTV.prototype.pollPowerStatus = function () {
            this.sendRequest('system', 'getPowerStatus', []);
        };
        SonyBraviaTV.prototype.pollVolumeStatus = function () {
            this.sendRequest('audio', 'getVolumeInformation', []);
        };
        Object.defineProperty(SonyBraviaTV.prototype, "power", {
            get: function () {
                return this.mPower;
            },
            set: function (on) {
                if (this.mPower !== on) {
                    this.mPower = on;
                    var status_1 = on ? 'active' : 'standby';
                    this.sendRequest('system', 'setPowerStatus', [{ status: status_1 }]);
                }
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
                if (this.mHdmiInput !== input) {
                    this.mHdmiInput = input;
                    var uri = "extInput:hdmi?port=".concat(input);
                    this.sendRequest('avContent', 'setPlayContent', [{ uri: uri }]);
                }
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
                if (this.mVolume !== level) {
                    this.mVolume = level;
                    this.sendRequest('audio', 'setAudioVolume', [{ volume: level }]);
                }
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
