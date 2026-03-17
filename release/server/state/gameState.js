"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameState = void 0;
const productionGoods_1 = require("../data/productionGoods");
const marketConstants_1 = require("../game/marketConstants");
const REQUIRED_MODULES = ['mine', 'manufacturing', 'lab', 'auction'];
function createDefaultConfig(sessionId) {
    return {
        sessionId,
        playerCount: 0,
        gameSpeed: 1.0,
        consumptionRate: 1.0,
        resourceTypeCount: 6,
        activeModules: [...REQUIRED_MODULES],
    };
}
function createDefaultMarket() {
    return {
        resources: {},
        consumables: {},
        productionGoods: {},
        recipeListings: [],
        miningRights: {},
    };
}
class GameStateManager {
    constructor() {
        this.config = null;
        this.players = new Map();
        this.resources = [];
        this.recipes = [];
        this.productionGoodDefs = [];
        this.market = createDefaultMarket();
        this.gameTick = 0;
        this.gameStarted = false;
        this.connectedClients = new Map();
        this.clientModules = new Map();
        this.clientLastSeen = new Map();
    }
    hasSession() {
        return this.config !== null;
    }
    getSessionId() {
        return this.config?.sessionId ?? null;
    }
    getConfig() {
        return this.config;
    }
    isGameStarted() {
        return this.gameStarted;
    }
    createSession(sessionId) {
        this.reset();
        this.config = createDefaultConfig(sessionId);
        return this.config;
    }
    updateConfig(updates) {
        if (!this.config)
            return;
        this.config = { ...this.config, ...updates };
    }
    reset() {
        this.config = null;
        this.players.clear();
        this.resources = [];
        this.recipes = [];
        this.productionGoodDefs = [];
        this.market = createDefaultMarket();
        this.gameTick = 0;
        this.gameStarted = false;
        this.connectedClients.clear();
        this.clientModules.clear();
        this.clientLastSeen.clear();
    }
    // Players
    getPlayer(id) {
        return this.players.get(id);
    }
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    setPlayer(id, player) {
        this.players.set(id, player);
    }
    removePlayer(id) {
        this.players.delete(id);
    }
    // Resources & Recipes
    setResources(resources) {
        this.resources = resources;
    }
    getResources() {
        return this.resources;
    }
    setRecipes(recipes) {
        this.recipes = recipes;
    }
    getRecipes() {
        return this.recipes;
    }
    setProductionGoodDefinitions(defs) {
        this.productionGoodDefs = defs;
    }
    getProductionGoodDefinitions() {
        return this.productionGoodDefs;
    }
    // Market
    getMarket() {
        return this.market;
    }
    setMarket(market) {
        this.market = market;
    }
    // Game tick
    getTick() {
        return this.gameTick;
    }
    incrementTick() {
        return ++this.gameTick;
    }
    startGame() {
        this.gameStarted = true;
    }
    stopGame() {
        this.gameStarted = false;
    }
    // Connected clients
    addClient(id, ws) {
        this.connectedClients.set(id, ws);
    }
    removeClient(id) {
        this.connectedClients.delete(id);
        // Keep module assignment so reconnecting clients get their module back
    }
    getClient(id) {
        return this.connectedClients.get(id);
    }
    getAllClients() {
        return this.connectedClients;
    }
    // Client module assignments
    setClientModule(clientId, moduleType) {
        this.clientModules.set(clientId, moduleType);
        this.clientLastSeen.set(clientId, Date.now());
    }
    touchClient(clientId) {
        this.clientLastSeen.set(clientId, Date.now());
    }
    getClientModule(clientId) {
        return this.clientModules.get(clientId);
    }
    /** Check if a client is still active (connected via WS or seen recently) */
    isClientActive(clientId) {
        // Connected via WebSocket → always active
        if (this.connectedClients.has(clientId))
            return true;
        // Seen via heartbeat within last 15 seconds
        const lastSeen = this.clientLastSeen.get(clientId);
        if (lastSeen && Date.now() - lastSeen < 15000)
            return true;
        return false;
    }
    getAssignedModules() {
        return Array.from(this.clientModules.entries())
            .filter(([clientId]) => this.isClientActive(clientId))
            .map(([, moduleType]) => moduleType);
    }
    getAssignedModulesWithClients() {
        return Array.from(this.clientModules.entries())
            .filter(([clientId]) => this.isClientActive(clientId))
            .map(([clientId, moduleType]) => ({ clientId, moduleType }));
    }
    removeClientModule(clientId) {
        this.clientModules.delete(clientId);
        this.clientLastSeen.delete(clientId);
    }
    // Serialization
    toJSON() {
        return {
            session: this.config,
            players: Object.fromEntries(this.players),
            resources: this.resources,
            recipes: this.recipes,
            productionGoodDefinitions: this.productionGoodDefs,
            market: this.market,
            tick: this.gameTick,
            running: this.gameStarted,
            startedAt: null,
        };
    }
    loadFromSnapshot(state) {
        this.config = state.session;
        this.resources = state.resources;
        this.recipes = state.recipes;
        this.gameTick = state.tick;
        this.gameStarted = false; // Always start paused after load
        // Always use latest production good definitions (they're static constants)
        this.productionGoodDefs = productionGoods_1.PRODUCTION_GOOD_DEFINITIONS;
        // Migrate market: add productionGoods if missing
        this.market = state.market;
        if (!this.market.productionGoods) {
            this.market.productionGoods = {};
        }
        if (!this.market.miningRights) {
            this.market.miningRights = {};
        }
        // Migrate recipes: add production good recipes if missing
        const existingRecipeIds = new Set(this.recipes.map(r => r.id));
        const resourceIds = this.resources.map(r => r.id);
        for (const def of productionGoods_1.PRODUCTION_GOOD_DEFINITIONS) {
            if (!existingRecipeIds.has(def.id)) {
                // Generate random sequence for missing production good recipe
                const seqLength = def.tier + 2;
                const sequence = [];
                for (let i = 0; i < seqLength; i++) {
                    sequence.push(resourceIds[Math.floor(Math.random() * resourceIds.length)]);
                }
                this.recipes.push({
                    id: def.id,
                    tier: def.tier,
                    type: 'production_good',
                    sequence,
                });
            }
        }
        // Migrate market: add entries for production good recipes if missing
        for (const recipe of this.recipes) {
            if (recipe.type === 'production_good' && !this.market.productionGoods[recipe.id]) {
                this.market.productionGoods[recipe.id] = {
                    supply: 0,
                    price: marketConstants_1.PRODUCTION_GOOD_BASE_PRICES[recipe.tier] ?? 15,
                    baseConsumptionRate: 0,
                };
            }
        }
        // Migrate players: add missing fields
        this.players = new Map(Object.entries(state.players).map(([id, p]) => [
            id,
            { ...p, productionGoods: p.productionGoods ?? {}, autoTradeRules: p.autoTradeRules ?? [] },
        ]));
    }
}
exports.gameState = new GameStateManager();
//# sourceMappingURL=gameState.js.map