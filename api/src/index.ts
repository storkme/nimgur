import express from 'express';
import pino from 'pino-http';
import * as up from './routes/up';
import { AppContext } from './lib/types';
import { DataMapper } from '@aws/dynamodb-data-mapper';
import { DynamoDB } from 'aws-sdk';

const app = express();
const logger = pino();
const context: AppContext = {
  data: new DataMapper({
    client: new DynamoDB(),
  })
}

app.use(logger);

app.post('/up', ...up.middleware, up.route(context));

app.listen(8041);
