import express from 'express';

import pino from 'pino-http';


const app = express();
const logger = pino();

app.use(logger);

app.get('/healthz', (req, res) => {
  req.log.info('well this is dumb');
  res.sendStatus(204);
})

app.listen(8041);
