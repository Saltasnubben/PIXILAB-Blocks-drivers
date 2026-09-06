# PIXILAB Blocks – kontrollpaneler och drivrutiner

Kontrollpaneler, användarskript och drivrutinsmaterial för PIXILAB Blocks.
Byggt för **Tekniska Museet, Maskinhallen**, men mönstren är generella.

Panelerna är vanliga statiska HTML-sidor som ligger under `public/` på
Blocks-servern och visas via **Web-block**. Ingen byggkedja, inga beroenden,
ingen bundler. En fil per panel.

---

## Innehåll

| Katalog | Vad |
|---|---|
| `panels/` | Kontrollpanelerna. En mapp per panel, kopieras rakt in i `public/` |
| `panels/_template/` | Startmall med de mönster som beskrivs i playbooken |
| `scripts/user/` | Blocks UserScripts som panelerna hämtar data från |
| `blocks/` | Blocks-exporter (zip) som sätter ihop panelerna till en layout |
| `docs/` | [Playbook för panelbygge](docs/BLOCKS-PANEL-PLAYBOOK.md) – läs den först |

---

## Panelerna

| Panel | Storlek | Vad den gör | Datakälla |
|---|---|---|---|
| `kontrollpanel` | flytande (körs 1080×675) | Kartvy över Maskinhallen med spotar och RPi:er, dra-och-släpp-positionering, händelselogg, detaljpanel med skärmbild | `Script.user.SpotList`, `Script.user.DreamlandRPiMonitor`, `Script.user.KontrollPanel`, `Script.user.ScheduleManager` |
| `MH_Projektors` | 1080×675 | Status för tre PJLink-projektorer: drift, ingång, upplösning, lamptimmar, filter, fel | `Network.MH_Proj_*` |
| `ServerStats` | 360×675 | Blocks-serverns CPU-temp, ACPI-temp, fläkt, RAM, disk | `Network.ServerStats` |
| `ShellyStats` | 360×675 | 15 Shelly-enheter, anslutning och reläläge per utgång | `Network['<enhet>'].connected` / `.output[N].on` |
| `MH_Settings` | 360×675 | Kör show, tänd alla lampor, ångmaskinsläge, Musiklandet ljud, showschema | `Realm.MH.*`, `Network['Tårta_Ljud']` |
| `schedule-editor` | flytande | Redigering av showschema och händelsetyper | `Script.user.ScheduleManager` |

---

## Installation

### 1. Panelerna

Kopiera panelmapparna till Blocks-serverns publika katalog:

```bash
scp -r panels/ShellyStats pixi@<server>:/home/pixi-server/PIXILAB-Blocks-root/public/
```

Testa direkt i webbläsare innan du rör Blocks:

```
http://<server>:8080/public/ShellyStats/
```

Panelen ska rendera med okända värden. Får du 404, ligger den fel.

### 2. Web-block i Blocks

Skapa ett Web-block i Blocks-editorn per panel:

- **URL:** `/public/ShellyStats/` (relativ, inte absolut)
- **Sandbox:** på
- **Storlek:** panelens designade storlek enligt tabellen ovan

Sätt blockets storlek till den designade upplösningen. Blocks skalar innehållet
om containern är mindre, men typsnittsgraderna är valda för pekskärm i
originalstorleken och tål inte hur mycket nedskalning som helst.

### 3. Användarskripten

```bash
scp scripts/user/*.js pixi@<server>:/home/pixi-server/PIXILAB-Blocks-root/script/user/
```

Blocks laddar om skript automatiskt. Kontrollera i Blocks-loggen att de
registrerade sina properties.

### 4. Standing-layouten (valfritt)

`blocks/ControlPanelNew_Standing.zip` importeras via **Import Zip file** i
Blocks-editorn. Den innehåller inga paneler i sig, bara RefBlocks som pekar på
block i `Admin/`. Blocken måste alltså finnas först.

---

## Sökvägsöversikt

