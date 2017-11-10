"use strict";

const logger = require('./log');
const http = require('http');

const server = http.createServer(function (req, res) {
    logger.accessLogger(req, res, function(err) {
        res.end('Hi there.');
    });
});
server.listen(8080);
