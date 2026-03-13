# Craftomation — Claude Code Prompts

Diese Datei enthält die sequenziellen Prompts für Claude Code.
**Immer einen Prompt komplett abschließen lassen bevor der nächste kommt.**

---

## PROMPT 1 — Monorepo-Grundstruktur & Shared Types

```
Initialisiere ein npm-Workspaces-Monorepo für das Projekt "Craftomation".

Struktur:
monorepo/
├── package.json              (root, npm workspaces)
├── packages/
│   ├── shared/               (gemeinsame TypeScript-Types)
│   ├── frontend/             (React 18 + TypeScript + Tailwind CSS via Vite)
│   └── backend/              (Node.js + Express + ws WebSocket)

Anforderungen:
- Root package.json mit workspace-Konfiguration und concurrently für "npm run dev"
- shared/: reines TypeScript-Paket, wird von frontend und backend importiert
  - Alle Types aus CLAUDE.md implementieren (SessionConfig, Player, Resource, Recipe,
    MarketState, MarketEntry, RecipeListing, ManufacturingJob, WSMessage, WSMessageType)
  - ModuleType als Union Type: 'mine' | 'manufacturing' | 'lab' | 'auction' | 
    'plantation' | 'patent_office' | 'stockmarket' | 'backroom' | 'influencer' | 'warehouse'
- frontend/: Vite + React 18 + TypeScript + Tailwind CSS konfigurieren
  - Path alias "@/" für "src/" einrichten
  - Minimales App.tsx mit Placeholder
- backend/: TypeScript mit ts-node-dev für hot reload
  - Minimales Express-Setup auf Port 3001 mit einem GET "/" health-check
  - tsconfig.json konfigurieren

Keine Logik, kein Spielcode — nur sauberes Grundgerüst, das fehlerfrei mit 
"npm run dev" aus dem Root startet.
```

---

## PROMPT 2 — Backend: Session & GameState

```
Im backend package: Implementiere Session-Management und GameState-Grundstruktur.

1. GameState (src/state/gameState.ts):
   - Singleton-Klasse oder Modul das den kompletten Spielzustand hält
   - Felder: config (SessionConfig), players (Map<id, Player>), market (MarketState),
     resources (Resource[]), recipes (Recipe[]), gameTick (number), 
     gameStarted (boolean), connectedClients (Map<id, WebSocket>)

2. Session-Management (src/session/sessionManager.ts):
   - generateSessionId(): gibt 6-stelligen alphanumerischen Code zurück
   - Aktuell eine Session gleichzeitig (Simplizität)

3. WebSocket Server (src/websocket/wsServer.ts):
   - ws-Server auf Port 3002
   - Connection-Handler: Client registriert sich mit sessionId und moduleType
   - Disconnect-Handler: Client aus connectedClients entfernen
   - broadcast(message): sendet an alle verbundenen Clients
   - Message-Router: switch/case auf WSMessageType, ruft jeweiligen Handler auf
     (Handlers noch als Stubs/TODOs)

4. REST-Endpunkte (src/routes/):
   - POST /api/session/create → erstellt neue Session, gibt sessionId zurück
   - POST /api/session/join → validiert sessionId, gibt SessionConfig zurück  
   - POST /api/session/load → lädt Snapshot, gibt sessionId zurück
   - GET /api/session/:id/status → gibt zurück ob Session existiert

5. Auto-Save (src/state/autoSave.ts):
   - Alle 60 Sekunden (wenn Spiel läuft): GameState als JSON in ./saves/ speichern
   - loadLatestSave(): liest neuesten Snapshot

Typen aus @craftomation/shared importieren.
```

---

## PROMPT 3 — Backend: Initiale Kalkulationen

