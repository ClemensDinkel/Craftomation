import { useState, useMemo } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSMessageType } from '@craftomation/shared';
import type { Player, Resource } from '@craftomation/shared';
import { Button, Input, Dialog } from '@/components/ui';

export function MineModule() {
  const { t } = useLocale();
  const { state } = useGame();
  const wsUrl = state.sessionId
    ? `ws://${window.location.hostname}:3001?sessionId=${state.sessionId}`
    : null;
  const { send } = useWebSocket(wsUrl);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const players = useMemo(() => {
    if (!state.gameState?.players) return [];
    const all = Object.values(state.gameState.players);
    const active = all.filter(p => p.activeInMine).sort((a, b) => a.name.localeCompare(b.name));
    const inactive = all.filter(p => !p.activeInMine).sort((a, b) => a.name.localeCompare(b.name));
    return [...active, ...inactive];
  }, [state.gameState?.players]);

  const resources: Resource[] = state.gameState?.resources ?? [];

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    send({ type: WSMessageType.ADD_PLAYER, payload: { playerName: newPlayerName.trim() } });
    setNewPlayerName('');
    setDialogOpen(false);
  };

  const handleToggleActive = (player: Player) => {
    send({
      type: WSMessageType.UPDATE_PLAYER_STATUS,
      payload: { playerId: player.id, active: !player.activeInMine },
    });
  };

  const handleChangeResource = (playerId: string, resourceId: string) => {
    send({
      type: WSMessageType.CHANGE_MINE_RESOURCE,
      payload: { playerId, resourceId },
    });
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
            onToggleActive={handleToggleActive}
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
  onToggleActive: (player: Player) => void;
  onChangeResource: (playerId: string, resourceId: string) => void;
}

function PlayerRow({ player, resources, onToggleActive, onChangeResource }: PlayerRowProps) {
  const { t } = useLocale();
  const bgClass = player.activeInMine
    ? 'bg-green-900/40 border-green-700/50'
    : 'bg-gray-800/60 border-gray-700/50';

  const selectedResource = resources.find(r => r.id === player.currentMineResource);

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${bgClass}`}>
      <span className="flex-1 text-white font-medium truncate">{player.name}</span>

      <button
        onClick={() => onToggleActive(player)}
        className={`shrink-0 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          player.activeInMine
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
        }`}
      >
        {player.activeInMine ? t('mine.active') : t('mine.inactive')}
      </button>

      <div className="shrink-0 relative">
        <div className="flex items-center gap-1.5">
          {selectedResource && (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: selectedResource.color }}
            >
              {selectedResource.initialLetter}
            </span>
          )}
          <select
            value={player.currentMineResource ?? ''}
            onChange={e => onChangeResource(player.id, e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">{t('mine.selectResource')}</option>
            {resources.map(r => (
              <option key={r.id} value={r.id}>
                {r.initialLetter} — {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
