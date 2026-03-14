import { Router, Request, Response } from 'express';
import { WSMessageType, ModuleType } from '@craftomation/shared';
import { createSession, sessionExists } from '../session/sessionManager';
import { gameState } from '../state/gameState';
import { loadLatestSave } from '../state/autoSave';
import { startAutoSave } from '../state/autoSave';
import { runInitialCalculations } from '../game/initialCalculations';
import { broadcast } from '../websocket/wsServer';
import { startGameLoop } from '../game/gameLoop';
import { handleAddPlayer } from '../handlers/mineHandler';

const router = Router();

// GET /api/session/active — check if a game is currently running
router.get('/active', (_req: Request, res: Response) => {
  if (gameState.hasSession() && gameState.isGameStarted()) {
    res.json({ active: true, sessionId: gameState.getSessionId() });
  } else {
    res.json({ active: false });
  }
});

// POST /api/session/create
router.post('/create', (_req: Request, res: Response) => {
  const sessionId = createSession();
  res.json({ sessionId });
});

// POST /api/session/join
router.post('/join', (req: Request, res: Response) => {
  const { sessionId, moduleType, deviceId } = req.body;

  if (!sessionId || !sessionExists(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const clientKey = deviceId || `device_${Date.now()}`;

  if (moduleType) {
    gameState.setClientModule(clientKey, moduleType);

    // Late-join: if game is running and this module isn't active yet, activate it
    if (gameState.isGameStarted()) {
      const config = gameState.getConfig();
      if (config && !config.activeModules.includes(moduleType)) {
        const updatedModules = [...config.activeModules, moduleType];
        gameState.updateConfig({ activeModules: updatedModules });
        console.log(`[Join] Late-join activated module: ${moduleType}, activeModules now: ${JSON.stringify(updatedModules)}`);
      }
    }
  }

  console.log(`[Join] clientKey=${clientKey} module=${moduleType ?? '(none)'} allModules=${JSON.stringify(gameState.getAssignedModulesWithClients())}`);

  const config = gameState.getConfig();
  const existingModule = gameState.getClientModule(clientKey);
  res.json({
    config,
    gameStarted: gameState.isGameStarted(),
    assignedModule: existingModule ?? null,
  });
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

// POST /api/session/players
router.post('/players', (req: Request, res: Response) => {
  const { sessionId, playerName } = req.body;

  if (!sessionId || !sessionExists(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!playerName?.trim()) {
    res.status(400).json({ error: 'Player name required' });
    return;
  }

  handleAddPlayer({ playerName: playerName.trim() });

  const players = gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
  res.json({ players });
});

// DELETE /api/session/players
router.delete('/players', (req: Request, res: Response) => {
  const { sessionId, playerId } = req.body;

  if (!sessionId || !sessionExists(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  gameState.removePlayer(playerId);
  const players = gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
  res.json({ players });
});

// GET /api/session/:id/players
router.get<{ id: string }>('/:id/players', (req, res) => {
  const { id } = req.params;

  if (!sessionExists(id)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const players = gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
  res.json({ players });
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

  // Derive playerCount from registered players
  const playerCount = Math.max(1, gameState.getAllPlayers().length);
  gameState.updateConfig({ playerCount });

  // Derive activeModules from all assigned client modules
  const REQUIRED_MODULES: ModuleType[] = ['mine', 'manufacturing', 'lab', 'auction'];
  const assignedModules = gameState.getAssignedModules();
  const activeModules = [...new Set([...REQUIRED_MODULES, ...assignedModules])];
  gameState.updateConfig({ activeModules });
  console.log(`[Session] Active modules: ${JSON.stringify(activeModules)}`);

  // Run initial calculations
  const currentConfig = gameState.getConfig()!;
  runInitialCalculations(currentConfig);

  // Start game
  gameState.startGame();
  startAutoSave();
  startGameLoop();

  // Broadcast to all clients
  broadcast({
    type: WSMessageType.SESSION_STARTED,
    payload: gameState.toJSON(),
  });

  console.log(`[Session] Game started for session: ${sessionId}`);
  res.json({ success: true, state: gameState.toJSON() });
});

// GET /api/session/:id/modules
router.get<{ id: string }>('/:id/modules', (req, res) => {
  const { id } = req.params;

  if (!sessionExists(id)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const modules = gameState.getAssignedModules();
  const clients = gameState.getAssignedModulesWithClients();
  console.log(`[Modules] session=${id} modules=${JSON.stringify(modules)} clients=${JSON.stringify(clients)}`);
  res.json({ modules, clients });
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
