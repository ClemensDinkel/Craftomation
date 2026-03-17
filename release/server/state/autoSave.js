"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutoSave = startAutoSave;
exports.stopAutoSave = stopAutoSave;
exports.loadLatestSave = loadLatestSave;
exports.loadSaveBySessionId = loadSaveBySessionId;
exports.listSaves = listSaves;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gameState_1 = require("./gameState");
const SAVES_DIR = path_1.default.resolve(process.cwd(), 'saves');
const SAVE_INTERVAL_MS = 60000;
let saveTimer = null;
function ensureSavesDir() {
    if (!fs_1.default.existsSync(SAVES_DIR)) {
        fs_1.default.mkdirSync(SAVES_DIR, { recursive: true });
    }
}
function saveSnapshot() {
    if (!gameState_1.gameState.hasSession() || !gameState_1.gameState.isGameStarted())
        return;
    ensureSavesDir();
    const snapshot = gameState_1.gameState.toJSON();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionId = gameState_1.gameState.getSessionId();
    const filename = `save_${sessionId}_${timestamp}.json`;
    const filepath = path_1.default.join(SAVES_DIR, filename);
    fs_1.default.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[AutoSave] Saved snapshot: ${filename}`);
}
function startAutoSave() {
    stopAutoSave();
    saveTimer = setInterval(saveSnapshot, SAVE_INTERVAL_MS);
    console.log('[AutoSave] Started (interval: 60s)');
}
function stopAutoSave() {
    if (saveTimer) {
        clearInterval(saveTimer);
        saveTimer = null;
    }
}
function loadLatestSave() {
    ensureSavesDir();
    const files = fs_1.default.readdirSync(SAVES_DIR)
        .filter(f => f.startsWith('save_') && f.endsWith('.json'))
        .sort()
        .reverse();
    if (files.length === 0)
        return null;
    const filepath = path_1.default.join(SAVES_DIR, files[0]);
    const data = fs_1.default.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
}
function loadSaveBySessionId(sessionId) {
    ensureSavesDir();
    const files = fs_1.default.readdirSync(SAVES_DIR)
        .filter(f => f.startsWith(`save_${sessionId}_`) && f.endsWith('.json'))
        .sort()
        .reverse();
    if (files.length === 0)
        return null;
    const filepath = path_1.default.join(SAVES_DIR, files[0]);
    const data = fs_1.default.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
}
function listSaves() {
    ensureSavesDir();
    return fs_1.default.readdirSync(SAVES_DIR)
        .filter(f => f.startsWith('save_') && f.endsWith('.json'))
        .sort()
        .reverse();
}
//# sourceMappingURL=autoSave.js.map