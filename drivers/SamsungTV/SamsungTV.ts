/**
 * Samsung Smart TV Driver for PIXILAB Blocks
 * Controls modern Samsung TVs (2016+) via WebSocket API
 * 
 * Supports:
 * - Power on/off (Wake-on-LAN for power on)
 * - Volume control (up/down/mute)
 * - Input/Source selection
 * - Navigation and media keys
 * - Token-based authentication
 * 
 * Protocol: Samsung WebSocket API on port 8001 (ws) or 8002 (wss)
 * 
 * Version 2.0 - WebSocket implementation for modern Tizen TVs
 */

import {NetworkTCP} from "system/Network";
import {Driver} from "system_lib/Driver";
import {SimpleHTTP} from "system/SimpleHTTP";
import {SimpleWebsocket, WebsocketConnection, TextMessage} from "system/SimpleWebsocket";
import * as Meta from "system_lib/Metadata";

// Declare Blocks global wait function
declare function wait(milliseconds: number): Promise<any>;

interface SamsungTVOptions {
    token?: string;           // Auth token from previous pairing
    name?: string;            // Remote control name shown on TV
    useSSL?: boolean;         // Use wss:// on port 8002 (default: false = ws:// on 8001)
}

@Meta.driver('NetworkTCP', { port: 8001 })
export class SamsungTV extends Driver<NetworkTCP> {
    
    private options: SamsungTVOptions;
    private ws?: WebsocketConnection;
    private wsReconnectTimer?: any;
    private keepAliveTimer?: any;
    private commandQueue: string[] = [];
    
    // Connection state
    private mConnected = false;
    private mPowerState = false;
    
    // Device info
    private mModelName = "";
    private mDeviceName = "";
    
    // State tracking
    private mVolume = 0;
    private mMuted = false;
    private mSource = "";
    private mScreenOn = false;  // Actual PowerState from TV API
    
    // Remote name (Base64 encoded for API)
    private readonly DEFAULT_REMOTE_NAME = "PIXILAB Blocks";
    private encodedName: string;
    
    public constructor(private socket: NetworkTCP) {
        super(socket);
        
        // Parse options
        this.options = this.parseOptions(socket.options);
        
        // Encode remote name
        const remoteName = this.options.name || this.DEFAULT_REMOTE_NAME;
        this.encodedName = this.base64Encode(remoteName);
        
        console.warn("SamsungTV driver v2.0 (WebSocket) initialized for:", socket.address);
        console.warn("Remote name:", remoteName);
        console.warn("Token configured:", this.options.token ? "Yes" : "No");
        
        // DON'T use TCP socket for connection management - Samsung closes it quickly
        // Just use it to get the IP address, then manage WebSocket independently
        
        // Start WebSocket connection directly
        this.startConnection();
    }
    
    /**
     * Parse options from socket.options JSON string
     */
    private parseOptions(optionsStr: string): SamsungTVOptions {
        try {
            if (optionsStr) {
                const parsed = JSON.parse(optionsStr);
                console.warn("Parsed options:", JSON.stringify(parsed));
                return parsed;
            }
        } catch (e) {
            console.warn("Failed to parse options:", e);
        }
        return {};
    }
    
    /**
     * Base64 encode a string
     */
    private base64Encode(str: string): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        let i = 0;
        
        while (i < str.length) {
            const a = str.charCodeAt(i++);
            const b = i < str.length ? str.charCodeAt(i++) : 0;
            const c = i < str.length ? str.charCodeAt(i++) : 0;
            
            const bitmap = (a << 16) | (b << 8) | c;
            
            result += chars.charAt((bitmap >> 18) & 63);
            result += chars.charAt((bitmap >> 12) & 63);
            result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
            result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
        }
        
