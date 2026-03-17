"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const os_1 = __importDefault(require("os"));
const shared_1 = require("@craftomation/shared");
const sessionManager_1 = require("../session/sessionManager");
const gameState_1 = require("../state/gameState");
const autoSave_1 = require("../state/autoSave");
const autoSave_2 = require("../state/autoSave");
const initialCalculations_1 = require("../game/initialCalculations");
const wsServer_1 = require("../websocket/wsServer");
const gameLoop_1 = require("../game/gameLoop");
const mineHandler_1 = require("../handlers/mineHandler");
const router = (0, express_1.Router)();
// GET /api/session/server-info — return the server's local IP addresses and port
router.get('/server-info', (req, res) => {
    const interfaces = os_1.default.networkInterfaces();
    const addresses = [];
    for (const iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (const info of iface) {
            if (info.family === 'IPv4' && !info.internal) {
                addresses.push(info.address);
            }
        }
    }
    // Use the port the server is actually listening on
    const port = (req.socket.localPort) || parseInt(process.env.PORT || '3001', 10);
    res.json({ addresses, port });
});
// GET /api/session/active — check if a game is currently running
router.get('/active', (_req, res) => {
    if (gameState_1.gameState.hasSession() && gameState_1.gameState.isGameStarted()) {
        res.json({ active: true, sessionId: gameState_1.gameState.getSessionId() });
    }
    else {
        res.json({ active: false });
    }
});
// POST /api/session/create
router.post('/create', (_req, res) => {
    const sessionId = (0, sessionManager_1.createSession)();
    res.json({ sessionId });
});
// POST /api/session/join
router.post('/join', (req, res) => {
    const { sessionId, moduleType, deviceId } = req.body;
    if (!sessionId || !(0, sessionManager_1.sessionExists)(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const clientKey = deviceId || `device_${Date.now()}`;
    if (moduleType) {
        gameState_1.gameState.setClientModule(clientKey, moduleType);
        // Late-join: if game is running and this module isn't active yet, activate it
        if (gameState_1.gameState.isGameStarted()) {
            const config = gameState_1.gameState.getConfig();
            if (config && !config.activeModules.includes(moduleType)) {
                const updatedModules = [...config.activeModules, moduleType];
                gameState_1.gameState.updateConfig({ activeModules: updatedModules });
                console.log(`[Join] Late-join activated module: ${moduleType}, activeModules now: ${JSON.stringify(updatedModules)}`);
            }
        }
    }
    console.log(`[Join] clientKey=${clientKey} module=${moduleType ?? '(none)'} allModules=${JSON.stringify(gameState_1.gameState.getAssignedModulesWithClients())}`);
    const config = gameState_1.gameState.getConfig();
    const existingModule = gameState_1.gameState.getClientModule(clientKey);
    res.json({
        config,
        gameStarted: gameState_1.gameState.isGameStarted(),
        assignedModule: existingModule ?? null,
    });
});
// POST /api/session/load
router.post('/load', (_req, res) => {
    const snapshot = (0, autoSave_1.loadLatestSave)();
    if (!snapshot) {
        res.status(404).json({ error: 'No save found' });
        return;
    }
    gameState_1.gameState.loadFromSnapshot(snapshot);
    res.json({ sessionId: snapshot.session.sessionId });
});
// POST /api/session/players
router.post('/players', (req, res) => {
    const { sessionId, playerName } = req.body;
    if (!sessionId || !(0, sessionManager_1.sessionExists)(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    if (!playerName?.trim()) {
        res.status(400).json({ error: 'Player name required' });
        return;
    }
    (0, mineHandler_1.handleAddPlayer)({ playerName: playerName.trim() });
    const players = gameState_1.gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
    res.json({ players });
});
// DELETE /api/session/players
router.delete('/players', (req, res) => {
    const { sessionId, playerId } = req.body;
    if (!sessionId || !(0, sessionManager_1.sessionExists)(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    gameState_1.gameState.removePlayer(playerId);
    const players = gameState_1.gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
    res.json({ players });
});
// GET /api/session/:id/players
router.get('/:id/players', (req, res) => {
    const { id } = req.params;
    if (!(0, sessionManager_1.sessionExists)(id)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const players = gameState_1.gameState.getAllPlayers().map(p => ({ id: p.id, name: p.name }));
    res.json({ players });
});
// POST /api/session/start
router.post('/start', (req, res) => {
    const { sessionId, config } = req.body;
    if (!sessionId || !(0, sessionManager_1.sessionExists)(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    if (gameState_1.gameState.isGameStarted()) {
        res.status(400).json({ error: 'Game already started' });
        return;
    }
    // Apply config updates from setup screen
    if (config) {
        gameState_1.gameState.updateConfig(config);
    }
    // Derive playerCount from registered players
    const playerCount = Math.max(1, gameState_1.gameState.getAllPlayers().length);
    gameState_1.gameState.updateConfig({ playerCount });
    // Derive activeModules from all assigned client modules
    const REQUIRED_MODULES = ['mine', 'manufacturing', 'lab', 'auction'];
    const assignedModules = gameState_1.gameState.getAssignedModules();
    const activeModules = [...new Set([...REQUIRED_MODULES, ...assignedModules])];
    gameState_1.gameState.updateConfig({ activeModules });
    console.log(`[Session] Active modules: ${JSON.stringify(activeModules)}`);
    // Run initial calculations
    const currentConfig = gameState_1.gameState.getConfig();
    (0, initialCalculations_1.runInitialCalculations)(currentConfig);
    // Start game
    gameState_1.gameState.startGame();
    (0, autoSave_2.startAutoSave)();
    (0, gameLoop_1.startGameLoop)();
    // Broadcast to all clients
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.SESSION_STARTED,
        payload: gameState_1.gameState.toJSON(),
    });
    console.log(`[Session] Game started for session: ${sessionId}`);
    res.json({ success: true, state: gameState_1.gameState.toJSON() });
});
// GET /api/session/:id/modules
router.get('/:id/modules', (req, res) => {
    const { id } = req.params;
    if (!(0, sessionManager_1.sessionExists)(id)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const modules = gameState_1.gameState.getAssignedModules();
    const clients = gameState_1.gameState.getAssignedModulesWithClients();
    console.log(`[Modules] session=${id} modules=${JSON.stringify(modules)} clients=${JSON.stringify(clients)}`);
    res.json({ modules, clients });
});
// GET /api/session/:id/status
router.get('/:id/status', (req, res) => {
    const { id } = req.params;
    const exists = (0, sessionManager_1.sessionExists)(id);
    res.json({
        exists,
        started: exists ? gameState_1.gameState.isGameStarted() : false,
    });
});
exports.default = router;
//# sourceMappingURL=sessionRoutes.js.map