import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessageType, type WSMessage, type GameState, type LabResult } from '@craftomation/shared';
import { useGame } from '@/context/GameContext';

type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting';

const MAX_RETRIES = 3;

// Module-level singleton to survive StrictMode double-mounts
let activeSocket: WebSocket | null = null;
let activeUrl: string | null = null;
let refCount = 0;

export function useWebSocket(url: string | null) {
  const { dispatch } = useGame();
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const statusRef = useRef(status);
  statusRef.current = status;

  const retriesRef = useRef(0);

  const connectRef = useRef<(() => void) | null>(null);

  connectRef.current = () => {
    if (!url) return;

    // Reuse existing socket if URL matches and it's open/connecting
    if (activeSocket && activeUrl === url &&
        (activeSocket.readyState === WebSocket.OPEN || activeSocket.readyState === WebSocket.CONNECTING)) {
      if (activeSocket.readyState === WebSocket.OPEN) {
        setStatus('connected');
      }
      return;
    }

    retriesRef.current = 0;
    const ws = new WebSocket(url);
    activeSocket = ws;
    activeUrl = url;

    ws.onopen = () => {
      if (activeSocket !== ws) return;
      setStatus('connected');
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        handleMessage(message, dispatchRef.current);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (activeSocket !== ws) return;
      activeSocket = null;
      activeUrl = null;
      setStatus('disconnected');

      if (refCount > 0 && retriesRef.current < MAX_RETRIES) {
        retriesRef.current++;
        setStatus('reconnecting');
        setTimeout(() => connectRef.current?.(), 2000 * retriesRef.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  useEffect(() => {
    refCount++;
    connectRef.current?.();

    return () => {
      refCount--;
      if (refCount <= 0) {
        refCount = 0;
        activeSocket?.close();
        activeSocket = null;
        activeUrl = null;
      }
    };
  }, [url]);

  const send = useCallback((message: WSMessage) => {
    if (activeSocket?.readyState === WebSocket.OPEN) {
      activeSocket.send(JSON.stringify(message));
    }
  }, []);

  return { status, send };
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
    case WSMessageType.LAB_RESULT:
      dispatch({ type: 'SET_LAB_RESULT', labResult: message.payload as LabResult });
      break;
    case WSMessageType.ERROR:
      console.error('[WS] Server error:', message.payload);
      break;
  }
}
