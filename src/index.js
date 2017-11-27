'use strict';

const winston = require('winston');
require('winston-daily-rotate-file');
const morgan = require('morgan'); // access log
const rotatingFileStream = require('rotating-file-stream'); // for morgan
const fs = require('fs');
const filenames = require('./filenames');
const scrubber = require('./scrubber');

function defaultLogDirByEnvironment(options) {
    switch (options.environment) {
        case 'production':
            return `/var/log/${options.projectSlug}`;
            break;
        case 'test':
        case 'development':
        default:
            return '.';
    }
}

function logDirectory(options) {
    return (
        options.logDirectory || defaultLogDirByEnvironment(options.environment)
    );
}

function accessLogDirectory(options) {
    return (
        options.accessLog.logDirectory ||
        defaultLogDirByEnvironment(options.environment)
    );
}

function logToConsole(options) {
    return (
        options.logDirectory === 'console' ||
        (!options.logDirectory && options.environment === 'development')
    );
}

function accessLogToConsole(options) {
    return (
        options.accessLog.logDirectory === 'console' ||
        (!options.accessLog.logDirectory &&
            options.environment === 'development')
    );
}

function buildLogTransport(options) {
    if (logToConsole(options)) {
        return new winston.transports.Console();
    } else {
        if (options.rotationMaxsize !== 'none') {
            return new winston.transports.DailyRotateFile({
                filename: `${logDirectory(options)}/${filenames.logFilename(
                    options
                )}`,
                label: options.projectSlug,
                datePattern: '.yyyyMMdd.log',
                maxsize: options.rotationMaxsize || defaultRotationMaxsize
            });
        } else {
            return new winston.transports.File({
                filename: `${logDirectory(options)}/${filenames.logFilename(
                    options
                )}.log`,
                label: options.projectSlug
            });
        }
    }
}

function buildAccessLogStream(options) {
    if (accessLogToConsole(options)) {
        return undefined; // morgan uses stdout by default
    } else {
        if (options.accessLog.rotationMaxsize !== 'none') {
            return rotatingFileStream(
                filenames.accessLogFilenameGenerator(options),
                {
                    path: accessLogDirectory(options),
                    size: `${options.accessLog.rotationMaxsize ||
                        defaultRotationMaxsize}B`
                }
            );
        } else {
            return fs.createWriteStream(
                `${accessLogDirectory(options)}/${filenames.accessLogFilename(
                    options
                )}.log`,
                { flags: 'a' }
            );
        }
    }
}

const defaultRotationMaxsize = 50000000; // 50M

const defaultLevelByEnvironment = {
    development: 'debug',
    test: 'silly',
    production: 'info'
};

function logEnabled(options) {
    return options.logLevel !== 'none';
}

function logLevel(options) {
    return (
        options.logLevel ||
        defaultLevelByEnvironment[options.environment] ||
        'warn'
    );
}

const defaultAccessLogFormatByEnvironment = {
    development: 'dev',
    test: 'combined',
    production: 'combined'
};

function accessLogFormat(options) {
    return (
        options.accessLog.format ||
        defaultAccessLogFormatByEnvironment[options.environment] ||
        'combined'
    );
}

function accessLogEnabled(options) {
    return options.accessLog.format !== 'none';
}

const defaultRedactKeys = [
    'email',
    'firstname',
    'lastname',
    'password',
    'ptan',
    'tin',
    'userid',
    'username'
];

let sharedLogger = {
    accessLogger: undefined,
    logger: undefined,

    /**
    * Configure the logger.
    * @param  {Object} options config options
    */
    configure: function(options) {
        if (!options) {
            throw new Error('options are required');
        }
        if (!options.environment) {
            options.environment = process.env.NODE_ENV || 'development';
        }
        if (!options.projectSlug) {
            throw new Error('projectSlug is required');
        }

        //
        // winston: application logger
        //
        if (logEnabled(options)) {
            this.logger = new winston.Logger({
                level: logLevel(options),
                colorize: Boolean(options.logColorize),
                transports: [buildLogTransport(options)]
            });
            this.logger.rewriters.push(
                scrubber(options.redactKeys || defaultRedactKeys)
            );
        } else {
            this.logger = undefined;
        }

        //
        // morgan: http access logger
        //
        options.accessLog = options.accessLog || {};
        if (accessLogEnabled(options)) {
            this.accessLogger = morgan(accessLogFormat(options), {
                stream: buildAccessLogStream(options)
            });
        } else {
            this.accessLogger = undefined;
        }
    },

    /**
     * Return a logger that includes the given fields with all entries.
     * @param  {Object} fields metadata to include with logs
     */
    contextLogger: function(fields) {
        let logger = {};
        logger.log = (level, msg, meta) =>
            this.logger.log(level, msg, Object.assign({}, fields, meta));
        logger.error = (msg, meta) => logger.log('error', msg, meta);
        logger.warn = (msg, meta) => logger.log('warn', msg, meta);
        logger.info = (msg, meta) => logger.log('info', msg, meta);
        logger.verbose = (msg, meta) => logger.log('verbose', msg, meta);
        logger.debug = (msg, meta) => logger.log('debug', msg, meta);
        logger.silly = (msg, meta) => logger.log('silly', msg, meta);
        return logger;
    }
};

module.exports = sharedLogger;
module.exports.defaultRedactKeys = defaultRedactKeys;
