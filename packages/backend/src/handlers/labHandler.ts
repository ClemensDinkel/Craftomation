import { WSMessageType, type LabColor, type LabResult, type LabExperimentEntry } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';
import { getActiveBonus, applyWear } from '../game/productionGoodUtils';
import { RESOURCE_REFERENCE_SUPPLY, RESOURCE_BASE_PRICE, MAX_PRICE_MULTIPLIER } from '../game/marketConstants';

function broadcastGameState(): void {
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

function computeWordle(guess: string[], target: string[]): { colorCoding: LabColor[]; similarity: number } {
  const len = guess.length;
  const colorCoding: LabColor[] = new Array(len).fill('red');

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
    if (guessUsed[i]) continue;
    for (let j = 0; j < len; j++) {
      if (targetUsed[j]) continue;
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

export function handleSetLabAutoBuy(payload: { playerId: string; autoBuy: boolean }): void {
  const { playerId, autoBuy } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  if (player.labAutoBuy !== autoBuy) {
    player.labAutoBuy = autoBuy;
    gameState.setPlayer(playerId, player);
    broadcastGameState();
  }
}

export function handleLabExperiment(
  clientId: string,
  payload: { playerId: string; sequence: string[] },
): LabResult {
  const { playerId, sequence } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return { success: false, reason: 'insufficient_resources' };

  // 1. Check & deduct resources (with optional auto-buy)
  const cost: Record<string, number> = {};
  for (const resId of sequence) {
    cost[resId] = (cost[resId] ?? 0) + 1;
  }

  // Determine which resources are missing
  const missing: Record<string, number> = {};
  for (const [resId, needed] of Object.entries(cost)) {
    const have = player.resources[resId] ?? 0;
    if (have < needed) {
      missing[resId] = needed - Math.floor(have);
    }
  }

  if (Object.keys(missing).length > 0) {
    if (!player.labAutoBuy) {
      return { success: false, reason: 'insufficient_resources' };
    }

    // Try to auto-buy missing resources from market
    const market = gameState.getMarket();
    let totalAutoBuyCost = 0;
    const buyPlan: { resId: string; amount: number }[] = [];

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
        const exponent = Math.min(1, 1 - tempSupply / RESOURCE_REFERENCE_SUPPLY);
        tempPrice = Math.max(1, Math.round(RESOURCE_BASE_PRICE * Math.pow(MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
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
        const exponent = Math.min(1, 1 - entry.supply / RESOURCE_REFERENCE_SUPPLY);
        entry.price = Math.max(1, Math.round(RESOURCE_BASE_PRICE * Math.pow(MAX_PRICE_MULTIPLIER, exponent) * 100) / 100);
      }
      player.resources[resId] = (player.resources[resId] ?? 0) + amount;
    }
    actualTotalCost = Math.round(actualTotalCost * 100) / 100;
    player.cash = Math.round((player.cash - actualTotalCost) * 100) / 100;
    gameState.setMarket(market);
  }

  for (const [resId, needed] of Object.entries(cost)) {
    if (needed > 0) player.resources[resId] -= needed;
  }

  // 2. Determine tier from sequence length: length = tier + 2
  const tier = sequence.length - 2;

  // 3. Filter candidate recipes: same tier, not yet known
  const knownSet = new Set(player.knownRecipes);
  const candidates = gameState.getRecipes().filter(
    r => r.tier === tier && !knownSet.has(r.id),
  );

  if (candidates.length === 0) {
    const coding: LabColor[] = sequence.map(() => 'red');
    player.labHistory.push({
      sequence: [...sequence],
      colorCoding: coding,
      similarity: 0,
      match: false,
    });
    gameState.setPlayer(playerId, player);
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
  let bestCoding: LabColor[] = [];
  let bestRecipeId: string | null = null;

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
    unlockedRecipe = gameState.getRecipes().find(r => r.id === bestRecipeId);
  }

  // 6. Save to history
  const historyEntry: LabExperimentEntry = {
    sequence: [...sequence],
    colorCoding: bestCoding,
    similarity: bestSimilarity,
    match: isMatch,
    recipeId: isMatch ? bestRecipeId ?? undefined : undefined,
  };
  player.labHistory.push(historyEntry);

  // Build result with production good bonuses
  const result: LabResult = {
    success: true,
    match: isMatch,
    recipeUnlocked: unlockedRecipe,
    colorCoding: bestCoding,
    similarity: bestSimilarity,
  };

  // Find the best-matching recipe for bonus calculations
  const bestRecipe = bestRecipeId ? gameState.getRecipes().find(r => r.id === bestRecipeId) : null;

  // Notizbuch bonus: show count of distinct resources in target recipe
  if (getActiveBonus(player, 'lab_distinct_count') > 0 && bestRecipe) {
    const count = new Set(bestRecipe.sequence).size;
    result.distinctResourceCount = count;
    historyEntry.distinctResourceCount = count;
    applyWear(player, 'lab_distinct_count');
  }

  gameState.setPlayer(playerId, player);
  broadcastGameState();

  // Mikroskop bonus: direction hints for yellow results
  if (getActiveBonus(player, 'lab_direction') > 0 && bestRecipe && bestCoding) {
    result.directionHints = bestCoding.map((color, i) => {
      if (color !== 'yellow') return null;
      // Find where this resource actually is in the target
      const targetIdx = bestRecipe.sequence.indexOf(sequence[i]);
      if (targetIdx === -1) return null;
      return targetIdx < i ? 'left' : 'right';
    });
    applyWear(player, 'lab_direction');
  }

  // Spektrometer bonus: show which resources are NOT in the target recipe
  if (getActiveBonus(player, 'lab_exclusion') > 0 && bestRecipe) {
    const targetSet = new Set(bestRecipe.sequence);
    const allResources = gameState.getResources().map(r => r.id);
    result.excludedResources = allResources.filter(id => !targetSet.has(id));
    applyWear(player, 'lab_exclusion');
  }

  return result;
}
