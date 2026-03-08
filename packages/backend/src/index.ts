import express from 'express';

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'craftomation-backend' });
});

app.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
});
