import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Button, Card, Dialog, Input, Select, Slider } from '@/components/ui';
import { LanguageToggle } from '@/components/LanguageToggle';
import type { ModuleType } from '@craftomation/shared';

const API_BASE = `http://${window.location.hostname}:3001`;

const ALL_MODULES: { value: ModuleType; labelKey: string }[] = [
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

const REQUIRED_MODULES: ModuleType[] = ['mine', 'manufacturing', 'lab', 'auction'];

export function Setup() {
  const { t } = useLocale();
  const { state, dispatch } = useGame();
  const [copied, setCopied] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1.0);
  const [consumptionRate, setConsumptionRate] = useState(1.0);
  const [resourceTypes, setResourceTypes] = useState(6);
  const [hostModule, setHostModule] = useState<ModuleType>('mine');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [clientModules, setClientModules] = useState<ModuleType[]>([]);
  const [clientDevices, setClientDevices] = useState<{ clientId: string; moduleType: ModuleType }[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coveredModules = useMemo(() => {
    const all = [hostModule, ...clientModules];
    return new Set(all);
  }, [hostModule, clientModules]);

  const missingModules = useMemo(
    () => REQUIRED_MODULES.filter(m => !coveredModules.has(m)),
    [coveredModules],
  );

  const fetchModules = useCallback(async () => {
    if (!state.sessionId) return;
    try {
      // Heartbeat: re-register host module so backend knows we're still here
      fetch(`${API_BASE}/api/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, moduleType: hostModule, deviceId: state.deviceId }),
      }).catch(() => {});

      const res = await fetch(`${API_BASE}/api/session/${state.sessionId}/modules`);
      if (res.ok) {
        const data = await res.json();
        const allClients: { clientId: string; moduleType: ModuleType }[] = data.clients ?? [];
        // Filter out the host's own device from client list
        const otherClients = allClients.filter(c => c.clientId !== state.deviceId);
        setClientModules(otherClients.map(c => c.moduleType));
        setClientDevices(otherClients);
      }
    } catch { /* ignore */ }
  }, [state.sessionId, state.deviceId, hostModule]);

  // Poll for connected client modules every 5 seconds
  useEffect(() => {
    fetchModules();
    const timer = setInterval(fetchModules, 5000);
    return () => clearInterval(timer);
  }, [fetchModules]);

  function copySessionId() {
    if (state.sessionId) {
      navigator.clipboard.writeText(state.sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function addPlayer() {
    if (!newPlayerName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/session/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, playerName: newPlayerName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players);
      }
    } catch { /* ignore */ }
    setNewPlayerName('');
    setPlayerDialogOpen(false);
  }

  async function removePlayer(playerId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/session/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, playerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players);
      }
    } catch { /* ignore */ }
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          config: {
            gameSpeed,
            consumptionRate,
            resourceTypeCount: resourceTypes,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('common.error'));
        setStarting(false);
        return;
      }

      const data = await res.json();
      dispatch({ type: 'SET_GAME_STATE', gameState: data.state });
      dispatch({ type: 'SET_MODULE', moduleType: hostModule });
      dispatch({ type: 'NAVIGATE', view: 'game' });
    } catch {
      setError(t('common.error'));
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'NAVIGATE', view: 'hostMenu' })}>
            {t('common.back')}
          </Button>
          <h1 className="text-xl font-bold text-white">{t('setup.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copySessionId}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <span className="text-gray-400">{t('setup.sessionId')}:</span>
            <span className="text-white font-mono font-bold tracking-widest">{state.sessionId}</span>
            <span className="text-xs text-indigo-400">{copied ? t('setup.copied') : ''}</span>
          </button>
          <LanguageToggle inline />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {error && (
          <div className="p-3 bg-red-900/50 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Connected Devices */}
        <Card>
          <h2 className="text-sm font-medium text-gray-400 mb-3">{t('setup.connectedDevices')}</h2>
          <div className="flex flex-col gap-2">
            {/* Host device */}
            <div className="flex items-center gap-3 rounded-lg border border-indigo-600/50 bg-indigo-900/20 px-3 py-2">
              <span className="text-white font-medium flex-1">{t('setup.host')}</span>
              <Select
                options={ALL_MODULES.map(m => ({
                  value: m.value,
                  label: clientModules.includes(m.value)
                    ? `${t(m.labelKey)} (${t('joinMenu.taken')})`
                    : t(m.labelKey),
                }))}
                value={hostModule}
                onChange={e => setHostModule(e.target.value as ModuleType)}
                className="text-sm"
              />
            </div>
            {/* Client devices */}
            {clientDevices.map(cd => (
              <div key={cd.clientId} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
                <span className="text-white font-medium flex-1 truncate">{cd.clientId}</span>
                <span className="text-sm text-gray-400">{t(`module.${cd.moduleType}`)}</span>
              </div>
            ))}
            {clientDevices.length === 0 && (
              <p className="text-gray-500 text-xs mt-1">{t('setup.noClients')}</p>
            )}
          </div>
        </Card>

        {/* Players */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400">{t('setup.players')}</h2>
            <Button size="sm" onClick={() => setPlayerDialogOpen(true)}>
              {t('mine.addPlayer')}
            </Button>
          </div>
          {players.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('setup.noPlayers')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {players.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-700/50 px-3 py-1.5">
                  <span className="text-sm text-white">{p.name}</span>
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Dialog open={playerDialogOpen} onClose={() => setPlayerDialogOpen(false)} title={t('mine.newPlayer')}>
          <div className="flex flex-col gap-4">
            <Input
              placeholder={t('mine.playerNamePlaceholder')}
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addPlayer(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPlayerDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={addPlayer} disabled={!newPlayerName.trim()}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Sliders */}
        <Card className="space-y-4">
          <Slider
            label={t('setup.gameSpeed')}
            value={gameSpeed}
            min={0}
            max={2}
            step={0.1}
            onChange={setGameSpeed}
            displayValue={`${gameSpeed.toFixed(1)}x`}
          />
          <Slider
            label={t('setup.consumptionRate')}
            value={consumptionRate}
            min={0}
            max={2}
            step={0.1}
            onChange={setConsumptionRate}
            displayValue={`${consumptionRate.toFixed(1)}x`}
          />
          <Slider
            label={t('setup.resourceTypes')}
            value={resourceTypes}
            min={5}
            max={10}
            step={1}
            onChange={setResourceTypes}
          />
        </Card>
      </div>

      {/* Sticky Start Button */}
      <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-4 space-y-2">
        {missingModules.length > 0 && (
          <div className="p-3 bg-amber-900/40 border border-amber-700/50 rounded-lg text-sm">
            <p className="text-amber-400 font-medium mb-1">{t('setup.missingModules')}</p>
            <div className="flex flex-wrap gap-1">
              {missingModules.map(m => (
                <span key={m} className="px-2 py-0.5 bg-amber-800/50 text-amber-300 rounded text-xs">
                  {t(`module.${m}`)}
                </span>
              ))}
            </div>
          </div>
        )}
        <Button size="full" onClick={handleStart} disabled={starting}>
          {starting ? t('common.loading') : t('setup.startGame')}
        </Button>
      </div>
    </div>
  );
}
