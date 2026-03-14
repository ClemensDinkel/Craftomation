import { v4 as uuidv4 } from 'uuid';
import { MarketEntry, WSMessageType, type AutoTradeRule } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast, sendTo } from '../websocket/wsServer';
import { activateProductionGood, getDefinition, getActiveBonus } from '../game/productionGoodUtils';

const RESOURCE_REFERENCE_SUPPLY = 100;
const CONSUMABLE_REFERENCE_SUPPLY = 15;
const RESOURCE_BASE_PRICE = 5;
const BASE_PRICES: Record<number, number> = { 1: 12, 2: 20, 3: 32, 4: 50 };

const MINING_RIGHT_PRICE_MULTIPLIER = 20;
const MINING_RIGHT_OVERBID_MULTIPLIER = 1.5;
const MINING_RIGHT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MINING_RIGHT_SLOTS_PER_PLAYERS = 10; // 1 slot per N players, min 1

function broadcastGameState(): void {
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

function sendError(clientId: string, message: string): void {
  sendTo(clientId, { type: WSMessageType.ERROR, payload: { message } });
}

const SPREAD = 0.025; // 2.5% bid/ask spread

/** Recalculate price for a market entry after supply changed. */
function recalcPrice(entry: MarketEntry, basePrice: number, refSupply: number, maxMultiplier: number = 10, useSqrt: boolean = false): void {
  // Use floored supply for price calculation so displayed price matches displayed supply
  const ratio = refSupply / Math.max(Math.floor(entry.supply), 1);
  // sqrt curve for production goods: flatter price scaling (±~8 per unit instead of ±30)
  const raw = useSqrt ? basePrice * Math.sqrt(ratio) : basePrice * ratio;
  entry.price = Math.min(basePrice * maxMultiplier, Math.max(1, Math.round(raw * 100) / 100));
}

/** Buy price = market price + spread */
function buyPrice(price: number): number {
  return Math.round(price * (1 + SPREAD) * 100) / 100;
}

/** Sell price = market price - spread */
function sellPrice(price: number): number {
  return Math.round(price * (1 - SPREAD) * 100) / 100;
}

const PRODUCTION_GOOD_BASE_PRICES: Record<number, number> = { 1: 15, 2: 30, 3: 60, 4: 120 };
const PRODUCTION_GOOD_REFERENCE_SUPPLY = 10;

export function handleMarketBuy(
  clientId: string,
  payload: { playerId: string; itemId: string; itemType: 'resource' | 'consumable' | 'production_good'; amount: number },
): void {
  const { playerId, itemId, itemType, amount } = payload;
  if (amount <= 0) return;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const market = gameState.getMarket();
  const entries = itemType === 'resource'
    ? market.resources
    : itemType === 'production_good'
      ? market.productionGoods
      : market.consumables;
  const entry = entries[itemId];
  if (!entry) return;

  // Check if enough supply is available
  const actualAmount = Math.min(amount, Math.floor(entry.supply));
  if (actualAmount <= 0) {
    sendError(clientId, 'Out of stock');
    return;
  }

  const recipe = gameState.getRecipes().find(r => r.id === itemId);
  const tier = recipe?.tier ?? 1;
  const basePrice = itemType === 'resource'
    ? RESOURCE_BASE_PRICE
    : itemType === 'production_good'
      ? (PRODUCTION_GOOD_BASE_PRICES[tier] ?? 15)
      : (BASE_PRICES[tier] ?? 12);
  const refSupply = itemType === 'resource'
    ? RESOURCE_REFERENCE_SUPPLY
    : itemType === 'production_good'
      ? PRODUCTION_GOOD_REFERENCE_SUPPLY
      : CONSUMABLE_REFERENCE_SUPPLY;
  const isPg = itemType === 'production_good';

  // Calculate total cost unit by unit with price recalc (buy at ask price)
  let totalCost = 0;
  for (let i = 0; i < actualAmount; i++) {
    totalCost += buyPrice(entry.price);
    entry.supply = Math.max(0, entry.supply - 1);
    recalcPrice(entry, basePrice, refSupply, 10, isPg);
  }
  totalCost = Math.round(totalCost * 100) / 100;

  if (player.cash < totalCost) {
    // Rollback supply change
    entry.supply += actualAmount;
    recalcPrice(entry, basePrice, refSupply, 10, isPg);
    sendError(clientId, 'Not enough cash');
    return;
  }

  player.cash = Math.round((player.cash - totalCost) * 100) / 100;

  if (itemType === 'production_good') {
    // Add as ActiveProductionGood
    const def = getDefinition(itemId);
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
        activateProductionGood(player, itemId);
      }
    }
  } else {
    const inventory = itemType === 'resource' ? player.resources : player.consumables;
    inventory[itemId] = (inventory[itemId] ?? 0) + actualAmount;
  }

  gameState.setPlayer(playerId, player);
  gameState.setMarket(market);
  broadcastGameState();
}

