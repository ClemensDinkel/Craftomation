# Session 2 — Produktionsmittel: Frontend & UI

## Voraussetzung
Session 1 muss abgeschlossen sein (Backend-Kern implementiert). Lies `docs/produktionsmittel-plan.md` für die Spezifikation.

## Ziel
Produktionsmittel im Frontend sichtbar und nutzbar machen: Inventar-Anzeige, Verschleiß-Timer, Bonus-Indikatoren in allen Modulen, Markt-Integration, Lab-Bonus-Anzeige.

---

## Schritt 1: i18n — Alle Produktionsmittel-Namen (`packages/frontend/src/i18n/de.ts` + `en.ts`)

Beide Sprachdateien um alle Produktionsmittel ergänzen. Muster: `'item.<id>': '<Name>'`

**Deutsch:**
```
pickaxe: Spitzhacke, sickle: Sichel, workbench: Werkbank, notebook: Notizbuch, market_report: Marktbericht,
drill: Bohrmaschine, greenhouse: Gewächshaus, conveyor: Förderband, microscope: Mikroskop, price_chart: Preistabelle, lockpick_set: Dietrich-Set,
excavator: Bagger, harvester: Erntemaschine, assembly_line: Fließband, spectrometer: Spektrometer, telegraph: Telegraf, vault: Tresor, textbook: Lehrbuch,
quantum_drill: Quantenbohrer, bioreactor: Bioreaktor, nano_forge: Nanoschmiede, false_retina: Falsche Retina, android: Androide
```

**Englisch:**
```
pickaxe: Pickaxe, sickle: Sickle, workbench: Workbench, notebook: Notebook, market_report: Market Report,
drill: Drill, greenhouse: Greenhouse, conveyor: Conveyor Belt, microscope: Microscope, price_chart: Price Chart, lockpick_set: Lockpick Set,
excavator: Excavator, harvester: Harvester, assembly_line: Assembly Line, spectrometer: Spectrometer, telegraph: Telegraph, vault: Vault, textbook: Textbook,
quantum_drill: Quantum Drill, bioreactor: Bioreactor, nano_forge: Nano Forge, false_retina: False Retina, android: Android
```

Zusätzliche UI-Strings:
```
'productionGood.active': 'Aktiv' / 'Active'
'productionGood.inactive': 'Reserve' / 'Reserve'
'productionGood.worn': 'Verschleiß' / 'Wear'
'productionGood.unused': 'Unbenutzt' / 'Unused'
'productionGood.notTradeable': 'Nicht handelbar (benutzt)' / 'Not tradeable (used)'
'productionGood.wearTimer': 'Verbleibend' / 'Remaining'
'productionGood.bonus': 'Bonus' / 'Bonus'
'auction.tabProductionGoods': 'Produktionsmittel' / 'Production Goods'
```

---

## Schritt 2: Inventar-/Bonus-Anzeige Komponente

### 2a. Neue Komponente: `ProductionGoodBadge` (`packages/frontend/src/components/ui/ProductionGoodBadge.tsx`)
Kleine Badge-Komponente die ein aktives Produktionsmittel anzeigt:
- Item-Name (aus i18n)
- Bonus-Text (z.B. "+2 Mining", "-40% Craft Speed")
- Verschleiß-Balken (Progress Bar, grün → gelb → rot)
- Verbleibende Zeit als Text (z.B. "2:34")
- Status-Indikator: Aktiv (grün) / Reserve (grau)

### 2b. Bonus-Text-Formatierung
Helper-Funktion `formatBonusText(bonusType, bonusValue)`:
- `mining_boost`: `+${value} Mining`
- `plantation_boost`: `+${value} Plantage`
- `craft_speed`: `-${value}% Craft`
- `lab_distinct_count`: `Lab: Distinct Count`
- `lab_direction`: `Lab: Direction Hints`
- `lab_exclusion`: `Lab: Exclusions`
- `market_info`: `Market Info Lv.${value}`

---

## Schritt 3: Mine-Modul Anpassungen (`packages/frontend/src/components/modules/MineModule.tsx`)

### 3a. Mining-Bonus Anzeige pro Spieler
- Neben der Rohstoffanzeige: Aktuellen Mining-Bonus anzeigen
- Z.B. Spieler hat Bohrmaschine aktiv → "+2" Badge neben dem Spielernamen
- Verschleiß-Timer als kleine Fortschrittsanzeige

