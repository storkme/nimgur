import { AppContext } from "../lib/types";
import { RequestHandler } from "express-serve-static-core";
import { Image } from "../lib/images";
import { S3 } from "aws-sdk";

export function del(context: AppContext): RequestHandler {
  return async (req, res, next) => {
    try {
      const suppliedHash = req.header("x-nimgur-hash");
      const id = req.query.imageId;
      if (!suppliedHash) {
        res.status(400).send({ error: "missing_hash_header" });
      }
      // noinspection LoopStatementThatDoesntLoopJS
      for await (const { hash, fileExt } of await context.data.query<Image>(
        Image,
        { id },
        {
          projection: ["hash", "fileExt"],
          limit: 1,
        }
      )) {
        if (suppliedHash !== hash) {
          res.status(404).send({ error: "no_match" });
        }
        await Promise.all([
          context.data.delete<Image>(Object.assign(new Image(), { id, hash })),
          new S3()
            .deleteObject({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              Bucket: process.env.BUCKET_ARN!,
              Key: `images/${id}.${fileExt}`,
            })
            .promise(),
        ]);
        req.log?.child({ hash }).debug("deleted image");
        res.status(204).send();
        return;
      }

      res.status(404).send({ error: "no_match" });
    } catch (error) {
      next(error);
    }
  };
}
