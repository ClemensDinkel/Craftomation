# Session 3 — Produktionsmittel: Edge Cases & Polish

## Voraussetzung
Session 1 (Backend) und Session 2 (Frontend) müssen abgeschlossen sein. Lies `docs/produktionsmittel-plan.md` für die Spezifikation.

## Ziel
Edge Cases absichern, Nanoschmiede-Spezialeffekt validieren, optionale Module-Boni als Stubs vorbereiten, Save/Load-Kompatibilität sicherstellen, und Balancing-Feintuning.

---

## Schritt 1: Auto-Aktivierungs-Logik validieren

### 1a. Szenarien durchspielen und sicherstellen dass sie korrekt funktionieren:

**Szenario A: Spieler craftet Bohrmaschine, hat bereits aktive Spitzhacke**
- Bohrmaschine hat bonusValue 2 > Spitzhacke bonusValue 1
- Bohrmaschine wird aktiviert (neuer Timer startet frisch)
- Spitzhacke wird pausiert (Timer bleibt stehen, angestaut)
- Wenn Bohrmaschine zerfällt → Spitzhacke wird reaktiviert mit altem Timer

**Szenario B: Spieler hat 3x Spitzhacke, aktive zerfällt**
- Nächste unbenutzte Spitzhacke wird aktiviert
- Wenn alle benutzt: Keine Aktivierung, Bonus fällt weg

**Szenario C: Spieler kauft schwächeres Item wenn stärkeres aktiv**
- Schwächeres Item bleibt inaktiv im Inventar (Reserve)
- Timer startet NICHT

**Szenario D: Spieler verkauft unbenutztes Item**
- Nur `isUsed === false` Items sind verkaufbar
- Aktive Items (isUsed = true) können nie verkauft werden
- Pausierte Items (isUsed = true, Timer angestaut) können nie verkauft werden

### 1b. Edge Case: Kein Item gleichen Bonus-Typs vorhanden
- Nach Zerfall: Wenn kein weiteres Item mit gleichem bonusType → Bonus fällt auf 0
- UI muss das korrekt reflektieren

### 1c. Edge Case: Gleichzeitiger Zerfall
- Was passiert wenn in einem Tick mehrere Items zerfallen?
- Sicherstellen dass die Reihenfolge konsistent ist (z.B. alphabetisch nach itemId)

---

## Schritt 2: Nanoschmiede Spezialeffekt verifizieren

### 2a. Logik prüfen
Die Nanoschmiede (Tier 4 craft_speed) hat neben -60% Craftzeit einen Spezialeffekt:
- Bei Craft-Start: **Alle** Rohstoffe der Sequenz müssen im Inventar sein
- Aber 1 **zufälliger** Rohstoff wird nicht abgezogen
- Der gesparte Rohstoff wird zufällig bestimmt (nicht der teuerste oder seltenste)

### 2b. Sicherstellen:
- Verfügbarkeitsprüfung checkt ALLE Rohstoffe (kein Cheat möglich)
- Erst nach der Prüfung wird der zufällige Rohstoff bestimmt
- Wenn ein Rohstoff mehrfach in der Sequenz vorkommt und er als "gespart" gewählt wird, wird nur 1 Instanz gespart
- Frontend zeigt an welcher Rohstoff gespart wurde (optional, nice-to-have)

---

## Schritt 3: Save/Load Kompatibilität

### 3a. Migration alter Saves
Wenn ein Save aus einer Version vor Produktionsmitteln geladen wird:
- `player.productionGoods` fehlt → Default `{}` setzen
- `gameState.productionGoodDefinitions` fehlt → Neu generieren
- `market.productionGoods` fehlt → Neu initialisieren
- Bestehende Rezepte beibehalten, neue Produktionsmittel-Rezepte hinzufügen

### 3b. Prüfen ob Auto-Save die neuen Felder korrekt serialisiert
- `ActiveProductionGood` mit `wearStartedAt` (Timestamp) muss korrekt gespeichert/geladen werden
- Nach Load: Timer muss korrekt weiterlaufen (Differenz seit Save berechnen)
- Oder einfacher: Timer pausiert während das Spiel nicht läuft (kein Catch-up)

### 3c. Test: Save → Quit → Load → Verschleiß-Timer laufen korrekt weiter

---

## Schritt 4: Optionale Module Stubs

