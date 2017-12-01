'use strict';

const sharedLogger = require('qpp-shared-logger-node');

sharedLogger.configure({
    projectSlug: 'ExampleApp',
    redactKeys: sharedLogger.defaultRedactKeys.concat(['pepper'])
});

module.exports = {
    logger: sharedLogger.logger,
    accessLogger: sharedLogger.accessLogger,
    contextLogger: sharedLogger.contextLogger,
};
