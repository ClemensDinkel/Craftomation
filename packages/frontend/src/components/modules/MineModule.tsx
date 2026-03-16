import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, MiningRight, WSMessage, ProductionGoodDefinition } from '@craftomation/shared';
import { Button, Input, Dialog, ActiveGoodsDurability } from '@/components/ui';
import { useProductionGoodDefs } from '@/hooks/useProductionGoods';

interface MineModuleProps {
  send: (msg: WSMessage) => void;
}

export function MineModule({ send }: MineModuleProps) {
  const { t } = useLocale();
  const { state } = useGame();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const players = useMemo(() => {
    if (!state.gameState?.players) return [];
    return Object.values(state.gameState.players).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.gameState?.players]);

  const resources: Resource[] = state.gameState?.resources ?? [];
  const miningRights = state.gameState?.market?.miningRights ?? {};
  const pgDefs = useProductionGoodDefs();

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    send({ type: WSMessageType.ADD_PLAYER, payload: { playerName: newPlayerName.trim() } });
    setNewPlayerName('');
    setDialogOpen(false);
  };

  const handleBoost = (playerId: string) => {
    send({ type: WSMessageType.BOOST_MINE_PLAYER, payload: { playerId } });
  };

  const handleChangeResources = (playerId: string, resourceIds: string[]) => {
    send({ type: WSMessageType.CHANGE_MINE_RESOURCE, payload: { playerId, resourceIds } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{t('mine.title')}</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          {t('mine.addPlayer')}
        </Button>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t('mine.newPlayer')}>
        <div className="flex flex-col gap-4">
          <Input
            placeholder={t('mine.playerNamePlaceholder')}
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer(); }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {players.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('mine.noPlayers')}</p>
        )}
        {players.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            resources={resources}
            miningRights={miningRights}
            pgDefs={pgDefs}
            onBoost={handleBoost}
            onChangeResources={handleChangeResources}
          />
        ))}
      </div>
    </div>
  );
}

interface PlayerRowProps {
  player: Player;
  resources: Resource[];
  miningRights: Record<string, MiningRight[]>;
  pgDefs: Map<string, ProductionGoodDefinition>;
  onBoost: (playerId: string) => void;
  onChangeResources: (playerId: string, resourceIds: string[]) => void;
}

