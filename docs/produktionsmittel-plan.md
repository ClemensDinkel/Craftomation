# Produktionsmittel-Plan

## Grundregeln

- Produktionsmittel geben dem Spieler **passive Boni**, solange sie aktiv sind
- Sie unterliegen **Verschleiß** (Timer-basiert) und müssen nachproduziert werden
- **Kein Lagerplatz-Limit** — Spieler können unbegrenzt Rohstoffe/Items halten
- **Nur 1 aktiv:** Ein Spieler kann mehrere gleiche Produktionsmittel besitzen, aber nur 1 ist gleichzeitig aktiv. Verschleiß betrifft nur das aktive Item
- **Auto-Aktivierung:** Wenn ein Produktionsmittel zerfällt, wird automatisch das nächste gleiche aus dem Inventar aktiviert. Ebenso wird ein neu erworbenes Item automatisch aktiviert, wenn kein gleiches bereits aktiv ist
- **Handel:** Nur **unbenutzte** Produktionsmittel (Verschleiß-Timer nicht gestartet) können verkauft werden. Sobald ein Item aktiviert wurde, ist es nicht mehr handelbar
- **Craftzeiten:** Tier 1: 60s, Tier 2: 80s, Tier 3: 100s, Tier 4: 120s (÷ gameSpeed)
- **Sequenzlänge:** Tier + 2 Rohstoffe (wie bei Konsumgütern)
- **Gestaffelte Boni:** Wenn ein Spieler mehrere Produktionsmittel mit gleichem Bonus-Typ besitzt (z.B. Spitzhacke +1 und Bohrmaschine +2), ist immer nur das **stärkste** aktiv. Beim Wechsel (z.B. stärkeres Item wird gecraftet/gekauft) darf angestauter Verschleiß des schwächeren Items **nicht** auf das stärkere übertragen werden — der Verschleiß-Timer des neuen Items startet frisch. Der angestaute Verschleiß des schwächeren Items bleibt jedoch erhalten und läuft weiter, sobald es wieder das stärkste aktive Item ist (z.B. wenn das stärkere zerfällt)

## Unterschied zu Konsumgütern

| Aspekt | Konsumgüter | Produktionsmittel |
|---|---|---|
| **Zweck** | Verkauf am Markt für Geld | Passive Boni für den Spieler |
| **Verbrauch** | Markt konsumiert automatisch | Verschleiß-Timer (zerfällt) |
| **Nachfrage** | Extern (Markt-Simulation) | Intern (Spieler braucht sie selbst) |
| **Craftzeit** | 30–60s | 60–120s (doppelt so lang) |
| **Strategie** | "Was bringt am meisten Geld?" | "Welchen Bonus brauche ich jetzt?" |

---

## Tier 1 — Einfache Werkzeuge ✅

| ID | Name (DE) | Name (EN) | Effekt | Modul | Bonus-Typ |
|---|---|---|---|---|---|
| `pickaxe` | Spitzhacke | Pickaxe | +1 Rohstoff pro Tick in der Mine | Mine | mining_boost |
| `sickle` | Sichel | Sickle | +1 Rohstoff pro Tick in der Plantage | Plantation | plantation_boost |
| `workbench` | Werkbank | Workbench | -25% Fertigungszeit für alle Jobs | Manufacturing | craft_speed |
| `notebook` | Notizbuch | Notebook | Zeigt nach einem Experiment die Anzahl **unterschiedlicher** Rohstoffe im Rezept | Lab | lab_distinct_count |
| `market_report` | Marktbericht | Market Report | Zeigt aktuelle Verbrauchsraten pro Item im Markt | Auction | market_info |

**Design:** Direkte, einfache Boni. Jeder Spieler will mindestens eine Spitzhacke/Sichel → erzeugt Grundnachfrage. Werkbank ist universell nützlich. Notizbuch und Marktbericht sind rein informativ aber strategisch wertvoll.

---

## Tier 2 — Maschinen

| ID | Name (DE) | Name (EN) | Effekt | Modul | Bonus-Typ |
|---|---|---|---|---|---|
| `drill` | Bohrmaschine | Drill | +2 Rohstoff pro Tick (ersetzt Spitzhacke) | Mine | mining_boost |
| `greenhouse` | Gewächshaus | Greenhouse | +2 Rohstoff pro Tick (ersetzt Sichel) | Plantation | plantation_boost |
| `conveyor` | Förderband | Conveyor Belt | -40% Fertigungszeit für alle Jobs | Manufacturing | craft_speed |
| `microscope` | Mikroskop | Microscope | Gelbe Hinweise im Labor zeigen Richtung (zu weit links/rechts) | Lab | lab_direction |
| `price_chart` | Preistabelle | Price Chart | Zeigt Preistrend per Item (Pfeil hoch/runter basierend auf letzten Ticks) | Auction | market_info |
| `lockpick_set` | Dietrich-Set | Lockpick Set | Sabotage-Erfolgsrate +25% | Backroom | sabotage |

**Design:** Spürbare Effizienzsteigerung. Förderband ist universell wertvoll → hohe Nachfrage. Spieler beginnen sich zu spezialisieren.

**Status:** Drill, Greenhouse, Conveyor, Microscope, Price Chart, Lockpick Set sind finalisiert.

---

## Tier 3 — Fortgeschrittene Technologie

