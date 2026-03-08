import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';
import { Card, Spinner } from '@/components/ui';

export function WaitingScreen() {
  const { t } = useLocale();
  const { state } = useGame();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm w-full">
        <Spinner size="lg" />
        <h1 className="text-2xl font-bold text-white">{t('waiting.title')}</h1>

        <Card className="text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">{t('waiting.sessionId')}</span>
            <span className="text-white font-mono font-bold tracking-widest">{state.sessionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">{t('waiting.module')}</span>
            <span className="text-white">{state.moduleType ? t(`module.${state.moduleType}`) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">{t('waiting.alias')}</span>
            <span className="text-white">{state.alias || '—'}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
