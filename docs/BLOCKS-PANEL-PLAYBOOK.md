# Playbook: bygga en kontrollpanel som Web-block i PIXILAB Blocks

Skriven av TBot 2026-09-06, till StudioBot.
Bygger på KontrollPanel, ServerStats, ShellyStats, MH_Projektors och MH_Settings
för Tekniska Museet. Allt nedan är kört i skarp drift, inte teori.

---

## 0. Vad det här är

En kontrollpanel i Blocks är **inte** ett Blocks-block du ritar i editorn. Det är en
vanlig statisk HTML-sida som ligger under `PIXILAB-Blocks-root/public/<Namn>/` och
visas i Blocks via ett **Web-block** som pekar på den. Blocks kör den i en iframe och
skickar data in och ut via `postMessage`. Du skriver alltså ren HTML/CSS/JS, ingen
byggkedja, inga beroenden, ingen bundler.

Katalogstruktur per panel:

```
public/MinPanel/
  index.html          # allt: markup, CSS, JS i en fil
  PubSubWebBlock.js   # PIXILABs bryggfil, kopieras oförändrad in i VARJE panelmapp
  test_harness.html   # din egen mock, följer INTE med i leveransen
```

Panelen når man på `http://<blocks-server>:8080/public/MinPanel/`.

**Rör aldrig `Spec.pixi` för det här.** Web-blocket skapas i Blocks-editorn en gång
och pekar sedan på URL:en. Att generera Blocks-spec från grunden är en separat fälla
(se min CLAUDE.md, REGEL 1) och har ingenting med panelbygge att göra.

---

## 1. Pub-sub-bryggan

`PubSubWebBlock.js` är PIXILABs fil. Kopiera in den, ändra inget. API:

```js
import PubSubWebBlock from './PubSubWebBlock.js';
const pubSub = new PubSubWebBlock();

pubSub.subscribe(path, { dataReceived: (value, path) => { ... } });
pubSub.set(path, value);        // skriv värde
pubSub.add(path, value);        // inkrementera
pubSub.unsubscribe(path, handler);
```

Under huven är det bara `postMessage` mot `window.parent` med typerna
`pubsub-subscribe` / `pubsub-set` / `pubsub-add` / `pubsub-unsubscribe`, och data
kommer tillbaka som `pubsub-data` med `{path, value}`.

### Fällan i filen

`Subscription.update()` anropar `handler.dataReceived(value, path)` – **värdet först**.
Men den synkrona grenen i `subscribe()` anropar `dataCallback.dataReceived(path, knownValue)`
– **omvänt**. Det är en bugg i PIXILABs fil. Konsekvens: använd aldrig tredje argumentet
`synchronousCallback`. Låt allt gå genom den asynkrona vägen så är argumentordningen
alltid `(value, path)`.

### Allt kommer som sträng

Värden landar ofta som strängar även när Blocks-sidan är boolean eller tal. Jämför
med `String(v) === 'true'` eller normalisera vid mottagning. Anta aldrig typ.

---

## 2. Verifiera varje sökväg mot en modellexport. Gissa aldrig.

Det här är den enskilt viktigaste vanan. En felstavad sökväg ger ingen felkod, ingen
varning, ingenting i konsolen. Panelen ser ut att fungera och visar tomt för alltid.

Be Mattias exportera modellen från Blocks (Admin → Export model), packa upp och
grep:a fram de exakta namnen. Filerna `model/Core`, `model/Spot`, `model/Users` är
Java-serialiserad binär (magic `0xACED`) men går att `strings`-a. Filnamn med å/ä/ö
är CP437-manglade i zip:en och kan få `unzip` att fälla ut – packa upp med Python
`zipfile` om det krånglar.

### Sökvägsgrammatiken

```
Network.<enhet>.<prop>                    # nätverksenhet (driver)
Network['<enhet med - eller å>'].<prop>   # hakparentesform när namnet inte är en identifierare
Network['<enhet>'].output[0].on           # indexerad property, HAKPARENTES på indexet
Realm.<Realm>.variable.<Namn>.value       # realm-variabel
Realm.<Realm>.group.<Grupp>.<Task>.running # task
Spot.<spotnamn>.<prop>
Script.user.<Skript>.<prop>               # user script property
```

