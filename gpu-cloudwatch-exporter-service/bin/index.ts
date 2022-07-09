#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GpuCloudwatchExporterServiceStack } from '../lib/gpu-cloudwatch-exporter-service-stack';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || 'local';

new GpuCloudwatchExporterServiceStack(app, `ecs-service-gpu-exporter-${stage}`, {
    env,
    description: 'ECS service for GPU RESTful API with ALB',
    terminationProtection: stage!='local'
});