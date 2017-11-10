'use strict';

const sharedLogger = require('qpp-shared-logger-node');

sharedLogger.configure({
    projectSlug: 'ExampleApp',
    redactKeys: sharedLogger.defaultRedactKeys.concat(['pepper'])
});

module.exports = sharedLogger.logger;
module.exports.accessLogger = sharedLogger.accessLogger;