Hakparentesformen behövs så fort namnet innehåller mellanslag, bindestreck eller
svenska tecken. `Network.SS-Skarm1.connected` gör ingenting. `Network['SS-Skarm1'].connected`
fungerar. Indexerade properties är alltid `[N]`, aldrig `.N`.

### Kolla att målet är påslaget

Jag hittade sent att tasken `MH_Show/ShowLjus` hade `enabled: false`. Att sätta dess
variabel hade sett helt korrekt ut i koden och gjort exakt ingenting i hallen. Kolla
`enabled` på varje task du tänker trigga.

---

## 3. Skriv-med-kvittens

Det här är mönstret som gör skillnad mellan en panel man litar på och en man inte gör.

En knapp som bara gör `pubSub.set(path, true)` och slår om sitt eget utseende ljuger
så fort pub-sub-kopplingen är död. Reglaget rör sig, ingenting händer i rummet, och
operatören tror att anläggningen är trasig i stället för panelen.

Lösning: skicka värdet, markera raden som *väntande*, och släpp väntetillståndet
först när prenumerationen rapporterar tillbaka det värde du bad om. Kommer inget
svar inom timeout, säg det.

```js
const ACK_TIMEOUT = 4000;
const pending = {};

function put(key, value, label) {
  pubSub.set(P[key], value);
  if (pending[key]) clearTimeout(pending[key].timer);
  pending[key] = { want: value, timer: setTimeout(() => {
    delete pending[key];
    toast('Inget svar från Blocks');
    render();
  }, ACK_TIMEOUT) };
  if (label) toast(label);
  render();
}

function sub(key, path) {
  pubSub.subscribe(path, { dataReceived: v => {
    st[key] = v;
    lastUpdate = Date.now();
    if (pending[key] && String(pending[key].want) === String(v)) {
      clearTimeout(pending[key].timer);
      delete pending[key];      // kvittens mottagen
    }
    render();
  }});
}
```

Rendera `pending`-raderna nedtonade (`.row.wait { opacity: .55 }`). Operatören ser
direkt att kommandot är på väg och inte framme än.

För rena triggers (`task.running = true`) finns inget stabilt läge att kvittera mot.
Där räcker en toast, men var tydlig i texten om att det är avfyrat, inte bekräftat.

---

## 4. Tre lägen, inte två

Boolean har tre lägen i verkligheten: `true`, `false` och *vi vet inte än*.
En panel som ritar `undefined` som "AV" påstår sig veta något den inte vet.

Ge okänt sin egen visuella klass, tydligt skild från både på och av:

```css
.pill.on  { background: #1e5c38; color: #4ee08a; }
.pill.off { background: #2f2f37; color: #8a8a92; }
.pill.unk { background: #2a2a31; color: #55555e; }   /* får inte likna .off */
```

Samma sak för switchar: knoppen hamnar i mittläget och blir grå, inte till vänster.

Tre regler jag kör på överallt:

1. **Noll eller saknat värde ritas aldrig som en giltig mätning.** "0 °C" och
   "ingen temperatur" är olika saker.
2. **Offline nollställer härledda värden.** Ett relälägesvärde från innan enheten
   försvann säger ingenting om hur det ser ut nu. När `connected === false`, visa
   okänt, inte det gamla värdet.
3. **Färskhet mäts på tystnad, inte på en `connected`-property.** Sätt en tidsstämpel
   varje gång *någon* prenumeration levererar. Är det tyst längre än `STALE_MS`
   (jag kör 300 000 ms), gulmarkera foten. Det fungerar även när den property du
   annars skulle prenumerera på inte finns.

```js
let lastUpdate = null;
function touch() { lastUpdate = Date.now(); scheduleRender(); }
setInterval(scheduleRender, 20000);   // foten ska bli gul av sig själv i tystnad
```

---

## 5. Rendering

Ett enda `render()` som bygger hela strängen och sätter `innerHTML`. Inga
diff-bibliotek, ingen inkrementell DOM. Panelerna är små nog att det är gratis och
enkelt nog att alltid vara korrekt.

Skydda mot event-stormar med rAF-koalescering:

```js
let pending = false;
function scheduleRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}
```

Tjugo enheter × tre prenumerationer som alla svarar samtidigt vid uppstart blir
annars sextio omritningar på en frame.

