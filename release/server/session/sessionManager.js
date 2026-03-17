"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionId = generateSessionId;
exports.createSession = createSession;
exports.sessionExists = sessionExists;
const gameState_1 = require("../state/gameState");
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
function generateSessionId() {
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return id;
}
function createSession() {
    const sessionId = generateSessionId();
    gameState_1.gameState.createSession(sessionId);
    console.log(`[Session] Created session: ${sessionId}`);
    return sessionId;
}
function sessionExists(sessionId) {
    return gameState_1.gameState.getSessionId() === sessionId;
}
//# sourceMappingURL=sessionManager.js.map