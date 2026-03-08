import express from 'express';
import cors from 'cors';
import http from 'http';
import sessionRoutes from './routes/sessionRoutes';
import { initWebSocketServer } from './websocket/wsServer';

const app = express();
const server = http.createServer(app);
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'craftomation-backend' });
});

// Routes
app.use('/api/session', sessionRoutes);

// WebSocket
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Backend] WebSocket ready on ws://localhost:${PORT}`);
});
