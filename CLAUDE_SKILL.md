# PIXILAB Blocks Driver Development Guide

> **Claude Skill File** - Denna fil innehåller all kunskap som behövs för att skapa drivrutiner för PIXILAB Blocks.

## Översikt

PIXILAB Blocks är ett professionellt styr- och automationssystem. Drivrutiner (drivers) skrivs i TypeScript och möjliggör kommunikation med hårdvaruenheter, protokoll och externa tjänster.

---

## VIKTIGT: Kompilering och Begränsningar

### Blocks kompilerar INTE TypeScript

PIXILAB Blocks kör JavaScript direkt och kompilerar **inte** TypeScript automatiskt. Du måste alltid leverera **båda filerna**:

| Fil | Syfte |
|-----|-------|
| `MyDriver.ts` | TypeScript källkod (för utveckling och läsbarhet) |
| `MyDriver.js` | Kompilerad JavaScript (detta är vad Blocks faktiskt kör) |

**Kompilera manuellt med:**
```bash
tsc MyDriver.ts
```

### AMD Module Format (Föråldrat)

Blocks använder det äldre **AMD (Asynchronous Module Definition)** modulsystemet. Detta innebär begränsningar i vilka moderna JavaScript-funktioner som finns tillgängliga.

### Förbjudna Array-metoder

Följande ES6+ array-metoder **fungerar INTE** i Blocks:

```typescript
// FUNGERAR INTE - använd INTE dessa:
array.map(x => x * 2)           // ❌
array.filter(x => x > 0)        // ❌
array.fill(0)                   // ❌
array.find(x => x.id === 1)     // ❌
array.findIndex(x => x.id === 1) // ❌
array.includes(value)           // ❌
Array.from(iterable)            // ❌
[...spreadOperator]             // ❌
```

### Använd traditionella loopar istället

```typescript
// RÄTT - använd traditionella for-loopar:

// Istället för map():
const result: number[] = [];
for (let i = 0; i < array.length; i++) {
    result.push(array[i] * 2);
}

// Istället för filter():
const filtered: number[] = [];
for (let i = 0; i < array.length; i++) {
    if (array[i] > 0) {
        filtered.push(array[i]);
    }
}

// Istället för fill():
const filled: number[] = new Array(10);
for (let i = 0; i < filled.length; i++) {
    filled[i] = 0;
}

// Istället för find():
let found: Item | undefined;
for (let i = 0; i < array.length; i++) {
    if (array[i].id === 1) {
        found = array[i];
        break;
    }
}

// Istället för includes():
let hasValue = false;
for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
        hasValue = true;
        break;
    }
}
```

### Andra begränsningar

```typescript
// FUNGERAR INTE:
Object.keys(obj)                // ❌ (kan vara begränsat)
Object.values(obj)              // ❌
Object.entries(obj)             // ❌
`template ${literals}`          // ✅ (fungerar i TypeScript, kompileras bort)
async/await                     // ❌ (använd .then() istället)
```

### Promises fungerar

Promises och `.then()` fungerar:

```typescript
// RÄTT:
SimpleFile.readJson(path).then(data => {
    this.processConfig(data);
}).catch(err => {
    console.error("Failed to load config:", err);
});
```

---

## Grundläggande Drivrutinsstruktur

```typescript
import {NetworkTCP} from "system/Network";
import {Driver} from "system_lib/Driver";
import {driver, property, callable, parameter, min, max} from "system_lib/Metadata";

@driver('NetworkTCP', { port: 55000 })
export class MyDevice extends Driver<NetworkTCP> {
    private mPower = false;
    private mVolume = 50;

    public constructor(private socket: NetworkTCP) {
        super(socket);
        socket.autoConnect();

        socket.subscribe('connect', (sender, message) => {
            if (message.type === 'Connection' && sender.connected) {
                this.onConnectStateChanged(true);
            }
        });

        socket.subscribe('textReceived', (sender, message) => {
            this.handleResponse(message.text);
        });
    }

    protected onConnectStateChanged(connected: boolean): void {
        if (connected) {
            // Initiera kommunikation, fråga efter status, etc.
        }
    }

    @property("Ström på/av")
    get power(): boolean {
        return this.mPower;
    }
    set power(value: boolean) {
        this.mPower = value;
        this.sendCommand(value ? "POWER ON" : "POWER OFF");
    }

    @property("Volym 0-100")
    @min(0) @max(100)
    get volume(): number {
        return this.mVolume;
    }
    set volume(value: number) {
        this.mVolume = value;
        this.sendCommand(`VOLUME ${value}`);
    }

    @callable("Skicka kommando")
    public sendCustomCommand(
        @parameter("Kommandosträng") cmd: string
    ): void {
        this.sendCommand(cmd);
    }

    private sendCommand(cmd: string): void {
        if (this.socket.connected) {
            this.socket.sendText(cmd + '\r\n');
        }
    }

    private handleResponse(response: string): void {
        // Parsa svar från enheten
    }
}
```

