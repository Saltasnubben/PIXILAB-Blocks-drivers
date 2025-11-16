# KNXNetIP Driver för PIXILAB Blocks

Denna driver tillhandahåller KNX/IP-kommunikation för PIXILAB Blocks med utökad funktionalitet för att lyssna på inkommande KNX-meddelanden.

## Ursprung

Denna driver är baserad på den ursprungliga KNXNetIP-drivern från [PIXILAB blocks-script](https://github.com/pixilab/blocks-script) med tillägg för att lyssna på och presentera inkommande KNX-meddelanden.

## Funktioner

### Grundläggande funktionalitet (från original)

- **setOnOff(addr1, addr2, addr3, on)** - Skicka on/off-kommando till angiven gruppadress
- **setScene(addr1, addr2, addr3, scene)** - Aktivera scen (0-63) på angiven gruppadress
- **enforceProps()** - Skicka alla lagrade värden från dynamiska properties till KNX-bussen
- Stöd för analog och digital gruppkonfiguration via JSON-fil

### Nya funktioner - Lyssna på KNX-meddelanden

Drivern lyssnar nu aktivt på inkommande KNX-meddelanden från bussen och exponerar följande properties i Blocks:

- **lastReceivedSource** (string) - Källadress för senast mottagna meddelande (format: area.line.device, t.ex. "1.2.3")
- **lastReceivedDestination** (string) - Destinationsadress för senast mottagna meddelande (format: main/middle/sub, t.ex. "4/0/1")
- **lastReceivedValue** (boolean|number|array) - Värdet från senast mottagna meddelande
  - Boolean för on/off-kommandon
  - Number för numeriska värden (scener, procent, etc.)
  - Array för flerbytesdata
- **lastReceivedRaw** (string) - Rådata från senast mottagna meddelande som hexadecimal sträng

## Användning

### Grundläggande konfiguration

1. Skapa en NetworkUDP-enhet i PIXILAB Blocks
2. Konfigurera port: 3671
3. Konfigurera lyssningsport (rcvPort): 32331
4. Ange IP-adressen till din KNX/IP-gateway

### JSON-konfigurationsfil (valfritt)

För att definiera analog och digital gruppkommunikation, skapa en JSON-fil:
`script/files/KNXNetIP/<enhetsnamn>.json`

Exempel:
```json
{
  "analog": [
    {
      "name": "Dimmer_Vardagsrum",
      "description": "Dimmer i vardagsrummet",
      "addr": [1, 2, 101]
    }
  ],
  "digital": [
    {
      "name": "Lampa_Hall",
      "description": "Lampa i hallen",
      "addr": [1, 2, 100]
    }
  ]
}
```

### Lyssna på KNX-meddelanden i Blocks

Exempel på hur du kan använda de nya properties i ett Blocks-script:

```typescript
// Prenumerera på ändringar i mottagna meddelanden
myKNXDevice.subscribe('lastReceivedDestination', (sender, message) => {
    const source = myKNXDevice.lastReceivedSource;
    const dest = myKNXDevice.lastReceivedDestination;
    const value = myKNXDevice.lastReceivedValue;

    console.log(`KNX message: ${source} -> ${dest} = ${value}`);

    // Reagera på specifika gruppadresser
    if (dest === "4/0/1") {
        // Gör något när gruppadress 4/0/1 får ett meddelande
        if (typeof value === 'boolean') {
            console.log("Lampa " + (value ? "PÅ" : "AV"));
        }
    }
});
```

## Tekniska detaljer

### KNX-protokoll

Drivern implementerar KNXNet/IP tunneling-protokollet och hanterar:
- Connection management
- Tunneling requests/responses
- cEMI frame parsing
- Group address encoding/decoding

### Adressformat

- **Individual Address** (källadress): area.line.device (t.ex. 1.2.3)
- **Group Address** (destinationsadress): main/middle/sub (t.ex. 4/0/1)

### Datatypes

Stöder KNX datapoint types:
- **1.xxx** - Boolean (on/off, switch)
- **5.001** - 8-bit unsigned (0-255, dim värden, position)

## Licens

Copyright (c) 2020 PIXILAB Technologies AB, Sweden (http://pixilab.se). All Rights Reserved.

Utökningar för att lyssna på KNX-meddelanden tillagda 2025.
