import { useState, useMemo } from 'react';
import { useLocale } from '@/i18n';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, Recipe, MarketState, WSMessage, ProductionGoodDefinition, AutoTradeRule } from '@craftomation/shared';
import { Button, Input, Dialog, Select, ActiveGoodsDurability } from '@/components/ui';
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

type Tab = 'goods' | 'recipes' | 'rights' | 'pgGoods' | 'autoTrade' | 'debug';

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

  const handleSetAutoTradeRule = (rule: Omit<AutoTradeRule, 'id'> & { id?: string }) => {
    send({ type: WSMessageType.SET_AUTO_TRADE_RULE, payload: { playerId: player.id, rule } });
  };

  const handleRemoveAutoTradeRule = (ruleId: string) => {
    send({ type: WSMessageType.REMOVE_AUTO_TRADE_RULE, payload: { playerId: player.id, ruleId } });
  };

  const handleDebugSetInventory = (itemId: string, itemType: 'resource' | 'consumable' | 'production_good' | 'cash', amount: number) => {
    send({ type: WSMessageType.DEBUG_SET_INVENTORY, payload: { playerId: player.id, itemId, itemType, amount } });
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
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            {t('common.back')}
          </Button>
          <h2 className="text-lg font-bold text-white truncate">{player.name}</h2>
          <span className="ml-auto text-lg font-bold text-green-400">${Math.floor(player.cash)}</span>
        </div>
        <ActiveGoodsDurability player={player} pgDefs={pgDefs} module="auction" />

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
          <button
            onClick={() => setTab('autoTrade')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'autoTrade' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('auction.tabAutoTrade')}
          </button>
          <button
            onClick={() => setTab('debug')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === 'debug' ? 'bg-red-900 text-red-300' : 'text-red-500/60 hover:text-red-400'
            }`}
          >
            Debug
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

      {tab === 'autoTrade' && market && (
        <AutoTradeTab
          player={player}
          resources={resources}
          recipes={recipes}
          market={market}
          pgDefs={pgDefs}
          onSetRule={handleSetAutoTradeRule}
          onRemoveRule={handleRemoveAutoTradeRule}
        />
      )}

      {tab === 'debug' && (
        <DebugTab
          player={player}
          resources={resources}
          recipes={recipes}
          pgDefs={pgDefs}
          onSetInventory={handleDebugSetInventory}
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

function TradeRow({ label, owned, supply, price, cash, consumptionRate, sellableCount, onBuy, onSell }: {
  label: React.ReactNode;
  owned: number;
  supply: number;
  price: number;
  cash: number;
  consumptionRate?: number;
  sellableCount?: number;
  onBuy: (amount: number) => void;
  onSell: (amount: number) => void;
}) {
  const roundedPrice = Math.round(price * 100) / 100;
  const canBuy1 = cash >= roundedPrice && supply >= 1;
  const canBuy5 = cash >= roundedPrice * 5 && supply >= 5;
  const sellable = sellableCount ?? owned;
  const canSell1 = sellable >= 1;
  const canSell5 = sellable >= 5;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-1.5">
      <div className="flex-1 min-w-0 truncate">{label}</div>
      <span className="text-xs text-blue-400 font-mono w-8 text-right shrink-0">
        {sellable}{sellableCount !== undefined && sellable < owned ? '*' : ''}
      </span>
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
          {consumptionRate > 0 ? consumptionRate.toFixed(2) : '-'}
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
                          sellableCount={unusedCount}
                          onBuy={amount => onBuy(id, 'production_good', amount)}
                          onSell={amount => onSell(id, 'production_good', amount)}
                        />
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

// === Auto-Trade Tab ===

function AutoTradeTab({ player, resources, recipes, market, pgDefs, onSetRule, onRemoveRule }: {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  market: MarketState;
  pgDefs: Map<string, ProductionGoodDefinition>;
  onSetRule: (rule: Omit<AutoTradeRule, 'id'> & { id?: string }) => void;
  onRemoveRule: (ruleId: string) => void;
}) {
  const { t } = useLocale();
  const hasAutoTrade = getActiveBonus(player, 'auto_trade', pgDefs) > 0;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [ruleItemId, setRuleItemId] = useState('');
  const [ruleItemType, setRuleItemType] = useState<'resource' | 'consumable'>('resource');
  const [ruleAction, setRuleAction] = useState<'buy' | 'sell'>('buy');
  const [ruleThreshold, setRuleThreshold] = useState('');

  const rules = player.autoTradeRules ?? [];

  // Build item options
  const resourceOptions = resources.map(r => ({ value: r.id, label: r.name, type: 'resource' as const }));
  const consumableOptions = recipes
    .filter(r => r.type === 'consumable' && market.consumables[r.id])
    .map(r => ({ value: r.id, label: t(`item.${r.id}`), type: 'consumable' as const }));

  const handleAddRule = () => {
    if (!ruleItemId || !ruleThreshold) return;
    const threshold = parseFloat(ruleThreshold);
    if (isNaN(threshold) || threshold <= 0) return;

    onSetRule({
      itemId: ruleItemId,
      itemType: ruleItemType,
      buyBelowPrice: ruleAction === 'buy' ? threshold : undefined,
      sellAbovePrice: ruleAction === 'sell' ? threshold : undefined,
    });
    setAddDialogOpen(false);
    setRuleThreshold('');
  };

  const getItemLabel = (rule: AutoTradeRule) => {
    if (rule.itemType === 'resource') {
      const res = resources.find(r => r.id === rule.itemId);
      return res?.name ?? rule.itemId;
    }
    return t(`item.${rule.itemId}`);
  };

  const getCurrentPrice = (rule: AutoTradeRule) => {
    const entries = rule.itemType === 'resource' ? market.resources : market.consumables;
    return entries[rule.itemId]?.price ?? 0;
  };

  if (!hasAutoTrade) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">{t('auction.noAutoTrade')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <p className="text-xs text-gray-500">{t('auction.autoTradeInfo')}</p>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">{t('auction.noRules')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map(rule => {
            const isBuy = rule.buyBelowPrice !== undefined;
            const threshold = isBuy ? rule.buyBelowPrice! : rule.sellAbovePrice!;
            const currentPrice = getCurrentPrice(rule);
            const isActive = isBuy ? currentPrice <= threshold : currentPrice >= threshold;

            return (
              <div
                key={rule.id}
                className={`rounded-lg border px-3 py-2 ${
                  isActive ? 'border-green-700/50 bg-green-900/20' : 'border-gray-700/50 bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    isBuy ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                  }`}>
                    {isBuy ? t('auction.buyBelow') : t('auction.sellAbove')}
                  </span>
                  <span className="text-white text-sm flex-1 truncate">{getItemLabel(rule)}</span>
                  <span className="text-xs text-gray-400 font-mono">${currentPrice.toFixed(1)}</span>
                  <span className="text-xs text-green-400 font-mono font-bold">${threshold}</span>
                  <button
                    onClick={() => onRemoveRule(rule.id)}
                    className="text-gray-500 hover:text-red-400 text-sm transition-colors px-1"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add rule button */}
      <Button size="sm" onClick={() => {
        if (resourceOptions.length > 0) {
          setRuleItemId(resourceOptions[0].value);
          setRuleItemType('resource');
        }
        setAddDialogOpen(true);
      }}>
        {t('auction.addRule')}
      </Button>

      {/* Add rule dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title={t('auction.addRule')}>
        <div className="flex flex-col gap-3">
          {/* Item type */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRuleItemType('resource');
                if (resourceOptions.length > 0) setRuleItemId(resourceOptions[0].value);
              }}
              className={`flex-1 py-1.5 text-sm rounded-lg ${
                ruleItemType === 'resource' ? 'bg-gray-700 text-white' : 'text-gray-400'
              }`}
            >
              {t('auction.resources')}
            </button>
            <button
              onClick={() => {
                setRuleItemType('consumable');
                if (consumableOptions.length > 0) setRuleItemId(consumableOptions[0].value);
              }}
              className={`flex-1 py-1.5 text-sm rounded-lg ${
                ruleItemType === 'consumable' ? 'bg-gray-700 text-white' : 'text-gray-400'
              }`}
            >
              {t('auction.consumables')}
            </button>
          </div>

          {/* Item select */}
          <Select
            label={t('auction.item')}
            options={ruleItemType === 'resource' ? resourceOptions : consumableOptions}
            value={ruleItemId}
            onChange={e => setRuleItemId(e.target.value)}
          />

          {/* Buy/Sell */}
          <div className="flex gap-2">
            <button
              onClick={() => setRuleAction('buy')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg ${
                ruleAction === 'buy' ? 'bg-green-800 text-green-300' : 'text-gray-400'
              }`}
            >
              {t('auction.buyBelow')}
            </button>
            <button
              onClick={() => setRuleAction('sell')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg ${
                ruleAction === 'sell' ? 'bg-red-800 text-red-300' : 'text-gray-400'
              }`}
            >
              {t('auction.sellAbove')}
            </button>
          </div>

          {/* Threshold */}
          <Input
            type="number"
            placeholder={t('auction.threshold')}
            value={ruleThreshold}
            onChange={e => setRuleThreshold(e.target.value)}
            min="1"
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleAddRule}
              disabled={!ruleItemId || !ruleThreshold || parseFloat(ruleThreshold) <= 0}
            >
              {t('auction.addRule')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// === Debug Tab ===

function DebugTab({ player, resources, recipes, pgDefs, onSetInventory }: {
  player: Player;
  resources: Resource[];
  recipes: Recipe[];
  pgDefs: Map<string, ProductionGoodDefinition>;
  onSetInventory: (itemId: string, itemType: 'resource' | 'consumable' | 'production_good' | 'cash', amount: number) => void;
}) {
  const { t } = useLocale();

  const consumableRecipes = useMemo(
    () => recipes.filter(r => r.type === 'consumable').sort((a, b) => a.tier - b.tier || t(`item.${a.id}`).localeCompare(t(`item.${b.id}`))),
    [recipes, t],
  );

  const pgDefList = useMemo(
    () => Array.from(pgDefs.values()).sort((a, b) => a.tier - b.tier || t(`item.${a.id}`).localeCompare(t(`item.${b.id}`))),
    [pgDefs, t],
  );

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">
      <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2">
        <p className="text-red-400 text-xs font-medium">DEBUG — Spielervorrat direkt manipulieren</p>
      </div>

      {/* Cash */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Cash</h3>
        <DebugRow
          label={<span className="text-green-400 font-bold">$</span>}
          name="Cash"
          value={Math.floor(player.cash)}
          onChange={v => onSetInventory('cash', 'cash', v)}
        />
      </section>

      {/* Resources */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-2">{t('auction.resources')}</h3>
        <div className="flex flex-col gap-1">
          {resources.map(res => (
            <DebugRow
              key={res.id}
              label={
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: res.color }}
                >
                  {res.initialLetter}
                </span>
              }
              name={res.name}
              value={Math.floor(player.resources[res.id] ?? 0)}
              onChange={v => onSetInventory(res.id, 'resource', v)}
            />
          ))}
        </div>
      </section>

      {/* Consumables */}
      {consumableRecipes.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-2">{t('auction.consumables')}</h3>
          <div className="flex flex-col gap-1">
            {consumableRecipes.map(recipe => (
              <DebugRow
                key={recipe.id}
                label={<TierDot tier={recipe.tier} />}
                name={t(`item.${recipe.id}`)}
                value={Math.floor(player.consumables[recipe.id] ?? 0)}
                onChange={v => onSetInventory(recipe.id, 'consumable', v)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Production Goods */}
      {pgDefList.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-2">{t('auction.tabProductionGoods')}</h3>
          <div className="flex flex-col gap-1">
            {pgDefList.map(def => {
              const items = player.productionGoods[def.id] ?? [];
              return (
                <DebugRow
                  key={def.id}
                  label={<TierDot tier={def.tier} />}
                  name={t(`item.${def.id}`)}
                  value={items.length}
                  onChange={v => onSetInventory(def.id, 'production_good', v)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function DebugRow({ label, name, value, onChange }: {
  label: React.ReactNode;
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded bg-gray-800/60 px-2 py-1.5">
      <span className="shrink-0">{label}</span>
      <span className="flex-1 text-white text-sm truncate">{name}</span>
      <span className="text-white font-mono text-sm w-10 text-right">{value}</span>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onChange(Math.max(0, value - 10))}
          className="px-1.5 py-0.5 text-xs rounded bg-red-900/60 text-red-300 hover:bg-red-800/60"
        >
          -10
        </button>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="px-1.5 py-0.5 text-xs rounded bg-red-900/60 text-red-300 hover:bg-red-800/60"
        >
          -1
        </button>
        <button
          onClick={() => onChange(value + 1)}
          className="px-1.5 py-0.5 text-xs rounded bg-green-900/60 text-green-300 hover:bg-green-800/60"
        >
          +1
        </button>
        <button
          onClick={() => onChange(value + 10)}
          className="px-1.5 py-0.5 text-xs rounded bg-green-900/60 text-green-300 hover:bg-green-800/60"
        >
          +10
        </button>
      </div>
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
