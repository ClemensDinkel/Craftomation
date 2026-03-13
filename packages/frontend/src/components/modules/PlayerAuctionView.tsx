import { useState, useMemo } from 'react';
import { useLocale } from '@/i18n';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, Recipe, MarketState, WSMessage, ProductionGoodDefinition } from '@craftomation/shared';
import { Button, Input, Dialog, Select } from '@/components/ui';
import { useProductionGoodDefs, getActiveBonus } from '@/hooks/useProductionGoods';

interface Props {
  player: Player;
  players: Player[];
  resources: Resource[];
  recipes: Recipe[];
  market: MarketState | null;
  send: (msg: WSMessage) => void;
  onBack: () => void;
}

type Tab = 'goods' | 'recipes' | 'rights' | 'pgGoods';

export function PlayerAuctionView({ player, players, resources, recipes, market, send, onBack }: Props) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('goods');
  const pgDefs = useProductionGoodDefs();
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listRecipeId, setListRecipeId] = useState('');
  const [listPrice, setListPrice] = useState('');

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const handleBuy = (itemId: string, itemType: 'resource' | 'consumable' | 'production_good', amount: number) => {
    send({ type: WSMessageType.MARKET_BUY, payload: { playerId: player.id, itemId, itemType, amount } });
  };

  const handleSell = (itemId: string, itemType: 'resource' | 'consumable' | 'production_good', amount: number) => {
    send({ type: WSMessageType.MARKET_SELL, payload: { playerId: player.id, itemId, itemType, amount } });
  };

  const handleBuyMiningRight = (resourceId: string) => {
    send({ type: WSMessageType.BUY_MINING_RIGHT, payload: { playerId: player.id, resourceId } });
  };

  const handleBuyRecipe = (listingId: string) => {
    send({ type: WSMessageType.BUY_RECIPE, payload: { buyerPlayerId: player.id, listingId } });
  };

  const handleListRecipe = () => {
    if (!listRecipeId || !listPrice) return;
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) return;
    send({ type: WSMessageType.LIST_RECIPE, payload: { playerId: player.id, recipeId: listRecipeId, price } });
    setListDialogOpen(false);
    setListRecipeId('');
    setListPrice('');
  };

  // Recipes player can list (known, not already listed by them)
  const listableRecipes = useMemo(() => {
    if (!market) return [];
    const listedByPlayer = new Set(
      market.recipeListings.filter(l => l.sellerId === player.id).map(l => l.recipeId),
    );
    return player.knownRecipes
      .filter(id => !listedByPlayer.has(id))
      .map(id => ({ value: id, label: t(`item.${id}`) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [player.knownRecipes, market, player.id, t]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-900 -mx-4 -mt-4 px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            {t('common.back')}
          </Button>
          <h2 className="text-lg font-bold text-white truncate">{player.name}</h2>
          <span className="ml-auto text-lg font-bold text-green-400">${Math.floor(player.cash)}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab('goods')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'goods' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('auction.tabGoods')}
          </button>
          <button
            onClick={() => setTab('pgGoods')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'pgGoods' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('auction.tabProductionGoods')}
          </button>
          <button
            onClick={() => setTab('recipes')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'recipes' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('auction.tabRecipes')}
          </button>
          <button
            onClick={() => setTab('rights')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'rights' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('auction.tabRights')}
          </button>
        </div>
      </div>

      {tab === 'goods' && market && (
        <GoodsTab
          player={player}
          resources={resources}
          recipes={recipes}
          market={market}
          pgDefs={pgDefs}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      )}

      {tab === 'pgGoods' && market && (
        <ProductionGoodsTab
          player={player}
          market={market}
          pgDefs={pgDefs}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      )}

      {tab === 'rights' && market && (
        <RightsTab
          player={player}
          resources={resources}
          market={market}
          playerMap={playerMap}
          maxSlots={Math.max(1, Math.floor(players.length / 10))}
          onBuyRight={handleBuyMiningRight}
        />
      )}

      {tab === 'recipes' && market && (
        <RecipesTab
          player={player}
          market={market}
          recipes={recipes}
          playerMap={playerMap}
          onBuyRecipe={handleBuyRecipe}
          onOpenListDialog={() => {
            if (listableRecipes.length > 0) setListRecipeId(listableRecipes[0].value);
            setListDialogOpen(true);
          }}
          listableCount={listableRecipes.length}
        />
      )}

      {/* List Recipe Dialog */}
      <Dialog open={listDialogOpen} onClose={() => setListDialogOpen(false)} title={t('auction.listRecipe')}>
        <div className="flex flex-col gap-4">
          {listableRecipes.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('auction.noRecipesToList')}</p>
          ) : (
            <>
              <Select
                label={t('auction.recipe')}
                options={listableRecipes}
                value={listRecipeId}
                onChange={e => setListRecipeId(e.target.value)}
              />
              <Input
                type="number"
                placeholder={t('auction.pricePlaceholder')}
                value={listPrice}
                onChange={e => setListPrice(e.target.value)}
                min="1"
              />
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setListDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            {listableRecipes.length > 0 && (
              <Button
                size="sm"
                onClick={handleListRecipe}
                disabled={!listRecipeId || !listPrice || parseFloat(listPrice) <= 0}
              >
                {t('auction.list')}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// === Goods Tab ===

function GoodsTab({ player, resources, recipes, market, pgDefs, onBuy, onSell }: {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  market: MarketState;
  pgDefs: Map<string, ProductionGoodDefinition>;
  onBuy: (itemId: string, itemType: 'resource' | 'consumable' | 'production_good', amount: number) => void;
  onSell: (itemId: string, itemType: 'resource' | 'consumable' | 'production_good', amount: number) => void;
}) {
  const { t } = useLocale();
  const marketInfoLevel = getActiveBonus(player, 'market_info', pgDefs);

  // Group consumables by tier, sorted by name within each tier
  const consumablesByTier = useMemo(() => {
    const items = recipes
      .filter(r => market.consumables[r.id])
      .sort((a, b) => a.tier - b.tier || t(`item.${a.id}`).localeCompare(t(`item.${b.id}`)));

    const grouped: Record<number, Recipe[]> = {};
    for (const r of items) {
      (grouped[r.tier] ??= []).push(r);
    }
    return grouped;
  }, [recipes, market.consumables, t]);

  const tiers = [1, 2, 3, 4] as const;
  const hasConsumables = Object.keys(consumablesByTier).length > 0;

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">
      {/* Resources */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('auction.resources')}</h3>
        <TradeColumnHeaders showConsumption={marketInfoLevel >= 1} />
        <div className="flex flex-col gap-1">
          {resources.map(res => {
            const entry = market.resources[res.id];
            if (!entry) return null;
            const owned = Math.floor(player.resources[res.id] ?? 0);
            return (
              <TradeRow
                key={res.id}
                label={
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: res.color }}
                    >
                      {res.initialLetter}
                    </span>
                    <span className="text-white">{res.name}</span>
                  </span>
                }
                owned={owned}
                supply={entry.supply}
                price={entry.price}
                cash={player.cash}
                consumptionRate={marketInfoLevel >= 1 ? entry.baseConsumptionRate : undefined}
                onBuy={amount => onBuy(res.id, 'resource', amount)}
                onSell={amount => onSell(res.id, 'resource', amount)}
              />
            );
          })}
        </div>
      </section>

      {/* Consumables grouped by tier */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('auction.consumables')}</h3>
        {!hasConsumables ? (
          <p className="text-gray-600 text-sm">{t('auction.noItems')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <TradeColumnHeaders showConsumption={marketInfoLevel >= 1} />
            {tiers.map(tier => {
              const items = consumablesByTier[tier];
              if (!items || items.length === 0) return null;
              return (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColorClass(tier)}`}>
                      Tier {tier}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.map(recipe => {
                      const entry = market.consumables[recipe.id];
                      if (!entry) return null;
                      const owned = Math.floor(player.consumables[recipe.id] ?? 0);
                      return (
                        <TradeRow
                          key={recipe.id}
                          label={
                            <span className="flex items-center gap-2">
                              <TierDot tier={recipe.tier} />
                              <span className="text-white">{t(`item.${recipe.id}`)}</span>
                            </span>
                          }
                          owned={owned}
                          supply={entry.supply}
                          price={entry.price}
                          cash={player.cash}
                          consumptionRate={marketInfoLevel >= 1 ? entry.baseConsumptionRate : undefined}
                          onBuy={amount => onBuy(recipe.id, 'consumable', amount)}
                          onSell={amount => onSell(recipe.id, 'consumable', amount)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// === Trade Row ===

function TradeColumnHeaders({ showConsumption }: { showConsumption?: boolean } = {}) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider">
      <div className="flex-1 min-w-0" />
      <span className="w-8 text-right shrink-0">{t('auction.colPlayer')}</span>
      <div className="w-[8.5rem] shrink-0" />
      <span className="w-8 text-right shrink-0">{t('auction.colMarket')}</span>
      <span className="w-12 text-right shrink-0">{t('auction.colPrice')}</span>
      {showConsumption && (
        <span className="w-8 text-right shrink-0">{t('auction.colConsumption')}</span>
      )}
    </div>
  );
}

function TradeRow({ label, owned, supply, price, cash, consumptionRate, onBuy, onSell }: {
  label: React.ReactNode;
  owned: number;
  supply: number;
  price: number;
  cash: number;
  consumptionRate?: number;
  onBuy: (amount: number) => void;
  onSell: (amount: number) => void;
}) {
  const roundedPrice = Math.round(price * 100) / 100;
  const canBuy1 = cash >= roundedPrice && supply >= 1;
  const canBuy5 = cash >= roundedPrice * 5 && supply >= 5;
  const canSell1 = owned >= 1;
  const canSell5 = owned >= 5;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-1.5">
      <div className="flex-1 min-w-0 truncate">{label}</div>
      <span className="text-xs text-blue-400 font-mono w-8 text-right shrink-0">{owned}</span>
      <div className="flex gap-0.5 shrink-0">
        <TradeButton label="-5" disabled={!canSell5} onClick={() => onSell(5)} variant="sell" />
        <TradeButton label="-" disabled={!canSell1} onClick={() => onSell(1)} variant="sell" />
        <TradeButton label="+" disabled={!canBuy1} onClick={() => onBuy(1)} variant="buy" />
        <TradeButton label="+5" disabled={!canBuy5} onClick={() => onBuy(5)} variant="buy" />
      </div>
      <span className="text-xs text-gray-400 font-mono w-8 text-right shrink-0">{Math.floor(supply)}</span>
      <span className="text-xs text-green-400 font-mono w-12 text-right shrink-0">${roundedPrice}</span>
      {consumptionRate !== undefined && (
        <span className="text-[10px] text-orange-400 font-mono w-8 text-right shrink-0" title="Consumption/tick">
          {consumptionRate > 0 ? consumptionRate.toFixed(1) : '-'}
        </span>
      )}
    </div>
  );
}

function TradeButton({ label, disabled, onClick, variant }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  variant: 'buy' | 'sell';
}) {
  const base = variant === 'buy'
    ? 'bg-green-800 hover:bg-green-700 text-green-300'
    : 'bg-red-800 hover:bg-red-700 text-red-300';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-7 rounded text-xs font-bold transition-colors ${
        disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : base
      }`}
    >
      {label}
    </button>
  );
}

// === Recipes Tab ===

function RecipesTab({ player, market, recipes, playerMap, onBuyRecipe, onOpenListDialog, listableCount }: {
  player: Player;
  market: MarketState;
  recipes: Recipe[];
  playerMap: Record<string, Player>;
  onBuyRecipe: (listingId: string) => void;
  onOpenListDialog: () => void;
  listableCount: number;
}) {
  const { t } = useLocale();
  const knownSet = new Set(player.knownRecipes);

  const recipeMap = useMemo(() => {
    const map: Record<string, Recipe> = {};
    for (const r of recipes) map[r.id] = r;
    return map;
  }, [recipes]);

  const listings = useMemo(() => {
    return [...market.recipeListings].sort((a, b) => {
      const nameA = t(`item.${a.recipeId}`);
      const nameB = t(`item.${b.recipeId}`);
      return nameA.localeCompare(nameB);
    });
  }, [market.recipeListings, t]);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto relative pb-16">
      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{t('auction.noListings')}</p>
      ) : (
        listings.map(listing => {
          const recipe = recipeMap[listing.recipeId];
          const seller = playerMap[listing.sellerId];
          const alreadyKnown = knownSet.has(listing.recipeId);
          const isOwnListing = listing.sellerId === player.id;
          const canAfford = player.cash >= listing.price;

          return (
            <div
              key={listing.id}
              className="rounded-lg border border-gray-700/50 bg-gray-800/60 px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1">
                {recipe && <TierDot tier={recipe.tier} />}
                <span className="text-white font-medium">{t(`item.${listing.recipeId}`)}</span>
                <span className="ml-auto text-green-400 font-mono font-bold">${listing.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {t('auction.seller')}: {seller?.name ?? '?'}
                </span>
                {isOwnListing ? (
                  <span className="text-xs text-gray-500 italic">{t('auction.ownListing')}</span>
                ) : alreadyKnown ? (
                  <span className="text-xs text-gray-500 italic">{t('auction.alreadyKnown')}</span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onBuyRecipe(listing.id)}
                    disabled={!canAfford}
                  >
                    {t('auction.buy')}
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Floating add button */}
      {listableCount > 0 && (
        <button
          onClick={onOpenListDialog}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-2xl font-bold shadow-lg transition-colors flex items-center justify-center"
        >
          +
        </button>
      )}
    </div>
  );
}

// === Rights Tab ===

function RightsTab({ player, resources, market, playerMap, maxSlots, onBuyRight }: {
  player: Player;
  resources: Resource[];
  market: MarketState;
  playerMap: Record<string, Player>;
  maxSlots: number;
  onBuyRight: (resourceId: string) => void;
}) {
  const { t } = useLocale();
  const now = Date.now();

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      <p className="text-xs text-gray-500 mb-1">{t('auction.rightsInfo')}</p>
      {resources.map(res => {
        const rights = (market.miningRights[res.id] ?? []).filter(r => now < r.expiresAt);
        const playerHoldsRight = rights.some(r => r.holderId === player.id);
        const openSlots = maxSlots - rights.length;
        const hasAnyRight = rights.length > 0;

        const resourceEntry = market.resources[res.id];

        // Buy price: open slot = resourcePrice × 20, full = cheapest.pricePaid × 1.5
        let nextPrice: number;
        if (openSlots > 0) {
          nextPrice = Math.round((resourceEntry?.price ?? 5) * 20 * 100) / 100;
        } else {
          const cheapest = rights.reduce((min, r) => r.pricePaid < min.pricePaid ? r : min, rights[0]);
          nextPrice = Math.round(cheapest.pricePaid * 1.5 * 100) / 100;
        }

        const canAfford = player.cash >= nextPrice;

        // Determine card border style
        const borderClass = playerHoldsRight
          ? 'border-amber-600/50 bg-amber-900/20'
          : hasAnyRight
            ? 'border-red-700/50 bg-red-900/10'
            : 'border-gray-700/50 bg-gray-800/60';

        return (
          <div key={res.id} className={`rounded-lg border px-3 py-2 ${borderClass}`}>
            {/* Resource header */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: res.color }}
              >
                {res.initialLetter}
              </span>
              <span className="text-white font-medium flex-1">{res.name}</span>
              <span className="text-[10px] text-gray-500">
                {rights.length}/{maxSlots}
              </span>
            </div>

            {/* Current holders */}
            {rights.length > 0 && (
              <div className="flex flex-col gap-0.5 mb-1.5">
                {rights.map(r => {
                  const holder = playerMap[r.holderId];
                  const remainingMin = Math.ceil((r.expiresAt - now) / 60000);
                  const isOwn = r.holderId === player.id;
                  return (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className={isOwn ? 'text-amber-400' : 'text-gray-400'}>
                        {isOwn ? t('auction.yourRight') : (holder?.name ?? '?')}
                      </span>
                      <span className="text-gray-500">{remainingMin} min</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {openSlots > 0
                  ? `${openSlots} ${t('auction.slotsAvailable')}`
                  : t('auction.slotsFull')}
              </span>
              {!playerHoldsRight && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 font-mono">${nextPrice}</span>
                  <Button
                    size="sm"
                    onClick={() => onBuyRight(res.id)}
                    disabled={!canAfford}
                  >
                    {openSlots > 0 ? t('auction.buyRight') : t('auction.overbid')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === Production Goods Tab ===

function ProductionGoodsTab({ player, market, pgDefs, onBuy, onSell }: {
  player: Player;
  market: MarketState;
  pgDefs: Map<string, ProductionGoodDefinition>;
  onBuy: (itemId: string, itemType: 'production_good', amount: number) => void;
  onSell: (itemId: string, itemType: 'production_good', amount: number) => void;
}) {
  const { t } = useLocale();

  // Group production goods by tier
  const pgByTier = useMemo(() => {
    const grouped: Record<number, { id: string; def: ProductionGoodDefinition }[]> = {};
    for (const [itemId, entry] of Object.entries(market.productionGoods)) {
      const def = pgDefs.get(itemId);
      if (!def || !entry) continue;
      (grouped[def.tier] ??= []).push({ id: itemId, def });
    }
    // Sort each tier by name
    for (const items of Object.values(grouped)) {
      items.sort((a, b) => t(`item.${a.id}`).localeCompare(t(`item.${b.id}`)));
    }
    return grouped;
  }, [market.productionGoods, pgDefs, t]);

  const hasPg = Object.keys(pgByTier).length > 0;
  const tiers = [1, 2, 3, 4] as const;
  const marketInfoLevel = getActiveBonus(player, 'market_info', pgDefs);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {!hasPg ? (
        <p className="text-gray-600 text-sm">{t('auction.noItems')}</p>
      ) : (
        <>
          <TradeColumnHeaders showConsumption={marketInfoLevel >= 1} />
          {tiers.map(tier => {
            const items = pgByTier[tier];
            if (!items || items.length === 0) return null;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColorClass(tier)}`}>
                    Tier {tier}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map(({ id }) => {
                    const entry = market.productionGoods[id];
                    if (!entry) return null;
                    // Owned count: total items for this id
                    const ownedItems = player.productionGoods[id] ?? [];
                    const ownedTotal = ownedItems.length;
                    const unusedCount = ownedItems.filter(i => !i.isUsed).length;

                    return (
                      <div key={id}>
                        <TradeRow
                          label={
                            <span className="flex items-center gap-2">
                              <span className="text-amber-400 text-xs">&#9881;</span>
                              <span className="text-white">{t(`item.${id}`)}</span>
                            </span>
                          }
                          owned={ownedTotal}
                          supply={entry.supply}
                          price={entry.price}
                          cash={player.cash}
                          consumptionRate={marketInfoLevel >= 1 ? entry.baseConsumptionRate : undefined}
                          onBuy={amount => onBuy(id, 'production_good', amount)}
                          onSell={amount => {
                            if (unusedCount <= 0) return;
                            onSell(id, 'production_good', Math.min(amount, unusedCount));
                          }}
                        />
                        {ownedTotal > 0 && unusedCount < ownedTotal && (
                          <div className="text-[10px] text-gray-500 pl-7 mt-0.5">
                            {ownedTotal - unusedCount}x {t('productionGood.notTradeable')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// === Helpers ===

function tierColorClass(tier: number): string {
  const colors: Record<number, string> = {
    1: 'bg-gray-600 text-gray-300',
    2: 'bg-green-800 text-green-300',
    3: 'bg-blue-800 text-blue-300',
    4: 'bg-purple-800 text-purple-300',
  };
  return colors[tier] ?? colors[1];
}

function TierDot({ tier }: { tier: number }) {
  const colors: Record<number, string> = {
    1: 'bg-gray-500',
    2: 'bg-green-500',
    3: 'bg-blue-500',
    4: 'bg-purple-500',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[tier] ?? colors[1]}`}
      title={`Tier ${tier}`}
    />
  );
}
