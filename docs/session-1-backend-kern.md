# Session 1 — Produktionsmittel: Backend-Kern

## Ziel
Das komplette Backend für Produktionsmittel implementieren: Types, Rezeptgenerierung, Verschleiß-System, Bonus-Anwendung, und Handelsrestriktionen. Nach dieser Session soll das Backend Produktionsmittel vollständig unterstützen.

## Kontext
Lies `docs/produktionsmittel-plan.md` für die vollständige Spezifikation. Die wichtigsten Regeln:
- Produktionsmittel geben passive Boni, unterliegen Verschleiß (Timer-basiert)
- Nur 1 pro Bonus-Typ aktiv, stärkstes gewinnt
- Auto-Aktivierung bei Zerfall oder Neuerwerb
- Nur unbenutzte Items handelbar (Verschleiß-Timer nicht gestartet)
- Verschleiß: Tier 1: 4min, Tier 2: 5min, Tier 3: 6min, Tier 4: 8min (÷ gameSpeed)
- Craftzeiten: Tier 1: 60s, Tier 2: 80s, Tier 3: 100s, Tier 4: 120s (÷ gameSpeed)
- Boni sind additiv zum Base-Wert, dann multiplikativ mit Boost/Mining Rights

---

## Schritt 1: Shared Types erweitern (`packages/shared/src/types.ts`)

### 1a. Recipe.type erweitern
```typescript
// Vorher: type: 'consumable'
// Nachher:
type: 'consumable' | 'production_good'
```

### 1b. Neue Interfaces hinzufügen
```typescript
// Bonus-Typen die ein Produktionsmittel geben kann
type ProductionGoodBonusType =
  | 'mining_boost'        // +N Rohstoffe pro Tick
  | 'plantation_boost'    // +N Rohstoffe pro Tick (Plantage)
  | 'craft_speed'         // -X% Fertigungszeit
  | 'lab_distinct_count'  // Zeigt Anzahl unterschiedlicher Rohstoffe
  | 'lab_direction'       // Gelbe Hinweise zeigen Richtung
  | 'lab_exclusion'       // Zeigt welche Rohstoffe NICHT im Rezept
  | 'market_info'         // Markt-Zusatzinfos
  | 'sabotage'            // Sabotage-Bonus
  | 'sabotage_defense'    // Sabotage-Abwehr
  | 'patent_office';      // Patent-Rabatt

interface ProductionGoodDefinition {
  id: string;
  tier: 1 | 2 | 3 | 4;
  bonusType: ProductionGoodBonusType;
  bonusValue: number;           // z.B. 1 für +1, 25 für -25%, je nach Typ
  module: string;               // Welches Modul profitiert
  wearDurationMs: number;       // Verschleiß-Dauer in ms (Basis, vor gameSpeed)
}

interface ActiveProductionGood {
  itemId: string;               // ID des Produktionsmittels (z.B. 'pickaxe')
  wearRemainingMs: number;      // Verbleibende Verschleiß-Zeit in ms
  wearStartedAt: number | null; // Timestamp wann Verschleiß gestartet (null = unbenutzt)
  isUsed: boolean;              // true = aktiviert gewesen, nicht mehr handelbar
}
```

### 1c. Player Interface erweitern
```typescript
// Neue Felder zum Player hinzufügen:
productionGoods: Record<string, ActiveProductionGood[]>;  // itemId -> Array von Items (mehrere gleiche möglich)
```

### 1d. MarketState erweitern
```typescript
// Neues Feld in MarketState:
productionGoods: Record<string, MarketEntry>;  // itemId -> MarketEntry
```

### 1e. GameState erweitern (falls nötig)
```typescript
// Neues Feld in GameState:
productionGoodDefinitions: ProductionGoodDefinition[];  // Alle definierten Produktionsmittel
```

### 1f. LabResult erweitern
```typescript
// Neue optionale Felder zu LabResult:
distinctResourceCount?: number;     // Notizbuch-Bonus
excludedResources?: string[];       // Spektrometer-Bonus
directionHints?: ('left' | 'right' | null)[];  // Mikroskop-Bonus
```

---

## Schritt 2: Produktionsmittel-Definitionen (`packages/backend/src/data/productionGoods.ts`)

Neue Datei erstellen mit allen Produktionsmittel-Definitionen:

