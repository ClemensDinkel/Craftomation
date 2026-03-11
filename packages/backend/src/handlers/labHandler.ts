import { WSMessageType, type LabColor, type LabResult } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';

function broadcastGameState(): void {
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

function computeWordle(guess: string[], target: string[]): { colorCoding: LabColor[]; similarity: number } {
  const len = guess.length;
  const colorCoding: LabColor[] = new Array(len).fill('red');

  // Track which target positions are already matched
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
    // No unknown recipes of this tier — resources consumed, no match possible
    gameState.setPlayer(playerId, player);
    broadcastGameState();
    return {
      success: true,
      match: false,
      colorCoding: sequence.map(() => 'red' as LabColor),
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

  gameState.setPlayer(playerId, player);
  broadcastGameState();

  return {
    success: true,
    match: isMatch,
    recipeUnlocked: unlockedRecipe,
    colorCoding: bestCoding,
    similarity: bestSimilarity,
  };
}
