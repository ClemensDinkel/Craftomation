import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocale } from '@/i18n';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, Recipe, WSMessage, ManufacturingJob } from '@craftomation/shared';
import { Button, Dialog, ProductionGoodBadge, ActiveGoodsDurability } from '@/components/ui';
import { useProductionGoodDefs } from '@/hooks/useProductionGoods';

interface Props {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  send: (msg: WSMessage) => void;
  onBack: () => void;
}

const isDev = import.meta.env.DEV;

export function PlayerManufacturingView({ player, resources, recipes, send, onBack }: Props) {
  const { t } = useLocale();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [debugDialogOpen, setDebugDialogOpen] = useState(false);
  const [autoBuy, setAutoBuy] = useState(false);
  const pgDefs = useProductionGoodDefs();

  const knownRecipes = useMemo(() => {
    const known = new Set(player.knownRecipes);
    return recipes
      .filter(r => known.has(r.id))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'consumable' ? -1 : 1;
        return t(`item.${a.id}`).localeCompare(t(`item.${b.id}`));
      });
  }, [player.knownRecipes, recipes, t]);

  const unknownRecipes = useMemo(() => {
    const known = new Set(player.knownRecipes);
    return recipes
      .filter(r => !known.has(r.id))
      .sort((a, b) => a.tier - b.tier || t(`item.${a.id}`).localeCompare(t(`item.${b.id}`)));
  }, [player.knownRecipes, recipes, t]);

  const resourceMap = useMemo(() => {
    const map: Record<string, Resource> = {};
    for (const r of resources) map[r.id] = r;
    return map;
  }, [resources]);

  const handleAddJob = (recipeId: string, repeat: boolean) => {
    send({
      type: WSMessageType.ADD_MANUFACTURING_JOB,
      payload: { playerId: player.id, recipeId, repeat, autoBuy },
    });
  };

  const handleRemoveJob = (jobIndex: number) => {
    send({
      type: WSMessageType.REMOVE_MANUFACTURING_JOB,
      payload: { playerId: player.id, jobIndex },
    });
  };

  const handleDebugUnlock = (recipeId: string) => {
    send({
      type: WSMessageType.DEBUG_UNLOCK_RECIPE,
      payload: { playerId: player.id, recipeId },
    });
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
          <div className="ml-auto flex gap-2">
            {isDev && (
              <Button variant="secondary" size="sm" onClick={() => setDebugDialogOpen(true)}>
                Debug
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setInventoryOpen(true)}>
              {t('manufacturing.inventory')}
            </Button>
          </div>
        </div>
        <ActiveGoodsDurability player={player} pgDefs={pgDefs} module="manufacturing" />
      </div>

      {/* Inventory Dialog */}
      <InventoryDialog
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        player={player}
        resourceMap={resourceMap}
        pgDefs={pgDefs}
      />

      {/* Debug Dialog */}
      {isDev && (
        <Dialog open={debugDialogOpen} onClose={() => setDebugDialogOpen(false)} title="Debug: Unlock Recipe">
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {unknownRecipes.length === 0 && (
              <p className="text-gray-500 text-sm">All recipes unlocked</p>
            )}
            {unknownRecipes.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => { handleDebugUnlock(recipe.id); setDebugDialogOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-left transition-colors"
              >
                <span className="text-white text-sm flex-1">{t(`item.${recipe.id}`)}</span>
                <TierBadge tier={recipe.tier} />
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {/* Auto-Buy Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = !autoBuy;
            setAutoBuy(next);
            send({
              type: WSMessageType.SET_MANUFACTURING_AUTOBUY,
              payload: { playerId: player.id, autoBuy: next },
            });
          }}
          className={`relative w-9 h-5 rounded-full transition-colors ${autoBuy ? 'bg-indigo-600' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoBuy ? 'translate-x-4' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">{t('manufacturing.autoBuy')}</span>
      </div>

      {/* Manufacturing Queue */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('manufacturing.queue')}</h3>
        {player.manufacturingQueue.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('manufacturing.emptyQueue')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {player.manufacturingQueue.map((job, index) => (
              <JobRow
                key={job.id}
                job={job}
                isFirst={index === 0}

                recipeName={t(`item.${job.recipeId}`)}
                onRemove={() => handleRemoveJob(index)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Known Recipes */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('manufacturing.recipes')}</h3>
        {knownRecipes.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('manufacturing.noRecipes')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {knownRecipes.map(recipe => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                resourceMap={resourceMap}
                repeatActive={player.manufacturingQueue.some(j => j.recipeId === recipe.id && j.repeat)}
                onAdd={() => handleAddJob(recipe.id, false)}
                onRepeat={() => handleAddJob(recipe.id, true)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Sub-components ---

function JobRow({ job, isFirst, recipeName, onRemove }: {
  job: ManufacturingJob;
  isFirst: boolean;
  recipeName: string;
  onRemove: () => void;
}) {
  const snapshotRef = useRef({ time: Date.now(), remaining: job.remainingMs });
  const maxProgressRef = useRef(0);
  const [now, setNow] = useState(Date.now());

  // Reset baseline when server updates remainingMs OR when resourcesConsumed flips
  // The latter is critical: remainingMs stays unchanged when the job starts producing,
  // so without this the snapshot time would be stale from initial mount
  useEffect(() => {
    snapshotRef.current = { time: Date.now(), remaining: job.remainingMs };
  }, [job.remainingMs, job.resourcesConsumed]);

  // Reset max progress when a different job enters this slot
  useEffect(() => {
    maxProgressRef.current = 0;
  }, [job.id]);

  // Smooth tick every 200ms for visual interpolation
  useEffect(() => {
    if (!isFirst || !job.resourcesConsumed) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isFirst, job.resourcesConsumed]);

  const elapsed = now - snapshotRef.current.time;
  // gameSpeed is already baked into job.duration — server ticks remainingMs at 1:1 real time
  const interpolatedRemaining = isFirst && job.resourcesConsumed
    ? Math.max(0, snapshotRef.current.remaining - elapsed)
    : job.remainingMs;

  let progress = isFirst && job.resourcesConsumed
    ? Math.min(1, Math.max(0, 1 - interpolatedRemaining / job.duration))
    : 0;

  // Never jump backward — small drift from network latency is hidden
  if (progress > maxProgressRef.current) {
    maxProgressRef.current = progress;
  } else {
    progress = maxProgressRef.current;
  }

  const waiting = isFirst && !job.resourcesConsumed;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm truncate">{recipeName}</span>
          {job.repeat && (
            <span className="text-indigo-400 text-xs font-bold">∞</span>
          )}
          {job.autoBuy && (
            <span className="text-green-400 text-xs font-bold" title="Auto-Buy">$</span>
          )}
          {waiting && (
            <span className="text-amber-400 text-xs">⏳</span>
          )}
        </div>
        {isFirst && job.resourcesConsumed && (
          <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 text-sm transition-colors shrink-0 px-1"
      >
        &times;
      </button>
    </div>
  );
}

function RecipeRow({ recipe, resourceMap, repeatActive, onAdd, onRepeat }: {
  recipe: Recipe;
  resourceMap: Record<string, Resource>;
  repeatActive: boolean;
  onAdd: () => void;
  onRepeat: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {recipe.type === 'production_good' && (
            <span className="text-amber-400 text-xs" title="Production Good">&#9881;</span>
          )}
          <span className="text-white text-sm truncate">{t(`item.${recipe.id}`)}</span>
          <TierBadge tier={recipe.tier} />
        </div>
        <div className="flex flex-wrap gap-1">
          {recipe.sequence.map((resId, i) => {
            const res = resourceMap[resId];
            if (!res) return null;
            return (
              <span
                key={i}
                className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: res.color }}
                title={res.name}
              >
                {res.initialLetter}
              </span>
            );
          })}
        </div>
        {recipe.type === 'production_good' && (
          <p className="text-[11px] text-gray-500 mt-1">{t(`itemDesc.${recipe.id}`)}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onAdd}
          className="w-8 h-8 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold transition-colors flex items-center justify-center"
          title={t('manufacturing.addOnce')}
        >
          +
        </button>
        <button
          onClick={onRepeat}
          className={`w-8 h-8 rounded-md text-lg font-bold transition-colors flex items-center justify-center ${
            repeatActive
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
          }`}
          title={t('manufacturing.repeatToggle')}
        >
          ∞
        </button>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const colors: Record<number, string> = {
    1: 'bg-gray-600 text-gray-300',
    2: 'bg-green-800 text-green-300',
    3: 'bg-blue-800 text-blue-300',
    4: 'bg-purple-800 text-purple-300',
  };

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[tier] ?? colors[1]}`}>
      T{tier}
    </span>
  );
}

function InventoryDialog({ open, onClose, player, resourceMap, pgDefs }: {
  open: boolean;
  onClose: () => void;
  player: Player;
  resourceMap: Record<string, Resource>;
  pgDefs: Map<string, import('@craftomation/shared').ProductionGoodDefinition>;
}) {
  const { t } = useLocale();

  const resourceEntries = Object.entries(player.resources)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (resourceMap[a]?.name ?? a).localeCompare(resourceMap[b]?.name ?? b));
  const consumableEntries = Object.entries(player.consumables).filter(([, v]) => v > 0);
  const pgEntries = Object.entries(player.productionGoods).filter(([, items]) => items.length > 0);

  return (
    <Dialog open={open} onClose={onClose} title={t('manufacturing.inventory')}>
      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-2">
        {/* Resources */}
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

        {/* Consumables */}
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

        {/* Production Goods — only unused, grouped with count */}
        {pgEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1">{t('manufacturing.productionGoods')}</h4>
            <div className="flex flex-col gap-1.5">
              {pgEntries.map(([itemId, items]) => {
                const def = pgDefs.get(itemId);
                if (!def) return null;
                const unusedCount = items.filter(i => !i.isUsed).length;
                if (unusedCount === 0) return null;
                const sampleItem = items.find(i => !i.isUsed)!;
                return (
                  <div key={itemId} className="flex items-center gap-2">
                    <ProductionGoodBadge item={sampleItem} definition={def} compact />
                    {unusedCount > 1 && (
                      <span className="text-xs text-gray-400 font-mono">x{unusedCount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
