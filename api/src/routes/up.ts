import bodyParser from "body-parser";
import { createHash } from "crypto";
import { generateString } from "../lib/utils";
import { S3 } from "aws-sdk";
import { AppContext } from "../lib/types";
import { RequestHandler } from "express-serve-static-core";
import { Image } from "../lib/images";
import { stdSerializers } from "pino";

const fileHandlers = {
  "image/png": { fileExt: "png" },
  "image/jpeg": { fileExt: "jpg" },
  "image/jpg": { fileExt: "jpg" },
  "image/webp": { fileExt: "webp" },
};

export function route(context: AppContext): RequestHandler {
  return async (req, res, next) => {
    const matchContentType = Object.entries(fileHandlers).find(([type]) =>
      req.header("content-type")?.startsWith(type)
    );
    const { body } = req;
    if (!matchContentType || !body) {
      res.status(415).send({ error: "unsupported_media_type" });
      return;
    }
    const [contentType, { fileExt }] = matchContentType;
    const hash = createHash("sha256").update(body).digest().toString("hex");

    try {
      // noinspection LoopStatementThatDoesntLoopJS
      for await (const { id, fileExt } of await context.data.query<Image>(
        Image,
        { hash },
        {
          indexName: "i_hash",
          projection: ["id", "fileExt"],
          limit: 1,
        }
      )) {
        const responseBody = {
          href: `https://${process.env.CDN_HOST}/${id}.${fileExt}`,
        };
        req.log?.child({ hash, responseBody }).debug("cache hit");
        res.status(200).send(responseBody);
        return;
      }

      const tags = (req.header("x-nimgur-tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const image = Object.assign(new Image(), {
        id: generateString(),
        sourceIp: req.header("x-real-ip"), //just use nginx's real ip header
        fileExt,
        req: stdSerializers.req(req),
        contentType,
        hash,
        tags: new Set<string>(tags),
        createdAt: new Date(),
      });
      await Promise.all([
        context.data.put(image),
        new S3()
          .putObject({
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            Bucket: process.env.BUCKET_ARN!,
            ContentType: contentType,
            Key: `images/${image.id}.${image.fileExt}`,
            Body: body as Buffer,
          })
          .promise(),
      ]);

      const responseBody = {
        href: `https://${process.env.CDN_HOST}/${image.id}.${image.fileExt}`,
      };

      req.log?.child({ hash, fileExt, responseBody }).debug("cache miss");

      res.status(201).send(responseBody);
    } catch (e) {
      // do something more intelligent to handle this error?
      next(e);
    }
  };
}

export const middleware = [
  ...Object.keys(fileHandlers).map((type) =>
    bodyParser.raw({
      type,
      limit: "10mb",
    })
  ),
];
