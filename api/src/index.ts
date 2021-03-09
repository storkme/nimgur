import 'source-map-support/register';
import express from 'express';
import pino from 'pino-http';
import * as up from './routes/up';
import { AppContext } from './lib/types';
import { DataMapper } from '@aws/dynamodb-data-mapper';
import { DynamoDB } from 'aws-sdk';
import { Router } from '@awaitjs/express';

const app = express();
const logger = pino();
const context: AppContext = {
  data: new DataMapper({
    client: new DynamoDB({ region: 'eu-west-1' }),
  })
}

app.use(logger);

const router = Router();

router.postAsync('/up', ...up.middleware, up.route(context));
app.use(router);

app.listen(process.env.NODE_PORT ? parseInt(process.env.NODE_PORT) : 80);
