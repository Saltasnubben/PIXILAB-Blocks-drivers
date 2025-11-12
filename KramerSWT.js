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
    exports.KramerSWT = void 0;
    var KramerSWT = exports.KramerSWT = (function (_super) {
        __extends(KramerSWT, _super);
        function KramerSWT(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.mCurrentInput = 1;
            _this.mSignal1 = false;
            _this.mSignal2 = false;
            _this.mSignal3 = false;
            _this.mSignal4 = false;
            _this.receiveBuffer = '';
            
            console.warn("KramerSWT: Driver initialized");
            
            // Subscribe to connection state changes
            socket.subscribe('connect', function (sender, message) {
                console.warn("KramerSWT: Connection event, connected:", socket.connected);
                if (socket.connected) {
                    _this.onConnected();
                }
            });
            
            // Subscribe to incoming data
            socket.subscribe('textReceived', function (sender, message) {
                // message IS the text directly, not an object with .text property
                _this.handleData(message);
            });
            
            // Enable automatic connection management
            socket.autoConnect();
            
            // If already connected when driver loads, initialize now
            if (socket.connected) {
                console.warn("KramerSWT: Already connected at startup");
                _this.onConnected();
            }
            
            return _this;
        }
        
        /**
         * Called when connection is established
         */
        KramerSWT.prototype.onConnected = function () {
            console.warn("KramerSWT: Connected - querying initial state");
            // Query current routing state
            this.queryRouting();
        };
        
        Object.defineProperty(KramerSWT.prototype, "input", {
            get: function () {
                return this.mCurrentInput;
            },
            set: function (value) {
                if (value >= 1 && value <= 4) {
                    this.mCurrentInput = value;
                    this.sendCmd("#ROUTE 1,1," + value + "\r");
                }
            },
            enumerable: false,
            configurable: true
        });
        
        Object.defineProperty(KramerSWT.prototype, "signal1", {
            get: function () {
                return this.mSignal1;
            },
            enumerable: false,
            configurable: true
        });
        
        Object.defineProperty(KramerSWT.prototype, "signal2", {
            get: function () {
                return this.mSignal2;
            },
            enumerable: false,
            configurable: true
        });
        
        Object.defineProperty(KramerSWT.prototype, "signal3", {
            get: function () {
                return this.mSignal3;
            },
            enumerable: false,
            configurable: true
        });
        
        Object.defineProperty(KramerSWT.prototype, "signal4", {
            get: function () {
                return this.mSignal4;
            },
            enumerable: false,
            configurable: true
        });
        
        Object.defineProperty(KramerSWT.prototype, "connected", {
            get: function () {
                return this.socket.connected;
            },
            enumerable: false,
            configurable: true
        });
        
        KramerSWT.prototype.identify = function () {
            this.sendCmd('#IDV\r');
        };
        
        KramerSWT.prototype.queryRouting = function () {
            this.sendCmd('#ROUTE? 1,1\r');
        };
        
        KramerSWT.prototype.querySignal1 = function () {
            this.sendCmd('#SIGNAL? 1\r');
        };
        
        KramerSWT.prototype.querySignal2 = function () {
            this.sendCmd('#SIGNAL? 2\r');
        };
        
        KramerSWT.prototype.querySignal3 = function () {
            this.sendCmd('#SIGNAL? 3\r');
        };
        
        KramerSWT.prototype.querySignal4 = function () {
            this.sendCmd('#SIGNAL? 4\r');
        };
        
        KramerSWT.prototype.queryAllSignals = function () {
            this.sendCmd('#SIGNAL? 1\r');
            this.sendCmd('#SIGNAL? 2\r');
            this.sendCmd('#SIGNAL? 3\r');
            this.sendCmd('#SIGNAL? 4\r');
        };
        
        KramerSWT.prototype.sendCmd = function (cmd) {
            if (this.socket.connected) {
                console.warn("KramerSWT: TX:", cmd.replace('\r', '\\r'));
                this.socket.sendText(cmd);
            } else {
                console.warn("KramerSWT: Not connected, cannot send:", cmd.replace('\r', '\\r'));
            }
        };
        
        KramerSWT.prototype.handleData = function (data) {
            // Convert data to string if needed
            console.warn("KramerSWT: RX data type:", typeof data);
            
            var text;
            if (typeof data === 'string') {
                text = data;
            } else if (data && typeof data === 'object') {
                // Could be Buffer, object with .text property, or other
                if (data.text) {
                    text = data.text;
                } else if (data.toString) {
                    text = data.toString();
                } else {
                    text = String(data);
                }
            } else {
                text = String(data);
            }
            
            console.warn("KramerSWT: RX:", text);
            
            this.receiveBuffer += text;
            console.warn("KramerSWT: Buffer now:", this.receiveBuffer);
            
            // Kramer doesn't send line endings, it uses ~01@ as delimiter
            // Split on ~01@ and process each complete response
            var parts = this.receiveBuffer.split('~01@');
            console.warn("KramerSWT: Split into", parts.length, "parts");
            
            // First part is before first ~01@ (should be empty or incomplete)
            // Last part might be incomplete response, keep it in buffer
            this.receiveBuffer = parts[parts.length - 1];
            console.warn("KramerSWT: Keeping in buffer:", this.receiveBuffer);
            
            // Process all complete responses (skip first empty part, and last incomplete)
            for (var i = 1; i < parts.length - 1; i++) {
                var response = parts[i].trim();
                console.warn("KramerSWT: Processing response", i, ":", response);
                if (response.length > 0) {
                    this.parseLine(response);
                }
            }
            
            // If buffer doesn't start with partial ~01@, assume last part is complete
            if (parts.length > 1 && !this.receiveBuffer.startsWith('~') && this.receiveBuffer.length > 0) {
                console.warn("KramerSWT: Processing final complete response:", this.receiveBuffer);
                this.parseLine(this.receiveBuffer.trim());
                this.receiveBuffer = '';
            }
        };
        
        KramerSWT.prototype.parseLine = function (data) {
            console.warn("KramerSWT: Parsing:", data);
            
            if (data.startsWith('ROUTE ')) {
                var m = data.match(/ROUTE (\d+),(\d+),(\d+)/);
                if (m && m[1] === '1' && m[2] === '1') {
                    var inp = parseInt(m[3]);
                    if (inp >= 1 && inp <= 4) {
                        console.warn("KramerSWT: Current input is:", inp);
                        this.mCurrentInput = inp;
                        this.changed('input');
                    }
                }
            }
            else if (data.startsWith('SIGNAL ')) {
                var m = data.match(/SIGNAL (\d+),(\d+)/);
                if (m) {
                    var inp = parseInt(m[1]);
                    var sig = m[2] === '1';
                    console.warn("KramerSWT: Input " + inp + " signal:", sig);
                    
                    if (inp === 1) { this.mSignal1 = sig; this.changed('signal1'); }
                    else if (inp === 2) { this.mSignal2 = sig; this.changed('signal2'); }
                    else if (inp === 3) { this.mSignal3 = sig; this.changed('signal3'); }
                    else if (inp === 4) { this.mSignal4 = sig; this.changed('signal4'); }
                }
            }
        };
        
        __decorate([
            (0, Metadata_1.property)("Current input"),
            (0, Metadata_1.min)(1),
            (0, Metadata_1.max)(4),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], KramerSWT.prototype, "input", null);
        
        __decorate([
            (0, Metadata_1.property)("Signal on input 1", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], KramerSWT.prototype, "signal1", null);
        
        __decorate([
            (0, Metadata_1.property)("Signal on input 2", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], KramerSWT.prototype, "signal2", null);
        
        __decorate([
            (0, Metadata_1.property)("Signal on input 3", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], KramerSWT.prototype, "signal3", null);
        
        __decorate([
            (0, Metadata_1.property)("Signal on input 4", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], KramerSWT.prototype, "signal4", null);
        
        __decorate([
            (0, Metadata_1.property)("Connected", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], KramerSWT.prototype, "connected", null);
        
        __decorate([
            (0, Metadata_1.callable)("Flash LEDs"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "identify", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query routing"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "queryRouting", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query signal 1"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "querySignal1", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query signal 2"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "querySignal2", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query signal 3"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "querySignal3", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query signal 4"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "querySignal4", null);
        
        __decorate([
            (0, Metadata_1.callable)("Query all signals"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], KramerSWT.prototype, "queryAllSignals", null);
        
        KramerSWT = __decorate([
            (0, Metadata_1.driver)('NetworkTCP', { port: 5000 }),
            __metadata("design:paramtypes", [Object])
        ], KramerSWT);
        
        return KramerSWT;
    }(Driver_1.Driver));
});
