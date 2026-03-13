# CLAUDE.md — Craftomation

## Projektübersicht

**Craftomation** ist eine Echtzeit-Unterstützungs-App für ein physisches Gelände-/Hausspiel. Spielleiter steuern das Spiel über verschiedene Module auf ihren Geräten. Ein Gerät fungiert als **ListenServer** (Host), alle anderen verbinden sich als **Clients** über eine Session-ID.

Die App ist **kein Spiel für Spieler** — sie ist ein **Werkzeug für Spielleiter** ("Game Master Tool").

---

## Tech Stack

```
monorepo/
├── packages/
│   ├── shared/          # Gemeinsame TypeScript-Interfaces, Types, Enums
│   ├── frontend/        # React + TypeScript + Tailwind CSS (Vite)
│   └── backend/         # Node.js + Express + WebSocket (ws)
```

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, `ws` (WebSocket), `uuid`
- **Shared:** Gemeinsame Typen (kein Framework)
- **Monorepo:** npm workspaces
- **Kein externes UI-Framework** (nur Tailwind)
- **Kein ORM / keine Datenbank** — reines In-Memory-State im Backend, Auto-Save als JSON-Snapshots auf Disk
- **i18n:** Deutsch und Englisch (via eigenes simples i18n-System, kein externes Paket nötig)
- **Cross-Platform:** Läuft im Browser (mobile-first, responsive). Electron optional in späteren Iterationen.

---

## Architektur

### Kommunikation
- **WebSocket** für Echtzeit-Sync zwischen Host und Clients
- **REST (Express)** für nicht-Echtzeit-Aktionen (Join, Setup, Load)
- Host-Gerät startet Express + WebSocket Server
- Clients verbinden sich per Session-ID (`ws://[host-ip]:[port]?sessionId=XXX`)

### State Management (Frontend)
- Globaler Zustand via **React Context + useReducer**
- Kein Redux, kein Zustand/Jotai — KISS-Prinzip
- WebSocket-Nachrichten aktualisieren den globalen State über Reducer-Actions

### State Management (Backend)
- Vollständiger Spielzustand im Memory (`GameState`-Objekt)
- Auto-Save alle 60 Sekunden als JSON-Snapshot in `./saves/` Ordner
- Game-Loop läuft als `setInterval` im Backend

---

## Monorepo Setup

```bash
# Root package.json scripts:
"dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\""
"build": "npm run build -w shared && npm run build -w backend && npm run build -w frontend"
```

---

## Shared Types (packages/shared/src/types.ts)

Alle geteilten Typen hier definieren. Wichtigste:

```typescript
// Session
interface SessionConfig {
  sessionId: string;
  playerCount: number;        // Anzahl Spieler (Basis für alle Kalkulationen!)
  gameSpeed: number;          // 0.0 - 2.0, default 1.0
  consumptionRate: number;    // 0.0 - 2.0, default 1.0
  resourceTypeCount: number;  // 5 - 10, default 6
  activeModules: ModuleType[];
}

// Ressource
interface Resource {
  id: string;
  name: string;
  color: string;        // Hex-Farbe für UI
  initialLetter: string; // MUSS einzigartig sein!
}

// Spieler
interface Player {
  id: string;
  name: string;
  resources: Record<string, number>;      // resourceId -> Menge
  productionGoods: Record<string, number>; // itemId -> Menge
  consumables: Record<string, number>;     // itemId -> Menge
  knownRecipes: string[];                  // recipeIds
  patents: string[];
  cash: number;
  activeInMine: boolean;
  currentMineResource: string | null;
  manufacturingQueue: ManufacturingJob[];
}

// Rezept / Item
interface Recipe {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  type: 'production_good' | 'consumable';
  sequence: string[];   // Array von Resource-IDs (Länge = tier + 2, mind. 3)
  description?: string; // Nur für Produktionsmittel
}

// Market
interface MarketState {
  resources: Record<string, MarketEntry>;
  productionGoods: Record<string, MarketEntry>;
  consumables: Record<string, MarketEntry>;
  recipeListings: RecipeListing[];
}

interface MarketEntry {
  supply: number;
  price: number;
  baseConsumptionRate: number;
}

// WebSocket Message
interface WSMessage {
  type: WSMessageType;
  payload: unknown;
}
```

