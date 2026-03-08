import { Player, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';

const TICK_BASE_MS = 10_000;
const TICK_SECONDS = 10;
const REFERENCE_SUPPLY = 100;

let loopTimer: NodeJS.Timeout | null = null;

// --- Production Bonuses (hardcoded map: itemId → miningBonus per item) ---
const MINING_BONUSES: Record<string, number> = {
  pickaxe: 1,
  shovel: 1,
  chisel: 1,
  minecart: 2,
  crane: 3,
  drillbot: 5,
};

// --- Base wear time in seconds per production good type ---
const BASE_WEAR_TIME: Record<string, number> = {
  pickaxe: 300,
  shovel: 300,
  chisel: 300,
  conveyor: 600,
  minecart: 600,
  forge: 600,
  assembler: 600,
  crane: 900,
  press: 900,
  refinery: 900,
  sorter: 900,
  laser: 1200,
  automod: 1200,
  drillbot: 1200,
  reactor: 1200,
};

const BASE_PRICES: Record<number, number> = {
  1: 10,
  2: 25,
  3: 60,
  4: 150,
};

// Wear timers: playerId → itemId → remaining seconds
const wearTimers: Map<string, Record<string, number>> = new Map();

function getWearTimers(playerId: string): Record<string, number> {
  if (!wearTimers.has(playerId)) {
    wearTimers.set(playerId, {});
  }
  return wearTimers.get(playerId)!;
}

// --- Tick Processing ---

function processMining(players: Player[]): void {
  for (const player of players) {
    if (!player.activeInMine || !player.currentMineResource) continue;

    let bonus = 0;
    for (const [itemId, count] of Object.entries(player.productionGoods)) {
      if (count > 0 && MINING_BONUSES[itemId]) {
        bonus += MINING_BONUSES[itemId] * count;
      }
    }

    // Check for reactor (doubles all bonuses)
    if ((player.productionGoods['reactor'] ?? 0) > 0) {
      bonus *= 2;
    }

    const amount = 1 + bonus;
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

      // Find the recipe to determine what to add
      const recipe = gameState.getRecipes().find(r => r.id === job.recipeId);
      if (recipe) {
        if (recipe.type === 'production_good') {
          player.productionGoods[recipe.id] = (player.productionGoods[recipe.id] ?? 0) + 1;
        } else {
          player.consumables[recipe.id] = (player.consumables[recipe.id] ?? 0) + 1;
        }
      }

      // Remove completed job
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

  // Production goods consumption (only if ever sold, i.e. baseConsumptionRate > 0)
  for (const entry of Object.values(market.productionGoods)) {
    if (entry.baseConsumptionRate > 0) {
      const consumption = entry.baseConsumptionRate * config.consumptionRate * timeMultiplier;
      entry.supply = Math.max(0, entry.supply - consumption);
    }
  }

  // Consumable consumption
  for (const entry of Object.values(market.consumables)) {
    if (entry.baseConsumptionRate > 0) {
      const consumption = entry.baseConsumptionRate * config.consumptionRate * timeMultiplier;
      entry.supply = Math.max(0, entry.supply - consumption);
    }
  }
}

function processWear(players: Player[]): void {
  for (const player of players) {
    const timers = getWearTimers(player.id);

    for (const [itemId, count] of Object.entries(player.productionGoods)) {
      if (count <= 0) continue;

      const baseTime = BASE_WEAR_TIME[itemId];
      if (!baseTime) continue;

      // Initialize timer if not set
      if (timers[itemId] === undefined) {
        timers[itemId] = baseTime / count;
      }

      timers[itemId] -= TICK_SECONDS;

      if (timers[itemId] <= 0) {
        // Remove one item
        player.productionGoods[itemId] = Math.max(0, count - 1);

        // Reset timer (proportional to remaining count)
        const newCount = player.productionGoods[itemId];
        if (newCount > 0) {
          timers[itemId] = baseTime / newCount;
        } else {
          delete timers[itemId];
        }
      }
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

  // Recipe-based prices
  for (const recipe of recipes) {
    const basePrice = BASE_PRICES[recipe.tier];
    const entry = recipe.type === 'production_good'
      ? market.productionGoods[recipe.id]
      : market.consumables[recipe.id];

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

  // 4. Wear
  processWear(players);

  // 5. Price adjustment
  processPriceAdjustment();

  // 6. Update players in state & increment tick
  for (const player of players) {
    gameState.setPlayer(player.id, player);
  }
  gameState.incrementTick();

  // 7. Broadcast
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