---

## Dekoratorer (Decorators)

### @driver
Definierar drivrutinens nätverkstyp och standardinställningar.

```typescript
// TCP-anslutning
@driver('NetworkTCP', { port: 55000 })

// UDP-anslutning
@driver('NetworkUDP', { port: 3671, rcvPort: 32331 })
```

### @property
Exponerar en egenskap i PIXILAB Blocks UI.

```typescript
// Läs- och skrivbar egenskap
@property("Beskrivning")
get myProp(): boolean { return this.mMyProp; }
set myProp(value: boolean) { this.mMyProp = value; }

// Skrivskyddad egenskap (readonly = true)
@property("Beskrivning", true)
get readOnlyProp(): string { return this.mReadOnlyProp; }
```

### @callable
Gör en metod anropbar från Blocks tasks.

```typescript
@callable("Beskrivning av vad metoden gör")
public myMethod(): void {
    // Implementation
}
```

### @parameter
Beskriver en metodparameter.

```typescript
@callable("Skicka meddelande")
public sendMessage(
    @parameter("Mottagarens namn") recipient: string,
    @parameter("Meddelandetext") message: string,
    @parameter("Prioritet (valfri)", true) priority?: number  // true = optional
): void {
    // Implementation
}
```

### @min / @max
Sätter numeriska begränsningar på egenskaper.

```typescript
@property("Volym")
@min(0)
@max(100)
get volume(): number { return this.mVolume; }
```

---

## Socket-typer

### NetworkTCP

```typescript
interface NetworkTCP {
    connected: boolean;           // Anslutningsstatus
    address: string;              // IP-adress
    port: number;                 // Port
    name: string;                 // Enhetsnamn i Blocks
    enabled: boolean;             // Om enheten är aktiverad

    autoConnect(): void;          // Aktivera automatisk återanslutning
    disconnect(): void;           // Koppla från
    sendText(text: string): void; // Skicka textsträng
    sendBytes(data: number[]): void; // Skicka binärdata

    subscribe(event: string, callback: Function): void;
}

// Events:
// 'connect' - Anslutningsstatus ändrad
// 'textReceived' - Text mottagen (message.text)
// 'bytesReceived' - Binärdata mottagen (message.rawData)
```

### NetworkUDP

```typescript
interface NetworkUDP {
    connected: boolean;
    address: string;
    port: number;
    listenerPort: number;         // Port för inkommande data (rcvPort)
    name: string;
    enabled: boolean;

    sendText(text: string): void;
    sendBytes(data: number[]): void;

    subscribe(event: string, callback: Function): void;
}

// Events:
// 'bytesReceived' - Binärdata mottagen (message.rawData)
```

---

## Notifiera Egenskapsändringar

När en egenskap ändras utifrån (t.ex. från enheten), måste du notifiera Blocks:

```typescript
// I handleResponse:
private handleResponse(response: string): void {
    if (response.startsWith('POWER ')) {
        const newState = response.includes('ON');
        if (this.mPower !== newState) {
            this.mPower = newState;
            this.changed('power');  // Notifiera Blocks
        }
    }
}
```

---

## Dynamiska Egenskaper

För enheter med variabelt antal kanaler/utgångar, skapa egenskaper dynamiskt:

