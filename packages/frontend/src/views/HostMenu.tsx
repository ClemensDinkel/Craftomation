import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui';

const API_BASE = `http://${window.location.hostname}:3001`;

export function HostMenu() {
  const { t } = useLocale();
  const { dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  // Check if a game is already running on this server
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session/active`);
        const data = await res.json();
        if (data.active) setActiveSession(data.sessionId);
      } catch { /* server not reachable */ }
    })();
  }, []);

  function handleRejoin() {
    if (!activeSession) return;
    dispatch({ type: 'SET_SESSION', sessionId: activeSession, isHost: true });
    dispatch({ type: 'SET_ALIAS', alias: 'host' });
    dispatch({ type: 'NAVIGATE', view: 'game' });
  }

  async function handleNewGame() {
    try {
      const res = await fetch(`${API_BASE}/api/session/create`, { method: 'POST' });
      const data = await res.json();
      dispatch({ type: 'SET_SESSION', sessionId: data.sessionId, isHost: true });
      dispatch({ type: 'NAVIGATE', view: 'setup' });
    } catch {
      setError(t('common.error'));
    }
  }

  async function handleLoadGame() {
    try {
      const res = await fetch(`${API_BASE}/api/session/load`, { method: 'POST' });
      if (!res.ok) {
        setError(t('common.noSaveFound'));
        return;
      }
      const data = await res.json();
      dispatch({ type: 'SET_SESSION', sessionId: data.sessionId, isHost: true });
      dispatch({ type: 'NAVIGATE', view: 'setup' });
    } catch {
      setError(t('common.error'));
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 p-4">
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'NAVIGATE', view: 'startMenu' })}>
          {t('common.back')}
        </Button>
        <h1 className="text-2xl font-bold text-white">{t('hostMenu.title')}</h1>
      </div>
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-900/50 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-3 px-4 pb-4">
        {activeSession && (
          <button
            onClick={handleRejoin}
            className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-2xl font-semibold transition-colors"
          >
            {t('hostMenu.rejoin')}
          </button>
        )}
        <button
          onClick={handleNewGame}
          className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-2xl font-semibold transition-colors"
        >
          {t('hostMenu.newGame')}
        </button>
        <button
          onClick={handleLoadGame}
          className="flex-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-2xl font-semibold transition-colors"
        >
          {t('hostMenu.loadGame')}
        </button>
      </div>
    </div>
  );
}