Alla pub-sub-sökvägar panelerna använder, verifierade mot modellexport
`Blocks_Model_20260905`. En felstavad sökväg ger **ingen felkod och ingen
konsollogg** – panelen ser ut att fungera och visar tomt för alltid.

### kontrollpanel

```
Script.user.SpotList.spotList                    (läs)  JSON-array med alla DisplaySpots
Script.user.DreamlandRPiMonitor.dreamlandStatus  (läs)  JSON, RPi-hälsa
Script.user.ScheduleManager.nextEvent            (läs)  klockslag
Script.user.ScheduleManager.nextEventName        (läs)
Script.user.KontrollPanel.positions              (läs)  kartpositioner
Script.user.KontrollPanel.events                 (läs)  händelselogg
Script.user.KontrollPanel.settings               (läs)  öppettider, kvitteringar
Script.user.KontrollPanel.commandResult          (läs)  utfall av senaste kommandot
Script.user.KontrollPanel.selection              (skriv) markerat objekt
Script.user.KontrollPanel.pendingPositions       (skriv)
Script.user.KontrollPanel.pendingSettings        (skriv)
Script.user.KontrollPanel.pendingEvent           (skriv)
Script.user.KontrollPanel.pendingMap             (skriv) kartbild som dataURL
Script.user.KontrollPanel.command                (skriv) JSON {action,target,ts}
```

### MH_Projektors

`Network.<enhet>.<fält>` för `MH_Proj_V`, `MH_Proj_H`, `MH_Proj_Wall`:

```
isOnline, powerStatus, hasError, hasWarning, errorStatus,
input, inputResolution, muteVideo, muteAudio, lampCount,
lampOne..FourHours, lampOne..FourActive,
hasFilter, filterUsageTime,
productName, serialNumber, softwareVersion, lampReplacementModelNumber
```

Drivrutinen pollar de dynamiska fälten var 20:e sekund. De statiska hämtas en
gång och cachas.

### ServerStats

`Network.ServerStats.<fält>`:

```
cpuTemp, acpitzTemp, fanRpm,
ramUsedGb, ramTotalGb, ramUsedPct,
diskUsedGb, diskTotalGb, diskUsedPct
```

Matas av `sensor_server.py` som skickar en JSON-rad var 15:e sekund.
Drivrutinen skickar bara vidare värden som faktiskt ändrats, därav
`STALE_MS = 90000`.

### ShellyStats

```
Network['<enhet>'].connected           (läs)
Network['<enhet>'].output[N].on        (läs/skriv)
```

Enheter: `MH_Gude_Dukkontroller`, `MH_Musiklandet_MacMini`,
`MH_Musiklandet_NUC`, `MH_Snillen_NUC`, `MH_Angmaskin` (2 reläer),
`MH_Angmask_ZonD` (2), `MH_U_Gangbro` (2), `Tårta_Ljud`,
`SS-Skarm1`..`SS-Skarm6`, `SS_Monterbelysning`.

`MH_4`–`MH_9` är reservplugar för framtida utbyggnad och är utelämnade ur
listan. De ligger kvar utkommenterade i `index.html`.

### MH_Settings

```
Realm.MH.group.MH_Show.RunShow.running          (skriv) starta show
Realm.MH.variable.ShowTimeLeft.value            (läs)   nedräkning
Realm.MH.group.ArtNet.Lights_Exhibition.running (skriv) tänd alla lampor
Realm.MH.variable.AngmaskMode.value             (läs/skriv) OFF | 30s | FULL
Realm.MH.variable.UseShowSchedule.value         (läs/skriv) boolean
Network['Tårta_Ljud'].output[0].on              (läs/skriv) Musiklandet ljud
```

### schedule-editor

```
Script.user.ScheduleManager.nextEvent      (läs)
Script.user.ScheduleManager.nextEventName  (läs)
Script.user.ScheduleManager.scheduleEvent  (skriv)
```

---

## Att veta innan du ändrar något

**Verifiera sökvägar mot en modellexport.** Gissa aldrig. Exportera modellen från
Blocks och grep:a fram de exakta namnen. Detaljer i playbooken.

