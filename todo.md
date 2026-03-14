# für mich
- disconnects testen

# für claude
- (keine offenen Aufgaben)

## bugs
- fortschrittbalken in produktion hängt lange bei 100% bevor es weiter geht (läuft sehr schnell durch ?)
- preise springen bei konsumgütern: 2 verkauft, -> preis 90 wenig später (nächster eco tick?) 60, wenn durch verbauch nur noch 1 wieder 120
- wenn produktion in auftrag wo ressoure fehlt und dann autokauf, dann passiert nichts, erst wenn neue produktion angestoßen wird funktioniert autokauf
- verbrauch Marktbericht ? wird im markt als verkaufbar angezeigt, aber lässt sich nicht verkaufen

## balancing
- preise für konsum zu hoch und preisunterschied pro unit im vorrat (30) viel zu stark, verbrauch zu hoch, 
- preise für prodmittel zu niedrig sollten teurer als konsumgüter sein, aber spürbar weniger passiver verbrauch nachfrage also durch spielerverbrauch geregelt
- prodgut verbrauch, was genaue formel ? fühlt sich sehr rapide (zumindest bei spitzhacke) an

## features
- in jedem Modul sollte in Prozentwerten angezeigt werden wie viel Halbbarkeit aktiv genutzte Produktionsmittel noch haben (+ name natürlich)
- auto kauf auch für labor
- verbrauch mit 2 dezimalstellen anzeigen (wenn marktbericht vorhanden)
- debug im auktionshaus, das erlaubt spielervorrat zu manipulieren für schnellere tests

## änderungen
- marktbericht klingt nicht nach herstellbarem produktionsgut
- handelsautomat tickt etwas langsam, wenn er seinen eigenen tick hat (und nicht beim econmy tick mitläuft), dann schneller machen, ansonsten in ruhe lassen

### fragen
- autokauf als t1 / t2 produktionsgut erst ermöglichen ?
- wenn spieler late joinen, wird verbrauchsformel angepasst oder nur anfangs berechnet ?