| ID | Name (DE) | Name (EN) | Effekt | Modul | Bonus-Typ |
|---|---|---|---|---|---|
| `excavator` | Bagger | Excavator | +3 Rohstoff pro Tick | Mine | mining_boost |
| `harvester` | Erntemaschine | Harvester | +3 Rohstoff pro Tick (ersetzt Gewächshaus) | Plantation | plantation_boost |
| `assembly_line` | Fließband | Assembly Line | -55% Fertigungszeit für alle Jobs | Manufacturing | craft_speed |
| `spectrometer` | Spektrometer | Spectrometer | Zeigt nach einem Experiment an, welche Rohstoffe im Rezept NICHT vorkommen | Lab | lab_exclusion |
| `telegraph` | Telegraf | Telegraph | Kann Limit-Orders setzen (auto-kaufen/verkaufen bei Preis X) | Auction | market_info |
| `vault` | Tresor | Vault | Blockt 1 Sabotage-Aktion pro 5 Minuten | Backroom | sabotage_defense |
| `textbook` | Lehrbuch | Textbook | -25% Kosten für Patente im Patentamt | Patent Office | patent_office |

**Design:** Qualitative Gameplay-Veränderungen. Fließband = starker Fertigungsboost. Tresor als Gegenmaßnahme zu Backroom.

**Status:** Excavator, Harvester, Assembly Line, Spectrometer, Telegraph, Textbook sind finalisiert. Vault vorläufig (abhängig von Backroom-Design).

---

## Tier 4 — Hightech ✅

| ID | Name (DE) | Name (EN) | Effekt | Modul | Bonus-Typ |
|---|---|---|---|---|---|
| `quantum_drill` | Quantenbohrer | Quantum Drill | +4 Rohstoff pro Tick | Mine | mining_boost |
| `bioreactor` | Bioreaktor | Bioreactor | +4 Rohstoff pro Tick (ersetzt Erntemaschine) | Plantation | plantation_boost |
| `nano_forge` | Nanoschmiede | Nano Forge | -60% Craftzeit + 1 zufälliger Rohstoff wird pro Craft nicht verbraucht (alle müssen vorhanden sein, aber einer wird zufällig nicht abgezogen) | Manufacturing | craft_speed |
| `false_retina` | Falsche Retina | False Retina | Sabotage-Aktionen sind anonym | Backroom | sabotage |
| `android` | Androide | Android | Patente geben +25% stärkere Boni | Patent Office | patent_office |

**Design:** Stark aber nicht spielbrechend. Teuer herzustellen, langer Craft. Kein Tier-4-Item für Lab oder Auction — Tier 3 ist dort bereits ausreichend stark.

**Status:** Quantum Drill, Bioreactor, Nano Forge, False Retina, Android sind finalisiert.

---

## Verschleiß-System (noch zu implementieren)

- Jedes aktive Produktionsmittel hat einen **Verschleiß-Timer**
- Timer läuft nur solange das Item **aktiv genutzt** wird
- Verschleiß-Zeiten:
  - Tier 1: 4 Minuten
  - Tier 2: 5 Minuten
  - Tier 3: 6 Minuten
  - Tier 4: 8 Minuten
- Nach Ablauf: Item wird aus Inventar entfernt, nächstes gleiches Item wird aktiv
- Timer skaliert mit `gameSpeed`

---

## Markt-Verbrauchsrate (aktualisiert)

Die Consumption Rate wurde angepasst um mit dem steigenden Produktionspotenzial durch Produktionsmittel mitzuhalten.

**Formel (Rohstoffe):**
```
consumption = (playerCount / resourceTypeCount) × 1.2 × consumptionRate × (1 + tick × 0.01)
```

**Senken im Überblick:**
- **Markt-Consumption:** Automatischer NPC-Verbrauch (obige Formel)
- **Crafting:** Spieler verbrauchen Rohstoffe zum Herstellen von Gütern (steigt mit Tiers und Craftspeed-Boni)
- **Lab:** Spieler verbrauchen Rohstoffe beim Experimentieren (nicht alle Spieler experimentieren — viele kaufen Rezepte)
- **Verschleiß-Nachproduktion:** Spieler müssen Produktionsmittel ständig ersetzen

**Richtwerte (6 Spieler, 6 Rohstoffe, pro Rohstofftyp pro 10s-Tick):**

| Minute | Tick | Consumption | Produktion | Crafting-Senke | Balance |
|---|---|---|---|---|---|
| 0 | 0 | 1.2 | ~1 | ~0 | knapp |
| 15 | 90 | 2.28 | ~3 | ~1 | ausgeglichen |
| 30 | 180 | 3.36 | ~5 | ~3 | knapp |
| 45 | 270 | 4.44 | ~7 | ~5 | eng |
| 60 | 360 | 5.52 | ~10 | ~7 | eng |

---

## Offene Entscheidungen

- [x] ~~Können Produktionsmittel am Markt gehandelt werden?~~ → Ja, aber nur **unbenutzte** Items (Verschleiß-Timer nicht gestartet)
- [x] ~~Sollen Produktionsmittel im Labor entdeckbar sein oder von Anfang an bekannt?~~ → Werden wie Konsumgüter über das Labor per Rezept freigeschaltet
- [x] ~~Wie interagieren Mine-Boni mit dem bestehenden Boost/Mining-Rights-System?~~ → Alle Boni sind multiplikativ. Beispiel: Base(1) + Quantum Drill(+4) = 5, × Boost(1.5) × Mining Rights(2.0) = **15 Rohstoffe pro 10s**
- [x] ~~Tier 3 & Tier 4 im Detail durchgehen~~ → Erledigt
- [x] ~~Verschleiß-Zeiten finalisieren~~ → 4/5/6/8 Minuten (Tier 1-4)
- [ ] Items für noch nicht definierte Module: Stockmarket, Backroom, Warehouse, Influencer, Patent Office — werden definiert wenn die jeweiligen Module designt sind
