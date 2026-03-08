import { SessionConfig, Resource, Recipe, MarketState, MarketEntry } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import {
  loadMetalElements,
  loadOrganicElements,
  loadProductionGoods,
  loadMetalProducts,
  loadOrganicProducts,
  RawElement,
} from '../data/csvLoader';

const RESOURCE_COLORS = [
  '#E74C3C', // Red
  '#3498DB', // Blue
  '#2ECC71', // Green
  '#F39C12', // Orange
  '#9B59B6', // Purple
  '#1ABC9C', // Teal
  '#E67E22', // Dark Orange
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#8BC34A', // Light Green
];

const BASE_PRICES: Record<number, number> = {
  1: 10,
  2: 25,
  3: 60,
  4: 150,
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

  // Pool zusammenstellen: Metals immer, Organics nur wenn Plantation aktiv
  const allElements = [...metalElements, ...organicElements];

  const selected = selectWithUniqueInitials(allElements, config.resourceTypeCount);

  return selected.map((el, i) => ({
    id: el.id,
    name: el.name,
    color: RESOURCE_COLORS[i % RESOURCE_COLORS.length],
    initialLetter: el.name[0].toUpperCase(),
  }));
}

// Step 2: Generate recipes
function generateRecipes(config: SessionConfig, resources: Resource[]): Recipe[] {
  const resourceIds = resources.map(r => r.id);
  const recipes: Recipe[] = [];

  // Production goods (immer alle laden)
  const allGoods = loadProductionGoods();
  for (const good of allGoods) {
    const tier = Number(good.tier) as 1 | 2 | 3 | 4;
    const seqLength = tier + 2;
    recipes.push({
      id: good.id,
      tier,
      type: 'production_good',
      sequence: randomSequence(resourceIds, seqLength),
    });
  }

  // Consumables: Metal-Produkte immer, Organic-Produkte nur wenn Plantation aktiv
  const metalProducts = loadMetalProducts();
  const hasPlantation = config.activeModules.includes('plantation');
  const organicProducts = hasPlantation ? loadOrganicProducts() : [];
  const allProducts = [...metalProducts, ...organicProducts];

  // Anzahl = playerCount * 3 (min 10, max 20)
  const consumableCount = Math.min(20, Math.max(10, config.playerCount * 3));
  const selectedProducts = pickRandom(allProducts, consumableCount);

  for (const item of selectedProducts) {
    const tier = Number(item.tier) as 1 | 2 | 3 | 4;
    const seqLength = tier + 2;
    recipes.push({
      id: item.id,
      tier,
      type: 'consumable',
      sequence: randomSequence(resourceIds, seqLength),
    });
  }

  return recipes;
}

// Step 3: Initialize market
function initializeMarket(config: SessionConfig, resources: Resource[], recipes: Recipe[]): MarketState {
  const market: MarketState = {
    resources: {},
    productionGoods: {},
    consumables: {},
    recipeListings: [],
  };

  const resourceConsumption = (config.playerCount / config.resourceTypeCount) * 0.8;
  for (const res of resources) {
    market.resources[res.id] = {
      supply: 100,
      price: RESOURCE_BASE_PRICE,
      baseConsumptionRate: resourceConsumption,
    };
  }

  for (const recipe of recipes) {
    const entry: MarketEntry = {
      supply: 0,
      price: BASE_PRICES[recipe.tier],
      baseConsumptionRate: 0,
    };

    if (recipe.type === 'production_good') {
      market.productionGoods[recipe.id] = entry;
    } else {
      market.consumables[recipe.id] = entry;
    }
  }

  return market;
}

export function runInitialCalculations(config: SessionConfig): void {
  const resources = selectResources(config);
  gameState.setResources(resources);

  const recipes = generateRecipes(config, resources);
  gameState.setRecipes(recipes);

  const market = initializeMarket(config, resources, recipes);
  gameState.setMarket(market);

  console.log(`[Init] Resources: ${resources.length}, Recipes: ${recipes.length}`);
  console.log(`[Init] Market: ${Object.keys(market.resources).length} resources, ${Object.keys(market.consumables).length} consumables`);
}
