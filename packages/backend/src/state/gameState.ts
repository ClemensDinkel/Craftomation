import WebSocket from 'ws';
import {
  SessionConfig,
  Player,
  MarketState,
  Resource,
  Recipe,
  GameState,
  ModuleType,
  ProductionGoodDefinition,
} from '@craftomation/shared';
import { PRODUCTION_GOOD_DEFINITIONS } from '../data/productionGoods';

const REQUIRED_MODULES: ModuleType[] = ['mine', 'manufacturing', 'lab', 'auction'];

const PRODUCTION_GOOD_BASE_PRICES: Record<number, number> = { 1: 15, 2: 30, 3: 60, 4: 120 };

function createDefaultConfig(sessionId: string): SessionConfig {
  return {
    sessionId,
    playerCount: 0,
    gameSpeed: 1.0,
    consumptionRate: 1.0,
    resourceTypeCount: 6,
    activeModules: [...REQUIRED_MODULES],
  };
}

function createDefaultMarket(): MarketState {
  return {
    resources: {},
    consumables: {},
    productionGoods: {},
    recipeListings: [],
    miningRights: {},
  };
}

class GameStateManager {
  private config: SessionConfig | null = null;
  private players: Map<string, Player> = new Map();
  private resources: Resource[] = [];
  private recipes: Recipe[] = [];
  private productionGoodDefs: ProductionGoodDefinition[] = [];
  private market: MarketState = createDefaultMarket();
  private gameTick: number = 0;
  private gameStarted: boolean = false;
  private connectedClients: Map<string, WebSocket> = new Map();
  private clientModules: Map<string, ModuleType> = new Map();
  private clientLastSeen: Map<string, number> = new Map();

  hasSession(): boolean {
    return this.config !== null;
  }

  getSessionId(): string | null {
    return this.config?.sessionId ?? null;
  }

  getConfig(): SessionConfig | null {
    return this.config;
  }

  isGameStarted(): boolean {
    return this.gameStarted;
  }

  createSession(sessionId: string): SessionConfig {
    this.reset();
    this.config = createDefaultConfig(sessionId);
    return this.config;
  }

  updateConfig(updates: Partial<SessionConfig>): void {
    if (!this.config) return;
    this.config = { ...this.config, ...updates };
  }

  reset(): void {
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
  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  setPlayer(id: string, player: Player): void {
    this.players.set(id, player);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  // Resources & Recipes
  setResources(resources: Resource[]): void {
    this.resources = resources;
  }

  getResources(): Resource[] {
    return this.resources;
  }

  setRecipes(recipes: Recipe[]): void {
    this.recipes = recipes;
  }

  getRecipes(): Recipe[] {
    return this.recipes;
  }

  setProductionGoodDefinitions(defs: ProductionGoodDefinition[]): void {
    this.productionGoodDefs = defs;
  }

  getProductionGoodDefinitions(): ProductionGoodDefinition[] {
    return this.productionGoodDefs;
  }

  // Market
  getMarket(): MarketState {
    return this.market;
  }

  setMarket(market: MarketState): void {
    this.market = market;
  }

  // Game tick
  getTick(): number {
    return this.gameTick;
  }

  incrementTick(): number {
    return ++this.gameTick;
  }

  startGame(): void {
    this.gameStarted = true;
  }

  stopGame(): void {
    this.gameStarted = false;
  }

  // Connected clients
  addClient(id: string, ws: WebSocket): void {
    this.connectedClients.set(id, ws);
  }

  removeClient(id: string): void {
    this.connectedClients.delete(id);
    // Keep module assignment so reconnecting clients get their module back
  }

  getClient(id: string): WebSocket | undefined {
    return this.connectedClients.get(id);
  }

  getAllClients(): Map<string, WebSocket> {
    return this.connectedClients;
  }

  // Client module assignments
  setClientModule(clientId: string, moduleType: ModuleType): void {
    this.clientModules.set(clientId, moduleType);
    this.clientLastSeen.set(clientId, Date.now());
  }

  touchClient(clientId: string): void {
    this.clientLastSeen.set(clientId, Date.now());
  }

  getClientModule(clientId: string): ModuleType | undefined {
    return this.clientModules.get(clientId);
  }

  /** Check if a client is still active (connected via WS or seen recently) */
  private isClientActive(clientId: string): boolean {
    // Connected via WebSocket → always active
    if (this.connectedClients.has(clientId)) return true;
    // Seen via heartbeat within last 15 seconds
    const lastSeen = this.clientLastSeen.get(clientId);
    if (lastSeen && Date.now() - lastSeen < 15_000) return true;
    return false;
  }

  getAssignedModules(): ModuleType[] {
    return Array.from(this.clientModules.entries())
      .filter(([clientId]) => this.isClientActive(clientId))
      .map(([, moduleType]) => moduleType);
  }

  getAssignedModulesWithClients(): { clientId: string; moduleType: ModuleType }[] {
    return Array.from(this.clientModules.entries())
      .filter(([clientId]) => this.isClientActive(clientId))
      .map(([clientId, moduleType]) => ({ clientId, moduleType }));
  }

  removeClientModule(clientId: string): void {
    this.clientModules.delete(clientId);
    this.clientLastSeen.delete(clientId);
  }

  // Serialization
  toJSON(): GameState {
    return {
      session: this.config!,
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

  loadFromSnapshot(state: GameState): void {
    this.config = state.session;
    this.resources = state.resources;
    this.recipes = state.recipes;
    this.gameTick = state.tick;
    this.gameStarted = false; // Always start paused after load

    // Always use latest production good definitions (they're static constants)
    this.productionGoodDefs = PRODUCTION_GOOD_DEFINITIONS;

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
    for (const def of PRODUCTION_GOOD_DEFINITIONS) {
      if (!existingRecipeIds.has(def.id)) {
        // Generate random sequence for missing production good recipe
        const seqLength = def.tier + 2;
        const sequence: string[] = [];
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
          price: PRODUCTION_GOOD_BASE_PRICES[recipe.tier] ?? 15,
          baseConsumptionRate: 0,
        };
      }
    }

    // Migrate players: add missing fields
    this.players = new Map(
      Object.entries(state.players).map(([id, p]) => [
        id,
        { ...p, productionGoods: p.productionGoods ?? {}, autoTradeRules: p.autoTradeRules ?? [] },
      ]),
    );
  }
}

export const gameState = new GameStateManager();