```typescript
// Alle Items aus docs/produktionsmittel-plan.md als Array
// Verschleiß-Zeiten in ms: T1=240000, T2=300000, T3=360000, T4=480000
// bonusValue Interpretation:
//   mining_boost/plantation_boost: +N Rohstoffe (additiv zu Base 1)
//   craft_speed: Prozent Reduktion (25, 40, 55, 60)
//   lab_*: 1 = aktiv (boolean)
//   market_info: Tier des Info-Levels (1, 2, 3)
//   sabotage: Prozent Bonus (25 für Lockpick, 100 für False Retina = anonym)
//   sabotage_defense: 1 = aktiv
//   patent_office: Prozent Rabatt (25 für Textbook, -25 für stärkere Boni bei Android)

export const PRODUCTION_GOOD_DEFINITIONS: ProductionGoodDefinition[] = [
  // Tier 1
  { id: 'pickaxe', tier: 1, bonusType: 'mining_boost', bonusValue: 1, module: 'mine', wearDurationMs: 240_000 },
  { id: 'sickle', tier: 1, bonusType: 'plantation_boost', bonusValue: 1, module: 'plantation', wearDurationMs: 240_000 },
  { id: 'workbench', tier: 1, bonusType: 'craft_speed', bonusValue: 25, module: 'manufacturing', wearDurationMs: 240_000 },
  { id: 'notebook', tier: 1, bonusType: 'lab_distinct_count', bonusValue: 1, module: 'lab', wearDurationMs: 240_000 },
  { id: 'market_report', tier: 1, bonusType: 'market_info', bonusValue: 1, module: 'auction', wearDurationMs: 240_000 },
  // Tier 2
  { id: 'drill', tier: 2, bonusType: 'mining_boost', bonusValue: 2, module: 'mine', wearDurationMs: 300_000 },
  { id: 'greenhouse', tier: 2, bonusType: 'plantation_boost', bonusValue: 2, module: 'plantation', wearDurationMs: 300_000 },
  { id: 'conveyor', tier: 2, bonusType: 'craft_speed', bonusValue: 40, module: 'manufacturing', wearDurationMs: 300_000 },
  { id: 'microscope', tier: 2, bonusType: 'lab_direction', bonusValue: 1, module: 'lab', wearDurationMs: 300_000 },
  { id: 'price_chart', tier: 2, bonusType: 'market_info', bonusValue: 2, module: 'auction', wearDurationMs: 300_000 },
  { id: 'lockpick_set', tier: 2, bonusType: 'sabotage', bonusValue: 25, module: 'backroom', wearDurationMs: 300_000 },
  // Tier 3
  { id: 'excavator', tier: 3, bonusType: 'mining_boost', bonusValue: 3, module: 'mine', wearDurationMs: 360_000 },
  { id: 'harvester', tier: 3, bonusType: 'plantation_boost', bonusValue: 3, module: 'plantation', wearDurationMs: 360_000 },
  { id: 'assembly_line', tier: 3, bonusType: 'craft_speed', bonusValue: 55, module: 'manufacturing', wearDurationMs: 360_000 },
  { id: 'spectrometer', tier: 3, bonusType: 'lab_exclusion', bonusValue: 1, module: 'lab', wearDurationMs: 360_000 },
  { id: 'telegraph', tier: 3, bonusType: 'market_info', bonusValue: 3, module: 'auction', wearDurationMs: 360_000 },
  { id: 'vault', tier: 3, bonusType: 'sabotage_defense', bonusValue: 1, module: 'backroom', wearDurationMs: 360_000 },
  { id: 'textbook', tier: 3, bonusType: 'patent_office', bonusValue: 25, module: 'patent_office', wearDurationMs: 360_000 },
  // Tier 4
  { id: 'quantum_drill', tier: 4, bonusType: 'mining_boost', bonusValue: 4, module: 'mine', wearDurationMs: 480_000 },
  { id: 'bioreactor', tier: 4, bonusType: 'plantation_boost', bonusValue: 4, module: 'plantation', wearDurationMs: 480_000 },
  { id: 'nano_forge', tier: 4, bonusType: 'craft_speed', bonusValue: 60, module: 'manufacturing', wearDurationMs: 480_000 },
  { id: 'false_retina', tier: 4, bonusType: 'sabotage', bonusValue: 100, module: 'backroom', wearDurationMs: 480_000 },
  { id: 'android', tier: 4, bonusType: 'patent_office', bonusValue: 25, module: 'patent_office', wearDurationMs: 480_000 },
];
```

