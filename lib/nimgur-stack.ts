import { Construct, Duration, Stack, StackProps, Tags } from "@aws-cdk/core";
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
import { CfnCustomResource } from "@aws-cdk/aws-cloudformation";
import { HttpOrigin, S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import {
  AuroraCapacityUnit,
  DatabaseClusterEngine,
  ParameterGroup,
  ServerlessCluster,
} from "@aws-cdk/aws-rds";
import { SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import { ManagedPolicy } from "@aws-cdk/aws-iam";

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

    const cluster = new ServerlessCluster(this, "nimgur-db", {
      engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: ParameterGroup.fromParameterGroupName(
        this,
        "nimgur-parametergroup",
        "default.aurora-postgresql10"
      ),
      vpc,
      scaling: {
        autoPause: Duration.minutes(10), // default is to pause after 5 minutes of idle time
        minCapacity: AuroraCapacityUnit.ACU_2, // default is 2 Aurora capacity units (ACUs)
        maxCapacity: AuroraCapacityUnit.ACU_16, // default is 16 Aurora capacity units (ACUs)
      },
      securityGroups: [securityGroup],
    });

    const bucket = new Bucket(this, "nimgur");

    const handler = new NodejsFunction(this, "upload", {
      entry: join(__dirname, "../src/upload.ts"),
      handler: "main",
      runtime: Runtime.NODEJS_14_X,
      description: "nimgur upload function",
      environment: {
        BUCKET_ARN: bucket.bucketName,
        CDN_HOST: process.env.CDN_HOST,
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: cluster.secret?.secretArn!, // hope for the best?
      },
      bundling: {
        target: "node14",
        logLevel: LogLevel.INFO,
      },
      securityGroups: [securityGroup],
      vpc,
    });
    handler.role?.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonRDSDataFullAccess")
    );

    cluster.grantDataApiAccess(handler);

    bucket.grantReadWrite(handler);

    const api = new RestApi(this, "upload-api", {
      restApiName: "nimgur upload handler",
      description: "nimgur upload handler",
      binaryMediaTypes: ["image/*"],
      deployOptions: {
        throttlingBurstLimit: 10,
        throttlingRateLimit: 3,
      },
    });

    const method = api.root.addResource("up").addMethod(
      "POST",
      new LambdaIntegration(handler, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      })
    );

    api.root.addResource("up2").addMethod(
      "POST",
      new LambdaIntegration(handler, {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      }),
      {
        apiKeyRequired: true,
      }
    );

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

    const apiKeyPolicy = new OriginRequestPolicy(this, "apikey-header", {
      headerBehavior: OriginRequestHeaderBehavior.allowList("x-api-key"),
      comment: "Allow x-api-key header",
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
          originRequestPolicy: apiKeyPolicy,
          origin: new HttpOrigin(
            `${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
            {
              originPath: "prod/",
            }
          ),
        },
        "/up2": {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          originRequestPolicy: apiKeyPolicy,
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
