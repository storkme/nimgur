import express from 'express';

import pino from 'pino-http';


console.log('loaded AWS Key ID: ', process.env.NIMGUR_AWS_ACCESS_KEY_ID);

const app = express();
const logger = pino();

app.use(logger);

app.get('/healthz', (_req, res) => {
  res.sendStatus(204);
});

// app.get('/up', async (req, res) => {
//
// });

app.listen(8041);
