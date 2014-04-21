var winston = require('winston');
var mkdirp = require('mkdirp');
var path = require('path');

var LOG_DIR = path.resolve(__dirname, 'tmp/log');
mkdirp.sync(LOG_DIR);

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      json: false,
      timestamp: true
    }),
    new winston.transports.File({
      filename: path.resolve(LOG_DIR, 'debug.log'),
      json: false
    })
  ],
  exceptionHandlers: [
    new (winston.transports.Console)({
      json: false,
      timestamp: true
    }),
    new winston.transports.File({
      filename: path.resolve(LOG_DIR, 'debug.log'),
      json: false
    })
  ],
  exitOnError: false
});

module.exports = logger;