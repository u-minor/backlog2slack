'use strict';

const messages = {
  200: '',
  403: 'Forbidden',
  500: 'Bad Request',
};
module.exports = (statusCode = 200, body = '', headers = {}) => {
  return {
    body: body || messages[statusCode] || '',
    headers,
    statusCode,
  };
};
