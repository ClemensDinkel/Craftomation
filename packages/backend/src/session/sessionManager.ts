import { gameState } from '../state/gameState';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion

export function generateSessionId(): string {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return id;
}

export function createSession(): string {
  const sessionId = generateSessionId();
  gameState.createSession(sessionId);
  console.log(`[Session] Created session: ${sessionId}`);
  return sessionId;
}

export function sessionExists(sessionId: string): boolean {
  return gameState.getSessionId() === sessionId;
}
