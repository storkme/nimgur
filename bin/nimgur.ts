#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { NimgurStack } from '../lib/nimgur-stack';

const app = new cdk.App();
new NimgurStack(app, 'NimgurStack');
