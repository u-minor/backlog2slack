import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { CloudFrontResource } from './CloudFrontResource';
import { DynamoDBResource } from './DynamoDBResource';
import { LambdaResource } from './LambdaResource';
import { Route53Resource } from './Route53Resource';

interface Props extends StackProps {
  certificate: ICertificate;
}

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const domainName = this.node.tryGetContext('domainName');
    const hostName = this.node.tryGetContext('hostName');

    const dynamoDBResource = new DynamoDBResource(this);

    const lambdaResource = new LambdaResource(this, {
      backlog: {
        apiKey: this.node.tryGetContext('backlogApiKey'),
        host: this.node.tryGetContext('backlogHost'),
      },
      dynamoDB: { table: dynamoDBResource.table },
      slack: {
        botToken: this.node.tryGetContext('slackBotToken'),
        signingSecret: this.node.tryGetContext('slackSigningSecret'),
      },
    });

    const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domainName,
    });

    const cloudfront = new CloudFrontResource(this, {
      certificate: props.certificate,
      domainName: `${hostName}.${domainName}`,
      lambda: { functionUrl: lambdaResource.functionUrl.url },
    });

    new Route53Resource(this, {
      hostedZone,
      recordName: `${hostName}.${domainName}`,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(cloudfront.distribution),
      ),
    });

    new CfnOutput(this, 'Endpoint URL', {
      description: 'Endpoint URL of backlog2slack',
      value: `https://${hostName}.${domainName}/`,
    });
  }
}
