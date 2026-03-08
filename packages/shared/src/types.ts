// ==========================================
// Module Types
// ==========================================

export type ModuleType =
  | 'mine'
  | 'manufacturing'
  | 'lab'
  | 'auction'
  | 'plantation'
  | 'university'
  | 'stockmarket'
  | 'backroom'
  | 'influencer'
  | 'warehouse';

// ==========================================
// Session
// ==========================================

export interface SessionConfig {
  sessionId: string;
  playerCount: number;
  gameSpeed: number;          // 0.0 - 2.0, default 1.0
  consumptionRate: number;    // 0.0 - 2.0, default 1.0
  resourceTypeCount: number;  // 5 - 10, default 6
  activeModules: ModuleType[];
}

// ==========================================
// Resource
// ==========================================

export interface Resource {
  id: string;
  name: string;
  color: string;          // Hex color for UI
  initialLetter: string;  // Must be unique!
}

// ==========================================
// Player
// ==========================================

export interface Player {
  id: string;
  name: string;
  resources: Record<string, number>;        // resourceId -> amount
  productionGoods: Record<string, number>;  // itemId -> amount
  consumables: Record<string, number>;      // itemId -> amount
  knownRecipes: string[];                   // recipeIds
  technologies: string[];
  cash: number;
  activeInMine: boolean;
  currentMineResource: string | null;
  manufacturingQueue: ManufacturingJob[];
}

// ==========================================
// Manufacturing
// ==========================================

export interface ManufacturingJob {
  id: string;
  recipeId: string;
  playerId: string;
  startedAt: number;      // timestamp
  duration: number;       // ms total
  remainingMs: number;    // ms remaining, decremented each tick
  completed: boolean;
}

// ==========================================
// Recipe / Item
// ==========================================

export interface Recipe {
  id: string;
  tier: 1 | 2 | 3 | 4;
  type: 'production_good' | 'consumable';
  sequence: string[];     // Array of Resource-IDs (length = tier + 2, min 3)
  // Display name & description resolved via i18n: tItemName(id), tItemDesc(id)
}

// ==========================================
// Market
// ==========================================

export interface MarketEntry {
  supply: number;
  price: number;
  baseConsumptionRate: number;
}

export interface RecipeListing {
  id: string;
  recipeId: string;
  sellerId: string;
  price: number;
}

export interface MarketState {
  resources: Record<string, MarketEntry>;
  productionGoods: Record<string, MarketEntry>;
  consumables: Record<string, MarketEntry>;
  recipeListings: RecipeListing[];
}

// ==========================================
// Game State
// ==========================================

export interface GameState {
  session: SessionConfig;
  players: Record<string, Player>;
  resources: Resource[];
  recipes: Recipe[];
  market: MarketState;
  tick: number;
  running: boolean;
  startedAt: number | null;
}

// ==========================================
// WebSocket
// ==========================================

export enum WSMessageType {
  // Client -> Server
  JOIN_SESSION = 'JOIN_SESSION',
  LEAVE_SESSION = 'LEAVE_SESSION',
  UPDATE_PLAYER_STATUS = 'UPDATE_PLAYER_STATUS',
  CHANGE_MINE_RESOURCE = 'CHANGE_MINE_RESOURCE',
  ADD_MANUFACTURING_JOB = 'ADD_MANUFACTURING_JOB',
  REMOVE_MANUFACTURING_JOB = 'REMOVE_MANUFACTURING_JOB',
  LAB_EXPERIMENT = 'LAB_EXPERIMENT',
  MARKET_BUY = 'MARKET_BUY',
  MARKET_SELL = 'MARKET_SELL',
  LIST_RECIPE = 'LIST_RECIPE',
  BUY_RECIPE = 'BUY_RECIPE',

  // Server -> Client
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  PLAYER_UPDATE = 'PLAYER_UPDATE',
  MARKET_UPDATE = 'MARKET_UPDATE',
  SESSION_STARTED = 'SESSION_STARTED',
  LAB_RESULT = 'LAB_RESULT',
  ERROR = 'ERROR',
}

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
}
