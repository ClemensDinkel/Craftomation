import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { GameState, ModuleType } from '@craftomation/shared';

type View = 'startMenu' | 'hostMenu' | 'joinMenu' | 'setup' | 'waiting' | 'game';

interface AppState {
  view: View;
  sessionId: string | null;
  moduleType: ModuleType | null;
  alias: string;
  gameState: GameState | null;
  isHost: boolean;
}

type Action =
  | { type: 'NAVIGATE'; view: View }
  | { type: 'SET_SESSION'; sessionId: string; isHost: boolean }
  | { type: 'SET_MODULE'; moduleType: ModuleType }
  | { type: 'SET_ALIAS'; alias: string }
  | { type: 'SET_GAME_STATE'; gameState: GameState }
  | { type: 'RESET' };

const initialState: AppState = {
  view: 'startMenu',
  sessionId: null,
  moduleType: null,
  alias: '',
  gameState: null,
  isHost: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view };
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId, isHost: action.isHost };
    case 'SET_MODULE':
      return { ...state, moduleType: action.moduleType };
    case 'SET_ALIAS':
      return { ...state, alias: action.alias };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const GameContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
