# UserScripts

Blocks UserScripts. Kopieras till `PIXILAB-Blocks-root/script/user/`.

Filerna är kompilerad AMD-output (`define([...], function(...) {...})`) med
TypeScripts hjälpfunktioner inlinade. Blocks laddar om dem automatiskt när de
skrivs till katalogen. Kontrollera i Blocks-loggen att de registrerade sina
properties.

Panelerna når skriptens properties via `Script.user.<Skriptnamn>.<property>`.

---

## `SpotList.js`

Scannar Spot-trädet och publicerar alla DisplaySpots som en JSON-array.

**Publicerar:** `Script.user.SpotList.spotList`

Varje element:

```json
{
  "name": "MH_ZonA_Turbin",
  "path": "Maskinhallen/MH_ZonA_Turbin",
  "connected": true,
  "ipAddress": "10.0.2.11",
  "playingBlock": "Main/Turbin_Loop",
  "active": true
}
```

`path` är spotens fulla punktsökväg i Spot-trädet och är den unika nyckeln.
`name` är bara sista segmentet och kan kollidera mellan grupper.

## `KontrollPanel.js`

Backend för `panels/kontrollpanel`. Håller det tillstånd som måste överleva att
panelen laddas om: kartpositioner, händelselogg, inställningar och markering.

**Publicerar (läses av panelen):**

```
Script.user.KontrollPanel.positions   JSON, objektnyckel -> {x, y} i procent
Script.user.KontrollPanel.events      JSON-array, händelselogg
Script.user.KontrollPanel.settings    JSON, öppettider och kvitteringar
Script.user.KontrollPanel.selection   markerat objekt
Script.user.KontrollPanel.commandResult  utfallet av senaste kommandot
```

**Tar emot (skrivs av panelen):**

```
Script.user.KontrollPanel.pendingPositions
Script.user.KontrollPanel.pendingSettings
Script.user.KontrollPanel.pendingEvent
Script.user.KontrollPanel.pendingMap        kartbild som dataURL
Script.user.KontrollPanel.command           JSON {action, target, ts}
```

Uppdelningen i `x` och `pendingX` är avsiktlig: panelen skriver aldrig direkt i
den property den själv prenumererar på. Skriptet tar emot på `pending`-sidan,
validerar, och publicerar resultatet på läs-sidan. Det gör att panelen bara
visar tillstånd som faktiskt landat i Blocks, vilket är samma tanke som
kvittensmönstret i panelerna.

---

## Beroenden som inte ligger här

`panels/kontrollpanel` läser även:

- `Script.user.DreamlandRPiMonitor.dreamlandStatus` – RPi-övervakningen, egen kodbas
- `Script.user.ScheduleManager.nextEvent` / `.nextEventName` / `.scheduleEvent`

`panels/ServerStats` matas av `sensor_server.py` på Blocks-servern via en egen
drivrutin. Ingen av dessa ingår i det här repot.
