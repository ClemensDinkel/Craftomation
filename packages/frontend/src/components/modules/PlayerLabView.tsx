import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, Recipe, WSMessage, LabColor } from '@craftomation/shared';
import { Button, Dialog } from '@/components/ui';

interface Props {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  send: (msg: WSMessage) => void;
  onBack: () => void;
}

const TECH_LEVEL = 1; // Hardcoded for now — expandable later
const MAX_SLOTS = 6;

function getAvailableSlots(): number {
  // Slots 1-3 always, 4 at tech 2, 5 at tech 3, 6 at tech 4
  return Math.min(MAX_SLOTS, 3 + Math.max(0, TECH_LEVEL - 1));
}

export function PlayerLabView({ player, resources, recipes, send, onBack }: Props) {
  const { t } = useLocale();
  const { state, dispatch } = useGame();
  const [slots, setSlots] = useState<(string | null)[]>(Array(MAX_SLOTS).fill(null));
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [resultColors, setResultColors] = useState<LabColor[] | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const availableSlots = getAvailableSlots();

  const resourceMap = useMemo(() => {
    const map: Record<string, Resource> = {};
    for (const r of resources) map[r.id] = r;
    return map;
  }, [resources]);

  // Count how many of each resource is used in current slots
  const usedResources = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const resId of slots) {
      if (resId) counts[resId] = (counts[resId] ?? 0) + 1;
    }
    return counts;
  }, [slots]);

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

    if (result.match && result.recipeUnlocked) {
      setResultMessage(t('lab.recipeUnlocked') + ': ' + t(`item.${result.recipeUnlocked.id}`));
    } else if (result.similarity !== undefined) {
      const pct = Math.round(result.similarity * 100);
      setResultMessage(`${t('lab.similarity')}: ${pct}%`);
    }

    dispatch({ type: 'CLEAR_LAB_RESULT' });
  }, [state.labResult, dispatch, t]);

  const filledSlots = slots.slice(0, availableSlots).filter(Boolean);
  const canExperiment = filledSlots.length >= 3 && !waiting;

  const handleSlotClick = useCallback((resId: string) => {
    // If showing results, clear first
    if (resultColors) {
      setResultColors(null);
      setResultMessage(null);
      setSlots(Array(MAX_SLOTS).fill(null));
      return;
    }

    setSlots(prev => {
      const next = [...prev];
      // Find first empty available slot
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
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-900 -mx-4 -mt-4 px-4 pt-4 pb-3 border-b border-gray-800 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('common.back')}
        </Button>
        <h2 className="text-lg font-bold text-white truncate">{player.name}</h2>
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={() => setInventoryOpen(true)}>
            {t('manufacturing.inventory')}
          </Button>
        </div>
      </div>

      {/* Inventory Dialog */}
      <InventoryDialog
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        player={player}
        resourceMap={resourceMap}
      />

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
            const disabled = available <= 0 || !!resultColors;

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
                <span className="text-[10px] text-gray-500 font-mono">{available}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Known Recipes */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          {t('lab.knownRecipes')} ({player.knownRecipes.length}/{recipes.length})
        </h3>
        {player.knownRecipes.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('lab.noRecipesYet')}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recipes
              .filter(r => player.knownRecipes.includes(r.id))
              .sort((a, b) => a.tier - b.tier || t(`item.${a.id}`).localeCompare(t(`item.${b.id}`)))
              .map(recipe => (
                <div key={recipe.id} className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-1.5">
                  <span className="text-white text-sm flex-1 truncate">{t(`item.${recipe.id}`)}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColor(recipe.tier)}`}>
                    T{recipe.tier}
                  </span>
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
      </section>
    </div>
  );
}

function tierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: 'bg-gray-600 text-gray-300',
    2: 'bg-green-800 text-green-300',
    3: 'bg-blue-800 text-blue-300',
    4: 'bg-purple-800 text-purple-300',
  };
  return colors[tier] ?? colors[1];
}

function InventoryDialog({ open, onClose, player, resourceMap }: {
  open: boolean;
  onClose: () => void;
  player: Player;
  resourceMap: Record<string, Resource>;
}) {
  const { t } = useLocale();

  const resourceEntries = Object.entries(player.resources).filter(([, v]) => v > 0);
  const consumableEntries = Object.entries(player.consumables).filter(([, v]) => v > 0);

  return (
    <Dialog open={open} onClose={onClose} title={t('manufacturing.inventory')}>
      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto">
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-1">{t('manufacturing.resources')}</h4>
          {resourceEntries.length === 0 ? (
            <p className="text-gray-500 text-xs">{t('manufacturing.noItems')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {resourceEntries.map(([resId, amount]) => {
                const res = resourceMap[resId];
                return (
                  <div key={resId} className="flex items-center gap-2 text-sm">
                    {res && (
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: res.color }}
                      >
                        {res.initialLetter}
                      </span>
                    )}
                    <span className="text-gray-300 flex-1">{res?.name ?? resId}</span>
                    <span className="text-white font-mono">{Math.floor(amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-1">{t('manufacturing.consumables')}</h4>
          {consumableEntries.length === 0 ? (
            <p className="text-gray-500 text-xs">{t('manufacturing.noItems')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {consumableEntries.map(([itemId, amount]) => (
                <div key={itemId} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-300 flex-1">{t(`item.${itemId}`)}</span>
                  <span className="text-white font-mono">{amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
