'use strict';
const api = require('./api');
const response = require('./response');

exports.handler = (event, context, callback) => {
  if (event.requestContext) {
    // call from API Gateway
    return api(event, context, callback);
  }

  callback(null, response(400));
};
