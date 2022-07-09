import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as path from 'path';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

import { CLUSTER_NAME } from '../../ecs-ec2-cluster/lib/cluster-config';
import { SSM_PREFIX } from '../../ssm-prefix';

/**
 * 
 */
export class GpuCloudwatchExporterServiceStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext('stage') || 'local';
        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/vpc-id`);
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId });
        const clusterSgId = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/cluster-securitygroup-id`);
        const ecsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ecs-security-group', clusterSgId);

        const cluster = ecs.Cluster.fromClusterAttributes(this, 'ecs-cluster', {
            clusterName: `${CLUSTER_NAME}-${stage}`,
            vpc,
            securityGroups: [ecsSecurityGroup]
        });
        const serviceName = 'gpu-metric-exporter'
        const containerName = `${serviceName}-container`
        // const applicationPort = 8080;

        const capacityProviderName = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/cluster-capacityprovider-name`);
        const executionRoleArn = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/gpu-task-execution-role-arn`);
        const taskRoleArn = ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/gpu-cloudWatch-exporter-task-role-arn`);

        const taskDefinition = new ecs.TaskDefinition(this, 'task-definition', {
            compatibility: ecs.Compatibility.EC2,
            family: `${serviceName}-task`,
            executionRole: iam.Role.fromRoleArn(this, 'task-execution-role', cdk.Lazy.string({ produce: () => executionRoleArn })),
            taskRole: iam.Role.fromRoleArn(this, 'task-role', cdk.Lazy.string({ produce: () => taskRoleArn })),
        });
        
        const logGroup = new logs.LogGroup(this, 'loggroup', {
            logGroupName: serviceName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.TWO_WEEKS,
        });
        const container = taskDefinition.addContainer('container-exporter', {
            containerName,
            image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../", "gpu-cloudwatch-exporter")),
            // or build with gpu-cloudwatch-exporter/build.sh
            // image: ecs.ContainerImage.fromRegistry(`${props?.env?.account}.dkr.ecr.${props?.env?.region}.amazonaws.com/gpu-cloudwatch-exporter:latest`),
            cpu: 128,
            memoryReservationMiB: 128,
            logging: new ecs.AwsLogDriver({ logGroup, streamPrefix: containerName, mode: ecs.AwsLogDriverMode.NON_BLOCKING })
        });
        // container.addPortMappings({ containerPort: applicationPort, hostPort: 0 });

        const ecsService = new ecs.Ec2Service(this, 'ec2-service', {
            cluster,
            serviceName,
            daemon: true,
            taskDefinition,
            enableExecuteCommand: true,
            // capacityProviderStrategies: [{
            //     capacityProvider: capacityProviderName,
            //     weight: 1
            // }]
        });
        Tags.of(ecsSecurityGroup).add('Stage', stage);    

        new CfnOutput(this, 'Service', { value: ecsService.serviceArn });
        new CfnOutput(this, 'TaskDefinition', { value: taskDefinition.family });
        new CfnOutput(this, 'LogGroup', { value: logGroup.logGroupName });
    }
}