Har du interaktiva element som skapas av `innerHTML`, koppla om lyssnarna efter
varje render (`hookAckBtn()`-mönstret) eller använd event-delegering på en
container som överlever.

Timers som hör till en vy måste stoppas när vyn lämnas:

```js
function renderBottom() {
  stopSnap();          // vyn kanske byts, stäng av bildhämtningen
  ...                  // renderSpotDetail startar om den om det ändå är en spot
}
```

---

## 6. Testa utan Blocks

Du kommer inte ha en Blocks-server att peka mot medan du bygger. Två verktyg:

### test_harness.html – mockad pub-sub

En sida som lägger panelen i en iframe och svarar på `pubsub-subscribe` med
påhittade värden. Det här är hela filen, den är inte mer komplicerad än så:

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head>
<body>
<iframe id="f" src="index.html"></iframe>
<script>
const mock = {
  'Realm.MH.variable.AngmaskMode.value': 'OFF',
  'Network[\'SS-Skarm1\'].connected': true
  // ... en rad per sökväg panelen prenumererar på
};
window.addEventListener('message', ev => {
  if (ev.data && ev.data.type === 'pubsub-subscribe' && mock[ev.data.path] !== undefined) {
    setTimeout(() => {
      document.getElementById('f').contentWindow.postMessage(
        { type: 'pubsub-data', path: ev.data.path, value: mock[ev.data.path] }, '*');
    }, 150);
  }
});
</script></body></html>
```

Fördröjningen på 150 ms är avsiktlig: den avslöjar allt som antar att data finns
vid första renderingen. Nycklarna i `mock` är **exakt** de strängar panelen
prenumererar på – stämmer de inte kommer inget svar, vilket i sig är ett bra
kvitto på att du stavat rätt.

Harnessen levereras inte. Håll den utanför zip:en.

### ?demo=N – inbyggda lägen

Bygg in demoläge i panelen själv så att du kan granska den utan harness och så att
Mattias kan titta på den i mobilen:

```js
const DEMO = /demo=[12]/.test(location.search);
if (!DEMO) { /* riktiga prenumerationer */ } else { /* fyll st med scenariodata */ }
```

Två lägen räcker oftast: kallstart/vila och full drift. Ha med minst ett offline
och ett okänt värde så alla tre visuella lägena går att syna.

**Indexera demodata på position, inte på namn.** Jag hårdkodade `state['MH_7']` i
ShellyStats demoläge, Mattias bad mig ta bort MH_4–MH_9, och demoläget kastade
TypeError. `const OFFLINE_IX = 2; const UNKNOWN_IX = ALL.length - 4;` överlever att
listan ändras.

### Headless-skärmdumpar

Verifiera i exakt målupplösning innan leverans. Aldrig "ser nog bra ut".

```bash
cd <projektrot> && python3 -m http.server 8931 &

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --window-size=360,675 \
  --virtual-time-budget=3000 \
  --screenshot=/tmp/panel.png \
  "http://127.0.0.1:8931/public/MinPanel/?demo=1"
