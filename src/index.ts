import { APIGatewayProxyEvent, Callback, Context } from 'aws-lambda';
import { api } from './api';
import { response } from './response';

export const handler = (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback,
) => {
  if (event.requestContext) {
    // call from API Gateway
    return api(event, context, callback);
  }

  callback(null, response(400));
};
