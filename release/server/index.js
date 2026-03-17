"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const os_1 = __importDefault(require("os"));
const sessionRoutes_1 = __importDefault(require("./routes/sessionRoutes"));
const wsServer_1 = require("./websocket/wsServer");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/session', sessionRoutes_1.default);
// Serve frontend static files in production
// In dev/monorepo: relative to __dirname (packages/backend/dist -> packages/frontend/dist)
// In release: a "public" folder next to the server
const frontendDist = fs_1.default.existsSync(path_1.default.join(process.cwd(), 'public', 'index.html'))
    ? path_1.default.join(process.cwd(), 'public')
    : path_1.default.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express_1.default.static(frontendDist));
// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(frontendDist, 'index.html'));
});
// WebSocket
(0, wsServer_1.initWebSocketServer)(server);
function getLocalIp() {
    const interfaces = os_1.default.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (const info of iface) {
            if (info.family === 'IPv4' && !info.internal) {
                return info.address;
            }
        }
    }
    return null;
}
server.listen(PORT, () => {
    const ip = getLocalIp();
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
    if (ip) {
        console.log(`[Backend] LAN: http://${ip}:${PORT}`);
    }
    console.log(`[Backend] WebSocket ready on ws://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map