import { Player, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';

const TICK_BASE_MS = 10_000;
const TICK_SECONDS = 10;
const REFERENCE_SUPPLY = 100;

let loopTimer: NodeJS.Timeout | null = null;

const BASE_PRICES: Record<number, number> = {
  1: 10,
  2: 25,
  3: 60,
  4: 150,
};

// --- Tick Processing ---

function processMining(players: Player[]): void {
  const now = Date.now();

  for (const player of players) {
    if (player.mineResources.length === 0) continue;

    const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
    const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
    const amount = isBoosted ? 1.5 : 1;

    player.resources[resourceId] = (player.resources[resourceId] ?? 0) + amount;

    // Advance to next resource in rotation
    player.mineResourceIndex = (player.mineResourceIndex + 1) % player.mineResources.length;
  }
}

export function tryStartJob(player: Player, speed: number): boolean {
  if (player.manufacturingQueue.length === 0) return false;

  const job = player.manufacturingQueue[0];
  if (job.completed || job.resourcesConsumed) return false;

  const recipe = gameState.getRecipes().find(r => r.id === job.recipeId);
  if (!recipe) {
    player.manufacturingQueue.shift();
    return false;
  }

  const cost: Record<string, number> = {};
  for (const resId of recipe.sequence) {
    cost[resId] = (cost[resId] ?? 0) + 1;
  }

  for (const [resId, needed] of Object.entries(cost)) {
    if ((player.resources[resId] ?? 0) < needed) return false;
  }

  for (const [resId, needed] of Object.entries(cost)) {
    player.resources[resId] -= needed;
  }
  job.resourcesConsumed = true;
  job.startedAt = Date.now();
  return true;
}

function completeJob(player: Player, speed: number): void {
  const job = player.manufacturingQueue[0];
  const recipe = gameState.getRecipes().find(r => r.id === job.recipeId);
  if (recipe) {
    player.consumables[recipe.id] = (player.consumables[recipe.id] ?? 0) + 1;
  }

  const isRepeat = job.repeat;
  const recipeId = job.recipeId;
  player.manufacturingQueue.shift();

  if (isRepeat) {
    const repeatRecipe = gameState.getRecipes().find(r => r.id === recipeId);
    if (repeatRecipe) {
      const baseDuration = { 1: 30_000, 2: 40_000, 3: 50_000, 4: 60_000 }[repeatRecipe.tier] ?? 30_000;
      const duration = Math.round(baseDuration / Math.max(speed, 0.1));
      player.manufacturingQueue.push({
        id: `${recipeId}-${Date.now()}`,
        recipeId,
        playerId: player.id,
        startedAt: 0,
        duration,
        remainingMs: duration,
        completed: false,
        repeat: true,
        resourcesConsumed: false,
      });
    }
  }
}

function processManufacturing(players: Player[]): void {
  const tickMs = TICK_SECONDS * 1000;
  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;

  for (const player of players) {
    if (player.manufacturingQueue.length === 0) continue;

    // Try to start a new job if the front of the queue hasn't started yet
    const front = player.manufacturingQueue[0];
    if (!front.resourcesConsumed) {
      tryStartJob(player, speed);
      // Job just started — don't subtract time yet so client sees 0%
      continue;
    }

    if (front.completed) continue;

    front.remainingMs -= tickMs;

    if (front.remainingMs <= 0) {
      front.completed = true;
      completeJob(player, speed);

      // Immediately start the next job in the same tick
      tryStartJob(player, speed);
    }
  }
}

function processMarketConsumption(): void {
  const config = gameState.getConfig()!;
  const tick = gameState.getTick();
  const market = gameState.getMarket();
  const timeMultiplier = 1 + tick * 0.001;

  // Resource consumption
  for (const entry of Object.values(market.resources)) {
    const consumption = entry.baseConsumptionRate * config.consumptionRate * timeMultiplier;
    entry.supply = Math.max(0, entry.supply - consumption);
  }

  // Consumable consumption
  for (const entry of Object.values(market.consumables)) {
    if (entry.baseConsumptionRate > 0) {
      const consumption = entry.baseConsumptionRate * config.consumptionRate * timeMultiplier;
      entry.supply = Math.max(0, entry.supply - consumption);
    }
  }
}

function processPriceAdjustment(): void {
  const market = gameState.getMarket();
  const recipes = gameState.getRecipes();

  // Resource prices
  for (const entry of Object.values(market.resources)) {
    const basePrice = 5; // RESOURCE_BASE_PRICE
    const newPrice = basePrice * (REFERENCE_SUPPLY / Math.max(entry.supply, 1));
    entry.price = Math.min(basePrice * 10, Math.max(1, Math.round(newPrice * 100) / 100));
  }

  // Consumable prices
  for (const recipe of recipes) {
    const basePrice = BASE_PRICES[recipe.tier];
    const entry = market.consumables[recipe.id];
    if (!entry) continue;

    const newPrice = basePrice * (REFERENCE_SUPPLY / Math.max(entry.supply, 1));
    entry.price = Math.min(basePrice * 10, Math.max(1, Math.round(newPrice * 100) / 100));
  }
}

function processTick(): void {
  const players = gameState.getAllPlayers();

  // 1. Mining
  processMining(players);

  // 2. Manufacturing
  processManufacturing(players);

  // 3. Market consumption
  processMarketConsumption();

  // 4. Price adjustment
  processPriceAdjustment();

  // 5. Update players in state & increment tick
  for (const player of players) {
    gameState.setPlayer(player.id, player);
  }
  gameState.incrementTick();

  // 6. Broadcast
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

export function startGameLoop(): void {
  stopGameLoop();

  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;
  const intervalMs = TICK_BASE_MS / Math.max(speed, 0.1);

  loopTimer = setInterval(processTick, intervalMs);
  console.log(`[GameLoop] Started (interval: ${intervalMs}ms, speed: ${speed}x)`);
}

export function stopGameLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log('[GameLoop] Stopped');
  }
}
