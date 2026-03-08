import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Badge } from '@/components/ui';
import { useWebSocket } from '@/hooks/useWebSocket';

export function GameShell() {
  const { t } = useLocale();
  const { state } = useGame();

  const wsUrl = state.sessionId
    ? `ws://${window.location.hostname}:3001?sessionId=${state.sessionId}`
    : null;
  const { status } = useWebSocket(wsUrl);

  const statusColor = status === 'connected' ? 'green' : status === 'reconnecting' ? 'yellow' : 'red';
  const statusText = t(`game.${status}`);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Craftomation</h1>
          <span className="text-gray-500 font-mono text-sm">{state.sessionId}</span>
        </div>
        <Badge color={statusColor}>{statusText}</Badge>
      </header>

      {/* Module Content */}
      <main className="flex-1 p-4">
        <ModulePlaceholder moduleType={state.moduleType} />
      </main>
    </div>
  );
}

function ModulePlaceholder({ moduleType }: { moduleType: string | null }) {
  const { t } = useLocale();

  if (!moduleType) {
    return <p className="text-gray-500">No module selected</p>;
  }

  return (
    <div className="flex items-center justify-center h-64 bg-gray-800 rounded-xl">
      <div className="text-center">
        <p className="text-2xl font-bold text-white">{t(`module.${moduleType}`)}</p>
        <p className="text-gray-500 mt-2">Module placeholder</p>
      </div>
    </div>
  );
}