---

## Module

### Pflichtmodule (immer aktiv)
| Modul | Beschreibung |
|---|---|
| `mine` | Rohstoffproduktion — Spieler aktiv/inaktiv, Rohstoff wählbar |
| `manufacturing` | Fertigungshalle — Crafting-Queue pro Spieler |
| `lab` | Labor — Wordle-artiges Rezept-Experimentieren |
| `auction` | Auktionshalle — Markt für Ressourcen, Güter, Rezepte |

### Optionale Module (konfigurierbar im Setup)
| Modul | Beschreibung |
|---|---|
| `plantation` | Wie Mine, aber organische Rohstoffe |
| `patent_office` | Patente kaufen (passive Boni) |
| `stockmarket` | Unternehmensanteile handeln |
| `backroom` | Sabotage-Aktionen |
| `influencer` | Marktmanipulation |
| `warehouse` | Lagerübersicht für Spieler |

---

## Navigation / Views

```
App
├── StartMenu           → "Spiel hosten" | "Spiel beitreten"
├── HostMenu            → "Neues Spiel" | "Spiel laden"
├── JoinMenu            → Session-ID eingeben, Modul wählen, Alias, Beitreten
├── Setup               → Spielkonfiguration (nur Host), Spiel starten
├── WaitingScreen       → Warten bis Host Spiel startet (nur Clients)
└── Game
    ├── MineModule
    ├── ManufacturingModule
    ├── LabModule
    ├── AuctionModule
    └── [OptionalModule...]
```

---

## Game Loop (Backend)

Interval: **10 Sekunden** (skaliert mit `gameSpeed`)

Pro Tick:
1. **Ressourcenproduktion:** Für jeden aktiven Mine-Spieler: `+1` (+ Boni) des gewählten Rohstoffs auf Spielervorrat
2. **Marktverbrauch:** Von jedem Markt-Vorrat wird Verbrauchsmenge abgezogen
3. **Fertigungsfortschritt:** Laufende Crafting-Jobs ticken, fertige Jobs schreiben Güter auf Spielervorrat
4. **Verschleiß:** Produktionsmittel im Einsatz verlieren Durability
5. **Preisanpassung:** Marktpreise basierend auf Supply/Demand neu berechnen
6. **State-Broadcast:** Aktualisierter GameState an alle verbundenen Clients senden

---

## Spielmechanik-Details

### Ressourcennamen
- Aus CSV-Datei `packages/backend/src/data/resources.csv` ziehen
- Jede Ressource MUSS einen **einzigartigen Anfangsbuchstaben** haben (wichtig für Labor-Modul!)
- Farbzuweisung: Vordefiniertes Array attraktiver Hex-Farben

### Verbrauchsraten (Markt)
- **Ressourcen:** Start knapp unter `playerCount / resourceTypeCount` pro Tick. Steigt graduell über Spielzeit.
- **Produktionsmittel:** 0 bis mindestens 1x verkauft wurde. Dann langsam steigend. Hoher Preis, niedriger Verbrauch.
- **Konsumgüter:** Sobald verfügbar relativ hoher Verbrauch, steigt weiter.

### Preisformel (Markt)
```
price = basePriceForTier / (supply / referenceSupply)
// Mindestpreis: 1, Maximumpreis: cap per tier
```

### Fertigungszeiten
| Tier | Konsumgut | Produktionsmittel |
|---|---|---|
| 1 | 30s | 60s |
| 2 | 40s | 80s |
| 3 | 50s | 100s |
| 4 | 60s | 120s |
Alle Zeiten dividiert durch `gameSpeed`.