---

## Schritt 3: Rezeptgenerierung erweitern (`packages/backend/src/game/initialCalculations.ts`)

### 3a. Produktionsmittel-Rezepte generieren
- Für jedes Item in `PRODUCTION_GOOD_DEFINITIONS` ein Recipe erstellen
- `type: 'production_good'`, Sequenzlänge = `tier + 2`
- Sequenz zufällig aus verfügbaren Ressourcen generieren (gleiche Logik wie Konsumgüter)
- Rezept-ID = Item-ID (z.B. `'pickaxe'`)

### 3b. Markt-Einträge für Produktionsmittel
- Für jedes Produktionsmittel einen MarketEntry in `market.productionGoods` erstellen
- Initial: `supply: 0, price: BASE_PRICE_FOR_TIER, baseConsumptionRate: 0`
- Produktionsmittel haben **keine automatische Markt-Consumption** — sie werden nur von Spielern verbraucht (Verschleiß)
- Basispreise höher als Konsumgüter: z.B. T1: 15, T2: 30, T3: 60, T4: 120

### 3c. `productionGoodDefinitions` in GameState speichern

### 3d. Player-Initialisierung
- Neues Feld `productionGoods: {}` im Player-Objekt bei Erstellung

---

## Schritt 4: Verschleiß-System im Game Loop (`packages/backend/src/game/gameLoop.ts`)

### 4a. Neue Funktion `tickWear()`
Im Economy-Tick (alle 10s) aufrufen:
```
Für jeden Spieler:
  Für jeden Bonus-Typ in player.productionGoods:
    Finde das aktive Item (stärkstes mit wearStartedAt !== null)
    Wenn aktiv:
      wearRemainingMs -= (ECONOMY_TICK_INTERVAL * SUB_TICK_MS)  // 10000ms pro Tick
      Skaliert mit gameSpeed: wearRemainingMs -= (10000 * gameSpeed)

      Wenn wearRemainingMs <= 0:
        Item aus Array entfernen (zerfallen)
        Auto-Aktivierung: Nächstes ungebrauchtes Item gleichen Typs aktivieren
        Wenn kein gleiches vorhanden: Schwächeres Item gleichen Bonus-Typs aktivieren
```

### 4b. Hilfsfunktion `getActiveBonus(player, bonusType): number`
- Durchsucht alle `player.productionGoods`
- Findet das aktive Item mit dem höchsten `bonusValue` für den gegebenen `bonusType`
- Gibt `bonusValue` zurück (oder 0 wenn keins aktiv)

### 4c. Hilfsfunktion `activateProductionGood(player, itemId)`
- Wird aufgerufen wenn ein Spieler ein Produktionsmittel craftet oder kauft
- Prüft ob bereits ein stärkeres Item gleichen Bonus-Typs aktiv ist
- Wenn nicht: Aktiviert das neue Item (setzt `wearStartedAt = Date.now()`, `isUsed = true`)
- Wenn ja: Item bleibt inaktiv im Inventar (Reserve)

### 4d. Auto-Aktivierung bei Zerfall
- Wenn aktives Item zerfällt: Suche nächstes Item gleichen `bonusType` im Inventar
- Priorisierung: Stärkstes verfügbares Item
- Wenn ein Item mit angestautem Verschleiß existiert (war vorher aktiv, wurde von stärkerem verdrängt): Verschleiß läuft weiter wo er war

---

## Schritt 5: Bonus-Anwendung in Handlern

### 5a. Mine — mining_boost (`packages/backend/src/handlers/mineHandler.ts` bzw. `gameLoop.ts`)
Aktuell produziert ein Spieler 1 Rohstoff pro Tick (Base). Änderung:
```
// In der Mining-Logik:
const miningBoost = getActiveBonus(player, 'mining_boost');  // 0, 1, 2, 3, oder 4
const baseProduction = 1 + miningBoost;  // Additiv zum Base

// Dann wie bisher multiplikativ mit Boost (1.5x) und Mining Rights (2.0x/0.5x)
// Ergebnis: Math.floor(baseProduction * boostMultiplier * miningRightsMultiplier)
```

