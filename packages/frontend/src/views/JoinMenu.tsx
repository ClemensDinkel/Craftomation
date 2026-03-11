import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Button, Input, Select } from '@/components/ui';
import type { ModuleType } from '@craftomation/shared';

const API_BASE = `http://${window.location.hostname}:3001`;

const MODULE_OPTIONS: { value: ModuleType; labelKey: string }[] = [
  { value: 'mine', labelKey: 'module.mine' },
  { value: 'manufacturing', labelKey: 'module.manufacturing' },
  { value: 'lab', labelKey: 'module.lab' },
  { value: 'auction', labelKey: 'module.auction' },
  { value: 'plantation', labelKey: 'module.plantation' },
  { value: 'university', labelKey: 'module.university' },
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

  // Auto-select first untaken module when session ID is complete
  useEffect(() => {
    if (sessionId.length < 6) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session/${sessionId}/modules`);
        if (!res.ok) return;
        const data = await res.json();
        const taken = new Set<string>(data.modules ?? []);
        const firstFree = MODULE_OPTIONS.find(m => !taken.has(m.value));
        if (firstFree) setModuleType(firstFree.value);
      } catch { /* ignore */ }
    })();
  }, [sessionId]);

  async function handleJoin() {
    try {
      const res = await fetch(`${API_BASE}/api/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.toUpperCase(), moduleType, alias }),
      });

      if (!res.ok) {
        setError(t('common.error'));
        return;
      }

      dispatch({ type: 'SET_SESSION', sessionId: sessionId.toUpperCase(), isHost: false });
      dispatch({ type: 'SET_MODULE', moduleType });
      dispatch({ type: 'SET_ALIAS', alias: alias || `Client-${sessionId.slice(0, 3)}` });
      dispatch({ type: 'NAVIGATE', view: 'waiting' });
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
          onChange={e => setModuleType(e.target.value as ModuleType)}
          options={MODULE_OPTIONS.map(m => ({ value: m.value, label: t(m.labelKey) }))}
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

// todo join testen, mehrere fenster / browser instanzen / geräte ? 