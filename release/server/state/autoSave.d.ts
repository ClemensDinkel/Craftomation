import { GameState } from '@craftomation/shared';
export declare function startAutoSave(): void;
export declare function stopAutoSave(): void;
export declare function loadLatestSave(): GameState | null;
export declare function loadSaveBySessionId(sessionId: string): GameState | null;
export declare function listSaves(): string[];
