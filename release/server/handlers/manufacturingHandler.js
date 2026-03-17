"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAddManufacturingJob = handleAddManufacturingJob;
exports.handleRemoveManufacturingJob = handleRemoveManufacturingJob;
exports.handleSetManufacturingAutoBuy = handleSetManufacturingAutoBuy;
exports.handleDebugUnlockRecipe = handleDebugUnlockRecipe;
const uuid_1 = require("uuid");
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const wsServer_1 = require("../websocket/wsServer");
const gameLoop_1 = require("../game/gameLoop");
const productionGoodUtils_1 = require("../game/productionGoodUtils");
// Crafting durations in ms per tier (consumable)
const CRAFTING_DURATION_MS = {
    1: 30000,
    2: 40000,
    3: 50000,
    4: 60000,
};
// Crafting durations in ms per tier (production goods — longer)
const CRAFTING_DURATION_PRODUCTION_GOOD_MS = {
    1: 60000,
    2: 80000,
    3: 100000,
    4: 120000,
};
function broadcastGameState() {
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.GAME_STATE_UPDATE,
        payload: gameState_1.gameState.toJSON(),
    });
}
function handleAddManufacturingJob(payload) {
    const { playerId, recipeId, repeat, autoBuy } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === recipeId);
    if (!recipe)
        return;
    // Player must know this recipe
    if (!player.knownRecipes.includes(recipeId))
        return;
    const config = gameState_1.gameState.getConfig();
    const speed = config?.gameSpeed ?? 1.0;
    const baseDuration = recipe.type === 'production_good'
        ? (CRAFTING_DURATION_PRODUCTION_GOOD_MS[recipe.tier] ?? 60000)
        : (CRAFTING_DURATION_MS[recipe.tier] ?? 30000);
    const craftSpeedBonus = (0, productionGoodUtils_1.getActiveBonus)(player, 'craft_speed'); // 0, 25, 40, 55, or 60
    const speedReduction = 1 - craftSpeedBonus / 100;
    const duration = Math.round(baseDuration * speedReduction / Math.max(speed, 0.1));
    const job = {
        id: (0, uuid_1.v4)(),
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
        (0, gameLoop_1.tryStartJob)(player, speed);
    }
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
}
function handleRemoveManufacturingJob(payload) {
    const { playerId, jobIndex } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    if (jobIndex < 0 || jobIndex >= player.manufacturingQueue.length)
        return;
    player.manufacturingQueue.splice(jobIndex, 1);
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
}
function handleSetManufacturingAutoBuy(payload) {
    const { playerId, autoBuy } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
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
            const config = gameState_1.gameState.getConfig();
            const speed = config?.gameSpeed ?? 1.0;
            (0, gameLoop_1.tryStartJob)(player, speed);
        }
        gameState_1.gameState.setPlayer(playerId, player);
        broadcastGameState();
    }
}
function handleDebugUnlockRecipe(payload) {
    const { playerId, recipeId } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === recipeId);
    if (!recipe)
        return;
    if (!player.knownRecipes.includes(recipeId)) {
        player.knownRecipes.push(recipeId);
        gameState_1.gameState.setPlayer(playerId, player);
        broadcastGameState();
    }
}
//# sourceMappingURL=manufacturingHandler.js.map