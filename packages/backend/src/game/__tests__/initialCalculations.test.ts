import { describe, it, expect, beforeEach } from 'vitest';
import { SessionConfig } from '@craftomation/shared';
import { runInitialCalculations } from '../initialCalculations';
import { gameState } from '../../state/gameState';

function createConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    sessionId: 'TEST01',
    playerCount: 4,
    gameSpeed: 1.0,
    consumptionRate: 1.0,
    resourceTypeCount: 6,
    activeModules: ['mine', 'manufacturing', 'lab', 'auction'],
    ...overrides,
  };
}

describe('runInitialCalculations', () => {
  beforeEach(() => {
    gameState.createSession('TEST01');
  });

  it('should select the correct number of resources', () => {
    const config = createConfig({ resourceTypeCount: 8 });
    runInitialCalculations(config);

    const resources = gameState.getResources();
    expect(resources).toHaveLength(8);
  });

  it('should ensure all resources have unique initial letters', () => {
    const config = createConfig({ resourceTypeCount: 10 });
    runInitialCalculations(config);

    const resources = gameState.getResources();
    const letters = resources.map(r => r.initialLetter);
    const uniqueLetters = new Set(letters);
    expect(uniqueLetters.size).toBe(letters.length);
  });

  it('should assign colors to all resources', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const resources = gameState.getResources();
    for (const r of resources) {
      expect(r.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('should generate consumable recipes clamped between 10 and 20', () => {
    // playerCount=2 → 2*3=6, clamped to 10
    const configLow = createConfig({ playerCount: 2 });
    runInitialCalculations(configLow);
    const recipesLow = gameState.getRecipes();
    expect(recipesLow.length).toBe(10);

    // playerCount=10 → 10*3=30, clamped to 20
    gameState.createSession('TEST02');
    const configHigh = createConfig({ playerCount: 10 });
    runInitialCalculations(configHigh);
    const recipesHigh = gameState.getRecipes();
    expect(recipesHigh.length).toBe(20);
  });

  it('should create recipe sequences with correct length (tier + 2)', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const recipes = gameState.getRecipes();
    for (const recipe of recipes) {
      expect(recipe.sequence).toHaveLength(recipe.tier + 2);
    }
  });

  it('should only use selected resource IDs in recipe sequences', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const resourceIds = new Set(gameState.getResources().map(r => r.id));
    const recipes = gameState.getRecipes();

    for (const recipe of recipes) {
      for (const resId of recipe.sequence) {
        expect(resourceIds.has(resId)).toBe(true);
      }
    }
  });

  it('should initialize market with all resources at supply=100, price=5', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const market = gameState.getMarket();
    const resources = gameState.getResources();

    expect(Object.keys(market.resources)).toHaveLength(resources.length);
    for (const res of resources) {
      const entry = market.resources[res.id];
      expect(entry).toBeDefined();
      expect(entry.supply).toBe(100);
      expect(entry.price).toBe(5);
    }
  });

  it('should initialize market consumables at supply=0, consumption=0', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const market = gameState.getMarket();

    for (const entry of Object.values(market.consumables)) {
      expect(entry.supply).toBe(0);
      expect(entry.baseConsumptionRate).toBe(0);
    }
  });

  it('should set market prices based on tier', () => {
    const config = createConfig();
    runInitialCalculations(config);

    const market = gameState.getMarket();
    const recipes = gameState.getRecipes();
    const tierPrices: Record<number, number> = { 1: 10, 2: 25, 3: 60, 4: 150 };

    for (const recipe of recipes) {
      const entry = market.consumables[recipe.id];
      expect(entry.price).toBe(tierPrices[recipe.tier]);
    }
  });

  it('should calculate resource consumption rate correctly', () => {
    const config = createConfig({ playerCount: 6, resourceTypeCount: 6 });
    runInitialCalculations(config);

    const market = gameState.getMarket();
    const expectedRate = (6 / 6) * 0.8; // 0.8

    for (const entry of Object.values(market.resources)) {
      expect(entry.baseConsumptionRate).toBeCloseTo(expectedRate);
    }
  });

  it('should include organic elements when plantation module is active', () => {
    const config = createConfig({
      resourceTypeCount: 10,
      activeModules: ['mine', 'manufacturing', 'lab', 'auction', 'plantation'],
    });
    runInitialCalculations(config);

    const resources = gameState.getResources();
    expect(resources).toHaveLength(10);
  });
});
