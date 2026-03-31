import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';

import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { PORT, NODE_ENV } from './config/env.js';
import router from './routes/index.js';
import { pool } from './database/drizzle.js';
import { initWebsocket } from './websocket.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api/v1', router);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database: Connected');

    const server = createServer(app);
    initWebsocket(server);

    server.listen(PORT, () => {
      console.log(`App is running on PORT ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();

export default app;