import { useState, useMemo } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import type { Player, WSMessage } from '@craftomation/shared';
import { PlayerLabView } from './PlayerLabView';

interface LabModuleProps {
  send: (msg: WSMessage) => void;
}

export function LabModule({ send }: LabModuleProps) {
  const { t } = useLocale();
  const { state } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const players = useMemo(() => {
    if (!state.gameState?.players) return [];
    return Object.values(state.gameState.players).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.gameState?.players]);

  const selectedPlayer = useMemo(
    () => players.find(p => p.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  if (selectedPlayer) {
    return (
      <PlayerLabView
        player={selectedPlayer}
        resources={state.gameState?.resources ?? []}
        recipes={state.gameState?.recipes ?? []}
        send={send}
        onBack={() => setSelectedPlayerId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white">{t('lab.title')}</h2>

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {players.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('lab.noPlayers')}</p>
        )}
        {players.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            onClick={() => setSelectedPlayerId(player.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-left hover:bg-gray-700/60 transition-colors w-full"
    >
      <span className="flex-1 text-white font-medium truncate">{player.name}</span>
    </button>
  );
}
