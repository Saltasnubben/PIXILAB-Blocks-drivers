# CSS-styling i PIXILAB Blocks

Denna guide beskriver hur du kan anpassa utseendet på dina PIXILAB Blocks-projekt med hjälp av CSS (Cascading Style Sheets).

## Introduktion

PIXILAB Blocks är byggt på standard HTML5 och webbteknologier, vilket innebär att du kan använda vanlig CSS för att anpassa utseendet på knappar, paneler, text och andra element. Detta ger dig full kontroll över det visuella uttrycket i dina projekt.

## Grundläggande koncept

CSS består av två huvuddelar:
- **Selektorer** - Bestämmer vilka element som påverkas
- **Regler** - Definierar hur elementen ska se ut (t.ex. `background-color`, `border-radius`)

## Tre sätt att applicera CSS

### 1. Block-specifik CSS (Lokal)

För styling som endast ska gälla ett specifikt block kan du lägga CSS-filen i blockens katalog och referera till den med tilde-notation:

```
~/min-style.css
```

**Fördelar:**
- CSS:en följer med blocket vid export/import
- Enkel att hantera för enskilda block
- Använd penn-ikonen i "Custom CSS URL"-fältet för att skapa eller redigera

### 2. Generell CSS (Delad)

Placera CSS-filer under `public`-katalogen för att använda dem i flera block:

```
PIXILAB-Blocks-root/public/style/min-style.css
```

Referera sedan till filen med sökvägen relativt till public-mappen.

### 3. Global CSS (Automatisk)

Använd `defaultSpotCSS`-inställningen i serverkonfigurationsfilen för att automatiskt ladda en CSS-fil på alla Spots:

```json
{
  "defaultSpotCSS": "style/global.css"
}
```

Sökvägen måste vara relativ (utan inledande `/`) och utgår från serverns public-katalog.

## Viktiga CSS-klasser i Blocks

PIXILAB Blocks tillhandahåller specifika CSS-klasser för olika kontroller:

| Klass | Beskrivning |
|-------|-------------|
| `.Button-ctl` | Wrapper för knappar |
| `.Indicator-ctl` | Wrapper för indikatorer |
| `.Slider-ctl` | Wrapper för sliders |
| `.Bar-ctl` | Wrapper för staplar |
| `.text-block` | Textelement |

### Automatiskt tillagda klasser

Systemet lägger automatiskt till vissa klasser:
- `show-cursor` - Visar muspekare
- `tag-XXX` - Klasser baserade på taggar
- Klasser från URL-parametrar

### Tillståndsklasser för knappar

- `.pressed` - Appliceras när knappen trycks ner
- `.active` - Appliceras när knappens bundna egenskap är aktiv

## Praktiska exempel

### Anpassa alla knappar

```css
.Button-ctl {
    background-color: #3498db;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.Button-ctl:hover {
    background-color: #2980b9;
}

.Button-ctl.pressed {
    transform: scale(0.98);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
}
```

### Anpassa textblock

```css
.text-block {
    font-family: 'Open Sans', sans-serif;
    color: #333;
    line-height: 1.6;
}
```

### Osynlig knapp med effekt vid tryck

```css
.Button-ctl.invisible {
    background: transparent;
    border: none;
}

.Button-ctl.invisible.pressed > div {
    background-color: rgba(255, 255, 255, 0.2);
}
```

### Gradient-bakgrund

```css
.min-gradient-knapp {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

## Använda flera CSS-klasser

Du kan applicera flera klasser på samma kontroll genom att skriva klassnamnen separerade med mellanslag i fältet "Custom CSS Classes":

```
primary-button large rounded
```

## Anpassade typsnitt

### Ladda webbtypsnitt med @font-face

```css
@font-face {
    font-family: 'MittTypsnitt';
    src: url('fonts/mitt-typsnitt.woff2') format('woff2'),
         url('fonts/mitt-typsnitt.woff') format('woff');
    font-weight: normal;
    font-style: normal;
}

.text-block {
    font-family: 'MittTypsnitt', sans-serif;
}
```

**Rekommenderade format:** WOFF eller WOFF2

**Tips för icke-latinska tecken:** Se till att typsnittsfilen innehåller rätt teckenuppsättning för språk som japanska, koreanska, etc.

## Utvecklarverktyg

Använd Chrome DevTools för att utforska element och hitta rätt selektorer:

1. Högerklicka på elementet du vill styla
2. Välj "Inspektera" (Inspect)
3. Utforska elementets klasser och struktur i Elements-panelen
4. Testa CSS-ändringar direkt i Styles-panelen

## Filstruktur - rekommendation

```
PIXILAB-Blocks-root/
├── public/
│   ├── style/
│   │   ├── global.css        # Globala stilar
│   │   ├── buttons.css       # Knapp-stilar
│   │   └── typography.css    # Typsnitt och text
│   ├── fonts/
│   │   ├── custom-font.woff2
│   │   └── custom-font.woff
│   └── block/
│       └── MittBlock/
│           └── local-style.css  # Block-specifik CSS
```

## Avancerade tekniker

### Pseudo-element

```css
.decorative-button::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: #e74c3c;
}
```

### Transitions för mjuka övergångar

```css
.Button-ctl {
    transition: all 0.3s ease;
}
```

### Anpassade övergångar (custom transitions)

PIXILAB Blocks stöder anpassade övergångsanimationer. Se PIXILABs GitHub-repo för exempel på custom transitions.

## Resurser

- [PIXILAB Wiki - Custom Styling](https://pixilab.se/docs/blocks/custom_styling)
- [PIXILAB GitHub - CSS-exempel](https://github.com/pixilab/blocks-css)
- [PIXILAB Blocks Manual (PDF)](https://pixilab.se/outgoing/blocks/PIXILAB-Blocks.pdf)

## Sammanfattning

1. **Välj rätt metod** - Lokal, delad eller global CSS beroende på behov
2. **Använd rätt selektorer** - Blocks har specifika klasser för varje kontrolltyp
3. **Testa med DevTools** - Inspektera element för att hitta rätt klasser
4. **Håll det organiserat** - Separera stilar i logiska filer
5. **Dokumentera** - Kommentera din CSS för framtida underhåll

---

*Guide skapad för PIXILAB Blocks. För senaste uppdateringar, se [PIXILAB Wiki](https://pixilab.se/docs/blocks).*