```typescript
// Metod 1: Indexerade objekt
private mOutput: {[index: number]: OutputChannel} = {};

@property("Utgångskanaler")
get output(): {[index: number]: OutputChannel} {
    return this.mOutput;
}

// Initiering
private initializeOutputs(count: number): void {
    for (let i = 0; i < count; i++) {
        this.mOutput[i] = new OutputChannel(this, i);
    }
}

// Metod 2: property() funktion
owner.property<number>(
    'channel_' + channelName,
    {
        type: "Number",
        description: "Kanalnivå (0-1)",
        min: 0,
        max: 1
    },
    setValue => {
        if (setValue !== undefined) {
            this.wantedValue = setValue;
            this.sendValue();
        }
        return this.wantedValue;
    }
);
```

---

## Konfigurationsfiler

Ladda JSON-konfiguration från `script/files/`:

```typescript
import {SimpleFile} from "system/SimpleFile";

private loadConfig(): void {
    const configFile = 'MyDriver/' + this.socket.name + '.json';

    SimpleFile.exists(configFile).then(existence => {
        if (existence === 1) {  // 1 = fil finns
            SimpleFile.readJson(configFile).then(data => {
                this.processConfig(data);
            });
        }
    });
}
```

**Konfigurationsfilformat (exempel):**
```json
{
    "analog": [
        {"name": "Dimmer1", "description": "Vardagsrum", "addr": [1, 2, 100]}
    ],
    "digital": [
        {"name": "Switch1", "description": "Halllampa", "addr": [1, 2, 101]}
    ]
}
```

---

## Timer och Polling

```typescript
// Deklarera timer som CancelablePromise
private pollTimer: CancelablePromise<void> | undefined;
private static readonly POLL_INTERVAL = 10000; // 10 sekunder

// Starta polling
private startPolling(): void {
    this.stopPolling();
    this.pollEntityStates();
    this.pollTimer = wait(HomeAssistant.POLL_INTERVAL);
    this.pollTimer.then(() => {
        if (this.mConnected) {
            this.startPolling();
        }
    });
}

// Stoppa polling
private stopPolling(): void {
    if (this.pollTimer) {
        this.pollTimer.cancel();
        this.pollTimer = undefined;
    }
}

// CancelablePromise interface
interface CancelablePromise<T> extends Promise<T> {
    cancel(): void;
}

// wait() tillhandahålls av Blocks runtime
declare function wait(ms: number): CancelablePromise<void>;
```

---

## Subscription till Script-livscykel

```typescript
// Avsluta polling när scriptet stängs
this.subscribe('finish', () => {
    this.stopPolling();
    this.cancelTimer();
});
```

---

## HTTP/REST API-anrop

För HTTP-baserade API:er (som Home Assistant), bygg HTTP-förfrågningar manuellt över TCP:

```typescript
private buildHttpRequest(method: string, path: string, body?: string): string {
    const headers = [
        `${method} ${path} HTTP/1.1`,
        `Host: ${this.socket.address}:${this.socket.port}`,
        `Authorization: Bearer ${this.mAccessToken}`,
        'Content-Type: application/json',
        'Accept: application/json',
        'Connection: keep-alive'
    ];

    if (body) {
        headers.push(`Content-Length: ${body.length}`);
    }

    return headers.join('\r\n') + '\r\n\r\n' + (body || '');
}

private apiPost(path: string, data: object): Promise<any> {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const request = this.buildHttpRequest('POST', path, body);
        this.sendHttpRequest(request, resolve, reject);
    });
}
```

---

## Binärprotokoll

För enheter med binära protokoll:

```typescript
// Skicka binärdata
private sendBytes(data: number[]): void {
    if (this.socket.connected) {
        this.socket.sendBytes(data);
    }
}

// Ta emot binärdata
socket.subscribe('bytesReceived', (sender, message) => {
    const rawData: number[] = message.rawData;
    this.processBytes(rawData);
});

// Hjälpfunktioner
function get16bit(data: number[], offset: number): number {
    return (data[offset] << 8) + data[offset + 1];
}

function set16bit(data: number[], offset: number, value: number): void {
    data[offset] = (value >> 8) & 0xff;
    data[offset + 1] = value & 0xff;
}
```

---

## Best Practices

### 1. State Management
- Håll privata `m`-prefixade variabler för alla egenskapsvärden
- Uppdatera endast genom setter eller explicit
- Anropa `this.changed('propName')` vid externa ändringar

