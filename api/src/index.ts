import express from 'express';
import pino from 'pino-http';
import * as up from './routes/up';

const app = express();
const logger = pino();

app.use(logger);

app.post('/up', ...up.middleware, up.route);

app.listen(8041);
