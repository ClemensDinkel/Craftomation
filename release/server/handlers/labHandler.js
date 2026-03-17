"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSetLabAutoBuy = handleSetLabAutoBuy;
exports.handleLabExperiment = handleLabExperiment;
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const wsServer_1 = require("../websocket/wsServer");
const productionGoodUtils_1 = require("../game/productionGoodUtils");
const marketConstants_1 = require("../game/marketConstants");
function broadcastGameState() {
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.GAME_STATE_UPDATE,
        payload: gameState_1.gameState.toJSON(),
    });
}
function computeWordle(guess, target) {
    const len = guess.length;
    const colorCoding = new Array(len).fill('red');
    const targetUsed = new Array(len).fill(false);
    const guessUsed = new Array(len).fill(false);
    // Pass 1: Green — exact matches
    let greenCount = 0;
    for (let i = 0; i < len; i++) {
        if (guess[i] === target[i]) {
            colorCoding[i] = 'green';
            targetUsed[i] = true;
            guessUsed[i] = true;
            greenCount++;
        }
    }
    // Pass 2: Yellow — right resource, wrong position
    let yellowCount = 0;
    for (let i = 0; i < len; i++) {
        if (guessUsed[i])
            continue;
        for (let j = 0; j < len; j++) {
            if (targetUsed[j])
                continue;
            if (guess[i] === target[j]) {
                colorCoding[i] = 'yellow';
                targetUsed[j] = true;
                yellowCount++;
                break;
            }
        }
    }
    const similarity = (greenCount + yellowCount * 0.5) / len;
    return { colorCoding, similarity };
}
function handleSetLabAutoBuy(payload) {
    const { playerId, autoBuy } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    if (player.labAutoBuy !== autoBuy) {
        player.labAutoBuy = autoBuy;
        gameState_1.gameState.setPlayer(playerId, player);
        broadcastGameState();
    }
}
function handleLabExperiment(clientId, payload) {
    const { playerId, sequence } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return { success: false, reason: 'insufficient_resources' };
    // 1. Check & deduct resources (with optional auto-buy)
    const cost = {};
    for (const resId of sequence) {
        cost[resId] = (cost[resId] ?? 0) + 1;
    }
    // Determine which resources are missing
    const missing = {};
    for (const [resId, needed] of Object.entries(cost)) {
        const have = player.resources[resId] ?? 0;
        if (have < needed) {
            missing[resId] = needed - Math.floor(have);
        }
    }
    if (Object.keys(missing).length > 0) {
        if (!player.labAutoBuy || (0, productionGoodUtils_1.getActiveBonus)(player, 'auto_buy') <= 0) {
            return { success: false, reason: 'insufficient_resources' };
        }
        // Try to auto-buy missing resources from market
        const market = gameState_1.gameState.getMarket();
        let totalAutoBuyCost = 0;
        const buyPlan = [];
        for (const [resId, amount] of Object.entries(missing)) {
            const entry = market.resources[resId];
            if (!entry || Math.floor(entry.supply) < amount) {
                return { success: false, reason: 'insufficient_resources' };
            }
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
        if (player.cash < totalAutoBuyCost) {
            return { success: false, reason: 'insufficient_resources' };
        }
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
    // 2. Determine tier from sequence length: length = tier + 2
    const tier = sequence.length - 2;
    // 3. Filter candidate recipes: same tier, not yet known
    const knownSet = new Set(player.knownRecipes);
    const candidates = gameState_1.gameState.getRecipes().filter(r => r.tier === tier && !knownSet.has(r.id));
    if (candidates.length === 0) {
        const coding = sequence.map(() => 'red');
        player.labHistory.push({
            sequence: [...sequence],
            colorCoding: coding,
            similarity: 0,
            match: false,
        });
        gameState_1.gameState.setPlayer(playerId, player);
        broadcastGameState();
        return {
            success: true,
            match: false,
            colorCoding: coding,
            similarity: 0,
        };
    }
    // 4. Find best match
    let bestSimilarity = -1;
    let bestCoding = [];
    let bestRecipeId = null;
    for (const recipe of candidates) {
        const { colorCoding, similarity } = computeWordle(sequence, recipe.sequence);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCoding = colorCoding;
            bestRecipeId = recipe.id;
        }
    }
    // 5. If perfect match, unlock recipe
    const isMatch = bestSimilarity === 1;
    let unlockedRecipe;
    if (isMatch && bestRecipeId) {
        player.knownRecipes.push(bestRecipeId);
        unlockedRecipe = gameState_1.gameState.getRecipes().find(r => r.id === bestRecipeId);
    }
    // 6. Save to history
    const historyEntry = {
        sequence: [...sequence],
        colorCoding: bestCoding,
        similarity: bestSimilarity,
        match: isMatch,
        recipeId: isMatch ? bestRecipeId ?? undefined : undefined,
    };
    player.labHistory.push(historyEntry);
    // Find the best-matching recipe for bonus calculations
    const bestRecipe = bestRecipeId ? gameState_1.gameState.getRecipes().find(r => r.id === bestRecipeId) : null;
    // Alphabetical hints for red slots (always active, no bonus needed)
    let alphabeticalHints;
    if (bestRecipe && !isMatch) {
        const resMap = new Map(gameState_1.gameState.getResources().map(r => [r.id, r.name]));
        alphabeticalHints = bestCoding.map((color, i) => {
            if (color !== 'red')
                return null;
            const guessName = resMap.get(sequence[i]) ?? '';
            const targetName = resMap.get(bestRecipe.sequence[i]) ?? '';
            if (!guessName || !targetName || guessName === targetName)
                return null;
            return targetName.localeCompare(guessName) < 0 ? 'up' : 'down';
        });
        historyEntry.alphabeticalHints = alphabeticalHints;
    }
    // Build result with production good bonuses
    const result = {
        success: true,
        match: isMatch,
        recipeUnlocked: unlockedRecipe,
        colorCoding: bestCoding,
        similarity: bestSimilarity,
        alphabeticalHints,
    };
    // Notizbuch bonus: show count of distinct resources in target recipe
    if ((0, productionGoodUtils_1.getActiveBonus)(player, 'lab_distinct_count') > 0 && bestRecipe) {
        const count = new Set(bestRecipe.sequence).size;
        result.distinctResourceCount = count;
        historyEntry.distinctResourceCount = count;
        (0, productionGoodUtils_1.applyWear)(player, 'lab_distinct_count');
    }
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
    // Mikroskop bonus: direction hints for yellow results
    if ((0, productionGoodUtils_1.getActiveBonus)(player, 'lab_direction') > 0 && bestRecipe && bestCoding) {
        const hints = bestCoding.map((color, i) => {
            if (color !== 'yellow')
                return null;
            // Find where this resource actually is in the target
            const targetIdx = bestRecipe.sequence.indexOf(sequence[i]);
            if (targetIdx === -1)
                return null;
            return targetIdx < i ? 'left' : 'right';
        });
        result.directionHints = hints;
        historyEntry.directionHints = hints;
        (0, productionGoodUtils_1.applyWear)(player, 'lab_direction');
    }
    // Spektrometer bonus: show which resources are NOT in the target recipe
    if ((0, productionGoodUtils_1.getActiveBonus)(player, 'lab_exclusion') > 0 && bestRecipe) {
        const targetSet = new Set(bestRecipe.sequence);
        const allResources = gameState_1.gameState.getResources().map(r => r.id);
        result.excludedResources = allResources.filter(id => !targetSet.has(id));
        (0, productionGoodUtils_1.applyWear)(player, 'lab_exclusion');
    }
    return result;
}
//# sourceMappingURL=labHandler.js.map