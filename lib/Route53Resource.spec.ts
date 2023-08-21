import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Route53Resource } from './Route53Resource';

describe('Route53Resource', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const recordTarget = {
      aliasTarget: {
        bind: () => ({
          hostedZoneId: 'CLOUDFRONT_ZONE_ID',
          dnsName: 'foobarbaz.cloudfront.net.',
        }),
      },
    } as RecordTarget;

    new Route53Resource(stack, {
      hostedZone: {
        hostedZoneId: 'MY_ZONE_ID',
        zoneName: 'example.com',
      } as unknown as HostedZone,
      recordName: 'test.example.com',
      target: recordTarget,
    });

    template = Template.fromStack(stack);
  });

  it('should generate valid Route53 record set resources', () => {
    const actual = template.findResources('AWS::Route53::RecordSet');

    expect(actual).toMatchSnapshot();
  });
});
