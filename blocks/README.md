# Blocks-exporter

Zip-filer exporterade ur Blocks med **Export as Zip file**, importeras med
**Import Zip file**.

---

## `ControlPanelNew_Standing.zip`

Sammansatt layout för stående skärm, 1080×1920. Innehåller inga paneler i sig,
bara `RefBlock`:ar som pekar på block under `Admin/`. De blocken måste finnas
innan importen är meningsfull.

```
 y=0     1080×675   Admin/ControlPanelNew     (panels/kontrollpanel)
 y=670   1080×675   Admin/ProjectorStatus     (panels/MH_Projektors)
 y=1340   360×585   Admin/ShellyStats         (panels/ShellyStats)
 y=1340   360×585   Admin/ServerStats         (panels/ServerStats)
 y=1340   360×585   Admin/MH_Settings         (panels/MH_Settings)
```

### Två saker att titta på

**Bottenraden är 585 px hög men panelerna är designade för 675.** Blocks skalar
ned innehållet till ca 87 %, så inget klipps bort, men typsnittsgraderna hamnar
under det som valdes för pekskärm. Raden börjar dessutom på y=1340 och slutar på
1925, alltså 5 px utanför duken. Samma 5 px-överlapp finns mellan de två övre
raderna. 675 + 675 + 585 = 1935 mot en duk på 1920.

**Ett löst `.WebBlock` (id 7) ligger kvar** på x=720, y=1340, 360×58, med
`url: "https://pixilab.se"`. Det ligger bakom `MH_Settings` och syns inte, men
laddas ändå varje gång layouten visas. Ser ut som en rest från när blocket
skapades. Kan tas bort i editorn.

---

## Att redigera en Blocks-export

Generera aldrig `Spec.pixi` från grunden. Exportera ett befintligt block,
redigera det, packa om med **exakt** samma zip-struktur som originalet
(vissa exporter har en toppmapp, andra är platta).

Kontrollera strukturen först:

```bash
unzip -l MinExport.zip
```

Rör bara `.root.blocks[]`, `.root.mNextID` och vid behov `.height` plus
`Meta.json`. Wrapperstrukturen (`"@cls": ".RootBlock"` på toppnivå,
`"@cls": ".Layered"` på `root`) ska aldrig ändras – fel där ger
"An unexpected error occurred" vid import, utan närmare förklaring.

ID:n är **lokalt skopade per `.Layered`-container**. Varje förälder har sin egen
`mNextID` som räknar upp ID:n för sina direkta barn. Inkrementera aldrig globalt.

`enclosing` är sökvägen till föräldern, med segment separerade av tecknet
U+E001. Det är osynligt i vanlig text (UTF-8-byten `ee 80 81`) och skrivs
`\ue001` i kod. Indexet i sökvägen är förälderns **array-index**, inte dess id.
Det äldre plana formatet (`rootblocks9`) bryter importen i senare
Blocks-versioner.

```
root                        ->  ""
root.blocks[N]              ->  "\ue001root"
root.blocks[N].blocks[M]    ->  "\ue001root\ue001blocks\ue001N"
```

Kontrollera alltid med hexdump att separatorn faktiskt kom med:

```bash
grep -o 'enclosing[^,]*' Spec.pixi | head -1 | xxd
```
