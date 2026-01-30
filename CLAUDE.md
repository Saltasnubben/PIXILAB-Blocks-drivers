# PIXILAB Blocks CSS Skill

När användaren ber om hjälp med CSS för PIXILAB Blocks, använd denna referens.

## CSS-klasser i PIXILAB Blocks

| Kontroll | Wrapper-klass |
|----------|---------------|
| Knapp | `.Button-ctl` |
| Indikator | `.Indicator-ctl` |
| Slider | `.Slider-ctl` |
| Bar/Stapel | `.Bar-ctl` |
| Text | `.text-block` |

## States (tillstånd)

- `.pressed` - Knappen trycks ner
- `.active` - Bunden egenskap är aktiv/true
- `.show-cursor` - Muspekare visas
- `.tag-XXX` - Automatisk klass från tagg

## Selektor-struktur

```css
/* Grundstil */
.Button-ctl { }

/* Vid hover */
.Button-ctl:hover { }

/* När nedtryckt */
.Button-ctl.pressed { }

/* När aktiv (bound property true) */
.Button-ctl.active { }

/* Med custom class */
.Button-ctl.min-klass { }

/* Barn-element i knapp */
.Button-ctl.min-klass > div { }
```

## CSS-filplacering

1. **Block-lokal:** `~/style.css` (tilde = block-relativ)
2. **Delad:** `public/style/namn.css`
3. **Global:** `defaultSpotCSS` i serverkonfig

## Kodmallar

### Knapp med states
```css
.Button-ctl.KLASSNAMN {
    background-color: #3498db;
    border-radius: 8px;
    color: white;
    transition: all 0.2s ease;
}

.Button-ctl.KLASSNAMN:hover {
    background-color: #2980b9;
}

.Button-ctl.KLASSNAMN.pressed {
    transform: scale(0.97);
}

.Button-ctl.KLASSNAMN.active {
    background-color: #27ae60;
}
```

### Osynlig knapp med feedback
```css
.Button-ctl.KLASSNAMN {
    background: transparent;
    border: none;
}

.Button-ctl.KLASSNAMN.pressed > div {
    background-color: rgba(255, 255, 255, 0.2);
}
```

### Gradient-knapp
```css
.Button-ctl.KLASSNAMN {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}
```

### Text
```css
.text-block.KLASSNAMN {
    font-family: 'Open Sans', sans-serif;
    color: #333;
    line-height: 1.6;
}
```

### Slider
```css
.Slider-ctl.KLASSNAMN {
    background: #ecf0f1;
    border-radius: 4px;
}
```

### Indikator
```css
.Indicator-ctl.KLASSNAMN {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #bdc3c7;
}

.Indicator-ctl.KLASSNAMN.active {
    background: #2ecc71;
    box-shadow: 0 0 10px rgba(46, 204, 113, 0.5);
}
```

### Bar
```css
.Bar-ctl.KLASSNAMN {
    background: #ecf0f1;
    border-radius: 4px;
}
```

### Anpassat typsnitt
```css
@font-face {
    font-family: 'CustomFont';
    src: url('fonts/font.woff2') format('woff2'),
         url('fonts/font.woff') format('woff');
    font-weight: normal;
    font-style: normal;
}
```

## Vanliga CSS-egenskaper

```css
/* Bakgrund */
background-color: #hex;
background: linear-gradient(angle, color1, color2);
background: rgba(r, g, b, alpha);

/* Rundade hörn */
border-radius: 8px;
border-radius: 50%; /* Cirkel */

/* Skugga */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* Text */
color: #hex;
font-size: 16px;
font-weight: 500;
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

/* Animation */
transition: all 0.2s ease;
transform: scale(0.97);

/* Storlek */
width: 100px;
height: 50px;
padding: 12px 24px;
```

## Instruktioner

När du skapar CSS för PIXILAB Blocks:

1. **Fråga vilken kontrolltyp** (knapp, slider, text, etc.)
2. **Använd rätt wrapper-klass** från tabellen ovan
3. **Inkludera alltid states** (hover, pressed, active) för interaktiva element
4. **Lägg till transitions** för mjuka övergångar
5. **Byt ut KLASSNAMN** mot användarens önskade klassnamn
6. **Förklara var CSS-filen ska placeras**
