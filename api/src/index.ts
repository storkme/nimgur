import "source-map-support/register";
import express from "express";
import pino from "pino-http";
import * as up from "./routes/up";
import { AppContext } from "./lib/types";
import { DataMapper } from "@aws/dynamodb-data-mapper";
import { DynamoDB } from "aws-sdk";

const app = express();
const logger = pino({
  level: "debug",
});
const context: AppContext = {
  data: new DataMapper({
    client: new DynamoDB({ region: "eu-west-1" }),
  }),
};

app.use(logger);

app.post("/up", ...up.middleware, up.route(context));
app.put("/up", ...up.middleware, up.route(context));

app.listen(process.env.NODE_PORT ? parseInt(process.env.NODE_PORT) : 80);
