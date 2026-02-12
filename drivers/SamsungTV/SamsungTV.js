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
define(["require", "exports", "system_lib/Driver", "system/SimpleHTTP", "system/SimpleWebsocket", "system_lib/Metadata"], function (require, exports, Driver_1, SimpleHTTP_1, SimpleWebsocket_1, Meta) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SamsungTV = void 0;
    
    var SamsungTV = (function (_super) {
        __extends(SamsungTV, _super);
        
        function SamsungTV(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.mConnected = false;
            _this.mPowerState = false;
            _this.commandQueue = [];
            _this.mModelName = "";
            _this.mDeviceName = "";
            _this.mVolume = 0;
            _this.mMuted = false;
            _this.mSource = "";
            _this.mScreenOn = false;
            _this.DEFAULT_REMOTE_NAME = "PIXILAB Blocks";
            
            // Parse options
            _this.options = _this.parseOptions(socket.options);
            
            // Encode remote name
            var remoteName = _this.options.name || _this.DEFAULT_REMOTE_NAME;
            _this.encodedName = _this.base64Encode(remoteName);
            
            console.warn("SamsungTV driver v2.0 (WebSocket) initialized for:", socket.address);
            console.warn("Remote name:", remoteName);
            console.warn("Token configured:", _this.options.token ? "Yes" : "No");
            
            // DON'T use TCP socket for connection management - Samsung closes it quickly
            // Just use it to get the IP address, then manage WebSocket independently
            
            // Start WebSocket connection directly
            _this.startConnection();
            
            return _this;
        }
        
        SamsungTV.prototype.parseOptions = function (optionsStr) {
            try {
                if (optionsStr) {
                    var parsed = JSON.parse(optionsStr);
                    console.warn("Parsed options:", JSON.stringify(parsed));
                    return parsed;
                }
            } catch (e) {
                console.warn("Failed to parse options:", e);
            }
            return {};
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
                result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
                result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
            }
            
            return result;
        };
        
        SamsungTV.prototype.startConnection = function () {
            var _this = this;
            console.warn("=== STARTING CONNECTION ===");
            
            this.checkTVStatus().then(function (available) {
                if (available) {
                    _this.mPowerState = true;
                    _this.changed('power');
                    _this.connectWebSocket();
                } else {
                    console.warn("TV not responding - might be in standby");
                    _this.mPowerState = false;
                    _this.changed('power');
                    // Retry after delay
                    _this.scheduleReconnect(10000);
                }
            });
        };
        
        SamsungTV.prototype.checkTVStatus = function () {
            var _this = this;
            var url = "http://" + this.socket.address + ":8001/api/v2/";
            
            return SimpleHTTP_1.SimpleHTTP.newRequest(url)
                .get()
                .then(function (response) {
                    try {
                        var data = response.data;
                        if (typeof data === 'string') {
                            data = JSON.parse(data);
                        }
                        
                        if (data && data.device) {
                            _this.mModelName = data.device.modelName || "";
                            _this.mDeviceName = data.device.name || "";
                            
                            // Update screenOn from PowerState
                            var powerState = data.device.PowerState || "unknown";
                            var isOn = powerState === "on";
                            if (_this.mScreenOn !== isOn) {
                                _this.mScreenOn = isOn;
                                _this.changed('screenOn');
                            }
                            
                            console.warn("TV found:", _this.mModelName, "-", _this.mDeviceName, "- Screen:", isOn ? "ON" : "OFF");
                            return true;
                        }
                    } catch (e) {
                        console.warn("Error parsing TV info:", e);
                    }
                    return false;
                })
                .catch(function (error) {
                    console.warn("TV not responding:", error);
                    return false;
                });
        };
        
        SamsungTV.prototype.connectWebSocket = function () {
            var _this = this;
            
            var port = this.options.useSSL ? 8002 : 8001;
            var protocol = this.options.useSSL ? "wss" : "ws";
            var wsUrl = protocol + "://" + this.socket.address + ":" + port + "/api/v2/channels/samsung.remote.control?name=" + this.encodedName;
            
            if (this.options.token) {
                wsUrl += "&token=" + this.options.token;
            }
            
            console.warn("Connecting WebSocket to:", wsUrl);
            
            SimpleWebsocket_1.SimpleWebsocket.connect(wsUrl, 8192)
                .then(function (ws) {
                    console.warn("WebSocket connected successfully!");
                    _this.ws = ws;
                    _this.mConnected = true;
                    _this.changed('connected');
                    
                    ws.subscribe('textReceived', _this.onWebSocketMessage.bind(_this));
                    ws.subscribe('finish', _this.onWebSocketDisconnected.bind(_this));
                    
                    // Start keepalive ping
                    _this.startKeepAlive();
                    
                    // Process any queued commands
                    _this.processCommandQueue();
                })
                .catch(function (error) {
                    console.error("WebSocket connection failed:", error);
                    console.warn("This may require pairing - check TV for prompt");
                    _this.mConnected = false;
                    _this.changed('connected');
                    
                    _this.scheduleReconnect(2000);
                });
        };
        
        SamsungTV.prototype.onWebSocketMessage = function (sender, message) {
            try {
                var data = JSON.parse(message.text);
                console.warn("WS received:", data.event || data.type || "unknown");
                
                if (data.event === "ms.channel.connect") {
                    console.warn("Successfully paired with TV!");
                    
                    if (data.data && data.data.token) {
                        console.warn("New token received:", data.data.token);
                        console.warn(">>> SAVE THIS TOKEN IN DRIVER OPTIONS <<<");
                    }
                } else if (data.event === "ms.error") {
                    console.error("TV error:", data.data);
                }
                
            } catch (e) {
                console.warn("Error parsing WS message:", e);
            }
        };
        
        SamsungTV.prototype.onWebSocketDisconnected = function (sender) {
            console.warn("WebSocket disconnected");
            this.ws = undefined;
            this.mConnected = false;
            this.changed('connected');
            
            // Always try to reconnect
            this.scheduleReconnect(5000);
        };
        
        SamsungTV.prototype.scheduleReconnect = function (delayMs) {
            var _this = this;
            if (this.wsReconnectTimer) {
                this.wsReconnectTimer.cancel();
            }
            
            console.warn("Scheduling reconnect in " + delayMs + "ms");
            this.wsReconnectTimer = wait(delayMs);
            this.wsReconnectTimer.then(function () {
                if (!_this.ws) {
                    _this.startConnection();
                }
            }).catch(function () {});
        };
        
        SamsungTV.prototype.disconnectWebSocket = function () {
            this.stopKeepAlive();
            
            if (this.wsReconnectTimer) {
                this.wsReconnectTimer.cancel();
                this.wsReconnectTimer = undefined;
            }
            
            if (this.ws) {
                console.warn("Disconnecting WebSocket");
                this.ws.disconnect();
                this.ws = undefined;
            }
        };
        
        SamsungTV.prototype.startKeepAlive = function () {
            var _this = this;
            this.stopKeepAlive();
            
            var pingInterval = 30000; // 30 seconds
            console.warn("Starting keepalive ping every " + pingInterval + "ms");
            
            var doPing = function () {
                if (_this.ws && _this.mConnected) {
                    var pingMessage = {
                        method: "ms.remote.control",
                        params: {
                            Cmd: "Click",
                            DataOfCmd: "KEY_UNKNOWN",
                            Option: "false",
                            TypeOfRemote: "SendRemoteKey"
                        }
                    };
                    _this.ws.sendText(JSON.stringify(pingMessage));
                    
                    _this.keepAliveTimer = wait(pingInterval);
                    _this.keepAliveTimer.then(doPing).catch(function () {});
                }
            };
            
            this.keepAliveTimer = wait(pingInterval);
            this.keepAliveTimer.then(doPing).catch(function () {});
        };
        
        SamsungTV.prototype.stopKeepAlive = function () {
            if (this.keepAliveTimer) {
                this.keepAliveTimer.cancel();
                this.keepAliveTimer = undefined;
            }
        };
        
        SamsungTV.prototype.processCommandQueue = function () {
            while (this.commandQueue.length > 0 && this.ws && this.mConnected) {
                var key = this.commandQueue.shift();
                if (key) {
                    console.warn("Processing queued command:", key);
                    this.sendKeyDirect(key);
                }
            }
        };
        
        SamsungTV.prototype.sendKeyDirect = function (key) {
            if (!this.ws) return;
            
            var message = {
                method: "ms.remote.control",
                params: {
                    Cmd: "Click",
                    DataOfCmd: key,
                    Option: "false",
                    TypeOfRemote: "SendRemoteKey"
                }
            };
            
            this.ws.sendText(JSON.stringify(message));
        };
        
        SamsungTV.prototype.sendKey = function (key) {
            console.warn("Sending key:", key);
            
            if (!this.ws || !this.mConnected) {
                console.warn("Not connected - queueing command:", key);
                this.commandQueue.push(key);
                
                // Try to reconnect immediately if not already trying
                if (!this.ws && !this.wsReconnectTimer) {
                    this.startConnection();
                }
                return;
            }
            
            this.sendKeyDirect(key);
        };
        
        // ============================================
        // PROPERTIES
        // ============================================
        
        Object.defineProperty(SamsungTV.prototype, "connected", {
            get: function () { return this.mConnected; },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "power", {
            get: function () { return this.mPowerState; },
            set: function (on) {
                if (on && !this.mPowerState) {
                    this.powerOn();
                } else if (!on && this.mPowerState) {
                    this.powerOff();
                }
            },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "screenOn", {
            get: function () { return this.mScreenOn; },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "modelName", {
            get: function () { return this.mModelName; },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "deviceName", {
            get: function () { return this.mDeviceName; },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "volume", {
            get: function () { return this.mVolume; },
            set: function (level) { this.mVolume = Math.max(0, Math.min(100, level)); },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "muted", {
            get: function () { return this.mMuted; },
            set: function (mute) {
                if (mute !== this.mMuted) {
                    this.toggleMute();
                }
            },
            enumerable: false, configurable: true
        });
        
        Object.defineProperty(SamsungTV.prototype, "source", {
            get: function () { return this.mSource; },
            enumerable: false, configurable: true
        });
        
        // ============================================
        // CALLABLE METHODS - Power
        // ============================================
        
        SamsungTV.prototype.powerOn = function () {
            var _this = this;
            console.warn("Power ON requested");
            
            // Check if TV is already on
            this.checkTVPowerState().then(function (isOn) {
                if (isOn) {
                    console.warn("TV already on - skipping power command");
                } else {
                    console.warn("TV is off - sending KEY_POWER to turn on");
                    _this.sendKey("KEY_POWER");
                    // Update screenOn immediately
                    _this.mScreenOn = true;
                    _this.changed('screenOn');
                    // Verify after delay
                    _this.scheduleStateVerify(3000);
                }
                _this.mPowerState = true;
                _this.changed('power');
            });
        };
        
        SamsungTV.prototype.powerOff = function () {
            var _this = this;
            console.warn("Power OFF requested");
            
            // Check if TV is already off
            this.checkTVPowerState().then(function (isOn) {
                if (!isOn) {
                    console.warn("TV already off - skipping power command");
                } else {
                    console.warn("TV is on - sending KEY_POWER to turn off");
                    _this.sendKey("KEY_POWER");
                    // Update screenOn immediately
                    _this.mScreenOn = false;
                    _this.changed('screenOn');
                    // Verify after delay
                    _this.scheduleStateVerify(3000);
                }
                _this.mPowerState = false;
                _this.changed('power');
            });
        };
        
        SamsungTV.prototype.powerToggle = function () {
            console.warn("Power TOGGLE requested");
            this.sendKey("KEY_POWER");
            // Toggle screenOn immediately
            this.mScreenOn = !this.mScreenOn;
            this.changed('screenOn');
            this.mPowerState = !this.mPowerState;
            this.changed('power');
            // Verify after delay
            this.scheduleStateVerify(3000);
        };
        
        SamsungTV.prototype.scheduleStateVerify = function (delayMs) {
            var _this = this;
            if (this.stateVerifyTimer) {
                this.stateVerifyTimer.cancel();
            }
            this.stateVerifyTimer = wait(delayMs);
            this.stateVerifyTimer.then(function () {
                console.warn("Verifying TV power state...");
                _this.checkTVPowerState();
            }).catch(function () {});
        };
        
        SamsungTV.prototype.checkTVPowerState = function () {
            var _this = this;
            var url = "http://" + this.socket.address + ":8001/api/v2/";
            
            return SimpleHTTP_1.SimpleHTTP.newRequest(url)
                .get()
                .then(function (response) {
                    try {
                        var data = response.data;
                        if (typeof data === 'string') {
                            data = JSON.parse(data);
                        }
                        
                        if (data && data.device) {
                            var powerState = data.device.PowerState || "unknown";
                            console.warn("TV PowerState:", powerState);
                            
                            // Update screenOn property
                            var isOn = powerState === "on";
                            if (_this.mScreenOn !== isOn) {
                                _this.mScreenOn = isOn;
                                _this.changed('screenOn');
                            }
                            return isOn;
                        }
                    } catch (e) {
                        console.warn("Error checking power state:", e);
                    }
                    return false;
                })
                .catch(function (error) {
                    console.warn("Could not check power state:", error);
                    return false;
                });
        };
        
        // ============================================
        // CALLABLE METHODS - Volume
        // ============================================
        
        SamsungTV.prototype.volumeUp = function () {
            this.sendKey("KEY_VOLUP");
            if (this.mVolume < 100) {
                this.mVolume++;
                this.changed('volume');
            }
        };
        
        SamsungTV.prototype.volumeDown = function () {
            this.sendKey("KEY_VOLDOWN");
            if (this.mVolume > 0) {
                this.mVolume--;
                this.changed('volume');
            }
        };
        
        SamsungTV.prototype.toggleMute = function () {
            this.sendKey("KEY_MUTE");
            this.mMuted = !this.mMuted;
            this.changed('muted');
        };
        
        // ============================================
        // CALLABLE METHODS - Input/Source
        // ============================================
        
        SamsungTV.prototype.openSourceMenu = function () {
            this.sendKey("KEY_SOURCE");
        };
        
        SamsungTV.prototype.selectHDMI = function (input) {
            if (input < 1 || input > 4) {
                console.error("HDMI input must be between 1 and 4");
                return;
            }
            this.sendKey("KEY_HDMI" + input);
            this.mSource = "HDMI" + input;
            this.changed('source');
        };
        
        SamsungTV.prototype.hdmi1 = function () { this.selectHDMI(1); };
        SamsungTV.prototype.hdmi2 = function () { this.selectHDMI(2); };
        SamsungTV.prototype.hdmi3 = function () { this.selectHDMI(3); };
        SamsungTV.prototype.hdmi4 = function () { this.selectHDMI(4); };
        
        // ============================================
        // CALLABLE METHODS - Navigation
        // ============================================
        
        SamsungTV.prototype.up = function () { this.sendKey("KEY_UP"); };
        SamsungTV.prototype.down = function () { this.sendKey("KEY_DOWN"); };
        SamsungTV.prototype.left = function () { this.sendKey("KEY_LEFT"); };
        SamsungTV.prototype.right = function () { this.sendKey("KEY_RIGHT"); };
        SamsungTV.prototype.enter = function () { this.sendKey("KEY_ENTER"); };
        SamsungTV.prototype.back = function () { this.sendKey("KEY_RETURN"); };
        SamsungTV.prototype.exit = function () { this.sendKey("KEY_EXIT"); };
        SamsungTV.prototype.home = function () { this.sendKey("KEY_HOME"); };
        SamsungTV.prototype.menu = function () { this.sendKey("KEY_MENU"); };
        
        // ============================================
        // CALLABLE METHODS - Media
        // ============================================
        
        SamsungTV.prototype.play = function () { this.sendKey("KEY_PLAY"); };
        SamsungTV.prototype.pause = function () { this.sendKey("KEY_PAUSE"); };
        SamsungTV.prototype.stop = function () { this.sendKey("KEY_STOP"); };
        
        // ============================================
        // CALLABLE METHODS - Direct Key & Utility
        // ============================================
        
        SamsungTV.prototype.sendCommand = function (key) {
            this.sendKey(key);
        };
        
        SamsungTV.prototype.reconnect = function () {
            console.warn("Manual reconnect requested");
            this.disconnectWebSocket();
            this.startConnection();
        };
        
        SamsungTV.prototype.checkStatus = function () {
            var _this = this;
            return this.checkTVStatus().then(function (available) {
                console.warn("TV available:", available);
                _this.mPowerState = available;
                _this.changed('power');
            });
        };
        
        // ============================================
        // DECORATORS
        // ============================================
        
        __decorate([Meta.property("WebSocket connection status", true), __metadata("design:type", Boolean), __metadata("design:paramtypes", [])], SamsungTV.prototype, "connected", null);
        __decorate([Meta.property("TV power state (set)"), __metadata("design:type", Boolean), __metadata("design:paramtypes", [Boolean])], SamsungTV.prototype, "power", null);
        __decorate([Meta.property("Screen is on (actual PowerState from TV)", true), __metadata("design:type", Boolean), __metadata("design:paramtypes", [])], SamsungTV.prototype, "screenOn", null);
        __decorate([Meta.property("TV model name", true), __metadata("design:type", String), __metadata("design:paramtypes", [])], SamsungTV.prototype, "modelName", null);
        __decorate([Meta.property("TV device name", true), __metadata("design:type", String), __metadata("design:paramtypes", [])], SamsungTV.prototype, "deviceName", null);
        __decorate([Meta.property("Volume level (0-100)"), __metadata("design:type", Number), __metadata("design:paramtypes", [Number])], SamsungTV.prototype, "volume", null);
        __decorate([Meta.property("Mute state"), __metadata("design:type", Boolean), __metadata("design:paramtypes", [Boolean])], SamsungTV.prototype, "muted", null);
        __decorate([Meta.property("Current input source"), __metadata("design:type", String), __metadata("design:paramtypes", [])], SamsungTV.prototype, "source", null);
        
        __decorate([Meta.callable("Power on the TV"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "powerOn", null);
        __decorate([Meta.callable("Power off the TV"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "powerOff", null);
        __decorate([Meta.callable("Toggle power state"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "powerToggle", null);
        __decorate([Meta.callable("Increase volume"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "volumeUp", null);
        __decorate([Meta.callable("Decrease volume"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "volumeDown", null);
        __decorate([Meta.callable("Toggle mute"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "toggleMute", null);
        __decorate([Meta.callable("Open source/input menu"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "openSourceMenu", null);
        __decorate([Meta.callable("Select HDMI input"), Meta.parameter("HDMI input number (1-4)"), __metadata("design:type", Function), __metadata("design:paramtypes", [Number]), __metadata("design:returntype", void 0)], SamsungTV.prototype, "selectHDMI", null);
        __decorate([Meta.callable("Select HDMI 1"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "hdmi1", null);
        __decorate([Meta.callable("Select HDMI 2"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "hdmi2", null);
        __decorate([Meta.callable("Select HDMI 3"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "hdmi3", null);
        __decorate([Meta.callable("Select HDMI 4"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "hdmi4", null);
        __decorate([Meta.callable("Navigate up"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "up", null);
        __decorate([Meta.callable("Navigate down"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "down", null);
        __decorate([Meta.callable("Navigate left"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "left", null);
        __decorate([Meta.callable("Navigate right"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "right", null);
        __decorate([Meta.callable("Select/Enter"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "enter", null);
        __decorate([Meta.callable("Back/Return"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "back", null);
        __decorate([Meta.callable("Exit"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "exit", null);
        __decorate([Meta.callable("Home"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "home", null);
        __decorate([Meta.callable("Menu"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "menu", null);
        __decorate([Meta.callable("Play"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "play", null);
        __decorate([Meta.callable("Pause"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "pause", null);
        __decorate([Meta.callable("Stop"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "stop", null);
        __decorate([Meta.callable("Send any key command"), Meta.parameter("Key code (e.g., KEY_VOLUP, KEY_HDMI1)"), __metadata("design:type", Function), __metadata("design:paramtypes", [String]), __metadata("design:returntype", void 0)], SamsungTV.prototype, "sendCommand", null);
        __decorate([Meta.callable("Reconnect to TV"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", void 0)], SamsungTV.prototype, "reconnect", null);
        __decorate([Meta.callable("Check TV status"), __metadata("design:type", Function), __metadata("design:paramtypes", []), __metadata("design:returntype", Promise)], SamsungTV.prototype, "checkStatus", null);
        
        SamsungTV = __decorate([Meta.driver('NetworkTCP', { port: 8001 }), __metadata("design:paramtypes", [Object])], SamsungTV);
        
        return SamsungTV;
    }(Driver_1.Driver));
    
    exports.SamsungTV = SamsungTV;
});
