import { CfnOutput, Construct, Stack, StackProps, Tags } from "@aws-cdk/core";
import { Bucket } from "@aws-cdk/aws-s3";
import {
  AllowedMethods,
  Distribution,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
} from "@aws-cdk/aws-cloudfront";
import { HttpOrigin, S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { AuthorizationToken, Repository } from "@aws-cdk/aws-ecr";
import { User } from "@aws-cdk/aws-iam";

export class NimgurStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (
      !process.env.ARN_CERTIFICATE ||
      !process.env.CDN_HOST ||
      !process.env.API_HOST
    ) {
      throw new Error("Missing ARN_CERTIFICATE/CDN_HOST/API_HOST env vars");
    }

    // The code that defines your stack goes here
    Tags.of(scope).add("project", "nimgur");

    const cert = Certificate.fromCertificateArn(
      this,
      "cert",
      process.env.ARN_CERTIFICATE
    );

    const bucket = new Bucket(this, "nimgur");

    // create table to store metadata for uploaded images
    const imagesTable = new Table(this, "nimgur-images", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });
    // add secondary index for hash
    imagesTable.addGlobalSecondaryIndex({
      indexName: "i_hash",
      partitionKey: {
        name: "hash",
        type: AttributeType.STRING,
      },
    });

    const repository = new Repository(this, "nimgur-api", {
      repositoryName: "nimgur-api",
    });

    const repositoryReadWriteUser = new User(this, "nimgur-api-ecr-rw", {
      userName: "nimgur-api-ecr-rw",
    });

    AuthorizationToken.grantRead(repositoryReadWriteUser);
    repository.grantPullPush(repositoryReadWriteUser);

    const apiUser = new User(this, "nimgur-api-user", {
      userName: "nimgur-api",
    });
    imagesTable.grantFullAccess(apiUser);
    bucket.grantPut(apiUser);
    bucket.grantDelete(apiUser);

    // TODO: can the CDK create access keys and output them to be used with github?
    // const apiRWAccessKey = new CfnAccessKey(this, 'nimgur-api-ecr-rw-key', {
    //   userName: repositoryReadWriteUser.userName,
    // }) as any;
    // const apiRAccessKey = new CfnAccessKey(this, 'nimgur-api-ecr-r-key', {
    //   userName: repositoryReadUser.userName,
    // }) as any;
    //
    // new CfnOutput(this, 'apiRWAccessKey-accessKeyId', { value: apiRWAccessKey.accessKeyId });
    // new CfnOutput(this, 'apiRWAccessKey-secretAccessKey', { value: apiRWAccessKey.accessKeySecretAccessKey });
    //
    // new CfnOutput(this, 'apiWAccessKey-accessKeyId', { value: apiRAccessKey.accessKeyId });
    // new CfnOutput(this, 'apiWAccessKey-secretAccessKey', { value: apiRAccessKey.accessKeySecretAccessKey });

    const staticOrigin = new S3Origin(bucket, {
      originPath: "static/",
    });

    const nimgurHeadersPolicy = new OriginRequestPolicy(this, "apikey-header", {
      headerBehavior: OriginRequestHeaderBehavior.allowList(
        "x-nimgur-tags",
        "x-api-key"
      ),
      comment: "Allow x-api-key and x-nimgur headers",
    });

    new Distribution(this, "nimgur-cdn", {
      domainNames: [process.env.CDN_HOST],
      certificate: cert,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new S3Origin(bucket, {
          originPath: "images",
        }),
      },
      additionalBehaviors: {
        "/index.html": {
          origin: staticOrigin,
        },
        "/s/*": {
          origin: staticOrigin,
        },
        "/up": {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          originRequestPolicy: nimgurHeadersPolicy,
          origin: new HttpOrigin(process.env.API_HOST!),
        },
      },
    });
  }
}
