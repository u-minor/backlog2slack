import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaResource } from './LambdaResource';

describe('LambdaResource', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const table = new Table(stack, 'TestCacheTable', {
      partitionKey: { name: 'key', type: AttributeType.STRING },
    });

    new LambdaResource(stack, {
      backlog: {
        apiKey: 'TEST_BACKLOG_API_KEY',
        host: 'example.backlog.jp',
      },
      dynamoDB: { table },
      slack: {
        botToken: 'TEST_SLACK_BOT_TOKEN',
        signingSecret: 'TEST_SLACK_SIGNING_SECRET',
      },
    });

    template = Template.fromStack(stack);
  });

  it('should generate valid IAM role resources', () => {
    const actual = template.findResources('AWS::IAM::Role', {
      Properties: {
        AssumeRolePolicyDocument: {
          Statement: [{ Principal: { Service: 'lambda.amazonaws.com' } }],
        },
      },
    });

    expect(actual).toMatchSnapshot();
  });

  it('should generate valid Lambda function resources', () => {
    const actual = template.findResources('AWS::Lambda::Function');

    expect(actual).toMatchSnapshot();
  });

  it('should generate valid Lambda function url resource', () => {
    const actual = template.findResources('AWS::Lambda::Url');

    expect(actual).toMatchSnapshot();
  });
});
