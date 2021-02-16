import { Construct, Stack, StackProps, Tags } from "@aws-cdk/core";
import { Bucket } from "@aws-cdk/aws-s3";
import { Deployment, LambdaIntegration, Method, RestApi, Stage, } from "@aws-cdk/aws-apigateway";
import { LogLevel, NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { join } from "path";
import { Runtime } from "@aws-cdk/aws-lambda";
import { AllowedMethods, Distribution } from "@aws-cdk/aws-cloudfront";
import { HttpOrigin, S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Certificate } from "@aws-cdk/aws-certificatemanager";

export class NimgurStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (!process.env.ARN_CERTIFICATE || !process.env.CDN_HOST) {
      throw new Error('Missing ARN_CERTIFICATE and/or CDN_HOST env vars');
    }

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
        BUCKET_ARN: bucket.bucketName,
        CDN_HOST: process.env.CDN_HOST
      },
      bundling: {
        target: "node14",
        logLevel: LogLevel.INFO,
      },
    });

    bucket.grantReadWrite(handler);
    //
    // const api = new RestApi(this, "upload-api", {
    //   restApiName: "nimgur upload handler",
    //   description: "nimgur upload handler",
    //   binaryMediaTypes: ["image/*"],
    //   deployOptions: {
    //     throttlingBurstLimit: 10,
    //     throttlingRateLimit: 3,
    //   }
    // });
    //
    // const method = api.root.addResource('up').addMethod(
    //   "POST",
    //   new LambdaIntegration(handler, {
    //     requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    //   }),
    //   // {
    //   // apiKeyRequired: true,
    //   // }
    // );

    // const deployment = new Deployment(this, 'nimgur-deployment', { api });
    // const stage = new Stage(this, 'prod', {
    //   deployment,
    //   methodOptions: {
    //     '/*/*': {  // This special path applies to all resource paths and all HTTP methods
    //       throttlingRateLimit: 5,
    //       throttlingBurstLimit: 20
    //     }
    //   }
    // });

    // const key = api.addApiKey('ApiKey');
    //
    // const plan = api.addUsagePlan('UsagePlan', {
    //   name: 'Basic',
    //   apiKey: key,
    //   throttle: {
    //     rateLimit: 10,
    //     burstLimit: 2
    //   }
    // });
    //
    // plan.addApiStage({
    //   stage: api.deploymentStage,
    // });

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
            `123.execute-api.${this.region}.${this.urlSuffix}`,
            {
              originPath: 'prod/'
            }
          ),
        },
      },
    });
  }
}
