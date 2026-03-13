import { useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import type { Player, ProductionGoodDefinition, ActiveProductionGood, ProductionGoodBonusType } from '@craftomation/shared';

export function useProductionGoodDefs(): Map<string, ProductionGoodDefinition> {
  const { state } = useGame();
  return useMemo(() => {
    const map = new Map<string, ProductionGoodDefinition>();
    for (const def of state.gameState?.productionGoodDefinitions ?? []) {
      map.set(def.id, def);
    }
    return map;
  }, [state.gameState?.productionGoodDefinitions]);
}

/** Get the active bonus value for a player and bonus type (mirrors backend logic). */
export function getActiveBonus(
  player: Player,
  bonusType: ProductionGoodBonusType,
  defs: Map<string, ProductionGoodDefinition>,
): number {
  let best = 0;
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defs.get(itemId);
    if (!def || def.bonusType !== bonusType) continue;
    for (const item of items) {
      if (item.isUsed && item.wearRemainingMs > 0 && def.bonusValue > best) {
        best = def.bonusValue;
      }
    }
  }
  return best;
}

/** Get all active production goods for a player, with their definitions. */
export function getPlayerActiveGoods(
  player: Player,
  defs: Map<string, ProductionGoodDefinition>,
): { item: ActiveProductionGood; def: ProductionGoodDefinition }[] {
  const result: { item: ActiveProductionGood; def: ProductionGoodDefinition }[] = [];
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = defs.get(itemId);
    if (!def) continue;
    for (const item of items) {
      if (item.isUsed && item.wearRemainingMs > 0) {
        result.push({ item, def });
      }
    }
  }
  return result;
}

/** Count unused (not yet activated) items for a given itemId. */
export function getUnusedCount(player: Player, itemId: string): number {
  return (player.productionGoods[itemId] ?? []).filter(i => !i.isUsed).length;
}
