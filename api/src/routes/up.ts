import { Request } from 'express';
import bodyParser from 'body-parser';
import { createHash } from 'crypto';
import { generateString } from '../lib/utils';
import { S3 } from 'aws-sdk';
import { AppContext } from '../lib/types';
import { RequestHandler } from 'express-serve-static-core';
import { Image } from '../lib/images';

const fileHandlers = {
  "image/png": { ext: "png" },
  "image/jpeg": { ext: "jpg" },
  "image/jpg": { ext: "jpg" },
  "image/webp": { ext: "webp" },
}

const fileTypes = Object.keys(fileHandlers);

export function route(context: AppContext): RequestHandler {
  return async (req: Request, res) => {
    const matchContentType = fileTypes.some(type => req.header('content-type')?.startsWith(type));
    if (!matchContentType) {
      res.status(415).send({ error: 'unsupported_media_type' });
      return;
    }
    const { ext } = fileHandlers[req.header('content-type')];
    const { body } = req;
    const hash = createHash("sha256").update(body).digest().toString("hex");
    const contentType = res.header('content-type');

    // noinspection LoopStatementThatDoesntLoopJS
    for await (const { id, fileExt } of await context.data.query<Image>(
      Image,
      { hash: hash },
      {
        indexName: "i_hash",
        projection: ["id", "fileExt"],
        limit: 1,
      }
    )) {
      req.log?.info('hash hit', { hash });
      return {
        statusCode: 200,
        body: JSON.stringify({
          href: `https://${process.env.CDN_HOST}/${id}.${fileExt}`,
        }),
      };
    }

    const tags = (req.header("x-nimgur-tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const image = {
      ...new Image(),
      ...{
        id: generateString(),
        sourceIp:
          req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        fileExt: ext,
        event: { ...req, body: null },
        contentType,
        hash,
        tags: new Set<string>(tags),
        createdAt: new Date(),
      },
    };
    await Promise.all([
      context.data.put(image),
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
  }
}

export const middleware = Object.entries(fileHandlers).map(([type]) => {
  return bodyParser.raw({
    type,
    limit: '10mb',
  })
});
