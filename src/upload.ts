import { Handler } from "aws-lambda";
import { S3 } from "aws-sdk";

const letters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateString() {
  return Array.from({length: 6}).map(c => letters[Math.floor(Math.random() * letters.length)]).join('');
}

export const main: Handler = async (event, context) => {
  const contentType = event.headers[Object.keys(event.headers).filter(h => h.toLowerCase() === 'content-type')[0]];
  if (!contentType?.startsWith("image/") || !event.body) {
    return {
      statusCode: 415,
      body: JSON.stringify({ error: "invalid_content_type" }),
    };
  }
  const file = Buffer.from(event.body, "base64");
  const fileExtension = contentType.split("/")[1];
  const imgId = generateString();
  const fileName = `${imgId}.${fileExtension}`;

  const s3 = new S3();
  const result = await s3.putObject({
    Bucket: process.env.BUCKET_ARN,
    ContentType: contentType,
    Key: `images/${fileName}`,
    Body: file,
  }).promise();

  return {
    statusCode: 200,
    body: JSON.stringify({ href: `https://${process.env.CDN_HOST}/${fileName}` }),
  };
};
