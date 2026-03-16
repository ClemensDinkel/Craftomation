import { v4 as uuidv4 } from 'uuid';
import { ManufacturingJob, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';
import { tryStartJob } from '../game/gameLoop';
import { getActiveBonus } from '../game/productionGoodUtils';

// Crafting durations in ms per tier (consumable)
const CRAFTING_DURATION_MS: Record<number, number> = {
  1: 30_000,
  2: 40_000,
  3: 50_000,
  4: 60_000,
};

// Crafting durations in ms per tier (production goods — longer)
const CRAFTING_DURATION_PRODUCTION_GOOD_MS: Record<number, number> = {
  1: 60_000,
  2: 80_000,
  3: 100_000,
  4: 120_000,
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
  autoBuy?: boolean;
}): void {
  const { playerId, recipeId, repeat, autoBuy } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const recipe = gameState.getRecipes().find(r => r.id === recipeId);
  if (!recipe) return;

  // Player must know this recipe
  if (!player.knownRecipes.includes(recipeId)) return;

  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;
  const baseDuration = recipe.type === 'production_good'
    ? (CRAFTING_DURATION_PRODUCTION_GOOD_MS[recipe.tier] ?? 60_000)
    : (CRAFTING_DURATION_MS[recipe.tier] ?? 30_000);
  const craftSpeedBonus = getActiveBonus(player, 'craft_speed'); // 0, 25, 40, 55, or 60
  const speedReduction = 1 - craftSpeedBonus / 100;
  const duration = Math.round(baseDuration * speedReduction / Math.max(speed, 0.1));

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
    autoBuy: autoBuy ?? false,
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

export function handleSetManufacturingAutoBuy(payload: {
  playerId: string;
  autoBuy: boolean;
}): void {
  const { playerId, autoBuy } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  let changed = false;
  for (const job of player.manufacturingQueue) {
    if (!job.resourcesConsumed && job.autoBuy !== autoBuy) {
      job.autoBuy = autoBuy;
      changed = true;
    }
  }

  if (changed) {
    // If autoBuy was enabled and the first job is waiting for resources, try to start it
    if (autoBuy && player.manufacturingQueue.length > 0 && !player.manufacturingQueue[0].resourcesConsumed) {
      const config = gameState.getConfig();
      const speed = config?.gameSpeed ?? 1.0;
      tryStartJob(player, speed);
    }

    gameState.setPlayer(playerId, player);
    broadcastGameState();
  }
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
