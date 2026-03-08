import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessageType, type WSMessage, type GameState } from '@craftomation/shared';
import { useGame } from '@/context/GameContext';

type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting';

const MAX_RETRIES = 3;

export function useWebSocket(url: string | null) {
  const { dispatch } = useGame();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const connect = useCallback(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        handleMessage(message, dispatch);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;

      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current++;
        setStatus('reconnecting');
        setTimeout(connect, 2000 * retriesRef.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, dispatch]);

  const disconnect = useCallback(() => {
    retriesRef.current = MAX_RETRIES; // prevent reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { status, send, disconnect };
}

function handleMessage(message: WSMessage, dispatch: React.Dispatch<ReturnType<typeof useGame>['dispatch'] extends React.Dispatch<infer A> ? A : never>) {
  switch (message.type) {
    case WSMessageType.GAME_STATE_UPDATE:
    case WSMessageType.SESSION_STARTED:
      dispatch({ type: 'SET_GAME_STATE', gameState: message.payload as GameState });
      if (message.type === WSMessageType.SESSION_STARTED) {
        dispatch({ type: 'NAVIGATE', view: 'game' });
      }
      break;
    case WSMessageType.PLAYER_UPDATE:
    case WSMessageType.MARKET_UPDATE:
      // Partial updates — for now treat as full state if applicable
      break;
    case WSMessageType.ERROR:
      console.error('[WS] Server error:', message.payload);
      break;
  }
}