function PlayerRow({ player, resources, miningRights, pgDefs, onBoost, onChangeResources }: PlayerRowProps) {
  const { t } = useLocale();
  const [now, setNow] = useState(Date.now());

  const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
  const isCooldown = !isBoosted && player.mineBoostCooldownUntil !== null && now < player.mineBoostCooldownUntil;
  const isReady = !isBoosted && !isCooldown;

  const hasActiveRights = player.mineResources.some(
    resId => (miningRights[resId] ?? []).some(r => now < r.expiresAt),
  );

  // Tick every second while boost, cooldown, or mining rights are active
  useEffect(() => {
    if (!player.mineBoostUntil && !player.mineBoostCooldownUntil && !hasActiveRights) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [player.mineBoostUntil, player.mineBoostCooldownUntil, hasActiveRights]);

  const remainingSeconds = isBoosted
    ? Math.ceil((player.mineBoostUntil! - now) / 1000)
    : isCooldown
      ? Math.ceil((player.mineBoostCooldownUntil! - now) / 1000)
      : 0;

  // Check which of the player's selected resources have active rights
  const heldRights = player.mineResources.filter(
    resId => (miningRights[resId] ?? []).some(r => now < r.expiresAt && r.holderId === player.id),
  );
  const penalizedResources = player.mineResources.filter(resId => {
    const rights = (miningRights[resId] ?? []).filter(r => now < r.expiresAt);
    return rights.length > 0 && !rights.some(r => r.holderId === player.id);
  });

  const bgClass = isBoosted
    ? 'bg-green-900/40 border-green-700/50'
    : heldRights.length > 0
      ? 'bg-gray-800/60 border-green-600/60'
      : 'bg-gray-800/60 border-gray-700/50';

  const selectedIds = new Set(player.mineResources);

  const handleToggleResource = (resourceId: string) => {
    const newIds = selectedIds.has(resourceId)
      ? player.mineResources.filter(id => id !== resourceId)
      : [...player.mineResources, resourceId];
    onChangeResources(player.id, newIds);
  };

  const handleToggleAll = () => {
    const allSelected = resources.length === selectedIds.size;
    onChangeResources(player.id, allSelected ? [] : resources.map(r => r.id));
  };

  return (
    <div className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${bgClass}`}>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-white font-medium truncate flex items-center gap-1.5">
          {player.name}
          {heldRights.length > 0 && (
            <span className="text-green-400 text-[10px]" title={`${heldRights.length}x 2x`}>
              &#9650;
            </span>
          )}
          {penalizedResources.length > 0 && (
            <span className="text-red-400 text-[10px]" title={`${penalizedResources.length}x 0.5x`}>
              &#9660;{penalizedResources.length}
            </span>
          )}
        </span>

        <button
          onClick={() => onBoost(player.id)}
          disabled={!isReady}
          className={`shrink-0 px-3 py-1 rounded-md text-sm font-medium transition-colors min-w-[5rem] ${
            isBoosted
              ? 'bg-green-600 text-white cursor-default'
              : isCooldown
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          {isBoosted
            ? `${t('mine.boosted')} ${remainingSeconds}s`
            : isCooldown
              ? `${remainingSeconds}s`
              : t('mine.boost')}
        </button>

        <ResourceMultiSelect
          resources={resources}
          selectedIds={selectedIds}
          miningRights={miningRights}
          playerId={player.id}
          now={now}
          onToggle={handleToggleResource}
          onToggleAll={handleToggleAll}
        />
      </div>
      <ActiveGoodsDurability player={player} pgDefs={pgDefs} module="mine" />
    </div>
  );
}

function ResourceMultiSelect({ resources, selectedIds, miningRights, playerId, now, onToggle, onToggleAll }: {
  resources: Resource[];
  selectedIds: Set<string>;
  miningRights: Record<string, MiningRight[]>;
  playerId: string;
  now: number;
  onToggle: (resourceId: string) => void;
  onToggleAll: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const allSelected = resources.length > 0 && selectedIds.size === resources.length;
  const noneSelected = selectedIds.size === 0;

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const handleToggle = () => {
    if (!open) updatePos();
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectedResources = resources.filter(r => selectedIds.has(r.id));

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white hover:bg-gray-600 transition-colors"
      >
        {noneSelected ? (
          <span className="text-gray-400">{t('mine.noResources')}</span>
        ) : allSelected ? (
          <span className="text-gray-300">{t('mine.allResources')}</span>
        ) : (
          <span className="flex items-center gap-1">
            {selectedResources.map(r => (
              <span
                key={r.id}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: r.color }}
                title={r.name}
              >
                {r.initialLetter}
              </span>
            ))}
          </span>
        )}
        <span className="text-gray-400 ml-1 text-xs">▼</span>
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 min-w-[10rem]"
          style={{ top: pos.top, right: pos.right }}
        >
          <button
            onClick={onToggleAll}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-700 transition-colors border-b border-gray-700"
          >
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border ${
              allSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-500 text-gray-500'
            }`}>
              {allSelected ? '✓' : ''}
            </span>
            <span className="text-gray-300">{t('mine.allResources')}</span>
          </button>
          {resources.map(r => {
            const isSelected = selectedIds.has(r.id);
            const rights = (miningRights[r.id] ?? []).filter(mr => now < mr.expiresAt);
            const hasBonus = rights.some(mr => mr.holderId === playerId);
            const hasMalus = !hasBonus && rights.length > 0;
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-700 transition-colors ${
                  isSelected ? 'bg-gray-700/50' : ''
                }`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border ${
                  isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-500 text-gray-500'
                }`}>
                  {isSelected ? '✓' : ''}
                </span>
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: r.color }}
                >
                  {r.initialLetter}
                </span>
                <span className="text-white flex-1">{r.name}</span>
                {hasBonus && <span className="text-green-400 text-[10px]" title="2x">&#9650;</span>}
                {hasMalus && <span className="text-red-400 text-[10px]" title="0.5x">&#9660;</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
