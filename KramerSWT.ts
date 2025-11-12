/*
 * Driver for Kramer SWT Series HDMI Switchers
 * Following Blocks TCP connection pattern
 * 
 * Copyright (c) 2025
 */

import {NetworkTCP} from "system/Network";
import {Driver} from "system_lib/Driver";
import {driver, property, callable, min, max} from "system_lib/Metadata";

@driver('NetworkTCP', { port: 5000 })
export class KramerSWT extends Driver<NetworkTCP> {
    
    private mCurrentInput: number = 1;
    private mSignal1: boolean = false;
    private mSignal2: boolean = false;
    private mSignal3: boolean = false;
    private mSignal4: boolean = false;
    private mAudioVolume: number = 50;
    private mAudioMute: boolean = false;
    private receiveBuffer: string = '';

    public constructor(private socket: NetworkTCP) {
        super(socket);
        
        console.warn("KramerSWT: Driver initialized");
        
        // Subscribe to connection state changes
        socket.subscribe('connect', (sender, message) => {
            console.warn("KramerSWT: Connection event, connected:", socket.connected);
            if (socket.connected) {
                this.onConnected();
            }
        });
        
        // Subscribe to incoming data
        socket.subscribe('textReceived', (sender, message) => {
            // message IS the text directly, not an object with .text property
            this.handleData(message);
        });
        
        // Enable automatic connection management
        socket.autoConnect();
        
        // If already connected when driver loads, initialize now
        if (socket.connected) {
            console.warn("KramerSWT: Already connected at startup");
            this.onConnected();
        }
    }
    
    /**
     * Called when connection is established
     */
    private onConnected(): void {
        console.warn("KramerSWT: Connected - querying initial state");
        // Query current routing state
        this.queryRouting();
        // Query all signal states
        this.queryAllSignals();
    }

    @property("Current input")
    @min(1)
    @max(4)
    public set input(value: number) {
        if (value >= 1 && value <= 4) {
            this.mCurrentInput = value;
            this.sendCmd(`#ROUTE 1,1,${value}\r`);
        }
    }
    
    public get input(): number {
        return this.mCurrentInput;
    }

    @property("Signal on input 1", true)
    public get signal1(): boolean {
        return this.mSignal1;
    }

    @property("Signal on input 2", true)
    public get signal2(): boolean {
        return this.mSignal2;
    }

    @property("Signal on input 3", true)
    public get signal3(): boolean {
        return this.mSignal3;
    }

    @property("Signal on input 4", true)
    public get signal4(): boolean {
        return this.mSignal4;
    }

    @property("Connected", true)
    public get connected(): boolean {
        return this.socket.connected;
    }

    @property("Audio volume level (0-100)")
    @min(0)
    @max(100)
    public set audioVolume(value: number) {
        if (value >= 0 && value <= 100) {
            this.mAudioVolume = value;
            this.sendCmd(`#AUD-LVL 1,${value}\r`);
        }
    }

    public get audioVolume(): number {
        return this.mAudioVolume;
    }

    @property("Audio mute")
    public set audioMute(value: boolean) {
        this.mAudioMute = value;
        this.sendCmd(`#AUD-MUTE 1,${value ? 1 : 0}\r`);
    }

    public get audioMute(): boolean {
        return this.mAudioMute;
    }

    @callable("Flash LEDs")
    public identify(): void {
        this.sendCmd('#IDV\r');
    }

    @callable("Volume up")
    public volumeUp(): void {
        const newVol = Math.min(100, this.mAudioVolume + 5);
        this.audioVolume = newVol;
    }

    @callable("Volume down")
    public volumeDown(): void {
        const newVol = Math.max(0, this.mAudioVolume - 5);
        this.audioVolume = newVol;
    }

    @callable("Query routing")
    public queryRouting(): void {
        this.sendCmd('#ROUTE? 1,1\r');
    }

    @callable("Query signal 1")
    public querySignal1(): void {
        this.sendCmd('#SIGNAL? 1\r');
    }

    @callable("Query signal 2")
    public querySignal2(): void {
        this.sendCmd('#SIGNAL? 2\r');
    }

    @callable("Query signal 3")
    public querySignal3(): void {
        this.sendCmd('#SIGNAL? 3\r');
    }

    @callable("Query signal 4")
    public querySignal4(): void {
        this.sendCmd('#SIGNAL? 4\r');
    }
    
    @callable("Query all signals")
    public queryAllSignals(): void {
        this.sendCmd('#SIGNAL? 1\r');
        this.sendCmd('#SIGNAL? 2\r');
        this.sendCmd('#SIGNAL? 3\r');
        this.sendCmd('#SIGNAL? 4\r');
    }

    private sendCmd(cmd: string): void {
        if (this.socket.connected) {
            console.warn("KramerSWT: TX:", cmd.replace('\r', '\\r'));
            this.socket.sendText(cmd);
        } else {
            console.warn("KramerSWT: Not connected, cannot send:", cmd.replace('\r', '\\r'));
        }
    }

    private handleData(data: any): void {
        // Convert data to string if needed
        console.warn("KramerSWT: RX data type:", typeof data);
        
        let text: string;
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
        const parts = this.receiveBuffer.split('~01@');
        console.warn("KramerSWT: Split into", parts.length, "parts");
        
        // First part is before first ~01@ (should be empty or incomplete)
        // Last part might be incomplete response, keep it in buffer
        this.receiveBuffer = parts[parts.length - 1];
        console.warn("KramerSWT: Keeping in buffer:", this.receiveBuffer);
        
        // Process all complete responses (skip first empty part, and last incomplete)
        for (let i = 1; i < parts.length - 1; i++) {
            const response = parts[i].trim();
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
    }

    private parseLine(data: string): void {
        console.warn("KramerSWT: Parsing:", data);

        if (data.startsWith('ROUTE ')) {
            const m = data.match(/ROUTE (\d+),(\d+),(\d+)/);
            if (m && m[1] === '1' && m[2] === '1') {
                const inp = parseInt(m[3]);
                if (inp >= 1 && inp <= 4) {
                    console.warn("KramerSWT: Current input is:", inp);
                    this.mCurrentInput = inp;
                    this.changed('input');
                }
            }
        }
        else if (data.startsWith('SIGNAL ')) {
            const m = data.match(/SIGNAL (\d+),(\d+)/);
            if (m) {
                const inp = parseInt(m[1]);
                const sig = m[2] === '1';
                console.warn(`KramerSWT: Input ${inp} signal:`, sig);

                if (inp === 1) { this.mSignal1 = sig; this.changed('signal1'); }
                else if (inp === 2) { this.mSignal2 = sig; this.changed('signal2'); }
                else if (inp === 3) { this.mSignal3 = sig; this.changed('signal3'); }
                else if (inp === 4) { this.mSignal4 = sig; this.changed('signal4'); }
            }
        }
        else if (data.startsWith('AUD-LVL ')) {
            const m = data.match(/AUD-LVL (\d+),(\d+)/);
            if (m && m[1] === '1') {
                const vol = parseInt(m[2]);
                if (vol >= 0 && vol <= 100) {
                    console.warn("KramerSWT: Audio volume is:", vol);
                    this.mAudioVolume = vol;
                    this.changed('audioVolume');
                }
            }
        }
        else if (data.startsWith('AUD-MUTE ')) {
            const m = data.match(/AUD-MUTE (\d+),(\d+)/);
            if (m && m[1] === '1') {
                const muted = m[2] === '1';
                console.warn("KramerSWT: Audio mute is:", muted);
                this.mAudioMute = muted;
                this.changed('audioMute');
            }
        }
    }
}
