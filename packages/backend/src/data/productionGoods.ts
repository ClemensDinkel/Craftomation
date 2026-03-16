import { ProductionGoodDefinition } from '@craftomation/shared';

// Wear uses balanced so each tier lasts roughly the same real time (~200s T1, ~600s T4)
// mining_boost:    timer-based, 1 wear per ~10s        → baseline
// plantation_boost: same as mining                      → same values
// craft_speed:     1 wear per finished job (~25-30s)    → ~8/12/16/24 uses
// lab_*:           1 wear per experiment (~35-45s)      → ~5/8/10/15 uses
// auto_trade:      1 wear per transaction (~2-4 per 10s)→ ~60/100/140/200 uses
// market_info:     passive (no wear)                    → high values (not consumed)
// sabotage/defense/patent: per player action (~30-60s)  → ~5/8/10/15 uses
export const PRODUCTION_GOOD_DEFINITIONS: ProductionGoodDefinition[] = [
  // Tier 1
  { id: 'pickaxe',       tier: 1, bonusType: 'mining_boost',      bonusValue: 1,  module: 'mine',          wearUses: 20 },
  { id: 'sickle',        tier: 1, bonusType: 'plantation_boost',   bonusValue: 1,  module: 'plantation',    wearUses: 20 },
  { id: 'workbench',     tier: 1, bonusType: 'craft_speed',        bonusValue: 25, module: 'manufacturing', wearUses: 12 },
  { id: 'notebook',      tier: 1, bonusType: 'lab_distinct_count', bonusValue: 1,  module: 'lab',           wearUses: 5 },
  { id: 'market_report', tier: 1, bonusType: 'market_info',        bonusValue: 1,  module: 'auction',       wearUses: 20 },
  { id: 'supplier',      tier: 1, bonusType: 'auto_buy',           bonusValue: 1,  module: 'auction',       wearUses: 30 },
  // Tier 2
  { id: 'drill',         tier: 2, bonusType: 'mining_boost',      bonusValue: 2,  module: 'mine',          wearUses: 30 },
  { id: 'greenhouse',    tier: 2, bonusType: 'plantation_boost',   bonusValue: 2,  module: 'plantation',    wearUses: 30 },
  { id: 'conveyor',      tier: 2, bonusType: 'craft_speed',        bonusValue: 40, module: 'manufacturing', wearUses: 18 },
  { id: 'microscope',    tier: 2, bonusType: 'lab_direction',      bonusValue: 1,  module: 'lab',           wearUses: 8 },
  { id: 'price_chart',   tier: 2, bonusType: 'market_info',        bonusValue: 2,  module: 'auction',       wearUses: 30 },
  { id: 'lockpick_set',  tier: 2, bonusType: 'sabotage',           bonusValue: 25, module: 'backroom',      wearUses: 8 },
  // Tier 3
  { id: 'excavator',     tier: 3, bonusType: 'mining_boost',      bonusValue: 3,  module: 'mine',          wearUses: 40 },
  { id: 'harvester',     tier: 3, bonusType: 'plantation_boost',   bonusValue: 3,  module: 'plantation',    wearUses: 40 },
  { id: 'assembly_line', tier: 3, bonusType: 'craft_speed',        bonusValue: 55, module: 'manufacturing', wearUses: 24 },
  { id: 'spectrometer',  tier: 3, bonusType: 'lab_exclusion',      bonusValue: 1,  module: 'lab',           wearUses: 10 },
  { id: 'telegraph',     tier: 3, bonusType: 'market_info',        bonusValue: 3,  module: 'auction',       wearUses: 40 },
  { id: 'vault',         tier: 3, bonusType: 'sabotage_defense',   bonusValue: 1,  module: 'backroom',      wearUses: 10 },
  { id: 'textbook',      tier: 3, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearUses: 10 },
  // Tier 4
  { id: 'quantum_drill', tier: 4, bonusType: 'mining_boost',      bonusValue: 4,  module: 'mine',          wearUses: 60 },
  { id: 'bioreactor',    tier: 4, bonusType: 'plantation_boost',   bonusValue: 4,  module: 'plantation',    wearUses: 60 },
  { id: 'nano_forge',    tier: 4, bonusType: 'craft_speed',        bonusValue: 60, module: 'manufacturing', wearUses: 36 },
  { id: 'false_retina',  tier: 4, bonusType: 'sabotage',           bonusValue: 100, module: 'backroom',     wearUses: 15 },
  { id: 'android',       tier: 4, bonusType: 'patent_office',      bonusValue: 25, module: 'patent_office', wearUses: 15 },
  { id: 'trade_bot',     tier: 4, bonusType: 'auto_trade',         bonusValue: 1,  module: 'auction',       wearUses: 200 },
];
