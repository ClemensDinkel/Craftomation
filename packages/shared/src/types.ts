// ==========================================
// Module Types
// ==========================================

export type ModuleType =
  | 'mine'
  | 'manufacturing'
  | 'lab'
  | 'auction'
  | 'plantation'
  | 'patent_office'
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
  consumables: Record<string, number>;      // itemId -> amount
  productionGoods: Record<string, ActiveProductionGood[]>; // itemId -> items
  knownRecipes: string[];                   // recipeIds
  patents: string[];
  cash: number;
  mineResources: string[];              // selected resource IDs (rotated each tick)
  mineResourceIndex: number;            // index into mineResources for next production
  mineBoostUntil: number | null;       // timestamp when boost expires
  mineBoostCooldownUntil: number | null; // timestamp when cooldown expires
  nextMineProductionAt: number;        // timestamp when next resource is produced
  nextMineWearAt: number;              // timestamp for next mining tool wear tick (unaffected by mining rights)
  nextMarketInfoWearAt: number;        // timestamp for next market_info tool wear tick
  manufacturingQueue: ManufacturingJob[];
  labHistory: LabExperimentEntry[];
  labAutoBuy: boolean;              // auto-buy missing resources from market for lab experiments
  autoTradeRules: AutoTradeRule[];
}

export interface AutoTradeRule {
  id: string;
  itemId: string;
  itemType: 'resource' | 'consumable';
  buyBelowPrice?: number;   // auto-buy when market price <= this
  sellAbovePrice?: number;  // auto-sell when market price >= this
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
  repeat: boolean;        // infinite repeat mode
  resourcesConsumed: boolean; // whether resources have been deducted for this job
  autoBuy: boolean;       // auto-buy missing resources from market
}

// ==========================================
// Lab
// ==========================================

export type LabColor = 'green' | 'yellow' | 'red';

export interface LabExperimentEntry {
  sequence: string[];       // resourceIds used
  colorCoding: LabColor[];
  similarity: number;
  match: boolean;
  recipeId?: string;        // if matched
  distinctResourceCount?: number; // from Notizbuch bonus
}

export interface LabResult {
  success: boolean;
  reason?: 'insufficient_resources';
  match?: boolean;
  recipeUnlocked?: Recipe;
  colorCoding?: LabColor[];
  similarity?: number;
  distinctResourceCount?: number;                      // Notizbuch bonus
  excludedResources?: string[];                        // Spektrometer bonus
  directionHints?: ('left' | 'right' | null)[];        // Mikroskop bonus
}

// ==========================================
// Recipe / Item
// ==========================================

export interface Recipe {
  id: string;
  tier: 1 | 2 | 3 | 4;
  type: 'consumable' | 'production_good';
  sequence: string[];     // Array of Resource-IDs (length = tier + 2, min 3)
  // Display name & description resolved via i18n: tItemName(id), tItemDesc(id)
}

// ==========================================
// Production Goods
// ==========================================

export type ProductionGoodBonusType =
  | 'mining_boost'
  | 'plantation_boost'
  | 'craft_speed'
  | 'lab_distinct_count'
  | 'lab_direction'
  | 'lab_exclusion'
  | 'market_info'
  | 'sabotage'
  | 'sabotage_defense'
  | 'patent_office'
  | 'auto_trade';

export interface ProductionGoodDefinition {
  id: string;
  tier: 1 | 2 | 3 | 4;
  bonusType: ProductionGoodBonusType;
  bonusValue: number;
  module: string;
  wearUses: number;       // total number of uses before breaking
}

export interface ActiveProductionGood {
  itemId: string;
  wearRemaining: number;  // uses remaining before breaking
  isUsed: boolean;        // true = activated at some point, no longer tradeable
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

export interface MiningRight {
  id: string;
  resourceId: string;
  holderId: string;
  pricePaid: number;          // what current holder paid
  expiresAt: number;          // timestamp
}

export interface MarketState {
  resources: Record<string, MarketEntry>;
  consumables: Record<string, MarketEntry>;
  productionGoods: Record<string, MarketEntry>;
  recipeListings: RecipeListing[];
  miningRights: Record<string, MiningRight[]>;  // resourceId -> rights (multiple slots)
}

// ==========================================
// Game State
// ==========================================

export interface GameState {
  session: SessionConfig;
  players: Record<string, Player>;
  resources: Resource[];
  recipes: Recipe[];
  productionGoodDefinitions: ProductionGoodDefinition[];
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
  ADD_PLAYER = 'ADD_PLAYER',
  BOOST_MINE_PLAYER = 'BOOST_MINE_PLAYER',
  CHANGE_MINE_RESOURCE = 'CHANGE_MINE_RESOURCE',
  ADD_MANUFACTURING_JOB = 'ADD_MANUFACTURING_JOB',
  REMOVE_MANUFACTURING_JOB = 'REMOVE_MANUFACTURING_JOB',
  LAB_EXPERIMENT = 'LAB_EXPERIMENT',
  MARKET_BUY = 'MARKET_BUY',
  MARKET_SELL = 'MARKET_SELL',
  LIST_RECIPE = 'LIST_RECIPE',
  BUY_RECIPE = 'BUY_RECIPE',
  BUY_MINING_RIGHT = 'BUY_MINING_RIGHT',
  DEBUG_UNLOCK_RECIPE = 'DEBUG_UNLOCK_RECIPE',
  DEBUG_SET_INVENTORY = 'DEBUG_SET_INVENTORY',
  SET_AUTO_TRADE_RULE = 'SET_AUTO_TRADE_RULE',
  REMOVE_AUTO_TRADE_RULE = 'REMOVE_AUTO_TRADE_RULE',
  SET_MANUFACTURING_AUTOBUY = 'SET_MANUFACTURING_AUTOBUY',
  SET_LAB_AUTOBUY = 'SET_LAB_AUTOBUY',

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
