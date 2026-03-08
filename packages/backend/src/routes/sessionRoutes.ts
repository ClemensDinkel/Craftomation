import { Router, Request, Response } from 'express';
import { WSMessageType } from '@craftomation/shared';
import { createSession, sessionExists } from '../session/sessionManager';
import { gameState } from '../state/gameState';
import { loadLatestSave } from '../state/autoSave';
import { startAutoSave } from '../state/autoSave';
import { runInitialCalculations } from '../game/initialCalculations';
import { broadcast } from '../websocket/wsServer';

const router = Router();

// POST /api/session/create
router.post('/create', (_req: Request, res: Response) => {
  const sessionId = createSession();
  res.json({ sessionId });
});

// POST /api/session/join
router.post('/join', (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId || !sessionExists(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const config = gameState.getConfig();
  res.json({ config });
});

// POST /api/session/load
router.post('/load', (_req: Request, res: Response) => {
  const snapshot = loadLatestSave();

  if (!snapshot) {
    res.status(404).json({ error: 'No save found' });
    return;
  }

  gameState.loadFromSnapshot(snapshot);
  res.json({ sessionId: snapshot.session.sessionId });
});

// POST /api/session/start
router.post('/start', (req: Request, res: Response) => {
  const { sessionId, config } = req.body;

  if (!sessionId || !sessionExists(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (gameState.isGameStarted()) {
    res.status(400).json({ error: 'Game already started' });
    return;
  }

  // Apply config updates from setup screen
  if (config) {
    gameState.updateConfig(config);
  }

  // Run initial calculations
  const currentConfig = gameState.getConfig()!;
  runInitialCalculations(currentConfig);

  // Start game
  gameState.startGame();
  startAutoSave();

  // Broadcast to all clients
  broadcast({
    type: WSMessageType.SESSION_STARTED,
    payload: gameState.toJSON(),
  });

  console.log(`[Session] Game started for session: ${sessionId}`);
  res.json({ success: true, state: gameState.toJSON() });
});

// GET /api/session/:id/status
router.get<{ id: string }>('/:id/status', (req, res) => {
  const { id } = req.params;
  const exists = sessionExists(id);

  res.json({
    exists,
    started: exists ? gameState.isGameStarted() : false,
  });
});

export default router;