```

`--virtual-time-budget` måste vara längre än harnessens fördröjning plus dina
timers, annars fotar du kallstarten. Fota **både** kallstart (kort budget) och
fyllt läge (lång budget) – kallstarten är där de flesta buggar bor.

Notera att serverroten är projektroten, så URL:en innehåller `/public/`. Jag brände
tid på 404:or av den anledningen.

Beskärning: använd PIL. `sips -c` producerar tyst en obeskuren bild.

### Syntaxkoll

`<script type="module">` gör att fel bara syns i devtools-konsolen som du inte har
i headless-läge. Plocka ut skriptet och kör `node --check`:

```bash
python3 -c "import re,sys;print(re.search(r'<script type=\"module\">(.*?)</script>',open(sys.argv[1]).read(),re.S).group(1))" index.html > /tmp/x.mjs
node --check /tmp/x.mjs
```

På den här maskinen finns inte `node` på PATH. Använd `/opt/homebrew/bin/node`.

---

## 7. Layout för pekpanel

Panelerna sitter på fasta skärmar. Designa mot exakta pixlar, inte responsivt.

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
* { scrollbar-width: none; -ms-overflow-style: none; }
*::-webkit-scrollbar { width: 0; height: 0; display: none; }

html, body {
  width: 360px; height: 675px; overflow: hidden;
  background: #1a1a1e; color: #eeeef2;
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

Rullningslister på en pekskärm är både fula och oanvändbara. Bort med dem, och se
till att innehållet faktiskt får plats i stället.

Träffytor: `.row { height: 84px }`, `.seg button { height: 80px }`,
`.sw { width: 72px; height: 40px }`. Det känns absurt stort på en 27-tums skärm och
är precis rätt för en tumme.

**Dött utrymme fylls med större kontroller, inte med utfyllnad.** När jag tog bort
sex enheter ur ShellyStats blev 180 px tomma längst ner. Fel svar är en logotyp eller
en dekorlist. Rätt svar är att öka radhöjd och typsnittsgrad tills sidan är fylld.
Samma sak i MH_Settings.

Siffror som uppdaterar: `font-variant-numeric: tabular-nums;`. Utan den hoppar
layouten varje sekund.

---

## 8. Bilder som uppdateras

Om studion har snapshots (PIXILAB Player exponerar
`/public/pixilab-player-screenshot/<spot>.jpeg?ts=<n>`), ladda dem med `new Image()`
och byt ut DOM-noden först vid `onload`. Sätter du `img.src` direkt i DOM blinkar
rutan tom vid varje omladdning.

Cachea senaste lyckade bilden nycklad på vilket objekt den hör till, så att en
omritning av panelen inte tvingar fram en ny hämtning. Och kasta svar som kommer in
för sent:

```js
img.onload = () => {
  if (snapSpot !== name) return;   // användaren hann byta objekt medan bilden laddade
  snapImg = img; snapTaken = Date.now(); paintSnap();
};
```

`?ts=` + `Date.now()` för att gå förbi cachen. `object-fit: contain`, inte `cover`,
när källorna är både liggande och stående.

---

## 9. Leverans

```bash
zip -rqDX MinPanel.zip MinPanel
```

`-D` utelämnar katalogposter, `-X` utelämnar macOS extended attributes. Utan dem
följer `__MACOSX` och `.DS_Store` med och det ser slarvigt ut på servern.

Skicka zip + skärmdumpar i samma svar. Mattias ska kunna se resultatet utan att
packa upp något.

I rapporten: lista **varje pub-sub-sökväg panelen använder** och var du verifierade
den. Det är den enda delen han inte kan kontrollera själv utan modellexporten, och
det är där felen sitter.

---

## 10. Checklista före leverans

- [ ] Varje sökväg verifierad mot modellexport, inte gissad
- [ ] Hakparentesform för namn med bindestreck/mellanslag/åäö
- [ ] Indexerade properties skrivna `[N]`
- [ ] Alla tasks du triggar har `enabled: true`
- [ ] Skrivande kontroller har kvittens med timeout
- [ ] Okänt läge visuellt skilt från av
- [ ] Offline nollställer härledda värden
- [ ] Färskhetsvarning baserad på tystnad
- [ ] `node --check` på modulskriptet
- [ ] Skärmdump i exakt målupplösning, kallstart OCH fyllt läge
- [ ] Inga rullningslister, inget innehåll utanför viewporten
- [ ] Inget dött utrymme
- [ ] `PubSubWebBlock.js` med i mappen, oförändrad
- [ ] `test_harness.html` INTE med i zip:en
- [ ] `zip -rqDX`

---

## 11. Om du kör fast

Referenspanelerna ligger i
`/Users/saltbot/claudeclaw/workspace/kontrollpanel/public/`:

- `ShellyStats/` – enklast. Läs den först. 21 enheter, tre visuella lägen, gruppering.
- `MH_Settings/` – skriv-med-kvittens, segmenterad väljare, tre-lägesswitch.
- `MH_Projektors/`, `ServerStats/` – ren statusvisning.
- `kontrollpanel/` – den stora. Kartvy, drag-and-drop-positionering, händelselogg,
  detaljpanel, snapshots. 1300 rader. Kolla `test_harness.html` bredvid den för
  hur en mock med JSON-payloads ser ut.

Fråga mig (TBot) om Blocks-specifika saker. Jag har modellexporten och drivrutinskällan.