```
Im backend package: Implementiere die initialen Kalkulationen die beim Spielstart 
ausgeführt werden.

1. Datendateien anlegen (src/data/):
   - resources.csv: 20 Ressourcennamen auf Deutsch + Englisch, je mit einzigartigem
     Anfangsbuchstaben. Spalten: id, nameDE, nameEN, initialLetter
     Beispiele: Eisen(E), Kupfer(K), Stein(S), Holz(H), Sand(A), Kohle(O), 
     Quarz(Q), Lehm(L), Jade(J), Titan(T), etc. — alle mit einzigartigen Anfangsbuchstaben
   - production_goods.csv: 15 Produktionsmittel, Spalten: id, nameDE, nameEN, tier (1-4),
     description (kurze Beschreibung des passiven Bonus auf DE)
     Beispiele: Hacke(T1), Förderband(T2), Bergbaukran(T3), Automatisierungsmodul(T4)...
   - consumables.csv: 20 Konsumgüter, Spalten: id, nameDE, nameEN, tier (1-4)
     Beispiele: Backsteine(T1), Keramik(T1), Schmuck(T2), Werkzeug(T2)...

2. initialCalculations.ts (src/game/initialCalculations.ts):
   Funktion `runInitialCalculations(config: SessionConfig): void`
   
   Schritt 1 — Ressourcen auswählen:
   - Zufällig config.resourceTypeCount Ressourcen aus CSV ziehen
   - Einzigartige Anfangsbuchstaben sicherstellen
   - Attraktive Farben zuweisen (vordefiniertes Array von mind. 10 Hex-Farben)
   - In GameState.resources speichern
   
   Schritt 2 — Rezepte generieren:
   - Alle Produktionsmittel deren Module aktiv sind aus CSV laden
   - Für jedes: Zufällige Ressourcensequenz der Länge (tier + 2) aus den 
     gewählten Ressourcen generieren (Wiederholungen erlaubt)
   - Dasselbe für Konsumgüter: Anzahl = config.playerCount * 3 (min 10, max 20),
     zufällig aus CSV gezogen
   - In GameState.recipes speichern
   
   Schritt 3 — Markt initialisieren:
   - Alle Ressourcen: supply = 100, consumption = playerCount/resourceTypeCount * 0.8
   - Alle Produktionsmittel: supply = 0, consumption = 0 (startet erst nach erstem Verkauf)
   - Alle Konsumgüter: supply = 0, consumption = 0
   - Basispreise nach Tier: T1=10, T2=25, T3=60, T4=150 (Ressourcen: 5)
   - In GameState.market speichern
   
   Schritt 4 — Erste Rezepte für Spieler (noch keine Spieler vorhanden, nur Vorbereitung)

3. REST-Endpunkt erweitern:
   - POST /api/session/start → ruft runInitialCalculations auf, startet Game Loop Stub,
     setzt gameStarted = true, broadcastet SESSION_STARTED an alle Clients
```

---

## PROMPT 4 — Backend: Game Loop

```
Im backend package: Implementiere den Game Loop.

Datei: src/game/gameLoop.ts

Funktion startGameLoop():
- setInterval mit 10000ms / gameSpeed (Spielgeschwindigkeit als Teiler)
- Pro Tick (Funktion processTick()):

  1. RESSOURCENPRODUKTION (Mine):
     - Für jeden Spieler mit activeInMine = true und currentMineResource != null:
       players[id].resources[currentMineResource] += 1 (+ Boni durch Produktionsmittel)
     - Boni-System: Für jeden Produktionsmittel-Typ den Spieler besitzt:
       Schaue in productionBonuses-Map (hardcoded Map: itemId → {miningBonus: number})

  2. FERTIGUNGSFORTSCHRITT:
     - Für jeden Spieler: ersten Job in manufacturingQueue bearbeiten
     - job.remainingSeconds -= 10 (oder weniger wenn fast fertig)
     - Wenn remainingSeconds <= 0: Gut zum Spielervorrat hinzufügen, Job aus Queue entfernen
     - Wenn Ressourcen für nächsten Job fehlen: Job ans Ende schieben (max. 1x pro Tick pro Job)

  3. MARKTVERBRAUCH:
     - Für jede Ressource: supply -= consumption * consumptionRate * (1 + gameTick * 0.001)
       (graduelle Steigerung über Spielzeit)
     - Für Produktionsmittel: wenn mind. 1x verkauft: consumption langsam hochfahren
     - Supply minimum: 0 (kein negativer Vorrat)

  4. VERSCHLEISS:
     - Pro Spieler pro aktiven Produktionsmittel-Typ: wearTimer[playerId][itemId] -= 10
     - Wenn Timer <= 0: 1x Produktionsmittel aus Spielervorrat entfernen, Timer reset
     - Mehrere gleiche Items: Timer reset = baseWearTime / count

  5. PREISANPASSUNG:
     Formel pro Item: newPrice = basePriceForTier * (referenceSupply / max(supply, 1))
     Preise cappen: min=1, max=basePriceForTier*10

  6. BROADCAST:
     - Vollständigen aktualisierten GameState als GAME_STATE_UPDATE an alle Clients senden
     - gameTick++

Funktion stopGameLoop(): clearInterval

GameLoop-Modul im server.ts starten wenn POST /api/session/start aufgerufen wird.
```

