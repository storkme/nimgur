import { Construct, Stack, StackProps, Tags } from "@aws-cdk/core";
import { Bucket } from "@aws-cdk/aws-s3";
import { LambdaIntegration, RestApi, } from "@aws-cdk/aws-apigateway";
import { LogLevel, NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { join } from "path";
import { Runtime } from "@aws-cdk/aws-lambda";
import { AllowedMethods, Distribution } from "@aws-cdk/aws-cloudfront";
import { HttpOrigin, S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Certificate } from "@aws-cdk/aws-certificatemanager";

export class NimgurStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    Tags.of(scope).add("project", "nimgur");

    const cert = Certificate.fromCertificateArn(
      this,
      "not-gd-cert",
      process.env.ARN_CERTIFICATE
    );

    const bucket = new Bucket(this, "nimgur");

    const handler = new NodejsFunction(this, "upload", {
      entry: join(__dirname, "../src/upload.ts"),
      handler: "main",
      runtime: Runtime.NODEJS_14_X,
      description: "nimgur upload function",
      environment: {
        BUCKET_ARN: bucket.bucketArn,
        CDN_HOST: process.env.CDN_HOST
      },
      bundling: {
        target: "node14",
        logLevel: LogLevel.INFO,
      },
    });

    bucket.grantReadWrite(handler);

    const api = new RestApi(this, "upload-api", {
      restApiName: "nimgur upload handler",
      description: "nimgur upload handler",
      binaryMediaTypes: ["image/*"],
    });

    api.root.addResource('up').addMethod(
      "POST",
      new LambdaIntegration(handler, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      })
    );

    const staticOrigin = new S3Origin(bucket, {
      originPath: "static/",
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
        "/static/*": {
          origin: staticOrigin,
        },
        "/up": {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          origin: new HttpOrigin(
            `${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
            {
              originPath: 'prod/'
            }
          ),
        },
      },
    });
  }
}
