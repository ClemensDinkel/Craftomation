import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, Recipe, WSMessage, LabColor } from '@craftomation/shared';
import { Button, ActiveGoodsDurability } from '@/components/ui';
import { useProductionGoodDefs } from '@/hooks/useProductionGoods';
import clsx from 'clsx';

type HintDir = 'up' | 'down' | 'left' | 'right';

const ARROW_SIZE = { sm: 14, base: 18 } as const;

function HintArrow({ dir, color, size = 'base' }: { dir: HintDir; color: string; size?: 'sm' | 'base' }) {
  const isVertical = dir === 'up' || dir === 'down';
  const glyph = isVertical ? '↓' : '→';
  const px = ARROW_SIZE[size];
  return (
    <span
      className={clsx(
        'absolute flex items-center justify-center font-black',
        size === 'base' ? 'text-base' : 'text-sm',
        color,
        isVertical ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2',
        dir === 'up' && 'bottom-full translate-y-1/2',
        dir === 'down' && 'top-full -translate-y-1/2',
        dir === 'left' && 'right-full translate-x-1/2',
        dir === 'right' && 'left-full -translate-x-1/2',
        (dir === 'up' || dir === 'left') && 'rotate-180',
      )}
      style={{ width: px, height: px }}
    >
      {glyph}
    </span>
  );
}

interface Props {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  send: (msg: WSMessage) => void;
  onBack: () => void;
}

const TECH_LEVEL = 1; // Hardcoded for now
const MAX_SLOTS = 6;

function getAvailableSlots(): number {
  return Math.min(MAX_SLOTS, 3 + Math.max(0, TECH_LEVEL - 1));
}

