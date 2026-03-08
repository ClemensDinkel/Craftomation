import { Router, Request, Response } from 'express';
import { createSession, sessionExists } from '../session/sessionManager';
import { gameState } from '../state/gameState';
import { loadLatestSave } from '../state/autoSave';

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
