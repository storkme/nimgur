import { AppContext } from "../lib/types";
import { RequestHandler } from "express-serve-static-core";
import { Image } from "../lib/images";
import { S3 } from "aws-sdk";

export function del(context: AppContext): RequestHandler {
  return async (req, res, next) => {
    try {
      const suppliedHash = req.header("x-nimgur-hash");
      const id = req.params.imageId;
      if (!suppliedHash) {
        res.status(400).send({ error: "missing_hash_header" });
      }
      let hash, fileExt;
      try {
        const result = await context.data.get(
          Object.assign(new Image(), { id })
        );

        hash = result.hash;
        fileExt = result.fileExt;
      } catch (err) {
        res.status(404).send({ error: "id_not_found", id });
        return;
      }
      if (suppliedHash !== hash) {
        res.status(404).send({ error: "no_match" });
        return;
      }
      await Promise.all([
        context.data.delete<Image>(Object.assign(new Image(), { id })),
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
    } catch (error) {
      next(error);
    }
  };
}
