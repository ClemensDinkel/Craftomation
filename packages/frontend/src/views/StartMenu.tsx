import { useLocale } from '@/i18n';
import { useGame } from '@/context/GameContext';

export function StartMenu() {
  const { t } = useLocale();
  const { dispatch } = useGame();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-center pt-12 pb-6">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          {t('app.title')}
        </h1>
      </div>
      <div className="flex-1 flex flex-col gap-3 px-4 pb-4">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'hostMenu' })}
          className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-2xl font-semibold transition-colors"
        >
          {t('startMenu.hostGame')}
        </button>
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'joinMenu' })}
          className="flex-1 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-2xl font-semibold transition-colors"
        >
          {t('startMenu.joinGame')}
        </button>
      </div>
    </div>
  );
}
