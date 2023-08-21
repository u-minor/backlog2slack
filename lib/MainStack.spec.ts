import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { MainStack } from './MainStack';

describe('Backlog2SlackStack', () => {
  let template: Template;

  beforeAll(() => {
    const certificate = Certificate.fromCertificateArn(
      new cdk.Stack(),
      'TestCertificate',
      'arn:aws:acm:us-east-1:1234567890:certificate/DUMMY_ID',
    );
    jest.spyOn(HostedZone, 'fromLookup').mockReturnValue({
      hostedZoneId: 'MY_ZONE_ID',
      zoneName: 'example.com',
    } as unknown as HostedZone);

    const app = new cdk.App({
      context: {
        domainName: 'example.com',
        hostName: 'test',
      },
    });
    const stack = new MainStack(app, 'TestStack', {
      certificate,
      env: {
        account: '1234567890',
        region: 'us-east-1',
      },
    });

    template = Template.fromStack(stack);
  });

  it('should generate valid output', () => {
    const actual = template.findOutputs('*');

    expect(actual).toMatchSnapshot();
  });
});
