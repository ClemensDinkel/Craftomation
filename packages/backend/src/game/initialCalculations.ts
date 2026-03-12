import { SessionConfig, Resource, Recipe, MarketState, MarketEntry } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import {
  loadMetalElements,
  loadOrganicElements,
  loadMetalProducts,
  loadOrganicProducts,
  RawElement,
} from '../data/csvLoader';

const RESOURCE_COLORS = [
  '#E74C3C', // Red
  '#2979FF', // Blue
  '#2ECC71', // Green
  '#FF9800', // Orange
  '#9B59B6', // Purple
  '#FFD600', // Yellow
  '#E91E63', // Pink
  '#00BFA5', // Teal
  '#795548', // Brown
  '#3F51B5', // Indigo
];

const BASE_PRICES: Record<number, number> = {
  1: 12,
  2: 20,
  3: 32,
  4: 50,
};

const RESOURCE_BASE_PRICE = 5;

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom<T>(array: T[], count: number): T[] {
  return shuffle(array).slice(0, count);
}

function randomSequence(resourceIds: string[], length: number): string[] {
  const seq: string[] = [];
  for (let i = 0; i < length; i++) {
    seq.push(resourceIds[Math.floor(Math.random() * resourceIds.length)]);
  }
  return seq;
}

/**
 * Select resources with unique initial letters from a pool of elements.
 * Shuffles the pool, then picks elements ensuring no two share the same first letter.
 */
function selectWithUniqueInitials(elements: RawElement[], count: number): RawElement[] {
  const shuffled = shuffle(elements);
  const selected: RawElement[] = [];
  const usedLetters = new Set<string>();

  for (const el of shuffled) {
    if (selected.length >= count) break;
    const letter = el.name[0].toUpperCase();
    if (!usedLetters.has(letter)) {
      usedLetters.add(letter);
      selected.push(el);
    }
  }

  return selected;
}

// Step 1: Select resources
function selectResources(config: SessionConfig): Resource[] {
  const metalElements = loadMetalElements();
  const hasPlantation = config.activeModules.includes('plantation');
  const organicElements = hasPlantation ? loadOrganicElements() : [];

  const allElements = [...metalElements, ...organicElements];
  const selected = selectWithUniqueInitials(allElements, config.resourceTypeCount);

  const resources = selected.map((el, i) => ({
    id: el.id,
    name: el.name,
    color: RESOURCE_COLORS[i % RESOURCE_COLORS.length],
    initialLetter: el.name[0].toUpperCase(),
  }));

  return resources.sort((a, b) => a.name.localeCompare(b.name));
}

// Recipes per tier
const RECIPES_PER_TIER: Record<number, number> = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
};

// Step 2: Generate recipes (consumables only)
function generateRecipes(config: SessionConfig, resources: Resource[]): Recipe[] {
  const resourceIds = resources.map(r => r.id);

  const metalProducts = loadMetalProducts();
  const hasPlantation = config.activeModules.includes('plantation');
  const organicProducts = hasPlantation ? loadOrganicProducts() : [];
  const allProducts = [...metalProducts, ...organicProducts];

  const recipes: Recipe[] = [];

  for (const tier of [1, 2, 3, 4] as const) {
    const count = RECIPES_PER_TIER[tier];
    const tierProducts = allProducts.filter(p => Number(p.tier) === tier);
    const selected = pickRandom(tierProducts, count);

    for (const item of selected) {
      recipes.push({
        id: item.id,
        tier,
        type: 'consumable' as const,
        sequence: randomSequence(resourceIds, tier + 2),
      });
    }
  }

  return recipes;
}

// Step 3: Initialize market
function initializeMarket(config: SessionConfig, resources: Resource[], recipes: Recipe[]): MarketState {
  const market: MarketState = {
    resources: {},
    consumables: {},
    recipeListings: [],
    miningRights: {},
  };

  const resourceConsumption = (config.playerCount / config.resourceTypeCount) * 0.4;
  for (const res of resources) {
    market.resources[res.id] = {
      supply: 100,
      price: RESOURCE_BASE_PRICE,
      baseConsumptionRate: resourceConsumption,
    };
  }

  for (const recipe of recipes) {
    market.consumables[recipe.id] = {
      supply: 0,
      price: BASE_PRICES[recipe.tier],
      baseConsumptionRate: 0,
    };
  }

  return market;
}

// Step 4: Assign all resources to players (default: produce everything)
function assignPlayerResources(resources: Resource[]): void {
  const players = gameState.getAllPlayers();
  if (players.length === 0 || resources.length === 0) return;

  const allResourceIds = resources.map(r => r.id);

  for (const player of players) {
    gameState.setPlayer(player.id, {
      ...player,
      mineResources: allResourceIds,
      mineResourceIndex: 0,
    });
  }
}

export function runInitialCalculations(config: SessionConfig): void {
  const resources = selectResources(config);
  gameState.setResources(resources);

  const recipes = generateRecipes(config, resources);
  gameState.setRecipes(recipes);

  const market = initializeMarket(config, resources, recipes);
  gameState.setMarket(market);

  assignPlayerResources(resources);

  console.log(`[Init] Resources: ${resources.length}, Recipes: ${recipes.length}`);
  console.log(`[Init] Market: ${Object.keys(market.resources).length} resources, ${Object.keys(market.consumables).length} consumables`);
}
