import { Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';

export class DynamoDBResource {
  table: Table;

  constructor(stack: Stack) {
    this.table = new Table(stack, 'CacheTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'key', type: AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
    });
  }
}