export function handleMarketSell(
  clientId: string,
  payload: { playerId: string; itemId: string; itemType: 'resource' | 'consumable' | 'production_good'; amount: number },
): void {
  const { playerId, itemId, itemType, amount } = payload;
  if (amount <= 0) return;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const market = gameState.getMarket();
  const entries = itemType === 'resource'
    ? market.resources
    : itemType === 'production_good'
      ? market.productionGoods
      : market.consumables;
  const entry = entries[itemId];
  if (!entry) return;

  // For production goods: only unused items can be sold
  if (itemType === 'production_good') {
    const items = player.productionGoods[itemId] ?? [];
    const unusedCount = items.filter(i => !i.isUsed).length;
    if (unusedCount < amount) {
      sendError(clientId, 'Not enough unused items to sell');
      return;
    }
  } else {
    const inventory = itemType === 'resource' ? player.resources : player.consumables;
    const owned = Math.floor(inventory[itemId] ?? 0);
    if (owned < amount) {
      sendError(clientId, 'Not enough items');
      return;
    }
  }

  const recipe = gameState.getRecipes().find(r => r.id === itemId);
  const tier = recipe?.tier ?? 1;
  const isResource = itemType === 'resource';
  const basePrice = isResource
    ? RESOURCE_BASE_PRICE
    : itemType === 'production_good'
      ? (PRODUCTION_GOOD_BASE_PRICES[tier] ?? 15)
      : (BASE_PRICES[tier] ?? 12);
  const refSupply = isResource
    ? RESOURCE_REFERENCE_SUPPLY
    : itemType === 'production_good'
      ? PRODUCTION_GOOD_REFERENCE_SUPPLY
      : CONSUMABLE_REFERENCE_SUPPLY;

  // Activate consumption for consumables on first sale (tier-dependent)
  if (itemType === 'consumable' && entry.baseConsumptionRate === 0) {
    const config = gameState.getConfig();
    const playerCount = config?.playerCount ?? 4;
    const tierFactor: Record<number, number> = {
      1: 0.3,
      2: 0.2,
      3: 0.15,
      4: 0.1,
    };
    const factor = tierFactor[tier] ?? 0.3;
    entry.baseConsumptionRate = playerCount * factor;
  }

  const isPg = itemType === 'production_good';

  // Calculate total revenue unit by unit with price recalc (sell at bid price)
  let totalRevenue = 0;
  for (let i = 0; i < amount; i++) {
    entry.supply += 1;
    recalcPrice(entry, basePrice, refSupply, 10, isPg);
    totalRevenue += sellPrice(entry.price);
  }
  totalRevenue = Math.round(totalRevenue * 100) / 100;

  // Remove items from inventory
  if (itemType === 'production_good') {
    const items = player.productionGoods[itemId] ?? [];
    let removed = 0;
    player.productionGoods[itemId] = items.filter(i => {
      if (removed >= amount) return true;
      if (!i.isUsed) { removed++; return false; }
      return true;
    });
    if (player.productionGoods[itemId].length === 0) {
      delete player.productionGoods[itemId];
    }
  } else {
    const inventory = isResource ? player.resources : player.consumables;
    inventory[itemId] = (inventory[itemId] ?? 0) - amount;
  }

  player.cash = Math.round((player.cash + totalRevenue) * 100) / 100;

  gameState.setPlayer(playerId, player);
  gameState.setMarket(market);
  broadcastGameState();
}

export function handleListRecipe(
  clientId: string,
  payload: { playerId: string; recipeId: string; price: number },
): void {
  const { playerId, recipeId, price } = payload;
  if (price <= 0) return;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  if (!player.knownRecipes.includes(recipeId)) return;

  const market = gameState.getMarket();

  // Prevent duplicate listings for same recipe by same seller
  const alreadyListed = market.recipeListings.some(
    l => l.recipeId === recipeId && l.sellerId === playerId,
  );
  if (alreadyListed) return;

  market.recipeListings.push({
    id: uuidv4(),
    recipeId,
    sellerId: playerId,
    price: Math.round(price * 100) / 100,
  });

  gameState.setMarket(market);
  broadcastGameState();
}

export function handleBuyRecipe(
  clientId: string,
  payload: { buyerPlayerId: string; listingId: string },
): void {
  const { buyerPlayerId, listingId } = payload;

  const buyer = gameState.getPlayer(buyerPlayerId);
  if (!buyer) return;

  const market = gameState.getMarket();
  const listingIndex = market.recipeListings.findIndex(l => l.id === listingId);
  if (listingIndex === -1) return;

  const listing = market.recipeListings[listingIndex];

  // Can't buy own listing
  if (listing.sellerId === buyerPlayerId) return;

  // Already knows recipe
  if (buyer.knownRecipes.includes(listing.recipeId)) return;

  if (buyer.cash < listing.price) {
    sendError(clientId, 'Not enough cash');
    return;
  }

  // Transfer cash
  buyer.cash = Math.round((buyer.cash - listing.price) * 100) / 100;
  buyer.knownRecipes.push(listing.recipeId);

  const seller = gameState.getPlayer(listing.sellerId);
  if (seller) {
    seller.cash = Math.round((seller.cash + listing.price) * 100) / 100;
    gameState.setPlayer(seller.id, seller);
  }

  // Remove listing
  market.recipeListings.splice(listingIndex, 1);

  gameState.setPlayer(buyerPlayerId, buyer);
  gameState.setMarket(market);
  broadcastGameState();
}

