import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { WSMessage, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { v4 as uuidv4 } from 'uuid';
import { handleAddPlayer, handleBoostMinePlayer, handleChangeMineResource } from '../handlers/mineHandler';
import url from 'url';

let wss: WebSocketServer;

export function initWebSocketServer(server: HttpServer): void {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const params = url.parse(req.url || '', true).query;
    const sessionId = params.sessionId as string | undefined;
    const clientId = uuidv4();

    if (!sessionId || gameState.getSessionId() !== sessionId) {
      ws.close(4001, 'Invalid session ID');
      return;
    }

    gameState.addClient(clientId, ws);
    console.log(`[WS] Client connected: ${clientId} (session: ${sessionId})`);

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(clientId, message);
      } catch {
        sendToClient(ws, {
          type: WSMessageType.ERROR,
          payload: { message: 'Invalid message format' },
        });
      }
    });

    ws.on('close', () => {
      gameState.removeClient(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });
  });

  console.log('[WS] WebSocket server initialized');
}

function handleMessage(clientId: string, message: WSMessage): void {
  switch (message.type) {
    case WSMessageType.JOIN_SESSION:
      // TODO: Handle join
      break;
    case WSMessageType.LEAVE_SESSION:
      // TODO: Handle leave
      break;
    case WSMessageType.ADD_PLAYER:
      handleAddPlayer(message.payload as { playerName: string });
      break;
    case WSMessageType.BOOST_MINE_PLAYER:
      handleBoostMinePlayer(message.payload as { playerId: string });
      break;
    case WSMessageType.CHANGE_MINE_RESOURCE:
      handleChangeMineResource(message.payload as { playerId: string; resourceId: string });
      break;
    case WSMessageType.ADD_MANUFACTURING_JOB:
      // TODO: Handle add manufacturing job
      break;
    case WSMessageType.REMOVE_MANUFACTURING_JOB:
      // TODO: Handle remove manufacturing job
      break;
    case WSMessageType.LAB_EXPERIMENT:
      // TODO: Handle lab experiment
      break;
    case WSMessageType.MARKET_BUY:
      // TODO: Handle market buy
      break;
    case WSMessageType.MARKET_SELL:
      // TODO: Handle market sell
      break;
    case WSMessageType.LIST_RECIPE:
      // TODO: Handle list recipe
      break;
    case WSMessageType.BUY_RECIPE:
      // TODO: Handle buy recipe
      break;
    default:
      console.warn(`[WS] Unknown message type: ${message.type}`);
  }
}

function sendToClient(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcast(message: WSMessage): void {
  const data = JSON.stringify(message);
  gameState.getAllClients().forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

export function sendTo(clientId: string, message: WSMessage): void {
  const ws = gameState.getClient(clientId);
  if (ws) {
    sendToClient(ws, message);
  }
}
