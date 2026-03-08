import { GameProvider, useGame } from '@/context/GameContext';
import { LocaleContext, useLocaleProvider, setFallbackLocale } from '@/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { StartMenu } from '@/views/StartMenu';
import { HostMenu } from '@/views/HostMenu';
import { JoinMenu } from '@/views/JoinMenu';
import { Setup } from '@/views/Setup';
import { WaitingScreen } from '@/views/WaitingScreen';
import { GameShell } from '@/views/GameShell';

function ViewRouter() {
  const { state } = useGame();

  switch (state.view) {
    case 'startMenu':
      return <StartMenu />;
    case 'hostMenu':
      return <HostMenu />;
    case 'joinMenu':
      return <JoinMenu />;
    case 'setup':
      return <Setup />;
    case 'waiting':
      return <WaitingScreen />;
    case 'game':
      return <GameShell />;
  }
}

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const value = useLocaleProvider();
  // Keep fallback in sync
  setFallbackLocale(value.locale);
  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

function App() {
  return (
    <LocaleProvider>
      <GameProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <LanguageToggle />
          <ViewRouter />
        </div>
      </GameProvider>
    </LocaleProvider>
  );
}

export default App;
