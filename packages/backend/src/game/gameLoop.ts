import { Player, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';
import { getActiveBonus, getActiveBonusItemId, activateProductionGood, applyWear } from './productionGoodUtils';

const SUB_TICK_MS = 2_000;        // fast tick: every 2 seconds
const ECONOMY_TICK_INTERVAL = 5;  // economy runs every 5 sub-ticks = 10 seconds
const MINE_BASE_INTERVAL_MS = 10_000; // base: 1 resource every 10s

const RESOURCE_REFERENCE_SUPPLY = 100;
const CONSUMABLE_REFERENCE_SUPPLY = 15;
const PRODUCTION_GOOD_REFERENCE_SUPPLY = 10;

let loopTimer: NodeJS.Timeout | null = null;
let subTickCount = 0;

const BASE_PRICES: Record<number, number> = {
  1: 12,
  2: 20,
  3: 32,
  4: 50,
};

const PRODUCTION_GOOD_BASE_PRICES: Record<number, number> = {
  1: 15,
  2: 30,
  3: 60,
  4: 120,
};

// --- Mining ---

const MINING_RIGHT_HOLDER_MULTIPLIER = 2.0;
const MINING_RIGHT_OTHER_MULTIPLIER = 0.5;

function getMiningInterval(player: Player, resourceId: string): number {
  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;
  const now = Date.now();
  const market = gameState.getMarket();

  let multiplier = 1.0;

  // Boost: 1.5x speed → interval / 1.5
  const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
  if (isBoosted) multiplier *= 1.5;

  // Mining rights
  const rights = market.miningRights[resourceId];
  if (rights && rights.length > 0) {
    multiplier *= rights.some(r => r.holderId === player.id)
      ? MINING_RIGHT_HOLDER_MULTIPLIER
      : MINING_RIGHT_OTHER_MULTIPLIER;
  }

  return Math.round(MINE_BASE_INTERVAL_MS / (speed * multiplier));
}

function processMining(players: Player[]): void {
  const now = Date.now();
  const market = gameState.getMarket();

  // Clean up expired mining rights
  for (const resId of Object.keys(market.miningRights)) {
    market.miningRights[resId] = market.miningRights[resId].filter(r => now < r.expiresAt);
    if (market.miningRights[resId].length === 0) {
      delete market.miningRights[resId];
    }
  }

  for (const player of players) {
    if (player.mineResources.length === 0) continue;

    // Initialize timestamp if not set (also handles old saves without this field)
    if (!player.nextMineProductionAt) {
      const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
      player.nextMineProductionAt = now + getMiningInterval(player, resourceId);
      continue;
    }

    // Produce resources as long as we've passed the deadline
    // (loop handles case where interval is shorter than sub-tick)
    let produced = 0;
    const maxPerTick = 5; // safety cap to prevent runaway loops
    const miningBoost = getActiveBonus(player, 'mining_boost');
    const baseProduction = 1 + miningBoost; // e.g. 1 + 4 = 5 with Quantum Drill
    while (now >= player.nextMineProductionAt && produced < maxPerTick) {
      const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
      player.resources[resourceId] = (player.resources[resourceId] ?? 0) + baseProduction;
      player.mineResourceIndex = (player.mineResourceIndex + 1) % player.mineResources.length;

      // Apply wear to mining tool
      if (miningBoost > 0) applyWear(player, 'mining_boost');

      // Schedule next production based on the NEW resource (which may have different rights)
      const nextResourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
      const interval = getMiningInterval(player, nextResourceId);
      player.nextMineProductionAt += interval;
      produced++;
    }

    // If timestamp fell too far behind (e.g. game was paused), reset it
    if (player.nextMineProductionAt < now - MINE_BASE_INTERVAL_MS * 2) {
      const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
      player.nextMineProductionAt = now + getMiningInterval(player, resourceId);
    }
  }
}

// --- Manufacturing ---

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

  // Nano Forge special: skip 1 random resource from cost
  const activeItemId = getActiveBonusItemId(player, 'craft_speed');
  if (activeItemId === 'nano_forge' && recipe.sequence.length > 0) {
    const skipIndex = Math.floor(Math.random() * recipe.sequence.length);
    const skippedResId = recipe.sequence[skipIndex];
    cost[skippedResId] = Math.max(0, (cost[skippedResId] ?? 0) - 1);
  }

  for (const [resId, needed] of Object.entries(cost)) {
    if (needed > 0) player.resources[resId] -= needed;
  }
  job.resourcesConsumed = true;
  job.startedAt = Date.now();
  return true;
}