### 2. Connection Handling
- Använd alltid `socket.autoConnect()` för automatisk återanslutning
- Implementera `onConnectStateChanged()` för initiering vid anslutning
- Hantera frånkoppling gracefully

### 3. Error Handling
```typescript
try {
    this.socket.sendText(command);
} catch (e) {
    console.error('Failed to send command:', e);
}
```

### 4. Logging
```typescript
// Varningar och fel (visas alltid)
console.warn("Viktig information");
console.error("Fel inträffade");

// Debug (kan vara avstängt)
console.debug("Detaljerad loggning");
```

### 5. Command Queueing
För enheter som kräver sekventiella kommandon:

```typescript
private cmdQueue: QueuedCommand[] = [];

queueCmd(cmd: QueuedCommand): void {
    this.cmdQueue.push(cmd);
    if (this.cmdQueue.length > 50) {
        console.warn("Queue overflow - discarding old commands");
        this.cmdQueue.shift();
    }
    if (this.state === State.IDLE) {
        this.sendQueuedCommand();
    }
}
```

### 6. Debouncing
För att undvika överbelastning vid snabba ändringar:

```typescript
private delayedSendTimer: CancelablePromise<void> | undefined;

private setValueDebounced(value: number): void {
    this.wantedValue = value;
    if (!this.delayedSendTimer) {
        this.delayedSendTimer = wait(150);
        this.delayedSendTimer.then(() => {
            this.delayedSendTimer = undefined;
            this.sendValue();
        });
    }
}
```

---

## Filstruktur

Typisk struktur för en drivrutin:

```
LICENSE                     # GPL v3
README.md                   # Dokumentation (valfritt)
MyDriver.ts                 # TypeScript källkod (KRÄVS för utveckling)
MyDriver.js                 # Kompilerad JavaScript (KRÄVS - detta kör Blocks!)
MyDriver.d.ts               # TypeScript definitioner (genereras av tsc)
tsconfig.json               # TypeScript konfiguration
system/
  ├── Network.d.ts          # Nätverkstyper
  └── SimpleFile.d.ts       # Fil-API
system_lib/
  ├── Driver.d.ts           # Bas-klass
  ├── Metadata.d.ts         # Dekoratorer
  └── Script.d.ts           # Script-klass
```

**VIKTIGT:** Blocks kör `.js`-filen, inte `.ts`-filen! Du måste alltid:
1. Skriva kod i `.ts`-filen
2. Kompilera med `tsc` för att generera `.js`-filen
3. Leverera **båda** filerna

---

## TypeScript Konfiguration

**VIKTIGT:** Använd `"module": "AMD"` eftersom Blocks använder AMD-modulsystemet.

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "AMD",
    "target": "ES5",
    "declaration": true,
    "sourceMap": false,
    "outDir": ".",
    "strict": false,
    "noImplicitAny": false,
    "lib": ["ES5", "ES2015.Promise"]
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

**Kompilera med:**
```bash
tsc
```

Detta genererar `.js` och `.d.ts` filer från dina `.ts` filer.

---

## Type Definitions

### system_lib/Driver.d.ts
```typescript
declare module "system_lib/Driver" {
    export class Driver<T> {
        protected socket: T;
        constructor(socket: T);
        protected onConnectStateChanged(connected: boolean): void;
        protected changed(propName: string): void;
        protected subscribe(event: string, callback: Function): void;
        protected property<T>(
            name: string,
            options: PropertyOptions,
            accessor: (setValue?: T) => T
        ): void;
    }
}
```

### system_lib/Metadata.d.ts
```typescript
declare module "system_lib/Metadata" {
    export function driver(type: string, options?: DriverOptions): ClassDecorator;
    export function property(description: string, readonly?: boolean): PropertyDecorator;
    export function callable(description: string): MethodDecorator;
    export function parameter(description: string, optional?: boolean): ParameterDecorator;
    export function min(value: number): PropertyDecorator;
    export function max(value: number): PropertyDecorator;
}
```

### system/Network.d.ts
```typescript
declare module "system/Network" {
    export interface NetworkTCP {
        connected: boolean;
        address: string;
        port: number;
        name: string;
        enabled: boolean;
        autoConnect(): void;
        disconnect(): void;
        sendText(text: string): void;
        sendBytes(data: number[]): void;
        subscribe(event: string, callback: Function): void;
    }

    export interface NetworkUDP {
        connected: boolean;
        address: string;
        port: number;
        listenerPort: number;
        name: string;
        enabled: boolean;
        sendText(text: string): void;
        sendBytes(data: number[]): void;
        subscribe(event: string, callback: Function): void;
    }
}
```

