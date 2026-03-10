import { v4 as uuidv4 } from 'uuid';
import { ManufacturingJob, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';
import { tryStartJob } from '../game/gameLoop';

// Crafting durations in ms per tier (consumable)
const CRAFTING_DURATION_MS: Record<number, number> = {
  1: 30_000,
  2: 40_000,
  3: 50_000,
  4: 60_000,
};

function broadcastGameState(): void {
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

export function handleAddManufacturingJob(payload: {
  playerId: string;
  recipeId: string;
  repeat: boolean;
}): void {
  const { playerId, recipeId, repeat } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const recipe = gameState.getRecipes().find(r => r.id === recipeId);
  if (!recipe) return;

  // Player must know this recipe
  if (!player.knownRecipes.includes(recipeId)) return;

  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;
  const baseDuration = CRAFTING_DURATION_MS[recipe.tier] ?? 30_000;
  const duration = Math.round(baseDuration / Math.max(speed, 0.1));

  const job: ManufacturingJob = {
    id: uuidv4(),
    recipeId,
    playerId,
    startedAt: 0,
    duration,
    remainingMs: duration,
    completed: false,
    repeat,
    resourcesConsumed: false,
  };

  const wasEmpty = player.manufacturingQueue.length === 0;
  player.manufacturingQueue.push(job);

  // If this is the first job in queue, start it immediately
  if (wasEmpty) {
    tryStartJob(player, speed);
  }

  gameState.setPlayer(playerId, player);
  broadcastGameState();
}

export function handleRemoveManufacturingJob(payload: {
  playerId: string;
  jobIndex: number;
}): void {
  const { playerId, jobIndex } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  if (jobIndex < 0 || jobIndex >= player.manufacturingQueue.length) return;

  player.manufacturingQueue.splice(jobIndex, 1);
  gameState.setPlayer(playerId, player);
  broadcastGameState();
}

export function handleDebugUnlockRecipe(payload: {
  playerId: string;
  recipeId: string;
}): void {
  const { playerId, recipeId } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const recipe = gameState.getRecipes().find(r => r.id === recipeId);
  if (!recipe) return;

  if (!player.knownRecipes.includes(recipeId)) {
    player.knownRecipes.push(recipeId);
    gameState.setPlayer(playerId, player);
    broadcastGameState();
  }
}
