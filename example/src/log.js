"use strict";

const sharedLogger = require('qpp-shared-logger-node');

sharedLogger.configure({
    projectSlug: 'ExampleApp'
});

module.exports = {
    logger: sharedLogger.logger,
    accessLogger: sharedLogger.accessLogger,
    contextLogger: sharedLogger.contextLogger,
};
