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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
define(["require", "exports", "system/SimpleWebsocket", "system_lib/Metadata", "system_lib/Script"], function (require, exports, SimpleWebsocket_1, Metadata_1, Script_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SamsungTVWebSocket = void 0;
    var SamsungTVWebSocket = (function (_super) {
        __extends(SamsungTVWebSocket, _super);
        function SamsungTVWebSocket(env) {
            var _this = _super.call(this, env) || this;
            _this.ws = null;
            _this.tvHost = "";
            _this.tvPort = 8001;
            _this.useSSL = false;
            _this.authToken = "";
            _this.remoteName = "Blocks Remote";
            _this.mPower = false;
            _this.mVolume = 50;
            _this.mMuted = false;
            _this.mSource = "HDMI1";
            _this.connecting = false;
            _this.connected = false;
            return _this;
        }
        SamsungTVWebSocket.prototype.connect = function (host, port, token) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (this.connecting) {
                                console.warn("Connection already in progress");
                                return [2];
                            }
                            this.tvHost = host;
                            this.tvPort = port || 8001;
                            this.useSSL = this.tvPort === 8002;
                            this.authToken = token || "";
                            return [4, this.connectWebSocket()];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.disconnect = function () {
            if (this.ws) {
                try {
                    this.ws.disconnect();
                }
                catch (e) {
                    console.error("Error disconnecting:", e);
                }
                this.ws = null;
                this.connected = false;
            }
        };
        SamsungTVWebSocket.prototype.reconnect = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.disconnect();
                            return [4, this.connectWebSocket()];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.connectWebSocket = function () {
            return __awaiter(this, void 0, void 0, function () {
                var protocol, encodedName, url, headers, _a, error_1;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (this.connecting || this.connected) {
                                return [2];
                            }
                            this.connecting = true;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, 4, 5]);
                            protocol = this.useSSL ? "wss" : "ws";
                            encodedName = this.base64Encode(this.remoteName);
                            url = "".concat(protocol, "://").concat(this.tvHost, ":").concat(this.tvPort, "/api/v2/channels/samsung.remote.control?name=").concat(encodedName);
                            if (this.authToken) {
                                url += "&token=".concat(this.authToken);
                            }
                            console.log("Connecting to Samsung TV at ".concat(url));
                            headers = {};
                            _a = this;
                            return [4, SimpleWebsocket_1.SimpleWebsocket.connect(url, 65536, headers)];
                        case 2:
                            _a.ws = _b.sent();
                            this.ws.subscribe('textReceived', function (sender, message) {
                                _this.handleMessage(message.text);
                            });
                            this.ws.subscribe('finish', function () {
                                console.log("WebSocket connection closed");
                                _this.connected = false;
                                _this.ws = null;
                            });
                            this.connected = true;
                            console.log("Connected to Samsung TV");
                            return [3, 5];
                        case 3:
                            error_1 = _b.sent();
                            console.error("Failed to connect to Samsung TV:", error_1);
                            this.connected = false;
                            this.ws = null;
                            return [3, 5];
                        case 4:
                            this.connecting = false;
                            return [7];
                        case 5: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.handleMessage = function (text) {
            try {
                var message = JSON.parse(text);
                if (message.event === 'ms.channel.connect') {
                    console.log("Connection established:", message.data);
                    if (message.data && message.data.token) {
                        this.authToken = message.data.token;
                        console.log("Received auth token:", this.authToken);
                    }
                }
                else if (message.event === 'ms.channel.unauthorized') {
                    console.warn("Unauthorized - TV may require pairing approval");
                }
                else {
                    console.log("Received message:", message);
                }
            }
            catch (e) {
                console.warn("Failed to parse message:", text);
            }
        };
        SamsungTVWebSocket.prototype.sendKey = function (keyCode) {
            if (!this.connected || !this.ws) {
                console.warn("Not connected to TV. Use connect() first.");
                return;
            }
            var command = {
                method: "ms.remote.control",
                params: {
                    Cmd: "Click",
                    DataOfCmd: keyCode,
                    Option: "false",
                    TypeOfRemote: "SendRemoteKey"
                }
            };
            try {
                this.ws.sendText(JSON.stringify(command));
            }
            catch (error) {
                console.error("Failed to send key:", error);
            }
        };
        SamsungTVWebSocket.prototype.base64Encode = function (str) {
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
        Object.defineProperty(SamsungTVWebSocket.prototype, "isConnected", {
            get: function () {
                return this.connected;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SamsungTVWebSocket.prototype, "power", {
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
        Object.defineProperty(SamsungTVWebSocket.prototype, "volume", {
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
        Object.defineProperty(SamsungTVWebSocket.prototype, "muted", {
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
        Object.defineProperty(SamsungTVWebSocket.prototype, "source", {
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
        SamsungTVWebSocket.prototype.powerOn = function () {
            this.power = true;
        };
        SamsungTVWebSocket.prototype.powerOff = function () {
            this.power = false;
        };
        SamsungTVWebSocket.prototype.powerToggle = function () {
            this.sendKey('KEY_POWER');
            this.mPower = !this.mPower;
        };
        SamsungTVWebSocket.prototype.volumeUp = function () {
            this.sendKey('KEY_VOLUP');
            if (this.mVolume < 100) {
                this.mVolume++;
            }
        };
        SamsungTVWebSocket.prototype.volumeDown = function () {
            this.sendKey('KEY_VOLDOWN');
            if (this.mVolume > 0) {
                this.mVolume--;
            }
        };
        SamsungTVWebSocket.prototype.toggleMute = function () {
            this.mMuted = !this.mMuted;
            this.sendKey('KEY_MUTE');
        };
        SamsungTVWebSocket.prototype.channelUp = function () {
            this.sendKey('KEY_CHUP');
        };
        SamsungTVWebSocket.prototype.channelDown = function () {
            this.sendKey('KEY_CHDOWN');
        };
        SamsungTVWebSocket.prototype.previousChannel = function () {
            this.sendKey('KEY_PRECH');
        };
        SamsungTVWebSocket.prototype.up = function () {
            this.sendKey('KEY_UP');
        };
        SamsungTVWebSocket.prototype.down = function () {
            this.sendKey('KEY_DOWN');
        };
        SamsungTVWebSocket.prototype.left = function () {
            this.sendKey('KEY_LEFT');
        };
        SamsungTVWebSocket.prototype.right = function () {
            this.sendKey('KEY_RIGHT');
        };
        SamsungTVWebSocket.prototype.enter = function () {
            this.sendKey('KEY_ENTER');
        };
        SamsungTVWebSocket.prototype.back = function () {
            this.sendKey('KEY_RETURN');
        };
        SamsungTVWebSocket.prototype.exit = function () {
            this.sendKey('KEY_EXIT');
        };
        SamsungTVWebSocket.prototype.menu = function () {
            this.sendKey('KEY_MENU');
        };
        SamsungTVWebSocket.prototype.home = function () {
            this.sendKey('KEY_HOME');
        };
        SamsungTVWebSocket.prototype.tools = function () {
            this.sendKey('KEY_TOOLS');
        };
        SamsungTVWebSocket.prototype.info = function () {
            this.sendKey('KEY_INFO');
        };
        SamsungTVWebSocket.prototype.changeSource = function () {
            this.sendKey('KEY_SOURCE');
        };
        SamsungTVWebSocket.prototype.play = function () {
            this.sendKey('KEY_PLAY');
        };
        SamsungTVWebSocket.prototype.pause = function () {
            this.sendKey('KEY_PAUSE');
        };
        SamsungTVWebSocket.prototype.stop = function () {
            this.sendKey('KEY_STOP');
        };
        SamsungTVWebSocket.prototype.rewind = function () {
            this.sendKey('KEY_REWIND');
        };
        SamsungTVWebSocket.prototype.fastForward = function () {
            this.sendKey('KEY_FF');
        };
        SamsungTVWebSocket.prototype.record = function () {
            this.sendKey('KEY_REC');
        };
        SamsungTVWebSocket.prototype.sendCommand = function (key) {
            this.sendKey(key);
        };
        SamsungTVWebSocket.prototype.selectHDMI = function (input) {
            if (input < 1 || input > 4) {
                console.error('HDMI input must be between 1 and 4');
                return;
            }
            this.sendKey('KEY_HDMI' + input);
            this.mSource = 'HDMI' + input;
        };
        SamsungTVWebSocket.prototype.pressNumber = function (num) {
            if (num < 0 || num > 9) {
                console.error('Number must be between 0 and 9');
                return;
            }
            this.sendKey('KEY_' + num);
        };
        SamsungTVWebSocket.prototype.pictureMode = function () {
            this.sendKey('KEY_PMODE');
        };
        SamsungTVWebSocket.prototype.pictureSize = function () {
            this.sendKey('KEY_PICTURE_SIZE');
        };
        __decorate([
            (0, Metadata_1.callable)("Connect to Samsung TV"),
            __param(0, (0, Metadata_1.parameter)("TV IP address")),
            __param(1, (0, Metadata_1.parameter)("Port (8001=ws, 8002=wss)", true)),
            __param(2, (0, Metadata_1.parameter)("Auth token (optional)", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String, Number, String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "connect", null);
        __decorate([
            (0, Metadata_1.callable)("Disconnect from Samsung TV"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "disconnect", null);
        __decorate([
            (0, Metadata_1.callable)("Reconnect to Samsung TV"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "reconnect", null);
        __decorate([
            (0, Metadata_1.property)("Connection status"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], SamsungTVWebSocket.prototype, "isConnected", null);
        __decorate([
            (0, Metadata_1.property)("Power state"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], SamsungTVWebSocket.prototype, "power", null);
        __decorate([
            (0, Metadata_1.property)("Volume level (0-100)"),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], SamsungTVWebSocket.prototype, "volume", null);
        __decorate([
            (0, Metadata_1.property)("Mute status"),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [Boolean])
        ], SamsungTVWebSocket.prototype, "muted", null);
        __decorate([
            (0, Metadata_1.property)("Current input source"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], SamsungTVWebSocket.prototype, "source", null);
        __decorate([
            (0, Metadata_1.callable)('Power on the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "powerOn", null);
        __decorate([
            (0, Metadata_1.callable)('Power off the TV'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "powerOff", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle power state'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "powerToggle", null);
        __decorate([
            (0, Metadata_1.callable)('Increase volume'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "volumeUp", null);
        __decorate([
            (0, Metadata_1.callable)('Decrease volume'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "volumeDown", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle mute'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "toggleMute", null);
        __decorate([
            (0, Metadata_1.callable)('Next channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "channelUp", null);
        __decorate([
            (0, Metadata_1.callable)('Previous channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "channelDown", null);
        __decorate([
            (0, Metadata_1.callable)('Return to previous channel'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "previousChannel", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate up'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "up", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate down'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "down", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate left'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "left", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate right'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "right", null);
        __decorate([
            (0, Metadata_1.callable)('Select/Enter'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "enter", null);
        __decorate([
            (0, Metadata_1.callable)('Back/Return'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "back", null);
        __decorate([
            (0, Metadata_1.callable)('Exit'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "exit", null);
        __decorate([
            (0, Metadata_1.callable)('Open main menu'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "menu", null);
        __decorate([
            (0, Metadata_1.callable)('Open home screen'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "home", null);
        __decorate([
            (0, Metadata_1.callable)('Open tools menu'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "tools", null);
        __decorate([
            (0, Metadata_1.callable)('Open info display'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "info", null);
        __decorate([
            (0, Metadata_1.callable)('Change input source'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "changeSource", null);
        __decorate([
            (0, Metadata_1.callable)('Play'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "play", null);
        __decorate([
            (0, Metadata_1.callable)('Pause'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "pause", null);
        __decorate([
            (0, Metadata_1.callable)('Stop'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "stop", null);
        __decorate([
            (0, Metadata_1.callable)('Rewind'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "rewind", null);
        __decorate([
            (0, Metadata_1.callable)('Fast forward'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "fastForward", null);
        __decorate([
            (0, Metadata_1.callable)('Record'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "record", null);
        __decorate([
            (0, Metadata_1.callable)('Send custom key command'),
            __param(0, (0, Metadata_1.parameter)('Key command (e.g., KEY_HDMI, KEY_MENU)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "sendCommand", null);
        __decorate([
            (0, Metadata_1.callable)('Select HDMI input'),
            __param(0, (0, Metadata_1.parameter)('HDMI input number (1-4)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "selectHDMI", null);
        __decorate([
            (0, Metadata_1.callable)('Press number key'),
            __param(0, (0, Metadata_1.parameter)('Number (0-9)')),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number]),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "pressNumber", null);
        __decorate([
            (0, Metadata_1.callable)('Cycle picture mode'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "pictureMode", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle picture size'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "pictureSize", null);
        return SamsungTVWebSocket;
    }(Script_1.Script));
    exports.SamsungTVWebSocket = SamsungTVWebSocket;
});
