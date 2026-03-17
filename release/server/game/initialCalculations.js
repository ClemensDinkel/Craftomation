"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInitialCalculations = runInitialCalculations;
const gameState_1 = require("../state/gameState");
const csvLoader_1 = require("../data/csvLoader");
const productionGoods_1 = require("../data/productionGoods");
const marketConstants_1 = require("./marketConstants");
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
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function pickRandom(array, count) {
    return shuffle(array).slice(0, count);
}
function randomSequence(resourceIds, length) {
    const seq = [];
    for (let i = 0; i < length; i++) {
        seq.push(resourceIds[Math.floor(Math.random() * resourceIds.length)]);
    }
    return seq;
}
/**
 * Select resources with unique initial letters from a pool of elements.
 * Shuffles the pool, then picks elements ensuring no two share the same first letter.
 */
function selectWithUniqueInitials(elements, count) {
    const shuffled = shuffle(elements);
    const selected = [];
    const usedLetters = new Set();
    for (const el of shuffled) {
        if (selected.length >= count)
            break;
        const letter = el.name[0].toUpperCase();
        if (!usedLetters.has(letter)) {
            usedLetters.add(letter);
            selected.push(el);
        }
    }
    return selected;
}
// Step 1: Select resources
function selectResources(config) {
    const metalElements = (0, csvLoader_1.loadMetalElements)();
    const hasPlantation = config.activeModules.includes('plantation');
    const organicElements = hasPlantation ? (0, csvLoader_1.loadOrganicElements)() : [];
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
const RECIPES_PER_TIER = {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
};
// Step 2: Generate recipes (consumables only)
function generateConsumableRecipes(config, resources) {
    const resourceIds = resources.map(r => r.id);
    const metalProducts = (0, csvLoader_1.loadMetalProducts)();
    const hasPlantation = config.activeModules.includes('plantation');
    const organicProducts = hasPlantation ? (0, csvLoader_1.loadOrganicProducts)() : [];
    const allProducts = [...metalProducts, ...organicProducts];
    const recipes = [];
    for (const tier of [1, 2, 3, 4]) {
        const count = RECIPES_PER_TIER[tier];
        const tierProducts = allProducts.filter(p => Number(p.tier) === tier);
        const selected = pickRandom(tierProducts, count);
        for (const item of selected) {
            recipes.push({
                id: item.id,
                tier,
                type: 'consumable',
                sequence: randomSequence(resourceIds, tier + 2),
            });
        }
    }
    return recipes;
}
// Step 2b: Generate production good recipes
function generateProductionGoodRecipes(resources) {
    const resourceIds = resources.map(r => r.id);
    return productionGoods_1.PRODUCTION_GOOD_DEFINITIONS.map(def => ({
        id: def.id,
        tier: def.tier,
        type: 'production_good',
        sequence: randomSequence(resourceIds, def.tier + 2),
    }));
}
// Step 3: Initialize market
function initializeMarket(config, resources, recipes) {
    const market = {
        resources: {},
        consumables: {},
        productionGoods: {},
        recipeListings: [],
        miningRights: {},
    };
    const resourceConsumption = (config.playerCount / config.resourceTypeCount) * 1.2;
    for (const res of resources) {
        market.resources[res.id] = {
            supply: 100,
            price: marketConstants_1.RESOURCE_BASE_PRICE,
            baseConsumptionRate: resourceConsumption,
        };
    }
    for (const recipe of recipes) {
        if (recipe.type === 'consumable') {
            market.consumables[recipe.id] = {
                supply: 0,
                price: marketConstants_1.BASE_PRICES[recipe.tier],
                baseConsumptionRate: 0,
            };
        }
        else {
            // Production goods: no automatic consumption (consumed via wear by players)
            market.productionGoods[recipe.id] = {
                supply: 0,
                price: marketConstants_1.PRODUCTION_GOOD_BASE_PRICES[recipe.tier],
                baseConsumptionRate: 0,
            };
        }
    }
    return market;
}
// Step 4: Assign all resources to players (default: produce everything)
function assignPlayerResources(resources) {
    const players = gameState_1.gameState.getAllPlayers();
    if (players.length === 0 || resources.length === 0)
        return;
    const allResourceIds = resources.map(r => r.id);
    for (const player of players) {
        gameState_1.gameState.setPlayer(player.id, {
            ...player,
            mineResources: allResourceIds,
            mineResourceIndex: 0,
        });
    }
}
function runInitialCalculations(config) {
    const resources = selectResources(config);
    gameState_1.gameState.setResources(resources);
    const consumableRecipes = generateConsumableRecipes(config, resources);
    const productionGoodRecipes = generateProductionGoodRecipes(resources);
    const recipes = [...consumableRecipes, ...productionGoodRecipes];
    gameState_1.gameState.setRecipes(recipes);
    gameState_1.gameState.setProductionGoodDefinitions(productionGoods_1.PRODUCTION_GOOD_DEFINITIONS);
    const market = initializeMarket(config, resources, recipes);
    gameState_1.gameState.setMarket(market);
    assignPlayerResources(resources);
    console.log(`[Init] Resources: ${resources.length}, Consumable Recipes: ${consumableRecipes.length}, Production Good Recipes: ${productionGoodRecipes.length}`);
    console.log(`[Init] Market: ${Object.keys(market.resources).length} resources, ${Object.keys(market.consumables).length} consumables, ${Object.keys(market.productionGoods).length} production goods`);
}
//# sourceMappingURL=initialCalculations.js.map