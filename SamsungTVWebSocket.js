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
define(["require", "exports", "system/SimpleWebsocket", "system/SimpleFile", "system_lib/Metadata", "system_lib/Script"], function (require, exports, SimpleWebsocket_1, SimpleFile_1, Metadata_1, Script_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SamsungTVWebSocket = void 0;
    var TVConnection = (function () {
        function TVConnection(host, port, token) {
            if (port === void 0) { port = 8001; }
            if (token === void 0) { token = ""; }
            this.ws = null;
            this.authToken = "";
            this.connected = false;
            this.connecting = false;
            this.powerState = false;
            this.host = host;
            this.port = port;
            this.useSSL = port === 8002;
            this.authToken = token;
        }
        TVConnection.prototype.getId = function () {
            return "".concat(this.host, ":").concat(this.port);
        };
        return TVConnection;
    }());
    var SamsungTVWebSocket = (function (_super) {
        __extends(SamsungTVWebSocket, _super);
        function SamsungTVWebSocket(env) {
            var _this = _super.call(this, env) || this;
            _this.tvConnections = {};
            _this.defaultTvId = "";
            _this.remoteName = "Blocks Remote";
            _this.tokenFile = "samsung-tv-tokens.json";
            _this.loadTokens();
            return _this;
        }
        SamsungTVWebSocket.prototype.loadTokens = function () {
            return __awaiter(this, void 0, void 0, function () {
                var data, tokensData, tvId, tvData, connection, keys, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            if (!(SimpleFile_1.SimpleFile.exists(this.tokenFile) === 1)) return [3, 2];
                            return [4, SimpleFile_1.SimpleFile.read(this.tokenFile)];
                        case 1:
                            data = _a.sent();
                            tokensData = JSON.parse(data);
                            for (tvId in tokensData) {
                                if (tokensData.hasOwnProperty(tvId)) {
                                    tvData = tokensData[tvId];
                                    connection = new TVConnection(tvData.host, tvData.port, tvData.token);
                                    this.tvConnections[tvId] = connection;
                                    console.log("Loaded saved token for TV: ".concat(tvId));
                                }
                            }
                            keys = Object.keys(this.tvConnections);
                            if (keys.length > 0 && !this.defaultTvId) {
                                this.defaultTvId = keys[0];
                            }
                            _a.label = 2;
                        case 2: return [3, 4];
                        case 3:
                            error_1 = _a.sent();
                            console.warn("Could not load saved tokens:", error_1);
                            return [3, 4];
                        case 4: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.saveTokens = function () {
            return __awaiter(this, void 0, void 0, function () {
                var tokensData, tvId, connection, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            tokensData = {};
                            for (tvId in this.tvConnections) {
                                if (this.tvConnections.hasOwnProperty(tvId)) {
                                    connection = this.tvConnections[tvId];
                                    if (connection.authToken) {
                                        tokensData[tvId] = {
                                            host: connection.host,
                                            port: connection.port,
                                            token: connection.authToken
                                        };
                                    }
                                }
                            }
                            return [4, SimpleFile_1.SimpleFile.write(this.tokenFile, JSON.stringify(tokensData, null, 2))];
                        case 1:
                            _a.sent();
                            console.log("Tokens saved successfully");
                            return [3, 3];
                        case 2:
                            error_2 = _a.sent();
                            console.error("Failed to save tokens:", error_2);
                            return [3, 3];
                        case 3: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.getTVConnection = function (tvId) {
            var id = tvId || this.defaultTvId;
            if (!id) {
                console.error("No TV ID specified and no default TV set. Use connect() first.");
                return null;
            }
            var connection = this.tvConnections[id];
            if (!connection) {
                console.error("TV connection not found: ".concat(id));
                return null;
            }
            return connection;
        };
        SamsungTVWebSocket.prototype.connect = function (host, port, token) {
            return __awaiter(this, void 0, void 0, function () {
                var tvPort, tvId, connection;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            tvPort = port || 8001;
                            tvId = "".concat(host, ":").concat(tvPort);
                            connection = this.tvConnections[tvId];
                            if (!connection) {
                                connection = new TVConnection(host, tvPort, token || "");
                                this.tvConnections[tvId] = connection;
                            }
                            else {
                                if (token) {
                                    connection.authToken = token;
                                }
                            }
                            if (!this.defaultTvId) {
                                this.defaultTvId = tvId;
                            }
                            return [4, this.connectWebSocket(connection)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.connectWebSocket = function (connection) {
            return __awaiter(this, void 0, void 0, function () {
                var protocol, encodedName, url, headers, _a, error_3;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (connection.connecting || connection.connected) {
                                return [2];
                            }
                            connection.connecting = true;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, 4, 5]);
                            protocol = connection.useSSL ? "wss" : "ws";
                            encodedName = this.base64Encode(this.remoteName);
                            url = "".concat(protocol, "://").concat(connection.host, ":").concat(connection.port, "/api/v2/channels/samsung.remote.control?name=").concat(encodedName);
                            if (connection.authToken) {
                                url += "&token=".concat(connection.authToken);
                            }
                            console.log("Connecting to Samsung TV at ".concat(connection.getId()));
                            headers = {};
                            _a = connection;
                            return [4, SimpleWebsocket_1.SimpleWebsocket.connect(url, 65536, headers)];
                        case 2:
                            _a.ws = _b.sent();
                            connection.ws.subscribe('textReceived', function (sender, message) {
                                _this.handleMessage(connection, message.text);
                            });
                            connection.ws.subscribe('finish', function () {
                                console.log("WebSocket connection closed for ".concat(connection.getId()));
                                connection.connected = false;
                                connection.ws = null;
                            });
                            connection.connected = true;
                            console.log("Connected to Samsung TV: ".concat(connection.getId()));
                            return [3, 5];
                        case 3:
                            error_3 = _b.sent();
                            console.error("Failed to connect to Samsung TV ".concat(connection.getId(), ":"), error_3);
                            connection.connected = false;
                            connection.ws = null;
                            return [3, 5];
                        case 4:
                            connection.connecting = false;
                            return [7];
                        case 5: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.disconnect = function (tvId) {
            if (tvId) {
                var connection = this.tvConnections[tvId];
                if (connection && connection.ws) {
                    try {
                        connection.ws.disconnect();
                    }
                    catch (e) {
                        console.error("Error disconnecting from ".concat(tvId, ":"), e);
                    }
                    connection.ws = null;
                    connection.connected = false;
                }
            }
            else {
                for (var id in this.tvConnections) {
                    if (this.tvConnections.hasOwnProperty(id)) {
                        var connection = this.tvConnections[id];
                        if (connection.ws) {
                            try {
                                connection.ws.disconnect();
                            }
                            catch (e) {
                                console.error("Error disconnecting from ".concat(id, ":"), e);
                            }
                            connection.ws = null;
                            connection.connected = false;
                        }
                    }
                }
            }
        };
        SamsungTVWebSocket.prototype.handleMessage = function (connection, text) {
            try {
                var message = JSON.parse(text);
                if (message.event === 'ms.channel.connect') {
                    console.log("Connection established for ".concat(connection.getId(), ":"), message.data);
                    if (message.data && message.data.token) {
                        connection.authToken = message.data.token;
                        console.log("Received auth token for ".concat(connection.getId()));
                        this.saveTokens();
                    }
                }
                else if (message.event === 'ms.channel.unauthorized') {
                    console.warn("Unauthorized for ".concat(connection.getId(), " - TV may require pairing approval on TV screen"));
                }
                else {
                    console.log("Received message from ".concat(connection.getId(), ":"), message);
                }
            }
            catch (e) {
                console.warn("Failed to parse message from ".concat(connection.getId(), ":"), text);
            }
        };
        SamsungTVWebSocket.prototype.sendKey = function (keyCode, tvId) {
            return __awaiter(this, void 0, void 0, function () {
                var connection, error_4, command;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            connection = this.getTVConnection(tvId);
                            if (!connection) {
                                return [2];
                            }
                            if (!!connection.connected) return [3, 5];
                            console.log("Not connected to ".concat(connection.getId(), ", attempting to reconnect..."));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 4, , 5]);
                            return [4, this.connectWebSocket(connection)];
                        case 2:
                            _a.sent();
                            return [4, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                        case 3:
                            _a.sent();
                            return [3, 5];
                        case 4:
                            error_4 = _a.sent();
                            console.error("Failed to reconnect to ".concat(connection.getId(), ":"), error_4);
                            return [2];
                        case 5:
                            if (!connection.connected || !connection.ws) {
                                console.error("Still not connected to ".concat(connection.getId(), ". Please check TV is on."));
                                return [2];
                            }
                            command = {
                                method: "ms.remote.control",
                                params: {
                                    Cmd: "Click",
                                    DataOfCmd: keyCode,
                                    Option: "false",
                                    TypeOfRemote: "SendRemoteKey"
                                }
                            };
                            try {
                                connection.ws.sendText(JSON.stringify(command));
                                console.log("Sent command to ".concat(connection.getId(), ": ").concat(keyCode));
                            }
                            catch (error) {
                                console.error("Failed to send key to ".concat(connection.getId(), ":"), error);
                            }
                            return [2];
                    }
                });
            });
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
        Object.defineProperty(SamsungTVWebSocket.prototype, "defaultTV", {
            get: function () {
                return this.defaultTvId;
            },
            set: function (tvId) {
                if (this.tvConnections[tvId]) {
                    this.defaultTvId = tvId;
                    console.log("Default TV set to: ".concat(tvId));
                }
                else {
                    console.error("TV not found: ".concat(tvId));
                }
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SamsungTVWebSocket.prototype, "connectedTVs", {
            get: function () {
                var connected = [];
                for (var id in this.tvConnections) {
                    if (this.tvConnections.hasOwnProperty(id)) {
                        var connection = this.tvConnections[id];
                        if (connection.connected) {
                            connected.push(id);
                        }
                    }
                }
                return connected.join(', ');
            },
            enumerable: false,
            configurable: true
        });
        SamsungTVWebSocket.prototype.powerOn = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                var connection;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            connection = this.getTVConnection(tvId);
                            if (!connection)
                                return [2];
                            if (!!connection.powerState) return [3, 2];
                            return [4, this.sendKey('KEY_POWER', tvId)];
                        case 1:
                            _a.sent();
                            connection.powerState = true;
                            _a.label = 2;
                        case 2: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.powerOff = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                var connection;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            connection = this.getTVConnection(tvId);
                            if (!connection)
                                return [2];
                            if (!connection.powerState) return [3, 2];
                            return [4, this.sendKey('KEY_POWER', tvId)];
                        case 1:
                            _a.sent();
                            connection.powerState = false;
                            _a.label = 2;
                        case 2: return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.powerToggle = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                var connection;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            connection = this.getTVConnection(tvId);
                            if (!connection)
                                return [2];
                            return [4, this.sendKey('KEY_POWER', tvId)];
                        case 1:
                            _a.sent();
                            connection.powerState = !connection.powerState;
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.volumeUp = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_VOLUP', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.volumeDown = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_VOLDOWN', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.toggleMute = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_MUTE', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.channelUp = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_CHUP', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.channelDown = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_CHDOWN', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.previousChannel = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_PRECH', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.up = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_UP', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.down = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_DOWN', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.left = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_LEFT', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.right = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_RIGHT', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.enter = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_ENTER', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.back = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_RETURN', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.exit = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_EXIT', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.menu = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_MENU', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.home = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_HOME', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.tools = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_TOOLS', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.info = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_INFO', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.changeSource = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_SOURCE', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.play = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_PLAY', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.pause = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_PAUSE', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.stop = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_STOP', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.rewind = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_REWIND', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.fastForward = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_FF', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.record = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_REC', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.sendCommand = function (key, tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey(key, tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.selectHDMI = function (input, tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (input < 1 || input > 4) {
                                console.error('HDMI input must be between 1 and 4');
                                return [2];
                            }
                            return [4, this.sendKey('KEY_HDMI' + input, tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.pressNumber = function (num, tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (num < 0 || num > 9) {
                                console.error('Number must be between 0 and 9');
                                return [2];
                            }
                            return [4, this.sendKey('KEY_' + num, tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.pictureMode = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_PMODE', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.pictureSize = function (tvId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.sendKey('KEY_PICTURE_SIZE', tvId)];
                        case 1:
                            _a.sent();
                            return [2];
                    }
                });
            });
        };
        SamsungTVWebSocket.prototype.listTVs = function () {
            var tvList = [];
            for (var id in this.tvConnections) {
                if (this.tvConnections.hasOwnProperty(id)) {
                    var connection = this.tvConnections[id];
                    var status_1 = connection.connected ? "connected" : "disconnected";
                    var isDefault = id === this.defaultTvId ? " (default)" : "";
                    tvList.push("".concat(id, " - ").concat(status_1).concat(isDefault));
                }
            }
            return tvList.join('\n') || 'No TVs configured';
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
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) or leave empty for all", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", void 0)
        ], SamsungTVWebSocket.prototype, "disconnect", null);
        __decorate([
            (0, Metadata_1.property)("Default TV ID"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [String])
        ], SamsungTVWebSocket.prototype, "defaultTV", null);
        __decorate([
            (0, Metadata_1.property)("Connected TVs (comma-separated)"),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [])
        ], SamsungTVWebSocket.prototype, "connectedTVs", null);
        __decorate([
            (0, Metadata_1.callable)('Power on the TV'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "powerOn", null);
        __decorate([
            (0, Metadata_1.callable)('Power off the TV'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "powerOff", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle power state'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "powerToggle", null);
        __decorate([
            (0, Metadata_1.callable)('Increase volume'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "volumeUp", null);
        __decorate([
            (0, Metadata_1.callable)('Decrease volume'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "volumeDown", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle mute'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "toggleMute", null);
        __decorate([
            (0, Metadata_1.callable)('Next channel'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "channelUp", null);
        __decorate([
            (0, Metadata_1.callable)('Previous channel'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "channelDown", null);
        __decorate([
            (0, Metadata_1.callable)('Return to previous channel'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "previousChannel", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate up'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "up", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate down'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "down", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate left'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "left", null);
        __decorate([
            (0, Metadata_1.callable)('Navigate right'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "right", null);
        __decorate([
            (0, Metadata_1.callable)('Select/Enter'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "enter", null);
        __decorate([
            (0, Metadata_1.callable)('Back/Return'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "back", null);
        __decorate([
            (0, Metadata_1.callable)('Exit'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "exit", null);
        __decorate([
            (0, Metadata_1.callable)('Open main menu'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "menu", null);
        __decorate([
            (0, Metadata_1.callable)('Open home screen'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "home", null);
        __decorate([
            (0, Metadata_1.callable)('Open tools menu'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "tools", null);
        __decorate([
            (0, Metadata_1.callable)('Open info display'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "info", null);
        __decorate([
            (0, Metadata_1.callable)('Change input source'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "changeSource", null);
        __decorate([
            (0, Metadata_1.callable)('Play'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "play", null);
        __decorate([
            (0, Metadata_1.callable)('Pause'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "pause", null);
        __decorate([
            (0, Metadata_1.callable)('Stop'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "stop", null);
        __decorate([
            (0, Metadata_1.callable)('Rewind'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "rewind", null);
        __decorate([
            (0, Metadata_1.callable)('Fast forward'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "fastForward", null);
        __decorate([
            (0, Metadata_1.callable)('Record'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "record", null);
        __decorate([
            (0, Metadata_1.callable)('Send custom key command'),
            __param(0, (0, Metadata_1.parameter)('Key command (e.g., KEY_HDMI, KEY_MENU)')),
            __param(1, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String, String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "sendCommand", null);
        __decorate([
            (0, Metadata_1.callable)('Select HDMI input'),
            __param(0, (0, Metadata_1.parameter)('HDMI input number (1-4)')),
            __param(1, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "selectHDMI", null);
        __decorate([
            (0, Metadata_1.callable)('Press number key'),
            __param(0, (0, Metadata_1.parameter)('Number (0-9)')),
            __param(1, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "pressNumber", null);
        __decorate([
            (0, Metadata_1.callable)('Cycle picture mode'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "pictureMode", null);
        __decorate([
            (0, Metadata_1.callable)('Toggle picture size'),
            __param(0, (0, Metadata_1.parameter)("TV ID (host:port) - optional", true)),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [String]),
            __metadata("design:returntype", Promise)
        ], SamsungTVWebSocket.prototype, "pictureSize", null);
        __decorate([
            (0, Metadata_1.callable)('List all configured TVs'),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", String)
        ], SamsungTVWebSocket.prototype, "listTVs", null);
        return SamsungTVWebSocket;
    }(Script_1.Script));
    exports.SamsungTVWebSocket = SamsungTVWebSocket;
});
