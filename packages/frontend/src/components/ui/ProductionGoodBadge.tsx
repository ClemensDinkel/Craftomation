import { useLocale } from '@/i18n';
import type { ActiveProductionGood, ProductionGoodDefinition } from '@craftomation/shared';

interface Props {
  item: ActiveProductionGood;
  definition: ProductionGoodDefinition;
  compact?: boolean;
}

export function formatBonusText(bonusType: string, bonusValue: number): string {
  switch (bonusType) {
    case 'mining_boost': return `+${bonusValue} Mining`;
    case 'plantation_boost': return `+${bonusValue} Plantage`;
    case 'craft_speed': return `-${bonusValue}% Craft`;
    case 'lab_distinct_count': return 'Lab: Distinct Count';
    case 'lab_direction': return 'Lab: Direction Hints';
    case 'lab_exclusion': return 'Lab: Exclusions';
    case 'market_info': return `Market Info Lv.${bonusValue}`;
    case 'sabotage': return `Sabotage +${bonusValue}%`;
    case 'sabotage_defense': return 'Sabotage Defense';
    case 'patent_office': return `Patent -${bonusValue}%`;
    default: return bonusType;
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function ProductionGoodBadge({ item, definition, compact }: Props) {
  const { t } = useLocale();

  const isActive = item.isUsed && item.wearRemainingMs > 0;
  const wearFraction = item.wearRemainingMs / definition.wearDurationMs;

  const barColor = wearFraction > 0.5
    ? 'bg-green-500'
    : wearFraction > 0.2
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const statusColor = isActive ? 'border-green-600/60' : 'border-gray-600/60';

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs ${statusColor} bg-gray-800/60`}>
        <span className="text-white font-medium">{t(`item.${item.itemId}`)}</span>
        {isActive && (
          <span className="text-gray-400">{formatTime(item.wearRemainingMs)}</span>
        )}
        {!item.isUsed && (
          <span className="text-gray-500">{t('productionGood.unused')}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-3 py-2 ${statusColor} bg-gray-800/60`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
        <span className="text-white text-sm font-medium truncate">{t(`item.${item.itemId}`)}</span>
        <span className="text-xs text-gray-400 ml-auto">
          {formatBonusText(definition.bonusType, definition.bonusValue)}
        </span>
      </div>
      {isActive && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${wearFraction * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono shrink-0">{formatTime(item.wearRemainingMs)}</span>
        </div>
      )}
      {!item.isUsed && (
        <span className="text-xs text-gray-500">{t('productionGood.unused')}</span>
      )}
    </div>
  );
}
