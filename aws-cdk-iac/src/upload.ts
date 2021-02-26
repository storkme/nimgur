import "source-map-support/register";

import { APIGatewayEvent, Handler } from "aws-lambda";
import { DynamoDB, S3 } from "aws-sdk";
import { createHash } from "crypto";
import { DataMapper } from "@aws/dynamodb-data-mapper";
import { Image } from "./model/images";

const letters =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const contentTypeExts = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function getHeader(event: APIGatewayEvent, name: string): string | undefined {
  return event.headers[
    Object.keys(event.headers).filter((h) => h.toLowerCase() === name)[0]
  ];
}

function generateString() {
  return Array.from({ length: 6 })
    .map(() => letters[Math.floor(Math.random() * letters.length)])
    .join("");
}

export const main: Handler = async (event: APIGatewayEvent, context) => {
  const contentType = getHeader(event, "content-type");

  if (!event.body) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: "invalid_body" }),
    };
  }

  const matchedContentType = Object.entries(contentTypeExts).find(([type]) =>
    contentType?.startsWith(type)
  );
  if (!matchedContentType || !event.body) {
    return {
      statusCode: 415,
      body: JSON.stringify({ error: "invalid_content_type" }),
    };
  }
  const [, fileExt] = matchedContentType;
  const file = Buffer.from(event.body, "base64");
  const hash = createHash("sha256").update(file).digest().toString("hex");

  const mapper = new DataMapper({
    client: new DynamoDB(),
  });

  for await (const result of mapper.query(
    Image,
    { hash: hash },
    {
      indexName: "i_hash",
      projection: ["id", "fileExt"],
      limit: 1,
    }
  )) {
    const { id, fileExt } = result;
    return {
      statusCode: 200,
      body: JSON.stringify({
        href: `https://${process.env.CDN_HOST}/${id}.${fileExt}`,
      }),
    };
  }

  const tags = (getHeader(event, "x-nimgur-tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const image = Object.assign(new Image(), {
    id: generateString(),
    sourceIp:
      getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    fileExt,
    event: { ...event, body: null },
    contentType,
    hash,
    tags: new Set<string>(tags),
    createdAt: new Date(),
  });

  await Promise.all([
    mapper.put(image),
    new S3()
      .putObject({
        Bucket: process.env.BUCKET_ARN,
        ContentType: contentType,
        Key: `images/${image.id}.${image.fileExt}`,
        Body: file,
      })
      .promise(),
  ]);

  return {
    statusCode: 201,
    body: JSON.stringify({
      href: `https://${process.env.CDN_HOST}/${image.id}.${image.fileExt}`,
    }),
  };
};
