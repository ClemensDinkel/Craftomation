"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryStartJob = tryStartJob;
exports.startGameLoop = startGameLoop;
exports.stopGameLoop = stopGameLoop;
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const wsServer_1 = require("../websocket/wsServer");
const productionGoodUtils_1 = require("./productionGoodUtils");
const SUB_TICK_MS = 2000; // fast tick: every 2 seconds
const ECONOMY_TICK_INTERVAL = 5; // economy runs every 5 sub-ticks = 10 seconds
const MINE_BASE_INTERVAL_MS = 10000; // base: 1 resource every 10s
const marketConstants_1 = require("./marketConstants");
let loopTimer = null;
let subTickCount = 0;
// --- Mining ---
const MINING_RIGHT_HOLDER_MULTIPLIER = 2.0;
const MINING_RIGHT_OTHER_MULTIPLIER = 0.5;
function getMiningInterval(player, resourceId) {
    const config = gameState_1.gameState.getConfig();
    const speed = config?.gameSpeed ?? 1.0;
    const now = Date.now();
    const market = gameState_1.gameState.getMarket();
    let multiplier = 1.0;
    // Boost: 1.5x speed → interval / 1.5
    const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
    if (isBoosted)
        multiplier *= 1.5;
    // Mining rights
    const rights = market.miningRights[resourceId];
    if (rights && rights.length > 0) {
        multiplier *= rights.some(r => r.holderId === player.id)
            ? MINING_RIGHT_HOLDER_MULTIPLIER
            : MINING_RIGHT_OTHER_MULTIPLIER;
    }
    return Math.round(MINE_BASE_INTERVAL_MS / (speed * multiplier));
}
// Wear interval: only gameSpeed and boost affect it, NOT mining rights
function getMineWearInterval(player) {
    const config = gameState_1.gameState.getConfig();
    const speed = config?.gameSpeed ?? 1.0;
    let multiplier = 1.0;
    const isBoosted = player.mineBoostUntil !== null && Date.now() < player.mineBoostUntil;
    if (isBoosted)
        multiplier *= 1.5;
    return Math.round(MINE_BASE_INTERVAL_MS / (speed * multiplier));
}
function processMining(players) {
    const now = Date.now();
    const market = gameState_1.gameState.getMarket();
    // Clean up expired mining rights
    for (const resId of Object.keys(market.miningRights)) {
        market.miningRights[resId] = market.miningRights[resId].filter(r => now < r.expiresAt);
        if (market.miningRights[resId].length === 0) {
            delete market.miningRights[resId];
        }
    }
    for (const player of players) {
        if (player.mineResources.length === 0)
            continue;
        // Initialize timestamps if not set (also handles old saves without these fields)
        if (!player.nextMineProductionAt) {
            const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
            player.nextMineProductionAt = now + getMiningInterval(player, resourceId);
            player.nextMineWearAt = now + getMineWearInterval(player);
            continue;
        }
        if (!player.nextMineWearAt) {
            player.nextMineWearAt = now + getMineWearInterval(player);
        }
        // Produce resources as long as we've passed the deadline
        // (loop handles case where interval is shorter than sub-tick)
        let produced = 0;
        const maxPerTick = 5; // safety cap to prevent runaway loops
        const miningBoost = (0, productionGoodUtils_1.getActiveBonus)(player, 'mining_boost');
        const baseProduction = 1 + miningBoost; // e.g. 1 + 4 = 5 with Quantum Drill
        while (now >= player.nextMineProductionAt && produced < maxPerTick) {
            const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
            player.resources[resourceId] = (player.resources[resourceId] ?? 0) + baseProduction;
            player.mineResourceIndex = (player.mineResourceIndex + 1) % player.mineResources.length;
            // Schedule next production based on the NEW resource (which may have different rights)
            const nextResourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
            const interval = getMiningInterval(player, nextResourceId);
            player.nextMineProductionAt += interval;
            produced++;
        }
        // Wear ticks on its own timer (unaffected by mining rights)
        if (miningBoost > 0 && now >= player.nextMineWearAt) {
            (0, productionGoodUtils_1.applyWear)(player, 'mining_boost');
            player.nextMineWearAt = now + getMineWearInterval(player);
        }
        // If timestamp fell too far behind (e.g. game was paused), reset it
        if (player.nextMineProductionAt < now - MINE_BASE_INTERVAL_MS * 2) {
            const resourceId = player.mineResources[player.mineResourceIndex % player.mineResources.length];
            player.nextMineProductionAt = now + getMiningInterval(player, resourceId);
        }
        if (player.nextMineWearAt < now - MINE_BASE_INTERVAL_MS * 2) {
            player.nextMineWearAt = now + getMineWearInterval(player);
        }
    }
}
// --- Manufacturing ---
function tryStartJob(player, speed) {
    if (player.manufacturingQueue.length === 0)
        return false;
    const job = player.manufacturingQueue[0];
    if (job.completed || job.resourcesConsumed)
        return false;
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === job.recipeId);
    if (!recipe) {
        player.manufacturingQueue.shift();
        return false;
    }
    const cost = {};
    for (const resId of recipe.sequence) {
        cost[resId] = (cost[resId] ?? 0) + 1;
    }
    // Nano Forge special: skip 1 random resource from cost
    const activeItemId = (0, productionGoodUtils_1.getActiveBonusItemId)(player, 'craft_speed');
    if (activeItemId === 'nano_forge' && recipe.sequence.length > 0) {
        const skipIndex = Math.floor(Math.random() * recipe.sequence.length);
        const skippedResId = recipe.sequence[skipIndex];
        cost[skippedResId] = Math.max(0, (cost[skippedResId] ?? 0) - 1);
    }
    // Check which resources are missing
    const missing = {};
    for (const [resId, needed] of Object.entries(cost)) {
        const have = player.resources[resId] ?? 0;
        if (have < needed) {
            missing[resId] = needed - Math.floor(have);
        }
    }
    // If resources are missing, try auto-buy from market (requires auto_buy production good)
    if (Object.keys(missing).length > 0) {
        if (!job.autoBuy || (0, productionGoodUtils_1.getActiveBonus)(player, 'auto_buy') <= 0)
            return false;
        const market = gameState_1.gameState.getMarket();
        // Pre-check: enough supply and cash for all missing resources
        let totalAutoBuyCost = 0;
        const buyPlan = [];
        for (const [resId, amount] of Object.entries(missing)) {
            const entry = market.resources[resId];
            if (!entry || Math.floor(entry.supply) < amount)
                return false; // not enough supply
            // Estimate cost (unit by unit with price changes)
            let estimatedCost = 0;
            let tempSupply = entry.supply;
            let tempPrice = entry.price;
            for (let i = 0; i < amount; i++) {
                estimatedCost += Math.round(tempPrice * (1 + 0.025) * 100) / 100;
                tempSupply = Math.max(0, tempSupply - 1);
                const exponent = Math.min(1, 1 - tempSupply / marketConstants_1.RESOURCE_REFERENCE_SUPPLY);
                tempPrice = Math.max(1, Math.round(marketConstants_1.RESOURCE_BASE_PRICE * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
            }
            totalAutoBuyCost += estimatedCost;
            buyPlan.push({ resId, amount });
        }
        if (player.cash < totalAutoBuyCost)
            return false; // not enough cash
        // Execute auto-buy
        let actualTotalCost = 0;
        for (const { resId, amount } of buyPlan) {
            const entry = market.resources[resId];
            for (let i = 0; i < amount; i++) {
                actualTotalCost += Math.round(entry.price * (1 + 0.025) * 100) / 100;
                entry.supply = Math.max(0, entry.supply - 1);
                const exponent = Math.min(1, 1 - entry.supply / marketConstants_1.RESOURCE_REFERENCE_SUPPLY);
                entry.price = Math.max(1, Math.round(marketConstants_1.RESOURCE_BASE_PRICE * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
            }
            player.resources[resId] = (player.resources[resId] ?? 0) + amount;
        }
        actualTotalCost = Math.round(actualTotalCost * 100) / 100;
        player.cash = Math.round((player.cash - actualTotalCost) * 100) / 100;
        gameState_1.gameState.setMarket(market);
        (0, productionGoodUtils_1.applyWear)(player, 'auto_buy');
    }
    for (const [resId, needed] of Object.entries(cost)) {
        if (needed > 0)
            player.resources[resId] -= needed;
    }
    job.resourcesConsumed = true;
    job.startedAt = Date.now();
    return true;
}
function completeJob(player, speed) {
    const job = player.manufacturingQueue[0];
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === job.recipeId);
    if (recipe) {
        if (recipe.type === 'production_good') {
            // Add as ActiveProductionGood
            const def = gameState_1.gameState.getProductionGoodDefinitions().find(d => d.id === recipe.id);
            if (def) {
                if (!player.productionGoods[recipe.id]) {
                    player.productionGoods[recipe.id] = [];
                }
                player.productionGoods[recipe.id].push({
                    itemId: recipe.id,
                    wearRemaining: def.wearUses,
                    isUsed: false,
                });
                (0, productionGoodUtils_1.activateProductionGood)(player, recipe.id);
            }
        }
        else {
            player.consumables[recipe.id] = (player.consumables[recipe.id] ?? 0) + 1;
        }
    }
    // Apply wear to crafting tool on job completion
    if ((0, productionGoodUtils_1.getActiveBonus)(player, 'craft_speed') > 0)
        (0, productionGoodUtils_1.applyWear)(player, 'craft_speed');
    const isRepeat = job.repeat;
    const recipeId = job.recipeId;
    const wasAutoBuy = job.autoBuy;
    player.manufacturingQueue.shift();
    if (isRepeat) {
        const repeatRecipe = gameState_1.gameState.getRecipes().find(r => r.id === recipeId);
        if (repeatRecipe) {
            const baseDurationMap = repeatRecipe.type === 'production_good'
                ? { 1: 60000, 2: 80000, 3: 100000, 4: 120000 }
                : { 1: 30000, 2: 40000, 3: 50000, 4: 60000 };
            const baseDuration = baseDurationMap[repeatRecipe.tier] ?? 30000;
            const craftSpeedBonus = (0, productionGoodUtils_1.getActiveBonus)(player, 'craft_speed');
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
                autoBuy: wasAutoBuy,
            });
        }
    }
}
function processManufacturing(players) {
    const config = gameState_1.gameState.getConfig();
    const speed = config?.gameSpeed ?? 1.0;
    for (const player of players) {
        if (player.manufacturingQueue.length === 0)
            continue;
        let front = player.manufacturingQueue[0];
        if (!front.resourcesConsumed) {
            tryStartJob(player, speed);
            continue; // just started — first tick comes next sub-tick
        }
        if (front.completed)
            continue;
        front.remainingMs -= SUB_TICK_MS;
        if (front.remainingMs <= 0) {
            front.completed = true;
            completeJob(player, speed);
            // Immediately start the next job (it will tick next sub-tick)
            if (player.manufacturingQueue.length > 0) {
                tryStartJob(player, speed);
            }
        }
    }
}
// --- Market Info Wear (timer-based, like mining) ---
const MARKET_INFO_WEAR_INTERVAL_MS = 10000; // same base interval as mining
function processMarketInfoWear(players) {
    const config = gameState_1.gameState.getConfig();
    const speed = config?.gameSpeed ?? 1.0;
    const now = Date.now();
    const interval = Math.round(MARKET_INFO_WEAR_INTERVAL_MS / speed);
    for (const player of players) {
        const bonus = (0, productionGoodUtils_1.getActiveBonus)(player, 'market_info');
        if (bonus <= 0)
            continue;
        if (!player.nextMarketInfoWearAt) {
            player.nextMarketInfoWearAt = now + interval;
            continue;
        }
        if (now >= player.nextMarketInfoWearAt) {
            (0, productionGoodUtils_1.applyWear)(player, 'market_info');
            player.nextMarketInfoWearAt = now + interval;
        }
        if (player.nextMarketInfoWearAt < now - MARKET_INFO_WEAR_INTERVAL_MS * 2) {
            player.nextMarketInfoWearAt = now + interval;
        }
    }
}
// --- Market ---
function processMarketConsumption() {
    const config = gameState_1.gameState.getConfig();
    const tick = gameState_1.gameState.getTick();
    const market = gameState_1.gameState.getMarket();
    const timeMultiplier = 1 + tick * 0.01;
    // Dynamically adjust resource consumption when player count changes
    const currentPlayerCount = gameState_1.gameState.getAllPlayers().length;
    if (currentPlayerCount !== config.playerCount) {
        const resourceConsumption = (currentPlayerCount / config.resourceTypeCount) * 1.2;
        for (const entry of Object.values(market.resources)) {
            entry.baseConsumptionRate = resourceConsumption;
        }
        config.playerCount = currentPlayerCount;
    }
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
function processPriceAdjustment() {
    const market = gameState_1.gameState.getMarket();
    const recipes = gameState_1.gameState.getRecipes();
    // Resources: exponential decay curve
    for (const entry of Object.values(market.resources)) {
        const exponent = Math.min(1, 1 - entry.supply / marketConstants_1.RESOURCE_REFERENCE_SUPPLY);
        const newPrice = marketConstants_1.RESOURCE_BASE_PRICE * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent);
        entry.price = Math.max(1, Math.round(newPrice * 100) / 100);
    }
    for (const recipe of recipes) {
        if (recipe.type === 'consumable') {
            const basePrice = marketConstants_1.BASE_PRICES[recipe.tier];
            const entry = market.consumables[recipe.id];
            if (!entry)
                continue;
            const exponent = Math.min(1, 1 - entry.supply / marketConstants_1.CONSUMABLE_REFERENCE_SUPPLY);
            const newPrice = basePrice * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent);
            entry.price = Math.max(1, Math.round(newPrice * 100) / 100);
        }
        else {
            const basePrice = marketConstants_1.PRODUCTION_GOOD_BASE_PRICES[recipe.tier];
            const entry = market.productionGoods[recipe.id];
            if (!entry)
                continue;
            const exponent = Math.min(1, 1 - entry.supply / marketConstants_1.PRODUCTION_GOOD_REFERENCE_SUPPLY);
            const newPrice = basePrice * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent);
            entry.price = Math.max(1, Math.round(newPrice * 100) / 100);
        }
    }
}
// --- Auto-Trade ---
function processAutoTrade(players) {
    const market = gameState_1.gameState.getMarket();
    let marketChanged = false;
    for (const player of players) {
        if (!player.autoTradeRules || player.autoTradeRules.length === 0)
            continue;
        if ((0, productionGoodUtils_1.getActiveBonus)(player, 'auto_trade') <= 0)
            continue;
        for (const rule of player.autoTradeRules) {
            const entries = rule.itemType === 'resource' ? market.resources : market.consumables;
            const entry = entries[rule.itemId];
            if (!entry)
                continue;
            const inventory = rule.itemType === 'resource' ? player.resources : player.consumables;
            // Auto-buy: price <= threshold, have supply, have cash
            if (rule.buyBelowPrice !== undefined && entry.price <= rule.buyBelowPrice) {
                if (Math.floor(entry.supply) >= 1) {
                    const cost = Math.round(entry.price * (1 + 0.025) * 100) / 100;
                    if (player.cash >= cost) {
                        player.cash = Math.round((player.cash - cost) * 100) / 100;
                        inventory[rule.itemId] = (inventory[rule.itemId] ?? 0) + 1;
                        entry.supply = Math.max(0, entry.supply - 1);
                        // Recalc price
                        const isRes = rule.itemType === 'resource';
                        const basePrice = isRes ? marketConstants_1.RESOURCE_BASE_PRICE : (marketConstants_1.BASE_PRICES[gameState_1.gameState.getRecipes().find(r => r.id === rule.itemId)?.tier ?? 1] ?? 12);
                        const refSupply = isRes ? marketConstants_1.RESOURCE_REFERENCE_SUPPLY : marketConstants_1.CONSUMABLE_REFERENCE_SUPPLY;
                        const exponent = Math.min(1, 1 - entry.supply / refSupply);
                        entry.price = Math.max(1, Math.round(basePrice * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
                        marketChanged = true;
                        (0, productionGoodUtils_1.applyWear)(player, 'auto_trade');
                    }
                }
            }
            // Auto-sell: price >= threshold, have inventory
            if (rule.sellAbovePrice !== undefined && entry.price >= rule.sellAbovePrice) {
                const owned = Math.floor(inventory[rule.itemId] ?? 0);
                if (owned >= 1) {
                    entry.supply += 1;
                    const isRes = rule.itemType === 'resource';
                    const basePrice = isRes ? marketConstants_1.RESOURCE_BASE_PRICE : (marketConstants_1.BASE_PRICES[gameState_1.gameState.getRecipes().find(r => r.id === rule.itemId)?.tier ?? 1] ?? 12);
                    const refSupply = isRes ? marketConstants_1.RESOURCE_REFERENCE_SUPPLY : marketConstants_1.CONSUMABLE_REFERENCE_SUPPLY;
                    const exponent = Math.min(1, 1 - entry.supply / refSupply);
                    entry.price = Math.max(1, Math.round(basePrice * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
                    const revenue = Math.round(entry.price * (1 - 0.025) * 100) / 100;
                    player.cash = Math.round((player.cash + revenue) * 100) / 100;
                    inventory[rule.itemId] = (inventory[rule.itemId] ?? 0) - 1;
                    marketChanged = true;
                    (0, productionGoodUtils_1.applyWear)(player, 'auto_trade');
                }
            }
        }
    }
    if (marketChanged) {
        gameState_1.gameState.setMarket(market);
    }
}
// Production good wear is now per-usage — see applyWear() calls in mining/manufacturing/lab
// --- Main Tick ---
function processTick() {
    const players = gameState_1.gameState.getAllPlayers();
    // Mining, manufacturing & passive wear run every sub-tick (2s)
    processMining(players);
    processManufacturing(players);
    processMarketInfoWear(players);
    // Economy systems run every ECONOMY_TICK_INTERVAL sub-ticks (10s)
    const isEconomyTick = subTickCount % ECONOMY_TICK_INTERVAL === 0;
    if (isEconomyTick) {
        processAutoTrade(players);
        processMarketConsumption();
        processPriceAdjustment();
        gameState_1.gameState.incrementTick();
    }
    subTickCount++;
    // Save players & broadcast every sub-tick
    for (const player of players) {
        gameState_1.gameState.setPlayer(player.id, player);
    }
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.GAME_STATE_UPDATE,
        payload: gameState_1.gameState.toJSON(),
    });
}
function startGameLoop() {
    stopGameLoop();
    subTickCount = 0;
    loopTimer = setInterval(processTick, SUB_TICK_MS);
    console.log(`[GameLoop] Started (sub-tick: ${SUB_TICK_MS}ms, economy every ${ECONOMY_TICK_INTERVAL * SUB_TICK_MS}ms)`);
}
function stopGameLoop() {
    if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
        console.log('[GameLoop] Stopped');
    }
}
//# sourceMappingURL=gameLoop.js.map