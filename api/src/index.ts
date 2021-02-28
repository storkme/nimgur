import express from 'express';

import pino from 'pino-http';
import { middleware, up } from './routes/up';

const app = express();
const logger = pino();

app.use(logger);

app.get('/healthz', (_req, res) => {
  res.sendStatus(204);
});

app.post('/up', ...middleware, up);

app.listen(8041);
