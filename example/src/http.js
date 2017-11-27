"use strict";

const logger = require('./log');
const http = require('http');

let id = 1;

const server = http.createServer(function (req, res) {
    const requestLogger = logger.contextLogger({id: id++, method: req.method, url: req.url});
    logger.accessLogger(req, res, function(err) {
        requestLogger.info('example 1 (with context)');
        logger.logger.info('example 2 (without context)');
        requestLogger.warn('example 3 (with context)');
        requestLogger.log('error', 'example 4 (with context)');
        res.end('Hi there.');
    });
});
server.listen(8080);
