import { APIGatewayProxyResultV2 } from 'aws-lambda';

const messages: Record<number, string> = {
  200: '',
  403: 'Forbidden',
  500: 'Bad Request',
};

export const response = (
  statusCode = 200,
  body = '',
  headers = {},
): APIGatewayProxyResultV2 => {
  return {
    body: body ?? messages[statusCode] ?? '',
    headers,
    statusCode,
  };
};
