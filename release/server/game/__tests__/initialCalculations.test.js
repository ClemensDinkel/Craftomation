"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const initialCalculations_1 = require("../initialCalculations");
const gameState_1 = require("../../state/gameState");
function createConfig(overrides = {}) {
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
(0, vitest_1.describe)('runInitialCalculations', () => {
    (0, vitest_1.beforeEach)(() => {
        gameState_1.gameState.createSession('TEST01');
    });
    (0, vitest_1.it)('should select the correct number of resources', () => {
        const config = createConfig({ resourceTypeCount: 8 });
        (0, initialCalculations_1.runInitialCalculations)(config);
        const resources = gameState_1.gameState.getResources();
        (0, vitest_1.expect)(resources).toHaveLength(8);
    });
    (0, vitest_1.it)('should ensure all resources have unique initial letters', () => {
        const config = createConfig({ resourceTypeCount: 10 });
        (0, initialCalculations_1.runInitialCalculations)(config);
        const resources = gameState_1.gameState.getResources();
        const letters = resources.map(r => r.initialLetter);
        const uniqueLetters = new Set(letters);
        (0, vitest_1.expect)(uniqueLetters.size).toBe(letters.length);
    });
    (0, vitest_1.it)('should assign colors to all resources', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const resources = gameState_1.gameState.getResources();
        for (const r of resources) {
            (0, vitest_1.expect)(r.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });
    (0, vitest_1.it)('should generate consumable recipes clamped between 10 and 20', () => {
        // playerCount=2 → 2*3=6, clamped to 10
        const configLow = createConfig({ playerCount: 2 });
        (0, initialCalculations_1.runInitialCalculations)(configLow);
        const recipesLow = gameState_1.gameState.getRecipes();
        (0, vitest_1.expect)(recipesLow.length).toBe(10);
        // playerCount=10 → 10*3=30, clamped to 20
        gameState_1.gameState.createSession('TEST02');
        const configHigh = createConfig({ playerCount: 10 });
        (0, initialCalculations_1.runInitialCalculations)(configHigh);
        const recipesHigh = gameState_1.gameState.getRecipes();
        (0, vitest_1.expect)(recipesHigh.length).toBe(20);
    });
    (0, vitest_1.it)('should create recipe sequences with correct length (tier + 2)', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const recipes = gameState_1.gameState.getRecipes();
        for (const recipe of recipes) {
            (0, vitest_1.expect)(recipe.sequence).toHaveLength(recipe.tier + 2);
        }
    });
    (0, vitest_1.it)('should only use selected resource IDs in recipe sequences', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const resourceIds = new Set(gameState_1.gameState.getResources().map(r => r.id));
        const recipes = gameState_1.gameState.getRecipes();
        for (const recipe of recipes) {
            for (const resId of recipe.sequence) {
                (0, vitest_1.expect)(resourceIds.has(resId)).toBe(true);
            }
        }
    });
    (0, vitest_1.it)('should initialize market with all resources at supply=100, price=5', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const market = gameState_1.gameState.getMarket();
        const resources = gameState_1.gameState.getResources();
        (0, vitest_1.expect)(Object.keys(market.resources)).toHaveLength(resources.length);
        for (const res of resources) {
            const entry = market.resources[res.id];
            (0, vitest_1.expect)(entry).toBeDefined();
            (0, vitest_1.expect)(entry.supply).toBe(100);
            (0, vitest_1.expect)(entry.price).toBe(5);
        }
    });
    (0, vitest_1.it)('should initialize market consumables at supply=0, consumption=0', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const market = gameState_1.gameState.getMarket();
        for (const entry of Object.values(market.consumables)) {
            (0, vitest_1.expect)(entry.supply).toBe(0);
            (0, vitest_1.expect)(entry.baseConsumptionRate).toBe(0);
        }
    });
    (0, vitest_1.it)('should set market prices based on tier', () => {
        const config = createConfig();
        (0, initialCalculations_1.runInitialCalculations)(config);
        const market = gameState_1.gameState.getMarket();
        const recipes = gameState_1.gameState.getRecipes();
        const tierPrices = { 1: 10, 2: 25, 3: 60, 4: 150 };
        for (const recipe of recipes) {
            const entry = market.consumables[recipe.id];
            (0, vitest_1.expect)(entry.price).toBe(tierPrices[recipe.tier]);
        }
    });
    (0, vitest_1.it)('should calculate resource consumption rate correctly', () => {
        const config = createConfig({ playerCount: 6, resourceTypeCount: 6 });
        (0, initialCalculations_1.runInitialCalculations)(config);
        const market = gameState_1.gameState.getMarket();
        const expectedRate = (6 / 6) * 0.8; // 0.8
        for (const entry of Object.values(market.resources)) {
            (0, vitest_1.expect)(entry.baseConsumptionRate).toBeCloseTo(expectedRate);
        }
    });
    (0, vitest_1.it)('should include organic elements when plantation module is active', () => {
        const config = createConfig({
            resourceTypeCount: 10,
            activeModules: ['mine', 'manufacturing', 'lab', 'auction', 'plantation'],
        });
        (0, initialCalculations_1.runInitialCalculations)(config);
        const resources = gameState_1.gameState.getResources();
        (0, vitest_1.expect)(resources).toHaveLength(10);
    });
});
//# sourceMappingURL=initialCalculations.test.js.map