### 4a. Backroom-Modul Stubs
- `sabotage` Bonus (Lockpick Set +25%, False Retina = anonym): Als Bonus-Typ registriert, aber Effekt nur relevant wenn Backroom-Modul implementiert wird
- `sabotage_defense` Bonus (Vault): Gleich — registriert aber noch kein Effekt
- Sicherstellen dass die Items craftbar/handelbar sind auch wenn das Modul nicht aktiv ist

### 4b. Patent Office Stubs
- `patent_office` Bonus (Textbook -25% Kosten, Android +25% stärkere Boni): Registriert
- Effekt implementieren wenn Patent Office Modul gebaut wird
- Items craftbar/handelbar unabhängig vom Modul

### 4c. Plantation Stubs
- `plantation_boost` Items (Sickle, Greenhouse, Harvester, Bioreactor)
- Bonus-Typ registriert, Effekt analog zu mining_boost aber für Plantation-Modul
- Wenn Plantation nicht aktiv: Items existieren als Crafting-Ziele aber Bonus wirkt nicht

---

## Schritt 5: Balancing-Prüfung

### 5a. Verschleiß vs. Craftzeit Verhältnis
Prüfe ob die Balance stimmt:
- T1 Spitzhacke: 4min Verschleiß, 60s Craft → Spieler muss alle 4min 60s craften
- T4 Quantenbohrer: 8min Verschleiß, 120s Craft → 120s/8min = 25% der Zeit craften
- Mit craft_speed Bonus: T4 + Nanoschmiede (-60%) = 48s Craft für T4 Items

### 5b. Marktpreis-Balance
- Produktionsmittel-Preise im Verhältnis zu Konsumgüterpreisen prüfen
- Sollen teurer sein aber nicht unerreichbar
- T1: ~15, T2: ~30, T3: ~60, T4: ~120 als Basispreise

### 5c. Mining-Output mit vollen Boni
Maximal-Szenario überprüfen:
- Base(1) + Quantum Drill(+4) = 5
- × Boost(1.5) = 7.5
- × Mining Rights(2.0) = 15
- → 15 Rohstoffe pro 10s — ist das ausbalanciert mit dem Verbrauch?

---

## Schritt 6: UI Polish

### 6a. Verschleiß-Timer Countdown
- Statt nur den Wert aus dem letzten State-Update zu zeigen:
  Optional einen lokalen Countdown implementieren der zwischen Updates interpoliert
- Alternative: Einfach den Wert aus dem State anzeigen (wird alle 2s aktualisiert) — weniger Aufwand, gutes Ergebnis

### 6b. Zerfall-Benachrichtigung
- Wenn ein Produktionsmittel zerfällt: Kurze Toast-Benachrichtigung
- "Deine Spitzhacke ist zerfallen! Nächste wurde aktiviert." (wenn Reserve vorhanden)
- "Deine Bohrmaschine ist zerfallen. Kein Ersatz vorhanden." (wenn keine Reserve)

### 6c. Craft-Completion für Produktionsmittel
- Beim Abschluss eines Produktionsmittel-Crafts: Besondere Anzeige
- "Werkbank hergestellt! Bonus: -25% Craftzeit" (kurzer Info-Toast)

### 6d. Rezeptbuch — Produktionsmittel-Sektion
- Wenn es ein Rezeptbuch/Rezeptliste gibt: Produktionsmittel-Rezepte separat listen
- Mit Bonus-Beschreibung und Modul-Zuordnung

---

## Schritt 7: Build & Vollständiger Test

- `npm run build` im Root
- Manueller Durchlauf:
  1. Neues Spiel starten
  2. Im Lab ein Produktionsmittel-Rezept entdecken
  3. In Manufacturing craften
  4. Prüfen ob Bonus wirkt (Mining-Output steigt)
  5. Warten bis Verschleiß → Item zerfällt
  6. Am Markt ein Produktionsmittel kaufen/verkaufen
  7. Save → Load → Timer korrekt

---

## Wichtige Hinweise
- Diese Session ist flexibel — priorisiere nach Wichtigkeit
- Stubs für optionale Module sind low-priority, können übersprungen werden
- Balancing-Werte können später leicht angepasst werden (sind Konstanten)
- Toast-Benachrichtigungen nur implementieren wenn ein Toast-System bereits existiert