---

## PROMPT 5 — Frontend: Navigation & Grundstruktur

```
Im frontend package: Implementiere das komplette Navigations-System und alle Views 
als funktionale Grundstruktur (Logik kommt in späteren Prompts).

1. i18n (src/i18n/):
   - de.ts und en.ts mit allen UI-Texten aus dem Dokument
   - i18n.ts: einfache t(key) Funktion, Sprache via localStorage gespeichert
   - LanguageToggle-Komponente (DE/EN Button)

2. Global State (src/context/GameContext.tsx):
   - GameProvider mit useReducer
   - State: { view, sessionId, moduleType, alias, gameState, isHost }
   - Actions: NAVIGATE, SET_SESSION, SET_GAME_STATE, etc.
   - useGame() hook

3. WebSocket Hook (src/hooks/useWebSocket.ts):
   - Verbindung aufbauen/trennen
   - Automatisch GameContext updaten bei eingehenden Nachrichten
   - Reconnect-Logik (3 Versuche)

4. Views implementieren (src/views/):
   
   StartMenu.tsx:
   - Label "Craftomation" (groß, mittig oben)
   - 2 Buttons je 50% Viewport-Höhe: "Spiel hosten" | "Spiel beitreten"
   - Mobile-first, responsive
   
   HostMenu.tsx:
   - Label "Spiel eröffnen" + Zurück-Button
   - 2 Buttons je 50%: "Neues Spiel" | "Spiel laden"
   
   JoinMenu.tsx:
   - Label "Spiel beitreten" + Zurück-Button  
   - Texteingabe Session-ID
   - Select: Modul auswählen (alle Module als Optionen)
   - Optionales Alias-Feld
   - "Beitreten" Button (disabled bis ID eingegeben)
   
   Setup.tsx:
   - Sticky Header mit Session-ID + Copy-Button
   - Scrollbare Liste mit:
     - Liste verbundener Geräte (Alias + Modul) — placeholder für jetzt
     - Spieleranzahl (number input, min 2)
     - Spielgeschwindigkeit (0-2, Schritte 0.1, Slider)
     - Verbrauchsrate (0-2, Schritte 0.1, Slider)
     - Ressourcentypen (5-10, Schritte 1, Slider)
     - Optionale Module: Checkboxen
   - Sticky "Spiel starten" Button
   
   WaitingScreen.tsx:
   - "Warte auf Spielstart..." Nachricht
   - Session-ID anzeigen
   - Modul + Alias anzeigen
   
   GameShell.tsx:
   - Wrapper für alle Game-Module
   - Zeigt das richtige Modul basierend auf moduleType
   - Header mit Session-ID und Verbindungsstatus

5. UI-Komponenten (src/components/ui/):
   Button, Card, Badge, Dialog, Input, Select, Slider, Spinner
   — alle in Tailwind, kein externes UI-Framework

Schlichtes, dunkles Design. Mobile-first. Funktional und übersichtlich.
Keine Animationen die die Performance beeinträchtigen.
```

