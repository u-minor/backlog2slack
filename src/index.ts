import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { api } from './api';
import { response } from './response';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext) {
    return await api(event);
  }

  return response(400, 'Invalid request');
};