### 3b. Produktionsrate-Anzeige
- Aktuell zeigt die Mine nur aktiv/inaktiv und gewählten Rohstoff
- Erweitern: Geschätzte Produktion pro Tick anzeigen (Base + Bonus × Multiplikatoren)

---

## Schritt 4: Manufacturing-Modul Anpassungen (`packages/frontend/src/components/modules/ManufacturingModule.tsx`)

### 4a. Craft-Speed-Bonus Anzeige
- Wenn Spieler craft_speed Bonus hat: Badge anzeigen (z.B. "-40% Werkbank")
- Fertigungszeiten in der Queue mit Bonus berechnet anzeigen (nicht die Basiszeit)

### 4b. Produktionsmittel craftbar machen
- Rezeptliste muss `production_good` Rezepte anzeigen
- Visuell von Konsumgütern unterscheiden (z.B. andere Farbe/Icon, Zahnrad-Symbol)
- Bei Job-Erstellung: Rezepttyp mitsenden

---

## Schritt 5: Lab-Modul Anpassungen (`packages/frontend/src/components/modules/LabModule.tsx`)

### 5a. Notizbuch-Bonus (lab_distinct_count)
- Wenn `labResult.distinctResourceCount` vorhanden: Anzeigen als Info-Text
- Z.B. "Dieses Rezept enthält 4 verschiedene Rohstoffe"

### 5b. Mikroskop-Bonus (lab_direction)
- Wenn `labResult.directionHints` vorhanden: Bei gelben Feldern Pfeil anzeigen
- ← wenn Rohstoff weiter links gehört, → wenn weiter rechts

### 5c. Spektrometer-Bonus (lab_exclusion)
- Wenn `labResult.excludedResources` vorhanden: Liste der ausgeschlossenen Rohstoffe anzeigen
- Z.B. "Nicht im Rezept: Kupfer, Zinn, Quarz"

---

## Schritt 6: Auction-Modul Anpassungen (`packages/frontend/src/components/modules/AuctionModule.tsx`)

### 6a. Neuer Tab: Produktionsmittel
- Eigener Tab neben Rohstoffe/Konsumgüter
- Zeigt alle Produktionsmittel mit aktuellem Preis und Vorrat
- Kauf-Button (normal wie bei anderen Items)

### 6b. Verkauf von Produktionsmitteln
- Spieler können nur **unbenutzte** Items verkaufen
- Im Verkaufs-Dialog: Nur unbenutzte Items anzeigen
- Benutzte Items ausgegraut mit Hinweis "Nicht handelbar (benutzt)"

### 6c. Marktbericht-Bonus (market_info Level 1)
- Wenn Spieler Market Report hat: Verbrauchsraten neben jedem Item anzeigen
- Kleine Zahl oder Balken der den Konsum pro Tick visualisiert

### 6d. Preistabelle-Bonus (market_info Level 2)
- Trend-Pfeile (↑/↓/→) neben Preisen basierend auf Preisänderung der letzten Ticks
- Backend muss dafür Preis-Historie tracken (oder Frontend berechnet aus empfangenen Updates)

### 6e. Telegraf-Bonus (market_info Level 3)
- Limit-Order UI: Spieler kann auto-buy/auto-sell bei Preis X setzen
- Dies ist ein größeres Feature — als Stub implementieren wenn zu komplex
- Mindestens: Platzhalter-UI mit "Coming soon" oder einfache Variante

---

## Schritt 7: Spieler-Inventar Übersicht

### 7a. Produktionsmittel im Spieler-Panel
- In der Spielerübersicht: Sektion für aktive Produktionsmittel
- Gruppiert nach Bonus-Typ
- Aktives Item hervorgehoben, Reserve-Items darunter
- Verschleiß-Timer gut sichtbar

---

## Schritt 8: Build & Smoke Test

- `npm run build` im Root ausführen
- Frontend starten und prüfen ob alle Module korrekt rendern
- Keine TypeScript-Fehler

---

## Wichtige Hinweise
- Alle Bonus-Informationen kommen aus dem GameState (Backend berechnet, Frontend zeigt nur an)
- Verschleiß-Timer: Frontend zeigt den Wert aus dem letzten State-Update, kein lokaler Countdown nötig (wird alle 2s aktualisiert)
- Mobile-first: Badges und Timer müssen auf kleinen Screens gut lesbar sein
- Tailwind-only, keine Inline-Styles außer für dynamische Farben
