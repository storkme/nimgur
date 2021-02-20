import { Handler } from "aws-lambda";
import { S3 } from "aws-sdk";
import {
  ExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";
import { createHash } from "crypto";

const letters =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateString() {
  return Array.from({ length: 6 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join("");
}

export const main: Handler = async (event, context) => {
  const contentType =
    event.headers[
      Object.keys(event.headers).filter(
        (h) => h.toLowerCase() === "content-type"
      )[0]
    ];
  if (!contentType?.startsWith("image/") || !event.body) {
    return {
      statusCode: 415,
      body: JSON.stringify({ error: "invalid_content_type" }),
    };
  }
  const fileExtension = contentType.split("/")[1];
  const file = Buffer.from(event.body, "base64");
  const hash = createHash("sha256").update(file).digest().toString("hex");

  const dataClient = new RDSDataClient({});

  // check if this hash already exists
  const result = await dataClient.send(
    new ExecuteStatementCommand({
      database: "nimgur",
      resourceArn: process.env.CLUSTER_ARN,
      secretArn: process.env.SECRET_ARN,
      sql: "SELECT id, ext FROM nimgur_images WHERE hash=:hash",
      parameters: [
        {
          name: "hash",
          value: {
            stringValue: hash,
          },
        },
      ],
    })
  );

  if (result.records?.length! > 0) {
    console.log("cache hit");
    const id = result.records![0][0].stringValue;
    const ext = result.records![0][1].stringValue;
    return {
      statusCode: 200,
      body: JSON.stringify({
        href: `https://${process.env.CDN_HOST}/${id}.${ext}`,
      }),
    };
  }

  const imgId = generateString();
  const fileName = `${imgId}.${fileExtension}`;

  const s3 = new S3();
  await s3
    .putObject({
      Bucket: process.env.BUCKET_ARN,
      ContentType: contentType,
      Key: `images/${fileName}`,
      Body: file,
    })
    .promise();

  const eventWithoutBody = Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== "body")
  );

  await dataClient.send(
    new ExecuteStatementCommand({
      database: "nimgur",
      resourceArn: process.env.CLUSTER_ARN,
      secretArn: process.env.SECRET_ARN,
      sql:
        'INSERT INTO "nimgur_images" (id, event, hash, ext) VALUES (:id,:event,:hash,:ext)',
      parameters: [
        {
          name: "id",
          value: {
            stringValue: imgId,
          },
        },
        {
          name: "event",
          typeHint: "JSON",
          value: {
            stringValue: JSON.stringify(eventWithoutBody),
          },
        },
        {
          name: "hash",
          value: {
            stringValue: hash,
          },
        },
        {
          name: "ext",
          value: {
            stringValue: fileExtension,
          },
        },
      ],
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify({
      href: `https://${process.env.CDN_HOST}/${fileName}`,
    }),
  };
};