---

## PROMPT 6 — Modul Mine

```
Im frontend und backend: Implementiere das Modul Mine vollständig.

BACKEND (src/handlers/mineHandler.ts):
- Handler für UPDATE_PLAYER_STATUS: { playerId, active: boolean }
  → Player in GameState aktiv/inaktiv setzen, broadcast
- Handler für CHANGE_MINE_RESOURCE: { playerId, resourceId }
  → Ressource für Spieler setzen, broadcast
- Handler für ADD_PLAYER: { playerName }
  → Neuen Spieler anlegen (mit Default-State), broadcast
- Spieler haben eine eindeutige ID (uuid) und einen Namen

FRONTEND (src/components/modules/MineModule.tsx):
Layout:
- Header: Modul-Titel "Modul Mine"
- "Spieler hinzufügen" Button (öffnet Dialog)
- Dialog "Neuer Spieler": Texteingabe Name + Bestätigen-Button
- Alphabetisch sortierte, scrollbare Liste
  - Aktive Spieler IMMER oben (dann alphabetisch), inaktive unten
  - Pro Zeile:
    - Spieler-Name
    - Toggle-Button Aktiv/Inaktiv (2 Zustände, visuell unterscheidbar)
    - Ressourcen-Select: Dropdown mit allen verfügbaren Ressourcen
      (Ressource wird als farbiger Badge mit Anfangsbuchstaben angezeigt)
  - Aktive Spieler: Reihe grün hinterlegt
  - Inaktive Spieler: Reihe grau hinterlegt

Die Ressourcen-Auswahl soll die Farbe der Ressource als farbigen Punkt/Badge zeigen.
Beim Laden des Moduls: Spielerliste aus GameState beziehen.
Änderungen sofort per WebSocket ans Backend senden.
```

---

## PROMPT 7 — Modul Fertigungshalle

```
Im frontend und backend: Implementiere das Modul Fertigungshalle vollständig.

BACKEND (src/handlers/manufacturingHandler.ts):
- Handler für ADD_MANUFACTURING_JOB: { playerId, recipeId, repeat: boolean }
  → Job zur Queue hinzufügen (repeat = unendliche Wiederholung)
  → Ressourcen werden erst entnommen wenn Job an der Reihe ist
- Handler für REMOVE_MANUFACTURING_JOB: { playerId, jobIndex }
  → Job aus Queue entfernen

FRONTEND:
MobileModule.tsx (Spielerliste):
- Liste aller Spieler als anklickbare Cards
- Zeigt Name + Anzahl Jobs in Queue als Badge

PlayerManufacturingView.tsx (Spielerdetail):
- Sticky zurück-Button
- "Vorräte anzeigen" Button → Dialog mit aktuellen Ressourcen/Gütern des Spielers
  (als übersichtliche Liste mit Mengen)
- Aktuelle Queue:
  - Liste laufender/wartender Jobs
  - Pro Job: Rezeptname, Fortschrittsbalken (bei laufendem Job), X-Button zum Entfernen
  - Erster Job hat Fortschrittsbalken
- Rezeptliste (dem Spieler bekannte Rezepte):
  - Sortiert nach Kategorie (Produktionsmittel / Konsumgüter) dann alphabetisch
  - Pro Rezept: Name, Tier-Badge, Ressourcensequenz als farbige Badges
    (Anfangsbuchstabe + Farbe pro Ressource)
  - "+" Button: 1x zur Queue hinzufügen
  - "∞" Button: Dauerprodukion (repeat = true, visuell als aktiv/inaktiv toggle)
  
Rezepte werden initial für jeden Spieler leer sein — später via Labor freischaltbar.
Füge für Testzwecke eine "Debug: Rezept hinzufügen" Funktion hinzu die ein Rezept 
direkt freischaltet (nur im Dev-Modus sichtbar).
```

