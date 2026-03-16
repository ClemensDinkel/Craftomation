import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Button, Input, Select } from '@/components/ui';
import { getDeviceId } from '@/utils/deviceId';
import type { ModuleType } from '@craftomation/shared';

import { API_BASE } from '@/utils/api';

const MODULE_OPTIONS: { value: ModuleType; labelKey: string }[] = [
  { value: 'mine', labelKey: 'module.mine' },
  { value: 'manufacturing', labelKey: 'module.manufacturing' },
  { value: 'auction', labelKey: 'module.auction' },
  { value: 'lab', labelKey: 'module.lab' },
  { value: 'plantation', labelKey: 'module.plantation' },
  { value: 'patent_office', labelKey: 'module.patent_office' },
  { value: 'stockmarket', labelKey: 'module.stockmarket' },
  { value: 'backroom', labelKey: 'module.backroom' },
  { value: 'influencer', labelKey: 'module.influencer' },
  { value: 'warehouse', labelKey: 'module.warehouse' },
];

export function JoinMenu() {
  const { t } = useLocale();
  const { dispatch } = useGame();
  const [sessionId, setSessionId] = useState('');
  const [moduleType, setModuleType] = useState<ModuleType>('mine');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [takenModules, setTakenModules] = useState<Set<string>>(new Set());
  const userManuallySelected = useRef(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  // Check if a game is already running on this server
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session/active`);
        const data = await res.json();
        if (data.active) {
          setActiveSession(data.sessionId);
        }
      } catch { /* server not reachable */ }
    })();
  }, []);

  function handleRejoin() {
    if (!activeSession) return;
    // Pre-fill session ID to trigger module fetching
    setSessionId(activeSession);
  }

  const fetchModules = useCallback(async () => {
    if (sessionId.length < 6) return;
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/modules`);
      if (!res.ok) return;
      const data = await res.json();
      const taken = new Set<string>(data.modules ?? []);
      setTakenModules(taken);
      // Only auto-select if user hasn't manually chosen
      if (!userManuallySelected.current) {
        const firstFree = MODULE_OPTIONS.find(m => !taken.has(m.value));
        if (firstFree) setModuleType(firstFree.value);
      }
    } catch { /* ignore */ }
  }, [sessionId]);

  // Poll for taken modules every 3 seconds while session ID is valid
  useEffect(() => {
    if (sessionId.length < 6) return;
    userManuallySelected.current = false;
    fetchModules();
    const timer = setInterval(fetchModules, 3000);
    return () => clearInterval(timer);
  }, [sessionId, fetchModules]);

  async function handleJoin() {
    try {
      const res = await fetch(`${API_BASE}/api/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.toUpperCase(), moduleType, deviceId: getDeviceId() }),
      });

      if (!res.ok) {
        setError(t('common.error'));
        return;
      }

      const data = await res.json();
      const effectiveModule = data.assignedModule ?? moduleType;

      dispatch({ type: 'SET_SESSION', sessionId: sessionId.toUpperCase(), isHost: false });
      dispatch({ type: 'SET_MODULE', moduleType: effectiveModule });
      dispatch({ type: 'SET_ALIAS', alias: alias || `Client-${sessionId.slice(0, 3)}` });
      dispatch({ type: 'NAVIGATE', view: data.gameStarted ? 'game' : 'waiting' });
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
        <h1 className="text-2xl font-bold text-white">{t('joinMenu.title')}</h1>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 pb-4">
        {error && (
          <div className="p-3 bg-red-900/50 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {activeSession && !sessionId && (
          <button
            onClick={handleRejoin}
            className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 transition-colors"
          >
            {t('joinMenu.rejoin')} ({activeSession})
          </button>
        )}

        <Input
          id="sessionId"
          label={t('joinMenu.sessionId')}
          placeholder={t('joinMenu.sessionIdPlaceholder')}
          value={sessionId}
          onChange={e => setSessionId(e.target.value.toUpperCase())}
          maxLength={6}
          className="text-center text-xl tracking-widest uppercase"
        />

        <Select
          id="module"
          label={t('joinMenu.module')}
          value={moduleType}
          onChange={e => {
            userManuallySelected.current = true;
            setModuleType(e.target.value as ModuleType);
          }}
          options={MODULE_OPTIONS.map(m => ({
            value: m.value,
            label: takenModules.has(m.value) ? `${t(m.labelKey)} (${t('joinMenu.taken')})` : t(m.labelKey),
          }))}
        />

        <Input
          id="alias"
          label={t('joinMenu.alias')}
          placeholder={t('joinMenu.aliasPlaceholder')}
          value={alias}
          onChange={e => setAlias(e.target.value)}
        />

        <div className="mt-auto">
          <Button
            size="full"
            disabled={sessionId.length < 6}
            onClick={handleJoin}
          >
            {t('joinMenu.join')}
          </Button>
        </div>
      </div>
    </div>
  );
}
