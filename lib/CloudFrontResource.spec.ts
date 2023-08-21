import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CloudFrontResource } from './CloudFrontResource';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';

describe('CloudFrontResource', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const certificate = Certificate.fromCertificateArn(
      new Stack(),
      'TestCertificate',
      'arn:aws:acm:us-east-1:1234567890:certificate/DUMMY_ID',
    );

    new CloudFrontResource(stack, {
      certificate,
      domainName: 'test.example.com',
      lambda: {
        functionUrl: 'https://RANDOM_ID.lambda-url.YOUR_REGION.on.aws/',
      },
    });

    template = Template.fromStack(stack);
  });

  it('should generate valid Cloudfront distribution resource', () => {
    const actual = template.findResources('AWS::CloudFront::Distribution');

    expect(actual).toMatchSnapshot();
  });
});
