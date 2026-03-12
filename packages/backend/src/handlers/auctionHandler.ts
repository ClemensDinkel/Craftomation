import { v4 as uuidv4 } from 'uuid';
import { MarketEntry, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast, sendTo } from '../websocket/wsServer';

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
function recalcPrice(entry: MarketEntry, basePrice: number, refSupply: number, maxMultiplier: number = 10): void {
  const raw = basePrice * (refSupply / Math.max(entry.supply, 1));
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

export function handleMarketBuy(
  clientId: string,
  payload: { playerId: string; itemId: string; itemType: 'resource' | 'consumable'; amount: number },
): void {
  const { playerId, itemId, itemType, amount } = payload;
  if (amount <= 0) return;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const market = gameState.getMarket();
  const entries = itemType === 'resource' ? market.resources : market.consumables;
  const entry = entries[itemId];
  if (!entry) return;

  const isResource = itemType === 'resource';
  const basePrice = isResource ? RESOURCE_BASE_PRICE : (BASE_PRICES[gameState.getRecipes().find(r => r.id === itemId)?.tier ?? 1] ?? 12);
  const refSupply = isResource ? RESOURCE_REFERENCE_SUPPLY : CONSUMABLE_REFERENCE_SUPPLY;

  // Calculate total cost unit by unit with price recalc (buy at ask price)
  let totalCost = 0;
  for (let i = 0; i < amount; i++) {
    totalCost += buyPrice(entry.price);
    entry.supply = Math.max(0, entry.supply - 1);
    recalcPrice(entry, basePrice, refSupply);
  }
  totalCost = Math.round(totalCost * 100) / 100;

  if (player.cash < totalCost) {
    // Rollback supply change
    entry.supply += amount;
    recalcPrice(entry, basePrice, refSupply);
    sendError(clientId, 'Not enough cash');
    return;
  }

  player.cash = Math.round((player.cash - totalCost) * 100) / 100;

  const inventory = isResource ? player.resources : player.consumables;
  inventory[itemId] = (inventory[itemId] ?? 0) + amount;

  gameState.setPlayer(playerId, player);
  gameState.setMarket(market);
  broadcastGameState();
}

export function handleMarketSell(
  clientId: string,
  payload: { playerId: string; itemId: string; itemType: 'resource' | 'consumable'; amount: number },
): void {
  const { playerId, itemId, itemType, amount } = payload;
  if (amount <= 0) return;

  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const market = gameState.getMarket();
  const entries = itemType === 'resource' ? market.resources : market.consumables;
  const entry = entries[itemId];
  if (!entry) return;

  const inventory = itemType === 'resource' ? player.resources : player.consumables;
  const owned = Math.floor(inventory[itemId] ?? 0);
  if (owned < amount) {
    sendError(clientId, 'Not enough items');
    return;
  }

  const isResource = itemType === 'resource';
  const basePrice = isResource ? RESOURCE_BASE_PRICE : (BASE_PRICES[gameState.getRecipes().find(r => r.id === itemId)?.tier ?? 1] ?? 12);
  const refSupply = isResource ? RESOURCE_REFERENCE_SUPPLY : CONSUMABLE_REFERENCE_SUPPLY;

  // Activate consumption for consumables on first sale (tier-dependent)
  if (!isResource && entry.baseConsumptionRate === 0) {
    const config = gameState.getConfig();
    const playerCount = config?.playerCount ?? 4;
    const recipe = gameState.getRecipes().find(r => r.id === itemId);
    const tierFactor: Record<number, number> = {
      1: 0.5,   // high turnover — volume strategy
      2: 0.35,
      3: 0.2,
      4: 0.12,  // low turnover — margin strategy
    };
    const factor = tierFactor[recipe?.tier ?? 1] ?? 0.3;
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

  inventory[itemId] = owned - amount;
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