---

## PROMPT 8 — Modul Labor

```
Im frontend und backend: Implementiere das Modul Labor vollständig.

BACKEND (src/handlers/labHandler.ts):
Handler für LAB_EXPERIMENT: { playerId, sequence: string[] (resourceIds) }

Logik:
1. Ressourcen aus Spielervorrat abziehen (sequence als Kosten)
   Falls nicht genug: Error zurückgeben { type: 'LAB_RESULT', success: false, 
   reason: 'insufficient_resources' }
2. Alle Rezepte filtern: gleiches Tier (Länge der sequence bestimmt Tier), 
   noch nicht bekannt beim Spieler
3. Ähnlichkeitswert berechnen (0-1) für jedes Rezept:
   Wordle-Algorithmus: 
   - Direkte Treffer (gleiche Ressource, gleiche Position) zuerst markieren (Grün)
   - Dann verbleibende: Ressource vorhanden aber falsche Position (Gelb)
   - Rest: Rot
   - Ähnlichkeit = (grünAnzahl + gelbAnzahl*0.5) / sequenzLänge
4. Rezept mit höchstem Ähnlichkeitswert finden
5. Wenn Ähnlichkeit = 1 (Volltreffer): Rezept für Spieler freischalten
6. Antwort: { type: 'LAB_RESULT', success: true, 
   match: boolean, recipeUnlocked?: Recipe,
   colorCoding: Array<'green'|'yellow'|'red'> }

FRONTEND:
LabModule.tsx (Spielerliste) — identisch zu ManufacturingModule Pattern

PlayerLabView.tsx (Spielerdetail):
- Sticky Zurück-Button
- "Vorräte" Button → Dialog
- Drag & Drop Ressource-Auswahl:
  - Ressource-Palette oben: Alle verfügbaren Ressourcen als ziehbare Icons
    (farbiger Kreis mit Anfangsbuchstabe, Name darunter)
    Disabled wenn Spieler nicht genug davon hat (für jeden belegten Slot)
  - Slot-Bereich: 6 Slots nebeneinander
    - Slots 1-3: immer verfügbar
    - Slot 4: verfügbar ab globaler Techstufe 2
    - Slot 5: ab Techstufe 3
    - Slot 6: ab Techstufe 4
    (Techstufe zunächst hardcoded auf 1 — ausbaubar)
  - Ressourcen per Drag & Drop oder Klick in Slots ziehen
  - X-Button pro Slot zum Leeren
- "Experimentieren" Button (disabled wenn < 3 Slots belegt)
  → Schickt Anfrage ans Backend
  → Ergebnis: Slots werden grün/gelb/rot eingefärbt mit Erklärungstext
  → Bei Treffer: Erfolgsmeldung + Rezept anzeigen
  → Nach Experiment: Slots leeren (neuer Versuch)
```

---

## PROMPT 9 — Modul Auktionshalle

