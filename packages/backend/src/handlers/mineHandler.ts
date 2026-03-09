import { v4 as uuidv4 } from 'uuid';
import { Player, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';

function createDefaultPlayer(name: string): Player {
  return {
    id: uuidv4(),
    name,
    resources: {},
    consumables: {},
    knownRecipes: [],
    technologies: [],
    cash: 0,
    activeInMine: false,
    currentMineResource: null,
    manufacturingQueue: [],
  };
}

function broadcastGameState(): void {
  broadcast({
    type: WSMessageType.GAME_STATE_UPDATE,
    payload: gameState.toJSON(),
  });
}

export function handleAddPlayer(payload: { playerName: string }): void {
  const { playerName } = payload;
  if (!playerName?.trim()) return;

  const player = createDefaultPlayer(playerName.trim());
  gameState.setPlayer(player.id, player);
  broadcastGameState();
}

export function handleUpdatePlayerStatus(payload: { playerId: string; active: boolean }): void {
  const { playerId, active } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  gameState.setPlayer(playerId, { ...player, activeInMine: active });
  broadcastGameState();
}

export function handleChangeMineResource(payload: { playerId: string; resourceId: string }): void {
  const { playerId, resourceId } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  gameState.setPlayer(playerId, { ...player, currentMineResource: resourceId });
  broadcastGameState();
}
