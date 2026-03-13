import { WSMessageType, type LabColor, type LabResult } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';
import { getActiveBonus, applyWear } from '../game/productionGoodUtils';

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

export function handleLabExperiment(
  clientId: string,
  payload: { playerId: string; sequence: string[] },
): LabResult {
  const { playerId, sequence } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return { success: false, reason: 'insufficient_resources' };

  // 1. Check & deduct resources
  const cost: Record<string, number> = {};
  for (const resId of sequence) {
    cost[resId] = (cost[resId] ?? 0) + 1;
  }

  for (const [resId, needed] of Object.entries(cost)) {
    if ((player.resources[resId] ?? 0) < needed) {
      return { success: false, reason: 'insufficient_resources' };
    }
  }

  for (const [resId, needed] of Object.entries(cost)) {
    player.resources[resId] -= needed;
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
  player.labHistory.push({
    sequence: [...sequence],
    colorCoding: bestCoding,
    similarity: bestSimilarity,
    match: isMatch,
    recipeId: isMatch ? bestRecipeId ?? undefined : undefined,
  });

  gameState.setPlayer(playerId, player);
  broadcastGameState();

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
    result.distinctResourceCount = new Set(bestRecipe.sequence).size;
    applyWear(player, 'lab_distinct_count');
  }

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
