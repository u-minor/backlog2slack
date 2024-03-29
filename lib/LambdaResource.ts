import { Duration, Stack } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  FunctionUrl,
  FunctionUrlAuthType,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface LambdaResourceProps {
  backlog: {
    apiKey: string;
    host: string;
  };
  dynamoDB: {
    table: Table;
  };
  slack: {
    botToken: string;
    signingSecret: string;
  };
}

export class LambdaResource {
  functionUrl: FunctionUrl;
  nodejsFunction: NodejsFunction;

  constructor(stack: Stack, props: LambdaResourceProps) {
    this.nodejsFunction = new NodejsFunction(stack, 'Lambda', {
      description: 'Send Backlog notification to Slack',
      entry: 'src/index.ts',
      environment: {
        BACKLOG_API_KEY: props.backlog.apiKey,
        BACKLOG_HOST: props.backlog.host,
        CACHE_TTL: '300',
        DYNAMODB_TABLE_NAME: props.dynamoDB.table.tableName,
        SLACK_BOT_TOKEN: props.slack.botToken,
        SLACK_SIGNING_SECRET: props.slack.signingSecret,
      },
      functionName: `${stack.stackName}-Lambda`,
      handler: 'handler',
      logRetention: 7,
      memorySize: 256,
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
    });

    this.functionUrl = this.nodejsFunction.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedHeaders: ['*'],
        allowedOrigins: ['*'],
        maxAge: Duration.seconds(300),
      },
    });

    this.nodejsFunction.role?.attachInlinePolicy(
      new Policy(stack, 'PutRecordToCacheTable', {
        statements: [
          new PolicyStatement({
            actions: [
              'dynamodb:DeleteItem',
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
            ],
            resources: [props.dynamoDB.table.tableArn],
          }),
        ],
      }),
    );
  }
}
