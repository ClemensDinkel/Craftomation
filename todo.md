# für mich
- disconnects testen

# für claude

## bugs
- Debug in der Auktionshalle taucht in prod auf!

## balancing

## features

## Prompt 10 — Fehlende Teile

### Phase 1: Toast-Notification-System (Basis fuer Phase 3)
- [ ] **1A** Toast Context + Hook — Neue Datei: `packages/frontend/src/context/ToastContext.tsx`
  - Toast Interface: `{ id, type: 'success'|'error'|'warning'|'info', message }`
  - ToastProvider mit addToast/removeToast, useToast() Hook, Auto-dismiss 4s
- [ ] **1B** Toast UI-Komponente — Neue Datei: `packages/frontend/src/components/ui/Toast.tsx`
  - ToastContainer: fixed bottom-4, z-50, Farbvarianten, X-Button, Dark-Theme
- [ ] **1C** Toast in App einbinden — Modify: `App.tsx` mit `<ToastProvider>`

### Phase 2: Auto-Save Max 5 + LoadGameView
- [ ] **2A** Backend: Saves begrenzen — Modify: `autoSave.ts`
  - pruneOldSaves() nach saveSnapshot(), max 5 Saves
  - listSaves() gibt SaveMeta[] zurueck (filename, sessionId, timestamp, playerCount, gameSpeed)
- [ ] **2B** Backend: REST-Endpoint — Modify: `sessionRoutes.ts`
  - GET /api/session/saves → Metadata
  - POST /api/session/load erweitern: optionaler filename Parameter
- [ ] **2C** Frontend: LoadGameView — Neue Datei: `packages/frontend/src/views/LoadGameView.tsx`
  - Scrollbare Card-Liste mit Save-Auswahl, Zurueck-Button, Empty-State
- [ ] **2D** Navigation verdrahten
  - GameContext.tsx: 'loadGame' zu View-Union
  - App.tsx: LoadGameView-Route
  - HostMenu.tsx: "Spiel laden" navigiert zu loadGame View
- [ ] **2E** i18n Keys fuer de.ts + en.ts

### Phase 3: Server-Fehler via Toasts
- [ ] Modify: `useWebSocket.ts`
  - handleMessage bekommt onError Callback
  - WSMessageType.ERROR → addToast('error', payload) statt console.error
  - addToast-Ref analog zu dispatchRef-Pattern

### Phase 4: Responsive Tablet-Polish
- [ ] Setup.tsx: md:grid md:grid-cols-2, Connected Devices md:col-span-2
- [ ] Module-Dateien: Spieler-Listen md:grid md:grid-cols-2
- [ ] GameShell.tsx: md:px-6, optional md:max-w-3xl md:mx-auto

### Phase 5: README.md
- [ ] Quickstart, Tech Stack, LAN-Setup, Client-Verbindung, Projektstruktur

### Reihenfolge
Phase 1 (Toast) → Phase 3 (Error via Toast) | Phase 2, 4, 5 unabhaengig

## änderungen
- marktbericht klingt nicht nach herstellbarem produktionsgut

### fragen

### Kommentare
- Momentan muss port 3001 freigegeben werden, damit sich geräte verbinden können
- `netsh advfirewall firewall add rule name="Craftomation" dir=in action=allow protocol=TCP localport=3001`
- elegantere Lösung finden