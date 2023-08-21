import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export class VirginiaAcmStack extends Stack {
  public readonly certificate: Certificate;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const domainName = this.node.tryGetContext('domainName');
    const hostName = this.node.tryGetContext('hostName');

    this.certificate = new Certificate(this, 'Certificate', {
      domainName: `${hostName}.${domainName}`,
      validation: CertificateValidation.fromDns(
        HostedZone.fromLookup(this, 'HostedZone', {
          domainName,
        }),
      ),
    });
  }
}
