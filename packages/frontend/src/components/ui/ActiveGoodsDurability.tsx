import { useLocale } from '@/i18n';
import type { Player, ProductionGoodDefinition } from '@craftomation/shared';
import { getPlayerActiveGoods } from '@/hooks/useProductionGoods';

function shortBonus(bonusType: string, bonusValue: number, t: (key: string) => string): string {
  switch (bonusType) {
    case 'mining_boost': return `+${bonusValue} Mining`;
    case 'plantation_boost': return `+${bonusValue} ${t('bonus.harvest')}`;
    case 'craft_speed': return `-${bonusValue}% ${t('bonus.craftDuration')}`;
    case 'lab_distinct_count': return `+${bonusValue} ${t('bonus.resources')}`;
    case 'lab_direction': return t('bonus.direction');
    case 'lab_exclusion': return t('bonus.exclusion');
    case 'market_info': return `${t('bonus.market')} Lv.${bonusValue}`;
    case 'sabotage': return `+${bonusValue}% Sabotage`;
    case 'sabotage_defense': return t('bonus.defense');
    case 'patent_office': return `-${bonusValue}% Patent`;
    case 'auto_trade': return t('bonus.autoTrade');
    default: return '';
  }
}

interface Props {
  player: Player;
  pgDefs: Map<string, ProductionGoodDefinition>;
  module?: string;
}

export function ActiveGoodsDurability({ player, pgDefs, module }: Props) {
  const { t } = useLocale();
  const allActive = getPlayerActiveGoods(player, pgDefs);
  const activeGoods = module ? allActive.filter(({ def }) => def.module === module) : allActive;

  if (activeGoods.length === 0) return null;

  // Count total items (active + reserve) per bonusType to detect "last one"
  const countByBonusType: Record<string, number> = {};
  for (const [itemId, items] of Object.entries(player.productionGoods)) {
    const def = pgDefs.get(itemId);
    if (!def) continue;
    for (const item of items) {
      if (item.wearRemaining > 0) {
        countByBonusType[def.bonusType] = (countByBonusType[def.bonusType] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {activeGoods.map(({ item, def }) => {
        const pct = Math.round((item.wearRemaining / def.wearUses) * 100);
        const color = pct > 50 ? 'text-green-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400';
        const isLast = (countByBonusType[def.bonusType] ?? 0) <= 1;
        return (
          <span
            key={`${item.itemId}-${item.wearRemaining}`}
            className="inline-flex items-center gap-1 rounded bg-gray-700/50 px-1.5 py-0.5 text-[11px]"
          >
            <span className="text-gray-300">{t(`item.${item.itemId}`)}</span>
            <span className="text-cyan-400">{shortBonus(def.bonusType, def.bonusValue, t)}</span>
            <span className={`font-mono font-medium ${color}`}>{pct}%</span>
            {isLast && (
              <span title={t('productionGood.lastItem')}>
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L1 21h22L12 2z" fill="#f59e0b" />
                  <path d="M12 10v4" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="17.5" r="1.25" fill="#000" />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
