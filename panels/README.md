# Paneler

En mapp per panel. Varje mapp är fristående och kopieras rakt in i
`PIXILAB-Blocks-root/public/` på Blocks-servern.

`PubSubWebBlock.js` är PIXILABs bryggfil och ligger med i varje mapp,
oförändrad. Den delas inte mellan panelerna eftersom varje panel ska kunna
kopieras ensam.

Filer som **inte** ska med till servern: `test_harness.html`.

---

## `_template/`

Startmall att kopiera när du bygger en ny panel. Innehåller
skriv-med-kvittens, tre-lägesrendering, färskhetsvarning, rAF-koalescerad
rendering och en fungerande testharness. Byt 360×675 mot pekpanelens faktiska
upplösning innan du börjar.

## `kontrollpanel/`

Den stora. 1300 rader. Kartvy över Maskinhallen med spotar och RPi:er utplacerade
på en planritning, dra-och-släpp-positionering, händelselogg med kvittering,
detaljpanel per objekt och live-skärmbild från PIXILAB Player.

- `areas.json` – områdesdefinitioner (Maskinhallen, Trähallen, Entré). Trähallen
  och Entré saknar kartbild och `openVar`.
- `map_maskinhallen.jpg` – planritningen. Byts via panelens egen uppladdning,
  som skriver till `Script.user.KontrollPanel.pendingMap`.
- `test_harness.html` – mock med JSON-payloads. Tar `?sel=` för att förvälja ett
  objekt.

Skärmbilderna hämtas från `/public/pixilab-player-screenshot/<spot>.jpeg?ts=<n>`.
URL:en byggs på spotens `name`. Ligger spotar i grupper kan `path` behövas i
stället.

## `MH_Projektors/`

1080×675. Tre PJLink-projektorer sida vid sida. Lamptimmar och filtertid med
tröskelvärden för gult och rött, justerbara överst i skriptet
(`LAMP_WARN_H` med flera).

## `ServerStats/`

360×675. Blocks-serverns hälsa. Matas av `sensor_server.py` via en egen drivrutin.

## `ShellyStats/`

360×675. Enklaste panelen att läsa om du vill förstå mönstren. 15 enheter i två
grupper, tre visuella lägen per relä, gruppprefix som strippas ur etiketterna.

`MH_4`–`MH_9` är reservplugar som inte är i drift och är utelämnade. Raden ligger
kvar utkommenterad i `index.html` – lägg tillbaka den när de tas i bruk.

## `MH_Settings/`

360×675. Panelen med skrivande kontroller, alltså den som visar
kvittensmönstret. Kör show, tänd alla lampor, ångmaskinsläge (segmenterad
väljare), Musiklandet ljud och showschema (tre-lägesswitchar).

Två demolägen: `?demo=1` vila, `?demo=2` show igång.

**Öppen fråga:** "Musiklandet ljud" är kopplad till `Tårta_Ljud`, som sitter på
MQTT-topicet `shellyplugsg3-MH_Musikrum_Ljud` och är det relä som `Show_Start`
släcker och `Show_Stop` tänder igen. Är det fel relä är det bara raden `audio:`
i `P` som ska ändras.

## `schedule-editor/`

Redigering av showschema och händelsetyper. `schedule.json` innehåller
händelsetyper med defaultlängd samt tidsluckor per veckodag.

`index2.html` är en alternativ variant med samma titel och samma
prenumerationer. Båda ligger med tills det är avgjort vilken som är den skarpa.
