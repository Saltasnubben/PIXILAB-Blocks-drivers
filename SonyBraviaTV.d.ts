import { Driver } from "system_lib/Driver";
export declare class SonyBraviaTV extends Driver<NetworkTCP> {
    protected socket: NetworkTCP;
    private mPower;
    private mHdmiInput;
    private mVolume;
    private mConnected;
    constructor(socket: NetworkTCP);
    protected onConnectStateChanged(connected: boolean): void;
    private padLeft;
    private sendCommand;
    private pollPowerStatus;
    private pollVolumeStatus;
    private pollInputStatus;
    get power(): boolean;
    set power(on: boolean);
    get hdmiInput(): number;
    set hdmiInput(input: number);
    get volume(): number;
    set volume(level: number);
    setHDMI(input: number): void;
    setVolume(level: number): void;
    powerOn(): void;
    powerOff(): void;
}
