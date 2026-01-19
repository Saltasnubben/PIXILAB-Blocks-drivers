# Rentman Booking Visualizer

En webapp som visar en översikt av crew-bokningar från Rentman. Välj crewmedlemmar och tidsperiod (1-14 dagar) för att se deras bokade projekt i en tydlig timeline-vy.

![Screenshot](docs/screenshot-placeholder.png)

## Funktioner

- **Crew-väljare** - Sök och välj en eller flera crewmedlemmar
- **Flexibel tidsperiod** - Välj mellan 1 dag och 2 veckor
- **Snabbval** - Knappar för Idag, 3 dagar, 1 vecka och 2 veckor
- **Visuell timeline** - Se alla bokningar på en tydlig tidslinje
- **Hover-tooltips** - Se detaljer om varje bokning
- **Statistik** - Antal bokningar, projekt och dagar

## Teknikstack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **API:** Rentman Public API

## Kom igång

### Förutsättningar

- Node.js 18 eller högre
- Rentman-konto med API-access
- Rentman API-token

### 1. Klona repot

```bash
git clone https://github.com/your-username/rentman-booking-visualizer.git
cd rentman-booking-visualizer
```

### 2. Installera beroenden

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 3. Konfigurera miljövariabler

```bash
cp backend/.env.example backend/.env
```

Öppna `backend/.env` och fyll i din Rentman API-token:

```env
RENTMAN_API_TOKEN=your_api_token_here
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Så får du API-token:**
1. Logga in på Rentman
2. Gå till *Configuration > Account > Integrations*
3. Klicka på *Connect* vid "API"
4. Klicka på *Show token* och kopiera

### 4. Starta applikationen

Starta både backend och frontend samtidigt:

```bash
npm run dev
```

Eller starta separat:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

Öppna [http://localhost:5173](http://localhost:5173) i webbläsaren.

## Projektstruktur

```
rentman-booking-visualizer/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server
│   │   ├── routes/
│   │   │   ├── bookings.js       # Boknings-endpoints
│   │   │   ├── crew.js           # Crew-endpoints
│   │   │   └── projects.js       # Projekt-endpoints
│   │   └── services/
│   │       └── rentmanClient.js  # Rentman API-klient
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CrewSelector.jsx    # Multiselect för crew
│   │   │   ├── DateRangePicker.jsx # Datumväljare
│   │   │   ├── StatusBar.jsx       # API-status
│   │   │   └── Timeline.jsx        # Boknings-timeline
│   │   ├── services/
│   │   │   └── api.js              # API-anrop
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── package.json
├── package.json
└── README.md
```

## API-endpoints

Backend exponerar följande endpoints:

| Metod | Endpoint | Beskrivning |
|-------|----------|-------------|
| GET | `/api/health` | Hälsokontroll |
| GET | `/api/crew` | Lista alla crewmedlemmar |
| GET | `/api/crew/:id` | Hämta en crewmedlem |
| GET | `/api/projects` | Lista projekt (med datumfilter) |
| GET | `/api/bookings` | Hämta bokningar för valda crew och period |

### Exempel: Hämta bokningar

```bash
curl "http://localhost:3001/api/bookings?crewIds=1,2,3&startDate=2024-01-15&endDate=2024-01-22"
```

## Produktion

### Bygg frontend

```bash
npm run build
```

Byggda filer hamnar i `frontend/dist/`.

### Kör i produktion

```bash
NODE_ENV=production npm run start
```

## Utveckling

### Lägg till fler funktioner

Några idéer för vidareutveckling:

- [ ] Exportera till PDF/Excel
- [ ] Filtrera på projektstatus
- [ ] Visa konflikter/dubbelbokningar
- [ ] Dragbar tidsperiod i kalendern
- [ ] Mörkt läge
- [ ] Push-notiser vid ändringar

## Licens

MIT

## Länkar

- [Rentman](https://rentman.io)
- [Rentman API-dokumentation](https://api.rentman.net/)
- [Rentman Support Center](https://support.rentman.io)
