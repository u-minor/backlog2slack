import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DynamoDBResource } from './DynamoDBResource';

describe('DynamoDBResource', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    new DynamoDBResource(stack);

    template = Template.fromStack(stack);
  });

  it('should generate valid DynamoDB table resource', () => {
    const actual = template.findResources('AWS::DynamoDB::Table');

    expect(actual).toMatchSnapshot();
  });
});