### system/SimpleFile.d.ts
```typescript
declare module "system/SimpleFile" {
    export class SimpleFile {
        static exists(path: string): Promise<number>;  // 0=ej finns, 1=fil, 2=katalog
        static readJson(path: string): Promise<any>;
        static read(path: string): Promise<string>;
        static write(path: string, content: string): Promise<void>;
    }
}
```

---

## Exempel på Vanliga Mönster

### TV/Display Control
```typescript
@driver('NetworkTCP', { port: 55000 })
export class TVDriver extends Driver<NetworkTCP> {
    private mPower = false;
    private mVolume = 0;
    private mMuted = false;
    private mInput = "HDMI1";

    @property("Power") get power() {...}
    @property("Volume") @min(0) @max(100) get volume() {...}
    @property("Muted") get muted() {...}
    @property("Input source") get input() {...}

    @callable("Power on") powerOn() {...}
    @callable("Power off") powerOff() {...}
    @callable("Volume up") volumeUp() {...}
    @callable("Volume down") volumeDown() {...}
    @callable("Select HDMI") selectHDMI(@parameter("Port 1-4") port: number) {...}
}
```

### Video Router/Switcher
```typescript
@driver('NetworkTCP', { port: 9990 })
export class VideoRouter extends Driver<NetworkTCP> {
    private mOutput: {[index: number]: OutputRoute} = {};

    @property("Output routes") get output() { return this.mOutput; }
    @property("Number of inputs", true) get inputs() {...}
    @property("Number of outputs", true) get outputs() {...}

    @callable("Route input to output")
    route(
        @parameter("Input") input: number,
        @parameter("Output") output: number
    ) {...}
}
```

### Home Automation Integration
```typescript
@driver('NetworkTCP', { port: 8123 })
export class SmartHome extends Driver<NetworkTCP> {
    @property("Access token") get accessToken() {...}

    @callable("Turn on") turnOn(@parameter("Entity ID") entityId: string) {...}
    @callable("Turn off") turnOff(@parameter("Entity ID") entityId: string) {...}
    @callable("Set brightness") setBrightness(
        @parameter("Entity ID") entityId: string,
        @parameter("Level 0-255") level: number
    ) {...}
    @callable("Set temperature") setTemperature(
        @parameter("Entity ID") entityId: string,
        @parameter("Temperature") temp: number
    ) {...}
}
```

### Protocol Gateway (KNX, DMX, etc.)
```typescript
@driver('NetworkUDP', { port: 3671, rcvPort: 32331 })
export class ProtocolGateway extends Driver<NetworkUDP> {
    @property("Connected", true) get connected() {...}
    @property("Last received source", true) get lastSource() {...}
    @property("Last received value", true) get lastValue() {...}

    @callable("Send on/off") setOnOff(
        @parameter("Address 1") addr1: number,
        @parameter("Address 2") addr2: number,
        @parameter("Address 3") addr3: number,
        @parameter("On/Off") on: boolean
    ) {...}
}
```

---

## Checklista för Ny Drivrutin

- [ ] Importera nödvändiga moduler
- [ ] Definiera `@driver` med rätt nätverkstyp och port
- [ ] Skapa konstruktor med socket-subscription
- [ ] Implementera `autoConnect()` för automatisk återanslutning
- [ ] Definiera egenskaper med `@property`
- [ ] Definiera callable-metoder med `@callable`
- [ ] Hantera inkommande data i `textReceived` eller `bytesReceived`
- [ ] Anropa `changed()` vid externa egenskapsändringar
- [ ] Lägg till felhantering
- [ ] **Undvik ES6+ metoder** (map, filter, fill, includes, etc.)
- [ ] **Kompilera TypeScript** till JavaScript med `tsc`
- [ ] **Leverera både .ts och .js filer**
- [ ] Testa med faktisk enhet

---

*Senast uppdaterad: 2026-01-29 (v2 - AMD/ES5 begränsningar tillagda)*
