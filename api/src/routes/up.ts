import { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { createHash } from 'crypto';

const fileHandlers = {
  "image/png": { ext: "png" },
  "image/jpeg": { ext: "jpg" },
  "image/jpg": { ext: "jpg" },
  "image/webp": { ext: "webp" },
}

const fileTypes = Object.keys(fileHandlers);

export function up(req: Request, res: Response): void {
  const matchContentType = fileTypes.some(type => req.header('content-type')?.startsWith(type));
  if (!matchContentType) {
    res.status(415).send({ error: 'unsupported_media_type' });
    return;
  }
  const { body } = req;
  const hash = createHash("sha256").update(body).digest().toString("hex");

  req.log.info('inside up fn');

  res.status(200).send({ hash });
}

export const middleware = Object.entries(fileHandlers).map(([type]) => {
  return bodyParser.raw({
    type,
    limit: '10mb',
  })
});
