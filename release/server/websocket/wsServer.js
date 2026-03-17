"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocketServer = initWebSocketServer;
exports.broadcast = broadcast;
exports.sendTo = sendTo;
const ws_1 = __importStar(require("ws"));
const shared_1 = require("@craftomation/shared");
const gameState_1 = require("../state/gameState");
const uuid_1 = require("uuid");
const mineHandler_1 = require("../handlers/mineHandler");
const manufacturingHandler_1 = require("../handlers/manufacturingHandler");
const labHandler_1 = require("../handlers/labHandler");
const auctionHandler_1 = require("../handlers/auctionHandler");
const url_1 = __importDefault(require("url"));
let wss;
function initWebSocketServer(server) {
    wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
        const params = url_1.default.parse(req.url || '', true).query;
        const sessionId = params.sessionId;
        const deviceId = params.deviceId;
        const clientId = deviceId || (0, uuid_1.v4)();
        if (!sessionId || gameState_1.gameState.getSessionId() !== sessionId) {
            ws.close(4001, 'Invalid session ID');
            return;
        }
        // If this alias already has a connection, close the old one
        const existingWs = gameState_1.gameState.getClient(clientId);
        if (existingWs && existingWs.readyState === ws_1.default.OPEN) {
            existingWs.close(4002, 'Replaced by new connection');
        }
        gameState_1.gameState.addClient(clientId, ws);
        console.log(`[WS] Client connected: ${clientId} (session: ${sessionId})`);
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(clientId, message);
            }
            catch {
                sendToClient(ws, {
                    type: shared_1.WSMessageType.ERROR,
                    payload: { message: 'Invalid message format' },
                });
            }
        });
        ws.on('close', () => {
            // Only remove if this is still the active socket for this clientId
            if (gameState_1.gameState.getClient(clientId) === ws) {
                gameState_1.gameState.removeClient(clientId);
                console.log(`[WS] Client disconnected: ${clientId}`);
            }
        });
    });
    console.log('[WS] WebSocket server initialized');
}
function handleMessage(clientId, message) {
    switch (message.type) {
        case shared_1.WSMessageType.JOIN_SESSION:
            // TODO: Handle join
            break;
        case shared_1.WSMessageType.LEAVE_SESSION:
            // TODO: Handle leave
            break;
        case shared_1.WSMessageType.ADD_PLAYER:
            (0, mineHandler_1.handleAddPlayer)(message.payload);
            break;
        case shared_1.WSMessageType.BOOST_MINE_PLAYER:
            (0, mineHandler_1.handleBoostMinePlayer)(message.payload);
            break;
        case shared_1.WSMessageType.CHANGE_MINE_RESOURCE:
            (0, mineHandler_1.handleChangeMineResource)(message.payload);
            break;
        case shared_1.WSMessageType.ADD_MANUFACTURING_JOB:
            (0, manufacturingHandler_1.handleAddManufacturingJob)(message.payload);
            break;
        case shared_1.WSMessageType.REMOVE_MANUFACTURING_JOB:
            (0, manufacturingHandler_1.handleRemoveManufacturingJob)(message.payload);
            break;
        case shared_1.WSMessageType.SET_MANUFACTURING_AUTOBUY:
            (0, manufacturingHandler_1.handleSetManufacturingAutoBuy)(message.payload);
            break;
        case shared_1.WSMessageType.DEBUG_UNLOCK_RECIPE:
            (0, manufacturingHandler_1.handleDebugUnlockRecipe)(message.payload);
            break;
        case shared_1.WSMessageType.DEBUG_SET_INVENTORY:
            (0, auctionHandler_1.handleDebugSetInventory)(message.payload);
            break;
        case shared_1.WSMessageType.SET_LAB_AUTOBUY:
            (0, labHandler_1.handleSetLabAutoBuy)(message.payload);
            break;
        case shared_1.WSMessageType.LAB_EXPERIMENT: {
            const result = (0, labHandler_1.handleLabExperiment)(clientId, message.payload);
            sendTo(clientId, { type: shared_1.WSMessageType.LAB_RESULT, payload: result });
            break;
        }
        case shared_1.WSMessageType.MARKET_BUY:
            (0, auctionHandler_1.handleMarketBuy)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.MARKET_SELL:
            (0, auctionHandler_1.handleMarketSell)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.LIST_RECIPE:
            (0, auctionHandler_1.handleListRecipe)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.BUY_RECIPE:
            (0, auctionHandler_1.handleBuyRecipe)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.BUY_MINING_RIGHT:
            (0, auctionHandler_1.handleBuyMiningRight)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.SET_AUTO_TRADE_RULE:
            (0, auctionHandler_1.handleSetAutoTradeRule)(clientId, message.payload);
            break;
        case shared_1.WSMessageType.REMOVE_AUTO_TRADE_RULE:
            (0, auctionHandler_1.handleRemoveAutoTradeRule)(clientId, message.payload);
            break;
        default:
            console.warn(`[WS] Unknown message type: ${message.type}`);
    }
}
function sendToClient(ws, message) {
    if (ws.readyState === ws_1.default.OPEN) {
        ws.send(JSON.stringify(message));
    }
}
function broadcast(message) {
    const data = JSON.stringify(message);
    gameState_1.gameState.getAllClients().forEach((ws) => {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(data);
        }
    });
}
function sendTo(clientId, message) {
    const ws = gameState_1.gameState.getClient(clientId);
    if (ws) {
        sendToClient(ws, message);
    }
}
//# sourceMappingURL=wsServer.js.map