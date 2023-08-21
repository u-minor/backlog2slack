import { Stack } from 'aws-cdk-lib';
import {
  AaaaRecord,
  ARecord,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';

export interface Route53ResourceProps {
  hostedZone: IHostedZone;
  recordName: string;
  target: RecordTarget;
}

export class Route53Resource {
  constructor(stack: Stack, props: Route53ResourceProps) {
    const route53RecordProps = {
      zone: props.hostedZone,
      recordName: props.recordName,
      target: props.target,
    };

    new ARecord(stack, 'ARecord', route53RecordProps);
    new AaaaRecord(stack, 'AaaaRecord', route53RecordProps);
  }
}
