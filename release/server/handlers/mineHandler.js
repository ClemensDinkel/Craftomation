"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAddPlayer = handleAddPlayer;
exports.handleBoostMinePlayer = handleBoostMinePlayer;
exports.handleChangeMineResource = handleChangeMineResource;
const uuid_1 = require("uuid");
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const wsServer_1 = require("../websocket/wsServer");
const BOOST_DURATION_MS = 30000; // 30 seconds
const BOOST_COOLDOWN_MS = 120000; // 2 minutes
function createDefaultPlayer(name) {
    return {
        id: (0, uuid_1.v4)(),
        name,
        resources: {},
        consumables: {},
        productionGoods: {},
        knownRecipes: [],
        patents: [],
        cash: 0,
        mineResources: [],
        mineResourceIndex: 0,
        mineBoostUntil: null,
        mineBoostCooldownUntil: null,
        nextMineProductionAt: 0,
        nextMineWearAt: 0,
        nextMarketInfoWearAt: 0,
        manufacturingQueue: [],
        labHistory: [],
        labAutoBuy: false,
        autoTradeRules: [],
    };
}
function broadcastGameState() {
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.GAME_STATE_UPDATE,
        payload: gameState_1.gameState.toJSON(),
    });
}
function handleAddPlayer(payload) {
    const { playerName } = payload;
    if (!playerName?.trim())
        return;
    const player = createDefaultPlayer(playerName.trim());
    gameState_1.gameState.setPlayer(player.id, player);
    broadcastGameState();
}
function handleBoostMinePlayer(payload) {
    const { playerId } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const now = Date.now();
    // Can't boost during cooldown
    if (player.mineBoostCooldownUntil && now < player.mineBoostCooldownUntil)
        return;
    // Can't boost if already boosted
    if (player.mineBoostUntil && now < player.mineBoostUntil)
        return;
    gameState_1.gameState.setPlayer(playerId, {
        ...player,
        mineBoostUntil: now + BOOST_DURATION_MS,
        mineBoostCooldownUntil: now + BOOST_DURATION_MS + BOOST_COOLDOWN_MS,
    });
    broadcastGameState();
}
function handleChangeMineResource(payload) {
    const { playerId, resourceIds } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    gameState_1.gameState.setPlayer(playerId, {
        ...player,
        mineResources: resourceIds,
        mineResourceIndex: 0,
        nextMineProductionAt: 0,
        nextMineWearAt: 0,
    });
    broadcastGameState();
}
//# sourceMappingURL=mineHandler.js.map