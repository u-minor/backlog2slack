#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/MainStack';
import { VirginiaAcmStack } from '../lib/VirginiaAcmStack';

const app = new cdk.App();

const account =
  process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;

const stackUS = new VirginiaAcmStack(app, 'Backlog2SlackAcmStack', {
  crossRegionReferences: true,
  description: 'backlog2slack-acm: ACM certificate for backlog2slack',
  env: {
    account,
    region: 'us-east-1',
  },
});

new MainStack(app, 'Backlog2SlackStack', {
  crossRegionReferences: true,
  description: 'backlog2slack: Send Backlog notification to Slack',
  env: {
    account,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
  },
  certificate: stackUS.certificate,
});
