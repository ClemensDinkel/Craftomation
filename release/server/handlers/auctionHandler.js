"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMarketBuy = handleMarketBuy;
exports.handleMarketSell = handleMarketSell;
exports.handleListRecipe = handleListRecipe;
exports.handleBuyRecipe = handleBuyRecipe;
exports.handleBuyMiningRight = handleBuyMiningRight;
exports.handleSetAutoTradeRule = handleSetAutoTradeRule;
exports.handleRemoveAutoTradeRule = handleRemoveAutoTradeRule;
exports.handleDebugSetInventory = handleDebugSetInventory;
const uuid_1 = require("uuid");
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const wsServer_1 = require("../websocket/wsServer");
const productionGoodUtils_1 = require("../game/productionGoodUtils");
const marketConstants_1 = require("../game/marketConstants");
const MINING_RIGHT_PRICE_MULTIPLIER = 20;
const MINING_RIGHT_OVERBID_MULTIPLIER = 1.5;
const MINING_RIGHT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MINING_RIGHT_SLOTS_PER_PLAYERS = 10; // 1 slot per N players, min 1
function broadcastGameState() {
    (0, wsServer_1.broadcast)({
        type: shared_1.WSMessageType.GAME_STATE_UPDATE,
        payload: gameState_1.gameState.toJSON(),
    });
}
function sendError(clientId, message) {
    (0, wsServer_1.sendTo)(clientId, { type: shared_1.WSMessageType.ERROR, payload: { message } });
}
const SPREAD = 0.025; // 2.5% bid/ask spread
/** Recalculate price for a market entry after supply changed.
 *  Resources & consumables: exponential decay  price = basePrice * maxMultiplier^(1 - supply/refSupply)
 *    → smooth curve from maxPrice (supply=0) to basePrice (supply=refSupply)
 *  Production goods: sqrt curve (flatter scaling at low supply)
 */