**Hakparentesform** krävs så fort ett enhetsnamn innehåller bindestreck,
mellanslag eller å/ä/ö. `Network.SS-Skarm1.connected` gör ingenting.
`Network['SS-Skarm1'].connected` fungerar. Indexerade properties skrivs `[N]`,
aldrig `.N`.

**Kontrollera `enabled` på tasks du triggar.** `MH_Show/ShowLjus` ligger med
`enabled: false` i modellen. Att sätta dess variabel hade sett helt korrekt ut i
koden och gjort exakt ingenting i hallen.

**`PubSubWebBlock.js` har en bugg** i PIXILABs original: `Subscription.update()`
anropar `dataReceived(value, path)` medan den synkrona grenen i `subscribe()`
anropar `dataReceived(path, knownValue)` – omvänd ordning. Använd aldrig tredje
argumentet `synchronousCallback`, så är ordningen alltid `(value, path)`.

**Värden kommer ofta som strängar** även när Blocks-sidan är boolean eller tal.
Jämför med `String(v)` eller normalisera vid mottagning. Anta aldrig typ.

**Custom Options på MQTT-drivrutiner ersätter alla defaultvärden.** Skriver du
`{"inputs": 2}` i en Shelly-enhets Custom Options blir `outputs` **0**, inte 4.
`MqttSwitchBase.initialize()` läser båda nycklarna ur samma JSON och saknad
nyckel blir noll. Ange alltid båda.

---

## Utveckling

Kör en lokal server från repo-roten:

```bash
python3 -m http.server 8931
```

Panelerna nås sedan på `http://127.0.0.1:8931/panels/ShellyStats/`.

Två sätt att se panelen med data:

- **`test_harness.html`** – lägger panelen i en iframe och svarar på
  `pubsub-subscribe` med mockade värden. Se `panels/kontrollpanel/test_harness.html`
  och `panels/_template/test_harness.html`.
- **`?demo=1`** – inbyggda demolägen i panelerna som fyller tillståndet med
  scenariodata. `MH_Settings` har två: `?demo=1` (vila) och `?demo=2` (show igång).

Harnessfilerna ska **inte** kopieras till Blocks-servern.

Syntaxkoll av modulskriptet, som annars bara syns i devtools:

```bash
python3 -c "import re,sys;print(re.search(r'<script type=\"module\">(.*?)</script>',open(sys.argv[1]).read(),re.S).group(1))" panels/ShellyStats/index.html > /tmp/x.mjs
node --check /tmp/x.mjs
```

Skärmdump i exakt målupplösning innan leverans:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --window-size=360,675 --virtual-time-budget=3000 \
  --screenshot=/tmp/panel.png "http://127.0.0.1:8931/panels/ShellyStats/?demo=1"
```

Fota både kallstart (kort budget) och fyllt läge. Kallstarten är där de flesta
buggarna bor.

---

## Designprinciper

Panelerna sitter på pekskärmar i en museimiljö och ska gå att lita på. Tre regler
som gäller överallt i koden:

1. **Noll eller saknat värde ritas aldrig som en giltig mätning.** "0 °C" och
   "ingen temperatur" är olika saker.
2. **Okänt läge har egen visuell klass**, tydligt skild från både på och av. En
   boolean har tre lägen i verkligheten: sant, falskt och *vi vet inte än*.
3. **Offline nollställer härledda värden.** Ett reläläge från innan enheten
   försvann säger ingenting om hur det ser ut nu.

Skrivande kontroller använder **kvittens med timeout**: värdet skickas, raden
markeras som väntande, och väntetillståndet släpps först när prenumerationen
rapporterar tillbaka värdet. Utan det ser en död pub-sub-koppling ut som en
fungerande knapp.

Färskhet mäts på **tystnad**, inte på en `connected`-property, så det fungerar
även när den property man annars skulle prenumerera på inte finns.

Fullständig motivering i [playbooken](docs/BLOCKS-PANEL-PLAYBOOK.md).

---

## Licens

GPL-3.0. Se [LICENSE](LICENSE).
