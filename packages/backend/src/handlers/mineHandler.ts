import { v4 as uuidv4 } from 'uuid';
import { Player, WSMessageType } from '@craftomation/shared';
import { gameState } from '../state/gameState';
import { broadcast } from '../websocket/wsServer';

const BOOST_DURATION_MS = 30_000;    // 30 seconds
const BOOST_COOLDOWN_MS = 120_000;   // 2 minutes

function createDefaultPlayer(name: string): Player {
  return {
    id: uuidv4(),
    name,
    resources: {},
    consumables: {},
    productionGoods: {},
    knownRecipes: [],
    patents: [],
    cash: 0,
    mineResources: [],
    mineResourceIndex: 0,
    mineBoostUntil: null,
    mineBoostCooldownUntil: null,
    nextMineProductionAt: 0,
    nextMineWearAt: 0,
    manufacturingQueue: [],
    labHistory: [],
    autoTradeRules: [],
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

export function handleBoostMinePlayer(payload: { playerId: string }): void {
  const { playerId } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  const now = Date.now();

  // Can't boost during cooldown
  if (player.mineBoostCooldownUntil && now < player.mineBoostCooldownUntil) return;

  // Can't boost if already boosted
  if (player.mineBoostUntil && now < player.mineBoostUntil) return;

  gameState.setPlayer(playerId, {
    ...player,
    mineBoostUntil: now + BOOST_DURATION_MS,
    mineBoostCooldownUntil: now + BOOST_DURATION_MS + BOOST_COOLDOWN_MS,
  });
  broadcastGameState();
}

export function handleChangeMineResource(payload: { playerId: string; resourceIds: string[] }): void {
  const { playerId, resourceIds } = payload;
  const player = gameState.getPlayer(playerId);
  if (!player) return;

  gameState.setPlayer(playerId, {
    ...player,
    mineResources: resourceIds,
    mineResourceIndex: 0,
    nextMineProductionAt: 0,
    nextMineWearAt: 0,
  });
  broadcastGameState();
}
