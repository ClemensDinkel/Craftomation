import { Server as HttpServer } from 'http';
import { WSMessage } from '@craftomation/shared';
export declare function initWebSocketServer(server: HttpServer): void;
export declare function broadcast(message: WSMessage): void;
export declare function sendTo(clientId: string, message: WSMessage): void;
