"use strict";

const sharedLogger = require('qpp-shared-logger-node');

sharedLogger.configure({
    projectSlug: 'ExampleApp'
});

module.exports = sharedLogger.logger;
module.exports.accessLogger = sharedLogger.accessLogger;
