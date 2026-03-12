import WebSocket from 'ws';
import {
  SessionConfig,
  Player,
  MarketState,
  Resource,
  Recipe,
  GameState,
  ModuleType,
} from '@craftomation/shared';

const REQUIRED_MODULES: ModuleType[] = ['mine', 'manufacturing', 'lab', 'auction'];

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
    recipeListings: [],
    miningRights: {},
  };
}

class GameStateManager {
  private config: SessionConfig | null = null;
  private players: Map<string, Player> = new Map();
  private resources: Resource[] = [];
  private recipes: Recipe[] = [];
  private market: MarketState = createDefaultMarket();
  private gameTick: number = 0;
  private gameStarted: boolean = false;
  private connectedClients: Map<string, WebSocket> = new Map();
  private clientModules: Map<string, ModuleType> = new Map();

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
    this.market = createDefaultMarket();
    this.gameTick = 0;
    this.gameStarted = false;
    this.connectedClients.clear();
    this.clientModules.clear();
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
    this.clientModules.delete(id);
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
  }

  getAssignedModules(): ModuleType[] {
    return Array.from(this.clientModules.values());
  }

  getAssignedModulesWithClients(): { clientId: string; moduleType: ModuleType }[] {
    return Array.from(this.clientModules.entries()).map(([clientId, moduleType]) => ({
      clientId,
      moduleType,
    }));
  }

  // Serialization
  toJSON(): GameState {
    return {
      session: this.config!,
      players: Object.fromEntries(this.players),
      resources: this.resources,
      recipes: this.recipes,
      market: this.market,
      tick: this.gameTick,
      running: this.gameStarted,
      startedAt: null,
    };
  }

  loadFromSnapshot(state: GameState): void {
    this.config = state.session;
    this.players = new Map(Object.entries(state.players));
    this.resources = state.resources;
    this.recipes = state.recipes;
    this.market = state.market;
    this.gameTick = state.tick;
    this.gameStarted = false; // Always start paused after load
  }
}

export const gameState = new GameStateManager();
