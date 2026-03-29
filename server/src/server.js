import dotenv from 'dotenv';

dotenv.config();

import { app } from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT || 5000);

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Add it in server/.env');
  }

  await connectDatabase(process.env.MONGODB_URI);
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
