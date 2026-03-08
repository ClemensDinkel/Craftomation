import fs from 'fs';
import path from 'path';
import { GameState } from '@craftomation/shared';
import { gameState } from './gameState';

const SAVES_DIR = path.resolve(process.cwd(), 'saves');
const SAVE_INTERVAL_MS = 60_000;

let saveTimer: NodeJS.Timeout | null = null;

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

function saveSnapshot(): void {
  if (!gameState.hasSession() || !gameState.isGameStarted()) return;

  ensureSavesDir();

  const snapshot = gameState.toJSON();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionId = gameState.getSessionId();
  const filename = `save_${sessionId}_${timestamp}.json`;
  const filepath = path.join(SAVES_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`[AutoSave] Saved snapshot: ${filename}`);
}

export function startAutoSave(): void {
  stopAutoSave();
  saveTimer = setInterval(saveSnapshot, SAVE_INTERVAL_MS);
  console.log('[AutoSave] Started (interval: 60s)');
}

export function stopAutoSave(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
}

export function loadLatestSave(): GameState | null {
  ensureSavesDir();

  const files = fs.readdirSync(SAVES_DIR)
    .filter(f => f.startsWith('save_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filepath = path.join(SAVES_DIR, files[0]);
  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data) as GameState;
}

export function loadSaveBySessionId(sessionId: string): GameState | null {
  ensureSavesDir();

  const files = fs.readdirSync(SAVES_DIR)
    .filter(f => f.startsWith(`save_${sessionId}_`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filepath = path.join(SAVES_DIR, files[0]);
  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data) as GameState;
}

export function listSaves(): string[] {
  ensureSavesDir();

  return fs.readdirSync(SAVES_DIR)
    .filter(f => f.startsWith('save_') && f.endsWith('.json'))
    .sort()
    .reverse();
}
