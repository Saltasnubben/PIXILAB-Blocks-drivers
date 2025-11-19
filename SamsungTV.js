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
    exports.SamsungTV = void 0;
    var SamsungTV = (function (_super) {
        __extends(SamsungTV, _super);
        function SamsungTV(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.mPower = false;
            _this.mVolume = 0;
            _this.mMuted = false;
            _this.mSource = "HDMI1";
            _this.APP_STRING = "iphone..iapp.samsung";
            _this.REMOTE_NAME = "Blocks Remote";
            _this.isAuthenticated = false;
            socket.autoConnect();
            socket.subscribe('connect', function (sender, message) {
                if (message.type === 'Connection' && sender.connected) {
                    _this.onConnectStateChanged(true);
                }
            });
            socket.subscribe('textReceived', function (sender, message) {
                _this.handleResponse(message.text);
            });
            return _this;
        }
        SamsungTV.prototype.onConnectStateChanged = function (connected) {
            if (connected) {
                this.authenticate();
            }
            else {
                this.isAuthenticated = false;
            }
        };
        SamsungTV.prototype.authenticate = function () {
            var ipEncoded = this.base64Encode("0.0.0.0");
            var macEncoded = this.base64Encode("00:00:00:00:00:00");
            var nameEncoded = this.base64Encode(this.REMOTE_NAME);
            var authPayload = String.fromCharCode(0x64) +
                String.fromCharCode(0x00) +
                String.fromCharCode(ipEncoded.length) + String.fromCharCode(0x00) +
                ipEncoded +
                String.fromCharCode(macEncoded.length) + String.fromCharCode(0x00) +
                macEncoded +
                String.fromCharCode(nameEncoded.length) + String.fromCharCode(0x00) +
                nameEncoded;
            var authPacket = String.fromCharCode(0x00) +
                String.fromCharCode(this.APP_STRING.length) + String.fromCharCode(0x00) +
                this.APP_STRING +
                String.fromCharCode(authPayload.length) + String.fromCharCode(0x00) +
                authPayload;
            try {
                this.socket.sendText(authPacket);
                this.isAuthenticated = true;
            }
            catch (e) {
                console.error('Failed to authenticate with Samsung TV:', e);
            }
        };
        SamsungTV.prototype.handleResponse = function (response) {
        };
        SamsungTV.prototype.base64Encode = function (str) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            var result = '';
            var i = 0;
            while (i < str.length) {
                var a = str.charCodeAt(i++);
                var b = i < str.length ? str.charCodeAt(i++) : 0;
                var c = i < str.length ? str.charCodeAt(i++) : 0;
                var bitmap = (a << 16) | (b << 8) | c;
                result += chars.charAt((bitmap >> 18) & 63);
                result += chars.charAt((bitmap >> 12) & 63);
                result += i - 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
                result += i < str.length ? chars.charAt(bitmap & 63) : '=';
            }
            return result;
        };
        SamsungTV.prototype.sendKey = function (key) {
            if (!this.isAuthenticated) {
                console.warn('Not authenticated with TV, attempting to authenticate...');
                this.authenticate();
            }
            var keyEncoded = this.base64Encode(key);
            var keyPayload = String.fromCharCode(0x00) +
                String.fromCharCode(0x00) +
                String.fromCharCode(0x00) +
                String.fromCharCode(keyEncoded.length) + String.fromCharCode(0x00) +
                keyEncoded;
            var keyPacket = String.fromCharCode(0x00) +
                String.fromCharCode(this.APP_STRING.length) + String.fromCharCode(0x00) +
                this.APP_STRING +
                String.fromCharCode(keyPayload.length) + String.fromCharCode(0x00) +
                keyPayload;
            try {
                this.socket.sendText(keyPacket);
            }
            catch (e) {
                console.error('Failed to send key to Samsung TV:', e);
            }
        };
        Object.defineProperty(SamsungTV.prototype, "power", {
            get: function () {
                return this.mPower;
            },
            set: function (on) {
                this.mPower = on;
                if (on) {
                    this.sendKey('KEY_POWERON');
                }
                else {
                    this.sendKey('KEY_POWEROFF');
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SamsungTV.prototype, "volume", {
            get: function () {
                return this.mVolume;
            },
            set: function (level) {
                if (level < 0 || level > 100) {
                    console.error('Volume must be between 0 and 100');
                    return;
                }
                this.mVolume = level;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SamsungTV.prototype, "muted", {
            get: function () {
                return this.mMuted;
            },
            set: function (mute) {
                if (this.mMuted !== mute) {
                    this.mMuted = mute;
                    this.sendKey('KEY_MUTE');
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SamsungTV.prototype, "source", {
            get: function () {
                return this.mSource;
            },
            set: function (src) {
                this.mSource = src;
                this.sendKey('KEY_SOURCE');
            },
            enumerable: false,
            configurable: true
        });
        SamsungTV.prototype.powerOn = function () {
            this.power = true;
        };
        SamsungTV.prototype.powerOff = function () {
            this.power = false;
        };
        SamsungTV.prototype.powerToggle = function () {
            this.sendKey('KEY_POWER');
            this.mPower = !this.mPower;
        };
        SamsungTV.prototype.volumeUp = function () {
            this.sendKey('KEY_VOLUP');
            if (this.mVolume < 100) {
                this.mVolume++;
            }
        };
        SamsungTV.prototype.volumeDown = function () {
            this.sendKey('KEY_VOLDOWN');
            if (this.mVolume > 0) {
                this.mVolume--;
            }
        };
        SamsungTV.prototype.toggleMute = function () {
            this.mMuted = !this.mMuted;
            this.sendKey('KEY_MUTE');
        };
        SamsungTV.prototype.channelUp = function () {
            this.sendKey('KEY_CHUP');
        };
        SamsungTV.prototype.channelDown = function () {
            this.sendKey('KEY_CHDOWN');
        };
        SamsungTV.prototype.previousChannel = function () {
            this.sendKey('KEY_PRECH');
        };
        SamsungTV.prototype.up = function () {
            this.sendKey('KEY_UP');
        };
        SamsungTV.prototype.down = function () {
            this.sendKey('KEY_DOWN');
        };
        SamsungTV.prototype.left = function () {
            this.sendKey('KEY_LEFT');
        };
        SamsungTV.prototype.right = function () {
            this.sendKey('KEY_RIGHT');
        };
        SamsungTV.prototype.enter = function () {
            this.sendKey('KEY_ENTER');
        };
        SamsungTV.prototype.back = function () {
            this.sendKey('KEY_RETURN');
        };
        SamsungTV.prototype.exit = function () {
            this.sendKey('KEY_EXIT');
        };
        SamsungTV.prototype.menu = function () {
            this.sendKey('KEY_MENU');
        };
        SamsungTV.prototype.home = function () {
            this.sendKey('KEY_HOME');
        };
        SamsungTV.prototype.tools = function () {
            this.sendKey('KEY_TOOLS');
        };
        SamsungTV.prototype.info = function () {
            this.sendKey('KEY_INFO');
        };
        SamsungTV.prototype.changeSource = function () {
            this.sendKey('KEY_SOURCE');
        };
        SamsungTV.prototype.play = function () {
            this.sendKey('KEY_PLAY');
        };
        SamsungTV.prototype.pause = function () {
            this.sendKey('KEY_PAUSE');
        };
        SamsungTV.prototype.stop = function () {
            this.sendKey('KEY_STOP');
        };
        SamsungTV.prototype.rewind = function () {
            this.sendKey('KEY_REWIND');
        };
        SamsungTV.prototype.fastForward = function () {
            this.sendKey('KEY_FF');
        };
        SamsungTV.prototype.record = function () {
            this.sendKey('KEY_REC');
        };
        SamsungTV.prototype.sendCommand = function (key) {
            this.sendKey(key);
        };
        SamsungTV.prototype.selectHDMI = function (input) {
            if (input < 1 || input > 4) {
                console.error('HDMI input must be between 1 and 4');
                return;
            }
            this.sendKey('KEY_HDMI' + input);
            this.mSource = 'HDMI' + input;
        };
        SamsungTV.prototype.pressNumber = function (num) {
            if (num < 0 || num > 9) {
                console.error('Number must be between 0 and 9');
                return;
            }
            this.sendKey('KEY_' + num);
        };
        SamsungTV.prototype.pictureMode = function () {
            this.sendKey('KEY_PMODE');
        };
        SamsungTV.prototype.pictureSize = function () {
            this.sendKey('KEY_PICTURE_SIZE');
        };
        __decorate([
            (0, Metadata_1.property)('Power control'),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], SamsungTV.prototype, "power", null);
        __decorate([
            (0, Metadata_1.property)('Volume level'),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], SamsungTV.prototype, "volume", null);
        __decorate([
            (0, Metadata_1.property)('Mute control'),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], SamsungTV.prototype, "muted", null);
        __decorate([
            (0, Metadata_1.property)('Input source'),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], SamsungTV.prototype, "source", null);
        __decorate([
            (0, Metadata_1.callable)('Power on the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "powerOn", null);
        __decorate([
            (0, Metadata_1.callable)('Power off the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "powerOff", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle power state'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "powerToggle", null);
        __decorate([
            (0, Metadata_1.callable)('Increase volume'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "volumeUp", null);
        __decorate([
            (0, Metadata_1.callable)('Decrease volume'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "volumeDown", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle mute'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "toggleMute", null);
        __decorate([
            (0, Metadata_1.callable)('Next channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "channelUp", null);
        __decorate([
            (0, Metadata_1.callable)('Previous channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "channelDown", null);
        __decorate([
            (0, Metadata_1.callable)('Return to previous channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "previousChannel", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate up'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "up", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate down'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "down", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate left'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "left", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate right'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "right", null);
        __decorate([
            (0, Metadata_1.callable)('Select/Enter'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "enter", null);
        __decorate([
            (0, Metadata_1.callable)('Back/Return'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "back", null);
        __decorate([
            (0, Metadata_1.callable)('Exit'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "exit", null);
        __decorate([
            (0, Metadata_1.callable)('Open main menu'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "menu", null);
        __decorate([
            (0, Metadata_1.callable)('Open home screen'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "home", null);
        __decorate([
            (0, Metadata_1.callable)('Open tools menu'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "tools", null);
        __decorate([
            (0, Metadata_1.callable)('Open info display'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "info", null);
        __decorate([
            (0, Metadata_1.callable)('Change input source'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "changeSource", null);
        __decorate([
            (0, Metadata_1.callable)('Play'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "play", null);
        __decorate([
            (0, Metadata_1.callable)('Pause'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "pause", null);
        __decorate([
            (0, Metadata_1.callable)('Stop'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "stop", null);
        __decorate([
            (0, Metadata_1.callable)('Rewind'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "rewind", null);
        __decorate([
            (0, Metadata_1.callable)('Fast forward'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "fastForward", null);
        __decorate([
            (0, Metadata_1.callable)('Record'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "record", null);
        __decorate([
            (0, Metadata_1.callable)('Send custom key command'),
            __param(0, (0, Metadata_1.parameter)('Key command (e.g., KEY_HDMI, KEY_MENU)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "sendCommand", null);
        __decorate([
            (0, Metadata_1.callable)('Select HDMI input'),
            __param(0, (0, Metadata_1.parameter)('HDMI input number (1-4)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "selectHDMI", null);
        __decorate([
            (0, Metadata_1.callable)('Press number key'),
            __param(0, (0, Metadata_1.parameter)('Number (0-9)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "pressNumber", null);
        __decorate([
            (0, Metadata_1.callable)('Cycle picture mode'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "pictureMode", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle picture size'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTV.prototype, "pictureSize", null);
        SamsungTV = __decorate([
            (0, Metadata_1.driver)('NetworkTCP', { port: 55000 }),
            __metadata("design:paramtypes", [Object])
        ], SamsungTV);
        return SamsungTV;
    }(Driver_1.Driver));
    exports.SamsungTV = SamsungTV;
});
