/**
 * aglex lambda handler
 */
'use strict'
const http = require('http')
const net = require('net')
const app = require('./app')

exports.handler = (event, context, callback) => {
  if (event.body) {
    event.body = JSON.stringify(event.body)
    event.headers['content-length'] = event.body.length
  }

  let path = event.path
  for (let key in event.pathParams) {
    path = path.replace(`{${key}}`, event.pathParams[key])
  }
  const querystring = (() => {
    const results = []
    for (let key in event.queryParams) {
      results.push(`${key}=${event.queryParams[key]}`)
    }
    return results.join('&')
  })()
  if (querystring) {
    path += `?${querystring}`
  }

  const req = new http.IncomingMessage()
  req.method = event.method
  req._remoteAddress = event.remoteAddr
  req.url = path
  req.headers = {}
  for (let key in event.headers) {
    req.headers[key.toLowerCase()] = event.headers[key]
  }
  req.connection = req.socket = new net.Socket()
  const res = new http.ServerResponse(req)
  res.end = (chunk, encoding) => {
    try {
      const data = JSON.parse(chunk.toString(encoding))
      callback(null, data)
    } catch (error) {
      console.error(chunk.toString(encoding))
      callback(error, {error: error})
    }
  }

  try {
    app(req, res)
    req.emit('data', event.body)
    req.emit('end')
  } catch (error) {
    console.log('request error', error)
    callback(error, {error: error})
  }
}
