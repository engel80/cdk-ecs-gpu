#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || 'local';

new VpcStack(app, `ecs-vpc-${stage}`,  {
    env,
    description: 'VPC for EC2 ECS',
    terminationProtection: stage!='local'
});