import { ProductionGoodDefinition } from '@craftomation/shared';

// Wear uses per tier: T1=20, T2=30, T3=40, T4=60
export const PRODUCTION_GOOD_DEFINITIONS: ProductionGoodDefinition[] = [
  // Tier 1
  { id: 'pickaxe',       tier: 1, bonusType: 'mining_boost',      bonusValue: 1,  module: 'mine',          wearUses: 20 },
  { id: 'sickle',        tier: 1, bonusType: 'plantation_boost',   bonusValue: 1,  module: 'plantation',    wearUses: 20 },
  { id: 'workbench',     tier: 1, bonusType: 'craft_speed',        bonusValue: 25, module: 'manufacturing', wearUses: 20 },
  { id: 'notebook',      tier: 1, bonusType: 'lab_distinct_count', bonusValue: 1,  module: 'lab',           wearUses: 20 },
  { id: 'market_report', tier: 1, bonusType: 'market_info',        bonusValue: 1,  module: 'auction',       wearUses: 20 },
  // Tier 2
  { id: 'drill',         tier: 2, bonusType: 'mining_boost',      bonusValue: 2,  module: 'mine',          wearUses: 30 },
  { id: 'greenhouse',    tier: 2, bonusType: 'plantation_boost',   bonusValue: 2,  module: 'plantation',    wearUses: 30 },
  { id: 'conveyor',      tier: 2, bonusType: 'craft_speed',        bonusValue: 40, module: 'manufacturing', wearUses: 30 },
  { id: 'microscope',    tier: 2, bonusType: 'lab_direction',      bonusValue: 1,  module: 'lab',           wearUses: 30 },
  { id: 'price_chart',   tier: 2, bonusType: 'market_info',        bonusValue: 2,  module: 'auction',       wearUses: 30 },
  { id: 'lockpick_set',  tier: 2, bonusType: 'sabotage',           bonusValue: 25, module: 'backroom',      wearUses: 30 },
  // Tier 3
  { id: 'excavator',     tier: 3, bonusType: 'mining_boost',      bonusValue: 3,  module: 'mine',          wearUses: 40 },
  { id: 'harvester',     tier: 3, bonusType: 'plantation_boost',   bonusValue: 3,  module: 'plantation',    wearUses: 40 },
  { id: 'assembly_line', tier: 3, bonusType: 'craft_speed',        bonusValue: 55, module: 'manufacturing', wearUses: 40 },
  { id: 'spectrometer',  tier: 3, bonusType: 'lab_exclusion',      bonusValue: 1,  module: 'lab',           wearUses: 40 },
  { id: 'telegraph',     tier: 3, bonusType: 'market_info',        bonusValue: 3,  module: 'auction',       wearUses: 40 },
  { id: 'vault',         tier: 3, bonusType: 'sabotage_defense',   bonusValue: 1,  module: 'backroom',      wearUses: 40 },
  { id: 'textbook',      tier: 3, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearUses: 40 },
  // Tier 4
  { id: 'quantum_drill', tier: 4, bonusType: 'mining_boost',      bonusValue: 4,  module: 'mine',          wearUses: 60 },
  { id: 'bioreactor',    tier: 4, bonusType: 'plantation_boost',   bonusValue: 4,  module: 'plantation',    wearUses: 60 },
  { id: 'nano_forge',    tier: 4, bonusType: 'craft_speed',        bonusValue: 60, module: 'manufacturing', wearUses: 60 },
  { id: 'false_retina',  tier: 4, bonusType: 'sabotage',           bonusValue: 100, module: 'backroom',     wearUses: 60 },
  { id: 'android',       tier: 4, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearUses: 60 },
];
