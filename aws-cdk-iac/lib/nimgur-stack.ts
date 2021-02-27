import { Construct, Stack, StackProps, Tags } from "@aws-cdk/core";
import { Bucket } from "@aws-cdk/aws-s3";
import { LambdaIntegration, RestApi } from "@aws-cdk/aws-apigateway";
import { LogLevel, NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { join } from "path";
import { Runtime } from "@aws-cdk/aws-lambda";
import {
  AllowedMethods,
  Distribution,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
} from "@aws-cdk/aws-cloudfront";
import { HttpOrigin, S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { AuthorizationToken, Repository } from '@aws-cdk/aws-ecr';
import { User } from '@aws-cdk/aws-iam';

export class NimgurStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (!process.env.ARN_CERTIFICATE || !process.env.CDN_HOST) {
      throw new Error("Missing ARN_CERTIFICATE and/or CDN_HOST env vars");
    }

    // The code that defines your stack goes here
    Tags.of(scope).add("project", "nimgur");

    const cert = Certificate.fromCertificateArn(
      this,
      "not-gd-cert",
      process.env.ARN_CERTIFICATE
    );
    const vpc = new Vpc(this, "nimgur-vpc");
    const securityGroup = new SecurityGroup(this, "nimgur-securitygroup", {
      vpc,
    });

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

    const handler = new NodejsFunction(this, "upload", {
      memorySize: 128,
      entry: join(__dirname, "../src/upload.ts"),
      handler: "main",
      runtime: Runtime.NODEJS_14_X,
      description: "nimgur upload function",
      environment: {
        BUCKET_ARN: bucket.bucketName,
        CDN_HOST: process.env.CDN_HOST,
        TABLE_IMAGES: imagesTable.tableName,
      },
      bundling: {
        target: "node14",
        logLevel: LogLevel.INFO,
        tsconfig: "tsconfig.json",
      },

      securityGroups: [securityGroup],
      vpc,
    });

    bucket.grantReadWrite(handler);
    imagesTable.grantReadWriteData(handler);

    const api = new RestApi(this, "upload-api", {
      restApiName: "nimgur upload handler",
      description: "nimgur upload handler",
      binaryMediaTypes: ["image/*"],
      deployOptions: {
        throttlingBurstLimit: 10,
        throttlingRateLimit: 3,
      },
    });

    const repository = new Repository(this, 'nimgur-api');

    const repositoryReadWriteUser = new User(this, 'nimgur-api-ecr-rw', {userName: 'nimgur-api-ecr-rw'});
    const repositoryReadUser = new User(this, 'nimgur-api-ecr-r', {userName: 'nimgur-api-ecr-r'});

    AuthorizationToken.grantRead(repositoryReadWriteUser);
    repository.grantPullPush(repositoryReadWriteUser);

    AuthorizationToken.grantRead(repositoryReadUser);
    repository.grantPull(repositoryReadUser);

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

    const method = api.root.addResource("up").addMethod(
      "POST",
      new LambdaIntegration(handler, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      })
    );

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
          origin: new HttpOrigin(
            `${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
            {
              originPath: "prod/",
            }
          ),
        },
        "/up2": {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          originRequestPolicy: nimgurHeadersPolicy,
          origin: new HttpOrigin(
            `${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
            {
              originPath: "prod/",
            }
          ),
        },
      },
    });
  }
}
