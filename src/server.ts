import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initRedis } from './utils/redis-client';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  // Initialize Redis cache (falls back to in-memory if unavailable)
  await initRedis();

  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
