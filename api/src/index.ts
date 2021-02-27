import express from 'express';

import pino from 'pino-http';


const app = express();
const logger = pino();

app.use(logger);

app.get('/healthz', (_req, res) => {
  res.sendStatus(204);
});

app.listen(8041);
