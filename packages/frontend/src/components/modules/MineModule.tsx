import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource, WSMessage } from '@craftomation/shared';
import { Button, Input, Dialog } from '@/components/ui';

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

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    send({ type: WSMessageType.ADD_PLAYER, payload: { playerName: newPlayerName.trim() } });
    setNewPlayerName('');
    setDialogOpen(false);
  };

  const handleBoost = (playerId: string) => {
    send({ type: WSMessageType.BOOST_MINE_PLAYER, payload: { playerId } });
  };

  const handleChangeResource = (playerId: string, resourceId: string) => {
    send({ type: WSMessageType.CHANGE_MINE_RESOURCE, payload: { playerId, resourceId } });
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
            onBoost={handleBoost}
            onChangeResource={handleChangeResource}
          />
        ))}
      </div>
    </div>
  );
}

interface PlayerRowProps {
  player: Player;
  resources: Resource[];
  onBoost: (playerId: string) => void;
  onChangeResource: (playerId: string, resourceId: string) => void;
}

function PlayerRow({ player, resources, onBoost, onChangeResource }: PlayerRowProps) {
  const { t } = useLocale();
  const [now, setNow] = useState(Date.now());

  const isBoosted = player.mineBoostUntil !== null && now < player.mineBoostUntil;
  const isCooldown = !isBoosted && player.mineBoostCooldownUntil !== null && now < player.mineBoostCooldownUntil;
  const isReady = !isBoosted && !isCooldown;

  // Tick every second while boost or cooldown is active
  useEffect(() => {
    if (!player.mineBoostUntil && !player.mineBoostCooldownUntil) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [player.mineBoostUntil, player.mineBoostCooldownUntil]);

  const remainingSeconds = isBoosted
    ? Math.ceil((player.mineBoostUntil! - now) / 1000)
    : isCooldown
      ? Math.ceil((player.mineBoostCooldownUntil! - now) / 1000)
      : 0;

  const bgClass = isBoosted
    ? 'bg-green-900/40 border-green-700/50'
    : 'bg-gray-800/60 border-gray-700/50';

  const selectedResource = resources.find(r => r.id === player.currentMineResource);

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${bgClass}`}>
      <span className="flex-1 text-white font-medium truncate">{player.name}</span>

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

      <ResourceDropdown
        resources={resources}
        selected={selectedResource ?? null}
        placeholder={t('mine.selectResource')}
        onChange={resId => onChangeResource(player.id, resId)}
      />
    </div>
  );
}

function ResourceDropdown({ resources, selected, placeholder, onChange }: {
  resources: Resource[];
  selected: Resource | null;
  placeholder: string;
  onChange: (resId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

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

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white hover:bg-gray-600 transition-colors"
      >
        {selected ? (
          <>
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: selected.color }}
            >
              {selected.initialLetter}
            </span>
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <span className="text-gray-400 ml-1 text-xs">▼</span>
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 min-w-[10rem]"
          style={{ top: pos.top, right: pos.right }}
        >
          {resources.map(r => (
            <button
              key={r.id}
              onClick={() => { onChange(r.id); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-700 transition-colors ${
                selected?.id === r.id ? 'bg-gray-700/50' : ''
              }`}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: r.color }}
              >
                {r.initialLetter}
              </span>
              <span className="text-white">{r.name}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