function getMaxRightSlots(): number {
  const config = gameState.getConfig();
  const playerCount = config?.playerCount ?? 4;
  return Math.max(1, Math.floor(playerCount / MINING_RIGHT_SLOTS_PER_PLAYERS));
}

export function handleBuyMiningRight(
  clientId: string,
  payload: { playerId: string; resourceId: string },
): void {
  const { playerId, resourceId } = payload;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const market = gameState.getMarket();
  const resourceEntry = market.resources[resourceId];
  if (!resourceEntry) return;

  const now = Date.now();
  const maxSlots = getMaxRightSlots();

  // Clean expired rights for this resource
  const rights = (market.miningRights[resourceId] ?? []).filter(r => now < r.expiresAt);
  market.miningRights[resourceId] = rights;

  // Player already holds a right for this resource
  if (rights.some(r => r.holderId === playerId)) return;

  if (rights.length < maxSlots) {
    // Open slot: buy at base price
    const price = Math.round(resourceEntry.price * MINING_RIGHT_PRICE_MULTIPLIER * 100) / 100;

    if (player.cash < price) {
      sendError(clientId, 'Not enough cash');
      return;
    }

    player.cash = Math.round((player.cash - price) * 100) / 100;

    rights.push({
      id: uuidv4(),
      resourceId,
      holderId: playerId,
      pricePaid: price,
      expiresAt: now + MINING_RIGHT_DURATION_MS,
    });
  } else {
    // All slots full: overbid the cheapest holder
    const cheapest = rights.reduce((min, r) => r.pricePaid < min.pricePaid ? r : min, rights[0]);
    const overbidPrice = Math.round(cheapest.pricePaid * MINING_RIGHT_OVERBID_MULTIPLIER * 100) / 100;

    if (player.cash < overbidPrice) {
      sendError(clientId, 'Not enough cash');
      return;
    }

    // Refund old holder
    const oldHolder = gameState.getPlayer(cheapest.holderId);
    if (oldHolder) {
      oldHolder.cash = Math.round((oldHolder.cash + cheapest.pricePaid) * 100) / 100;
      gameState.setPlayer(oldHolder.id, oldHolder);
    }

    player.cash = Math.round((player.cash - overbidPrice) * 100) / 100;

    // Replace cheapest with new right
    const idx = rights.indexOf(cheapest);
    rights[idx] = {
      id: uuidv4(),
      resourceId,
      holderId: playerId,
      pricePaid: overbidPrice,
      expiresAt: now + MINING_RIGHT_DURATION_MS,
    };
  }

  market.miningRights[resourceId] = rights;
  gameState.setPlayer(playerId, player);
  gameState.setMarket(market);
  broadcastGameState();
}

export function handleSetAutoTradeRule(
  clientId: string,
  payload: { playerId: string; rule: Omit<AutoTradeRule, 'id'> & { id?: string } },
): void {
  const { playerId, rule } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  // Require active auto_trade production good
  if (getActiveBonus(player, 'auto_trade') <= 0) {
    sendError(clientId, 'No Trade Bot active');
    return;
  }

  if (!player.autoTradeRules) player.autoTradeRules = [];

  if (rule.id) {
    // Update existing rule
    const idx = player.autoTradeRules.findIndex(r => r.id === rule.id);
    if (idx !== -1) {
      player.autoTradeRules[idx] = { ...rule, id: rule.id } as AutoTradeRule;
    }
  } else {
    // Add new rule (max 10 rules)
    if (player.autoTradeRules.length >= 10) {
      sendError(clientId, 'Max 10 rules');
      return;
    }
    player.autoTradeRules.push({
      id: uuidv4(),
      itemId: rule.itemId,
      itemType: rule.itemType,
      buyBelowPrice: rule.buyBelowPrice,
      sellAbovePrice: rule.sellAbovePrice,
    });
  }

  gameState.setPlayer(playerId, player);
  broadcastGameState();
}

export function handleRemoveAutoTradeRule(
  clientId: string,
  payload: { playerId: string; ruleId: string },
): void {
  const { playerId, ruleId } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  if (!player.autoTradeRules) return;
  player.autoTradeRules = player.autoTradeRules.filter(r => r.id !== ruleId);

  gameState.setPlayer(playerId, player);
  broadcastGameState();
}