```
Im frontend und backend: Implementiere das Modul Auktionshalle vollständig.

BACKEND (src/handlers/auctionHandler.ts):
- MARKET_BUY: { playerId, itemId, itemType, amount }
  → Preis berechnen, Cash abziehen, Item zu Spieler, Marktvorrat erhöhen
  → Falls nicht genug Cash: Error
- MARKET_SELL: { playerId, itemId, itemType, amount }
  → Preis berechnen, Cash gutschreiben, Item von Spieler entfernen, Marktvorrat senken
  → Falls nicht genug Items: Error
- LIST_RECIPE: { playerId, recipeId, price }
  → Rezept-Listing zum Markt hinzufügen
- BUY_RECIPE: { buyerPlayerId, listingId }
  → Cash von Käufer, Rezept freischalten, Listing entfernen

FRONTEND:
AuctionModule.tsx (Spielerliste) — identisch zu bisherigem Pattern

PlayerAuctionView.tsx (Spielerdetail):
- Sticky Zurück-Button
- 2 Tabs: "Güter" | "Rezepte"

Tab Güter (scrollbar):
- Cash-Anzeige des Spielers (prominent, oben)
- 3 Sektionen: Ressourcen / Produktionsmittel / Konsumgüter (je alphabetisch)
- Pro Item eine Zeile:
  - Farbiger Badge (Ressourcen) oder Name
  - Aktueller Spielervorrat
  - Aktueller Marktpreis (mit Trend-Indikator ↑↓ optional)
  - Buttons: [−5] [−] [+] [+5] (minus=verkaufen, plus=kaufen)
  - Buttons disabled wenn: Kauf → zu wenig Cash; Verkauf → zu wenig Items

Tab Rezepte (scrollbar):
- Liste aller Rezept-Listings (von anderen Spielern angeboten):
  - Rezeptname, Typ-Badge, Beschreibung (Produktionsmittel), Preis
  - "Kaufen" Button (disabled wenn zu wenig Cash oder schon bekannt)
- "+" Floating-Button: öffnet "Rezept anbieten" Dialog
  - Select: Eigene bekannte Rezepte
  - Preis-Input (Zahl)
  - Abschicken / Abbrechen

Hinweis: Marktpreise und Spielerdaten werden durch regelmäßige GAME_STATE_UPDATE 
WebSocket-Broadcasts aktuell gehalten (kein separates Polling nötig).
```

---

## PROMPT 10 — Auto-Save, Polishing & Load-Game

```
Abschluss-Prompt: Reste implementieren und alles zusammenführen.

1. AUTO-SAVE vervollständigen:
   - Alle 60 Sekunden: kompletter GameState als JSON in ./saves/save_[timestamp].json
   - Maximal 5 Saves aufbewahren (älteste löschen)
   - "Spiel laden" im HostMenu: Liste verfügbarer Saves anzeigen
     (als neuer View LoadGameView.tsx mit Timestamps und Spielerkonfiguration)

2. SETUP → SPIELSTART verbinden:
   - POST /api/session/start aufrufen
   - Auf SESSION_STARTED Event warten → alle Clients navigieren zu ihrem Modul
   - Host navigiert zu GameShell mit Mine als Standard (oder wählbar)

3. VERBUNDENE GERÄTE im Setup:
   - Wenn ein Client /api/session/join aufruft: Server broadcastet CLIENT_CONNECTED
   - Setup-View zeigt aktualisierte Liste

4. SPIELGESCHWINDIGKEIT als Faktor überall anwenden:
   - Game Loop Interval: 10000ms / gameSpeed
   - Fertigungszeiten: time / gameSpeed
   - Verschleiß-Timer: time / gameSpeed

5. FEHLERBEHANDLUNG:
   - Netzwerkfehler: Toast-Notifications (eigene kleine Toast-Komponente)
   - Verbindungsverlust: Reconnect-Banner
   - Servervalidierungsfehler: inline in den Modulen anzeigen

6. RESPONSIVE POLISH:
   - Alle Views auf iPad (768px) testen und anpassen
   - Alle touch targets mind. 44px hoch
   - Scrollbare Listen haben immer -webkit-overflow-scrolling: touch

7. README.md im Root:
   - Schnellstart (npm install, npm run dev)
   - Wie man das Backend auf einem Gerät im lokalen Netzwerk startet
   - Wie Clients sich verbinden (lokale IP statt localhost)
```

---

## Hinweise für die Verwendung

- **Jeden Prompt einzeln** in Claude Code eingeben
- Nach jedem Prompt: kurz reviewen ob alles kompiliert (`npm run build`)
- Die **CLAUDE.md liegt im Root des Projekts** — Claude Code liest sie automatisch
- Bei Fragen/Unklarheiten: im Prompt einfach nachfragen lassen
- Optionale Module (Patentamt, Börse, etc.) kommen **nach** diesen 10 Prompts als eigene Prompts