export function PlayerLabView({ player, resources, recipes, send, onBack }: Props) {
  const { t } = useLocale();
  const { state, dispatch } = useGame();
  const pgDefs = useProductionGoodDefs();
  const [slots, setSlots] = useState<(string | null)[]>(Array(MAX_SLOTS).fill(null));
  const [resultColors, setResultColors] = useState<LabColor[] | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [autoBuy, setAutoBuy] = useState(player.labAutoBuy ?? false);
  const [bonusInfo, setBonusInfo] = useState<{
    distinctResourceCount?: number;
    directionHints?: ('left' | 'right' | null)[];
    excludedResources?: string[];
    alphabeticalHints?: ('up' | 'down' | null)[];
  } | null>(null);

  const availableSlots = getAvailableSlots();

  const resourceMap = useMemo(() => {
    const map: Record<string, Resource> = {};
    for (const r of resources) map[r.id] = r;
    return map;
  }, [resources]);

  const usedResources = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const resId of slots) {
      if (resId) counts[resId] = (counts[resId] ?? 0) + 1;
    }
    return counts;
  }, [slots]);

  // Recipes per tier stats
  const tierStats = useMemo(() => {
    const stats: Record<number, { total: number; known: number }> = {};
    const knownSet = new Set(player.knownRecipes);
    for (const r of recipes) {
      if (!stats[r.tier]) stats[r.tier] = { total: 0, known: 0 };
      stats[r.tier].total++;
      if (knownSet.has(r.id)) stats[r.tier].known++;
    }
    return stats;
  }, [recipes, player.knownRecipes]);

  // Warning for current slot count tier
  const filledCount = slots.slice(0, availableSlots).filter(Boolean).length;
  const currentTier = filledCount >= 3 ? filledCount - 2 : 0;
  const tierAllKnown = currentTier > 0 && tierStats[currentTier]
    ? tierStats[currentTier].known >= tierStats[currentTier].total
    : false;

  // Handle lab result from server
  useEffect(() => {
    if (!state.labResult) return;
    const result = state.labResult;
    setWaiting(false);

    if (!result.success) {
      setResultMessage(t('lab.insufficientResources'));
      dispatch({ type: 'CLEAR_LAB_RESULT' });
      return;
    }

    if (result.colorCoding) {
      setResultColors(result.colorCoding);
    }

    // Capture bonus info
    const bonus: typeof bonusInfo = {};
    if (result.distinctResourceCount !== undefined) bonus.distinctResourceCount = result.distinctResourceCount;
    if (result.directionHints) bonus.directionHints = result.directionHints;
    if (result.alphabeticalHints) bonus.alphabeticalHints = result.alphabeticalHints;
    if (result.excludedResources && result.excludedResources.length > 0) bonus.excludedResources = result.excludedResources;
    setBonusInfo(Object.keys(bonus).length > 0 ? bonus : null);

    if (result.match && result.recipeUnlocked) {
      setResultMessage(t('lab.recipeUnlocked') + ': ' + t(`item.${result.recipeUnlocked.id}`));
    } else if (result.similarity !== undefined) {
      const pct = Math.round(result.similarity * 100);
      setResultMessage(`${t('lab.similarity')}: ${pct}%`);
    }

    dispatch({ type: 'CLEAR_LAB_RESULT' });
  }, [state.labResult, dispatch, t]);

  const canExperiment = filledCount >= 3 && !waiting;

  const handleSlotClick = useCallback((resId: string) => {
    if (resultColors) {
      setResultColors(null);
      setResultMessage(null);
      setSlots(Array(MAX_SLOTS).fill(null));
      return;
    }

    setSlots(prev => {
      const next = [...prev];
      for (let i = 0; i < availableSlots; i++) {
        if (!next[i]) {
          next[i] = resId;
          return next;
        }
      }
      return prev;
    });
  }, [availableSlots, resultColors]);

  const handleClearSlot = (index: number) => {
    if (resultColors) {
      setResultColors(null);
      setResultMessage(null);
      setSlots(Array(MAX_SLOTS).fill(null));
      return;
    }
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleExperiment = () => {
    const sequence = slots.slice(0, availableSlots).filter(Boolean) as string[];
    if (sequence.length < 3) return;

    setWaiting(true);
    setResultColors(null);
    setResultMessage(null);
    send({
      type: WSMessageType.LAB_EXPERIMENT,
      payload: { playerId: player.id, sequence },
    });
  };

  const handleClearAll = () => {
    setSlots(Array(MAX_SLOTS).fill(null));
    setResultColors(null);
    setResultMessage(null);
    setBonusInfo(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-900 -mx-4 -mt-4 px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            {t('common.back')}
          </Button>
          <h2 className="text-lg font-bold text-white truncate">{player.name}</h2>
        </div>
        <ActiveGoodsDurability player={player} pgDefs={pgDefs} module="lab" />
      </div>

      {/* Auto-Buy Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = !autoBuy;
            setAutoBuy(next);
            send({
              type: WSMessageType.SET_LAB_AUTOBUY,
              payload: { playerId: player.id, autoBuy: next },
            });
          }}
          className={`relative w-9 h-5 rounded-full transition-colors ${autoBuy ? 'bg-indigo-600' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoBuy ? 'translate-x-4' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">{t('lab.autoBuy')}</span>
      </div>

      {/* Slot Area */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('lab.experiment')}</h3>
        <div className="flex gap-2 justify-center mb-3">
          {Array.from({ length: MAX_SLOTS }).map((_, i) => {
            const isAvailable = i < availableSlots;
            const resId = slots[i];
            const res = resId ? resourceMap[resId] : null;
            const color = resultColors?.[i];

            const borderColor = color === 'green'
              ? 'border-green-500 bg-green-900/40'
              : color === 'yellow'
                ? 'border-yellow-500 bg-yellow-900/40'
                : color === 'red'
                  ? 'border-red-500 bg-red-900/40'
                  : res
                    ? 'border-gray-600 bg-gray-700/50'
                    : isAvailable
                      ? 'border-gray-600 border-dashed bg-gray-800/30'
                      : 'border-gray-800 bg-gray-900/50 opacity-40';

            return (
              <div
                key={i}
                className={`relative w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-colors ${borderColor}`}
              >
                {res ? (
                  <>
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: res.color }}
                    >
                      {res.initialLetter}
                    </span>
                    {/* Direction hint for yellow slots */}
                    {color === 'yellow' && bonusInfo?.directionHints?.[i] && (
                      <HintArrow dir={bonusInfo.directionHints[i]!} color="text-yellow-400" />
                    )}
                    {/* Alphabetical hint for red slots */}
                    {color === 'red' && bonusInfo?.alphabeticalHints?.[i] && (
                      <HintArrow dir={bonusInfo.alphabeticalHints[i]!} color="text-red-400" />
                    )}
                    {!resultColors && (
                      <button
                        onClick={() => handleClearSlot(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center transition-colors"
                      >
                        &times;
                      </button>
                    )}
                  </>
                ) : isAvailable ? (
                  <span className="text-gray-600 text-xs">{i + 1}</span>
                ) : (
                  <span className="text-gray-700 text-[10px]">T{i - 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tier warning */}
        {tierAllKnown && !resultColors && (
          <div className="text-center text-sm mb-3 px-3 py-2 rounded-lg bg-amber-900/40 text-amber-400">
            {t('lab.allTierKnown')} (T{currentTier})
          </div>
        )}

        {/* Result message */}
        {resultMessage && (
          <div className={`text-center text-sm mb-3 px-3 py-2 rounded-lg ${
            resultColors?.every(c => c === 'green')
              ? 'bg-green-900/40 text-green-400'
              : 'bg-gray-800 text-gray-300'
          }`}>
            {resultMessage}
          </div>
        )}

        {/* Bonus info from production goods */}
        {bonusInfo && resultColors && (
          <div className="flex flex-col gap-1 mb-3">
            {bonusInfo.distinctResourceCount !== undefined && (
              <div className="text-center text-xs px-3 py-1.5 rounded-lg bg-indigo-900/30 text-indigo-300">
                {bonusInfo.distinctResourceCount} {t('productionGood.distinctCount')}
              </div>
            )}
            {bonusInfo.excludedResources && bonusInfo.excludedResources.length > 0 && (
              <div className="text-center text-xs px-3 py-1.5 rounded-lg bg-purple-900/30 text-purple-300">
                {t('productionGood.notInRecipe')}: {bonusInfo.excludedResources.map(resId => {
                  const r = resourceMap[resId];
                  return r?.name ?? resId;
                }).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-center">
          {resultColors ? (
            <Button size="sm" onClick={handleClearAll}>
              {t('lab.newExperiment')}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleExperiment}
                disabled={!canExperiment}
              >
                {waiting ? t('common.loading') : t('lab.experimentBtn')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClearAll}>
                {t('lab.clear')}
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Resource Palette */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('lab.resourcePalette')}</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {resources.map(res => {
            const owned = Math.floor(player.resources[res.id] ?? 0);
            const used = usedResources[res.id] ?? 0;
            const available = owned - used;
            const disabled = (!autoBuy && available <= 0) || !!resultColors;

            return (
              <button
                key={res.id}
                onClick={() => !disabled && handleSlotClick(res.id)}
                disabled={disabled}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  disabled
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-gray-700/50 cursor-pointer'
                }`}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: res.color }}
                >
                  {res.initialLetter}
                </span>
                <span className="text-[10px] text-gray-400 truncate max-w-full">{res.name}</span>
                <span className={`text-[10px] font-mono ${available < 0 && autoBuy ? 'text-amber-400' : 'text-gray-500'}`}>
                  {available < 0 && autoBuy ? `${owned}+$` : available}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Experiment History */}
      {player.labHistory.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            {t('lab.history')} ({player.labHistory.length})
          </h3>
          <div className="flex flex-col gap-2">
            {[...player.labHistory].reverse().map((entry, idx) => (
              <div
                key={idx}
                className={`rounded-lg border px-3 py-2 ${
                  entry.match
                    ? 'border-green-700/50 bg-green-900/20'
                    : 'border-gray-700/50 bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-3 pt-3 pb-3">
                    {entry.sequence.map((resId, i) => {
                      const res = resourceMap[resId];
                      if (!res) return null;
                      const c = entry.colorCoding[i];
                      const ring = c === 'green'
                        ? 'ring-2 ring-green-500'
                        : c === 'yellow'
                          ? 'ring-2 ring-yellow-500'
                          : 'ring-2 ring-red-500';
                      const alphaHint = c === 'red' ? entry.alphabeticalHints?.[i] : null;
                      const dirHint = c === 'yellow' ? entry.directionHints?.[i] : null;
                      return (
                        <span
                          key={i}
                          className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white ${ring}`}
                          style={{ backgroundColor: res.color }}
                        >
                          {res.initialLetter}
                          {alphaHint && (
                            <HintArrow dir={alphaHint} color="text-red-400" size="sm" />
                          )}
                          {dirHint && (
                            <HintArrow dir={dirHint} color="text-yellow-400" size="sm" />
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <span className="ml-auto flex items-center gap-2">
                    {entry.distinctResourceCount !== undefined && (
                      <span className="text-xs text-indigo-400">{entry.distinctResourceCount} {t('productionGood.distinctCount')}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {Math.round(entry.similarity * 100)}%
                    </span>
                  </span>
                </div>
                {entry.match && entry.recipeId && (
                  <p className="text-green-400 text-xs font-medium">
                    {t('lab.recipeUnlocked')}: {t(`item.${entry.recipeId}`)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Known Recipes grouped by tier */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          {t('lab.knownRecipes')} ({player.knownRecipes.length}/{recipes.length})
        </h3>
        {player.knownRecipes.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('lab.noRecipesYet')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {([1, 2, 3, 4] as const).map(tier => {
              const tierRecipes = recipes
                .filter(r => r.tier === tier && player.knownRecipes.includes(r.id))
                .sort((a, b) => t(`item.${a.id}`).localeCompare(t(`item.${b.id}`)));
              const stats = tierStats[tier];
              if (!stats || stats.total === 0) return null;

              return (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColorClass(tier)}`}>
                      Tier {tier}
                    </span>
                    <span className="text-xs text-gray-500">
                      {stats.known}/{stats.total}
                    </span>
                    {stats.known >= stats.total && (
                      <span className="text-xs text-green-500">✓</span>
                    )}
                  </div>
                  {tierRecipes.length === 0 ? (
                    <p className="text-gray-600 text-xs pl-1">{t('lab.noneDiscovered')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {tierRecipes.map(recipe => (
                        <div key={recipe.id} className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-1.5">
                          <span className="text-white text-sm flex-1 truncate">{t(`item.${recipe.id}`)}</span>
                          <div className="flex gap-0.5">
                            {recipe.sequence.map((resId, i) => {
                              const r = resourceMap[resId];
                              if (!r) return null;
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-bold text-white"
                                  style={{ backgroundColor: r.color }}
                                >
                                  {r.initialLetter}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function tierColorClass(tier: number): string {
  const colors: Record<number, string> = {
    1: 'bg-gray-600 text-gray-300',
    2: 'bg-green-800 text-green-300',
    3: 'bg-blue-800 text-blue-300',
    4: 'bg-purple-800 text-purple-300',
  };
  return colors[tier] ?? colors[1];
}
