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
define(["require", "exports", "system/Network", "system_lib/Driver", "system_lib/Metadata"], function (require, exports, Network_1, Driver_1, Metadata_1) {
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
            _this.mRequestId = 1;
            _this.mPendingRequests = new Map();
            socket.autoConnect();
            socket.subscribe('connect', function (sender, message) {
                if (message.type === 'Connection')
                    _this.onConnectStateChanged(sender.connected);
            });
            socket.subscribe('textReceived', function (sender, message) {
                _this.onTextReceived(message.text);
            });
            return _this;
        }
        SonyBraviaTV.prototype.onConnectStateChanged = function (connected) {
            if (connected) {
                this.pollPowerStatus();
                this.pollVolumeStatus();
            }
        };
        SonyBraviaTV.prototype.onTextReceived = function (text) {
            try {
                var response = JSON.parse(text);
                if (response.id !== undefined) {
                    var callback = this.mPendingRequests.get(response.id);
                    if (callback) {
                        callback(response);
                        this.mPendingRequests.delete(response.id);
                    }
                }
                if (response.error) {
                    console.error('Sony Bravia API Error:', response.error);
                }
            }
            catch (e) {
                console.error('Failed to parse Sony Bravia response:', text);
            }
        };
        SonyBraviaTV.prototype.sendRequest = function (service, method, params) {
            var _this = this;
            if (params === void 0) { params = []; }
            return new Promise(function (resolve, reject) {
                var requestId = _this.mRequestId++;
                _this.mPendingRequests.set(requestId, function (response) {
                    if (response.error) {
                        reject(new Error(response.error.message || 'Unknown error'));
                    }
                    else {
                        resolve(response.result);
                    }
                });
                var request = {
                    method: method,
                    params: params,
                    id: requestId,
                    jsonrpc: '2.0'
                };
                _this.socket.sendText(JSON.stringify(request));
            });
        };
        SonyBraviaTV.prototype.pollPowerStatus = function () {
            var _this = this;
            if (this.socket.connected) {
                this.sendRequest('system', 'getPowerStatus')
                    .then(function (result) {
                    if (result && result.length > 0) {
                        var status_1 = result[0];
                        _this.mPower = status_1.status === 'active';
                    }
                })
                    .catch(function (err) { return console.error('Failed to poll power status:', err); });
            }
        };
        SonyBraviaTV.prototype.pollVolumeStatus = function () {
            var _this = this;
            if (this.socket.connected) {
                this.sendRequest('audio', 'getVolumeInformation')
                    .then(function (result) {
                    if (result && result.length > 0) {
                        var volumeInfo = result[0];
                        _this.mVolume = volumeInfo.volume || 0;
                    }
                })
                    .catch(function (err) { return console.error('Failed to poll volume status:', err); });
            }
        };
        Object.defineProperty(SonyBraviaTV.prototype, "power", {
            get: function () {
                return this.mPower;
            },
            set: function (on) {
                if (this.mPower !== on) {
                    this.mPower = on;
                    var status_2 = on ? 'active' : 'standby';
                    this.sendRequest('system', 'setPowerStatus', [{ status: status_2 }])
                        .then(function () {
                        console.log("Power set to ".concat(status_2));
                    })
                        .catch(function (err) { return console.error('Failed to set power:', err); });
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
                    this.sendRequest('avContent', 'setPlayContent', [{ uri: uri }])
                        .then(function () {
                        console.log("HDMI input set to ".concat(input));
                    })
                        .catch(function (err) { return console.error('Failed to set HDMI input:', err); });
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
                    this.sendRequest('audio', 'setAudioVolume', [{ volume: level }])
                        .then(function () {
                        console.log("Volume set to ".concat(level));
                    })
                        .catch(function (err) { return console.error('Failed to set volume:', err); });
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
            __metadata("design:paramtypes", [Network_1.NetworkTCP])
        ], SonyBraviaTV);
        return SonyBraviaTV;
    }(Driver_1.Driver));
    exports.SonyBraviaTV = SonyBraviaTV;
});
