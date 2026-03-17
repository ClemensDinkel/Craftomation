import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import os from 'os';
import sessionRoutes from './routes/sessionRoutes';
import { initWebSocketServer } from './websocket/wsServer';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/session', sessionRoutes);

// Serve frontend static files in production
// In dev/monorepo: relative to __dirname (packages/backend/dist -> packages/frontend/dist)
// In release: a "public" folder next to the server
const frontendDist = fs.existsSync(path.join(process.cwd(), 'public', 'index.html'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// WebSocket
initWebSocketServer(server);

function getLocalIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
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
