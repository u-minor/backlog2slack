const messages: Record<number, string> = {
  200: '',
  403: 'Forbidden',
  500: 'Bad Request',
};
export default (statusCode = 200, body = '', headers = {}) => {
  return {
    body: body ?? messages[statusCode] ?? '',
    headers,
    statusCode,
  };
};