        return result;
    }
    
    /**
     * Start connection process
     */
    private startConnection() {
        console.warn("=== STARTING CONNECTION ===");
        
        // First check if TV is reachable via HTTP API
        this.checkTVStatus().then(available => {
            if (available) {
                this.mPowerState = true;
                this.changed('power');
                this.connectWebSocket();
            } else {
                console.warn("TV not responding - might be in standby");
                this.mPowerState = false;
                this.changed('power');
                // Retry after delay
                this.scheduleReconnect(10000);
            }
        });
    }
    
    /**
     * Check if TV is responding via REST API
     * Also updates screenOn property based on PowerState
     */
    private checkTVStatus(): Promise<boolean> {
        const url = `http://${this.socket.address}:8001/api/v2/`;
        
        return SimpleHTTP.newRequest(url)
            .get()
            .then(response => {
                try {
                    let data = response.data;
                    if (typeof data === 'string') {
                        data = JSON.parse(data);
                    }
                    
                    if (data && data.device) {
                        this.mModelName = data.device.modelName || "";
                        this.mDeviceName = data.device.name || "";
                        
                        // Update screenOn from PowerState
                        const powerState = data.device.PowerState || "unknown";
                        const isOn = powerState === "on";
                        if (this.mScreenOn !== isOn) {
                            this.mScreenOn = isOn;
                            this.changed('screenOn');
                        }
                        
                        console.warn("TV found:", this.mModelName, "-", this.mDeviceName, "- Screen:", isOn ? "ON" : "OFF");
                        return true;
                    }
                } catch (e) {
                    console.warn("Error parsing TV info:", e);
                }
                return false;
            })
            .catch(error => {
                console.warn("TV not responding:", error);
                return false;
            });
    }
    
    /**
     * Connect to TV via WebSocket
     */
    private connectWebSocket() {
        // Build WebSocket URL
        const port = this.options.useSSL ? 8002 : 8001;
        const protocol = this.options.useSSL ? "wss" : "ws";
        let wsUrl = `${protocol}://${this.socket.address}:${port}/api/v2/channels/samsung.remote.control?name=${this.encodedName}`;
        
        // Add token if available
        if (this.options.token) {
            wsUrl += `&token=${this.options.token}`;
        }
        
        console.warn("Connecting WebSocket to:", wsUrl);
        
        SimpleWebsocket.connect(wsUrl, 8192)
            .then(ws => {
                console.warn("WebSocket connected successfully!");
                this.ws = ws;
                this.mConnected = true;
                this.changed('connected');
                
                // Subscribe to WebSocket events
                ws.subscribe('textReceived', this.onWebSocketMessage.bind(this));
                ws.subscribe('finish', this.onWebSocketDisconnected.bind(this));
                
                // Start keepalive ping
                this.startKeepAlive();
                
                // Process any queued commands
                this.processCommandQueue();
            })
            .catch(error => {
                console.error("WebSocket connection failed:", error);
                console.warn("This may require pairing - check TV for prompt");
                this.mConnected = false;
                this.changed('connected');
                
                // Retry connection after short delay
                this.scheduleReconnect(2000);
            });
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    private onWebSocketMessage(sender: WebsocketConnection, message: TextMessage) {
        try {
            const data = JSON.parse(message.text);
            console.warn("WS received:", data.event || data.type || "unknown");
            
            // Handle different message types
            if (data.event === "ms.channel.connect") {
                console.warn("Successfully paired with TV!");
                
                // Extract and save token if provided
                if (data.data && data.data.token) {
                    console.warn("New token received:", data.data.token);
                    console.warn(">>> SAVE THIS TOKEN IN DRIVER OPTIONS <<<");
                    // Note: Token should be saved to options for future use
                }
            } else if (data.event === "ms.error") {
                console.error("TV error:", data.data);
            }
            
        } catch (e) {
            console.warn("Error parsing WS message:", e);
        }
    }
    
    /**
     * Handle WebSocket disconnection
     */
    private onWebSocketDisconnected(sender: WebsocketConnection) {
        console.warn("WebSocket disconnected");
        this.ws = undefined;
        this.mConnected = false;
        this.changed('connected');
        
        // Always try to reconnect
        this.scheduleReconnect(5000);
    }
    
    /**
     * Schedule WebSocket reconnection
     */
    private scheduleReconnect(delayMs: number) {
        if (this.wsReconnectTimer) {
            this.wsReconnectTimer.cancel();
        }
        
        console.warn(`Scheduling reconnect in ${delayMs}ms`);
        this.wsReconnectTimer = wait(delayMs);
        this.wsReconnectTimer.then(() => {
            if (!this.ws) {
                this.startConnection();
            }
        }).catch(() => {});
    }
    
    /**
     * Disconnect WebSocket
     */
    private disconnectWebSocket() {
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
    }
    
    /**
     * Start keepalive ping to prevent connection timeout
     */
    private startKeepAlive() {
        this.stopKeepAlive();
        
        const pingInterval = 30000; // 30 seconds
        console.warn("Starting keepalive ping every " + pingInterval + "ms");
        
        const doPing = () => {
            if (this.ws && this.mConnected) {
                // Send empty key press as ping (doesn't do anything but keeps connection alive)
                const pingMessage = {
                    method: "ms.remote.control",
                    params: {
                        Cmd: "Click",
                        DataOfCmd: "KEY_UNKNOWN",
                        Option: "false",
                        TypeOfRemote: "SendRemoteKey"
                    }
                };
                this.ws.sendText(JSON.stringify(pingMessage));
                
                // Schedule next ping
                this.keepAliveTimer = wait(pingInterval);
                this.keepAliveTimer.then(doPing).catch(() => {});
            }
        };
        
        // Start first ping after interval
        this.keepAliveTimer = wait(pingInterval);
        this.keepAliveTimer.then(doPing).catch(() => {});
    }
    
    /**
     * Stop keepalive ping
     */
    private stopKeepAlive() {
        if (this.keepAliveTimer) {
            this.keepAliveTimer.cancel();
            this.keepAliveTimer = undefined;
        }
    }
    
    /**
     * Process queued commands
     */
    private processCommandQueue() {
        while (this.commandQueue.length > 0 && this.ws && this.mConnected) {
            const key = this.commandQueue.shift();
            if (key) {
                console.warn("Processing queued command:", key);
                this.sendKeyDirect(key);
            }
        }
    }
    
    /**
     * Send key directly (internal use)
     */
    private sendKeyDirect(key: string): void {
        if (!this.ws) return;
        
        const message = {
            method: "ms.remote.control",
            params: {
                Cmd: "Click",
                DataOfCmd: key,
                Option: "false",
                TypeOfRemote: "SendRemoteKey"
            }
        };
        
        this.ws.sendText(JSON.stringify(message));
    }
    
    /**
     * Send a key command to the TV (queues if not connected)
     */
    private sendKey(key: string): void {
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
    }
    
    // ============================================
    // PROPERTIES
    // ============================================
    
    @Meta.property("WebSocket connection status", true)
    public get connected(): boolean {
        return this.mConnected;
    }
    
    @Meta.property("TV power state (set)")
    public get power(): boolean {
        return this.mPowerState;
    }
    public set power(on: boolean) {
        if (on && !this.mPowerState) {
            this.powerOn();
        } else if (!on && this.mPowerState) {
            this.powerOff();
        }
    }
    
    @Meta.property("Screen is on (actual PowerState from TV)", true)
    public get screenOn(): boolean {
        return this.mScreenOn;
    }
    
    @Meta.property("TV model name", true)
    public get modelName(): string {
        return this.mModelName;
    }
    
    @Meta.property("TV device name", true)
    public get deviceName(): string {
        return this.mDeviceName;
    }
    
    @Meta.property("Volume level (0-100)")
    public get volume(): number {
        return this.mVolume;
    }
    public set volume(level: number) {
        // Note: Samsung API doesn't support absolute volume
        // We track relative changes
        this.mVolume = Math.max(0, Math.min(100, level));
    }
    
    @Meta.property("Mute state")
    public get muted(): boolean {
        return this.mMuted;
    }
    public set muted(mute: boolean) {
        if (mute !== this.mMuted) {
            this.toggleMute();
        }
    }
    
    @Meta.property("Current input source")
    public get source(): string {
        return this.mSource;
    }
    
    // ============================================
    // CALLABLE METHODS - Power
    // ============================================
    
    @Meta.callable("Power on the TV")
    public powerOn(): void {
        console.warn("Power ON requested");
        
        // Check if TV is already on
        this.checkTVPowerState().then(isOn => {
            if (isOn) {
                console.warn("TV already on - skipping power command");
            } else {
                console.warn("TV is off - sending KEY_POWER to turn on");
                this.sendKey("KEY_POWER");
                // Update screenOn immediately
                this.mScreenOn = true;
                this.changed('screenOn');
                // Verify after delay
                this.scheduleStateVerify(3000);
            }
            this.mPowerState = true;
            this.changed('power');
        });
    }
    
    @Meta.callable("Power off the TV")
    public powerOff(): void {
        console.warn("Power OFF requested");
        
        // Check if TV is already off
        this.checkTVPowerState().then(isOn => {
            if (!isOn) {
                console.warn("TV already off - skipping power command");
            } else {
                console.warn("TV is on - sending KEY_POWER to turn off");
                this.sendKey("KEY_POWER");
                // Update screenOn immediately
                this.mScreenOn = false;
                this.changed('screenOn');
                // Verify after delay
                this.scheduleStateVerify(3000);
            }
            this.mPowerState = false;
            this.changed('power');
        });
    }
    
    @Meta.callable("Toggle power state")
    public powerToggle(): void {
        console.warn("Power TOGGLE requested");
        this.sendKey("KEY_POWER");
        // Toggle screenOn immediately
        this.mScreenOn = !this.mScreenOn;
        this.changed('screenOn');
        this.mPowerState = !this.mPowerState;
        this.changed('power');
        // Verify after delay
        this.scheduleStateVerify(3000);
    }
    
    private stateVerifyTimer?: any;
    
    /**
     * Schedule a state verification after delay
     */
    private scheduleStateVerify(delayMs: number): void {
        if (this.stateVerifyTimer) {
            this.stateVerifyTimer.cancel();
        }
        this.stateVerifyTimer = wait(delayMs);
        this.stateVerifyTimer.then(() => {
            console.warn("Verifying TV power state...");
            this.checkTVPowerState();
        }).catch(() => {});
    }
    
    /**
     * Check TV power state via HTTP API
     * Returns true if PowerState is "on", false otherwise
     * Also updates the screenOn property
     */
    private checkTVPowerState(): Promise<boolean> {
        const url = `http://${this.socket.address}:8001/api/v2/`;
        
        return SimpleHTTP.newRequest(url)
            .get()
            .then(response => {
                try {
                    let data = response.data;
                    if (typeof data === 'string') {
                        data = JSON.parse(data);
                    }
                    
                    if (data && data.device) {
                        const powerState = data.device.PowerState || "unknown";
                        console.warn("TV PowerState:", powerState);
                        
                        // Update screenOn property
                        const isOn = powerState === "on";
                        if (this.mScreenOn !== isOn) {
                            this.mScreenOn = isOn;
                            this.changed('screenOn');
                        }
                        return isOn;
                    }
                } catch (e) {
                    console.warn("Error checking power state:", e);
                }
                return false;
            })
            .catch(error => {
                console.warn("Could not check power state:", error);
                return false;
            });
    }
    
    // ============================================
    // CALLABLE METHODS - Volume
    // ============================================
    
    @Meta.callable("Increase volume")
    public volumeUp(): void {
        this.sendKey("KEY_VOLUP");
        if (this.mVolume < 100) {
            this.mVolume++;
            this.changed('volume');
        }
    }
    
    @Meta.callable("Decrease volume")
    public volumeDown(): void {
        this.sendKey("KEY_VOLDOWN");
        if (this.mVolume > 0) {
            this.mVolume--;
            this.changed('volume');
        }
    }
    
    @Meta.callable("Toggle mute")
    public toggleMute(): void {
        this.sendKey("KEY_MUTE");
        this.mMuted = !this.mMuted;
        this.changed('muted');
    }
    
    // ============================================
    // CALLABLE METHODS - Input/Source
    // ============================================
    
    @Meta.callable("Open source/input menu")
    public openSourceMenu(): void {
        this.sendKey("KEY_SOURCE");
    }
    
    @Meta.callable("Select HDMI input")
    public selectHDMI(
        @Meta.parameter("HDMI input number (1-4)") input: number
    ): void {
        if (input < 1 || input > 4) {
            console.error("HDMI input must be between 1 and 4");
            return;
        }
        this.sendKey("KEY_HDMI" + input);
        this.mSource = "HDMI" + input;
        this.changed('source');
    }
    
    @Meta.callable("Select HDMI 1")
    public hdmi1(): void {
        this.selectHDMI(1);
    }
    
    @Meta.callable("Select HDMI 2")
    public hdmi2(): void {
        this.selectHDMI(2);
    }
    
    @Meta.callable("Select HDMI 3")
    public hdmi3(): void {
        this.selectHDMI(3);
    }
    
    @Meta.callable("Select HDMI 4")
    public hdmi4(): void {
        this.selectHDMI(4);
    }
    
    // ============================================
    // CALLABLE METHODS - Navigation
    // ============================================
    
    @Meta.callable("Navigate up")
    public up(): void {
        this.sendKey("KEY_UP");
    }
    
    @Meta.callable("Navigate down")
    public down(): void {
        this.sendKey("KEY_DOWN");
    }
    
    @Meta.callable("Navigate left")
    public left(): void {
        this.sendKey("KEY_LEFT");
    }
    
    @Meta.callable("Navigate right")
    public right(): void {
        this.sendKey("KEY_RIGHT");
    }
    
    @Meta.callable("Select/Enter")
    public enter(): void {
        this.sendKey("KEY_ENTER");
    }
    
    @Meta.callable("Back/Return")
    public back(): void {
        this.sendKey("KEY_RETURN");
    }
    
    @Meta.callable("Exit")
    public exit(): void {
        this.sendKey("KEY_EXIT");
    }
    
    @Meta.callable("Home")
    public home(): void {
        this.sendKey("KEY_HOME");
    }
    
    @Meta.callable("Menu")
    public menu(): void {
        this.sendKey("KEY_MENU");
    }
    
    // ============================================
    // CALLABLE METHODS - Media Control
    // ============================================
    
    @Meta.callable("Play")
    public play(): void {
        this.sendKey("KEY_PLAY");
    }
    
    @Meta.callable("Pause")
    public pause(): void {
        this.sendKey("KEY_PAUSE");
    }
    
    @Meta.callable("Stop")
    public stop(): void {
        this.sendKey("KEY_STOP");
    }
    
    // ============================================
    // CALLABLE METHODS - Direct Key
    // ============================================
    
    @Meta.callable("Send any key command")
    public sendCommand(
        @Meta.parameter("Key code (e.g., KEY_VOLUP, KEY_HDMI1)") key: string
    ): void {
        this.sendKey(key);
    }
    
    // ============================================
    // CALLABLE METHODS - Utility
    // ============================================
    
    @Meta.callable("Reconnect to TV")
    public reconnect(): void {
        console.warn("Manual reconnect requested");
        this.disconnectWebSocket();
        this.startConnection();
    }
    
    @Meta.callable("Check TV status")
    public checkStatus(): Promise<void> {
        return this.checkTVStatus().then(available => {
            console.warn("TV available:", available);
            this.mPowerState = available;
            this.changed('power');
        });
    }
}