### Labor (Wordle-Logik)
- Grün: Richtiger Rohstoff, richtige Position
- Gelb: Rohstoff vorhanden, aber falsche Position
- Rot: Rohstoff nicht vorhanden / überschüssig
- Direkte Treffer (Grün) haben **Vorrang** vor Positionstreffern (Gelb)
- Ressourcen werden dem Spieler **abgezogen** ob Treffer oder nicht

### Verschleiß
- Timer pro Spieler pro Produktionsmittel-Typ
- Nach Ablauf: 1x Produktionsmittel aus Spielervorrat entfernt
- Mehrfache gleiche Produktionsmittel: proportional schnellerer Verschleiß

---

## Konventionen

### Dateistruktur Frontend
```
src/
├── components/
│   ├── ui/           # Wiederverwendbare UI-Atome (Button, Card, Badge, Dialog...)
│   ├── layout/       # Layout-Komponenten (AppShell, Header...)
│   └── modules/      # Eine Komponente pro Modul
├── views/            # Top-Level Route-Views
├── context/          # React Context + Reducer
├── hooks/            # Custom Hooks (useWebSocket, useGameState...)
├── i18n/             # Übersetzungen (de.ts, en.ts)
├── types/            # Frontend-spezifische Types (re-export shared types hier)
└── utils/            # Hilfsfunktionen
```

### Coding Standards
- **Keine `any`** — konsequentes TypeScript
- **Komponenten klein halten** — max. ~150 Zeilen pro Datei
- **Props immer typisieren** — kein implizites `props: any`
- **Keine Inline-Styles** — nur Tailwind-Klassen
- **Mobile-first** — alle Klassen zunächst für Mobile, dann `md:` und `lg:` breakpoints
- **Farben:** Tailwind-Klassen, keine hardcodierten Hex-Werte (außer dynamische Ressourcenfarben via `style`)

### i18n
```typescript
// Verwendung:
import { t } from '@/i18n';
t('startMenu.hostGame') // → "Spiel hosten" / "Host Game"
```

### WebSocket Events (WSMessageType enum)
```typescript
// Client → Server
'JOIN_SESSION' | 'LEAVE_SESSION' | 'UPDATE_PLAYER_STATUS' |
'CHANGE_MINE_RESOURCE' | 'ADD_MANUFACTURING_JOB' | 'REMOVE_MANUFACTURING_JOB' |
'LAB_EXPERIMENT' | 'MARKET_BUY' | 'MARKET_SELL' | 'LIST_RECIPE' | 'BUY_RECIPE'

// Server → Client
'GAME_STATE_UPDATE' | 'PLAYER_UPDATE' | 'MARKET_UPDATE' |
'SESSION_STARTED' | 'LAB_RESULT' | 'ERROR'
```

---

## Was Claude Code NICHT tun soll

- **Keine Datenbank** — reines In-Memory-State ist ausreichend und gewünscht
- **Kein Redux** — React Context + useReducer reicht
- **Kein Auth-System** — Session-ID ist ausreichend
- **Keine Tests** (erstmal) — Fokus auf Features
- **Kein CSS außer Tailwind** — kein styled-components, kein CSS-in-JS
- **Optionale Module** zunächst als Platzhalter/Stub implementieren — erst wenn Pflichtmodule fertig

---

## Prioritäten (Implementierungsreihenfolge)

1. **Monorepo-Grundstruktur** + Shared Types
2. **Backend:** Express + WebSocket Server, Session-Management, In-Memory GameState
3. **Frontend:** Navigation (StartMenu → HostMenu/JoinMenu → Setup → Game)
4. **Initiale Kalkulationen** (nach Setup: Ressourcen, Rezepte, Marktstate generieren)
5. **Game Loop** (Backend Tick-System)
6. **Modul Mine**
7. **Modul Fertigungshalle**
8. **Modul Labor**
9. **Modul Auktionshalle**
10. **Auto-Save / Load**
11. Optionale Module
