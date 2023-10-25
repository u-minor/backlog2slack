import { APIGatewayProxyResultV2 } from 'aws-lambda';

const messages: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  403: 'Forbidden',
  500: 'Internal Server Error',
};

export const response = (
  statusCode = 200,
  body?: string,
  headers?: Record<string, string>,
): APIGatewayProxyResultV2 => {
  return {
    body: body ?? messages[statusCode] ?? '',
    headers,
    statusCode,
  };
};
