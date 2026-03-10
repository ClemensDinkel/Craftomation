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
    if (!player.currentMineResource) continue;

    const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
    const amount = isBoosted ? 1.5 : 1;

    player.resources[player.currentMineResource] =
      (player.resources[player.currentMineResource] ?? 0) + amount;
  }
}

function processManufacturing(players: Player[]): void {
  const tickMs = TICK_SECONDS * 1000;

  for (const player of players) {
    if (player.manufacturingQueue.length === 0) continue;

    const job = player.manufacturingQueue[0];
    if (job.completed) continue;

    job.remainingMs -= tickMs;

    if (job.remainingMs <= 0) {
      job.completed = true;

      const recipe = gameState.getRecipes().find(r => r.id === job.recipeId);
      if (recipe) {
        player.consumables[recipe.id] = (player.consumables[recipe.id] ?? 0) + 1;
      }

      player.manufacturingQueue.shift();
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
