import { Player, ProductionGoodBonusType, ActiveProductionGood } from '@craftomation/shared';
import { PRODUCTION_GOOD_DEFINITIONS } from '../data/productionGoods';

const defMap = new Map(PRODUCTION_GOOD_DEFINITIONS.map(d => [d.id, d]));

/**
 * Get the active bonus value for a given bonus type.
 * Returns the highest bonusValue among all active (isUsed) items of that type.
 */
export function getActiveBonus(player: Player, bonusType: ProductionGoodBonusType): number {
  let best = 0;
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defMap.get(itemId);
    if (!def || def.bonusType !== bonusType) continue;
    for (const item of items) {
      if (item.isUsed && item.wearRemainingMs > 0 && def.bonusValue > best) {
        best = def.bonusValue;
      }
    }
  }
  return best;
}

/**
 * Get the active item ID for a given bonus type (for special effects like nano_forge).
 */
export function getActiveBonusItemId(player: Player, bonusType: ProductionGoodBonusType): string | null {
  let bestValue = 0;
  let bestId: string | null = null;
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defMap.get(itemId);
    if (!def || def.bonusType !== bonusType) continue;
    for (const item of items) {
      if (item.isUsed && item.wearRemainingMs > 0 && def.bonusValue > bestValue) {
        bestValue = def.bonusValue;
        bestId = itemId;
      }
    }
  }
  return bestId;
}

/**
 * Activate a production good for a player.
 * If no stronger item of the same bonus type is active, mark it as used (starts wear).
 * Otherwise keep it as reserve.
 */
export function activateProductionGood(player: Player, itemId: string): void {
  const def = defMap.get(itemId);
  if (!def) return;

  const items = player.productionGoods[itemId];
  if (!items || items.length === 0) return;

  // Find the newly added unused item (last one)
  const newItem = items[items.length - 1];

  // Check if a stronger item of the same bonus type is already active
  const currentBonus = getActiveBonus(player, def.bonusType);
  if (currentBonus >= def.bonusValue) {
    // Stronger or equal already active — keep as reserve
    return;
  }

  // Activate this item
  newItem.isUsed = true;

  // If a weaker item of the same bonus type was active, pause it (keep its wear as-is)
  // No need to do anything — getActiveBonus naturally picks the highest value
}

/**
 * Process wear for all active production goods.
 * Called each economy tick. Removes expired items and auto-activates replacements.
 */
export function tickWear(player: Player, elapsedMs: number): void {
  // Group items by bonus type to find the active one per type
  const byBonusType = new Map<ProductionGoodBonusType, { itemId: string; item: ActiveProductionGood; bonusValue: number }[]>();

  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defMap.get(itemId);
    if (!def) continue;
    for (const item of items) {
      if (!item.isUsed || item.wearRemainingMs <= 0) continue;
      const list = byBonusType.get(def.bonusType) ?? [];
      list.push({ itemId, item, bonusValue: def.bonusValue });
      byBonusType.set(def.bonusType, list);
    }
  }

  // For each bonus type, only the strongest active item ticks wear
  for (const [, activeItems] of byBonusType) {
    // Sort by bonusValue descending — strongest first
    activeItems.sort((a, b) => b.bonusValue - a.bonusValue);
    const strongest = activeItems[0];
    strongest.item.wearRemainingMs -= elapsedMs;
  }

  // Remove expired items and auto-activate replacements
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const expired = items.filter(i => i.isUsed && i.wearRemainingMs <= 0);
    if (expired.length === 0) continue;

    // Remove expired
    player.productionGoods[itemId] = items.filter(i => !(i.isUsed && i.wearRemainingMs <= 0));

    // Auto-activate: find an unused item of the same type
    const def = defMap.get(itemId);
    if (!def) continue;

    const unused = player.productionGoods[itemId]?.find(i => !i.isUsed);
    if (unused) {
      unused.isUsed = true;
    } else {
      // No same item available — check if a weaker item of the same bonus type can take over
      // This happens automatically via getActiveBonus — the next strongest will be picked
      // But we need to ensure it's marked as used
      autoActivateFallback(player, def.bonusType);
    }

    // Clean up empty arrays
    if (player.productionGoods[itemId]?.length === 0) {
      delete player.productionGoods[itemId];
    }
  }
}

/**
 * When the strongest item of a bonus type expires, look for the next best unused item
 * of the same bonus type (possibly a different itemId) and activate it.
 */
function autoActivateFallback(player: Player, bonusType: ProductionGoodBonusType): void {
  // Check if any active item of this bonus type still exists
  const currentBonus = getActiveBonus(player, bonusType);
  if (currentBonus > 0) return; // Something is still active

  // Find unused items of the same bonus type, pick strongest
  let bestDef: { itemId: string; bonusValue: number } | null = null;
  let bestItem: ActiveProductionGood | null = null;

  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defMap.get(itemId);
    if (!def || def.bonusType !== bonusType) continue;
    for (const item of items) {
      if (!item.isUsed && (!bestDef || def.bonusValue > bestDef.bonusValue)) {
        bestDef = { itemId, bonusValue: def.bonusValue };
        bestItem = item;
      }
    }
  }

  if (bestItem) {
    bestItem.isUsed = true;
  }
}

export function getDefinition(itemId: string) {
  return defMap.get(itemId);
}