function recalcPrice(entry, basePrice, refSupply) {
    const exponent = Math.min(1, 1 - entry.supply / refSupply);
    const raw = basePrice * Math.pow(marketConstants_1.MAX_PRICE_MULTIPLIER, exponent);
    entry.price = Math.max(1, Math.round(raw * 100) / 100);
}
/** Buy price = market price + spread */
function buyPrice(price) {
    return Math.round(price * (1 + SPREAD) * 100) / 100;
}
/** Sell price = market price - spread */
function sellPrice(price) {
    return Math.round(price * (1 - SPREAD) * 100) / 100;
}
function handleMarketBuy(clientId, payload) {
    const { playerId, itemId, itemType, amount } = payload;
    if (amount <= 0)
        return;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const market = gameState_1.gameState.getMarket();
    const entries = itemType === 'resource'
        ? market.resources
        : itemType === 'production_good'
            ? market.productionGoods
            : market.consumables;
    const entry = entries[itemId];
    if (!entry)
        return;
    // Check if enough supply is available
    const actualAmount = Math.min(amount, Math.floor(entry.supply));
    if (actualAmount <= 0) {
        sendError(clientId, 'Out of stock');
        return;
    }
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === itemId);
    const tier = recipe?.tier ?? 1;
    const basePrice = itemType === 'resource'
        ? marketConstants_1.RESOURCE_BASE_PRICE
        : itemType === 'production_good'
            ? (marketConstants_1.PRODUCTION_GOOD_BASE_PRICES[tier] ?? 15)
            : (marketConstants_1.BASE_PRICES[tier] ?? 12);
    const refSupply = itemType === 'resource'
        ? marketConstants_1.RESOURCE_REFERENCE_SUPPLY
        : itemType === 'production_good'
            ? marketConstants_1.PRODUCTION_GOOD_REFERENCE_SUPPLY
            : marketConstants_1.CONSUMABLE_REFERENCE_SUPPLY;
    // Calculate total cost unit by unit with price recalc (buy at ask price)
    let totalCost = 0;
    for (let i = 0; i < actualAmount; i++) {
        totalCost += buyPrice(entry.price);
        entry.supply = Math.max(0, entry.supply - 1);
        recalcPrice(entry, basePrice, refSupply);
    }
    totalCost = Math.round(totalCost * 100) / 100;
    if (player.cash < totalCost) {
        // Rollback supply change
        entry.supply += actualAmount;
        recalcPrice(entry, basePrice, refSupply);
        sendError(clientId, 'Not enough cash');
        return;
    }
    player.cash = Math.round((player.cash - totalCost) * 100) / 100;
    if (itemType === 'production_good') {
        // Add as ActiveProductionGood
        const def = (0, productionGoodUtils_1.getDefinition)(itemId);
        if (def) {
            if (!player.productionGoods[itemId]) {
                player.productionGoods[itemId] = [];
            }
            for (let i = 0; i < actualAmount; i++) {
                player.productionGoods[itemId].push({
                    itemId,
                    wearRemaining: def.wearUses,
                    isUsed: false,
                });
                (0, productionGoodUtils_1.activateProductionGood)(player, itemId);
            }
        }
    }
    else {
        const inventory = itemType === 'resource' ? player.resources : player.consumables;
        inventory[itemId] = (inventory[itemId] ?? 0) + actualAmount;
    }
    gameState_1.gameState.setPlayer(playerId, player);
    gameState_1.gameState.setMarket(market);
    broadcastGameState();
}
function handleMarketSell(clientId, payload) {
    const { playerId, itemId, itemType, amount } = payload;
    if (amount <= 0)
        return;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const market = gameState_1.gameState.getMarket();
    const entries = itemType === 'resource'
        ? market.resources
        : itemType === 'production_good'
            ? market.productionGoods
            : market.consumables;
    const entry = entries[itemId];
    if (!entry)
        return;
    // For production goods: only unused items can be sold
    if (itemType === 'production_good') {
        const items = player.productionGoods[itemId] ?? [];
        const unusedCount = items.filter(i => !i.isUsed).length;
        if (unusedCount < amount) {
            sendError(clientId, 'Not enough unused items to sell');
            return;
        }
    }
    else {
        const inventory = itemType === 'resource' ? player.resources : player.consumables;
        const owned = Math.floor(inventory[itemId] ?? 0);
        if (owned < amount) {
            sendError(clientId, 'Not enough items');
            return;
        }
    }
    const recipe = gameState_1.gameState.getRecipes().find(r => r.id === itemId);
    const tier = recipe?.tier ?? 1;
    const isResource = itemType === 'resource';
    const basePrice = isResource
        ? marketConstants_1.RESOURCE_BASE_PRICE
        : itemType === 'production_good'
            ? (marketConstants_1.PRODUCTION_GOOD_BASE_PRICES[tier] ?? 15)
            : (marketConstants_1.BASE_PRICES[tier] ?? 12);
    const refSupply = isResource
        ? marketConstants_1.RESOURCE_REFERENCE_SUPPLY
        : itemType === 'production_good'
            ? marketConstants_1.PRODUCTION_GOOD_REFERENCE_SUPPLY
            : marketConstants_1.CONSUMABLE_REFERENCE_SUPPLY;
    // Activate consumption for consumables on first sale (tier-dependent)
    if (itemType === 'consumable' && entry.baseConsumptionRate === 0) {
        const config = gameState_1.gameState.getConfig();
        const playerCount = config?.playerCount ?? 4;
        const tierFactor = {
            1: 0.2,
            2: 0.15,
            3: 0.1,
            4: 0.07,
        };
        const factor = tierFactor[tier] ?? 0.3;
        entry.baseConsumptionRate = playerCount * factor;
    }
    // Calculate total revenue unit by unit with price recalc (sell at bid price)
    let totalRevenue = 0;
    for (let i = 0; i < amount; i++) {
        entry.supply += 1;
        recalcPrice(entry, basePrice, refSupply);
        totalRevenue += sellPrice(entry.price);
    }
    totalRevenue = Math.round(totalRevenue * 100) / 100;
    // Remove items from inventory
    if (itemType === 'production_good') {
        const items = player.productionGoods[itemId] ?? [];
        let removed = 0;
        player.productionGoods[itemId] = items.filter(i => {
            if (removed >= amount)
                return true;
            if (!i.isUsed) {
                removed++;
                return false;
            }
            return true;
        });
        if (player.productionGoods[itemId].length === 0) {
            delete player.productionGoods[itemId];
        }
    }
    else {
        const inventory = isResource ? player.resources : player.consumables;
        inventory[itemId] = (inventory[itemId] ?? 0) - amount;
    }
    player.cash = Math.round((player.cash + totalRevenue) * 100) / 100;
    gameState_1.gameState.setPlayer(playerId, player);
    gameState_1.gameState.setMarket(market);
    broadcastGameState();
}
function handleListRecipe(clientId, payload) {
    const { playerId, recipeId, price } = payload;
    if (price <= 0)
        return;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    if (!player.knownRecipes.includes(recipeId))
        return;
    const market = gameState_1.gameState.getMarket();
    // Prevent duplicate listings for same recipe by same seller
    const alreadyListed = market.recipeListings.some(l => l.recipeId === recipeId && l.sellerId === playerId);
    if (alreadyListed)
        return;
    market.recipeListings.push({
        id: (0, uuid_1.v4)(),
        recipeId,
        sellerId: playerId,
        price: Math.round(price * 100) / 100,
    });
    gameState_1.gameState.setMarket(market);
    broadcastGameState();
}
function handleBuyRecipe(clientId, payload) {
    const { buyerPlayerId, listingId } = payload;
    const buyer = gameState_1.gameState.getPlayer(buyerPlayerId);
    if (!buyer)
        return;
    const market = gameState_1.gameState.getMarket();
    const listingIndex = market.recipeListings.findIndex(l => l.id === listingId);
    if (listingIndex === -1)
        return;
    const listing = market.recipeListings[listingIndex];
    // Can't buy own listing
    if (listing.sellerId === buyerPlayerId)
        return;
    // Already knows recipe
    if (buyer.knownRecipes.includes(listing.recipeId))
        return;
    if (buyer.cash < listing.price) {
        sendError(clientId, 'Not enough cash');
        return;
    }
    // Transfer cash
    buyer.cash = Math.round((buyer.cash - listing.price) * 100) / 100;
    buyer.knownRecipes.push(listing.recipeId);
    const seller = gameState_1.gameState.getPlayer(listing.sellerId);
    if (seller) {
        seller.cash = Math.round((seller.cash + listing.price) * 100) / 100;
        gameState_1.gameState.setPlayer(seller.id, seller);
    }
    // Remove listing
    market.recipeListings.splice(listingIndex, 1);
    gameState_1.gameState.setPlayer(buyerPlayerId, buyer);
    gameState_1.gameState.setMarket(market);
    broadcastGameState();
}
function getMaxRightSlots() {
    const config = gameState_1.gameState.getConfig();
    const playerCount = config?.playerCount ?? 4;
    return Math.max(1, Math.floor(playerCount / MINING_RIGHT_SLOTS_PER_PLAYERS));
}
function handleBuyMiningRight(clientId, payload) {
    const { playerId, resourceId } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const market = gameState_1.gameState.getMarket();
    const resourceEntry = market.resources[resourceId];
    if (!resourceEntry)
        return;
    const now = Date.now();
    const maxSlots = getMaxRightSlots();
    // Clean expired rights for this resource
    const rights = (market.miningRights[resourceId] ?? []).filter(r => now < r.expiresAt);
    market.miningRights[resourceId] = rights;
    // Player already holds a right for this resource
    if (rights.some(r => r.holderId === playerId))
        return;
    if (rights.length < maxSlots) {
        // Open slot: buy at base price
        const price = Math.round(resourceEntry.price * MINING_RIGHT_PRICE_MULTIPLIER * 100) / 100;
        if (player.cash < price) {
            sendError(clientId, 'Not enough cash');
            return;
        }
        player.cash = Math.round((player.cash - price) * 100) / 100;
        rights.push({
            id: (0, uuid_1.v4)(),
            resourceId,
            holderId: playerId,
            pricePaid: price,
            expiresAt: now + MINING_RIGHT_DURATION_MS,
        });
    }
    else {
        // All slots full: overbid the cheapest holder
        const cheapest = rights.reduce((min, r) => r.pricePaid < min.pricePaid ? r : min, rights[0]);
        const overbidPrice = Math.round(cheapest.pricePaid * MINING_RIGHT_OVERBID_MULTIPLIER * 100) / 100;
        if (player.cash < overbidPrice) {
            sendError(clientId, 'Not enough cash');
            return;
        }
        // Refund old holder
        const oldHolder = gameState_1.gameState.getPlayer(cheapest.holderId);
        if (oldHolder) {
            oldHolder.cash = Math.round((oldHolder.cash + cheapest.pricePaid) * 100) / 100;
            gameState_1.gameState.setPlayer(oldHolder.id, oldHolder);
        }
        player.cash = Math.round((player.cash - overbidPrice) * 100) / 100;
        // Replace cheapest with new right
        const idx = rights.indexOf(cheapest);
        rights[idx] = {
            id: (0, uuid_1.v4)(),
            resourceId,
            holderId: playerId,
            pricePaid: overbidPrice,
            expiresAt: now + MINING_RIGHT_DURATION_MS,
        };
    }
    market.miningRights[resourceId] = rights;
    gameState_1.gameState.setPlayer(playerId, player);
    gameState_1.gameState.setMarket(market);
    broadcastGameState();
}
function handleSetAutoTradeRule(clientId, payload) {
    const { playerId, rule } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    // Require active auto_trade production good
    if ((0, productionGoodUtils_1.getActiveBonus)(player, 'auto_trade') <= 0) {
        sendError(clientId, 'No Trade Bot active');
        return;
    }
    if (!player.autoTradeRules)
        player.autoTradeRules = [];
    if (rule.id) {
        // Update existing rule
        const idx = player.autoTradeRules.findIndex(r => r.id === rule.id);
        if (idx !== -1) {
            player.autoTradeRules[idx] = { ...rule, id: rule.id };
        }
    }
    else {
        // Add new rule (max 10 rules)
        if (player.autoTradeRules.length >= 10) {
            sendError(clientId, 'Max 10 rules');
            return;
        }
        player.autoTradeRules.push({
            id: (0, uuid_1.v4)(),
            itemId: rule.itemId,
            itemType: rule.itemType,
            buyBelowPrice: rule.buyBelowPrice,
            sellAbovePrice: rule.sellAbovePrice,
        });
    }
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
}
function handleRemoveAutoTradeRule(clientId, payload) {
    const { playerId, ruleId } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    if (!player.autoTradeRules)
        return;
    player.autoTradeRules = player.autoTradeRules.filter(r => r.id !== ruleId);
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
}
function handleDebugSetInventory(payload) {
    const { playerId, itemId, itemType, amount } = payload;
    const player = gameState_1.gameState.getPlayer(playerId);
    if (!player)
        return;
    const value = Math.max(0, Math.floor(amount));
    switch (itemType) {
        case 'resource':
            player.resources[itemId] = value;
            break;
        case 'consumable':
            player.consumables[itemId] = value;
            break;
        case 'production_good': {
            const current = player.productionGoods[itemId] ?? [];
            const unusedCount = current.filter(g => !g.isUsed).length;
            const usedItems = current.filter(g => g.isUsed);
            const targetUnused = Math.max(0, value - usedItems.length);
            const currentUnused = current.filter(g => !g.isUsed);
            if (targetUnused > unusedCount) {
                // Add more unused items
                const def = (0, productionGoodUtils_1.getDefinition)(itemId);
                const wear = def?.wearUses ?? 10;
                for (let i = 0; i < targetUnused - unusedCount; i++) {
                    currentUnused.push({ itemId, wearRemaining: wear, isUsed: false });
                }
                player.productionGoods[itemId] = [...usedItems, ...currentUnused];
                (0, productionGoodUtils_1.activateProductionGood)(player, itemId);
            }
            else if (targetUnused < unusedCount) {
                // Remove unused items from the end
                const kept = currentUnused.slice(0, targetUnused);
                player.productionGoods[itemId] = [...usedItems, ...kept];
            }
            break;
        }
        case 'cash':
            player.cash = Math.max(0, amount);
            break;
    }
    gameState_1.gameState.setPlayer(playerId, player);
    broadcastGameState();
}
//# sourceMappingURL=auctionHandler.js.map