function completeJob(player: Player, speed: number): void {
  const job = player.manufacturingQueue[0];
  const recipe = gameState.getRecipes().find(r => r.id === job.recipeId);
  if (recipe) {
    if (recipe.type === 'production_good') {
      // Add as ActiveProductionGood
      const def = gameState.getProductionGoodDefinitions().find(d => d.id === recipe.id);
      if (def) {
        if (!player.productionGoods[recipe.id]) {
          player.productionGoods[recipe.id] = [];
        }
        player.productionGoods[recipe.id].push({
          itemId: recipe.id,
          wearRemaining: def.wearUses,
          isUsed: false,
        });
        activateProductionGood(player, recipe.id);
      }
    } else {
      player.consumables[recipe.id] = (player.consumables[recipe.id] ?? 0) + 1;
    }
  }

  // Apply wear to crafting tool on job completion
  if (getActiveBonus(player, 'craft_speed') > 0) applyWear(player, 'craft_speed');

  const isRepeat = job.repeat;
  const recipeId = job.recipeId;
  player.manufacturingQueue.shift();

  if (isRepeat) {
    const repeatRecipe = gameState.getRecipes().find(r => r.id === recipeId);
    if (repeatRecipe) {
      const baseDurationMap = repeatRecipe.type === 'production_good'
        ? { 1: 60_000, 2: 80_000, 3: 100_000, 4: 120_000 }
        : { 1: 30_000, 2: 40_000, 3: 50_000, 4: 60_000 };
      const baseDuration = baseDurationMap[repeatRecipe.tier] ?? 30_000;
      const craftSpeedBonus = getActiveBonus(player, 'craft_speed');
      const speedReduction = 1 - craftSpeedBonus / 100;
      const duration = Math.round(baseDuration * speedReduction / Math.max(speed, 0.1));
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
  const config = gameState.getConfig();
  const speed = config?.gameSpeed ?? 1.0;

  for (const player of players) {
    if (player.manufacturingQueue.length === 0) continue;

    const front = player.manufacturingQueue[0];
    if (!front.resourcesConsumed) {
      tryStartJob(player, speed);
      continue;
    }

    if (front.completed) continue;

    // Manufacturing still uses the economy tick interval (10s)
    front.remainingMs -= ECONOMY_TICK_INTERVAL * SUB_TICK_MS;

    if (front.remainingMs <= 0) {
      front.completed = true;
      completeJob(player, speed);
      tryStartJob(player, speed);
    }
  }
}

// --- Market ---

function processMarketConsumption(): void {
  const config = gameState.getConfig()!;
  const tick = gameState.getTick();
  const market = gameState.getMarket();
  const timeMultiplier = 1 + tick * 0.01;

  for (const entry of Object.values(market.resources)) {
    const consumption = entry.baseConsumptionRate * config.consumptionRate * timeMultiplier;
    entry.supply = Math.max(0, entry.supply - consumption);
  }

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

  for (const entry of Object.values(market.resources)) {
    const basePrice = 5;
    const newPrice = basePrice * (RESOURCE_REFERENCE_SUPPLY / Math.max(entry.supply, 1));
    entry.price = Math.min(basePrice * 10, Math.max(1, Math.round(newPrice * 100) / 100));
  }

  for (const recipe of recipes) {
    if (recipe.type === 'consumable') {
      const basePrice = BASE_PRICES[recipe.tier];
      const entry = market.consumables[recipe.id];
      if (!entry) continue;
      const newPrice = basePrice * (CONSUMABLE_REFERENCE_SUPPLY / Math.max(entry.supply, 1));
      entry.price = Math.min(basePrice * 10, Math.max(1, Math.round(newPrice * 100) / 100));
    } else {
      const basePrice = PRODUCTION_GOOD_BASE_PRICES[recipe.tier];
      const entry = market.productionGoods[recipe.id];
      if (!entry) continue;
      // sqrt curve for production goods: flatter price scaling
      const ratio = PRODUCTION_GOOD_REFERENCE_SUPPLY / Math.max(entry.supply, 1);
      const newPrice = basePrice * Math.sqrt(ratio);
      entry.price = Math.min(basePrice * 10, Math.max(1, Math.round(newPrice * 100) / 100));
    }
  }
}

// Production good wear is now per-usage — see applyWear() calls in mining/manufacturing/lab

// --- Main Tick ---

function processTick(): void {
  const players = gameState.getAllPlayers();

  // Mining runs every sub-tick (2s) for responsive production
  processMining(players);

  // Economy systems run every ECONOMY_TICK_INTERVAL sub-ticks (10s)
  const isEconomyTick = subTickCount % ECONOMY_TICK_INTERVAL === 0;
  if (isEconomyTick) {
    processManufacturing(players);
    processMarketConsumption();
    processPriceAdjustment();
    gameState.incrementTick();
  }

  subTickCount++;

  // Save players & broadcast every sub-tick
  for (const player of players) {
    gameState.setPlayer(player.id, player);
  }

  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

export function startGameLoop(): void {
  stopGameLoop();
  subTickCount = 0;

  loopTimer = setInterval(processTick, SUB_TICK_MS);
  console.log(`[GameLoop] Started (sub-tick: ${SUB_TICK_MS}ms, economy every ${ECONOMY_TICK_INTERVAL * SUB_TICK_MS}ms)`);
}

export function stopGameLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
    console.log('[GameLoop] Stopped');
  }
}