**Wichtig:** Das aktuelle System nutzt Intervalle (kürzeres Intervall = schnellere Produktion). Die +N Rohstoffe sollen **pro Produktion** mehr geben, nicht das Intervall verkürzen. Also bei jeder Rohstoffproduktion statt 1 Resource `baseProduction` Resources auf den Spieler schreiben. Das Ergebnis muss ganzzahlig sein (Math.floor).

### 5b. Manufacturing — craft_speed (`packages/backend/src/handlers/manufacturingHandler.ts`)
```
// Bei Job-Erstellung:
const craftSpeedBonus = getActiveBonus(player, 'craft_speed');  // 0, 25, 40, 55, oder 60

// Produktionsmittel haben eigene Basis-Craftzeiten:
const CRAFTING_DURATION_PRODUCTION_GOOD_MS = { 1: 60_000, 2: 80_000, 3: 100_000, 4: 120_000 };

// Basis-Duration je nach Typ wählen
const baseDuration = recipe.type === 'production_good'
  ? CRAFTING_DURATION_PRODUCTION_GOOD_MS[recipe.tier]
  : CRAFTING_DURATION_MS[recipe.tier];

// Craft-Speed-Bonus anwenden:
const speedReduction = 1 - (craftSpeedBonus / 100);  // z.B. 0.75 bei 25%
const duration = Math.round(baseDuration * speedReduction / Math.max(speed, 0.1));
```

Bei Job-Abschluss: Wenn `recipe.type === 'production_good'`:
- Item zu `player.productionGoods[itemId]` hinzufügen (als neues `ActiveProductionGood`)
- `activateProductionGood()` aufrufen

**Nanoschmiede Spezialeffekt (Tier 4 craft_speed):**
- Wenn `getActiveBonus(player, 'craft_speed') === 60` (Nanoschmiede):
  - Bei Job-Start: Alle Rohstoffe müssen vorhanden sein
  - Aber 1 zufälliger Rohstoff aus der Sequenz wird **nicht abgezogen**
  - Implementierung: Nach der Verfügbarkeitsprüfung, vor dem Abzug, einen zufälligen Index wählen und diesen Rohstoff überspringen

### 5c. Lab — Boni (`packages/backend/src/handlers/labHandler.ts`)

**lab_distinct_count (Notizbuch):**
- Nach Experiment-Berechnung: Wenn Bonus aktiv, `distinctResourceCount` im Result mitsenden
- Wert = Anzahl **einzigartiger** Resource-IDs in der Ziel-Rezept-Sequenz

**lab_direction (Mikroskop):**
- Bei gelben Ergebnissen: Zusätzlich angeben ob der Rohstoff weiter links oder rechts im Zielrezept steht
- `directionHints` Array: Für jede Position `'left'` | `'right'` | `null` (null bei grün/rot)

**lab_exclusion (Spektrometer):**
- Nach Experiment: Liste aller Ressourcen senden, die **nicht** im Zielrezept vorkommen
- `excludedResources` = alle Resource-IDs die nicht in `targetRecipe.sequence` enthalten sind

### 5d. Auction — Produktionsmittel-Handel (`packages/backend/src/handlers/auctionHandler.ts`)

**MARKET_SELL für Produktionsmittel:**
- Spieler kann nur Items verkaufen wo `isUsed === false` (nie aktiviert)
- Item aus `player.productionGoods[itemId]` entfernen
- `market.productionGoods[itemId].supply += 1`
- Preis neu berechnen

**MARKET_BUY für Produktionsmittel:**
- Spieler kauft vom Markt, `supply -= 1`
- Neues `ActiveProductionGood` erstellen, `activateProductionGood()` aufrufen
- Preis neu berechnen

---

## Schritt 6: Testen

Nach der Implementierung einmal `npm run build` im Root ausführen und sicherstellen dass keine TypeScript-Fehler auftreten.

---

## Wichtige Hinweise

- **Kein Frontend in dieser Session** — nur Backend + Shared Types
- Die `getActiveBonus()` Funktion wird zentral gebraucht — am besten in einer eigenen Utility-Datei oder direkt in gameLoop.ts
- Player-Serialisierung (Auto-Save) muss die neuen Felder mit-speichern — prüfen ob das automatisch passiert (JSON.stringify des GameState)
- Bestehende Saves ohne `productionGoods` Feld: Beim Laden Default `{}` setzen (Migration)
