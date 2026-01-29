# PIXILAB Blocks CSS Skill

> **Syfte:** Referensdokument för att generera korrekt CSS-kod för PIXILAB Blocks.

---

## Snabbreferens - CSS-klasser

### Kontrolltyper och deras wrapper-klasser

| Kontroll | CSS-klass | Användning |
|----------|-----------|------------|
| Knapp | `.Button-ctl` | Alla knappelement |
| Indikator | `.Indicator-ctl` | Statusindikatorer |
| Slider | `.Slider-ctl` | Skjutreglage |
| Bar/Stapel | `.Bar-ctl` | Stapeldiagram/progress |
| Text | `.text-block` | Textblock |

### Tillståndsklasser (States)

| Klass | Trigger |
|-------|---------|
| `.pressed` | Knappen trycks ner |
| `.active` | Bunden egenskap är aktiv/true |
| `.show-cursor` | Muspekare ska visas |
| `.tag-XXX` | Automatisk klass från tagg |

---

## CSS-filplacering

### Alternativ 1: Block-lokal CSS
```
~/style.css
```
- Använd tilde (`~/`) för block-relativ sökväg
- Filen följer med vid export/import
- Skapas via penn-ikonen i "Custom CSS URL"

### Alternativ 2: Delad CSS (public)
```
public/style/namn.css
```
- Tillgänglig för alla block
- Referera utan inledande `/`

### Alternativ 3: Global CSS (automatisk)
```json
// I serverkonfiguration:
{ "defaultSpotCSS": "style/global.css" }
```
- Laddas automatiskt på alla Spots
- Relativ sökväg från public-mappen

---

## Kodmallar

### Grundläggande knappstil
```css
.Button-ctl {
    background-color: #3498db;
    border-radius: 8px;
    padding: 12px 24px;
    color: white;
    font-weight: 500;
    transition: all 0.2s ease;
}

.Button-ctl:hover {
    background-color: #2980b9;
}

.Button-ctl.pressed {
    transform: scale(0.97);
}

.Button-ctl.active {
    background-color: #27ae60;
}
```

### Osynlig knapp med feedback
```css
.Button-ctl.invisible {
    background: transparent;
    border: none;
}

.Button-ctl.invisible.pressed > div {
    background-color: rgba(255, 255, 255, 0.2);
}
```

### Gradient-knapp
```css
.gradient-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.gradient-button.pressed {
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}
```

### Textstil
```css
.text-block {
    font-family: 'Open Sans', sans-serif;
    color: #333;
    line-height: 1.6;
}

.text-block.heading {
    font-size: 2em;
    font-weight: 700;
    margin-bottom: 0.5em;
}

.text-block.subtitle {
    font-size: 1.2em;
    color: #666;
}
```

### Slider/reglage
```css
.Slider-ctl {
    background: #ecf0f1;
    border-radius: 4px;
}

.Slider-ctl .slider-fill {
    background: linear-gradient(90deg, #3498db, #2ecc71);
    border-radius: 4px;
}

.Slider-ctl .slider-handle {
    background: white;
    border: 2px solid #3498db;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

### Indikator
```css
.Indicator-ctl {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #bdc3c7;
    transition: background-color 0.3s ease;
}

.Indicator-ctl.active {
    background: #2ecc71;
    box-shadow: 0 0 10px rgba(46, 204, 113, 0.5);
}
```

### Bar/stapel
```css
.Bar-ctl {
    background: #ecf0f1;
    border-radius: 4px;
    overflow: hidden;
}

.Bar-ctl .bar-fill {
    background: linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71);
    transition: width 0.3s ease;
}
```

---

## Anpassade typsnitt

### @font-face mall
```css
@font-face {
    font-family: 'CustomFont';
    src: url('fonts/custom-font.woff2') format('woff2'),
         url('fonts/custom-font.woff') format('woff');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
```

### Typsnittsfamilj med fallbacks
```css
.text-block {
    font-family: 'CustomFont', -apple-system, BlinkMacSystemFont,
                 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}
```

**Format:** Använd WOFF2 (primärt) och WOFF (fallback)

---

## Avancerade mönster

### Pseudo-element för dekoration
```css
.decorated-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px solid currentColor;
    border-radius: inherit;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.decorated-button:hover::before {
    opacity: 1;
}
```

### Pulse-animation för aktiv indikator
```css
@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
}

.Indicator-ctl.active {
    animation: pulse 2s infinite;
}
```

### Glassmorphism-effekt
```css
.glass-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
}
```

### Dark mode knapp
```css
.dark-button {
    background: #1a1a2e;
    color: #eee;
    border: 1px solid #333;
}

.dark-button:hover {
    background: #16213e;
    border-color: #0f3460;
}

.dark-button.active {
    background: #0f3460;
    border-color: #e94560;
    color: #e94560;
}
```

---

## Vanliga mönster

### Centrera innehåll
```css
.centered {
    display: flex;
    justify-content: center;
    align-items: center;
}
```

### Skuggor (elevation)
```css
/* Nivå 1 - subtil */
box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);

/* Nivå 2 - medel */
box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);

/* Nivå 3 - hög */
box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
```

### Mjuka övergångar
```css
transition: all 0.2s ease;          /* Snabb */
transition: all 0.3s ease;          /* Standard */
transition: all 0.3s ease-in-out;   /* Mjuk in/ut */
transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); /* Material */
```

---

## Felsökning

### Hitta rätt selektor
1. Högerklicka på element → "Inspektera"
2. Identifiera klasser i Elements-panelen
3. Testa CSS i Styles-panelen
4. Kopiera fungerande CSS till din fil

### Vanliga problem

| Problem | Lösning |
|---------|---------|
| CSS laddas inte | Kontrollera sökvägen, ska vara relativ |
| Stil appliceras inte | Öka specificitet eller använd `!important` |
| Hover fungerar inte | Kontrollera att `.show-cursor` är aktiv |
| Font visas inte | Kontrollera CORS och filformat |

### Specificitet (prioritetsordning)
```css
/* Låg specificitet */
.Button-ctl { }

/* Högre specificitet */
.Button-ctl.my-class { }

/* Ännu högre */
div.Button-ctl.my-class { }

/* Forcera (undvik om möjligt) */
.my-class { color: red !important; }
```

---

## Färgpaletter

### Modern/Clean
```css
--primary: #3498db;
--secondary: #2ecc71;
--accent: #e74c3c;
--dark: #2c3e50;
--light: #ecf0f1;
```

### Dark Theme
```css
--bg-primary: #1a1a2e;
--bg-secondary: #16213e;
--accent: #e94560;
--text-primary: #eee;
--text-secondary: #a0a0a0;
```

### Warm/Friendly
```css
--primary: #ff6b6b;
--secondary: #feca57;
--accent: #48dbfb;
--dark: #222f3e;
--light: #f5f6fa;
```

---

## Checklista vid CSS-skapande

- [ ] Identifiera kontrolltyp (Button, Slider, etc.)
- [ ] Välj rätt wrapper-klass
- [ ] Hantera states (hover, pressed, active)
- [ ] Lägg till transitions för mjukhet
- [ ] Testa i DevTools innan implementation
- [ ] Placera fil på rätt plats (lokal/delad/global)

---

*Senast uppdaterad: 2026-01-29*
