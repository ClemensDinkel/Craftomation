import { ProductionGoodDefinition } from '@craftomation/shared';

// Wear durations (base, before gameSpeed): T1=4min, T2=5min, T3=6min, T4=8min
export const PRODUCTION_GOOD_DEFINITIONS: ProductionGoodDefinition[] = [
  // Tier 1
  { id: 'pickaxe',       tier: 1, bonusType: 'mining_boost',      bonusValue: 1,  module: 'mine',          wearDurationMs: 240_000 },
  { id: 'sickle',        tier: 1, bonusType: 'plantation_boost',   bonusValue: 1,  module: 'plantation',    wearDurationMs: 240_000 },
  { id: 'workbench',     tier: 1, bonusType: 'craft_speed',        bonusValue: 25, module: 'manufacturing', wearDurationMs: 240_000 },
  { id: 'notebook',      tier: 1, bonusType: 'lab_distinct_count', bonusValue: 1,  module: 'lab',           wearDurationMs: 240_000 },
  { id: 'market_report', tier: 1, bonusType: 'market_info',        bonusValue: 1,  module: 'auction',       wearDurationMs: 240_000 },
  // Tier 2
  { id: 'drill',         tier: 2, bonusType: 'mining_boost',      bonusValue: 2,  module: 'mine',          wearDurationMs: 300_000 },
  { id: 'greenhouse',    tier: 2, bonusType: 'plantation_boost',   bonusValue: 2,  module: 'plantation',    wearDurationMs: 300_000 },
  { id: 'conveyor',      tier: 2, bonusType: 'craft_speed',        bonusValue: 40, module: 'manufacturing', wearDurationMs: 300_000 },
  { id: 'microscope',    tier: 2, bonusType: 'lab_direction',      bonusValue: 1,  module: 'lab',           wearDurationMs: 300_000 },
  { id: 'price_chart',   tier: 2, bonusType: 'market_info',        bonusValue: 2,  module: 'auction',       wearDurationMs: 300_000 },
  { id: 'lockpick_set',  tier: 2, bonusType: 'sabotage',           bonusValue: 25, module: 'backroom',      wearDurationMs: 300_000 },
  // Tier 3
  { id: 'excavator',     tier: 3, bonusType: 'mining_boost',      bonusValue: 3,  module: 'mine',          wearDurationMs: 360_000 },
  { id: 'harvester',     tier: 3, bonusType: 'plantation_boost',   bonusValue: 3,  module: 'plantation',    wearDurationMs: 360_000 },
  { id: 'assembly_line', tier: 3, bonusType: 'craft_speed',        bonusValue: 55, module: 'manufacturing', wearDurationMs: 360_000 },
  { id: 'spectrometer',  tier: 3, bonusType: 'lab_exclusion',      bonusValue: 1,  module: 'lab',           wearDurationMs: 360_000 },
  { id: 'telegraph',     tier: 3, bonusType: 'market_info',        bonusValue: 3,  module: 'auction',       wearDurationMs: 360_000 },
  { id: 'vault',         tier: 3, bonusType: 'sabotage_defense',   bonusValue: 1,  module: 'backroom',      wearDurationMs: 360_000 },
  { id: 'textbook',      tier: 3, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearDurationMs: 360_000 },
  // Tier 4
  { id: 'quantum_drill', tier: 4, bonusType: 'mining_boost',      bonusValue: 4,  module: 'mine',          wearDurationMs: 480_000 },
  { id: 'bioreactor',    tier: 4, bonusType: 'plantation_boost',   bonusValue: 4,  module: 'plantation',    wearDurationMs: 480_000 },
  { id: 'nano_forge',    tier: 4, bonusType: 'craft_speed',        bonusValue: 60, module: 'manufacturing', wearDurationMs: 480_000 },
  { id: 'false_retina',  tier: 4, bonusType: 'sabotage',           bonusValue: 100, module: 'backroom',     wearDurationMs: 480_000 },
  { id: 'android',       tier: 4, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearDurationMs: 480_000 },
];
