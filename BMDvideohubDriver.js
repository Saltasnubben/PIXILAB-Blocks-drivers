/*
 * Driver for BlackMagic Design VideoHub routing switchers
 *
 * Communicates via TCP on port 9990 using text-based protocol.
 *
 * Features:
 * - Live routing state tracking
 * - Route any input to any output
 * - Automatic status updates from device
 * - Input and output label tracking
 *
 * Protocol documentation:
 * https://documents.blackmagicdesign.com/DeveloperManuals/VideohubEthernetProtocol.pdf
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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
define(["require", "exports", "system_lib/Driver", "system_lib/Metadata"], function (require, exports, Driver_1, Metadata_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BMDvideohubDriver = void 0;
    /**
     * Represents a single output's routing control
     */
    var OutputRoute = (function () {
        function OutputRoute(owner, outputIndex) {
            this.owner = owner;
            this.mRoutedInput = 0;
            this.outputIndex = outputIndex;
        }
        Object.defineProperty(OutputRoute.prototype, "routedInput", {
            get: function () {
                // Return 1-based input number for user interface
                return this.mRoutedInput + 1;
            },
            set: function (input) {
                // Convert from 1-based to 0-based for internal routing
                this.owner.routeInputToOutput(input - 1, this.outputIndex);
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Update the routed input from device feedback
         */
        OutputRoute.prototype.updateRoutedInput = function (input) {
            if (this.mRoutedInput !== input) {
                this.mRoutedInput = input;
                this.owner.changed('output');
            }
        };
        Object.defineProperty(OutputRoute.prototype, "label", {
            get: function () {
                return this.owner.getOutputLabel(this.outputIndex);
            },
            enumerable: false,
            configurable: true
        });
        __decorate([
            (0, Metadata_1.property)("Routed input number (1-based)"),
            (0, Metadata_1.min)(1),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [Number])
        ], OutputRoute.prototype, "routedInput", null);
        __decorate([
            (0, Metadata_1.property)("Output label", true),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [])
        ], OutputRoute.prototype, "label", null);
        return OutputRoute;
    }());
    /**
     * Represents input information
     */
    var InputInfo = (function () {
        function InputInfo(owner, index) {
            this.owner = owner;
            this.index = index;
            this.mLabel = "";
        }
        Object.defineProperty(InputInfo.prototype, "label", {
            get: function () {
                return this.mLabel;
            },
            enumerable: false,
            configurable: true
        });
        InputInfo.prototype.updateLabel = function (label) {
            if (this.mLabel !== label) {
                this.mLabel = label;
                this.owner.changed('input');
            }
        };
        __decorate([
            (0, Metadata_1.property)("Input label", true),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [])
        ], InputInfo.prototype, "label", null);
        return InputInfo;
    }());
    var BMDvideohubDriver = (function (_super) {
        __extends(BMDvideohubDriver, _super);
        function BMDvideohubDriver(socket) {
            var _this = _super.call(this, socket) || this;
            _this.socket = socket;
            _this.receiveBuffer = "";
            _this.numInputs = 0;
            _this.numOutputs = 0;
            _this.deviceModel = "Unknown";
            // Arrays of routing and label information (0-based indexing internally)
            _this.output = {};
            _this.input = {};
            _this.outputLabels = [];
            _this.inputLabels = [];
            socket.autoConnect();
            socket.subscribe('connect', function (sender, message) {
                _this.onConnectStateChanged(message.type === 'Connection');
            });
            socket.subscribe('textReceived', function (sender, message) {
                _this.receiveData(message.text);
            });
            return _this;
        }
        /**
         * Handle connection state changes
         */
        BMDvideohubDriver.prototype.onConnectStateChanged = function (connected) {
            if (connected) {
                this.receiveBuffer = "";
                console.warn("VideoHub connected");
            }
            else {
                console.warn("VideoHub disconnected");
            }
        };
        /**
         * Receive and buffer incoming data
         * NetworkTCP delivers each line separately without line endings, so we reconstruct them
         */
        BMDvideohubDriver.prototype.receiveData = function (data) {
            // Add line back with CRLF (NetworkTCP strips line endings)
            this.receiveBuffer += data + '\r\n';
            // Process complete blocks (terminated by blank line - \r\n\r\n becomes two consecutive CRLFs)
            var doubleLine;
            while ((doubleLine = this.receiveBuffer.indexOf('\r\n\r\n')) >= 0) {
                var block = this.receiveBuffer.substring(0, doubleLine);
                this.receiveBuffer = this.receiveBuffer.substring(doubleLine + 4); // Skip \r\n\r\n
                if (block.length > 0) {
                    this.processBlock(block);
                }
            }
        };
        /**
         * Process a complete protocol block
         */
        BMDvideohubDriver.prototype.processBlock = function (block) {
            var lines = block.split('\r\n');
            if (lines.length === 0)
                return;
            var header = lines[0].trim();
            var data = lines.slice(1);
            switch (header) {
                case 'PROTOCOL PREAMBLE:':
                    this.parseProtocolPreamble(data);
                    break;
                case 'VIDEOHUB DEVICE:':
                    this.parseDeviceInfo(data);
                    break;
                case 'INPUT LABELS:':
                    this.parseInputLabels(data);
                    break;
                case 'OUTPUT LABELS:':
                    this.parseOutputLabels(data);
                    break;
                case 'VIDEO OUTPUT LOCKS:':
                    // We could track locked outputs here if needed
                    break;
                case 'VIDEO OUTPUT ROUTING:':
                    this.parseOutputRouting(data);
                    break;
                case 'CONFIGURATION:':
                    // Configuration block - not needed for basic routing
                    break;
                case 'ACK':
                    // Command acknowledged
                    break;
                case 'NAK':
                    console.warn('VideoHub: Command rejected by device');
                    break;
                default:
                    // Silently ignore unknown block types (NETWORK, CONFIGURATION, TAKE MODE, etc.)
                    break;
            }
        };
        /**
         * Parse protocol preamble (version info)
         */
        BMDvideohubDriver.prototype.parseProtocolPreamble = function (data) {
            // Protocol version information - silently parsed
        };
        /**
         * Parse device information
         */
        BMDvideohubDriver.prototype.parseDeviceInfo = function (data) {
            var _this = this;
            data.forEach(function (line) {
                var parts = line.split(':');
                if (parts.length < 2)
                    return;
                var key = parts[0].trim();
                var value = parts.slice(1).join(':').trim();
                switch (key) {
                    case 'Model name':
                        _this.deviceModel = value;
                        break;
                    case 'Video inputs':
                        _this.numInputs = parseInt(value) || 0;
                        _this.initializeInputs();
                        break;
                    case 'Video outputs':
                        _this.numOutputs = parseInt(value) || 0;
                        _this.initializeOutputs();
                        break;
                }
            });
            // Log connection info
            console.warn("VideoHub connected: " + this.deviceModel + ", " + this.numInputs + " inputs, " + this.numOutputs + " outputs");
            // Explicitly notify property changes for read-only properties
            this.changed('model');
            this.changed('inputs');
            this.changed('outputs');
        };
        /**
         * Initialize input objects
         */
        BMDvideohubDriver.prototype.initializeInputs = function () {
            // Initialize array without using ES6 fill() which isn't supported in Blocks
            this.inputLabels = new Array(this.numInputs);
            for (var i = 0; i < this.numInputs; i++) {
                this.inputLabels[i] = '';
                this.input[i] = new InputInfo(this, i);
            }
        };
        /**
         * Initialize output objects
         */
        BMDvideohubDriver.prototype.initializeOutputs = function () {
            // Initialize array without using ES6 fill() which isn't supported in Blocks
            this.outputLabels = new Array(this.numOutputs);
            for (var i = 0; i < this.numOutputs; i++) {
                this.outputLabels[i] = '';
                this.output[i] = new OutputRoute(this, i);
            }
        };
        /**
         * Parse input labels
         */
        BMDvideohubDriver.prototype.parseInputLabels = function (data) {
            var _this = this;
            data.forEach(function (line) {
                var spaceIdx = line.indexOf(' ');
                if (spaceIdx > 0) {
                    var index = parseInt(line.substring(0, spaceIdx));
                    var label = line.substring(spaceIdx + 1);
                    if (index >= 0 && index < _this.numInputs) {
                        _this.inputLabels[index] = label;
                        if (_this.input[index]) {
                            _this.input[index].updateLabel(label);
                        }
                    }
                }
            });
        };
        /**
         * Parse output labels
         */
        BMDvideohubDriver.prototype.parseOutputLabels = function (data) {
            var _this = this;
            data.forEach(function (line) {
                var spaceIdx = line.indexOf(' ');
                if (spaceIdx > 0) {
                    var index = parseInt(line.substring(0, spaceIdx));
                    var label = line.substring(spaceIdx + 1);
                    if (index >= 0 && index < _this.numOutputs) {
                        _this.outputLabels[index] = label;
                    }
                }
            });
        };
        /**
         * Parse output routing state
         */
        BMDvideohubDriver.prototype.parseOutputRouting = function (data) {
            var _this = this;
            data.forEach(function (line) {
                var spaceIdx = line.indexOf(' ');
                if (spaceIdx > 0) {
                    var outputIndex = parseInt(line.substring(0, spaceIdx));
                    var inputIndex = parseInt(line.substring(spaceIdx + 1));
                    if (outputIndex >= 0 && outputIndex < _this.numOutputs) {
                        if (_this.output[outputIndex]) {
                            _this.output[outputIndex].updateRoutedInput(inputIndex);
                        }
                    }
                }
            });
        };
        /**
         * Get output label
         */
        BMDvideohubDriver.prototype.getOutputLabel = function (index) {
            if (index >= 0 && index < this.outputLabels.length) {
                return this.outputLabels[index] || ("Output " + index);
            }
            return "Output " + index;
        };
        /**
         * Route an input to an output
         */
        BMDvideohubDriver.prototype.routeInputToOutput = function (inputIndex, outputIndex) {
            if (!this.socket.connected) {
                console.warn("VideoHub: Cannot route - not connected");
                return;
            }
            if (inputIndex < 0 || inputIndex >= this.numInputs) {
                console.warn("VideoHub: Invalid input " + (inputIndex + 1) + " (must be 1-" + this.numInputs + ")");
                return;
            }
            if (outputIndex < 0 || outputIndex >= this.numOutputs) {
                console.warn("VideoHub: Invalid output " + (outputIndex + 1) + " (must be 1-" + this.numOutputs + ")");
                return;
            }
            // Send routing command (must use CRLF line endings)
            var cmd = "VIDEO OUTPUT ROUTING:\r\n" + outputIndex + " " + inputIndex + "\r\n\r\n";
            this.socket.sendText(cmd);
        };
        /**
         * Callable method to route input to output (1-based numbering)
         */
        BMDvideohubDriver.prototype.route = function (inputNum, outputNum) {
            // Convert from 1-based to 0-based for internal routing
            this.routeInputToOutput(inputNum - 1, outputNum - 1);
        };
        /**
         * Query current routing status
         */
        BMDvideohubDriver.prototype.queryStatus = function () {
            if (this.socket.connected) {
                // Requesting routing status - device should respond with current state (must use CRLF)
                this.socket.sendText("VIDEO OUTPUT ROUTING:\r\n\r\n");
            }
        };
        BMDvideohubDriver.prototype.debugInfo = function () {
            console.warn("=== VIDEOHUB DEBUG INFO ===");
            console.warn("Connected: " + this.socket.connected);
            console.warn("Model: \"" + this.deviceModel + "\"");
            console.warn("Inputs: " + this.numInputs);
            console.warn("Outputs: " + this.numOutputs);
            console.warn("Input objects created: " + Object.keys(this.input).length);
            console.warn("Output objects created: " + Object.keys(this.output).length);
            console.warn("Buffer size: " + this.receiveBuffer.length + " chars");
            if (this.numOutputs > 0 && this.output[0]) {
                console.warn("Output[0].routedInput: " + this.output[0].routedInput);
            }
            console.warn("=== END DEBUG ===");
        };
        Object.defineProperty(BMDvideohubDriver.prototype, "model", {
            // Property getters for device info
            get: function () {
                return this.deviceModel;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(BMDvideohubDriver.prototype, "inputs", {
            get: function () {
                return this.numInputs;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(BMDvideohubDriver.prototype, "outputs", {
            get: function () {
                return this.numOutputs;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(BMDvideohubDriver.prototype, "connected", {
            get: function () {
                return this.socket.connected;
            },
            enumerable: false,
            configurable: true
        });
        __decorate([
            (0, Metadata_1.callable)("Route input to output"),
            __param(0, (0, Metadata_1.parameter)("Input number")),
            __param(1, (0, Metadata_1.parameter)("Output number")),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", [Number, Number]),
            __metadata("design:returntype", void 0)
        ], BMDvideohubDriver.prototype, "route", null);
        __decorate([
            (0, Metadata_1.callable)("Query routing status"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], BMDvideohubDriver.prototype, "queryStatus", null);
        __decorate([
            (0, Metadata_1.callable)("Debug: Show device info"),
            __metadata("design:type", Function),
            __metadata("design:paramtypes", []),
            __metadata("design:returntype", void 0)
        ], BMDvideohubDriver.prototype, "debugInfo", null);
        __decorate([
            (0, Metadata_1.property)("Device model name", true),
            __metadata("design:type", String),
            __metadata("design:paramtypes", [])
        ], BMDvideohubDriver.prototype, "model", null);
        __decorate([
            (0, Metadata_1.property)("Number of inputs", true),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [])
        ], BMDvideohubDriver.prototype, "inputs", null);
        __decorate([
            (0, Metadata_1.property)("Number of outputs", true),
            __metadata("design:type", Number),
            __metadata("design:paramtypes", [])
        ], BMDvideohubDriver.prototype, "outputs", null);
        __decorate([
            (0, Metadata_1.property)("Connection status", true),
            __metadata("design:type", Boolean),
            __metadata("design:paramtypes", [])
        ], BMDvideohubDriver.prototype, "connected", null);
        BMDvideohubDriver = __decorate([
            (0, Metadata_1.driver)('NetworkTCP', { port: 9990 }),
            __metadata("design:paramtypes", [Object])
        ], BMDvideohubDriver);
        return BMDvideohubDriver;
    }(Driver_1.Driver));
    exports.BMDvideohubDriver = BMDvideohubDriver;
});
